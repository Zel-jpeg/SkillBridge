import test from 'node:test'
import assert from 'node:assert/strict'
import { openSupabaseRealtime } from './supabaseRealtime.js'

const ticket = { url: 'https://syntheticproject12345.supabase.co/realtime/v1',
  publishable_key: 'sb_publishable_synthetic', token: 'synthetic.synthetic.synthetic',
  topic: 'sb-pilot:synthetic_recipient_123456', event: 'refresh' }
const settle = async () => { for (let i = 0; i < 5; i++) await Promise.resolve() }

function fixture(setAuth = async () => {}) {
  let client
  const messages = [], statuses = []
  class Client {
    constructor(url, options) {
      assert.equal(url, ticket.url.replace(/^https:/, 'wss:'))
      assert.deepEqual(options.params, { apikey: ticket.publishable_key })
      options.sessionStorage.setItem('synthetic', ticket.token)
      assert.equal(options.sessionStorage.getItem('synthetic'), null)
      this.removed = this.disconnected = 0
      client = this
    }
    setAuth(token) { assert.equal(token, ticket.token); return setAuth() }
    channel(topic, options) {
      assert.equal(topic, ticket.topic)
      assert.equal(options.config.private, true)
      assert.deepEqual(options.config.broadcast, { self: false, ack: false })
      this.selected = {
        on(type, filter, callback) {
          assert.equal(type, 'broadcast')
          assert.deepEqual(filter, { event: ticket.event })
          this.message = callback
          return this
        },
        subscribe(callback) { this.status = callback; return this },
        teardown: () => { this.removed++ },
      }
      return this.selected
    }
    disconnect(code) { assert.equal(code, 1000); this.disconnected++; return Promise.resolve('ok') }
  }
  const connection = openSupabaseRealtime(ticket, {
    message: message => messages.push(message), status: status => statuses.push(status),
  }, Client)
  return { connection, messages, statuses, get client() { return client } }
}

test('dedicated auth precedes the private subscription; close removes channels and stops callbacks', async () => {
  const f = fixture()
  assert.equal(f.client.selected, undefined)
  await settle()
  f.client.selected.status('SUBSCRIBED')
  f.client.selected.message({ payload: { event_id: 'synthetic' } })
  assert.deepEqual(f.statuses, ['SUBSCRIBED'])
  assert.deepEqual(f.messages, [{ event_id: 'synthetic' }])
  await f.connection.close(); await f.connection.close()
  assert.equal(f.client.removed, 1)
  assert.equal(f.client.disconnected, 1)
  f.client.selected.status('CLOSED')
  f.client.selected.message({ payload: { event_id: 'late' } })
  assert.equal(f.statuses.length, 1)
  assert.equal(f.messages.length, 1)
})

test('closing during auth prevents a late connection', async () => {
  let resolve
  const f = fixture(() => new Promise(yes => { resolve = yes }))
  f.connection.close()
  resolve(); await settle()
  assert.equal(f.client.selected, undefined)
  assert.equal(f.client.disconnected, 1)
})

test('failed provider auth signals fallback without leaking the error or token', async () => {
  const f = fixture(async () => { throw Error('Synthetic provider failure') })
  await settle()
  assert.deepEqual(f.statuses, ['CHANNEL_ERROR'])
  assert.equal(f.client.selected, undefined)
  f.connection.close()
})

test('provider teardown exceptions cannot block fallback or logout', async () => {
  const f = fixture()
  await settle()
  let disconnected = false
  f.client.removeChannel = () => { throw Error('Synthetic unsubscribe failure') }
  f.client.disconnect = () => { disconnected = true; return Promise.reject(Error('Synthetic disconnect failure')) }
  assert.doesNotThrow(() => f.connection.close())
  await settle()
  assert.equal(disconnected, true)
})
