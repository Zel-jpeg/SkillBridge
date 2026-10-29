import test from 'node:test'
import assert from 'node:assert/strict'
import { createCacheStore } from './cacheStore.js'
import { adoptCollectionPage } from './collectionPage.js'

const sourceUrl = '/api/admin/users/?page=3&tab=students&sort=name&direction=asc&search=Synthetic'
const targetUrl = sourceUrl.replace('page=3', 'page=2')
const clamped = { pagination: { count: 20, page: 2, page_size: 10 }, students: [{ id: 11 }] }
function store(get = () => { throw Error('Unexpected request') }) {
  return createCacheStore(get, null, () => 'admin:1')
}

test('a fresh clamp replaces the stale target and its prior failure without another GET', async () => {
  const cache = store(async () => { throw { response: { status: 503 } } })
  cache.publish(targetUrl, { pagination: { count: 21, page: 2, page_size: 10 }, students: [] })
  cache.invalidate(targetUrl)
  await assert.rejects(cache.fetch(targetUrl))
  cache.publish(sourceUrl, clamped)
  assert.equal(adoptCollectionPage(cache, sourceUrl, clamped), 2)
  assert.equal(cache.read(targetUrl).data, clamped)
  assert.equal(cache.error(targetUrl), undefined)
  assert.equal(cache.read(sourceUrl).data, clamped)
})

test('an in-flight older canonical response cannot undo the adopted clamp', async () => {
  let resolve
  const cache = store(() => new Promise(done => { resolve = done }))
  const request = cache.fetch(targetUrl)
  cache.publish(sourceUrl, clamped)
  assert.equal(adoptCollectionPage(cache, sourceUrl, clamped), 2)
  resolve({ data: { pagination: { count: 21, page: 2, page_size: 10 }, students: [] } })
  await request
  assert.equal(cache.read(targetUrl).data, clamped)
})

test('stale, failed, pending and superseded source reads do not become fresh canonical pages', async () => {
  let reject
  const cache = store(() => new Promise((_, fail) => { reject = fail }))
  cache.publish(sourceUrl, clamped)
  cache.invalidate(sourceUrl)
  assert.equal(adoptCollectionPage(cache, sourceUrl, clamped), null)
  cache.publish(sourceUrl, clamped)
  const request = cache.fetch(sourceUrl)
  assert.equal(adoptCollectionPage(cache, sourceUrl, clamped), null)
  reject({ response: { status: 503 } })
  await assert.rejects(request)
  assert.equal(adoptCollectionPage(cache, sourceUrl, clamped), null)
  cache.publish(sourceUrl, clamped)
  const saved = cache.read(sourceUrl)
  assert.equal(adoptCollectionPage(cache, sourceUrl, clamped, saved.fetchedAt + 30000), null)
  assert.equal(adoptCollectionPage(cache, sourceUrl, { ...clamped }), null)
  assert.equal(cache.read(targetUrl), null)
})

test('a newer canonical read forces one recheck instead of overwriting newer collection data', async () => {
  const cache = store(async () => ({ data: { pagination: { count: 21, page: 3, page_size: 10 }, students: [{ id: 21 }] } }))
  cache.publish(sourceUrl, clamped)
  // Give the other page a demonstrably newer timestamp, without wall-clock sleeps.
  cache.read(sourceUrl).fetchedAt -= 1
  const newer = { pagination: { count: 21, page: 2, page_size: 10 }, students: [{ id: 12 }] }
  cache.publish(targetUrl, newer)
  assert.equal(adoptCollectionPage(cache, sourceUrl, clamped), null)
  await cache.fetch(sourceUrl)
  assert.equal(cache.read(targetUrl).data, newer)
  assert.equal(cache.read(sourceUrl).data.pagination.page, 3)
})

test('unchanged pages and legacy responses never rewrite another key', () => {
  const cache = store()
  assert.equal(adoptCollectionPage(cache, targetUrl, clamped), null)
  assert.equal(adoptCollectionPage(cache, sourceUrl, { students: [] }), null)
  assert.equal(adoptCollectionPage(cache, null, clamped), null)
})
