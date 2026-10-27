import test from 'node:test'
import assert from 'node:assert/strict'
import { createNotificationReadStore, notificationFingerprint, notificationOwner, parseNotificationReads, unreadSeverity } from './notificationReadState.js'
import { managementNotifications } from './notifications.js'
import { studentNotifications } from './studentNotifications.js'

const NOW = Date.parse('2026-10-26T01:00:00Z')
function storage() {
  const data = new Map([['sb-user', JSON.stringify({ id: 1, role: 'student' })]])
  return { data, getItem: key => data.get(key) ?? null, setItem: (key, value) => data.set(key, value) }
}
const item = { id: 'placement:1', title: 'Placement approved', description: 'PRIVATE_COMPANY_SENTINEL', to: '/student/results', severity: 'success' }
const isRead = (store, entry) => store.getSnapshot().reads.some(([key]) => key === notificationFingerprint(entry))

test('read state survives reload without persisting notification text and leaves the source unchanged', () => {
  const source = storage(), store = createNotificationReadStore(() => source, () => NOW)
  const before = JSON.stringify(item)
  store.markRead([item], store.getSnapshot().owner)
  assert.equal(isRead(store, item), true)
  assert.equal(isRead(createNotificationReadStore(() => source, () => NOW), item), true)
  assert.equal(source.getItem(notificationOwner(source)).includes('PRIVATE_COMPANY_SENTINEL'), false)
  assert.equal(JSON.stringify(item), before)
})

test('mark-all is account/role scoped and rejects a stale account callback', () => {
  const source = storage(), store = createNotificationReadStore(() => source, () => NOW)
  const owner = store.getSnapshot().owner
  store.markRead([item, { ...item, id: 'other' }], owner)
  assert.equal(store.getSnapshot().reads.length, 2)
  for (const user of [{ id: 2, role: 'student' }, { id: 1, role: 'instructor' }]) {
    source.setItem('sb-user', JSON.stringify(user))
    store.markRead([item], owner)
    assert.equal(isRead(store, item), false)
  }
  source.setItem('sb-user', JSON.stringify({ id: 1, role: 'student' }))
  assert.equal(isRead(store, item), true)
})

test('cross-tab updates reconcile while harmless data refreshes keep snapshot identity', () => {
  const source = storage(), first = createNotificationReadStore(() => source, () => NOW), second = createNotificationReadStore(() => source, () => NOW)
  const snapshot = second.getSnapshot()
  assert.equal(second.getSnapshot(), snapshot)
  let events = 0
  const stop = second.subscribe(() => events++)
  first.markRead([item], first.getSnapshot().owner)
  second.invalidate(snapshot.owner)
  assert.equal(events, 1)
  assert.equal(isRead(second, item), true)
  stop()
})

test('blocked, corrupt and oversized storage recover safely and reads are bounded and expire', () => {
  const store = createNotificationReadStore(() => { throw Error('blocked') }, () => NOW)
  store.markRead([item], store.getSnapshot().owner)
  assert.equal(isRead(store, item), true)
  assert.deepEqual(parseNotificationReads('{broken', NOW), [])
  assert.deepEqual(parseNotificationReads('{"fake":true}', NOW), [])
  const rows = Array.from({ length: 600 }, (_, index) => [index.toString(16).padStart(16, '0'), NOW-index])
  assert.equal(parseNotificationReads(JSON.stringify(rows), NOW).length, 500)
  assert.deepEqual(parseNotificationReads(JSON.stringify([['a'.repeat(16), NOW-91*86400000],['b'.repeat(16),NOW+1]]), NOW), [])
})

test('deadline escalation and replacement placements become unread; polling identical records does not', () => {
  const source = storage(), store = createNotificationReadStore(() => source, () => NOW)
  const profile = { batch: { id: 1 }, placement: { id: 4, status: 'approved', company: { name: 'Example' } } }
  const rows = [{ id: 1, title: 'Example assessment', publication_status: 'published', availability_status: 'available', due_at: new Date(NOW+3*86400000).toISOString() }]
  const initial = studentNotifications(rows, profile, NOW)
  store.markRead(initial, store.getSnapshot().owner)
  assert.ok(studentNotifications(rows, profile, NOW+1000).every(entry => isRead(store, entry)))
  assert.ok(studentNotifications(rows, profile, NOW+86400000).some(entry => !isRead(store, entry)))
  assert.equal(isRead(store, studentNotifications([], { ...profile, placement: { ...profile.placement, id: 5 } }, NOW)[0]), false)
})

test('same-count staff group membership changes produce unread updates and severity reflects meaning', () => {
  const build = id => managementNotifications({ summary: { awaiting_review: 1 }, students: [{ id, awaiting_review: true, reasons: ['Stopped / flagged','Final results unavailable'] }] }, 'instructor')
  const source = storage(), store = createNotificationReadStore(() => source, () => NOW)
  store.markRead(build(10), store.getSnapshot().owner)
  assert.ok(build(11).every(entry => !isRead(store, entry)))
  assert.equal(unreadSeverity(build(11)), 'danger')
  assert.equal(unreadSeverity(build(11).filter(entry => entry.kind === 'placement')), 'warning')
  assert.equal(unreadSeverity([item]), 'success')
  assert.equal(unreadSeverity([{ severity: 'info' }, item]), 'info')
})
