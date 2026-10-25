import test from 'node:test'
import assert from 'node:assert/strict'
import { studentNotifications } from './studentNotifications.js'

const NOW = Date.parse('2026-10-25T01:00:00Z')
const DAY = 86_400_000
const profile = { batch: { id: 1 }, recommendations_locked: true, placement: null }
const assessment = overrides => ({ id: 1, title: 'Synthetic Assessment', publication_status: 'published',
  availability_status: 'available', is_required: true, attempt_status: null, due_at: new Date(NOW + 3 * DAY).toISOString(), ...overrides })
const entries = (row, now = NOW) => studentNotifications([row], profile, now)

test('three-, two- and one-day boundaries replace one stable reminder without daily duplicates', () => {
  const row = assessment()
  assert.match(entries(row)[0].title, /3 days/)
  assert.match(entries(row, NOW + DAY)[0].title, /2 days/)
  assert.match(entries(row, NOW + 2 * DAY)[0].title, /1 day/)
  assert.equal(entries(row)[0].id, entries(row, NOW + DAY)[0].id)
  assert.equal(entries(assessment({ due_at: new Date(NOW + 3 * DAY + 1).toISOString() })).length, 0)
})

test('due-today wording uses Manila dates and exact cutoff becomes overdue without a start link', () => {
  const now = Date.parse('2026-10-25T16:30:00Z') // Oct 26, 12:30am Manila.
  assert.equal(entries(assessment({ due_at: '2026-10-26T05:00:00Z' }), now)[0].title, 'Assessment due today')
  const expired = entries(assessment({ due_at: new Date(NOW).toISOString() }))[0]
  assert.equal(expired.title, 'Assessment deadline passed')
  assert.equal(expired.to, '/student/assessments')
  assert.equal(expired.urgent, true)
  assert.match(expired.description, /\(Manila\)/)
})

test('submitted work clears its deadline; an approved retake of a flagged attempt remains actionable', () => {
  assert.deepEqual(entries(assessment({ attempt_status: 'submitted' })), [])
  const items = entries(assessment({ attempt_status: 'stopped', is_flagged: true, retake_allowed: true }))
  assert.equal(items.filter(item => item.kind === 'retake').length, 1)
  assert.equal(items.find(item => item.kind === 'retake').to, '/student/assessments/1/take')
  assert.equal(items.filter(item => item.kind === 'deadline').length, 1)
  assert.deepEqual(entries(assessment({ attempt_status: 'stopped' })).map(item => item.kind), ['assessment'])
})

test('missing deadlines, archived/draft/closed work and absent enrollment never invent a due reminder', () => {
  for (const override of [{ due_at: null }, { due_at: 'invalid' }, { is_archived: true }, { publication_status: 'draft' }, { publication_status: 'closed' }, { availability_status: 'closed' }]) {
    assert.equal(entries(assessment(override)).some(item => item.kind === 'deadline'), false)
  }
  assert.deepEqual(studentNotifications([assessment()], { ...profile, batch: null }, NOW), [])
})

test('retake approval does not override upcoming or closed availability', () => {
  for (const availability_status of ['upcoming', 'closed', 'overdue']) {
    const item = entries(assessment({ retake_allowed: true, availability_status })).find(item => item.kind === 'retake')
    assert.equal(item.to, '/student/assessments')
    assert.match(item.description, /not currently open/)
  }
})

test('only approved placements generate a company notification; ranking and internal notes are not placement events', () => {
  for (const status of ['suggested', 'removed', 'rejected', 'unplaced']) {
    const items = studentNotifications([], { ...profile, placement: { status, remarks: 'INTERNAL_SENTINEL' } }, NOW)
    assert.deepEqual(items, [])
  }
  const placed = { ...profile, placement: { id: 5, status: 'approved', company: { name: 'Sample Institution' }, position: { title: 'IT Intern' }, remarks: 'INTERNAL_SENTINEL' } }
  const item = studentNotifications([], placed, NOW)[0]
  assert.match(item.description, /Sample Institution as IT Intern/)
  assert.equal(item.description.includes('INTERNAL_SENTINEL'), false)
  assert.equal(item.to, '/student/results')
})

test('final-results notice respects the final evidence lock and notification building does not mutate inputs', () => {
  assert.equal(studentNotifications([], { ...profile, all_required_completed: true }, NOW).length, 0)
  assert.equal(studentNotifications([], { ...profile, all_required_completed: true, recommendations_locked: false }, NOW)[0].kind, 'results')
  const row = assessment({ retake_allowed: true })
  const before = JSON.stringify([row, profile])
  entries(row)
  assert.equal(JSON.stringify([row, profile]), before)
})
