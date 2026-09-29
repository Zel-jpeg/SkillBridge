import test from 'node:test'
import assert from 'node:assert/strict'
import { assessmentAction, dashboardAssessmentAction } from './assessmentUiState.js'

const available = { availability_status: 'available' }

test('assessment cards map every attempt and availability state to a safe action', () => {
  assert.deepEqual(assessmentAction({ ...available, action: 'start' }), { label: 'Start Assessment', kind: 'take' })
  assert.deepEqual(assessmentAction({ ...available, action: 'continue' }), { label: 'Continue Assessment', kind: 'take' })
  assert.deepEqual(assessmentAction({ ...available, action: 'view_result', attempt_status: 'submitted', submitted_at: '2026-01-01' }), { label: 'View Score', kind: 'result' })
  assert.deepEqual(assessmentAction({ ...available, action: 'awaiting_retake', attempt_status: 'stopped', submitted_at: '2026-01-01' }), { label: 'View Recorded Attempt', kind: 'result' })
  assert.deepEqual(assessmentAction({ ...available, retake_allowed: true, attempt_status: 'stopped' }), { label: 'Retake Assessment', kind: 'take' })
  for (const availability_status of ['upcoming', 'overdue', 'closed']) {
    assert.equal(assessmentAction({ availability_status, action: 'unavailable' }).kind, 'disabled')
    assert.equal(assessmentAction({ availability_status, attempt_status: 'submitted', submitted_at: '2026-01-01' }).kind, 'result')
  }
})

test('dashboard action follows server progress and lock state', () => {
  assert.equal(dashboardAssessmentAction({ completed_required_count: 0, remaining_required_count: 3 }).label, 'View Assessments')
  assert.equal(dashboardAssessmentAction({ completed_required_count: 1, remaining_required_count: 2 }).label, 'Continue Assessments · 2 remaining')
  assert.equal(dashboardAssessmentAction({ all_required_completed: true, recommendations_locked: false }).label, 'View Final Results')
  assert.equal(dashboardAssessmentAction({ all_required_completed: true, recommendations_locked: true, completed_required_count: 1, remaining_required_count: 1 }).to, '/student/assessments')
  assert.equal(dashboardAssessmentAction({}, [{ attempt_status: 'stopped' }]).label, 'View Assessment Status')
  assert.equal(dashboardAssessmentAction({}, [{ availability_status: 'available', retake_allowed: true }]).label, 'Retake Available')
})
