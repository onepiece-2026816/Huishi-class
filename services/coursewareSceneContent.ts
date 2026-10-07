import type { CoursewareScene } from '../types/courseware'

export type CoursewareContentBlock = {
  key: string
  label: string
  value: string
}

const asText = (value: unknown) => Array.isArray(value)
  ? value.filter(Boolean).map(String).join('；')
  : String(value || '').trim()

export function getCoursewareContentBlocks(scene: CoursewareScene): CoursewareContentBlock[] {
  const detail = scene.detail || {}
  const candidates: CoursewareContentBlock[] = [
    { key: 'learningContent', label: '学习内容', value: asText(detail.learningContent) || scene.claim },
    { key: 'studentSteps', label: '学习步骤', value: asText(detail.studentSteps) || scene.studentAction },
    { key: 'questioning', label: '教师追问', value: asText(detail.questioning) || scene.teacherCue },
    { key: 'visibleOutput', label: '预期产出', value: detail.visibleOutput || scene.expectedOutput },
    { key: 'evaluationRubric', label: '评价标准', value: asText(detail.evaluationRubric) || scene.expectedOutput },
    { key: 'remediation', label: '补救措施', value: detail.remediation || '' },
  ]
  const preferredByType: Record<string, string[]> = {
    'question-chain': ['learningContent', 'studentSteps', 'questioning', 'evaluationRubric'],
    activity: ['learningContent', 'studentSteps', 'visibleOutput', 'evaluationRubric'],
    assessment: ['evaluationRubric', 'questioning', 'remediation', 'visibleOutput'],
    homework: ['learningContent', 'studentSteps', 'visibleOutput', 'evaluationRubric'],
    'case-evidence': ['learningContent', 'studentSteps', 'questioning', 'evaluationRubric'],
  }
  const order = preferredByType[scene.type] || ['learningContent', 'studentSteps', 'visibleOutput', 'evaluationRubric']
  const byKey = new Map(candidates.map((block) => [block.key, block]))
  const ordered = order.map((key) => byKey.get(key)).filter((block): block is CoursewareContentBlock => Boolean(block?.value))
  const fallback = candidates.filter((block) => block.value && !ordered.some((item) => item.key === block.key))
  return [...ordered, ...fallback].slice(0, 4)
}
