import type { TeachingModelId } from '../types.ts';

export type TeachingModelLoadAction = 'ready' | 'reuse' | 'wait' | 'retry' | 'start';

export interface TeachingModelLoadSnapshot {
  targetModelId: TeachingModelId;
  targetModelUrl?: string;
  activeContent: 'model' | 'biodigital' | 'interactive';
  activeModelId: TeachingModelId | null;
  activeModelUrl: string | null;
  loadedModelUrl: string | null;
  failedModelUrl: string | null;
  pendingModelId?: TeachingModelId;
  pendingModelUrl?: string;
}

export function decideTeachingModelLoad(snapshot: TeachingModelLoadSnapshot): TeachingModelLoadAction {
  const {
    targetModelId,
    targetModelUrl,
    activeContent,
    activeModelId,
    activeModelUrl,
    loadedModelUrl,
    failedModelUrl,
    pendingModelId,
    pendingModelUrl,
  } = snapshot;

  if (targetModelId === 'biodigital_heart') {
    return activeContent === 'biodigital' && activeModelId === targetModelId ? 'ready' : 'start';
  }

  if (!targetModelUrl) return 'start';

  if (pendingModelId === targetModelId && pendingModelUrl === targetModelUrl) {
    return 'reuse';
  }

  const isTargetActive = activeContent === 'model'
    && activeModelId === targetModelId
    && activeModelUrl === targetModelUrl;

  if (isTargetActive && loadedModelUrl === targetModelUrl) return 'ready';
  if (isTargetActive && failedModelUrl === targetModelUrl) return 'retry';
  if (isTargetActive) return 'wait';
  return 'start';
}

export function isCurrentModelLoadEvent(
  eventModelUrl: string,
  activeModelUrl: string | null,
  eventRevision: number,
  activeRevision: number,
): boolean {
  return eventModelUrl === activeModelUrl && eventRevision === activeRevision;
}

export class TeachingModelLoadError extends Error {
  readonly modelId: TeachingModelId;
  readonly modelUrl: string;

  constructor(modelId: TeachingModelId, modelUrl: string, message: string) {
    super(message);
    this.name = 'TeachingModelLoadError';
    this.modelId = modelId;
    this.modelUrl = modelUrl;
  }
}
