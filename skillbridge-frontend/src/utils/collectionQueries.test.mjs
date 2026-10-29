import test from 'node:test'
import assert from 'node:assert/strict'
import { adminUsersUrl, rosterUrl } from './collectionQueries.js'

test('admin list and count preview share encoded filters and stable defaults', () => {
  assert.equal(adminUsersUrl(), '/api/admin/users/?page=1&tab=students&sort=name&direction=asc')
  const result = new URL(adminUsersUrl({ page: 3, filterInstructor: 'A & B', search: '  DB-01 ', filterStatus: 'stopped', filterCourse: 'BSIT', countsOnly: true }), 'https://example.invalid')
  assert.equal(result.searchParams.get('instructor'), 'A & B')
  assert.equal(result.searchParams.get('search'), 'DB-01')
  assert.equal(result.searchParams.get('page'), '3')
  assert.equal(result.searchParams.get('counts_only'), '1')
})

test('roster variants preserve scope and combine all filter dimensions', () => {
  assert.equal(rosterUrl(null), null)
  assert.equal(rosterUrl(7), '/api/instructor/batches/7/students/?page=1')
  const result = new URL(rosterUrl(7, { page: 2, search: ' Person ', course: 'BSIS', accountStatus: 'archived', assessmentStatus: 'retake', recommendationStatus: 'approved' }), 'https://example.invalid')
  assert.deepEqual(Object.fromEntries(result.searchParams), {
    page: '2', search: 'Person', course: 'BSIS', account: 'archived', assessment: 'retake', recommendation: 'approved',
  })
})
