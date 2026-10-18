import test from 'node:test'
import assert from 'node:assert/strict'
import { createEventStream } from './eventStream.js'

function fixture(overrides = {}) {
  let user = { key: 'student:1:token1', role: 'student', token: 'token1' }, visible = true, preflights = 0, expired = 0
  const tasks = new Map(), streams = [], changes = []
  let next = 1
  const timers = {
    setTimeout(fn, ms) { const id = next++; tasks.set(id, { fn, ms }); return id },
    clearTimeout(id) { tasks.delete(id) },
  }
  const manager = createEventStream({
    identity: () => user, visible: () => visible, timers,
    preflight: async () => { preflights++ },
    source: () => { const s = { close() { this.closed = true } }; streams.push(s); return s },
    changed: change => changes.push(change), unauthorized: () => { expired++ }, ...overrides,
  })
  const tick = async ms => {
    for (const [id, task] of [...tasks]) if (task.ms === ms) { tasks.delete(id); task.fn() }
    await Promise.resolve(); await Promise.resolve()
  }
  return { manager, streams, changes, tasks, tick,
    message(data) { streams.at(-1).onmessage({ data: JSON.stringify(data) }) },
    get preflights() { return preflights }, get expired() { return expired },
    setUser(value) { user = value }, setVisible(value) { visible = value },
  }
}

test('one connection/preflight and one coalesced invalidation per burst', async () => {
  const f = fixture()
  f.manager.start(); f.manager.start(); f.manager.start()
  await Promise.resolve()
  assert.equal(f.preflights, 1)
  assert.equal(f.streams.length, 1)
  f.message({ type: 'connected' })
  f.message({ type: 'data_changed', topics: ['results'] })
  await f.tick(150)
  assert.equal(f.changes.length, 1)
  assert.equal(f.changes[0].resync, true)
  f.message({ type: 'data_changed', topics: ['results'], batch_ids: [1] })
  f.message({ type: 'data_changed', topics: ['students'], batch_ids: [1] })
  await f.tick(150)
  assert.deepEqual(f.changes[1].topics, ['results', 'students'])
  assert.deepEqual(f.changes[1].batch_ids, [1])
  f.manager.stop()
  assert.equal(f.tasks.size, 0)
})

test('disconnect reconnects with resynchronization; hidden tabs suspend', async () => {
  const f = fixture()
  f.manager.start(); await Promise.resolve()
  f.streams[0].onerror()
  assert.equal(f.streams[0].closed, true)
  await f.tick(1000)
  f.message({ type: 'connected' }); await f.tick(150)
  assert.equal(f.changes[0].resync, true)
  f.setVisible(false); f.manager.visibilityChanged()
  assert.equal(f.streams.at(-1).closed, true)
  assert.equal(f.tasks.size, 0)
  f.setVisible(true); f.manager.visibilityChanged(); await Promise.resolve()
  assert.equal(f.streams.length, 3)
  f.manager.stop()
})

test('logout cancels reconnects and stale preflights cannot create a stream', async () => {
  let resolve
  const f = fixture({ preflight: () => new Promise(yes => { resolve = yes }) })
  f.manager.start(); f.manager.stop(); resolve(); await Promise.resolve()
  assert.equal(f.streams.length, 0)
  assert.equal(f.tasks.size, 0)
})

test('identity switch closes the old connection and ignores its late messages', async () => {
  const f = fixture()
  f.manager.start(); await Promise.resolve()
  const old = f.streams[0]
  f.setUser({ key: 'student:2:token2', role: 'student', token: 'token2' })
  f.manager.start(); await Promise.resolve()
  old.onmessage({ data: JSON.stringify({ type: 'data_changed', topics: ['results'] }) })
  await f.tick(150)
  assert.equal(old.closed, true)
  assert.equal(f.streams.length, 2)
  assert.equal(f.changes.length, 0)
  f.manager.stop()
})

test('revocation and unauthorized preflight are terminal; transient errors back off', async () => {
  let preflights = 0
  const f = fixture({ preflight: async () => { if (preflights++) throw { response: { status: 401 } } } })
  f.manager.start(); await Promise.resolve()
  f.message({ type: 'auth_expired' })
  assert.equal(f.expired, 0)
  await f.tick(1000)
  assert.equal(f.expired, 1)
  assert.equal(f.tasks.size, 0)
  const denied = fixture({ preflight: async () => { throw { response: { status: 401 } } } })
  denied.manager.start(); await Promise.resolve()
  assert.equal(denied.expired, 1)
  assert.equal(denied.tasks.size, 0)
  const offline = fixture({ preflight: async () => { throw Error('offline') } })
  offline.manager.start(); await Promise.resolve()
  for (const delay of [1000, 2000, 4000, 8000, 16000, 30000, 30000]) {
    assert.ok([...offline.tasks.values()].some(task => task.ms === delay))
    await offline.tick(delay)
  }
  offline.manager.stop()
})

test('missing heartbeats trigger reconnect and cleanup', async () => {
  const f = fixture()
  f.manager.start(); await Promise.resolve()
  await f.tick(45000)
  assert.equal(f.streams[0].closed, true)
  assert.ok([...f.tasks.values()].some(task => task.ms === 1000))
  f.manager.stop()
})

test('an old unauthorized preflight cannot expire a new identity', async () => {
  let reject
  let calls = 0
  const f = fixture({ preflight: () => ++calls === 1 ? new Promise((_, no) => { reject = no }) : Promise.resolve() })
  f.manager.start()
  f.setUser({ key: 'admin:2:new', token: 'new', role: 'admin' })
  reject({ response: { status: 401 } })
  await Promise.resolve(); await Promise.resolve()
  assert.equal(f.expired, 0)
  assert.equal(f.streams.length, 1)
  f.manager.stop()
})
