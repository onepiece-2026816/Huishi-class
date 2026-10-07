import { useEffect, useMemo, useState } from 'react'
import { AlertTriangle, ArrowRight, Check, LoaderCircle, RefreshCw, RotateCcw, Save, Sparkles, WandSparkles } from 'lucide-react'
import type { DesignStep, LessonDesignWorkflow, ObjectiveGroup } from '../types/lessonDesign'
import { mergeLessonPlanUpdate } from '../services/lessonPlanIdentity'

type LessonPlanLike = {
  id: string
  createdAt: string
  request: Record<string, unknown>
  designWorkflow?: LessonDesignWorkflow
  modelAsset?: Record<string, unknown>
  [key: string]: unknown
}

type Props = {
  plan: LessonPlanLike
  onChange: (plan: LessonPlanLike) => void
  onNotice: (message: string) => void
  onComplete: () => void
}

const field = (value: unknown) => String(value ?? '')

export default function UndergraduateDesignWorkflow({ plan, onChange, onNotice, onComplete }: Props) {
  const workflow = plan.designWorkflow
  const [active, setActive] = useState(workflow?.currentStep || 1)
  const [busy, setBusy] = useState('')
  const [aiInstruction, setAiInstruction] = useState('')
  const [localModel, setLocalModel] = useState<{ available: boolean; model: string; message: string } | null>(null)
  const step = workflow?.steps[active - 1]
  const allApproved = Boolean(workflow?.status === 'approved')
  const quality = workflow?.quality
  const finalStepNumber = 5
  const guidedLimit = workflow?.steps.find((item) => !item.approved || item.status === 'stale')?.number || finalStepNumber

  useEffect(() => {
    let activeRequest = true
    fetch('/api/prep/local-model/status', { credentials: 'include' })
      .then((response) => response.json())
      .then((data) => { if (activeRequest) setLocalModel(data) })
      .catch(() => { if (activeRequest) setLocalModel({ available: false, model: 'qwen3:4b', message: 'AI 服务暂不可用' }) })
    return () => { activeRequest = false }
  }, [])

  const updateWorkflow = (next: LessonDesignWorkflow) => onChange({ ...plan, designWorkflow: next })
  const updateStep = (nextStep: DesignStep, invalidateDownstream = false) => {
    if (!workflow) return
    const steps = workflow.steps.map((item, index) => {
      if (item.id === nextStep.id) return { ...nextStep, source: 'teacher-edited' as const, approved: false }
      if (invalidateDownstream && index > nextStep.number - 1) return { ...item, status: 'stale' as const, approved: false }
      return item
    })
    updateWorkflow({ ...workflow, steps, status: 'review', qualityPending: true, staleSteps: steps.filter((item) => item.status === 'stale').map((item) => item.id) })
  }
  const updateData = (patch: Record<string, unknown>, invalidateDownstream = false) => {
    if (!step) return
    updateStep({ ...step, data: { ...step.data, ...patch } }, invalidateDownstream)
  }
  const post = async (url: string, body: Record<string, unknown>) => {
    const response = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
    const data = await response.json()
    if (!response.ok) throw new Error(data.error || '本科教案处理失败')
    if (data.lessonPlan) onChange(mergeLessonPlanUpdate(plan, { ...data.lessonPlan, request: plan.request }))
    return data
  }
  const validate = async (approveAll = false) => {
    if (!workflow) return
    if (approveAll && workflow.steps.some((item) => item.status === 'stale')) {
      onNotice('仍有受上游修改影响的步骤，请逐项确认后再批准整套教案')
      return
    }
    setBusy('validate')
    try {
      const data = await post('/api/prep/lesson-design/validate', { workflow, request: plan.request, forExport: approveAll, approveAll })
      if (data.quality?.blocking?.length) {
        const issue = data.quality.blocking[0]
        const affected = data.workflow?.steps?.find((item: DesignStep) => issue.stepId === item.id || issue.message.includes(item.title))
        if (affected) setActive(affected.number)
        onNotice(issue.message)
      } else if (approveAll) {
        onNotice('五步教案已确认，可以导出 Word 教案')
        onComplete()
      } else onNotice('教案结构已重新校验')
    } catch (error) { onNotice(error instanceof Error ? error.message : '校验失败') }
    finally { setBusy('') }
  }
  const approveCurrent = async () => {
    if (!workflow || !step) return
    const steps = workflow.steps.map((item) => item.id === step.id ? { ...item, approved: true, status: 'ready' as const } : item)
    const nextStepNumber = Math.min(finalStepNumber, step.number + 1)
    const next = { ...workflow, steps, currentStep: nextStepNumber, qualityPending: true, staleSteps: steps.filter((item) => item.status === 'stale').map((item) => item.id) }
    setBusy('approve')
    try {
      const data = await post('/api/prep/lesson-design/validate', { workflow: next, request: plan.request, forExport: false, approveAll: false })
      if (!data.quality?.blocking?.length || data.quality.blocking.every((item: { code: string }) => item.code === 'stale-steps')) {
        setActive(nextStepNumber)
        onNotice(`第 ${step.number} 步已确认`)
      } else onNotice(data.quality.blocking[0].message)
    } catch (error) { onNotice(error instanceof Error ? error.message : '步骤确认失败') }
    finally { setBusy('') }
  }
  const regenerate = async () => {
    if (!workflow || !step) return
    setBusy('regenerate')
    try {
      await post('/api/prep/lesson-design/generate-step', { workflow, request: plan.request, mode: workflow.mode, step: step.number, model: plan.modelAsset })
      onNotice(`第${step.number}步已重新生成，后续步骤已标记待同步`)
    } catch (error) { onNotice(error instanceof Error ? error.message : '步骤生成失败') }
    finally { setBusy('') }
  }
  const editWithAi = async () => {
    if (!workflow || !step || !aiInstruction.trim()) {
      onNotice('请先输入具体的教案修改要求')
      return
    }
    setBusy('ai-edit')
    try {
      const data = await post('/api/prep/lesson-design/edit-step', {
        workflow,
        request: plan.request,
        step: step.number,
        instruction: aiInstruction.trim(),
        model: plan.modelAsset,
      })
      setAiInstruction('')
      onNotice(data.editSummary || `已使用 AI 修改第 ${step.number} 步`)
    } catch (error) { onNotice(error instanceof Error ? error.message : 'AI 编辑失败') }
    finally { setBusy('') }
  }
  const sync = async () => {
    if (!workflow) return
    setBusy('sync')
    try {
      const data = await post('/api/prep/lesson-design/sync-downstream', { workflow, request: plan.request, mode: workflow.mode, model: plan.modelAsset })
      onNotice(data.conflicts?.length ? `同步完成，保留了 ${data.preservedSteps.length} 项教师编辑内容` : '后续步骤已同步')
    } catch (error) { onNotice(error instanceof Error ? error.message : '同步失败') }
    finally { setBusy('') }
  }
  const restoreSystem = () => {
    if (!workflow || !step?.systemData) {
      onNotice('当前步骤没有可恢复的系统版本，请使用“重做本步”')
      return
    }
    const steps = workflow.steps.map((item, index) => {
      if (item.id === step.id) return { ...item, data: structuredClone(step.systemData), source: 'generated' as const, approved: false, status: 'ready' as const }
      if (index > step.number - 1 && item.source !== 'teacher-edited') return { ...item, approved: false, status: 'stale' as const }
      return item
    })
    updateWorkflow({ ...workflow, steps, qualityPending: true, status: 'review', staleSteps: steps.filter((item) => item.status === 'stale').map((item) => item.id) })
    onNotice(`第 ${step.number} 步已恢复系统版本，请重新校验`)
  }

  if (!workflow || !step) return null

  return <section className="design-workflow">
    <header className="design-workflow-head">
      <div><span className="section-kicker">FIVE-STEP DESIGN</span><h3>本科五步教学设计</h3><p>教师提供规范 · {workflow.duration}分钟 · {workflow.abilityLevel}</p></div>
      <div className="design-engine" data-engine={workflow.generation.engine}><Sparkles size={15} /><div><strong>{(workflow.generation.engine === 'responses' || workflow.generation.engine === 'ollama') ? 'AI 生成' : 'AI 生成失败，模板回退'}</strong><small>{(workflow.generation.engine === 'responses' || workflow.generation.engine === 'ollama') ? '已根据课程信息生成教案内容' : '已使用系统模板保证教案可以继续编辑'}</small></div></div>
    </header>
    <nav className="design-step-nav" aria-label="本科五步教案">
      {workflow.steps.map((item) => { const locked = workflow.mode === 'guided' && item.number > guidedLimit; return <button key={item.id} disabled={locked} title={locked ? '请先确认前一步' : undefined} className={`${active === item.number ? 'active' : ''} ${item.status === 'stale' ? 'stale' : ''}`} onClick={() => setActive(item.number)}><span>{item.number}</span><strong>{item.title}</strong>{item.approved ? <Check size={13} /> : item.status === 'stale' ? <AlertTriangle size={13} /> : null}</button> })}
    </nav>
    <div className="design-quality-line">
      <strong>{workflow.qualityPending ? '内容已修改 · 待校验' : `质检 ${quality?.score ?? 0}`}</strong>
      <span>{quality?.blocking?.length || 0} 个阻断问题</span><span>{quality?.warnings?.length || 0} 个提醒</span>
      {workflow.staleSteps.length > 0 && <button className="outline-btn compact" onClick={sync} disabled={Boolean(busy)}><RotateCcw size={14} />同步受影响步骤</button>}
    </div>
    <div className="design-step-editor">
      <div className="design-step-title"><div><span>步骤 {step.number}</span><h4>{step.title}</h4></div><div>{!allApproved && <><button className="outline-btn compact" onClick={restoreSystem} disabled={Boolean(busy) || !step.systemData}><RotateCcw size={14} />恢复系统版</button><button className="outline-btn compact" onClick={regenerate} disabled={Boolean(busy)}><RefreshCw size={14} />重做本步</button><button className="outline-btn compact" onClick={() => validate(false)} disabled={Boolean(busy)}><Save size={14} />保存并校验</button><button className="primary-btn compact" onClick={approveCurrent} disabled={Boolean(busy) || step.approved}><Check size={14} />{step.approved ? '本步已确认' : '确认本步'}</button></>}</div></div>
      <div className="design-ai-editor">
        <div className="design-ai-editor-head"><div><WandSparkles size={16} /><span><strong>AI 编辑</strong><small>{localModel?.available ? 'AI 服务已连接' : 'AI 服务暂不可用'}</small></span></div><em>{aiInstruction.length}/1000</em></div>
        <textarea maxLength={1000} rows={3} value={aiInstruction} onChange={(event) => setAiInstruction(event.target.value)} placeholder="例如：把本步改得更适合大一基础层；增加学生可见产出；问题链改为由观察到分析。" />
        <div className="design-ai-editor-actions"><span>只修改当前步骤；结构、ID 和教师已编辑的其他步骤不会被覆盖。</span><button className="primary-btn compact" onClick={editWithAi} disabled={Boolean(busy) || !aiInstruction.trim() || localModel?.available === false}>{busy === 'ai-edit' ? <LoaderCircle className="spin" size={14} /> : <Sparkles size={14} />}AI 润色</button></div>
      </div>
      <StepEditor step={step} workflow={workflow} updateData={updateData} updateWorkflow={updateWorkflow} />
    </div>
    {(quality?.blocking?.length || quality?.warnings?.length) ? <div className="design-issues">{quality.blocking.map((item) => <p className="blocking" key={item.code}><AlertTriangle size={14} />{item.message}</p>)}{quality.warnings.map((item) => <p key={item.code}>{item.message}</p>)}</div> : null}
    <footer className={`design-workflow-actions ${allApproved ? 'is-approved' : ''}`}><span>{allApproved ? '五步设计已通过质检，可以生成 PPT 与编辑练习题' : workflow.mode === 'guided' ? '逐步确认完成后才能导出本科PPT' : '审核五步内容后确认整套教案'}</span>{allApproved ? <span className="workflow-approved-label"><Check size={15} />整套五步教案已确认</span> : <button className="primary-btn" onClick={() => validate(true)} disabled={Boolean(busy) || workflow.steps.some((item) => item.status === 'stale')}>{busy ? <LoaderCircle className="spin" size={15} /> : <Check size={15} />}确认整套五步教案</button>}</footer>
  </section>
}

function StepEditor({ step, workflow, updateData, updateWorkflow }: { step: DesignStep; workflow: LessonDesignWorkflow; updateData: (patch: Record<string, unknown>, invalidate?: boolean) => void; updateWorkflow: (workflow: LessonDesignWorkflow) => void }) {
  if (step.id === 'objectives') {
    const groups = step.data.candidateGroups as ObjectiveGroup[]
    const selectedGroup = groups.find((group) => group.id === workflow.selectedObjectiveGroupId) || groups[0]
    const select = (group: ObjectiveGroup) => {
      const steps = workflow.steps.map((item, index) => index === 0 ? { ...item, data: { ...item.data, selectedGroupId: group.id }, source: 'teacher-edited' as const, approved: false } : { ...item, status: 'stale' as const, approved: false })
      updateWorkflow({ ...workflow, selectedObjectiveGroupId: group.id, selectedObjectives: group.objectives, steps, qualityPending: true, staleSteps: steps.filter((item) => item.status === 'stale').map((item) => item.id) })
    }
    const editObjective = (objectiveIndex: number, key: string, value: string) => {
      const nextGroups = groups.map((group) => group.id !== selectedGroup.id ? group : { ...group, objectives: group.objectives.map((objective, index) => {
        if (index !== objectiveIndex) return objective
        const next = { ...objective, [key]: value }
        next.text = `针对${next.audience}，${next.condition}，能够${next.behavior}，达到${next.degree}。`
        return next
      }) })
      const nextSelected = nextGroups.find((group) => group.id === selectedGroup.id)!
      const steps = workflow.steps.map((item, index) => index === 0 ? { ...item, data: { ...item.data, candidateGroups: nextGroups, selectedGroupId: selectedGroup.id }, source: 'teacher-edited' as const, approved: false } : { ...item, status: 'stale' as const, approved: false })
      updateWorkflow({ ...workflow, selectedObjectives: nextSelected.objectives, steps, qualityPending: true, staleSteps: steps.slice(1).map((item) => item.id) })
    }
    return <><div className="objective-groups">{groups.map((group) => <button type="button" key={group.id} className={workflow.selectedObjectiveGroupId === group.id ? 'selected' : ''} onClick={() => select(group)}><span>{group.levelFit}</span><strong>{group.name}</strong><p>{group.classroomDirection}</p>{group.objectives.map((objective) => <small key={objective.id}>{objective.bloomLevel} · {objective.text}</small>)}</button>)}</div><div className="design-list-editor">{selectedGroup.objectives.map((objective, index) => <article key={objective.id}><b>{objective.id} · ABCD 目标编辑</b><label>A 学习者<input value={objective.audience} onChange={(event) => editObjective(index, 'audience', event.target.value)} /></label><label>C 条件<input value={objective.condition} onChange={(event) => editObjective(index, 'condition', event.target.value)} /></label><label>B 可观察行为<input value={objective.behavior} onChange={(event) => editObjective(index, 'behavior', event.target.value)} /></label><label>D 达成标准<input value={objective.degree} onChange={(event) => editObjective(index, 'degree', event.target.value)} /></label><label>布鲁姆层级<select value={objective.bloomLevel} onChange={(event) => editObjective(index, 'bloomLevel', event.target.value)}><option>记忆</option><option>理解</option><option>应用</option><option>分析</option><option>评价</option><option>创造</option></select></label></article>)}</div></>
  }
  if (step.id === 'content') {
    const items = step.data.items as Array<Record<string, any>>
    const profile = step.data.learningProfile as Array<Record<string, any>>
    return <><div className="design-table content-table">{items.map((item, index) => <div className="design-row" key={item.id}><select value={item.knowledgeType} onChange={(event) => updateData({ items: items.map((current, i) => i === index ? { ...current, knowledgeType: event.target.value } : current) }, true)}><option>事实性知识</option><option>概念性知识</option><option>程序性知识</option><option>元认知知识</option></select><textarea aria-label="学习内容" value={item.content} onChange={(event) => updateData({ items: items.map((current, i) => i === index ? { ...current, content: event.target.value } : current) }, true)} /><select value={item.priority} onChange={(event) => updateData({ items: items.map((current, i) => i === index ? { ...current, priority: event.target.value } : current) }, true)}><option>重点</option><option>难点</option><option>一般</option></select><textarea aria-label="学生可能错误" value={item.studentDifficulty} onChange={(event) => updateData({ items: items.map((current, i) => i === index ? { ...current, studentDifficulty: event.target.value } : current) }, true)} /></div>)}</div><div className="design-callout"><strong>诊断任务</strong><textarea value={field(step.data.diagnosticTask)} onChange={(event) => updateData({ diagnosticTask: event.target.value }, true)} /></div><div className="design-list-editor">{profile.map((item, index) => <article key={item.dimension}><b>{item.dimension}</b><label>学情描述<textarea value={item.description} onChange={(event) => updateData({ learningProfile: profile.map((current, i) => i === index ? { ...current, description: event.target.value } : current) }, true)} /></label><label>对应教学对策<textarea value={item.strategy} onChange={(event) => updateData({ learningProfile: profile.map((current, i) => i === index ? { ...current, strategy: event.target.value } : current) }, true)} /></label></article>)}</div></>
  }
  if (step.id === 'reasoning-teaching') {
    const path = (step.data.path || {}) as Record<string, any>
    const teaching = (step.data.teaching || {}) as Record<string, any>
    const questions = (path.questions || []) as Array<Record<string, any>>
    const rows = (teaching.rows || []) as Array<Record<string, any>>
    const patchPath = (next: Record<string, unknown>) => updateData({ path: { ...path, ...next } }, true)
    const patchTeaching = (next: Record<string, unknown>) => updateData({ teaching: { ...teaching, ...next } }, true)
    return <>
      <div className="design-callout"><strong>{field(path.pathLabel)}</strong><p>{field(path.reason)}</p></div>
      <div className="design-list-editor"><h4>问题链</h4>{questions.map((item, index) => <article key={item.id}><b>{item.level}</b><textarea value={item.question} onChange={(event) => patchPath({ questions: questions.map((current, i) => i === index ? { ...current, question: event.target.value } : current) })} /><label>教师追问<input value={item.followUp} onChange={(event) => patchPath({ questions: questions.map((current, i) => i === index ? { ...current, followUp: event.target.value } : current) })} /></label><label>学生所得<input value={item.studentOutcome} onChange={(event) => patchPath({ questions: questions.map((current, i) => i === index ? { ...current, studentOutcome: event.target.value } : current) })} /></label><label>基础层版本<input value={item.basicVariant} onChange={(event) => patchPath({ questions: questions.map((current, i) => i === index ? { ...current, basicVariant: event.target.value } : current) })} /></label><label>进阶层版本<input value={item.advancedVariant} onChange={(event) => patchPath({ questions: questions.map((current, i) => i === index ? { ...current, advancedVariant: event.target.value } : current) })} /></label></article>)}</div>
      <div className="design-list-editor"><h4>教师教学行为</h4>{rows.map((item, index) => <article key={item.id}><b>{item.primaryActions.join(' + ')}</b><label>教学程序<textarea value={item.procedure} onChange={(event) => patchTeaching({ rows: rows.map((current, i) => i === index ? { ...current, procedure: event.target.value } : current) })} /></label><label>板书类型与时机<input value={`${item.board.type}｜${item.board.timing}`} onChange={(event) => { const [type, timing = ''] = event.target.value.split('｜'); patchTeaching({ rows: rows.map((current, i) => i === index ? { ...current, board: { ...current.board, type, timing } } : current) }) }} /></label><label>课堂指令<textarea value={item.organization.instruction} onChange={(event) => patchTeaching({ rows: rows.map((current, i) => i === index ? { ...current, organization: { ...current.organization, instruction: event.target.value } } : current) })} /></label><label>完成标准<textarea value={item.organization.standard} onChange={(event) => patchTeaching({ rows: rows.map((current, i) => i === index ? { ...current, organization: { ...current.organization, standard: event.target.value } } : current) })} /></label><small>组织：{item.organization.mode} · 连续讲解上限 {item.maxContinuousExplanation} 分钟</small></article>)}</div>
    </>
  }
  if (step.id === 'activities-competencies') {
    const activitiesData = (step.data.activities || {}) as Record<string, any>
    const competenciesData = (step.data.competencies || {}) as Record<string, any>
    const activities = (activitiesData.activities || []) as Array<Record<string, any>>
    const items = (competenciesData.items || []) as Array<Record<string, any>>
    const patchActivities = (next: Array<Record<string, any>>) => updateData({ activities: { ...activitiesData, activities: next } }, true)
    const patchCompetencies = (next: Array<Record<string, any>>) => updateData({ competencies: { ...competenciesData, items: next } }, true)
    return <><div className="design-list-editor"><h4>教学活动与评价</h4>{activities.map((item, index) => <article key={item.id}><div className="activity-editor-head"><b>{item.name}</b><span>{item.duration}分钟 · {item.type}</span></div><label>学生具体做什么<textarea value={item.studentAction} onChange={(event) => patchActivities(activities.map((current, i) => i === index ? { ...current, studentAction: event.target.value } : current))} /></label><label>学习什么<input value={item.learningContent} onChange={(event) => patchActivities(activities.map((current, i) => i === index ? { ...current, learningContent: event.target.value } : current))} /></label><label>可见产出<input value={item.visibleOutput} onChange={(event) => patchActivities(activities.map((current, i) => i === index ? { ...current, visibleOutput: event.target.value } : current))} /></label><label>评价标准<input value={item.evaluation.standard} onChange={(event) => patchActivities(activities.map((current, i) => i === index ? { ...current, evaluation: { ...current.evaluation, standard: event.target.value } } : current))} /></label><label>未达标补救<input value={item.remediation} onChange={(event) => patchActivities(activities.map((current, i) => i === index ? { ...current, remediation: event.target.value } : current))} /></label><small>{item.resourceMode === '3d-model' ? `3D部件：${item.modelPartKeys.join('、')}` : '未绑定模型，使用结构图或流程图'}</small></article>)}</div><div className="design-list-editor"><h4>通用能力</h4>{items.map((item, index) => <article key={item.id}><b>{item.indicator} · {item.level}</b><label>通用能力目标<textarea value={item.objective} onChange={(event) => patchCompetencies(items.map((current, i) => i === index ? { ...current, objective: event.target.value } : current))} /></label><label>融入专业活动的方式<textarea value={item.cultivation} onChange={(event) => patchCompetencies(items.map((current, i) => i === index ? { ...current, cultivation: event.target.value } : current))} /></label><label>教师观察或学生自评<textarea value={item.awarenessFeedback} onChange={(event) => patchCompetencies(items.map((current, i) => i === index ? { ...current, awarenessFeedback: event.target.value } : current))} /></label></article>)}</div></>
  }
  if (step.id === 'path') {
    const questions = step.data.questions as Array<Record<string, any>>
    return <><div className="design-callout"><strong>{field(step.data.pathLabel)}</strong><p>{field(step.data.reason)}</p></div><div className="design-list-editor">{questions.map((item, index) => <article key={item.id}><b>{item.level}</b><textarea value={item.question} onChange={(event) => updateData({ questions: questions.map((current, i) => i === index ? { ...current, question: event.target.value } : current) }, true)} /><label>教师追问<input value={item.followUp} onChange={(event) => updateData({ questions: questions.map((current, i) => i === index ? { ...current, followUp: event.target.value } : current) }, true)} /></label><label>学生所得<input value={item.studentOutcome} onChange={(event) => updateData({ questions: questions.map((current, i) => i === index ? { ...current, studentOutcome: event.target.value } : current) }, true)} /></label><label>基础层版本<input value={item.basicVariant} onChange={(event) => updateData({ questions: questions.map((current, i) => i === index ? { ...current, basicVariant: event.target.value } : current) }, true)} /></label><label>进阶层版本<input value={item.advancedVariant} onChange={(event) => updateData({ questions: questions.map((current, i) => i === index ? { ...current, advancedVariant: event.target.value } : current) }, true)} /></label></article>)}</div></>
  }
  if (step.id === 'teaching') {
    const rows = step.data.rows as Array<Record<string, any>>
    return <div className="design-list-editor">{rows.map((item, index) => <article key={item.id}><b>{item.primaryActions.join(' + ')}</b><label>教学程序<textarea value={item.procedure} onChange={(event) => updateData({ rows: rows.map((current, i) => i === index ? { ...current, procedure: event.target.value } : current) }, true)} /></label><label>板书类型与时机<input value={`${item.board.type}｜${item.board.timing}`} onChange={(event) => { const [type, timing = ''] = event.target.value.split('｜'); updateData({ rows: rows.map((current, i) => i === index ? { ...current, board: { ...current.board, type, timing } } : current) }, true) }} /></label><label>课堂指令<textarea value={item.organization.instruction} onChange={(event) => updateData({ rows: rows.map((current, i) => i === index ? { ...current, organization: { ...current.organization, instruction: event.target.value } } : current) }, true)} /></label><label>完成标准<textarea value={item.organization.standard} onChange={(event) => updateData({ rows: rows.map((current, i) => i === index ? { ...current, organization: { ...current.organization, standard: event.target.value } } : current) }, true)} /></label><small>组织：{item.organization.mode} · 连续讲解上限 {item.maxContinuousExplanation} 分钟</small></article>)}</div>
  }
  if (step.id === 'activities') {
    const activities = step.data.activities as Array<Record<string, any>>
    return <div className="design-list-editor">{activities.map((item, index) => <article key={item.id}><div className="activity-editor-head"><b>{item.name}</b><span>{item.duration}分钟 · {item.type}</span></div><label>学生具体做什么<textarea value={item.studentAction} onChange={(event) => updateData({ activities: activities.map((current, i) => i === index ? { ...current, studentAction: event.target.value } : current) }, true)} /></label><label>学习什么<input value={item.learningContent} onChange={(event) => updateData({ activities: activities.map((current, i) => i === index ? { ...current, learningContent: event.target.value } : current) }, true)} /></label><label>可见产出<input value={item.visibleOutput} onChange={(event) => updateData({ activities: activities.map((current, i) => i === index ? { ...current, visibleOutput: event.target.value } : current) }, true)} /></label><label>评价标准<input value={item.evaluation.standard} onChange={(event) => updateData({ activities: activities.map((current, i) => i === index ? { ...current, evaluation: { ...current.evaluation, standard: event.target.value } } : current) }, true)} /></label><label>未达标补救<input value={item.remediation} onChange={(event) => updateData({ activities: activities.map((current, i) => i === index ? { ...current, remediation: event.target.value } : current) }, true)} /></label><label>基础层调整<input value={item.basicAdaptation} onChange={(event) => updateData({ activities: activities.map((current, i) => i === index ? { ...current, basicAdaptation: event.target.value } : current) }, true)} /></label><label>进阶层调整<input value={item.advancedAdaptation} onChange={(event) => updateData({ activities: activities.map((current, i) => i === index ? { ...current, advancedAdaptation: event.target.value } : current) }, true)} /></label><small>{item.resourceMode === '3d-model' ? `3D部件：${item.modelPartKeys.join('、')}` : '未绑定模型，使用结构图或流程图'}</small></article>)}</div>
  }
  if (step.id === 'competencies') {
    const items = step.data.items as Array<Record<string, any>>
    return <div className="design-list-editor">{items.map((item, index) => <article key={item.id}><b>{item.indicator} · {item.level}</b><label>通用能力目标<textarea value={item.objective} onChange={(event) => updateData({ items: items.map((current, i) => i === index ? { ...current, objective: event.target.value } : current) }, true)} /></label><label>融入专业活动的方式<textarea value={item.cultivation} onChange={(event) => updateData({ items: items.map((current, i) => i === index ? { ...current, cultivation: event.target.value } : current) }, true)} /></label><label>教师观察或学生自评<textarea value={item.awarenessFeedback} onChange={(event) => updateData({ items: items.map((current, i) => i === index ? { ...current, awarenessFeedback: event.target.value } : current) }, true)} /></label></article>)}</div>
  }
  const matrix = workflow.alignmentMatrix
  return <div className="final-design-summary"><div className="design-callout"><strong>最终结构</strong>{(step.data.structure as string[]).map((item) => <p key={item}>{item}</p>)}</div><div className="alignment-matrix"><strong>目标对齐矩阵</strong>{matrix.map((row) => <div key={row.objectiveId}><b>{row.objectiveId}</b><span>{row.contentIds.length}项内容</span><span>{row.activityIds.length}个活动</span><span>{row.evidenceIds.length}项评价证据</span><span>{row.modelPartKeys.length ? `${row.modelPartKeys.length}个模型部件` : '结构图任务'}</span></div>)}</div></div>
}
