export const completedEmailGroup = group => ['submitted', 'delivered'].includes(group.state)

export function emailProgressText(group) {
  const { total, submitted, delivered, waiting, held, failed, uncertain, cancelled } = group
  if (group.state === 'delivered') return { title: 'Enrollment emails delivered', detail: `Enrollment emails delivered to all ${total} students.`, tone: 'success' }
  if (group.state === 'submitted') return { title: 'All enrollment emails submitted', detail: `All ${total} enrollment emails submitted. Delivery confirmation may still be pending.`, tone: 'success' }
  if (group.state === 'attention') return { title: 'Some emails need attention', detail: `${failed} failed · ${uncertain} uncertain. Review email history before sending again.`, tone: 'warning' }
  if (group.state === 'cancelled') return { title: 'Sending cancelled for some recipients', detail: `${cancelled} cancelled. ${submitted} of ${total} emails submitted.`, tone: 'warning' }
  if (group.state === 'held') return { title: 'Not scheduled', detail: `${held} email notices held for later. Choose Send selected when ready.`, tone: 'neutral' }
  if (group.state === 'paused') return { title: 'Waiting to send', detail: `${waiting} email requests are saved. Automatic sending needs administrator attention.`, tone: 'warning' }
  if (group.state === 'quota') return { title: 'Daily sending limit reached', detail: `${waiting} emails are pending and will resume automatically when allowance is available.`, tone: 'warning' }
  return { title: 'Sending enrollment emails', detail: `${waiting} waiting to send${held ? ` · ${held} held for later` : ''}. ${delivered} delivery confirmations.`, tone: 'neutral' }
}
