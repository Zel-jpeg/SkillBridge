import test from 'node:test'
import assert from 'node:assert/strict'
import { assessmentCardPresentation, orderAssessmentCards } from './assessmentCardPresentation.js'
import { assessmentAction } from './assessmentUiState.js'

const available = { availability_status: 'available' }
const finalized = { attempt_status: 'submitted', submitted_at: '2026-10-30T01:00:00Z' }

test('presentation follows existing attempt, availability and retake fields without changing actions', () => {
  const cases = [
    [{ ...available, action: 'start' }, 'ready', 'Start Assessment'],
    [{ ...available, action: 'continue', attempt_status: 'in_progress' }, 'progress', 'Continue Assessment'],
    [{ ...available, ...finalized, action: 'view_result' }, 'completed', 'View Score'],
    [{ ...available, attempt_status: 'stopped', submitted_at: finalized.submitted_at, action: 'awaiting_retake' }, 'stopped', 'View Recorded Attempt'],
    [{ ...available, ...finalized, is_flagged: true, action: 'view_result' }, 'flagged', 'View Score'],
    [{ ...available, attempt_status: 'stopped', is_flagged: true, retake_allowed: true }, 'retake', 'Retake Assessment'],
    [{ ...available, ...finalized, retake_allowed: true }, 'retake', 'Retake Assessment'],
    [{ availability_status: 'upcoming', action: 'start' }, 'upcoming', 'Unavailable'],
    [{ availability_status: 'overdue', action: 'continue', attempt_status: 'in_progress' }, 'overdue', 'Unavailable'],
    [{ availability_status: 'closed' }, 'closed', 'Unavailable'],
    [{ availability_status: 'batch_inactive' }, 'unavailable', 'Unavailable'],
    [{ availability_status: 'unexpected', action: 'start' }, 'unavailable', 'Unavailable'],
    [{ ...available, attempt_status: 'submitted', action: 'view_result' }, 'submitted', 'View Score'],
  ]
  for (const [input, expectedState, expectedAction] of cases) {
    const before = structuredClone(input)
    assert.equal(assessmentCardPresentation(input).key, expectedState)
    assert.equal(assessmentAction(input).label, expectedAction)
    assert.deepEqual(input, before)
  }
})

test('completed results stay accessible after opening, deadline and publication changes', () => {
  for (const availability_status of ['available', 'upcoming', 'overdue', 'closed']) {
    const item = { ...finalized, availability_status, action: 'view_result' }
    assert.equal(assessmentCardPresentation(item).label, 'Completed')
    assert.equal(assessmentAction(item).kind, 'result')
    if (availability_status !== 'available') {
      assert.equal(assessmentCardPresentation({ ...item, retake_allowed: true }).key, 'completed')
      assert.equal(assessmentAction({ ...item, retake_allowed: true }).kind, 'result')
    }
  }
})

test('stopped and flagged records never acquire completed presentation from an existing result', () => {
  for (const availability_status of ['available', 'overdue', 'closed']) {
    for (const status of ['pending', 'approved', 'declined', '']) {
      const item = { ...finalized, availability_status, attempt_status: 'stopped',
        action: 'awaiting_retake', retake_request: { status } }
      assert.equal(assessmentCardPresentation(item).key, 'stopped')
      assert.equal(assessmentAction(item).kind, 'result')
      assert.equal(assessmentCardPresentation({ ...item, attempt_status: 'submitted', is_flagged: true }).key, 'flagged')
    }
  }
})

test('requirement and competency inclusion do not alter the attempt presentation or action', () => {
  for (const is_required of [true, false]) for (const include_in_competency of [true, false]) {
    assert.equal(assessmentCardPresentation({ ...available, ...finalized, is_required, include_in_competency }).key, 'completed')
    assert.equal(assessmentCardPresentation({ ...available, action: 'start', is_required, include_in_competency }).key, 'ready')
  }
})

test('request metadata alone does not turn a completed attempt into stopped or grant a retake', () => {
  for (const status of ['pending', 'approved', 'declined']) {
    const row = { ...available, ...finalized, action: 'view_result', retake_request: { status } }
    assert.equal(assessmentCardPresentation(row).key, 'completed')
    assert.equal(assessmentAction(row).kind, 'result')
  }
})

test('unfinished-first ordering is stable, immutable and keeps saved identities and numbers intact', () => {
  const rows = [
    { id: 91, title: 'Assessment 4', ...available, ...finalized },
    { id: 12, title: 'Assessment 2', ...available, action: 'start' },
    { id: 76, title: 'Assessment 8', ...available, attempt_status: 'stopped' },
    { id: 25, title: 'Assessment 1', ...available, action: 'continue' },
    { id: 30, title: 'Assessment 5', availability_status: 'overdue' },
    { id: 50, title: 'Assessment 7', ...available, retake_allowed: true },
    { id: 24, title: 'Assessment 6', ...available, ...finalized },
  ]
  const before = structuredClone(rows)
  rows.forEach(Object.freeze)
  Object.freeze(rows)
  const ordered = orderAssessmentCards(rows)
  assert.deepEqual(ordered.map(item => item.id), [25, 12, 50, 76, 30, 91, 24])
  assert.deepEqual(ordered.map(item => item.title), ['Assessment 1', 'Assessment 2', 'Assessment 7', 'Assessment 8', 'Assessment 5', 'Assessment 4', 'Assessment 6'])
  assert.deepEqual(rows, before)
  assert.equal(ordered.at(-1), rows.at(-1))
  assert.deepEqual(orderAssessmentCards([]), [])
})

test('a newly confirmed completion moves behind unfinished work and a granted retake rejoins it', () => {
  const rows = [1, 2, 3].map(id => ({ id, title: `Assessment ${id}`, ...available, action: 'start' }))
  rows[0] = { ...rows[0], ...finalized, action: 'view_result' }
  assert.deepEqual(orderAssessmentCards(rows).map(item => item.id), [2, 3, 1])
  rows[2] = { ...rows[2], ...finalized, action: 'view_result' }
  assert.deepEqual(orderAssessmentCards(rows).map(item => item.id), [2, 1, 3])
  rows[0] = { ...rows[0], retake_allowed: true }
  assert.deepEqual(orderAssessmentCards(rows).map(item => item.id), [1, 2, 3])
})
