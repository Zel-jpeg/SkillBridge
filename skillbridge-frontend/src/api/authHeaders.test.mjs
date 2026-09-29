import test from 'node:test'
import assert from 'node:assert/strict'
import { isAuthenticationRequest } from './authHeaders.js'

test('authentication requests do not inherit a stale access token', () => {
  for (const path of ['/api/auth/login/', '/api/auth/google/', '/api/auth/refresh/', '/api/auth/login/?next=1']) {
    assert.equal(isAuthenticationRequest(path), true)
  }
  for (const path of ['/api/auth/me/', '/api/assessments/', '/api/auth/login-extra/']) {
    assert.equal(isAuthenticationRequest(path), false)
  }
})
