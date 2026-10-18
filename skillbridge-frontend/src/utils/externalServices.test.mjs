import test from 'node:test'
import assert from 'node:assert/strict'
import { externalJson, geocodeAddress, loadLeaflet } from './externalServices.js'

test('external JSON bounds a hung provider and aborts transport', async () => {
  const old = global.fetch
  let signal
  global.fetch = async (_, options) => { signal = options.signal; return new Promise(() => {}) }
  try {
    await assert.rejects(externalJson('https://synthetic.invalid', { timeoutMs: 10 }))
    assert.equal(signal.aborted, true)
  } finally { global.fetch = old }
})
test('external denial, bad JSON and caller cancellation reject safely', async () => {
  const old = global.fetch
  try {
    global.fetch = async () => ({ ok: false })
    await assert.rejects(externalJson('synthetic'))
    global.fetch = async () => ({ ok: true, json: async () => { throw Error('bad json') } })
    await assert.rejects(externalJson('synthetic'))
    global.fetch = async () => new Promise(() => {})
    const controller = new AbortController()
    controller.abort()
    await assert.rejects(externalJson('synthetic', { signal: controller.signal }))
  } finally { global.fetch = old }
})
test('invalid geocoding is explicitly a default view, never a pin; zero is valid', async () => {
  const old = global.fetch
  try {
    for (const data of [{}, [], [{ lat: 'NaN', lon: '125' }], [{ lat: 91, lon: 181 }], [{ lat: true, lon: 0 }]]) {
      global.fetch = async () => ({ ok: true, json: async () => data })
      assert.equal((await geocodeAddress({ city: 'Synthetic' })).approximate, true)
    }
    global.fetch = async () => ({ ok: true, json: async () => [{ lat: '0', lon: '0' }] })
    assert.deepEqual(await geocodeAddress({ city: 'Synthetic' }), { lat: 0, lng: 0, zoom: 15, approximate: false })
  } finally { global.fetch = old }
})
test('company city fallback uses valid city coordinates or a truthful bounded default view', async () => {
  const old = global.fetch
  const fallbackView = { lat: 7.1907, lng: 125.4553 }
  try {
    const queries = []
    global.fetch = async url => {
      queries.push(new URL(url).searchParams.get('q'))
      return { ok: true, json: async () => queries.length === 1 ? [] : [{ lat: '0', lon: '0' }] }
    }
    const address = { barangay: 'Synthetic Barangay', city: 'Synthetic City', province: 'Synthetic Province' }
    assert.deepEqual(await geocodeAddress(address, { cityFallback: true, fallbackView }),
      { lat: 0, lng: 0, zoom: 15, approximate: false })
    assert.equal(queries.length, 2)
    assert.ok(queries[0].includes('Synthetic Barangay'))
    assert.ok(!queries[1].includes('Synthetic Barangay'))
    let calls = 0, signal
    global.fetch = async (_, options) => {
      calls++; signal = options.signal
      return calls === 1 ? { ok: true, json: async () => [] } : new Promise(() => {})
    }
    assert.deepEqual(await geocodeAddress(address, { cityFallback: true, fallbackView, timeoutMs: 10 }),
      { ...fallbackView, zoom: 12, approximate: true })
    assert.equal(calls, 2)
    assert.equal(signal.aborted, true)
    const controller = new AbortController()
    global.fetch = async () => { controller.abort(); return { ok: true, json: async () => [] } }
    assert.deepEqual(await geocodeAddress(address, { cityFallback: true, fallbackView, signal: controller.signal }),
      { ...fallbackView, zoom: 12, approximate: true })
  } finally { global.fetch = old }
})

test('shared map loader rejects denial, timeout and bad CSS, then retries cleanly', async () => {
  const oldWindow = global.window, oldDocument = global.document
  let elements
  global.window = {}
  global.document = {
    createElement: tag => ({ tag, removed: false, remove() { this.removed = true } }),
    head: { append: (...nodes) => { elements = nodes } },
  }
  try {
    const denied = loadLeaflet({ timeoutMs: 100 })
    assert.equal(loadLeaflet(), denied)
    elements[1].onerror()
    await assert.rejects(denied)
    assert.ok(elements.every(node => node.removed))
    await assert.rejects(loadLeaflet({ timeoutMs: 10 }))
    assert.ok(elements.every(node => node.removed))
    const cssFailure = loadLeaflet({ timeoutMs: 100 })
    window.L = { map() {}, tileLayer() {} }
    elements[1].onload()
    elements[0].onerror()
    await assert.rejects(cssFailure)
    assert.equal(window.L, undefined)
    const retry = loadLeaflet({ timeoutMs: 100 })
    window.L = { map() {}, tileLayer() {} }
    elements[0].onload(); elements[1].onload()
    assert.equal(await retry, window.L)
  } finally { global.window = oldWindow; global.document = oldDocument }
})
