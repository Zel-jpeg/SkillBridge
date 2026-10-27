import test from 'node:test'
import assert from 'node:assert/strict'
import { requestRoadRoute, roadRouteUrl, parseRoadRoute } from './roadRoutes.js'

const from = { lat: 7.3, lng: 125.68 }, to = { lat: 7.32, lng: 125.7 }
const response = { code: 'Ok', routes: [{ distance: 4200, duration: 660, geometry: { type: 'LineString', coordinates: [[125.68, 7.3], [125.69, 7.3], [125.69, 7.32], [125.7, 7.32]] } }] }

test('routing uses longitude/latitude, bounded road snapping and a fixed HTTPS provider', () => {
  const url = new URL(roadRouteUrl(from, to))
  assert.equal(url.origin, 'https://router.project-osrm.org')
  assert.match(url.pathname, /driving\/125\.68,7\.3;125\.7,7\.32$/)
  assert.equal(url.searchParams.get('geometries'), 'geojson')
  assert.equal(url.searchParams.get('radiuses'), '1500;1500')
  for (const pin of [null, { lat: NaN, lng: 1 }, { lat: 91, lng: 1 }, { lat: '', lng: 1 }]) assert.throws(() => roadRouteUrl(pin, to))
})

test('road geometry preserves turns and converts GeoJSON into Leaflet latitude/longitude', () => {
  assert.deepEqual(parseRoadRoute(response), { points: [[7.3,125.68],[7.3,125.69],[7.32,125.69],[7.32,125.7]], distanceKm: 4.2, minutes: 11 })
  assert.equal(response.routes[0].geometry.coordinates[0][0],125.68)
  for (const data of [null, {}, { code:'NoRoute' }, { ...response, routes:[] }, { code:'Ok', routes:[{...response.routes[0], distance:-1}] }, { code:'Ok', routes:[{...response.routes[0], geometry:{type:'LineString',coordinates:[[500,7],[125,7]]}}] }]) assert.throws(() => parseRoadRoute(data))
})

test('route reads omit identity/credentials/referrer, abort before start, and bound a hung provider', async () => {
  const original = globalThis.fetch
  let calls = 0
  try {
    globalThis.fetch = async (_url, options) => {
      calls++
      assert.equal(options.credentials, 'omit')
      assert.equal(options.referrerPolicy, 'no-referrer')
      assert.equal(options.redirect, 'error')
      assert.equal(options.headers, undefined)
      return { ok:true,json:async()=>response }
    }
    assert.equal((await requestRoadRoute(from,to)).distanceKm,4.2)
    const aborted = new AbortController(); aborted.abort()
    await assert.rejects(requestRoadRoute(from,to,{signal:aborted.signal}))
    assert.equal(calls,1)
    globalThis.fetch = () => new Promise(()=>{})
    await assert.rejects(requestRoadRoute(from,to,{timeoutMs:20}))
  } finally { globalThis.fetch = original }
})
