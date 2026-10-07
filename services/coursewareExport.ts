import type { CoursewareManifest } from '../types/courseware';

export function resolveExportModelUrl(asset: Record<string, unknown> | null | undefined, localPreviewUrl = '') {
  const candidates = [asset?.exportModelUrl, asset?.modelUrl, asset?.appearanceUrl, asset?.glbUrl, localPreviewUrl];
  return candidates.find((value): value is string => typeof value === 'string' && value.trim() && !value.startsWith('blob:') && !value.startsWith('data:'))?.trim() || '';
}

export async function prepareCoursewareViews(manifest: CoursewareManifest, onPhase: (phase: string) => void): Promise<CoursewareManifest> {
  onPhase('检查模型图片');
  const prepare = async (checkOnly: boolean) => {
    const response = await fetch('/api/prep/courseware/prepare-views', {
      method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ manifest, checkOnly }),
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || data.message || '模型截图失败，请重试生成 PPT');
    return data;
  };
  let views = await prepare(true);
  if (views.status === 'missing') {
    onPhase('生成四视图');
    views = await prepare(false);
  }
  if (!['ready', 'not-required'].includes(views.status)) throw new Error('模型截图尚未完成，请重试生成 PPT');
  if (views.status === 'ready') {
    const { viewImageUrls, viewModelFingerprint, viewRenderVersion, viewImageSource } = views;
    if (!['front', 'left', 'right', 'back'].every((key) => viewImageUrls?.[key])) throw new Error('模型四视图未完整生成，请重试');
    manifest = { ...manifest, model: { ...manifest.model, viewImageUrls, viewModelFingerprint, viewRenderVersion, viewImageSource } };
  }
  onPhase('生成 PPT');
  return manifest;
}
