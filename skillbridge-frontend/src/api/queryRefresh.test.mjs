import test from 'node:test'
import assert from 'node:assert/strict'
import { startVisibleRefresh } from './queryRefresh.js'

function target() {
  const listeners = new Map()
  return {
    addEventListener(name, callback) { listeners.set(name, callback) },
    removeEventListener(name) { listeners.delete(name) },
    dispatch(name) { listeners.get(name)?.() },
  }
}

test('mounted query refreshes every interval only while visible and on return', () => {
  const documentTarget = { ...target(), visibilityState: 'visible' }
  const windowTarget = {
    ...target(),
    setInterval(callback, interval) { assert.equal(interval, 30_000); this.tick = callback; return 1 },
    clearInterval() { this.tick = null },
  }
  let now = 0
  let fetchedAt = 0
  const calls = []
  const stop = startVisibleRefresh('/api/assessments/', {
    documentTarget, windowTarget,
    read: () => ({ fetchedAt }),
    revalidate: url => { calls.push(url); fetchedAt = now },
    now: () => now,
  })
  now = 30_000
  windowTarget.tick()
  assert.deepEqual(calls, ['/api/assessments/'])
  documentTarget.visibilityState = 'hidden'
  now = 60_000
  windowTarget.tick()
  assert.equal(calls.length, 1)
  documentTarget.visibilityState = 'visible'
  documentTarget.dispatch('visibilitychange')
  windowTarget.dispatch('focus')
  assert.equal(calls.length, 2) // Focus inside five seconds does not burst.
  stop()
  assert.equal(windowTarget.tick, null)
})
