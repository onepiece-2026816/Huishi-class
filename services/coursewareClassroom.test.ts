import assert from 'node:assert/strict';
import test from 'node:test';
import { prepareClassroomCourseware, validateClassroomQuestions } from './coursewareClassroom.ts';
import type { CoursewareManifest } from '../types/courseware.ts';
import type { WarmupQuestion } from './quizData.ts';

const lessonPlan = { id: 'lesson-1' };
const question = { id: 'q1', enabled: true, question: 'Question', options: ['A', 'B'], correctIndex: 0, explanation: 'Explanation' } as WarmupQuestion;
const manifest = {
  lessonId: lessonPlan.id, model: { modelUrl: '/model.glb' },
  scenes: [{ id: 'scene-1', type: 'hook', title: 'Teacher edit', enabled: true, source: 'teacher-edited' },
    { id: 'quiz', type: 'gesture-quiz', enabled: true }], questions: [question],
} as CoursewareManifest;

test('classroom reuses edited courseware without AI, model screenshots or network', async (t) => {
  const request = t.mock.method(globalThis, 'fetch', async () => { throw new Error('Unexpected network request'); });
  const result = await prepareClassroomCourseware({ lessonPlan, questions: [question], manifest });
  assert.equal(request.mock.callCount(), 0);
  assert.equal(result.scenes, manifest.scenes);
  assert.equal(result.scenes[0].title, 'Teacher edit');
});

test('no quiz makes one local courseware request and never keeps template questions', async (t) => {
  const request = t.mock.method(globalThis, 'fetch', async (url: unknown, options: RequestInit) => {
    assert.equal(url, '/api/prep/courseware/generate');
    assert.deepEqual(JSON.parse(String(options.body)).questions, []);
    return Response.json({ manifest });
  });
  const result = await prepareClassroomCourseware({ lessonPlan, questions: [] });
  assert.equal(request.mock.callCount(), 1);
  assert.deepEqual(result.questions, []);
  assert.equal(result.scenes.length, 1);
  assert.equal(manifest.scenes.length, 2);
});

test('a different lesson never reuses stale courseware', async (t) => {
  const request = t.mock.method(globalThis, 'fetch', async () => Response.json({ manifest }));
  await prepareClassroomCourseware({ lessonPlan, questions: [question], manifest: { ...manifest, lessonId: 'old' } });
  assert.equal(request.mock.callCount(), 1);
});

test('disabled questions are preserved but do not produce an empty quiz scene', async () => {
  const disabled = { ...question, enabled: false, question: '' };
  const result = await prepareClassroomCourseware({ lessonPlan, questions: [disabled], manifest });
  assert.deepEqual(result.questions, [disabled]);
  assert.equal(result.scenes.length, 1);
});

test('removing the only quiz scene cannot open an empty classroom', async () => {
  await assert.rejects(prepareClassroomCourseware({ lessonPlan, questions: [], manifest: { ...manifest, scenes: [manifest.scenes[1]] } }), /没有可用场景/);
});

test('invalid enabled questions fail immediately without network', async (t) => {
  const request = t.mock.method(globalThis, 'fetch', async () => Response.json({ manifest }));
  await assert.rejects(prepareClassroomCourseware({ lessonPlan, questions: [{ ...question, options: ['A', ''] }] }), /请先修正/);
  assert.throws(() => validateClassroomQuestions([{ ...question, correctIndex: 0.5 }]), /请先修正/);
  assert.equal(request.mock.callCount(), 0);
});

test('timeout aborts a stalled fetch and allows retry', async (t) => {
  const request = t.mock.method(globalThis, 'fetch', (_url: unknown, options: RequestInit) => new Promise<Response>((_resolve, reject) => {
    options.signal?.addEventListener('abort', () => reject(options.signal?.reason), { once: true });
  }));
  await assert.rejects(prepareClassroomCourseware({ lessonPlan, questions: [], timeoutMs: 10 }), /准备超时/);
  request.mock.mockImplementation(async () => Response.json({ manifest }));
  const result = await prepareClassroomCourseware({ lessonPlan, questions: [] });
  assert.equal(result.lessonId, lessonPlan.id);
});

test('caller cancellation aborts preparation; HTTP errors remain actionable', async (t) => {
  const controller = new AbortController();
  const request = t.mock.method(globalThis, 'fetch', (_url: unknown, options: RequestInit) => new Promise<Response>((_resolve, reject) => {
    options.signal?.addEventListener('abort', () => reject(options.signal?.reason), { once: true });
  }));
  const pending = prepareClassroomCourseware({ lessonPlan, questions: [], signal: controller.signal });
  controller.abort();
  await assert.rejects(pending, { name: 'AbortError' });
  request.mock.mockImplementation(async () => Response.json({ error: '请重新登录' }, { status: 401 }));
  await assert.rejects(prepareClassroomCourseware({ lessonPlan, questions: [] }), /请重新登录/);
});
