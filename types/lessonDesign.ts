export type DesignSource = 'generated' | 'teacher-edited'
export type DesignStepStatus = 'ready' | 'stale'

export type QualityIssue = { code: string; message: string }
export type DesignQuality = { blocking: QualityIssue[]; warnings: QualityIssue[]; score: number; valid: boolean }

export type ObjectiveItem = {
  id: string
  audience: string
  condition: string
  behavior: string
  degree: string
  bloomLevel: string
  text: string
}

export type ObjectiveGroup = {
  id: string
  name: string
  classroomDirection: string
  levelFit: string
  objectives: ObjectiveItem[]
}

export type DesignStep = {
  id: 'objectives' | 'content' | 'path' | 'teaching' | 'activities' | 'competencies' | 'reasoning-teaching' | 'activities-competencies' | 'final'
  number: number
  title: string
  status: DesignStepStatus
  approved: boolean
  source: DesignSource
  data: Record<string, any>
  systemData?: Record<string, any>
}

export type LessonDesignWorkflow = {
  version: 2
  standard: string
  mode: 'quick' | 'guided'
  status: 'review' | 'approved'
  currentStep: number
  duration: 40 | 80 | 120
  abilityLevel: '基础层' | '进阶层'
  selectedObjectiveGroupId: string
  selectedObjectives: ObjectiveItem[]
  steps: DesignStep[]
  phases: Array<Record<string, any>>
  staleSteps: string[]
  alignmentMatrix: Array<Record<string, any>>
  generation: { engine: 'responses' | 'ollama' | 'builtin-template'; model?: string; message?: string; groundedSourceIds?: string[] }
  quality: DesignQuality
  qualityPending?: boolean
  modelContext?: { available: boolean; partKeys: string[] }
}
