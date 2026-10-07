import assert from 'node:assert/strict';
import test from 'node:test';
import { prepareCoursewareViews, resolveExportModelUrl } from './coursewareExport.ts';
import type { CoursewareManifest } from '../types/courseware.ts';

const manifest = { model: { modelUrl: '/models/current.glb' }, scenes: [] } as unknown as CoursewareManifest;
const ready = { status: 'ready', viewModelFingerprint: 'new', viewRenderVersion: 'v1',
  viewImageUrls: { front: '/front.png', left: '/left.png', right: '/right.png', back: '/back.png' } };

test('missing views generate before export and preserve the model identity', async (t) => {
  const checks: boolean[] = [], phases: string[] = [];
  t.mock.method(globalThis, 'fetch', async (_url: unknown, options: RequestInit) => {
    const body = JSON.parse(String(options.body));
    checks.push(body.checkOnly);
    return Response.json(body.checkOnly ? { status: 'missing' } : ready);
  });
  const result = await prepareCoursewareViews(manifest, (phase) => phases.push(phase));
  assert.deepEqual(checks, [true, false]);
  assert.deepEqual(phases, ['检查模型图片', '生成四视图', '生成 PPT']);
  assert.equal(result.model.modelUrl, manifest.model.modelUrl);
  assert.equal(result.model.viewModelFingerprint, 'new');
  assert.equal(manifest.model.viewModelFingerprint, undefined);
});

test('valid cache skips rendering, and failures stop before PPT generation', async (t) => {
  const phases: string[] = [];
  const request = t.mock.method(globalThis, 'fetch', async () => Response.json(ready));
  await prepareCoursewareViews(manifest, (phase) => phases.push(phase));
  assert.equal(request.mock.callCount(), 1);
  assert.deepEqual(phases, ['检查模型图片', '生成 PPT']);
  phases.length = 0;
  request.mock.mockImplementation(async () => Response.json({ error: '截图超时，请重试' }, { status: 500 }));
  await assert.rejects(prepareCoursewareViews(manifest, (phase) => phases.push(phase)), /截图超时/);
  assert.deepEqual(phases, ['检查模型图片']);
});

test('export model URL prefers server storage over a browser blob preview', () => {
  assert.equal(resolveExportModelUrl({ source: 'imported', modelUrl: 'blob:http://localhost/local', exportModelUrl: '/api/models/m1/files/glb' }, 'blob:http://localhost/local'), '/api/models/m1/files/glb');
  assert.equal(resolveExportModelUrl({ source: 'imported', glbUrl: 'blob:http://localhost/local' }, 'blob:http://localhost/local'), '');
  assert.equal(resolveExportModelUrl({ glbUrl: '/models/current.glb' }), '/models/current.glb');
});
