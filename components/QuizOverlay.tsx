
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { ControlRefs } from '../types';
import { createQuizSession, createQuizSessionFromQuestions, getQuizResult, QuizSession, QuizQuestion } from '../services/quizData';
import { prepareXiaozhiSpeech, speakXiaozhi, stopXiaozhiSpeech } from '../services/xiaozhiSpeechService';
import { X, Trophy, Star, Clock, CheckCircle2, XCircle, Zap, Sparkles, Loader2, SkipForward } from 'lucide-react';

interface QuizOverlayProps {
  stageRef: React.RefObject<HTMLElement>;
  controlRef: React.MutableRefObject<ControlRefs>;
  cameraActive: boolean;
  onExit: () => void;
  subjectFilter?: string;
  warmupQuestions?: QuizQuestion[];
  onComplete?: (result: ReturnType<typeof getQuizResult>, session: QuizSession) => void;
}

type QuizPhase = 'intro' | 'reading' | 'answering' | 'result' | 'summary';

// ─── Component ───────────────────────────────────────────
const QuizOverlay: React.FC<QuizOverlayProps> = ({ stageRef, controlRef, cameraActive, onExit, subjectFilter, warmupQuestions, onComplete }) => {
  const [phase, setPhase] = useState<QuizPhase>('intro');
  const [session, setSession] = useState<QuizSession>(() => warmupQuestions?.length ? createQuizSessionFromQuestions(warmupQuestions) : createQuizSession(5, subjectFilter));
  const [countdown, setCountdown] = useState(3);
  const [hoveredOption, setHoveredOption] = useState<number | null>(null);
  const [hoverProgress, setHoverProgress] = useState(0); // 0 to 1
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);
  const [isCorrect, setIsCorrect] = useState<boolean | null>(null);
  const [showExplanation, setShowExplanation] = useState(false);
  const [voiceError, setVoiceError] = useState('');
  const [expandedWrongId, setExpandedWrongId] = useState<string | null>(null);
  const [xiaozhiExplainingId, setXiaozhiExplainingId] = useState<string | null>(null);

  const speakQuiz = useCallback((text: string) => speakXiaozhi(text, {
    onStart: () => setVoiceError(''),
    onError: (error) => {
      console.warn('[Quiz voice] Browser speech unavailable:', error);
      setVoiceError('当前浏览器语音播报暂不可用，答题流程将继续');
    },
  }), []);

  const optionRefs = useRef<(HTMLDivElement | null)[]>([]);
  const restartBtnRef = useRef<HTMLButtonElement>(null);
  const exitBtnRef = useRef<HTMLButtonElement>(null);
  const restartProgressRef = useRef<HTMLDivElement>(null);
  const exitProgressRef = useRef<HTMLDivElement>(null);
  const pointerRef = useRef<HTMLDivElement>(null);
  const pointerSmoothRef = useRef({ x: 0, y: 0, initialized: false });
  const pointerStableRef = useRef({ x: 0, y: 0, initialized: false });
  const pointerStableSinceRef = useRef(0);
  const hoverStartRef = useRef<number>(0);
  const hoverOptionRef = useRef<number | null>(null);
  const hoverCandidateRef = useRef<{ option: number | null; frames: number }>({ option: null, frames: 0 });
  const lastProgressPctRef = useRef<number>(-1);
  const phaseRef = useRef(phase);
  const sessionRef = useRef(session);
  const reportedSessionRef = useRef<number | null>(null);

  useEffect(() => { phaseRef.current = phase; }, [phase]);
  useEffect(() => { sessionRef.current = session; }, [session]);
  useEffect(() => {
    prepareXiaozhiSpeech();
    return () => stopXiaozhiSpeech();
  }, []);

  const currentQuestion: QuizQuestion | null =
    session.currentIndex < session.questions.length
      ? session.questions[session.currentIndex]
      : null;

  const quizResult = phase === 'summary' ? getQuizResult(session) : null;

  useEffect(() => {
    if (phase !== 'summary' || !quizResult || reportedSessionRef.current === session.startTime) return;
    reportedSessionRef.current = session.startTime;
    onComplete?.(quizResult, session);
  }, [onComplete, phase, quizResult, session]);

  // ─── Phase: INTRO ──────────────────────────────────────
  useEffect(() => {
    if (phase !== 'intro') return;
    let cancelled = false;
    (async () => {
      // Don't await speech so countdown starts immediately
      speakQuiz('答题模式已开启，准备好了吗？');
      
      // countdown 3, 2, 1
      for (let i = 3; i >= 1; i--) {
        if (cancelled) return;
        setCountdown(i);
        await new Promise(r => setTimeout(r, 1000));
      }
      if (cancelled) return;
      setPhase('reading');
    })();
    return () => { cancelled = true; };
  }, [phase, speakQuiz]);

  // ─── Phase: READING (TTS only, no typewriter) ─────────────────
  useEffect(() => {
    if (phase !== 'reading' || !currentQuestion) return;
    setSelectedAnswer(null);
    setIsCorrect(null);
    setHoveredOption(null);
    setHoverProgress(0);
    setShowExplanation(false);
    hoverOptionRef.current = null;
    pointerSmoothRef.current.initialized = false;
    pointerStableRef.current.initialized = false;
    pointerStableSinceRef.current = 0;
    hoverCandidateRef.current = { option: null, frames: 0 };

    const qText = currentQuestion.question;

    // Speak the question
    speakQuiz(`第 ${sessionRef.current.currentIndex + 1} 题。${qText}`);
    
    // Immediately advance to answering phase
    setPhase('answering');

  }, [phase, currentQuestion, speakQuiz]);

  // ─── Phase: ANSWERING — hand hover detection ───────────
  useEffect(() => {
    if (phase !== 'answering' || !currentQuestion) return;
    const HOVER_CONFIRM_MS = 1200;
    let animFrame: number;
    const optionCount = currentQuestion.options.length;

    const checkHover = () => {
      if (phaseRef.current !== 'answering') return;

      let hitOption: number | null = null;

      // 1. Check the index fingertip; the palm center is too coarse for adjacent answers.
      if (cameraActive) {
        const handLm = controlRef.current.interactionHandLandmarks;
        if (handLm && handLm.length > 17) {
          // A bent index finger is not a reliable pointer. Requiring an extended
          // index prevents the palm/fingertips from selecting an answer while
          // the user is moving their hand into position.
          const wrist = handLm[0];
          const indexTip = handLm[8];
          const indexPip = handLm[6];
          const tipDistance = Math.hypot(indexTip.x - wrist.x, indexTip.y - wrist.y);
          const pipDistance = Math.hypot(indexPip.x - wrist.x, indexPip.y - wrist.y);
          const isPointing = indexTip.y < indexPip.y - 0.01 || tipDistance > pipDistance * 1.08;
          if (!isPointing) {
            hitOption = null;
            if (pointerRef.current) pointerRef.current.style.opacity = '0';
            pointerStableRef.current.initialized = false;
            pointerStableSinceRef.current = 0;
          } else {
          // Use the index fingertip as the pointer; the palm center is too coarse for adjacent answers.
          const centerX = handLm[8].x;
          const centerY = handLm[8].y;

          const stageEl = stageRef.current;
          if (stageEl) {
            const stageRect = stageEl.getBoundingClientRect();
            let targetX = stageRect.left + (1 - centerX) * stageRect.width;
            let targetY = stageRect.top + centerY * stageRect.height;
            
            if (!pointerSmoothRef.current.initialized) {
              pointerSmoothRef.current.x = targetX;
              pointerSmoothRef.current.y = targetY;
              pointerSmoothRef.current.initialized = true;
            } else {
              // High smoothing factor (0.85) for silky and stable movement
              pointerSmoothRef.current.x = pointerSmoothRef.current.x * 0.85 + targetX * 0.15;
              pointerSmoothRef.current.y = pointerSmoothRef.current.y * 0.85 + targetY * 0.15;
            }

            const screenX = pointerSmoothRef.current.x;
            const screenY = pointerSmoothRef.current.y;

            hitOption = checkHitOnOptions(screenX, screenY, optionCount);

            const now = performance.now();
            const stable = pointerStableRef.current;
            const movement = stable.initialized ? Math.hypot(screenX - stable.x, screenY - stable.y) : Infinity;
            if (!stable.initialized || movement > 20) {
              stable.x = screenX;
              stable.y = screenY;
              stable.initialized = true;
              pointerStableSinceRef.current = now;
            } else {
              stable.x = stable.x * 0.8 + screenX * 0.2;
              stable.y = stable.y * 0.8 + screenY * 0.2;
            }
            // Update virtual pointer position
            if (pointerRef.current) {
              pointerRef.current.style.transform = `translate(${screenX}px, ${screenY}px)`;
              pointerRef.current.style.opacity = '1';
            }
          }
          }
        } else {
          if (pointerRef.current) pointerRef.current.style.opacity = '0';
          pointerStableRef.current.initialized = false;
          pointerStableSinceRef.current = 0;
        }
      }

      // Update hover state
      if (hitOption !== null && pointerStableRef.current.initialized && performance.now() - pointerStableSinceRef.current >= 140) {
        // Require a few consecutive frames before switching options. This filters
        // single-frame detector jitter at the boundary between adjacent cards.
        const candidate = hoverCandidateRef.current;
        if (candidate.option === hitOption) candidate.frames += 1;
        else hoverCandidateRef.current = { option: hitOption, frames: 1 };
        const candidateReady = hoverOptionRef.current === hitOption || hoverCandidateRef.current.frames >= 4;

        if (!candidateReady) {
          // Do not let the previous card continue counting while a new card is
          // being verified at a boundary.
          hoverStartRef.current = performance.now();
          lastProgressPctRef.current = 0;
          setHoverProgress(0);
        } else if (hoverOptionRef.current === hitOption) {
          // Same option — accumulate hover time
          const elapsed = performance.now() - hoverStartRef.current;
          const progress = Math.min(1, Math.max(0, elapsed / HOVER_CONFIRM_MS));
          // 只在 progress 的整数 % 变化时才 setState，避免每帧 re-render
          const progressPct = Math.round(progress * 100);
          if (progressPct !== lastProgressPctRef.current) {
            lastProgressPctRef.current = progressPct;
            setHoverProgress(progress);
          }

          if (progress >= 1) {
            // Confirmed!
            confirmAnswer(hitOption);
            return;
          }
        } else if (candidateReady) {
          // Switched to a different option (or first hit)
          hoverOptionRef.current = hitOption;
          // Require a short settle period after entering a new option.
          hoverStartRef.current = performance.now() + 140;
          lastProgressPctRef.current = 0;
          setHoveredOption(hitOption);
          setHoverProgress(0);
        }
      } else {
        // No option hovered
        hoverCandidateRef.current = { option: null, frames: 0 };
        if (hoverOptionRef.current !== null) {
          hoverOptionRef.current = null;
          lastProgressPctRef.current = -1;
          setHoveredOption(null);
          setHoverProgress(0);
        }
      }

      animFrame = requestAnimationFrame(checkHover);
    };

    animFrame = requestAnimationFrame(checkHover);
    return () => cancelAnimationFrame(animFrame);
  }, [phase, cameraActive, currentQuestion]);

  // ─── Phase: SUMMARY — hand hover detection ───────────
  useEffect(() => {
    if (phase !== 'summary') return;
    const HOVER_CONFIRM_MS = 2000;
    let animFrame: number;
    let restartHoverStart = 0;
    let exitHoverStart = 0;

    const checkHover = () => {
      if (phaseRef.current !== 'summary') return;

      if (cameraActive) {
        const handLm = controlRef.current.interactionHandLandmarks;
        if (handLm && handLm.length > 17) {
          const centerX = handLm[8].x;
          const centerY = handLm[8].y;

          const stageEl = stageRef.current;
          if (stageEl) {
            const stageRect = stageEl.getBoundingClientRect();
            let targetX = stageRect.left + (1 - centerX) * stageRect.width;
            let targetY = stageRect.top + centerY * stageRect.height;
            
            if (!pointerSmoothRef.current.initialized) {
              pointerSmoothRef.current.x = targetX;
              pointerSmoothRef.current.y = targetY;
              pointerSmoothRef.current.initialized = true;
            } else {
              pointerSmoothRef.current.x = pointerSmoothRef.current.x * 0.85 + targetX * 0.15;
              pointerSmoothRef.current.y = pointerSmoothRef.current.y * 0.85 + targetY * 0.15;
            }

            const screenX = pointerSmoothRef.current.x;
            const screenY = pointerSmoothRef.current.y;

            if (pointerRef.current) {
              pointerRef.current.style.transform = `translate(${screenX}px, ${screenY}px)`;
              pointerRef.current.style.opacity = '1';
            }

            const margin = 10;
            let hitRestart = false;
            let hitExit = false;

            if (restartBtnRef.current) {
              const rect = restartBtnRef.current.getBoundingClientRect();
              if (screenX >= rect.left - margin && screenX <= rect.right + margin &&
                  screenY >= rect.top - margin && screenY <= rect.bottom + margin) {
                hitRestart = true;
              }
            }

            if (exitBtnRef.current) {
              const rect = exitBtnRef.current.getBoundingClientRect();
              if (screenX >= rect.left - margin && screenX <= rect.right + margin &&
                  screenY >= rect.top - margin && screenY <= rect.bottom + margin) {
                hitExit = true;
              }
            }

            const now = Date.now();

            if (hitRestart) {
              if (restartHoverStart === 0) restartHoverStart = now;
              exitHoverStart = 0;
              if (exitProgressRef.current) exitProgressRef.current.style.width = '0%';
              const progress = Math.min((now - restartHoverStart) / HOVER_CONFIRM_MS, 1);
              if (restartProgressRef.current) restartProgressRef.current.style.width = `${progress * 100}%`;
              if (progress >= 1) {
                // handleRestart will be called when click confirms, but it's defined later.
                // We can't directly call it here because it's captured in the closure. 
                // So we'll click the button ref instead.
                restartBtnRef.current?.click();
                restartHoverStart = 0;
                if (restartProgressRef.current) restartProgressRef.current.style.width = '0%';
              }
            } else if (hitExit) {
              if (exitHoverStart === 0) exitHoverStart = now;
              restartHoverStart = 0;
              if (restartProgressRef.current) restartProgressRef.current.style.width = '0%';
              const progress = Math.min((now - exitHoverStart) / HOVER_CONFIRM_MS, 1);
              if (exitProgressRef.current) exitProgressRef.current.style.width = `${progress * 100}%`;
              if (progress >= 1) {
                exitBtnRef.current?.click();
                exitHoverStart = 0;
                if (exitProgressRef.current) exitProgressRef.current.style.width = '0%';
              }
            } else {
              restartHoverStart = 0;
              exitHoverStart = 0;
              if (restartProgressRef.current) restartProgressRef.current.style.width = '0%';
              if (exitProgressRef.current) exitProgressRef.current.style.width = '0%';
            }
          }
        } else {
          if (pointerRef.current) pointerRef.current.style.opacity = '0';
          restartHoverStart = 0;
          exitHoverStart = 0;
          if (restartProgressRef.current) restartProgressRef.current.style.width = '0%';
          if (exitProgressRef.current) exitProgressRef.current.style.width = '0%';
        }
      }

      animFrame = requestAnimationFrame(checkHover);
    };

    animFrame = requestAnimationFrame(checkHover);
    return () => cancelAnimationFrame(animFrame);
  }, [phase, cameraActive]);

  const checkHitOnOptions = (screenX: number, screenY: number, count: number): number | null => {
    const activeOption = hoverOptionRef.current;
    const strictHits: Array<{ index: number; distance: number }> = [];
    for (let idx = 0; idx < count; idx++) {
      const el = optionRefs.current[idx];
      if (!el) continue;
      const rect = el.getBoundingClientRect();
      if (
        screenX >= rect.left && screenX <= rect.right &&
        screenY >= rect.top && screenY <= rect.bottom
      ) {
        const cx = (rect.left + rect.right) / 2;
        const cy = (rect.top + rect.bottom) / 2;
        strictHits.push({ index: idx, distance: Math.hypot(screenX - cx, screenY - cy) });
      }
    }
    if (strictHits.length) {
      return strictHits.sort((a, b) => a.distance - b.distance)[0].index;
    }

    // Keep a modest hysteresis zone for the currently selected card, but never
    // expand every card at once (which made neighboring options overlap).
    if (activeOption !== null) {
      const el = optionRefs.current[activeOption];
      if (el) {
        const rect = el.getBoundingClientRect();
        const margin = 22;
        if (screenX >= rect.left - margin && screenX <= rect.right + margin &&
            screenY >= rect.top - margin && screenY <= rect.bottom + margin) {
          return activeOption;
        }
      }
    }
    return null;
  };

  // ─── Answer confirmation ───────────────────────────────
  const confirmAnswer = useCallback((optionIndex: number) => {
    if (phaseRef.current !== 'answering' || !currentQuestion) return;
    
    phaseRef.current = 'result'; // Synchronously block duplicate calls
    setPhase('result');
    setSelectedAnswer(optionIndex);
    
    const correct = optionIndex === currentQuestion.correctIndex;
    setIsCorrect(correct);
    setHoveredOption(null);
    setHoverProgress(0);
    hoverOptionRef.current = null;

    // Record answer
    setSession(prev => {
      const newAnswers = [...prev.answers];
      newAnswers[prev.currentIndex] = optionIndex;
      return { ...prev, answers: newAnswers };
    });
  }, [currentQuestion]);

  // ─── Advance to next question (shared by auto-advance & skip) ───
  const advanceToNextQuestion = useCallback(() => {
    const nextIndex = sessionRef.current.currentIndex + 1;
    if (nextIndex >= sessionRef.current.questions.length) {
      setPhase('summary');
    } else {
      setSession(prev => ({ ...prev, currentIndex: nextIndex }));
      setPhase('reading');
    }
  }, []);

  // Skip the current result narration: stop speaking and jump to the next question.
  const skipResult = useCallback(() => {
    stopXiaozhiSpeech();
    advanceToNextQuestion();
  }, [advanceToNextQuestion]);

  // ─── Phase: RESULT ───────────────────────────────────────
  useEffect(() => {
    if (phase !== 'result' || !currentQuestion || selectedAnswer === null) return;
    let cancelled = false;
    let advanceTimer: number | null = null;

    const correct = selectedAnswer === currentQuestion.correctIndex;
    
    const advanceNext = () => {
      if (cancelled) return;
      advanceToNextQuestion();
    };

    if (correct) {
      speakQuiz('回答正确！');
      const timer = setTimeout(advanceNext, 2000);
      return () => {
        cancelled = true;
        clearTimeout(timer);
      };
    } else {
      (async () => {
        // Keep the quiz moving if local synthesis or audio playback stalls.
        const safeSpeak = (text: string, maxWait: number) => Promise.race([
          speakQuiz(text),
          new Promise<void>(r => setTimeout(r, maxWait))
        ]);

        await safeSpeak(`很遗憾，正确答案是 ${String.fromCharCode(65 + currentQuestion.correctIndex)}：${currentQuestion.options[currentQuestion.correctIndex]}`, 4000);
        if (cancelled) return;
        
        setShowExplanation(true);
        await safeSpeak(currentQuestion.explanation, 10000);
        if (cancelled) return;
        
        advanceTimer = window.setTimeout(advanceNext, 2000);
      })();
      
      return () => {
        cancelled = true;
        if (advanceTimer !== null) window.clearTimeout(advanceTimer);
      };
    }
  }, [phase, currentQuestion, selectedAnswer, speakQuiz, advanceToNextQuestion]);

  // ─── Speak summary on enter ────────────────────────────
  useEffect(() => {
    if (phase !== 'summary') return;
    const result = getQuizResult(sessionRef.current);
    speakQuiz(`答题结束！你共答对 ${result.correctCount} 题，正确率 ${result.accuracy}%，总用时 ${result.totalTime} 秒。`);
  }, [phase, speakQuiz]);

  // ─── Click fallback for non-camera mode ────────────────
  const handleOptionClick = (index: number) => {
    if (phase !== 'answering') return;
    confirmAnswer(index);
  };

  // ─── Xiaozhi explain wrong question ────────────────────
  const handleXiaozhiExplain = (q: QuizQuestion) => {
    // 正在讲解这道题时再点一次 = 跳过播报
    if (xiaozhiExplainingId === q.id) {
      stopXiaozhiSpeech();
      setXiaozhiExplainingId(null);
      return;
    }
    setXiaozhiExplainingId(q.id);
    const text = `这道题「${q.question}」的正确答案是 ${String.fromCharCode(65 + q.correctIndex)}：${q.options[q.correctIndex]}。${q.explanation}`;
    speakXiaozhi(text, {
      onEnd: () => setXiaozhiExplainingId(null),
      onError: () => setXiaozhiExplainingId(null),
    });
  };

  // ─── Exit handler ──────────────────────────────────────
  const handleExit = () => {
    stopXiaozhiSpeech();
    onExit();
  };

  const handleRestart = () => {
    stopXiaozhiSpeech();
    setVoiceError('');
    setSession(warmupQuestions?.length ? createQuizSessionFromQuestions(warmupQuestions) : createQuizSession(5, subjectFilter));
    setPhase('intro');
    setCountdown(3);
  };

  // ─── Subject emoji helper ─────────────────────────────
  const subjectEmoji = (subject: string) => {
    switch (subject) {
      case '心脏模型': return '🫀';
      case 'HIV 病毒模型': return '🦠';
      case '金刚石模型': return '💎';
      case '金刚石晶胞': return '🧊';
      case '1,4-二氯甲基苯': return '⚗️';
      case 'NaCl 离子晶体': return '🧂';
      case 'SiO₂ 二氧化硅': return '🪨';
      case '硝基苯': return '🧪';
      case '地球内部结构': return '🌍';
      case '地形地貌': return '⛰️';
      default: return '📚';
    }
  };

  // ─── Render ────────────────────────────────────────────
  return (
    <div className="quiz-overlay">
      {/* Virtual Hand Pointer */}
      {cameraActive && (
        <div
          ref={pointerRef}
          className="fixed top-0 left-0 w-8 h-8 pointer-events-none z-[9999] opacity-0 transition-opacity duration-200 ease-out"
          style={{ willChange: 'transform', transform: 'translate(-100px, -100px)' }}
        >
          <div className="absolute -translate-x-1/2 -translate-y-1/2 flex items-center justify-center">
            <div className="w-4 h-4 bg-cyan-400 rounded-full shadow-[0_0_15px_rgba(34,211,238,0.8)] animate-pulse" />
            <div className="absolute w-8 h-8 rounded-full border-2 border-cyan/50 animate-ping" />
          </div>
        </div>
      )}

      {/* Exit button */}
      <button
        className="quiz-exit-btn"
        onClick={handleExit}
        title="退出答题模式"
      >
        <X size={20} />
      </button>

      {voiceError && (
        <div
          role="status"
          className="fixed left-1/2 top-5 z-[9998] -translate-x-1/2 rounded-xl border border-amber-400/40 bg-slate-950/90 px-4 py-2 text-sm font-medium text-amber-200 shadow-lg backdrop-blur"
        >
          {voiceError}
        </div>
      )}

      {/* ─── INTRO PHASE ─── */}
      {phase === 'intro' && (
        <div className="quiz-center-container quiz-fade-in">
          <div className="quiz-intro-card">
            <div className="quiz-intro-icon">
              <Zap size={48} className="text-yellow-400" />
            </div>
            <h1 className="quiz-intro-title">答题挑战</h1>
            <p className="quiz-intro-subtitle">共 {session.questions.length} 题 · 手势选择答案</p>
            <div className="quiz-countdown-ring">
              <span className="quiz-countdown-number">{countdown}</span>
            </div>
          </div>
        </div>
      )}

      {/* ─── READING / ANSWERING / RESULT ─── */}
      {(phase === 'reading' || phase === 'answering' || phase === 'result') && currentQuestion && (
        <div
          className="quiz-game-container quiz-fade-in"
          onClick={phase === 'result' ? skipResult : undefined}
          title={phase === 'result' ? '点击屏幕任意处跳过播报' : undefined}
        >
          {/* Progress bar */}
          <div className="quiz-progress-bar">
            {session.questions.map((_, i) => (
              <div
                key={i}
                className={`quiz-progress-dot ${
                  i < session.currentIndex ? 'is-done' :
                  i === session.currentIndex ? 'is-current' : ''
                } ${
                  session.answers[i] !== null
                    ? session.answers[i] === session.questions[i].correctIndex ? 'is-correct' : 'is-wrong'
                    : ''
                }`}
              />
            ))}
          </div>

          {/* Subject badge + question number */}
          <div className="quiz-question-header">
            <span className="quiz-subject-badge">
              {subjectEmoji(currentQuestion.subject)} {currentQuestion.subject}
            </span>
            <span className="quiz-question-number">
              {session.currentIndex + 1} / {session.questions.length}
            </span>
          </div>

          {/* Question card */}
          <div className="quiz-question-card">
            <p className="quiz-question-text">
              {currentQuestion.question}
            </p>
          </div>

          {/* Options (always rendered to reserve exact layout space) */}
          <div 
            className={currentQuestion.options.length === 4 ? 'quiz-options-grid' : 'quiz-options-row'} 
          >
              {currentQuestion.options.map((option, idx) => {
                const optIdx = idx;
                const isHovered = hoveredOption === optIdx && phase === 'answering';
                const isSelected = selectedAnswer === optIdx;
                const isCorrectOption = currentQuestion.correctIndex === optIdx;
                const showCorrectMark = phase === 'result' && isCorrectOption;
                const showWrongMark = phase === 'result' && isSelected && !isCorrectOption;

                return (
                  <div
                    key={idx}
                    ref={(el) => { optionRefs.current[idx] = el; }}
                    className={`quiz-option-card ${
                      phase === 'answering' ? 'quiz-card-enter' : ''
                    } ${isHovered ? 'is-hovered' : ''} ${
                      showCorrectMark ? 'is-correct' : ''
                    } ${showWrongMark ? 'is-wrong' : ''}`}
                    onClick={() => handleOptionClick(optIdx)}
                  >
                    {/* Hover ring progress */}
                    {isHovered && (
                      <svg className="quiz-hover-ring" viewBox="0 0 100 100">
                        <circle
                          cx="50" cy="50" r="45"
                          className="quiz-hover-ring-track"
                        />
                        <circle
                          cx="50" cy="50" r="45"
                          className="quiz-hover-ring-fill"
                          strokeDasharray="283"
                          strokeDashoffset={283 - hoverProgress * 283}
                        />
                      </svg>
                    )}

                    <div className="quiz-option-label">{String.fromCharCode(65 + idx)}</div>
                    <div className="quiz-option-text">{option}</div>
                  </div>
                );
              })}
            </div>

          {/* Explanation */}
          {phase === 'result' && showExplanation && currentQuestion.explanation && (
            <div className="quiz-explanation quiz-fade-in">
              <p>{currentQuestion.explanation}</p>
            </div>
          )}

          {/* Skip / next button */}
          {phase === 'result' && (
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); skipResult(); }}
              className="quiz-skip-advance-btn"
              title="跳过播报，进入下一题"
            >
              <SkipForward size={15} />
              <span>跳过 · 下一题</span>
            </button>
          )}

          {/* Gesture hint */}
          {phase === 'answering' && cameraActive && (
            <div className="quiz-gesture-hint quiz-fade-in">
              <span>☝ 用食指指向答案，稳定悬停 1.2 秒确认选择</span>
            </div>
          )}
          {phase === 'answering' && !cameraActive && (
            <div className="quiz-gesture-hint quiz-fade-in">
              <span>💡 请开启摄像头使用手势答题，或直接点击选项</span>
            </div>
          )}
        </div>
      )}

      {/* ─── SUMMARY PHASE ─── */}
      {phase === 'summary' && quizResult && (
        <div className="quiz-center-container quiz-fade-in">
          <div className="quiz-summary-card">
            <div className="quiz-summary-trophy">
              <Trophy size={56} className="text-yellow-400" />
            </div>
            <h2 className="quiz-summary-title">答题结束</h2>
            <div className="quiz-summary-stars">
              {[0, 1, 2].map(i => (
                <Star
                  key={i}
                  size={32}
                  className={i < quizResult.stars ? 'text-yellow-400 fill-yellow-400' : 'text-slate-600'}
                />
              ))}
            </div>
            <div className="quiz-summary-stats">
              <div className="quiz-stat">
                <CheckCircle2 size={20} className="text-emerald-400" />
                <span>{quizResult.correctCount} / {quizResult.totalQuestions} 正确</span>
              </div>
              <div className="quiz-stat">
                <Zap size={20} className="text-cyan" />
                <span>正确率 {quizResult.accuracy}%</span>
              </div>
              <div className="quiz-stat">
                <Clock size={20} className="text-purple-400" />
                <span>用时 {quizResult.totalTime} 秒</span>
              </div>
            </div>

            {/* Wrong questions summary — 错题小结 */}
            {(() => {
              const wrongList = session.questions
                .map((q, i) => ({ q, i, userAns: session.answers[i] }))
                .filter(({ q, userAns }) => userAns !== q.correctIndex);
              if (wrongList.length === 0) return null;
              return (
                <div className="mt-4 border-t border-slate-700/50 pt-4">
                  <div className="mb-2 flex items-center gap-2 text-sm font-bold text-amber-300">
                    <XCircle size={16} /> 错题小结（{wrongList.length} 题）
                  </div>
                  <div className="quiz-wrong-list">
                    {wrongList.map(({ q, i, userAns }) => {
                      const isExpanded = expandedWrongId === q.id;
                      const isExplaining = xiaozhiExplainingId === q.id;
                      return (
                        <div key={q.id} className="quiz-wrong-item">
                          <div
                            className="quiz-wrong-header"
                            onClick={() => setExpandedWrongId(isExpanded ? null : q.id)}
                          >
                            <span className="quiz-wrong-idx">{i + 1}</span>
                            <span className="quiz-wrong-q truncate">{q.question}</span>
                            <span className="ml-auto text-xs text-slate-400">{isExpanded ? '▲' : '▼'}</span>
                          </div>
                          {isExpanded && (
                            <div className="quiz-wrong-body">
                              <div className="mb-2 text-xs text-slate-300">
                                <div><span className="text-rose-400 font-semibold">你的答案：</span>
                                  {userAns !== null && userAns !== undefined
                                    ? `${String.fromCharCode(65 + userAns)}. ${q.options[userAns]}`
                                    : '未作答'}
                                </div>
                                <div><span className="text-emerald-400 font-semibold">正确答案：</span>
                                  {String.fromCharCode(65 + q.correctIndex)}. {q.options[q.correctIndex]}
                                </div>
                              </div>
                              <div className="mb-3 rounded-lg border border-slate-700/40 bg-slate-800/60 p-2 text-xs text-slate-200 leading-relaxed">
                                {q.explanation}
                              </div>
                              <div className="flex flex-wrap items-center gap-2">
                                <button
                                  type="button"
                                  onClick={(e) => { e.stopPropagation(); handleXiaozhiExplain(q); }}
                                  className={`quiz-xiaozhi-explain-btn ${isExplaining ? 'is-loading' : ''}`}
                                  title={isExplaining ? '再点一次停止播报' : '让小智讲解'}
                                >
                                  {isExplaining ? (
                                    <><Loader2 size={14} className="animate-spin" /><span>小智讲解中…</span></>
                                  ) : (
                                    <><Sparkles size={14} /><span>让小智讲解</span></>
                                  )}
                                </button>
                                {isExplaining && (
                                  <button
                                    type="button"
                                    onClick={(e) => { e.stopPropagation(); stopXiaozhiSpeech(); setXiaozhiExplainingId(null); }}
                                    className="quiz-xiaozhi-skip-btn"
                                    title="跳过播报"
                                  >
                                    <SkipForward size={14} /><span>跳过</span>
                                  </button>
                                )}
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })()}

            {/* Answer detail list */}
            <div className="quiz-summary-detail">
              {session.questions.map((q, i) => {
                const userAns = session.answers[i];
                const correct = userAns === q.correctIndex;
                return (
                  <div key={q.id} className={`quiz-detail-row ${correct ? 'is-correct' : 'is-wrong'}`}>
                    <span className="quiz-detail-idx">{i + 1}</span>
                    <span className="quiz-detail-q">{q.question.length > 20 ? q.question.slice(0, 20) + '…' : q.question}</span>
                    <span className="quiz-detail-icon">
                      {correct
                        ? <CheckCircle2 size={16} className="text-emerald-400" />
                        : <XCircle size={16} className="text-red-400" />
                      }
                    </span>
                  </div>
                );
              })}
            </div>

            <div className="quiz-summary-actions">
              <button 
                ref={restartBtnRef}
                className="quiz-btn-restart relative overflow-hidden" 
                onClick={handleRestart}
              >
                <div 
                  ref={restartProgressRef}
                  className="absolute left-0 top-0 bottom-0 bg-white/20"
                  style={{ width: '0%' }}
                />
                <span className="relative z-10">再来一轮</span>
              </button>
              <button 
                ref={exitBtnRef}
                className="quiz-btn-exit relative overflow-hidden" 
                onClick={handleExit}
              >
                <div 
                  ref={exitProgressRef}
                  className="absolute left-0 top-0 bottom-0 bg-white/20"
                  style={{ width: '0%' }}
                />
                <span className="relative z-10">退出答题</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default QuizOverlay;
