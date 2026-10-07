import type { WarmupQuestion } from '../services/quizData';
import type { ModelType } from '../types';

export interface ClassroomModelAsset {
  source: 'imported' | 'generated';
  localModelId?: string;
  modelUrl: string;
  modelType: ModelType;
  assetUrls?: Record<string, string>;
  fileName?: string;
  previewImageUrl?: string;
}

export type CoursewareSceneType =
  | 'hook'
  | 'outcomes'
  | 'model-overview'
  | 'chambers'
  | 'vessels'
  | 'valves'
  | 'blood-flow'
  | 'comparison'
  | 'case-evidence'
  | 'model-challenge'
  | 'gesture-quiz'
  | 'summary'
  | 'content-map'
  | 'question-chain'
  | 'activity'
  | 'assessment'
  | 'homework';

export type CoursewareLayout =
  | 'cinematic-question'
  | 'outcome-rail'
  | 'model-stage'
  | 'anatomy-focus'
  | 'flow-path'
  | 'compare-split'
  | 'evidence-board'
  | 'quiz-stage'
  | 'closing-loop'
  | 'three-column'
  | 'question-split'
  | 'step-flow'
  | 'observation-stage'
  | 'compare-duo'
  | 'task-timer'
  | 'answer-rail';

export type CoursewareMotion = 'fade' | 'rise' | 'focus' | 'flow' | 'explode' | 'reveal';
export type CoursewareSource = 'generated' | 'teacher-edited';

export interface CoursewareAsset {
  id: string;
  type: 'model' | 'image' | 'audio' | 'reference';
  url: string;
  altText: string;
  sourceType: string;
  license: string;
}

export interface ModelTeachingConfig {
  modelKey: string;
  modelUrl: string;
  modelType?: ModelType;
  source?: 'imported' | 'generated';
  localModelId?: string;
  assetUrls?: Record<string, string>;
  previewImageUrl?: string;
  viewModelFingerprint?: string;
  viewRenderVersion?: string;
  viewImageSource?: string;
  viewImageUrls?: {
    front?: string;
    left?: string;
    right?: string;
    back?: string;
  };
  parts: Array<{
    partKey: string;
    partLabel: string;
    labelEn: string;
    group: string;
  }>;
  defaultMode: 'appearance' | 'anatomy' | 'overlay' | 'cutaway';
  observationTasks: string[];
}

export interface CoursewareScene {
  id: string;
  type: CoursewareSceneType;
  title: string;
  claim: string;
  teacherCue: string;
  studentAction: string;
  expectedOutput: string;
  detail?: {
    learningContent?: string;
    teacherScript?: string[];
    studentSteps?: string[];
    questioning?: string[];
    materials?: string[];
    evaluationRubric?: string[];
    remediation?: string;
    commonErrors?: string[];
    visibleOutput?: string;
  };
  layout: CoursewareLayout;
  motion: {
    preset: CoursewareMotion;
    durationMs: number;
    trigger: 'enter' | 'click' | 'step';
  };
  pptAnimation: 'fade' | 'appear' | 'wipe';
  model?: {
    partKeys: string[];
    camera: 'front' | 'left' | 'right' | 'posterior' | 'free';
    mode: 'appearance' | 'anatomy' | 'overlay' | 'cutaway';
    exploded: boolean;
    explosionStrength: number;
  };
  source: CoursewareSource;
  enabled: boolean;
}

export interface CoursewareManifest {
  version: 1;
  lessonId: string;
  title: string;
  theme: 'biomed-dark';
  revision: number;
  status: 'draft' | 'ready';
  scenes: CoursewareScene[];
  model: ModelTeachingConfig;
  questions: WarmupQuestion[];
  assets: CoursewareAsset[];
  references: Array<Record<string, unknown>>;
  lessonContext?: Record<string, unknown>;
  quality: {
    score: number;
    blocking: string[];
    warnings: string[];
    layoutCount: number;
  };
}
