import test from 'node:test'
import assert from 'node:assert/strict'
import { waitForDashboard, DASHBOARD_READY_BUDGET_MS } from './dashboardReadiness.js'
import { createCacheStore } from './cacheStore.js'

const tick = async () => { for (let index = 0; index < 15; index++) await Promise.resolve() }
function deferred() {
  let resolve, reject
  const promise = new Promise((yes, no) => { resolve = yes; reject = no })
  return { promise, resolve, reject }
}
function clock() {
  let timeout, budget, cleared = 0
  return { setTimer(fn, ms) { timeout = fn; budget = ms; return 1 },
    clearTimer() { cleared++; timeout = null }, expire() { timeout?.() },
    get budget() { return budget }, get cleared() { return cleared } }
}

test('dashboard code and data start together and hand off immediately when ready', async () => {
  const code = deferred(), data = deferred(), calls = [], timers = clock()
  const result = waitForDashboard({ ...timers,
    loadCode: () => { calls.push('code'); return code.promise },
    loadData: () => { calls.push('data'); return data.promise },
  })
  assert.deepEqual(calls, ['code', 'data'])
  assert.equal(timers.budget, DASHBOARD_READY_BUDGET_MS)
  data.resolve(); code.resolve()
  assert.deepEqual(await result, { reason: 'ready' })
  assert.equal(timers.cleared, 1)
})

test('deadline opens the dashboard without aborting or duplicating its slow shared GET', async () => {
  const read = deferred(), timers = clock()
  let calls = 0
  const cache = createCacheStore(() => { calls++; return read.promise }, undefined, () => 'admin:1')
  let initial
  const readiness = waitForDashboard({ ...timers, loadCode: async () => {}, loadData: () => {
    initial = cache.fetch('/dashboard'); return initial
  } })
  timers.expire()
  assert.deepEqual(await readiness, { reason: 'timeout' })
  const unsubscribe = cache.subscribe('/dashboard', () => {})
  const adopted = cache.fetch('/dashboard')
  assert.equal(adopted, initial)
  read.resolve({ data: [] }); await adopted
  assert.deepEqual(cache.read('/dashboard').data, [])
  assert.equal(calls, 1)
  unsubscribe()
})

test('initial read failures release to section recovery instead of failing authentication', async () => {
  const timers = clock()
  const result = await waitForDashboard({ ...timers, loadCode: async () => {},
    loadData: async () => { throw Error('unavailable') } })
  assert.equal(result.reason, 'partial')
  assert.equal(timers.cleared, 1)
})

test('an already cancelled login does not start preparation', async () => {
  const controller = new AbortController(); controller.abort()
  const never = () => { throw Error('Must not start') }
  assert.equal((await waitForDashboard({ signal: controller.signal, loadCode: never, loadData: never })).reason, 'cancelled')
})

test('unmount/session expiry cancels the handoff and clears its deadline', async () => {
  const controller = new AbortController(), data = deferred(), timers = clock()
  const result = waitForDashboard({ ...timers, signal: controller.signal, loadCode: async () => {}, loadData: () => data.promise })
  controller.abort()
  assert.equal((await result).reason, 'cancelled')
  assert.equal(timers.cleared, 1)
  data.resolve(); await tick()
})

test('a different account cannot complete an older login handoff', async () => {
  let current = true
  const data = deferred(), timers = clock()
  const result = waitForDashboard({ ...timers, isCurrent: () => current, loadCode: async () => {}, loadData: () => data.promise })
  current = false; data.resolve()
  assert.equal((await result).reason, 'cancelled')
})

test('synchronous preparation errors still resolve to a recoverable handoff', async () => {
  const timers = clock()
  assert.equal((await waitForDashboard({ ...timers, loadCode: () => { throw Error('chunk unavailable') }, loadData: async () => {} })).reason, 'partial')
})
