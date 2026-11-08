import { completedEmailGroup, emailProgressText } from './emailProgress.js'

const reasonDescriptions = {
  'Stopped / flagged': 'Review assessment integrity issues with the affected students.',
  'Overdue required work': 'Required assessment work is past its deadline.',
  'No required assessments': 'Review the assessment setup for these students.',
  'Final results unavailable': 'Required work is complete, but current final results are unavailable.',
  'No current recommendations': 'Review students without a current placement recommendation.',
}

// Current authorized reminder groups; a changed membership is a new update.
export function managementNotifications(data, role) {
  if (!data?.summary || !['admin', 'instructor'].includes(role)) return []
  const batches = new Map((data.options?.batches ?? []).map(batch => [batch.id, batch]))
  function emailLink(group, groupId) {
    const params = new URLSearchParams({ batch_id: group.batch_id, emails: '1' })
    if (groupId) params.set('email_group', groupId)
    const batch = batches.get(group.batch_id)
    if (role === 'admin' && batch?.institute_id) {
      params.set('institute', batch.institute_id)
      params.set('program', batch.program_id || 'all')
    }
    return `/${role === 'admin' ? 'admin/batches' : 'instructor/students'}?${params}`
  }
  const reasons = new Map()
  for (const row of data.students ?? []) for (const reason of new Set(row.reasons ?? [])) {
    reasons.set(reason, (reasons.get(reason) ?? 0) + 1)
  }
  const notifications = [...reasons].map(([title, count]) => ({
    id: `reason:${title}`, title, count,
    description: reasonDescriptions[title] || 'Review the affected students in Reports & Analytics.',
    to: `/${role}/reports?${new URLSearchParams({ tab: 'assessments', group: `reason:${title}` })}`,
    kind: 'assessment', severity: ['Stopped / flagged', 'Overdue required work'].includes(title) ? 'danger' : 'warning',
    revision: (data.students ?? []).filter(row => row.reasons?.includes(title)).map(row => row.id).sort((a, b) => a - b),
  }))
  if (data.summary.awaiting_review > 0) notifications.push({
    id: 'placement-review', title: 'Placement review', count: data.summary.awaiting_review,
    description: 'Unplaced students have current recommendations ready for review.',
    to: `/${role}/reports?tab=placements&group=awaiting`, kind: 'placement', severity: 'warning',
    revision: (data.students ?? []).filter(row => row.awaiting_review).map(row => row.id).sort((a, b) => a - b),
  })
  if (role === 'admin' && data.summary.pending_instructors > 0) notifications.push({
    id: 'instructor-approvals', title: 'Instructor approvals', count: data.summary.pending_instructors,
    description: 'Instructor accounts are awaiting administrator approval.',
    to: '/admin/users?tab=pending', kind: 'approval', severity: 'info',
  })
  for (const group of data.email_notifications ?? []) notifications.push({
    id: `email:${group.batch_id}:${group.kind}`, title: group.kind === 'quota' ? 'Enrollment emails pending' : 'Enrollment emails need attention',
    count: group.count, description: group.kind === 'quota'
      ? `${group.batch_name}: daily email allowance reached. Students are enrolled; emails resume automatically when allowance is available.`
      : `${group.batch_name}: review saved email problems. Enrollment stays unchanged.`,
    to: emailLink(group),
    kind: 'email', severity: 'warning', revision: group.revision,
  })
  for (const group of data.email_progress ?? []) {
    if (!completedEmailGroup(group) || Date.parse(data.generated_at) - Date.parse(group.created_at) > 7 * 86_400_000) continue
    const text = emailProgressText(group)
    notifications.push({ id: `email-group:${group.id}`, title: text.title, count: group.total,
      description: `${group.batch_name}: ${text.detail}`,
      to: emailLink(group, group.id),
      kind: 'email_complete', severity: 'success', revision: [group.id, group.state] })
  }
  return notifications
}
