import test from 'node:test'
import assert from 'node:assert/strict'
import { assessmentChangeImpact, assessmentDatePayload, assessmentLocks } from './assessmentPolicy.js'
import { toManilaInput } from './assessmentDates.js'

test('attempts freeze duration/opening and only active attempts freeze publication', () => {
  assert.equal(assessmentLocks({}).duration, false)
  assert.deepEqual(assessmentLocks({ questions_locked: true, unfinished_attempt_count: 1 }),
    { attempted: true, duration: true, opening: true, publication: true, deadline: true })
  assert.equal(assessmentLocks({ attempt_count: 1, due_at: '2026-11-01T04:00:00Z' }).deadline, false)
  assert.equal(assessmentLocks({ attempt_count: 1 }).publication, false)
})

test('unchanged minute inputs preserve original date precision for locked settings', () => {
  const assessment = { available_at: '2026-11-01T01:00:23Z', due_at: '2026-11-01T04:00:45Z' }
  const draft = Object.fromEntries(Object.entries(assessment).map(([key, value]) => [key, toManilaInput(value)]))
  assert.deepEqual(assessmentDatePayload(assessment, draft), assessment)
  assert.equal(assessmentDatePayload(assessment, { ...draft, due_at: '' }).due_at, null)
})

test('review explains completion gates, evidence and fixed existing cutoffs separately', () => {
  const a = { publication_status: 'published', is_required: true, include_in_competency: true, due_at: null }
  const messages = assessmentChangeImpact(a, { publication_status: 'closed', is_required: false, include_in_competency: false, due_at: '2026-11-01T12:00' })
  assert.equal(messages.length, 4)
  assert.match(messages[0], /current required-completion/)
  assert.match(messages[2], /individual results remain/)
  assert.match(messages[3], /Existing attempt cutoffs stay unchanged/)
  assert.deepEqual(assessmentChangeImpact(a, { ...a, due_at: '' }), [])
})
