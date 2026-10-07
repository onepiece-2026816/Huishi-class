import assert from 'node:assert/strict'
import test from 'node:test'
import JSZip from 'jszip'
import { buildLessonWord, buildTeacherLessonDraft, buildTeacherLessonWord, canExportLesson, lessonExportSections, lessonWordFilename, validateTeacherLessonDraft } from './lessonWordExport.ts'
import type { LessonDesignWorkflow } from '../types/lessonDesign.ts'

const fixture = () => ({
  title: '心脏结构与功能', request: { stage: '本科', duration: '40', courseName: '解剖学' },
  designWorkflow: {
    version: 2, status: 'approved', duration: 40, abilityLevel: '基础层', qualityPending: false,
    quality: { blocking: [], warnings: [], score: 100, valid: true }, staleSteps: [],
    selectedObjectives: [{ id: 'obj-1', text: '教师修改后的目标：判断血流方向' }],
    steps: [
      { id: 'objectives', number: 1, title: '教学目标', approved: true, status: 'ready', data: { candidateGroups: [{ text: '未选择的候选目标' }] } },
      { id: 'activities-competencies', number: 4, title: '活动与能力', approved: true, status: 'ready', data: { activities: { activities: [{ name: '观察任务', studentAction: '标注瓣膜', evaluation: { standard: '方向全部正确' }, remediation: '使用箭头卡重做', teacherScript: ['请解释依据'] }] } } },
    ], phases: [{ name: '课堂导入', time: 5 }], alignmentMatrix: [{ objectiveId: 'obj-1', activityIds: ['activity-1'] }],
  } as unknown as LessonDesignWorkflow,
})

test('exports confirmed content including activity details without candidate objectives', async () => {
  const plan = fixture()
  const text = lessonExportSections(plan).flatMap(s => s.lines).join('\n')
  assert.match(text, /教师修改后的目标/)
  assert.match(text, /方向全部正确/)
  assert.match(text, /使用箭头卡重做/)
  assert.doesNotMatch(text, /未选择的候选目标/)
  const blob = await buildLessonWord(plan)
  const zip = await JSZip.loadAsync(await blob.arrayBuffer())
  const xml = await zip.file('word/document.xml')!.async('string')
  assert.match(xml, /心脏结构与功能/)
  assert.match(xml, /请解释依据/)
  assert.match(xml, /w:w="11906"/)
  assert.match(await zip.file('word/styles.xml')!.async('string'), /宋体/)
  assert.match(await zip.file('word/footer1.xml')!.async('string'), /PAGE/)
})

test('blocks export after edits, stale content, failed quality or missing approval', async () => {
  for (const patch of [{ status: 'review' }, { qualityPending: true }, { staleSteps: ['content'] }, { quality: { blocking: [{ message: '缺少目标' }] } }, { steps: [{ approved: false, status: 'ready' }] }]) {
    const plan = fixture()
    Object.assign(plan.designWorkflow, patch)
    assert.equal(canExportLesson(plan), false)
    await assert.rejects(buildLessonWord(plan), /确认整套教案/)
  }
})

test('supports legacy lessons and safe Word filenames', () => {
  const sections = lessonExportSections({ title: '旧教案', request: {}, objectives: ['理解概念'], homework: '完成练习' } as any)
  assert.ok(sections.some(s => s.title === '课后作业' && s.lines.includes('完成练习')))
  assert.equal(lessonWordFilename('心脏/结构:*?'), '心脏_结构____教案.docx')
})

const teacherFixture = () => {
  const plan = {
    ...fixture(),
    overview: '通过观察心脏结构，判断血流方向并说明依据。',
    finalLesson: {
      keyPoints: ['血流方向'], difficulties: ['辨别瓣膜开闭条件'],
      learningPreparation: ['教师：结构图、任务单。', '学生：回顾心腔名称。'],
      homeworkDetail: { design: '绘制血流图', submission: '结构图和文字说明', criteria: '方向完整' },
      blackboardDesign: ['心房 → 心室 → 动脉'],
      references: [{ title: '心脏解剖', author: '教材编写组', year: '2026', sourceUrl: 'https://example.com/heart' }],
    },
  }
  const activityStep = plan.designWorkflow.steps.find(step => step.id === 'activities-competencies')!
  activityStep.data.activities.activities[0].id = 'activity-1'
  activityStep.data.activities.activities[0].questioning = ['怎样判断瓣膜允许血液通过的方向？']
  plan.designWorkflow.phases = [
    { id: 'phase-intro', name: '导入', time: 5, teacher: '展示血流图并收集判断。', student: '独立写出初始判断。', check: '记录判断依据。' },
    { id: 'phase-activity-1', name: '观察任务', time: 30, teacher: '请解释依据，逐组检查标注。', student: '标注瓣膜并比较血流方向。', check: '方向全部正确，错误时使用箭头卡重做。' },
    { id: 'phase-summary', name: '总结', time: 5, teacher: '核对血流图。', student: '修订初始判断。', check: '提交正确的血流图。' },
  ]
  return plan
}

test('builds a teacher draft immediately from saved teaching content and preserves timing', () => {
  const plan = teacherFixture()
  const draft = buildTeacherLessonDraft(plan)
  assert.equal(validateTeacherLessonDraft(draft).valid, true)
  assert.deepEqual(draft.objectives, ['教师修改后的目标：判断血流方向'])
  assert.deepEqual(draft.teacherPreparation, ['结构图、任务单。'])
  assert.deepEqual(draft.studentPreparation, ['回顾心腔名称。'])
  assert.deepEqual(draft.process.map(item => [item.name, item.minutes]), [['导入', 5], ['观察任务', 30], ['总结', 5]])
  assert.equal(draft.process[1].teacherActivity, '请解释依据，逐组检查标注。')
  assert.equal(draft.process[1].question, '怎样判断瓣膜允许血液通过的方向？')
  assert.match(draft.process[1].check, /箭头卡重做/)
  assert.deepEqual(draft.homework, ['绘制血流图', '提交要求：结构图和文字说明', '评价标准：方向完整'])
  assert.match(draft.references[0], /心脏解剖，教材编写组，2026（https:\/\/example.com\/heart）/)
  assert.doesNotMatch(JSON.stringify(draft), /candidateGroups|obj-1|activity-1|未选择的候选目标|qualityPending/)
})

test('exports the local teacher draft as Word without any remote service or additional approval', async () => {
  const draft = buildTeacherLessonDraft(teacherFixture())
  const blob = await buildTeacherLessonWord(draft)
  const zip = await JSZip.loadAsync(await blob.arrayBuffer())
  const xml = await zip.file('word/document.xml')!.async('string')
  assert.match(xml, /请解释依据，逐组检查标注/)
  assert.match(xml, /怎样判断瓣膜允许血液通过的方向/)
  assert.match(xml, /结构图和文字说明/)
  assert.match(xml, /30分钟/)
  assert.doesNotMatch(xml, /确认审核|AI 初审|candidateGroups|obj-1/)
})

test('keeps export validation limited to essential content and valid lesson timing', async () => {
  const draft = buildTeacherLessonDraft(teacherFixture())
  Object.assign(draft, { overview: '', teacherPreparation: [], studentPreparation: [], keyPoints: [], difficulties: [], homework: [], blackboardDesign: [] })
  assert.equal(validateTeacherLessonDraft(draft).valid, true)
  const zip = await JSZip.loadAsync(await (await buildTeacherLessonWord(draft)).arrayBuffer())
  assert.doesNotMatch(await zip.file('word/document.xml')!.async('string'), /课前准备|课后作业|板书设计/)
  for (const patch of [
    { title: '' }, { objectives: [] }, { process: [] }, { duration: Number.NaN },
    { process: [{ ...draft.process[0], minutes: -1 }] },
    { process: [{ ...draft.process[0], teacherActivity: '' }] },
    { duration: 80 },
  ]) {
    const invalid = { ...draft, ...patch }
    assert.equal(validateTeacherLessonDraft(invalid).valid, false)
    await assert.rejects(buildTeacherLessonWord(invalid))
  }
})

test('supports separate workflow steps and excludes internal fields from classroom content', () => {
  const plan = teacherFixture()
  delete (plan as any).finalLesson
  plan.designWorkflow.steps = [
    ...plan.designWorkflow.steps.filter(step => step.id !== 'activities-competencies'),
    { id: 'content', data: { items: [{ priority: '重点', content: '定位心腔', id: 'content-secret' }, { priority: '难点', content: '瓣膜开闭条件' }] } },
    { id: 'activities', data: { activities: [{ id: 'activity-1', questionIds: ['question-1'] }], homework: { design: '复述血流方向', criteria: '无方向错误' } } },
    { id: 'path', data: { questions: [{ id: 'question-1', question: '血流方向如何确定？' }] } },
    { id: 'teaching', data: { rows: [{ board: { content: '心房与心室' } }] } },
  ] as any
  const draft = buildTeacherLessonDraft(plan)
  assert.deepEqual(draft.keyPoints, ['定位心腔'])
  assert.deepEqual(draft.difficulties, ['瓣膜开闭条件'])
  assert.deepEqual(draft.blackboardDesign, ['心房与心室'])
  assert.equal(draft.process[1].question, '血流方向如何确定？')
  assert.deepEqual(draft.homework, ['复述血流方向', '评价标准：无方向错误'])
  assert.doesNotMatch(JSON.stringify(draft), /content-secret|question-1/)
})
