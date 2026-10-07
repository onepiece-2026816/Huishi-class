import type { LessonDesignWorkflow } from '../types/lessonDesign'

export type ExportLesson = {
  title: string
  overview?: string
  request: object
  designWorkflow?: LessonDesignWorkflow
}
export type LessonExportSection = { title: string; lines: string[] }
export type TeacherLessonDraft = {
  title: string
  courseName: string
  duration: number
  overview: string
  objectives: string[]
  keyPoints: string[]
  difficulties: string[]
  teacherPreparation: string[]
  studentPreparation: string[]
  process: Array<{ name: string; minutes: number; teacherActivity: string; studentActivity: string; question: string; check: string }>
  homework: string[]
  blackboardDesign: string[]
  references: string[]
}

const textLines = (value: unknown): string[] => {
  if (Array.isArray(value)) return value.flatMap(textLines)
  return typeof value === 'string' ? value.split(/\r?\n/).map(item => item.trim()).filter(Boolean) : []
}
const firstLines = (...values: unknown[]) => values.map(textLines).find(items => items.length) || []
const text = (...values: unknown[]) => firstLines(...values).join('；')

// The saved design already contains the classroom narrative; exporting does not need another AI request.
export function buildTeacherLessonDraft(plan: ExportLesson): TeacherLessonDraft {
  const data = plan as ExportLesson & Record<string, any>
  const request = plan.request as Record<string, any>
  const workflow = plan.designWorkflow
  const final = data.finalLesson || {}
  const stepData = (id: string, combined?: string) => workflow?.steps.find(step => step.id === id)?.data
    || (combined ? workflow?.steps.find(step => step.id === combined)?.data[id] : undefined) || {}
  const activityData = stepData('activities', 'activities-competencies')
  const content = stepData('content')
  const path = stepData('path', 'reasoning-teaching')
  const teaching = stepData('teaching', 'reasoning-teaching')
  const activities: Record<string, any>[] = activityData.activities || data.activities || []
  const questions: Record<string, any>[] = path.questions || data.questionChain || []
  const phases: Record<string, any>[] = workflow?.phases?.length ? workflow.phases : final.sequence?.length ? final.sequence : data.phases || []
  const preparation = firstLines(final.learningPreparation, data.learningPreparation)
  const homework = final.homeworkDetail || activityData.homework || {}
  const process = phases.map(phase => {
    const activity = activities.find(item => (item.id && phase.id === `phase-${item.id}`) || item.name === phase.name)
    const linkedQuestions = activity ? questions.filter(item => activity.questionIds?.includes(item.id)) : []
    return {
      name: text(phase.name),
      minutes: Number(phase.time ?? phase.minutes ?? phase.duration ?? 0),
      teacherActivity: text(phase.teacher, phase.teacherActivity, activity?.teacherProcess, activity?.teacherRole),
      studentActivity: text(phase.student, phase.studentActivity, activity?.studentAction, activity?.studentSteps),
      question: text(phase.question, activity?.questioning, activity?.teacherPrompts, linkedQuestions.map(item => item.question)),
      check: text(phase.check, activity?.evaluation?.standard, activity?.evaluationStandard, activity?.visibleOutput),
    }
  })
  const referenceItems: unknown[] = final.references || data.references || []
  return {
    title: plan.title,
    courseName: text(request.courseName, request.subject),
    duration: Number(workflow?.duration || request.duration || process.reduce((sum, phase) => sum + phase.minutes, 0)),
    overview: text(plan.overview, stepData('objectives').coursePosition),
    objectives: firstLines(workflow?.selectedObjectives?.map(item => item.text || item.behavior), final.professionalOutcomes, data.objectives),
    keyPoints: firstLines(final.keyPoints, data.keyPoints, (content.items || []).filter((item: Record<string, any>) => item.priority === '重点').map((item: Record<string, any>) => item.content)),
    difficulties: firstLines(final.difficulties, data.difficulties, (content.items || []).filter((item: Record<string, any>) => item.priority === '难点').map((item: Record<string, any>) => item.content)),
    teacherPreparation: firstLines(final.teacherPreparation, preparation.filter(item => !/^学生\s*[：:]/.test(item)).map(item => item.replace(/^教师\s*[：:]\s*/, '')), data.resources, request.resources),
    studentPreparation: firstLines(final.studentPreparation, preparation.filter(item => /^学生\s*[：:]/.test(item)).map(item => item.replace(/^学生\s*[：:]\s*/, '')), data.prerequisites, request.prerequisites, request.priorKnowledge),
    process,
    homework: [
      ...firstLines(homework.design, homework.task, typeof final.homeworkDetail === 'string' ? final.homeworkDetail : undefined, data.homework, request.homework),
      ...textLines(homework.submission).map(item => `提交要求：${item}`),
      ...textLines(homework.criteria).map(item => `评价标准：${item}`),
    ],
    blackboardDesign: firstLines(final.blackboardDesign, data.boardDesign, data.blackboard, (teaching.rows || []).map((item: Record<string, any>) => item.board?.content)),
    references: referenceItems.flatMap(item => {
      if (typeof item === 'string') return textLines(item)
      if (!item || typeof item !== 'object') return []
      const reference = item as Record<string, unknown>
      if (!reference.title) return []
      return [[reference.title, reference.author, reference.year].filter(Boolean).join('，') + (reference.sourceUrl ? `（${reference.sourceUrl}）` : '')]
    }),
  }
}

export function validateTeacherLessonDraft(draft: TeacherLessonDraft) {
  const blocking: string[] = []
  if (!draft.title.trim()) blocking.push('请填写教案标题')
  if (!draft.objectives.length || draft.objectives.some(item => !item.trim())) blocking.push('请补全所有教学目标')
  if (!draft.process.length || draft.process.some(item => !item.name.trim() || !item.teacherActivity.trim() || !item.studentActivity.trim())) blocking.push('请补全教学环节、教师活动和学生活动')
  if (!Number.isFinite(draft.duration) || draft.duration <= 0 || draft.process.some(item => !Number.isFinite(item.minutes) || item.minutes < 0)) blocking.push('请填写有效的教学时长')
  else if (draft.process.reduce((sum, item) => sum + item.minutes, 0) !== draft.duration) blocking.push('教学流程时间合计必须与本课时长一致')
  return { valid: blocking.length === 0, blocking }
}

const labels: Record<string, string> = {
  basic: '基础层作业', advanced: '进阶层作业', criteria: '评价标准', modelAvailable: '模型可用', sourceActivityId: '来源活动',
  impactOnTeaching: '对教学的影响', diagnosticEvidence: '诊断证据', likelyMisconceptions: '常见误区', scopeDecision: '内容范围', focus: '教学聚焦', defer: '暂缓内容', pathLabel: '推理路径', reason: '选择理由', abilityLevel: '能力层次', studentOutcome: '学生成果', basicVariant: '基础层问题', advancedVariant: '进阶层问题', questionId: '对应问题', questionIds: '对应问题', slideIds: '配套课件', warmupQuestionIds: '配套练习', whyWorthLearning: '学习价值', teachingFocus: '教学聚焦', breakthroughMethod: '突破方法', assessmentEvidence: '评价证据', submission: '提交要求', assessment: '评价标准', alignment: '目标对齐', learningValue: '学习价值', integration: '融入方式', feedback: '反馈',
  id: '编号', text: '目标表述', audience: '学习者', condition: '学习条件', behavior: '可观察行为', degree: '达成标准', bloomLevel: '布鲁姆层级',
  coursePosition: '课程定位', items: '内容', content: '学习内容', knowledgeType: '知识类型', proceduralSubtype: '程序性知识类型', worthLearning: '学习价值', priority: '重点难点', studentDifficulty: '学生可能错误', breakthrough: '突破方法', objectiveIds: '对应目标',
  learningProfile: '学情分析', dimension: '维度', description: '描述', strategy: '教学对策', diagnosticTask: '诊断任务',
  path: '推理路径', pathType: '路径类型', rationale: '设计依据', questions: '问题链', question: '问题', followUp: '追问', studentGain: '学习收获', level: '层级', contentIds: '对应内容',
  teaching: '教师教学设计', rows: '教学程序', primaryActions: '教学行为', procedure: '教学程序', board: '板书', type: '类型', timing: '时机', organization: '课堂组织', mode: '组织形式', instruction: '课堂指令', duration: '时长（分钟）', standard: '完成标准', maxContinuousExplanation: '连续讲解上限（分钟）', lectureLimit: '讲解时长要求',
  activities: '学习活动', competencies: '通用能力', name: '名称', studentAction: '学生行动', learningContent: '学习内容', visibleOutput: '可见产出', evaluation: '评价', method: '评价方式', evidence: '评价证据', remediation: '未达标补救', teacherRole: '教师角色', basicAdaptation: '基础层调整', advancedAdaptation: '进阶层调整', resourceMode: '资源形式', modelPartKeys: '模型部件',
  teacherProcess: '教师过程', studentSteps: '学生操作步骤', questioning: '关键追问', organizationDetail: '组织安排', designRationale: '设计依据', teacherPrompts: '教师追问', studentOutput: '学生产出', remediationPlan: '补救方案', teacherScript: '教师话术', materials: '学习材料', checkpoints: '检查节点', time: '时间', teacherCheck: '教师检查', studentEvidence: '学生证据', evaluationRubric: '评价量规', criterion: '评价维度', fullMark: '达标表现', support: '支持要求', commonErrors: '常见错误',
  intro: '课堂导入', hookType: '导入类型', selectionReason: '选择理由', inclusiveness: '核心问题覆盖', advance: '先行组织', nonArbitrary: '已有知识联系', script: '导入话术', studentPrediction: '学生初始判断', summary: '课堂总结', design: '设计', homework: '课后作业', task: '任务', requirements: '要求',
  indicator: '能力指标', objective: '能力目标', cultivation: '培养方式', awarenessFeedback: '观察与反馈', activityIds: '对应活动', evidenceIds: '评价证据', objectiveId: '目标编号',
  structure: '教案结构', professionalOutcomes: '专业能力目标', generalOutcomes: '通用能力目标', keyPoints: '教学重点', difficulties: '教学难点', breakthroughMethods: '突破方法', learningPreparation: '学习准备', blackboardDesign: '板书设计', differentiation: '能力分层', references: '参考资料', homeworkDetail: '作业详情',
  title: '标题', author: '作者', year: '年份', sourceType: '来源类型', sourceUrl: '来源链接', license: '使用许可', usedIn: '使用环节', teacher: '教师活动', student: '学生活动', check: '评价检查',
}
const hidden = new Set(['candidateGroups', 'selectedGroupId', 'hookOptions', 'systemData', 'generationBasis'])

// Read only teaching content; engine metadata and unselected objective candidates are excluded.
export function contentLines(value: unknown, prefix = ''): string[] {
  if (value == null || value === '') return []
  if (Array.isArray(value)) return value.flatMap((item, index) => contentLines(item, typeof item === 'object' ? `${prefix}${index + 1}` : prefix))
  if (typeof value === 'object') {
    const lines = Object.entries(value).flatMap(([key, item]) => hidden.has(key) ? [] : contentLines(item, `${labels[key] || key}：`))
    return lines.length && prefix ? [prefix.replace(/：$/, ''), ...lines] : lines
  }
  const display = typeof value === 'boolean' ? (value ? '是' : '否') : String(value)
  return display.split(/\r?\n/).filter(Boolean).map(line => `${prefix}${line}`)
}

export function lessonExportSections(plan: ExportLesson): LessonExportSection[] {
  const data = plan as ExportLesson & Record<string, any>
  const workflow = plan.designWorkflow
  const sections: LessonExportSection[] = []
  const add = (title: string, value: unknown) => { const lines = contentLines(value); if (lines.length) sections.push({ title, lines }) }
  const request = plan.request as Record<string, unknown>
  add('课程信息', [request.courseName || request.subject, request.stage, request.grade || request.semester, `${workflow?.duration || request.duration || ''} 分钟`, workflow?.abilityLevel, plan.overview].filter(Boolean))
  if (workflow) {
    for (const step of workflow.steps) {
      if (step.id === 'objectives') add(`${step.number} ${step.title}`, { coursePosition: step.data.coursePosition, professionalOutcomes: workflow.selectedObjectives })
      else if (step.id === 'final') {
        const final = data.finalLesson || {}
        add(`${step.number} ${step.title}`, {
          learningPreparation: final.learningPreparation || data.prerequisites,
          keyPoints: final.keyPoints || data.keyPoints,
          difficulties: final.difficulties || data.difficulties,
          breakthroughMethods: final.breakthroughMethods,
          blackboardDesign: final.blackboardDesign || data.boardDesign || data.blackboard,
          differentiation: final.differentiation || data.abilityDifferentiation,
          homeworkDetail: final.homeworkDetail || data.homework,
        })
      } else add(`${step.number} ${step.title}`, step.data)
    }
    add('教学进程', workflow.phases)
    add('目标对齐矩阵', workflow.alignmentMatrix)
  } else {
    for (const [title, value] of Object.entries({ '教学目标': data.objectives, '学情分析': data.situation, '教学重点': data.keyPoints, '教学难点': data.difficulties, '教学方法': data.methods, '教学资源': data.resources, '教学进程': data.phases, '教学评价': data.assessment, '板书设计': data.blackboard, '课后作业': data.homework })) add(title, value)
  }
  add('参考资料', data.finalLesson?.references || data.references)
  return sections
}

export function canExportLesson(plan: ExportLesson) {
  const w = plan.designWorkflow
  return !w || (w.status === 'approved' && !w.qualityPending && !w.quality?.blocking?.length && !w.staleSteps.length && w.steps.every(step => step.approved && step.status !== 'stale'))
}

export async function buildLessonWord(plan: ExportLesson): Promise<Blob> {
  if (!canExportLesson(plan)) throw new Error('请先重新校验并确认整套教案')
  const { Document, Packer, Paragraph, TextRun, Header, Footer, AlignmentType, HeadingLevel, PageNumber } = await import('docx')
  const paragraph = (text: string) => new Paragraph({ children: [new TextRun(text)], spacing: { after: 100, line: 360 } })
  const document = new Document({
    creator: '数智课堂', title: plan.title, description: '数智课堂教学设计',
    styles: { default: { document: { run: { font: { ascii: 'Times New Roman', eastAsia: '宋体', hAnsi: 'Times New Roman' }, size: 24, color: '000000' } } }, paragraphStyles: [
      { id: 'Title', name: 'Title', basedOn: 'Normal', run: { font: '黑体', size: 36, bold: true }, paragraph: { alignment: AlignmentType.CENTER, spacing: { after: 320 }, keepNext: true } },
      { id: 'Heading1', name: 'Heading 1', basedOn: 'Normal', run: { font: '黑体', size: 28, bold: true }, paragraph: { spacing: { before: 280, after: 160 }, keepNext: true } },
    ] },
    sections: [{
      properties: { page: { size: { width: 11906, height: 16838 }, margin: { top: 1440, bottom: 1440, left: 1440, right: 1440 } } },
      headers: { default: new Header({ children: [new Paragraph({ text: '数智课堂 · 教学设计', alignment: AlignmentType.RIGHT })] }) },
      footers: { default: new Footer({ children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ children: ['第 ', PageNumber.CURRENT, ' 页'] })] })] }) },
      children: [new Paragraph({ text: `${plan.title} 教案`, heading: HeadingLevel.TITLE }), ...lessonExportSections(plan).flatMap(section => [new Paragraph({ text: section.title, heading: HeadingLevel.HEADING_1 }), ...section.lines.map(paragraph)])],
    }],
  })
  return Packer.toBlob(document)
}

export async function buildTeacherLessonWord(draft: TeacherLessonDraft): Promise<Blob> {
  const review = validateTeacherLessonDraft(draft)
  if (!review.valid) throw new Error(review.blocking[0])
  const {
    Document, Packer, Paragraph, TextRun, Header, Footer, Table, TableRow, TableCell,
    AlignmentType, HeadingLevel, PageNumber, WidthType, BorderStyle, VerticalAlign,
  } = await import('docx')
  const font = { ascii: 'Times New Roman', eastAsia: '宋体', hAnsi: 'Times New Roman' }
  const body = (text: string) => new Paragraph({ children: [new TextRun({ text, font })], spacing: { after: 100, line: 360 } })
  const heading = (text: string) => new Paragraph({ text, heading: HeadingLevel.HEADING_1, keepNext: true })
  const bullet = (items: string[]) => items.map(item => new Paragraph({
    children: [new TextRun({ text: item, font })],
    bullet: { level: 0 },
    spacing: { after: 90, line: 340 },
  }))
  const borders = {
    top: { style: BorderStyle.SINGLE, size: 4, color: 'D4DEE4' },
    bottom: { style: BorderStyle.SINGLE, size: 4, color: 'D4DEE4' },
    left: { style: BorderStyle.SINGLE, size: 4, color: 'D4DEE4' },
    right: { style: BorderStyle.SINGLE, size: 4, color: 'D4DEE4' },
    insideHorizontal: { style: BorderStyle.SINGLE, size: 4, color: 'D4DEE4' },
    insideVertical: { style: BorderStyle.SINGLE, size: 4, color: 'D4DEE4' },
  }
  const cell = (text: string, width: number, header = false) => new TableCell({
    width: { size: width, type: WidthType.DXA },
    margins: { top: 100, bottom: 100, left: 110, right: 110 },
    verticalAlign: VerticalAlign.CENTER,
    ...(header ? { shading: { fill: 'EAF1F4' } } : {}),
    children: [new Paragraph({ children: [new TextRun({ text, font, bold: header, size: 20 })], spacing: { after: 0, line: 300 } })],
  })
  const processRows = [
    new TableRow({ tableHeader: true, children: [cell('教学环节与时间', 1550, true), cell('教师活动', 3650, true), cell('学生活动', 3100, true), cell('提问与检查', 1650, true)] }),
    ...draft.process.map(item => new TableRow({ children: [
      cell(`${item.name}\n${item.minutes}分钟`, 1550),
      cell(item.teacherActivity, 3650),
      cell(item.studentActivity, 3100),
      cell([item.question && `提问：${item.question}`, item.check && `检查：${item.check}`].filter(Boolean).join('\n'), 1650),
    ] })),
  ]
  const document = new Document({
    creator: '数智课堂', title: draft.title, description: '教师版课堂教案',
    styles: { default: { document: { run: { font, size: 24, color: '171717' } } }, paragraphStyles: [
      { id: 'Title', name: 'Title', basedOn: 'Normal', run: { font: '黑体', size: 34, bold: true }, paragraph: { alignment: AlignmentType.CENTER, spacing: { after: 180 }, keepNext: true } },
      { id: 'Heading1', name: 'Heading 1', basedOn: 'Normal', run: { font: '黑体', size: 26, bold: true }, paragraph: { spacing: { before: 280, after: 140 }, keepNext: true } },
    ] },
    sections: [{
      properties: { page: { size: { width: 11906, height: 16838 }, margin: { top: 1275, bottom: 1275, left: 1134, right: 1134 } } },
      headers: { default: new Header({ children: [new Paragraph({ text: draft.courseName, alignment: AlignmentType.RIGHT })] }) },
      footers: { default: new Footer({ children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ children: ['第 ', PageNumber.CURRENT, ' 页'], font })] })] }) },
      children: [
        new Paragraph({ text: draft.title, heading: HeadingLevel.TITLE }),
        new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: `${draft.courseName}    本课时长：${draft.duration}分钟`, font, size: 21, color: '52636C' })], spacing: { after: 260 } }),
        ...(draft.overview ? [body(draft.overview)] : []),
        heading('教学目标'), ...bullet(draft.objectives),
        ...(draft.keyPoints.length ? [heading('教学重点'), ...bullet(draft.keyPoints)] : []),
        ...(draft.difficulties.length ? [heading('教学难点'), ...bullet(draft.difficulties)] : []),
        ...(draft.teacherPreparation.length || draft.studentPreparation.length ? [heading('课前准备')] : []),
        ...(draft.teacherPreparation.length ? [body(`教师：${draft.teacherPreparation.join('；')}`)] : []),
        ...(draft.studentPreparation.length ? [body(`学生：${draft.studentPreparation.join('；')}`)] : []),
        heading('教学过程'),
        new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, columnWidths: [1550, 3650, 3100, 1650], rows: processRows, borders }),
        ...(draft.homework.length ? [heading('课后作业'), ...bullet(draft.homework)] : []),
        ...(draft.blackboardDesign.length ? [heading('板书设计'), ...bullet(draft.blackboardDesign)] : []),
        ...(draft.references.length ? [heading('参考资料'), ...bullet(draft.references)] : []),
      ],
    }],
  })
  return Packer.toBlob(document)
}

export function lessonWordFilename(title: string) {
  return `${title.replace(/[<>:"/\\|?*\u0000-\u001f]/g, '_').trim().slice(0, 100) || '数智课堂'}_教案.docx`
}
