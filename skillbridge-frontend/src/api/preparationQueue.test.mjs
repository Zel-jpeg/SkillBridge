import test from 'node:test'
import assert from 'node:assert/strict'
import { createPreparationQueue } from './preparationQueue.js'
import { createCacheStore } from './cacheStore.js'
import { authDestination } from './authDestination.js'

const tick = async () => { for (let i = 0; i < 12; i++) await Promise.resolve() }
function fixture() {
  let identity = 'admin:1', visible = true, ready = false
  const tasks = [], starts = [], pending = new Map(), aborted = []
  const cache = createCacheStore((url, options) => {
    const key = url.split('?')[0]
    starts.push(key)
    return new Promise((resolve, reject) => {
      pending.set(key, { resolve, reject })
      options.signal.addEventListener('abort', () => { aborted.push(key); reject({ code: 'ERR_CANCELED' }) })
    })
  }, undefined, () => identity)
  const queue = createPreparationQueue({ identity: () => identity, visible: () => visible,
    ready: () => ready, read: cache.read, fetch: cache.fetch, abort: cache.abortUnobserved,
    schedule: fn => { tasks.push(fn); return fn }, cancel: fn => { const i = tasks.indexOf(fn); if (i >= 0) tasks.splice(i, 1) },
  })
  return { queue, cache, starts, pending, aborted,
    frame() { const current = tasks.splice(0); current.forEach(fn => fn()) },
    ready(value) { ready = value }, visible(value) { visible = value }, identity(value) { identity = value },
    async finish(key, data = []) { pending.get(key).resolve({ data }); await tick() },
  }
}

test('all role, pending and setup success destinations are synchronous', () => {
  const cases = [
    [{ role: 'admin' }, '/admin/dashboard'],
    [{ role: 'instructor', is_approved: true }, '/instructor/dashboard'],
    [{ role: 'instructor', is_approved: false }, '/instructor/pending'],
    [{ role: 'student', phone: 'synthetic' }, '/student/dashboard'],
    [{ role: 'student', phone: '' }, '/student/setup'],
    [{ role: 'student', is_approved: false, phone: '' }, '/instructor/pending'],
  ]
  cases.forEach(([user, expected]) => assert.equal(authDestination(user), expected))
})

test('foreground priority, bounded optional concurrency and promotion', async () => {
  const f = fixture()
  f.queue.start(['/a', '/b', '/c'])
  f.frame(); assert.deepEqual(f.starts, [])
  f.queue.enqueue(['/c'], true)
  f.ready(true); f.queue.wake(); f.frame()
  assert.deepEqual(f.starts, ['/c'])
  await f.finish('/c'); f.frame()
  assert.deepEqual(f.starts, ['/c', '/a'])
  f.ready(false)
  await f.finish('/a'); f.frame()
  assert.deepEqual(f.starts, ['/c', '/a'])
  f.ready(true); f.queue.wake(); f.frame()
  assert.deepEqual(f.starts, ['/c', '/a', '/b'])
  await f.finish('/b')
})

test('hidden tabs pause and resume without a duplicate burst; forbidden optional work is not retried', async () => {
  const f = fixture(); f.ready(true); f.visible(false)
  f.queue.start(['/a', '/b']); f.frame(); assert.equal(f.starts.length, 0)
  f.visible(true); f.queue.wake(); f.frame()
  f.pending.get('/a').reject({ response: { status: 403 } }); await tick(); f.frame()
  assert.deepEqual(f.starts, ['/a', '/b'])
  await f.finish('/b'); f.queue.enqueue(['/a', '/b']); f.frame()
  assert.deepEqual(f.starts, ['/a', '/b'])
})

test('navigation adopts a speculative in-flight request through the existing store', async () => {
  const f = fixture(); f.ready(true); f.queue.start(['/a']); f.frame()
  f.queue.pause()
  const stop = f.cache.subscribe('/a', () => {})
  const mounted = f.cache.fetch('/a')
  f.queue.start(['/a']); f.frame()
  assert.equal(f.starts.length, 1)
  assert.equal(f.aborted.length, 0)
  await f.finish('/a', ['shared']); await mounted
  assert.deepEqual(f.cache.read('/a').data, ['shared']); stop()
})

test('logout clears queued work and aborts in-flight work; account switch never starts old work', async () => {
  const f = fixture(); f.ready(true); f.queue.start(['/a', '/b']); f.frame()
  f.queue.reset(); f.cache.clear(); await tick(); f.frame()
  assert.deepEqual(f.starts, ['/a']); assert.deepEqual(f.aborted, ['/a'])
  assert.equal(f.cache.read('/a'), null)
  f.queue.start(['/b']); f.identity('student:2'); f.frame()
  assert.deepEqual(f.starts, ['/a'])
})

test('SSE invalidation during preparation serializes a fresh response and caches it for direct navigation', async () => {
  const f = fixture(); f.ready(true); f.queue.start(['/a']); f.frame()
  f.cache.invalidate('/a'); await f.finish('/a', ['obsolete'])
  assert.equal(f.cache.read('/a'), null)
  assert.equal(f.starts.length, 2)
  await f.finish('/a', ['fresh']); f.frame()
  assert.deepEqual(f.cache.read('/a').data, ['fresh'])
  f.queue.enqueue(['/a']); f.frame(); assert.equal(f.starts.length, 2)
})

test('cache readiness includes dependent initial queries and successful empty data', async () => {
  const f = fixture()
  const stop = f.cache.subscribe('/a', () => {})
  assert.equal(f.cache.foregroundReady(), false)
  const mounted = f.cache.fetch('/a'); assert.equal(f.cache.foregroundReady(), false)
  await f.finish('/a', []); await mounted
  assert.equal(f.cache.foregroundReady(), true)
  f.cache.invalidate('/a'); const next = f.cache.fetch('/a')
  f.pending.get('/a').reject(Error('offline')); await assert.rejects(next)
  assert.deepEqual(f.cache.read('/a').data, [])
  stop()
})

test('fresh data still permits bounded page-code preparation without another GET', async () => {
  const frames = [], starts = [], completions = []
  const queue = createPreparationQueue({ identity: () => 'student:1', visible: () => true, ready: () => true,
    read: () => ({ fetchedAt: Date.now(), data: [] }),
    fetch: () => { throw Error('Fresh data must not fetch') }, abort: () => false,
    prepare: url => { starts.push(url); return new Promise(resolve => completions.push(resolve)) },
    schedule: callback => { frames.push(callback); return callback }, cancel: () => {},
  })
  queue.start(['/list', '/profile']); frames.shift()()
  assert.deepEqual(starts, ['/list'])
  completions.shift()(); await tick(); frames.shift()()
  assert.deepEqual(starts, ['/list', '/profile'])
  completions.shift()(); await tick(); queue.reset()
})

test('a prior foreground permission failure is never retried by the optional queue', async () => {
  const frames = [], calls = []
  const queue = createPreparationQueue({ identity: () => 'admin:1', visible: () => true, ready: () => true,
    allowed: url => url !== '/forbidden', read: () => null, abort: () => false,
    fetch: async url => { calls.push(url) }, schedule: callback => { frames.push(callback); return callback }, cancel: () => {},
  })
  queue.start(['/forbidden', '/allowed']); frames.shift()(); await tick()
  assert.deepEqual(calls, ['/allowed']); queue.reset()
})

test('a failed optional GET does not release the slot while its code is still preparing', async () => {
  const frames = [], started = []
  let finishCode
  const queue = createPreparationQueue({ identity: () => 'admin:1', visible: () => true, ready: () => true,
    read: () => null, abort: () => false,
    prepare: url => url === '/a' ? new Promise(resolve => { finishCode = resolve }) : Promise.resolve(),
    fetch: async url => { started.push(url); if (url === '/a') throw Error('offline') },
    schedule: callback => { frames.push(callback); return callback }, cancel: () => {},
  })
  queue.start(['/a', '/b']); frames.shift()(); await tick()
  assert.deepEqual(started, ['/a']); assert.equal(frames.length, 0)
  finishCode(); await tick(); frames.shift()(); await tick()
  assert.deepEqual(started, ['/a', '/b']); queue.reset()
})
