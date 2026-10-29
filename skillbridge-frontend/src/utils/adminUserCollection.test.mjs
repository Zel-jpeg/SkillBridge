import test from 'node:test'
import assert from 'node:assert/strict'
import { filterAdminUsers } from './adminUserCollection.js'

const students = [
  { id: 1, name: 'Sample One', studentId: 'QA-1', email: 'one@example.invalid', archived: false, course: 'BSIT', instructor: 'Coordinator A', status: 'completed', match: 80 },
  { id: 2, name: 'Sample Two', archived: false, course: 'BSIS', instructor: 'Coordinator B', status: 'pending', match: 0 },
  { id: 3, name: 'Archived Student', archived: true, course: 'BSIT', instructor: 'Coordinator A', status: 'stopped' },
]
const instructors = [{ id: 4, name: 'Coordinator A', archived: false }, { id: 5, name: 'Archived Coordinator', archived: true }]
const pending = [{ id: 6, name: 'Pending Coordinator' }]
const defaults = { search: '', filterStatus: 'all', filterCourse: 'all', filterInstructor: 'all' }
const records = (tab, filters = {}, sortCol, sortDir) => filterAdminUsers({ tab, students, instructors, pending, filters: { ...defaults, ...filters }, sortCol, sortDir }).map(user => user.id)

test('student preview and applied collection intersect all existing filters and trimmed identity search', () => {
  assert.deepEqual(records('students', { filterStatus: 'completed', filterCourse: 'BSIT', filterInstructor: 'Coordinator A', search: '  QA-1  ' }), [1])
  assert.deepEqual(records('students', { filterCourse: 'BSIS', filterInstructor: 'Coordinator A' }), [])
  assert.deepEqual(records('students', { search: 'ONE@EXAMPLE.INVALID' }), [1])
})

test('role tabs retain active/archive boundaries and do not apply hidden student filters', () => {
  assert.deepEqual(records('all', { filterCourse: 'BSIS' }), [4, 1, 2])
  assert.deepEqual(records('instructors', { filterStatus: 'completed' }), [4])
  assert.deepEqual(records('archived'), [5, 3])
  assert.deepEqual(records('pending', { search: 'unrelated' }), [6])
})

test('sorting preserves zero matches and never mutates input collections', () => {
  const before = JSON.stringify(students)
  assert.deepEqual(records('students', {}, 'match', 'asc'), [2, 1])
  assert.deepEqual(records('students', {}, 'name', 'desc'), [2, 1])
  assert.equal(JSON.stringify(students), before)
})
