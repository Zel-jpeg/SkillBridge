import test from 'node:test'
import assert from 'node:assert/strict'
import { schoolDashboardCards, schoolOrganizationRows, schoolReportLink } from './schoolOverview.js'

const options = { institutes: [{ id: 1 }, { id: 2 }, { id: 3 }], programs: [{ id: 11, institute_id: 1 }, { id: 21, institute_id: 2 }, { id: 22, institute_id: 2 }] }
const data = { scope: { batch_ids: [1, 2, 3] }, options: { batches: [{ id: 1, institute_id: 1, program_id: null }, { id: 2, institute_id: 2, program_id: 21 }, { id: 3, institute_id: 2, program_id: 22 }] },
  students: [{ id: 1, batch_id: 1, required_complete: false, placement_status: 'unplaced' }, { id: 2, batch_id: 2, required_complete: true, placement_status: 'approved' }, { id: 3, batch_id: 3, required_complete: true, placement_status: 'unplaced' }] }
test('institute metrics partition the server distinct cohort and preserve empty institutes', () => {
  const { rows, sharedStudents } = schoolOrganizationRows(data, options)
  assert.deepEqual(rows.map(row => [row.students, row.complete, row.approved]), [[1, 0, 0], [2, 2, 1], [0, 0, 0]])
  assert.equal(rows.reduce((count, row) => count + row.students, 0), data.students.length)
  assert.equal(sharedStudents, 0)
})
test('program metrics preserve recorded batch identity and expose shared institute students', () => {
  const first = schoolOrganizationRows({ ...data, students: [data.students[0]] }, options, '1')
  assert.equal(first.sharedStudents, 1)
  assert.equal(first.rows[0].students, 0)
  const second = schoolOrganizationRows({ ...data, students: data.students.slice(1) }, options, '2')
  assert.deepEqual(second.rows.map(row => row.students), [1, 1])
})
test('summary and record links retain institute/program/status and supported group identities', () => {
  const scope = { institute: '2', program: '21', status: 'archived' }
  const link = new URL(schoolReportLink(scope, 'skills', 'skill:19'), 'http://fixture.invalid')
  assert.equal(link.searchParams.get('institute_id'), '2')
  assert.equal(link.searchParams.get('program_id'), '21')
  assert.equal(link.searchParams.get('batch_status'), 'archived')
  assert.equal(link.searchParams.get('group'), 'skill:19')
  const cards = schoolDashboardCards({ summary: { students: 0, required_complete: 0, awaiting_review: 0, approved: 0, slots_remaining: 4, completion_rate: null, placement_rate: null } }, scope)
  assert.equal(cards[0].label, 'Students in archived batches')
  assert.equal(cards[1].description, 'No students in scope')
  assert.equal(cards[4].value, 4)
  assert.equal(new URL(cards[4].to, 'http://fixture.invalid').searchParams.get('group'), 'capacity')
})
