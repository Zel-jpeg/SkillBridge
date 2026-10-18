import test from 'node:test'
import assert from 'node:assert/strict'
import { createCacheStore } from './cacheStore.js'
import { validateApiResponse } from './responseContract.js'

function storage() {
  const values = {}
  return Object.defineProperties(values, {
    getItem: { value: key => values[key] ?? null },
    setItem: { value: (key, value) => { values[key] = value } },
    removeItem: { value: key => { delete values[key] } },
  })
}

function deferred() {
  let resolve, reject
  const promise = new Promise((yes, no) => { resolve = yes; reject = no })
  return { promise, resolve, reject }
}

test('malformed persistent API data is ignored and replaced by a valid fresh read', async () => {
  const session = storage()
  session.setItem('sb_api_owner', 'student:1')
  session.setItem('sb_api_/api/student/results/combined/', JSON.stringify({ fetchedAt: Date.now(), data: { recommendations: {} } }))
  const valid = { recommendations_locked: true, recommendations: [], combined_category_scores: [] }
  let calls = 0
  const cache = createCacheStore(async () => { calls++; return { data: valid } }, session, () => 'student:1',
    (url, data) => validateApiResponse({ data, status: 200, config: { url } }))
  assert.equal(cache.read('/api/student/results/combined/'), null)
  await cache.fetch('/api/student/results/combined/')
  assert.equal(calls, 1)
  assert.deepEqual(cache.read('/api/student/results/combined/').data, valid)
})

test('repeat reads reuse memory and persisted data synchronously', async () => {
  const session = storage()
  const first = createCacheStore(async () => ({ data: { name: 'Synthetic student' } }), session, () => 'student:1')
  await first.fetch('/api/students/me/')
  assert.equal(first.read('/api/students/me/').data.name, 'Synthetic student')
  const restored = createCacheStore(() => { throw Error('Unexpected GET') }, session, () => 'student:1')
  assert.equal(restored.read('/api/students/me/').data.name, 'Synthetic student')
})

test('concurrent triggers share one GET', async () => {
  const pending = deferred()
  let calls = 0
  const cache = createCacheStore(() => { calls++; return pending.promise }, storage(), () => 'instructor:2')
  const first = cache.fetch('/api/instructor/batches/')
  const second = cache.fetch('/api/instructor/batches/')
  assert.equal(first, second)
  assert.equal(calls, 1)
  pending.resolve({ data: [] })
  await first
})

test('invalidation and optimistic mutation defeat an older response', async () => {
  const old = deferred()
  const fresh = deferred()
  let calls = 0
  const cache = createCacheStore(() => ++calls === 1 ? old.promise : fresh.promise, storage(), () => 'admin:3')
  cache.publish('/api/admin/skills/', ['last good'])
  const prior = cache.fetch('/api/admin/skills/')
  cache.invalidate('/api/admin/skills/')
  assert.deepEqual(cache.read('/api/admin/skills/').data, ['last good'])
  cache.publish('/api/admin/skills/', ['saved'])
  const next = cache.fetch('/api/admin/skills/')
  old.resolve({ data: ['old'] })
  await prior
  assert.deepEqual(cache.read('/api/admin/skills/').data, ['saved'])
  fresh.resolve({ data: ['server'] })
  await next
  assert.deepEqual(cache.read('/api/admin/skills/').data, ['server'])
})

test('background failure retains last-good data', async () => {
  const cache = createCacheStore(() => Promise.reject(Error('offline')), storage(), () => 'student:1')
  cache.publish('/api/assessments/', { assessments: [{ id: 1 }] })
  cache.invalidate('/api/assessments/')
  await assert.rejects(cache.fetch('/api/assessments/'))
  assert.equal(cache.read('/api/assessments/').data.assessments[0].id, 1)
})

test('account changes clear persisted data and discard in-flight responses', async () => {
  const session = storage()
  let account = 'student:1'
  const old = deferred()
  const cache = createCacheStore(() => old.promise, session, () => account)
  cache.publish('/api/students/me/', { id: 1 })
  const request = cache.fetch('/api/students/me/')
  account = 'student:2'
  assert.equal(cache.read('/api/students/me/'), null)
  old.resolve({ data: { id: 1 } })
  await request
  assert.equal(cache.read('/api/students/me/'), null)
  assert.equal(session.getItem('sb_api_/api/students/me/'), null)
})

test('events during an in-flight GET serialize one fresh follow-up without losing invalidations', async () => {
  const old = deferred(), fresh = deferred(), newest = deferred()
  const responses = [old, fresh, newest]
  let calls = 0
  const cache = createCacheStore(() => responses[calls++].promise, storage(), () => 'admin:1')
  cache.publish('/api/admin/users/', ['last good'])
  const first = cache.fetch('/api/admin/users/')
  cache.invalidate('/api/admin/users/')
  cache.invalidate('/api/admin/users/')
  assert.equal(cache.fetch('/api/admin/users/'), first)
  assert.equal(calls, 1)
  old.resolve({ data: ['obsolete'] }); await Promise.resolve(); await Promise.resolve()
  assert.equal(calls, 2)
  assert.deepEqual(cache.read('/api/admin/users/').data, ['last good'])
  cache.invalidate('/api/admin/users/')
  fresh.resolve({ data: ['also obsolete'] }); await Promise.resolve(); await Promise.resolve()
  assert.equal(calls, 3)
  newest.resolve({ data: ['newest'] })
  await first
  assert.deepEqual(cache.read('/api/admin/users/').data, ['newest'])
})

test('definitive loss of access clears cached and subscribed read-only data', async () => {
  const cache = createCacheStore(async () => { throw { response: { status: 404 } } }, storage(), () => 'student:1')
  const url = '/api/student/results/?assessment_id=1'
  cache.publish(url, { assessment: { id: 1 } })
  let selected
  cache.subscribe(url, value => { selected = value })
  await assert.rejects(cache.fetch(url))
  assert.equal(cache.read(url), null)
  assert.equal(selected, null)
})

test('late errors from the previous identity are marked obsolete', async () => {
  const pending = deferred()
  let user = 'student:1'
  const cache = createCacheStore(() => pending.promise, storage(), () => user)
  const prior = cache.fetch('/api/students/me/')
  user = 'student:2'
  pending.reject({ response: { status: 401 } })
  await assert.rejects(prior, error => error.staleIdentity === true)
  assert.equal(cache.read('/api/students/me/'), null)
})

test('hidden optional invalidation stays stale without starting another GET', async () => {
  const pending = deferred()
  let calls = 0, visible = true
  const cache = createCacheStore(() => { calls++; return pending.promise }, storage(), () => 'admin:1')
  cache.publish('/api/admin/skills/', ['last good'])
  const first = cache.fetch('/api/admin/skills/', { canContinue: () => visible })
  cache.invalidate('/api/admin/skills/')
  visible = false
  pending.resolve({ data: ['obsolete'] }); await first
  assert.equal(calls, 1)
  assert.equal(cache.read('/api/admin/skills/').fetchedAt, 0)
  assert.deepEqual(cache.read('/api/admin/skills/').data, ['last good'])
})

test('invalidation does not automatically retry a permanently forbidden request', async () => {
  const pending = deferred()
  let calls = 0
  const cache = createCacheStore(() => { calls++; return pending.promise }, storage(), () => 'admin:1')
  const first = cache.fetch('/api/admin/skills/')
  cache.invalidate('/api/admin/skills/')
  pending.reject({ response: { status: 403 } })
  await assert.rejects(first)
  assert.equal(calls, 1)
  assert.equal(cache.error('/api/admin/skills/').response.status, 403)
})

test('session cleanup aborts both a superseded transport and its replacement', async () => {
  const first = deferred(), second = deferred(), signals = []
  const requests = [first, second]
  const cache = createCacheStore((_url, options) => {
    signals.push(options.signal)
    return requests[signals.length - 1].promise
  }, storage(), () => 'admin:1')
  const old = cache.fetch('/api/admin/skills/')
  cache.publish('/api/admin/skills/', ['saved'])
  const replacement = cache.fetch('/api/admin/skills/')
  cache.clear()
  assert.equal(signals.length, 2)
  assert.ok(signals.every(signal => signal.aborted))
  first.resolve({ data: ['obsolete'] }); second.resolve({ data: ['also obsolete'] })
  await Promise.all([old, replacement])
  assert.equal(cache.read('/api/admin/skills/'), null)
})
