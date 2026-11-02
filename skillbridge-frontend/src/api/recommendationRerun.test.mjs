import test from 'node:test'
import assert from 'node:assert/strict'
import { recommendationRerunError, rerunRecommendations, RECOMMENDATION_RERUN_TIMEOUT_MS } from './recommendationRerun.js'
import { sanitizeApiError } from './requestErrors.js'

const success = { data: { ok: true, students_processed: 2, errors: 0 } }
const deferred = () => {
  let resolve, reject
  const promise = new Promise((yes, no) => { resolve = yes; reject = no })
  return { promise, resolve, reject }
}

test('concurrent admin entry points share one pending rerun with the two-minute limit', async () => {
  const completion = deferred(), calls = []
  const client = { post: (...args) => { calls.push(args); return completion.promise } }
  const dashboard = rerunRecommendations(client, 'session-a')
  const settings = rerunRecommendations(client, 'session-a')
  assert.equal(dashboard, settings)
  assert.equal(calls.length, 1)
  assert.equal(RECOMMENDATION_RERUN_TIMEOUT_MS, 120000)
  assert.deepEqual(calls[0], ['/api/admin/rerun-recommendations/', {}, { timeout: 120000 }])
  completion.resolve(success)
  assert.deepEqual(await dashboard, { state: 'complete', type: 'success', refresh: true, message: 'Recommendations refreshed for 2 students.' })
})

test('partial processing errors are visible as a warning rather than full success', async () => {
  const result = await rerunRecommendations({ post: async () => ({ data: { ok: true, students_processed: 1, errors: 2 } }) })
  assert.equal(result.state, 'partial')
  assert.equal(result.type, 'warning')
  assert.equal(result.refresh, true)
  assert.match(result.message, /1 student; 2 processing errors were reported/)
})

test('sanitized Axios timeouts remain uncertain and never claim that calculation failed', () => {
  for (const code of ['ECONNABORTED', 'ETIMEDOUT']) {
    const error = { code, config: { method: 'post' } }
    sanitizeApiError(error)
    const result = recommendationRerunError(error)
    assert.equal(result.type, 'warning')
    assert.equal(result.refresh, true)
    assert.match(result.message, /longer than two minutes/)
    assert.match(result.message, /server may still be working/)
    assert.doesNotMatch(result.message, /rerun failed|try again immediately/i)
  }
})

test('lost responses and server errors permit saved results without claiming full success or exposing details', () => {
  for (const error of [{ code: 'ERR_NETWORK' }, ...[408, 500, 502, 503, 504].map(status => ({ response: { status, data: { error: 'private traceback' } } }))]) {
    const result = recommendationRerunError(error)
    assert.equal(result.state, 'uncertain')
    assert.equal(result.type, 'warning')
    assert.match(result.message, /Some results may still update/)
    assert.doesNotMatch(result.message, /private traceback/)
  }
})

test('confirmed authorization rejection and stale sessions are distinct from uncertain completion', () => {
  assert.deepEqual(recommendationRerunError({ response: { status: 403, data: {} } }), {
    state: 'rejected', type: 'error', refresh: false, message: 'You do not have permission to do that.',
  })
  assert.deepEqual(recommendationRerunError({ staleIdentity: true }), { state: 'cancelled', refresh: false })
})

test('an uncertain request is never replayed automatically; a later deliberate action is separate', async () => {
  let calls = 0
  const client = { post: async () => { calls++; throw { code: 'ECONNABORTED' } } }
  assert.equal((await rerunRecommendations(client, 'session-a')).state, 'uncertain')
  await new Promise(resolve => setImmediate(resolve))
  assert.equal(calls, 1)
  await rerunRecommendations(client, 'session-a')
  assert.equal(calls, 2)
})

test('different authenticated sessions never share a previous response or lose their pending guard', async () => {
  const first = deferred(), second = deferred()
  let calls = 0
  const client = { post: () => (++calls === 1 ? first : second).promise }
  const oldSession = rerunRecommendations(client, 'old-session')
  const newSession = rerunRecommendations(client, 'new-session')
  assert.notEqual(oldSession, newSession)
  first.resolve(success); await oldSession
  assert.equal(rerunRecommendations(client, 'new-session'), newSession)
  assert.equal(calls, 2)
  second.resolve(success); await newSession
})

test('malformed success payloads cannot produce a confirmed completion message; a valid zero remains zero', async () => {
  for (const data of [{}, { ok: false }, { ok: true, students_processed: 2, errors: -1 }, { ok: true, students_processed: NaN, errors: 0 }]) {
    assert.equal((await rerunRecommendations({ post: async () => ({ data }) })).state, 'uncertain')
  }
  const result = await rerunRecommendations({ post: async () => ({ data: { ok: true, students_processed: 0, errors: 0 } }) })
  assert.equal(result.state, 'complete')
  assert.equal(result.message, 'Recommendations refreshed for 0 students.')
})
