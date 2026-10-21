import test from 'node:test'
import assert from 'node:assert/strict'
import { validateApiResponse } from './responseContract.js'
import { requestErrorMessage, sanitizeApiError } from './requestErrors.js'

test('shared draft envelopes are validated before rendering or confirming a save', () => {
  const data = { revision: 0, generated: false, stale: false, proposed_counts: {}, students: [] }
  for (const method of ['get', 'post']) {
    const config = { url: '/api/placements/draft/', method }
    assert.equal(validateApiResponse({ data, config, status: 200 }).data, data)
    assert.throws(() => validateApiResponse({ data: { ...data, students: {} }, config, status: 200 }), { code: 'ERR_BAD_RESPONSE' })
  }
})

test('admin ownership choices, action history and batch mutation envelopes reject malformed data', () => {
  const cases = [
    ['/api/admin/batch-instructors/', 'get', {}, [{ id: 2, name: 'Synthetic Instructor' }]],
    ['/api/admin/management-actions/?batch_id=3', 'get', { count: 2, results: {} }, { count: 1, results: [{ id: 1, action: 'batch.create', actor_name: 'Synthetic Admin' }] }],
    ['/api/admin/batches/3/', 'patch', { id: 3, name: 'Batch', instructor_id: null }, { id: 3, name: 'Batch', instructor_id: 2 }],
  ]
  for (const [url, method, invalid, valid] of cases) {
    assert.throws(() => validateApiResponse({ data: invalid, status: 200, config: { url, method } }), { code: 'ERR_BAD_RESPONSE' })
    const response = { data: valid, status: 200, config: { url, method } }
    assert.equal(validateApiResponse(response), response)
  }
})

test('invalid collection/profile/results responses are rejected before publication; downloads remain usable', () => {
  for (const [url, data] of [['/api/categories/', {}], ['/api/students/me/', []],
    ['/api/student/results/combined/', { recommendations_locked: false, recommendations: {}, combined_category_scores: [] }],
    ['/api/admin/companies/', [{ id: 1, name: 'Company', positions: null }]], ['/api/unmapped/', '<html>bad proxy</html>']]) {
    assert.throws(() => validateApiResponse({ data, status: 200, config: { url } }), { code: 'ERR_BAD_RESPONSE' })
  }
  const download = { data: 'csv bytes', status: 200, config: { responseType: 'blob' } }
  assert.equal(validateApiResponse(download), download)
  const valid = { data: { recommendations_locked: true, recommendations: [], combined_category_scores: [] },
    status: 200, config: { url: '/api/student/results/combined/' } }
  assert.equal(validateApiResponse(valid), valid)
  const users = { data: { students: [], instructors: [], pending_instructors: [] },
    status: 200, config: { url: '/api/admin/users/' } }
  assert.equal(validateApiResponse(users), users)
})

test('unconfirmed mutation response has a distinct safe message, not a success or blind replay', () => {
  try { validateApiResponse({ data: {}, status: 201, config: { method: 'post', url: '/api/instructor/assessments/' } }) }
  catch (error) { assert.match(requestErrorMessage(error, { mutation: true }), /Refresh the current records/) }
  assert.match(requestErrorMessage({ code: 'ECONNABORTED' }, { mutation: true }), /could not be confirmed/)
})

test('error payload objects/HTML and internal 500 details do not become UI content', () => {
  for (const data of [{ error: { secret: 'synthetic-private' } }, { detail: ['synthetic-private'] }, { error: '<html>synthetic-private</html>' }]) {
    assert.equal(requestErrorMessage({ response: { status: 400, data } }), 'Invalid request. Please check your input.')
  }
  assert.equal(requestErrorMessage({ response: { status: 500, data: { error: 'synthetic-private SQL detail' } } }), 'Server error. Please try again in a moment.')
  for (const status of [401, 403, 404, 409, 413, 429, 503]) assert.equal(typeof requestErrorMessage({ response: { status } }), 'string')
  const sanitized = sanitizeApiError({ config: { method: 'post' }, response: { status: 400, data: { error: { private: 'synthetic' } } } })
  assert.equal(sanitized.response.data.error, 'Invalid request. Please check your input.')
})
