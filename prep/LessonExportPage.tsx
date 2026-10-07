import { useEffect, useMemo, useRef, useState } from 'react'
import { ArrowLeft, Check, Download, LoaderCircle, Maximize2, Minimize2, Pencil } from 'lucide-react'
import {
  buildLessonWord,
  buildTeacherLessonDraft,
  buildTeacherLessonWord,
  canExportLesson,
  lessonExportSections,
  lessonWordFilename,
  validateTeacherLessonDraft,
  type ExportLesson,
  type TeacherLessonDraft,
} from '../services/lessonWordExport'
import './lesson-export.css'

type TeacherLessonReview = {
  draft: TeacherLessonDraft
  quality: { valid: boolean; blocking: string[]; checks?: string[] }
}

export default function LessonExportPage({
  plan, editing, onBack, onNotice, review, onReviewChange,
}: {
  plan: ExportLesson
  editing: boolean
  onBack: () => void
  onNotice: (message: string) => void
  review: TeacherLessonReview | null
  onReviewChange: (review: TeacherLessonReview | null) => void
}) {
  const [busy, setBusy] = useState(false)
  const [editingDraft, setEditingDraft] = useState(false)
  const pageRef = useRef<HTMLElement>(null)
  const [expanded, setExpanded] = useState(false)
  useEffect(() => {
    const page = pageRef.current
    const root = page?.getRootNode() as Document | ShadowRoot
    const syncFullscreen = () => setExpanded(root.fullscreenElement === page)
    root.addEventListener('fullscreenchange', syncFullscreen)
    return () => root.removeEventListener('fullscreenchange', syncFullscreen)
  }, [])
  const toggleExpanded = async () => {
    try {
      const root = pageRef.current?.getRootNode() as Document | ShadowRoot
      if (root.fullscreenElement === pageRef.current) await document.exitFullscreen()
      else await pageRef.current?.requestFullscreen()
    } catch {
      onNotice('暂时无法全屏查看，请重试')
    }
  }
  const isUndergraduate = Boolean(plan.designWorkflow)
  const currentReview = useMemo(() => {
    if (!isUndergraduate) return null
    const draft = review?.draft || buildTeacherLessonDraft(plan)
    return { draft, quality: validateTeacherLessonDraft(draft) }
  }, [isUndergraduate, plan, review])

  useEffect(() => {
    if (!review && currentReview) onReviewChange(currentReview)
  }, [review, currentReview, onReviewChange])

  const updateDraft = (patch: Partial<TeacherLessonDraft>) => {
    if (!currentReview) return
    const draft = { ...currentReview.draft, ...patch }
    const quality = validateTeacherLessonDraft(draft)
    onReviewChange({ draft, quality })
  }
  const download = async () => {
    if (busy || editing || !canExportLesson(plan) || (isUndergraduate && (!currentReview?.quality.valid || editingDraft))) return
    setBusy(true)
    try {
      const blob = isUndergraduate
        ? await buildTeacherLessonWord(currentReview!.draft)
        : await buildLessonWord(plan)
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = lessonWordFilename(isUndergraduate ? currentReview!.draft.title : plan.title)
      document.body.appendChild(link)
      link.click()
      link.remove()
      window.setTimeout(() => URL.revokeObjectURL(url), 60000)
      onNotice('教师版 Word 教案已导出')
    } catch (reason) { onNotice(reason instanceof Error ? reason.message : '导出失败，请重试') }
    finally { setBusy(false) }
  }
  const legacyReady = !editing && canExportLesson(plan)
  const teacherReady = Boolean(currentReview?.quality.valid && !editingDraft && legacyReady)
  const ready = isUndergraduate ? teacherReady : legacyReady

  return <section ref={pageRef} className={`lesson-export-page${expanded ? ' is-expanded' : ''}`} aria-label="导出教案">
    <div className="lesson-export-scroll">
    <header className="lesson-export-toolbar">
      <div><h3>导出教案</h3><span>教师版 · Word 文档</span></div>
      <div className="lesson-export-buttons">
        <button className="outline-btn" onClick={onBack}><ArrowLeft size={15} />返回教案</button>
        {isUndergraduate && currentReview && <button className="outline-btn" onClick={() => setEditingDraft(value => !value)} disabled={busy}>{editingDraft ? <Check size={15} /> : <Pencil size={15} />}{editingDraft ? '完成修改' : '编辑教案'}</button>}
        <button className="primary-btn" disabled={!ready || busy} onClick={() => void download()}>{busy ? <LoaderCircle className="spin" size={15} /> : <Download size={15} />}{busy ? '正在导出' : '导出 Word'}</button>
        <button type="button" className="outline-btn lesson-export-expand" aria-label={expanded ? '还原教案预览' : '放大教案预览'} title={expanded ? '还原教案预览' : '放大教案预览'} aria-pressed={expanded} onClick={() => void toggleExpanded()}>{expanded ? <Minimize2 size={18} /> : <Maximize2 size={18} />}</button>
      </div>
    </header>

    {isUndergraduate && currentReview && <>
      {!legacyReady && <p role="status">{editing ? '请先保存教案修改。' : '教案有待确认的修改，请返回重新校验并确认整套教案。'}</p>}
      {!currentReview.quality.valid && <ul className="teacher-review-errors" role="alert">{currentReview.quality.blocking.map(item => <li key={item}>{item}</li>)}</ul>}
      {editingDraft ? <TeacherLessonEditor draft={currentReview.draft} onChange={updateDraft} /> : <TeacherLessonPreview draft={currentReview.draft} />}
    </>}

    {!isUndergraduate && !legacyReady && <p role="status">{editing ? '请先保存教案修改。' : '教案有待确认的修改，请返回重新校验并确认整套教案。'}</p>}
    {!isUndergraduate && <article className="lesson-export-paper"><h1>{plan.title} 教案</h1>{lessonExportSections(plan).map((section, index) => <section key={index}><h2>{section.title}</h2>{section.lines.map((line, lineIndex) => <p key={lineIndex}>{line}</p>)}</section>)}</article>}
    </div>
  </section>
}

function TeacherLessonPreview({ draft }: { draft: TeacherLessonDraft }) {
  const list = (items: string[]) => <ul>{items.map((item, index) => <li key={`${index}-${item}`}>{item}</li>)}</ul>
  return <article className="lesson-export-paper teacher-lesson-paper">
    <h1>{draft.title}</h1>
    <div className="teacher-lesson-meta">{draft.courseName && <span>{draft.courseName}</span>}<span>本课时长：{draft.duration}分钟</span></div>
    {draft.overview && <p className="teacher-lesson-overview">{draft.overview}</p>}
    <section><h2>教学目标</h2>{list(draft.objectives)}</section>
    {(draft.keyPoints.length > 0 || draft.difficulties.length > 0) && <section className="teacher-lesson-pair">{draft.keyPoints.length > 0 && <div><h2>教学重点</h2>{list(draft.keyPoints)}</div>}{draft.difficulties.length > 0 && <div><h2>教学难点</h2>{list(draft.difficulties)}</div>}</section>}
    {(draft.teacherPreparation.length > 0 || draft.studentPreparation.length > 0) && <section><h2>课前准备</h2>{draft.teacherPreparation.length > 0 && <p><b>教师</b>　{draft.teacherPreparation.join('；')}</p>}{draft.studentPreparation.length > 0 && <p><b>学生</b>　{draft.studentPreparation.join('；')}</p>}</section>}
    <section><h2>教学过程</h2><div className="teacher-process-list">{draft.process.map((item, index) => <article key={`${index}-${item.name}`}>
      <header><strong>{item.name}</strong><span>{item.minutes} 分钟</span></header>
      <p><b>教师活动</b>{item.teacherActivity}</p><p><b>学生活动</b>{item.studentActivity}</p>
      {item.question && <p><b>关键提问</b>{item.question}</p>}{item.check && <p><b>检查要点</b>{item.check}</p>}
    </article>)}</div></section>
    {draft.homework.length > 0 && <section><h2>课后作业</h2>{list(draft.homework)}</section>}
    {draft.blackboardDesign.length > 0 && <section><h2>板书设计</h2>{list(draft.blackboardDesign)}</section>}
    {draft.references.length > 0 && <section><h2>参考资料</h2>{list(draft.references)}</section>}
  </article>
}

function TeacherLessonEditor({ draft, onChange }: { draft: TeacherLessonDraft; onChange: (patch: Partial<TeacherLessonDraft>) => void }) {
  const lines = (items: string[]) => items.join('\n')
  const parseLines = (value: string) => value.split('\n').map(item => item.trim()).filter(Boolean)
  return <div className="teacher-lesson-editor">
    <label>教案标题<input value={draft.title} onChange={event => onChange({ title: event.target.value })} /></label>
    <label>本课时长（分钟）<input type="number" min={1} value={draft.duration} onChange={event => onChange({ duration: Number(event.target.value) })} /></label>
    <label>课程说明<textarea rows={4} value={draft.overview} onChange={event => onChange({ overview: event.target.value })} /></label>
    <label>教学目标（每行一条）<textarea rows={4} value={lines(draft.objectives)} onChange={event => onChange({ objectives: parseLines(event.target.value) })} /></label>
    <div className="teacher-lesson-pair"><label>教学重点<textarea rows={4} value={lines(draft.keyPoints)} onChange={event => onChange({ keyPoints: parseLines(event.target.value) })} /></label><label>教学难点<textarea rows={4} value={lines(draft.difficulties)} onChange={event => onChange({ difficulties: parseLines(event.target.value) })} /></label></div>
    <label>教师课前准备（每行一条）<textarea rows={3} value={lines(draft.teacherPreparation)} onChange={event => onChange({ teacherPreparation: parseLines(event.target.value) })} /></label>
    <label>学生课前准备（每行一条）<textarea rows={3} value={lines(draft.studentPreparation)} onChange={event => onChange({ studentPreparation: parseLines(event.target.value) })} /></label>
    <h3>教学过程</h3>
    {draft.process.map((item, index) => <fieldset key={index}><legend>{item.name} · {item.minutes} 分钟</legend>
      <label>环节名称<input value={item.name} onChange={event => onChange({ process: draft.process.map((row, i) => i === index ? { ...row, name: event.target.value } : row) })} /></label>
      <label>环节时长（分钟）<input type="number" min={0} value={item.minutes} onChange={event => onChange({ process: draft.process.map((row, i) => i === index ? { ...row, minutes: Number(event.target.value) } : row) })} /></label>
      <label>教师活动<textarea rows={4} value={item.teacherActivity} onChange={event => onChange({ process: draft.process.map((row, i) => i === index ? { ...row, teacherActivity: event.target.value } : row) })} /></label>
      <label>学生活动<textarea rows={3} value={item.studentActivity} onChange={event => onChange({ process: draft.process.map((row, i) => i === index ? { ...row, studentActivity: event.target.value } : row) })} /></label>
      <label>关键提问<input value={item.question} onChange={event => onChange({ process: draft.process.map((row, i) => i === index ? { ...row, question: event.target.value } : row) })} /></label>
      <label>检查要点<input value={item.check} onChange={event => onChange({ process: draft.process.map((row, i) => i === index ? { ...row, check: event.target.value } : row) })} /></label>
    </fieldset>)}
    <label>课后作业（每行一条）<textarea rows={3} value={lines(draft.homework)} onChange={event => onChange({ homework: parseLines(event.target.value) })} /></label>
    <label>板书设计（每行一条）<textarea rows={4} value={lines(draft.blackboardDesign)} onChange={event => onChange({ blackboardDesign: parseLines(event.target.value) })} /></label>
  </div>
}
