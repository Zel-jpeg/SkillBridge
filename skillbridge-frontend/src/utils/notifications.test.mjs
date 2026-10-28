import test from 'node:test'
import assert from 'node:assert/strict'
import { managementNotifications } from './notifications.js'

const data = { summary: { awaiting_review: 3, pending_instructors: 2 }, students: [
  { id: 1, reasons: ['Stopped / flagged', 'Stopped / flagged', 'Overdue required work'] },
  { id: 2, reasons: ['Stopped / flagged'] },
] }

test('reminders group overlapping reasons without counting the same student twice in one group', () => {
  const items = managementNotifications(data, 'instructor')
  assert.equal(items.length, 3)
  assert.equal(items.find(item => item.title === 'Stopped / flagged').count, 2)
  assert.equal(items.find(item => item.title === 'Overdue required work').count, 1)
  assert.equal(items.find(item => item.kind === 'placement').count, 3)
  assert.equal(new URL(items[0].to, 'https://example.invalid').searchParams.get('group'), 'reason:Stopped / flagged')
})

test('approvals stay admin-only and current reminders use role-scoped destinations', () => {
  assert.equal(managementNotifications(data, 'instructor').some(item => item.kind === 'approval'), false)
  assert.equal(managementNotifications(data, 'admin').find(item => item.kind === 'approval').to, '/admin/users?tab=pending')
  assert.ok(managementNotifications(data, 'admin').every(item => item.to.startsWith('/admin/')))
  assert.deepEqual(managementNotifications(data, 'student'), [])
})

test('quota reminders explain saved enrollment and link each staff role to its reviewed batch', () => {
  const payload = { ...data, email_notifications: [{ batch_id: 7, batch_name: 'Synthetic Batch', kind: 'quota', count: 80, revision: ['opaque'] }] }
  for (const role of ['admin', 'instructor']) {
    const item = managementNotifications(payload, role).find(entry => entry.kind === 'email')
    assert.equal(item.count, 80)
    assert.match(item.description, /Students are enrolled/)
    assert.match(item.description, /automatically/)
    const url = new URL(item.to, 'https://example.invalid')
    assert.equal(url.searchParams.get('batch_id'), '7')
    assert.equal(url.searchParams.get('emails'), '1')
    assert.ok(url.pathname.startsWith(`/${role}/`))
  }
})

test('missing data and genuinely empty action queues remain distinct at the caller', () => {
  assert.deepEqual(managementNotifications(null, 'admin'), [])
  assert.deepEqual(managementNotifications({ summary: {}, students: [] }, 'admin'), [])
})
