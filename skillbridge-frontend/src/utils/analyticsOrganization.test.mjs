import test from 'node:test'
import assert from 'node:assert/strict'
import { organizationComparison, analyticsScopeText } from './analyticsOrganization.js'
import { analyticsTable, analyticsFilterText, analyticsCsv } from './analytics.js'

const data = { scope: { batch_ids: [10, 20], batch_status: 'active', institute_id: null, program_id: null },
  options: { institutes: [{ id: 1, name: 'Computing' }, { id: 2, name: 'Empty institute' }], programs: [{ id: 11, institute_id: 1, name: 'Technology' }],
    batches: [{ id: 10, institute_id: 1, program_id: 11, name: 'Program batch' }, { id: 20, institute_id: 1, program_id: null, name: 'Shared batch' }] },
  students: [{ id: 1, batch_id: 10, required_complete: true, placement_status: 'approved' }, { id: 2, batch_id: 20, required_complete: false, placement_status: 'unplaced' }] }
test('organization comparisons partition the distinct cohort with explicit zero-cohort rates', () => {
  const rows = organizationComparison(data)
  assert.deepEqual(rows.map(row => [row.students, row.completionRate, row.placementRate]), [[2, 50, 50], [0, null, null]])
  assert.equal(rows.reduce((sum, row) => sum + row.students, 0), data.students.length)
  const scoped = organizationComparison({ ...data, scope: { ...data.scope, institute_id: 1 } })
  assert.equal(scoped[0].students, 1)
  assert.equal(scoped[1].name, 'Shared institute batches')
  assert.equal(scoped[1].students, 1)
  assert.equal(scoped[1].completionRate, 0)
})
test('comparison record search/export preserve rows, denominators and missing rates', () => {
  const table = analyticsTable(data, 'assessments', 'organizations', [], 'Empty')
  assert.deepEqual(table.rows, [['Empty institute', 0, 0, null, 0, null]])
  assert.match(analyticsCsv(table, { Unit: 'Distinct students' }), /Empty institute/)
  assert.equal(organizationComparison({ ...data, scope: { ...data.scope, program_id: 11 } }).length, 0)
})
test('empty configured scope names remain explicit and missing identities never say All', () => {
  const scoped = { ...data, scope: { ...data.scope, institute_id: 2, batch_ids: [] } }
  assert.match(analyticsScopeText(scoped), /Institute: Empty institute/)
  assert.match(analyticsFilterText(scoped), /Institute: Empty institute/)
  const unavailable = { ...scoped, scope: { ...scoped.scope, institute_id: 999 } }
  assert.match(analyticsScopeText(unavailable), /Unavailable institute \(999\)/)
  assert.match(analyticsFilterText(unavailable), /Institute: Unavailable \(999\)/)
})
test('large visible scopes stay compact while exports retain every batch name and instructor', () => {
  const scoped = { ...data, scope: { ...data.scope, batch_ids: [10, 20, 30, 40], instructor_id: 9 },
    options: { ...data.options, instructors: [{ id: 9, name: 'Assigned coordinator' }] } }
  assert.match(analyticsScopeText(scoped, true), /Batches: 4 selected batches/)
  assert.match(analyticsScopeText(scoped), /Program batch, Shared batch, 30, 40/)
  assert.match(analyticsScopeText(scoped, true), /instructor: Assigned coordinator/)
})
test('program snapshots disclose full shared rosters and overlapping views without changing rows', () => {
  const scoped = { ...data, scope: { ...data.scope, program_id: 11, shared_batch_ids: [20] } }
  assert.match(analyticsScopeText(scoped), /shared institute batches with full rosters; program views can overlap/)
  assert.equal(scoped.students.length, 2)
})
