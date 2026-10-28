import test from 'node:test'
import assert from 'node:assert/strict'
import { emailProgressText } from './emailProgress.js'
import { managementNotifications } from './notifications.js'
import { validateApiResponse } from '../api/responseContract.js'

const group = { id: 'fixed-group', batch_id: 2, batch_name: 'Synthetic batch', source: 'enrollment',
  created_at: '2026-10-28T01:00:00Z', total: 50, submitted: 2, delivered: 0,
  waiting: 48, held: 0, failed: 0, uncertain: 0, cancelled: 0, state: 'sending' }

test('submission completion never claims delivery; held, quota and stopped states remain explicit', () => {
  assert.match(emailProgressText(group).detail, /48 waiting to send/)
  assert.match(emailProgressText({ ...group, state: 'submitted', submitted: 50, waiting: 0 }).detail, /Delivery confirmation may still be pending/)
  assert.match(emailProgressText({ ...group, state: 'held', submitted: 0, waiting: 0, held: 50 }).detail, /held for later/)
  assert.match(emailProgressText({ ...group, state: 'quota' }).detail, /resume automatically when allowance is available/)
  assert.match(emailProgressText({ ...group, state: 'paused' }).detail, /administrator attention/)
  assert.match(emailProgressText({ ...group, state: 'delivered', submitted: 50, delivered: 50 }).detail, /delivered to all 50 students/)
})

test('only completed groups produce stable, scoped completion reminders, without provider names', () => {
  const data = { summary: {}, students: [], generated_at: '2026-10-28T01:10:00Z', email_progress: [group] }
  assert.deepEqual(managementNotifications(data, 'instructor'), [])
  data.email_progress = [{ ...group, state: 'submitted', submitted: 50, waiting: 0 }]
  const entries = managementNotifications(data, 'instructor')
  assert.equal(entries.length, 1)
  assert.match(entries[0].to, /instructor\/students\?batch_id=2&emails=1&email_group=fixed-group/)
  assert.equal(entries[0].severity, 'success')
  assert.doesNotMatch(entries[0].description, /Brevo|all students notified/i)
  assert.deepEqual(entries, managementNotifications({ ...data, generated_at: '2026-10-28T02:00:00Z' }, 'instructor'))
  assert.deepEqual(managementNotifications(data, 'student'), [])
  assert.deepEqual(managementNotifications({ ...data, generated_at: '2026-11-10T01:00:00Z' }, 'admin'), [])
})

test('API progress rejects impossible totals and fabricated success instead of caching them', () => {
  const config = { method: 'get', url: '/api/instructor/batches/2/email-progress/' }
  const response = value => ({ data: { groups: [value], storage_ready: true }, config, status: 200 })
  assert.doesNotThrow(() => validateApiResponse(response(group)))
  for (const broken of [{ ...group, total: 0 }, { ...group, submitted: 51 }, { ...group, state: 'submitted' },
    { ...group, state: 'delivered', delivered: 50 }, { ...group, state: 'submitted', submitted: 50, failed: 1 }]) {
    assert.throws(() => validateApiResponse(response(broken)))
  }
})
