import assert from 'node:assert/strict'
import { test } from 'node:test'
import { googleMapsPin, lookupPartnerAddress } from './partnerLocation.js'

test('Google Maps import uses an explicit pin and never the viewport center', () => {
  const pin = { lat: 14.582, lng: 120.984 }
  assert.deepEqual(googleMapsPin('https://www.google.com/maps/place/Partner/@14.4,120.7,17z/data=!8m2!3d14.582!4d120.984'), pin)
  assert.deepEqual(googleMapsPin('https://www.google.com/maps/search/?api=1&query=14.582%2C120.984'), pin)
  assert.deepEqual(googleMapsPin('https://maps.google.com/?q=14.582,120.984'), pin)
  for (const value of [
    'https://www.google.com/maps/place/Partner/@14.582,120.984,17z',
    'https://www.google.com/maps/search/?api=1&query=Manila',
    'https://www.google.com/maps/search/?query=14.582,120.984&query_place_id=place',
    'https://www.google.com/maps/place/Partner/data=!3d14.582!4d120.984!3d15!4d121',
    'https://www.google.com/maps/search/?query=91,120.984',
    'https://www.google.com.example.org/maps/search/?query=14.582,120.984',
    'https://maps.app.goo.gl/Example',
  ]) assert.equal(googleMapsPin(value), null, value)
})

test('NCR lookup picks Manila through PSGC and fills only a verified barangay', async t => {
  let district = 'Ermita'
  t.mock.method(globalThis, 'fetch', async url => {
    const { hostname, pathname } = new URL(url)
    if (hostname === 'photon.komoot.io') return Response.json({ features: [{
      properties: { state: 'Metro Manila', city: 'Manila', district, countrycode: 'PH' },
    }] })
    const lists = {
      '/api/provinces/': [{ code: '112300000', name: 'Davao del Norte' }],
      '/api/regions/130000000/cities-municipalities/': [{ code: '133900000', name: 'City of Manila' }],
      '/api/cities-municipalities/133900000/barangays/': [{ code: '133901001', name: 'Barangay 1' }],
    }
    assert.equal(hostname, 'psgc.gitlab.io')
    assert.ok(pathname in lists, pathname)
    return Response.json(lists[pathname])
  })
  const pin = { lat: 14.582, lng: 120.984 }
  const partial = await lookupPartnerAddress(pin)
  assert.deepEqual(partial.selected, {
    province: 'Metro Manila (NCR)', provinceCode: '130000000',
    city: 'City of Manila', cityCode: '133900000', barangay: '',
  })
  assert.equal(partial.barangays[0].name, 'Barangay 1')
  district = 'Barangay 1'
  assert.equal((await lookupPartnerAddress(pin)).selected.barangay, 'Barangay 1')
})
