const DAY = 86_400_000
const manilaDate = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Manila', year: 'numeric', month: '2-digit', day: '2-digit' })
const manilaDateTime = new Intl.DateTimeFormat('en-PH', { timeZone: 'Asia/Manila', dateStyle: 'medium', timeStyle: 'short' })

// Current student-only payloads; presentation never grants assessment/placement access.
export function studentNotifications(assessments, profile, now) {
  const entries = []
  for (const item of profile?.batch ? assessments : []) {
    if (item.is_archived || item.publication_status === 'draft') continue
    const title = item.title || 'Assessment'
    const available = item.availability_status === 'available'
    const needsAttempt = !['submitted', 'stopped'].includes(item.attempt_status) || item.retake_allowed
    const due = item.due_at ? Date.parse(item.due_at) : NaN
    const remaining = due - now
    const canAnswer = available && needsAttempt && (!item.is_flagged || item.retake_allowed)
    const to = canAnswer ? `/student/assessments/${item.id}/take` : '/student/assessments'

    if (item.retake_allowed) entries.push({
      id: `retake:${item.id}`, title: 'Retake approved', kind: 'retake', severity: available ? 'success' : 'warning', to,
      description: available ? `${title}: you can start your approved retake. Your earlier attempt stays on record.`
        : `${title}: a retake is approved, but the assessment is not currently open. Check its schedule or contact your coordinator.`,
    })
    else if (item.attempt_status === 'stopped' || item.is_flagged) entries.push({
      id: `review:${item.id}`, title: 'Assessment needs review', kind: 'assessment', severity: 'danger', to: '/student/assessments',
      description: `${title}: contact your instructor or administrator about the recorded attempt and retake approval.`,
    })

    const blocked = (item.attempt_status === 'stopped' || item.is_flagged) && !item.retake_allowed
    if (!needsAttempt || blocked || item.publication_status === 'closed' || !Number.isFinite(due) || remaining > 3 * DAY) continue
    // Only available/upcoming/overdue assessments belong to the current deadline queue.
    if (!['available', 'upcoming', 'overdue'].includes(item.availability_status)) continue
    const days = Math.ceil(remaining / DAY)
    const sameDay = remaining > 0 && manilaDate.format(due) === manilaDate.format(now)
    const heading = remaining <= 0 ? 'Assessment deadline passed' : sameDay ? 'Assessment due today'
      : `Assessment due in ${days} day${days === 1 ? '' : 's'}`
    entries.push({ id: `deadline:${item.id}`, title: heading, kind: 'deadline', urgent: remaining <= DAY,
      severity: remaining <= DAY ? 'danger' : 'warning', to: remaining <= 0 ? '/student/assessments' : to,
      dueAt: due, description: `${title}${item.is_required ? ' · Required' : ' · Optional'}. Due ${manilaDateTime.format(due)} (Manila). ${remaining <= 0 ? 'Contact your coordinator if you still need to complete this work.' : item.availability_status === 'upcoming' ? 'Check the assessment opening schedule.' : 'Complete your work before the deadline.'}`,
    })
  }
  entries.sort((a, b) => (b.urgent === true) - (a.urgent === true) || (a.dueAt ?? Number.MAX_SAFE_INTEGER) - (b.dueAt ?? Number.MAX_SAFE_INTEGER))
  if (profile?.placement?.status === 'approved') {
    const { placement } = profile
    entries.push({ id: `placement:${placement.id}`, title: 'OJT placement approved', kind: 'placement', severity: 'success', to: '/student/results',
      description: `Your approved placement is at ${placement.company?.name || 'your assigned partner organization'}${placement.position?.title ? ` as ${placement.position.title}` : ''}. View your placement details and contact your coordinator for next steps.`,
    })
  }
  if (profile?.all_required_completed && profile?.recommendations_locked === false) entries.push({
    id: 'results-ready', title: 'Your final results are ready', kind: 'results', severity: 'success', to: '/student/results',
    description: 'View your combined competency results and current OJT recommendations. Recommendations are separate from placement approval.',
  })
  return entries
}
