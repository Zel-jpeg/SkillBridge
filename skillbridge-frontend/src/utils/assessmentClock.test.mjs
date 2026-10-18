import test from 'node:test'
import assert from 'node:assert/strict'
import { remainingAttemptSeconds } from './assessmentClock.js'

test('countdown accounts for suspended callbacks and never extends via a wall-clock change', () => {
  const deadline = 61000
  assert.equal(remainingAttemptSeconds(deadline, 1000), 60)
  assert.equal(remainingAttemptSeconds(deadline, 20500), 41)
  // A delayed callback jumps to the actual monotonic time, rather than one tick.
  assert.equal(remainingAttemptSeconds(deadline, 61000), 0)
  assert.equal(remainingAttemptSeconds(deadline, 91000), 0)
})
