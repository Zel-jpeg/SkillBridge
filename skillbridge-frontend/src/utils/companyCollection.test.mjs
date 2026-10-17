import test from 'node:test'
import assert from 'node:assert/strict'
import { companyDisclosures, companyLocation, positionDisclosureKey } from './companyCollection.js'

test('disclosures use stable company/position IDs and do not mutate prior state', () => {
  const initial = new Set()
  const key = positionDisclosureKey(1, 12)
  const expanded = companyDisclosures(initial, { type: 'toggle', key })
  assert.equal(initial.size, 0)
  assert.equal(expanded.has(key), true)
  assert.equal(companyDisclosures(expanded, { type: 'toggle', key }).size, 0)
  assert.notEqual(positionDisclosureKey(1, 23), positionDisclosureKey(12, 3))
})

test('background reconciliation retains surviving expansions and prunes deleted records', () => {
  const expanded = new Set(['1:10', '1:11', '2:20'])
  const companies = [{ id: 1, positions: [{ id: 10 }, { id: 11 }] }, { id: 2, positions: [{ id: 20 }] }]
  assert.equal(companyDisclosures(expanded, { type: 'reconcile', companies }), expanded)
  const next = companyDisclosures(expanded, { type: 'reconcile', companies: [{ id: 1, positions: [{ id: 11 }] }] })
  assert.deepEqual([...next], ['1:11'])
  assert.equal(expanded.size, 3)
  assert.equal(companyDisclosures(next, { type: 'reconcile', companies: [] }).size, 0)
})

test('location summary uses structured city/province without guessing legacy string fields', () => {
  const company = { address: 'Full street, Barangay, City, Province', addressParts: { street: 'Full street', barangay: 'Barangay', city: 'City', province: 'Province' } }
  assert.equal(companyLocation(company), 'City · Province')
  assert.equal(company.address, 'Full street, Barangay, City, Province')
  assert.equal(companyLocation({ address: 'Legacy address' }), 'View address')
  assert.equal(companyLocation({ address: 'No address set' }), 'No address set')
  assert.equal(companyLocation({ addressParts: { city: 'City only' } }), 'City only')
})
