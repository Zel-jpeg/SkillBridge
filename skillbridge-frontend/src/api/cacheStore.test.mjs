import test from 'node:test'
import assert from 'node:assert/strict'
import { createCacheStore } from './cacheStore.js'

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
