import test from 'node:test'
import assert from 'node:assert/strict'
import { DEFAULT_ROSTER_FILTERS, filterPreviouslyUnenrolled, filterRosterStudents, rosterFilterCount } from './studentRosterFilters.js'

const rows = [
  { id: 1, allRequiredCompleted: true, recommendationsLocked: false, top_recommendations: [{ id: 1 }] },
  { id: 2, allRequiredCompleted: false, recommendationsLocked: true },
  { id: 3, allRequiredCompleted: true, recommendationsLocked: false, top_recommendations: [{ id: 3 }], placement: { status: 'approved' } },
  { id: 4, allRequiredCompleted: true, status: 'stopped', recommendationsLocked: false, top_recommendations: [{ id: 4 }], course: 'BSIS' },
  { id: 5, allRequiredCompleted: false, status: 'stopped', recommendationsLocked: true, assessmentResults: [{ retake_allowed: true }] },
  { id: 6, allRequiredCompleted: true, recommendationsLocked: true, top_recommendations: [{ id: 6 }] },
  { id: 7, allRequiredCompleted: true, recommendationsLocked: false },
  { id: 8, allRequiredCompleted: true, recommendationsLocked: true, archived: true },
].map(row => ({ name: `Sample Student ${row.id}`, studentId: `QA-${row.id}`, email: `sample${row.id}@example.invalid`,
  archived: false, course: 'BSIT', assessmentResults: [], top_recommendations: [], placement: { status: 'unplaced' }, ...row }))
const ids = options => filterRosterStudents(rows, options).map(row => row.id)

test('assessment and recommendation filters intersect without treating an approval as assessment completion', () => {
  assert.deepEqual(ids({ assessmentStatus: 'complete', recommendationStatus: 'awaiting' }), [1, 4])
  assert.deepEqual(ids({ assessmentStatus: 'incomplete', recommendationStatus: 'available' }), [])
  assert.deepEqual(ids({ assessmentStatus: 'complete', recommendationStatus: 'approved' }), [3])
})

test('available means actual unlocked matches; stale and empty results remain excluded', () => {
  assert.deepEqual(ids({ recommendationStatus: 'available' }), [1, 3, 4])
  assert.deepEqual(ids({ recommendationStatus: 'awaiting' }), [1, 4])
})

test('a flagged optional attempt can coexist with completed required work and current recommendations', () => {
  assert.deepEqual(ids({ assessmentStatus: 'stopped' }), [4, 5])
  assert.deepEqual(ids({ assessmentStatus: 'stopped', recommendationStatus: 'available' }), [4])
  assert.deepEqual(ids({ assessmentStatus: 'retake' }), [5])
})

test('course, account and trimmed case-insensitive identity search combine with both status dimensions', () => {
  assert.deepEqual(ids({ assessmentStatus: 'complete', recommendationStatus: 'available', course: 'BSIS' }), [4])
  assert.deepEqual(ids({ accountStatus: 'archived', assessmentStatus: 'complete' }), [8])
  for (const search of ['  qa-4  ', 'SAMPLE4@EXAMPLE.INVALID', 'Student 4']) {
    assert.deepEqual(ids({ search, assessmentStatus: 'complete', recommendationStatus: 'awaiting' }), [4])
  }
})

test('current approvals outside the displayed decision block the awaiting-review category', () => {
  const held = { ...rows[0], hasCurrentApproval: true }
  assert.deepEqual(filterRosterStudents([held], { recommendationStatus: 'awaiting' }), [])
})

test('filtering preserves roster order and source evidence; resetting all returns every record', () => {
  const before = JSON.stringify(rows)
  assert.deepEqual(ids({}), [1, 2, 3, 4, 5, 6, 7, 8])
  ids({ assessmentStatus: 'complete', recommendationStatus: 'awaiting' })
  assert.equal(JSON.stringify(rows), before)
})

test('the filter badge counts nondefault groups while search stays independently visible', () => {
  assert.equal(rosterFilterCount(DEFAULT_ROSTER_FILTERS), 0)
  assert.equal(rosterFilterCount({ ...DEFAULT_ROSTER_FILTERS, search: 'Sample', course: 'BSIT', recommendationStatus: 'available' }), 2)
  assert.equal(rosterFilterCount({ ...DEFAULT_ROSTER_FILTERS, enrollment: 'unenrolled', accountStatus: 'archived' }), 2)
})

test('previous-enrollment previews and records share course, account and identity matching', () => {
  const previous = [
    { id: 11, name: 'Former Student', school_id: 'PRE-011', email: 'former@example.invalid', course: 'BSIT', is_active: true },
    { id: 12, name: 'Former Student Two', school_id: 'PRE-012', email: 'archived@example.invalid', course: 'BSIS', is_active: false },
  ]
  const before = JSON.stringify(previous)
  assert.deepEqual(filterPreviouslyUnenrolled(previous, { course: 'BSIS', accountStatus: 'archived', search: '  PRE-012  ' }).map(row => row.id), [12])
  assert.deepEqual(filterPreviouslyUnenrolled(previous, { accountStatus: 'active', search: 'FORMER@EXAMPLE.INVALID' }).map(row => row.id), [11])
  assert.deepEqual(filterPreviouslyUnenrolled(previous, { accountStatus: 'active', course: 'BSIS' }), [])
  assert.equal(JSON.stringify(previous), before)
})
