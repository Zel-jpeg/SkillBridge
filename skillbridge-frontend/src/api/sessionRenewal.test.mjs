import test from 'node:test'
import assert from 'node:assert/strict'
import { createSessionRenewal } from './sessionRenewal.js'

function fixture() {
  let session = { id: 'session-one', token: 'expired', refresh: 'seven-day-refresh' }
  let calls = 0, accepts = 0, expirations = 0, resolve, reject
  const manager = createSessionRenewal({
    read: () => ({ ...session }),
    exchange: () => { calls++; return new Promise((yes, no) => { resolve = yes; reject = no }) },
    accept: token => { accepts++; session = { ...session, token } },
    expired: () => { expirations++ },
  })
  return { manager, read: () => ({ ...session }), set: values => { session = values },
    async ready() { await Promise.resolve() }, resolve: value => resolve(value), reject: value => reject(value),
    get calls() { return calls }, get accepts() { return accepts }, get expirations() { return expirations } }
}

test('twenty concurrent 401s share one refresh and late old-token failures reuse the result', async () => {
  const f = fixture(), original = f.read()
  const requests = Array.from({ length: 20 }, () => f.manager.renew(original))
  await f.ready()
  assert.equal(f.calls, 1)
  f.resolve({ access: 'renewed' })
  assert.deepEqual(await Promise.all(requests), Array(20).fill('renewed'))
  assert.equal(await f.manager.renew(original), 'renewed')
  assert.equal(f.calls, 1)
  assert.equal(f.accepts, 1)
})

test('logout or new authentication cannot be resurrected by an old refresh result', async () => {
  for (const session of [{ id: null, token: null, refresh: null }, { id: 'new-login', token: 'new-user-token', refresh: 'new-user-refresh' }]) {
    const f = fixture(), request = f.manager.renew()
    await f.ready()
    f.set(session)
    f.resolve({ access: 'obsolete' })
    await assert.rejects(request, error => error.code === 'ERR_CANCELED')
    assert.deepEqual(f.read(), session)
    assert.equal(f.accepts, 0)
    assert.equal(f.expirations, 0)
  }
})

test('expired/revoked refresh expires once; transient errors retain the session and can recover', async () => {
  const f = fixture()
  const requests = [f.manager.renew(), f.manager.renew()]
  const settled = Promise.allSettled(requests)
  await f.ready()
  f.reject({ response: { status: 401 } })
  assert.ok((await settled).every(item => item.status === 'rejected'))
  assert.equal(f.expirations, 1)
  const g = fixture(), retryable = g.manager.renew()
  await g.ready()
  g.reject({ response: { status: 503 } })
  await assert.rejects(retryable)
  assert.equal(g.expirations, 0)
  const retry = g.manager.renew()
  await g.ready()
  g.resolve({ access: 'recovered' })
  assert.equal(await retry, 'recovered')
  assert.equal(g.calls, 2)
})

test('other-tab renewal wins over late failure and missing refresh is terminal without exchange', async () => {
  const f = fixture(), original = f.read(), request = f.manager.renew()
  await f.ready()
  f.set({ ...original, token: 'other-tab-renewed' })
  f.reject({ response: { status: 401 } })
  assert.equal(await request, 'other-tab-renewed')
  assert.equal(f.expirations, 0)
  const g = fixture()
  g.set({ ...g.read(), refresh: null })
  await assert.rejects(g.manager.renew())
  assert.equal(g.calls, 0)
  assert.equal(g.expirations, 1)
})
