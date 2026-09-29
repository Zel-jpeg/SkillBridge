export function assessmentAction(item) {
  const finalized = item?.submitted_at && ['submitted', 'stopped'].includes(item.attempt_status)
  if (item?.availability_status !== 'available') {
    return finalized ? { label: 'View Score', kind: 'result' } : { label: 'Unavailable', kind: 'disabled' }
  }
  if (item?.retake_allowed) return { label: 'Retake Assessment', kind: 'take' }
  if (item?.action === 'continue') return { label: 'Continue Assessment', kind: 'take' }
  if (item?.action === 'start') return { label: 'Start Assessment', kind: 'take' }
  if (item?.action === 'awaiting_retake') return { label: 'View Recorded Attempt', kind: 'result' }
  if (item?.action === 'view_result' || finalized) return { label: 'View Score', kind: 'result' }
  return { label: 'Unavailable', kind: 'disabled' }
}

export function dashboardAssessmentAction(progress, assessments = []) {
  const retake = assessments.find(item => item.retake_allowed && item.availability_status === 'available')
  if (retake) return { label: 'Retake Available', to: '/student/assessments' }
  const stopped = assessments.find(item => item.attempt_status === 'stopped' && !item.retake_allowed)
  if (stopped) return { label: 'View Assessment Status', to: '/student/assessments' }
  if (progress?.recommendations_locked === false && progress?.all_required_completed) {
    return { label: 'View Final Results', to: '/student/results' }
  }
  const completed = progress?.completed_required_count || 0
  const remaining = progress?.remaining_required_count || 0
  if (completed > 0 && remaining > 0) {
    return { label: `Continue Assessments · ${remaining} remaining`, to: '/student/assessments' }
  }
  return { label: 'View Assessments', to: '/student/assessments' }
}
