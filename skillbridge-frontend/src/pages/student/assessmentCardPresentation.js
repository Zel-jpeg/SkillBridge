import { assessmentAction } from './assessmentUiState.js'

// Presentation only. The existing action helper and server remain authoritative.
const states = {
  progress: { key: 'progress', label: 'In progress', priority: 0 },
  ready: { key: 'ready', label: 'Ready to start', priority: 1 },
  retake: { key: 'retake', label: 'Retake approved', priority: 1 },
  stopped: { key: 'stopped', label: 'Stopped', priority: 2 },
  flagged: { key: 'flagged', label: 'Needs review', priority: 2 },
  upcoming: { key: 'upcoming', label: 'Upcoming', priority: 3 },
  overdue: { key: 'overdue', label: 'Deadline passed', priority: 3 },
  closed: { key: 'closed', label: 'Closed', priority: 3 },
  unavailable: { key: 'unavailable', label: 'Unavailable', priority: 3 },
  submitted: { key: 'submitted', label: 'Submitted', priority: 3 },
  completed: { key: 'completed', label: 'Completed', priority: 4 },
}

export function assessmentCardPresentation(item) {
  const action = assessmentAction(item)
  if (item.retake_allowed && item.availability_status === 'available') return states.retake
  if (item.attempt_status === 'stopped') return states.stopped
  if (item.is_flagged) return states.flagged
  if (item.attempt_status === 'submitted' && item.submitted_at) return states.completed
  if (item.availability_status === 'upcoming') return states.upcoming
  if (item.availability_status === 'overdue') return states.overdue
  if (item.availability_status === 'closed') return states.closed
  if (action.label === 'Continue Assessment') return states.progress
  if (action.label === 'Start Assessment') return states.ready
  if (item.attempt_status === 'submitted') return states.submitted
  return states.unavailable
}

export function orderAssessmentCards(items) {
  // Keep server order inside each group and never mutate saved numbers or titles.
  return items.map((item, index) => ({ item, index, priority: assessmentCardPresentation(item).priority }))
    .sort((a, b) => a.priority - b.priority || a.index - b.index)
    .map(({ item }) => item)
}
