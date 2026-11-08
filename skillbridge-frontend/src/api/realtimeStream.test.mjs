import test from 'node:test'
import assert from 'node:assert/strict'
import { createRealtimeStream } from './realtimeStream.js'

const ticket = overrides => ({ transport: 'supabase_broadcast',
  url: 'https://syntheticproject12345.supabase.co/realtime/v1',
  publishable_key: 'sb_publishable_synthetic', token: 'synthetic.synthetic.synthetic',
  topic: 'sb-pilot:synthetic_recipient_123456', expires_at: 1060, event: 'refresh', ...overrides })
const hint = (id = 'synthetic_event') => ({ type: 'data_changed', topics: ['results'], event_id: id })
const settle = async () => { for (let i = 0; i < 8; i++) await Promise.resolve() }

function fixture(overrides = {}) {
  let user = { token: 'synthetic', role: 'student', key: 'student:1:session1:synthetic' }
  let visible = true, now = 1000_000, sessions = 0, imports = 0, expired = 0
  let sseActive = false, sseStarts = 0
  const timers = new Map(), connections = [], changes = [], signals = []
  let serial = 0
  const manager = createRealtimeStream({
    enabled: true,
    identity: () => user, visible: () => visible, now: () => now,
    timers: {
      setTimeout(fn, ms) { const id = ++serial; timers.set(id, { fn, ms }); return id },
      clearTimeout(id) { timers.delete(id) },
    },
    session: async (_user, { signal }) => { sessions++; signals.push(signal); return ticket() },
    load: async () => {
      imports++
      return (_ticket, handlers) => {
        assert.equal(sseActive, false, 'SSE must close before opening the socket')
        const value = { ...handlers, closed: false, close() { this.closed = true } }
        connections.push(value)
        return value
      }
    },
    sse: {
      start() { sseActive = true; sseStarts++ },
      stop() { sseActive = false },
      visibilityChanged() { sseActive = visible },
    },
    changed: change => changes.push(change), unauthorized: () => expired++, ...overrides,
  })
  return { manager, connections, changes, timers, signals,
    get sessions() { return sessions }, get imports() { return imports }, get expired() { return expired },
    get sseActive() { return sseActive }, get sseStarts() { return sseStarts },
    get user() { return user }, setUser(value) { user = value }, setVisible(value) { visible = value },
    async tick(ms) {
      for (const [id, task] of [...timers]) if (task.ms === ms) { timers.delete(id); task.fn() }
      await settle()
    },
    setNow(value) { now = value },
  }
}

test('disabled pilot delegates to SSE without a session request or SDK import', async () => {
  const f = fixture({ enabled: false })
  f.manager.start(); await settle()
  assert.equal(f.sseActive, true)
  assert.equal(f.sessions, 0)
  assert.equal(f.imports, 0)
  f.manager.stop()
  assert.equal(f.sseActive, false)
})

test('one selected connection, coalesced hints and bounded generic refresh after join', async () => {
  const f = fixture()
  f.manager.start(); f.manager.start(); f.manager.start()
  await settle()
  assert.equal(f.sessions, 1)
  assert.equal(f.connections.length, 1)
  assert.equal(f.sseActive, false)
  f.connections[0].status('SUBSCRIBED')
  f.connections[0].message(hint())
  await f.tick(150)
  assert.deepEqual(f.changes, [{ resync: true }])
  f.connections[0].message(hint())
  await f.tick(150)
  assert.equal(f.changes.length, 1)
  f.connections[0].message({ ...hint('different'), student_ids: [900], urls: ['/untrusted/'] })
  await f.tick(150)
  assert.deepEqual(f.changes[1], { resync: true })
  f.manager.stop()
  assert.equal(f.connections[0].closed, true)
  assert.equal(f.timers.size, 0)
})

test('instructor joins and scope changes evict scoped data, while ordinary hints revalidate it', async () => {
  const f = fixture()
  f.setUser({ token: 'synthetic', role: 'instructor', key: 'instructor:2:synthetic' })
  f.manager.start(); await settle()
  f.connections[0].status('SUBSCRIBED')
  await f.tick(150)
  assert.deepEqual(f.changes, [{ resync: true, topics: ['scope'] }])
  f.connections[0].message(hint('ordinary'))
  await f.tick(150)
  assert.deepEqual(f.changes[1], { resync: true })
  f.connections[0].message(hint('another_ordinary'))
  f.connections[0].message({ ...hint('scope'), topics: ['scope'] })
  await f.tick(150)
  assert.deepEqual(f.changes[2], { resync: true, topics: ['scope'] })
  f.manager.stop()
})

test('an instructor rejoin with the same access revision leaves mounted data in place', async () => {
  let revision = 'a'.repeat(64)
  const f = fixture({ session: async () => ticket({ scope_revision: revision }) })
  f.setUser({ token: 'synthetic', role: 'instructor', key: 'instructor:2:synthetic' })
  f.manager.start(); await settle()
  f.connections.at(-1).status('SUBSCRIBED')
  await f.tick(150)
  assert.deepEqual(f.changes.at(-1), { resync: true, topics: ['scope'] })

  for (const next of [revision, 'b'.repeat(64)]) {
    f.setVisible(false); f.manager.visibilityChanged()
    revision = next
    f.setVisible(true); f.manager.visibilityChanged(); await settle()
    f.connections.at(-1).status('SUBSCRIBED')
    await f.tick(150)
  }
  assert.deepEqual(f.changes.slice(1), [{ resync: true }, { resync: true, topics: ['scope'] }])
  f.manager.stop()
})

test('fallback waits for the old socket to close and a hidden tab cancels the pending fallback', async () => {
  for (const hide of [false, true]) {
    const f = fixture()
    f.manager.start(); await settle()
    let finishClose
    f.connections[0].close = () => new Promise(resolve => { finishClose = resolve })
    f.connections[0].status('CHANNEL_ERROR')
    assert.equal(f.sseActive, false)
    if (hide) { f.setVisible(false); f.manager.visibilityChanged() }
    finishClose(); await settle()
    assert.equal(f.sseActive, !hide)
    f.manager.stop()
  }
})

test('nonpilot, denied and failed ticket exchanges fall back without expiring a valid app session', async () => {
  for (const session of [async () => ({ transport: 'sse' }),
    async () => { throw { response: { status: 403 } } },
    async () => { throw Error('Synthetic offline') }]) {
    const f = fixture({ session })
    f.manager.start(); await settle()
    assert.equal(f.sseActive, true)
    assert.equal(f.imports, 0)
    assert.equal(f.expired, 0)
    assert.equal(f.timers.size, 0)
    f.manager.start(); await settle()
    assert.equal(f.sseStarts, 1)
    f.manager.stop()
  }
  const denied = fixture({ session: async () => { throw { response: { status: 401 } } } })
  denied.manager.start(); await settle()
  assert.equal(denied.expired, 1)
  assert.equal(denied.sseActive, false)
})

test('malformed or untrusted connection configuration never loads the SDK', async () => {
  for (const value of [
    { url: 'https://other.example.invalid/realtime/v1' },
    { url: 'https://syntheticproject12345.supabase.co/realtime/v1?token=bad' },
    { token: 'not-a-jwt' }, { publishable_key: 'privileged-secret' },
    { topic: 'shared-public-topic' }, { expires_at: 1002 }, { expires_at: 1066 },
    { event: 'unexpected' },
  ]) {
    const f = fixture({ session: async () => ticket(value) })
    f.manager.start(); await settle()
    assert.equal(f.imports, 0)
    assert.equal(f.sseActive, true)
    f.manager.stop()
  }
})

test('provider errors and a join timeout close the socket before SSE starts', async () => {
  for (const status of ['CHANNEL_ERROR', 'TIMED_OUT', 'CLOSED']) {
    const f = fixture()
    f.manager.start(); await settle()
    f.connections[0].status(status)
    assert.equal(f.connections[0].closed, true)
    assert.equal(f.sseActive, true)
    f.connections[0].status('SUBSCRIBED')
    f.connections[0].message(hint())
    await f.tick(150)
    assert.equal(f.changes.length, 0)
    f.manager.stop()
  }
  const hanging = fixture()
  hanging.manager.start(); await settle()
  await hanging.tick(8000)
  assert.equal(hanging.connections[0].closed, true)
  assert.equal(hanging.sseActive, true)
  hanging.manager.stop()
})

test('a refreshed ticket is obtained before expiry; any renewal failure closes the old connection', async () => {
  let calls = 0
  const f = fixture({ session: async () => ++calls === 1 ? ticket() : ticket({ token: 'new.new.new', expires_at: 1110 }) })
  f.manager.start(); await settle()
  f.connections[0].status('SUBSCRIBED')
  f.setNow(1050_000)
  await f.tick(50_000)
  assert.equal(f.connections[0].closed, true)
  assert.equal(f.connections.length, 2)
  f.connections[1].status('SUBSCRIBED')
  await f.tick(150)
  assert.equal(f.sseActive, false)
  f.manager.stop()

  calls = 0
  const failed = fixture({ session: async () => {
    if (calls++) throw { response: { status: 403 } }
    return ticket()
  } })
  failed.manager.start(); await settle()
  failed.setNow(1050_000)
  await failed.tick(50_000)
  assert.equal(failed.connections[0].closed, true)
  assert.equal(failed.sseActive, true)
  assert.equal(failed.expired, 0)
  failed.manager.stop()
})

test('hard expiry prevents a delayed import from opening a socket', async () => {
  let resolve
  const f = fixture({ load: () => new Promise(yes => { resolve = yes }) })
  f.manager.start(); await settle()
  await f.tick(60_000)
  assert.equal(f.sseActive, true)
  resolve(() => { throw Error('Expired import must never be used') })
  await settle()
  assert.equal(f.connections.length, 0)
  f.manager.stop()
})

test('visibility suspension cancels requests, disconnects and resynchronizes on resume', async () => {
  const f = fixture()
  f.manager.start(); await settle()
  f.connections[0].status('SUBSCRIBED')
  f.setVisible(false); f.manager.visibilityChanged()
  assert.equal(f.connections[0].closed, true)
  assert.equal(f.signals[0].aborted, true)
  assert.equal(f.timers.size, 0)
  f.setVisible(true); f.manager.visibilityChanged(); await settle()
  assert.equal(f.connections.length, 2)
  f.connections[1].status('SUBSCRIBED'); await f.tick(150)
  assert.deepEqual(f.changes, [{ resync: true }])
  f.manager.stop()
})

test('logout and account changes cancel pending work and ignore stale authorization errors', async () => {
  let resolve, reject, calls = 0
  const f = fixture({ session: () => ++calls === 1 ? new Promise((yes, no) => { resolve = yes; reject = no }) : Promise.resolve(ticket()) })
  f.manager.start()
  f.setUser({ token: 'new', role: 'admin', key: 'admin:2:session2:new' })
  f.manager.start()
  reject({ response: { status: 401 } })
  await settle()
  assert.equal(f.expired, 0)
  assert.equal(f.connections.length, 1)
  const old = f.connections[0]
  f.manager.stop()
  old.message(hint()); old.status('SUBSCRIBED')
  await f.tick(150)
  assert.equal(f.changes.length, 0)
  const stopped = fixture({ session: () => new Promise(yes => { resolve = yes }) })
  stopped.manager.start(); stopped.manager.stop()
  resolve(ticket()); await settle()
  assert.equal(stopped.imports, 0)
})

test('invalid hints are ignored and event deduplication retains only a bounded window', async () => {
  const f = fixture()
  f.manager.start(); await settle()
  for (const value of [{}, { ...hint(), type: 'submit' }, { ...hint(), topics: ['unknown'] },
    { ...hint(), event_id: '' }, { ...hint(), event_id: 'x'.repeat(129) }]) f.connections[0].message(value)
  await f.tick(150)
  assert.equal(f.changes.length, 0)
  for (let i = 0; i < 101; i++) f.connections[0].message(hint(`event_${i}`))
  await f.tick(150)
  assert.equal(f.changes.length, 1)
  f.connections[0].message(hint('event_100')); await f.tick(150)
  assert.equal(f.changes.length, 1)
  f.connections[0].message(hint('event_0')); await f.tick(150)
  assert.equal(f.changes.length, 2)
  f.manager.stop()
})
