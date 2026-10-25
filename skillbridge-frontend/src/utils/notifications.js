const reasonDescriptions = {
  'Stopped / flagged': 'Review assessment integrity issues with the affected students.',
  'Overdue required work': 'Required assessment work is past its deadline.',
  'No required assessments': 'Review the assessment setup for these students.',
  'Final results unavailable': 'Required work is complete, but current final results are unavailable.',
  'No current recommendations': 'Review students without a current placement recommendation.',
}

// These are live action groups from the authorized analytics scope, not an unread inbox.
export function managementNotifications(data, role) {
  if (!data?.summary || !['admin', 'instructor'].includes(role)) return []
  const reasons = new Map()
  for (const row of data.students ?? []) for (const reason of new Set(row.reasons ?? [])) {
    reasons.set(reason, (reasons.get(reason) ?? 0) + 1)
  }
  const notifications = [...reasons].map(([title, count]) => ({
    id: `reason:${title}`, title, count,
    description: reasonDescriptions[title] || 'Review the affected students in Reports & Analytics.',
    to: `/${role}/reports?${new URLSearchParams({ tab: 'assessments', group: `reason:${title}` })}`,
    kind: 'assessment',
  }))
  if (data.summary.awaiting_review > 0) notifications.push({
    id: 'placement-review', title: 'Placement review', count: data.summary.awaiting_review,
    description: 'Unplaced students have current recommendations ready for review.',
    to: `/${role}/reports?tab=placements&group=awaiting`, kind: 'placement',
  })
  if (role === 'admin' && data.summary.pending_instructors > 0) notifications.push({
    id: 'instructor-approvals', title: 'Instructor approvals', count: data.summary.pending_instructors,
    description: 'Instructor accounts are awaiting administrator approval.',
    to: '/admin/users?tab=pending', kind: 'approval',
  })
  return notifications
}
