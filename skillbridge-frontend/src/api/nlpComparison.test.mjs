import test from 'node:test'
import assert from 'node:assert/strict'
import { NLP_COMPARISON_TIMEOUT_MS, nlpComparisonErrorMessage } from './nlpComparison.js'
import { sanitizeApiError } from './requestErrors.js'

test('comparison allows a cold Stanza run and identifies sanitized Axios timeouts', () => {
  assert.equal(NLP_COMPARISON_TIMEOUT_MS, 300000)
  for (const code of ['ECONNABORTED', 'ETIMEDOUT']) {
    const error = { code, config: { method: 'post' } }
    sanitizeApiError(error)
    assert.match(nlpComparisonErrorMessage(error), /timed out after five minutes/)
    assert.match(nlpComparisonErrorMessage(error), /may still be evaluating/)
    assert.doesNotMatch(nlpComparisonErrorMessage(error), /save|connection/i)
  }
})

test('comparison distinguishes network, authentication and safe server failures', () => {
  assert.match(nlpComparisonErrorMessage({ code: 'ERR_NETWORK' }), /Django server is running/)
  assert.match(nlpComparisonErrorMessage({ response: { status: 401, data: {} } }), /sign in again/)
  assert.equal(nlpComparisonErrorMessage({ response: { status: 500, data: { error: 'private traceback' } } }),
    'Server error. Please try again in a moment.')
  assert.equal(nlpComparisonErrorMessage({ response: { status: 400, data: { error: { private: 'detail' } } } }),
    'Invalid request. Please check your input.')
})
