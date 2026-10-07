import assert from 'node:assert/strict'
import test from 'node:test'
import { mergeLessonPlanUpdate } from './lessonPlanIdentity.ts'

test('workflow updates preserve the mounted lesson identity', () => {
  const current = {
    id: 'lesson-original',
    createdAt: '2026-10-06T09:00:00',
    title: '原教案',
    designWorkflow: { currentStep: 4 },
  }
  const incoming = {
    id: 'lesson-regenerated',
    createdAt: '2026-10-06T09:05:00',
    title: '更新后的教案',
    designWorkflow: { currentStep: 4 },
  }

  const merged = mergeLessonPlanUpdate(current, incoming)

  assert.equal(merged.id, current.id)
  assert.equal(merged.createdAt, current.createdAt)
  assert.equal(merged.title, incoming.title)
  assert.deepEqual(merged.designWorkflow, incoming.designWorkflow)
})
