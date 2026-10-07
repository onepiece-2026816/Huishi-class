import type { WarmupQuestion } from './quizData';
import type { CoursewareManifest } from '../types/courseware';

export const CLASSROOM_PREPARE_TIMEOUT_MS = 12_000;

export function validateClassroomQuestions(questions: WarmupQuestion[]) {
  const invalid = questions.filter((question) => question.enabled).some((question) => {
    const options = question.options.map((option) => option.trim());
    return !question.question.trim() || !question.explanation.trim() || options.length < 2
      || options.some((option) => !option) || new Set(options).size !== options.length
      || !Number.isInteger(question.correctIndex) || question.correctIndex < 0
      || question.correctIndex >= options.length;
  });
  if (invalid) throw new Error('请先修正练习题：题干、选项、正确答案和解析不能为空，选项不能重复');
}

export async function prepareClassroomCourseware({ lessonPlan, model, questions, manifest, signal,
  timeoutMs = CLASSROOM_PREPARE_TIMEOUT_MS }: {
  lessonPlan: { id: string };
  model?: Record<string, unknown> | null;
  questions: WarmupQuestion[];
  manifest?: CoursewareManifest | null;
  signal?: AbortSignal;
  timeoutMs?: number;
}): Promise<CoursewareManifest> {
  signal?.throwIfAborted();
  validateClassroomQuestions(questions);
  let result = manifest?.lessonId === lessonPlan.id ? manifest : null;
  // Classroom playback reuses edited scenes; static model views are only needed for PPT export.
  if (!result) {
    const controller = new AbortController();
    const cancel = () => controller.abort(signal?.reason);
    signal?.addEventListener('abort', cancel, { once: true });
    const timer = setTimeout(() => controller.abort(new Error('课堂内容准备超时，请重试；教案和模型已保留')), timeoutMs);
    try {
      const response = await fetch('/api/prep/courseware/generate', {
        method: 'POST', credentials: 'include', signal: controller.signal,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lessonPlan, model, questions }),
      });
      const data = await response.json();
      if (!response.ok || !data.manifest) throw new Error(data.error || data.message || '课堂内容准备失败，请重试');
      result = data.manifest as CoursewareManifest;
    } catch (error) {
      if (controller.signal.aborted) throw controller.signal.reason;
      throw error;
    } finally {
      clearTimeout(timer);
      signal?.removeEventListener('abort', cancel);
    }
  }
  signal?.throwIfAborted();
  const hasQuiz = questions.some((question) => question.enabled);
  const scenes = hasQuiz ? result.scenes : result.scenes?.filter((scene) => scene.type !== 'gesture-quiz');
  if (result.lessonId !== lessonPlan.id || !scenes?.some((scene) => scene.enabled)) {
    throw new Error('当前课件没有可用场景，请在互动课件中生成或启用场景后重试');
  }
  return {
    ...result,
    questions,
    // Do not silently replace an absent/disabled quiz with the backend's template questions.
    scenes,
  };
}
