import test from 'node:test'
import assert from 'node:assert/strict'
import { nlpComparisonErrorMessage, waitForComparisonPoll } from './nlpComparison.js'
import { sanitizeApiError } from './requestErrors.js'

test('comparison identifies sanitized Axios timeouts and offers to reconnect', () => {
  for (const code of ['ECONNABORTED', 'ETIMEDOUT']) {
    const error = { code, config: { method: 'post' } }
    sanitizeApiError(error)
    assert.match(nlpComparisonErrorMessage(error), /request timed out/)
    assert.match(nlpComparisonErrorMessage(error), /reconnect to an active job/)
  }
})

test('comparison distinguishes network, authentication and safe server failures', () => {
  assert.match(nlpComparisonErrorMessage({ code: 'ERR_NETWORK' }), /Could not reach the comparison service/)
  assert.match(nlpComparisonErrorMessage({ response: { status: 401, data: {} } }), /sign in again/)
  assert.equal(nlpComparisonErrorMessage({ response: { status: 500, data: { error: 'private traceback' } } }),
    'Server error. Please try again in a moment.')
  assert.equal(nlpComparisonErrorMessage({ response: { status: 400, data: { error: { private: 'detail' } } } }),
    'Invalid request. Please check your input.')
})

test('closing the view stops its pending polling delay', async () => {
  const controller = new AbortController()
  const delay = waitForComparisonPoll(controller.signal)
  controller.abort()
  await assert.rejects(delay, { name: 'AbortError' })
})
