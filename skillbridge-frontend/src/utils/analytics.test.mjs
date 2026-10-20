import test from 'node:test'
import assert from 'node:assert/strict'
import { analyticsCards, analyticsCsv, analyticsTable, analyticsUrl, selectAnalyticsStudents } from './analytics.js'

const student = (id, overrides = {}) => ({ id, name: `Synthetic ${id}`, school_id: `SYN-${id}`, course: 'BSIT', batch: 'Cohort', batch_id: 1, instructor: 'Owner', required_completed: 1, required_total: 1, required_complete: true, reasons: [], placement_status: 'unplaced', recommendations_locked: false, awaiting_review: false, match_band: 'Low', top_match: 0, scores: { 1: 0 }, attempt_states: { 2: 'submitted' }, ...overrides })
const data = { summary: { students: 2, required_complete: 2, completion_rate: 100, approved: 1, unplaced: 1, approved_other_batch: 0, awaiting_review: 1, needs_followup: 1, slots_remaining: 3 }, students: [student(1), student(2, { reasons: ['Stopped / flagged'], placement_status: 'approved', awaiting_review: true, scores: {} })], placement_students: [], skills: [{ id: 1, name: 'Web', sample: 1, missing: 1, needs_work: 1, strong: 0, fair: 0, average: 0 }], assessments: [], activity: [{ date: '2026-10-20', submissions: 0 }], capacity: [{ company: 'Agency', name: 'Intern', area: 'City', total: 5, occupied: 2, remaining: 3 }] }

test('role-specific dashboard cards have useful scoped destinations and honest zero values', () => {
  const admin = analyticsCards(data, 'admin')
  const instructor = analyticsCards(data, 'instructor')
  assert.equal(admin.length, 5)
  assert.equal(instructor.length, 4)
  assert.match(admin.at(-1).to, /group=capacity/)
  assert.match(instructor[2].to, /group=followup/)
  assert.equal(admin[0].value, 2)
  assert.equal(instructor[3].value, '1 / 2')
})

test('chart selections filter the same authorized records, missing skills never become zero', () => {
  assert.deepEqual(selectAnalyticsStudents(data, 'skills', 'skill:1:needs_work').map(row => row.id), [1])
  assert.deepEqual(selectAnalyticsStudents(data, 'assessments', 'reason:Stopped / flagged').map(row => row.id), [2])
  assert.equal(selectAnalyticsStudents(data, 'assessments', 'followup').length, 1)
  assert.equal(selectAnalyticsStudents(data, 'assessments', 'attempt:2:submitted').length, 2)
  assert.equal(selectAnalyticsStudents(data, 'assessments', '', 'SYN-1').length, 1)
  assert.equal(selectAnalyticsStudents(data, 'placements', '').length, 0)
})

test('chart navigation fields never enter API query filters', () => {
  assert.equal(analyticsUrl(new URLSearchParams('tab=skills&group=capacity&batch_id=3&course=BSIT')), '/api/management/analytics/?batch_id=3&course=BSIT')
})

test('snapshot export tables retain all filtered rows, raw zero, missing evidence and metadata', () => {
  const table = analyticsTable(data, 'skills', '', data.students)
  assert.equal(table.rows.length, 2)
  assert.equal(table.rows[0].at(-1), 0)
  assert.equal(table.rows[1].at(-1), null)
  const recommendationStudent = student(3, { top_position: 'Synthetic Developer Intern', top_company: 'Synthetic Agency' })
  const recommendations = analyticsTable(data, 'assessments', '', [recommendationStudent])
  assert.equal(recommendations.rows[0][12], 'Synthetic Developer Intern')
  assert.equal(recommendations.rows[0][13], 'Synthetic Agency')
  assert.deepEqual(recommendations.columns.slice(12), ['Top recommended position', 'Top recommended company'])
  const csv = analyticsCsv({ title: 'Snapshot', columns: ['Name', 'Score'], rows: [[' \t=FORMULA()', 0], ['\u0000+FORMULA()', null]] }, { Scope: 'Cohort 1' })
  assert.ok(csv.includes('Scope'))
  assert.ok(csv.includes("' \t=FORMULA()"))
  assert.ok(csv.includes("'\u0000+FORMULA()"))
  assert.ok(csv.includes('"0"'))
  assert.equal(analyticsTable(data, 'placements', 'capacity', []).rows[0].at(-1), 3)
})
