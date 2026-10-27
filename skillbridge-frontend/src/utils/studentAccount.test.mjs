import test from 'node:test'
import assert from 'node:assert/strict'
import { matchesAccount } from './studentAccount.js'
import { normalizeStudent } from './managementStudent.js'

test('account archive filtering is independent from required completion and membership', () => {
  const record = normalizeStudent({ id: 4, name: 'Synthetic', is_active: false, historical_evidence: true,
    all_required_completed: true, recommendations_locked: true })
  assert.equal(record.archived, true)
  assert.equal(record.historicalEvidence, true)
  assert.equal(record.status, 'completed')
  assert.equal(record.recommendationsLocked, true)
  assert.equal(matchesAccount(record, 'archived'), true)
  assert.equal(matchesAccount(record, 'active'), false)
  assert.equal(matchesAccount(record, 'all'), true)
})
