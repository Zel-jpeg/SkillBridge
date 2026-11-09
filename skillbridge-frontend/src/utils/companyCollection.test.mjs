import test from 'node:test'
import assert from 'node:assert/strict'
import { companyDisclosures, companyLocation, coordinatorCompanyCard, coordinatorPositionRequest, positionDisclosureKey, positionRequirementRows } from './companyCollection.js'

test('coordinator cards use structured addresses without changing scope or capabilities', () => {
  const raw = { id: 4, name: 'Shared partner', address: { street: 'Service Road', city: 'Panabo', province: 'Davao del Norte' },
    can_edit: true, can_archive: false, positions: [{ id: 7, can_edit: true, can_archive: false }] }
  const card = coordinatorCompanyCard(raw)
  assert.equal(card.address, 'Service Road, Panabo, Davao del Norte')
  assert.equal(companyLocation(card), 'Panabo · Davao del Norte')
  assert.equal(card.positions, raw.positions)
  assert.equal(card.can_archive, false)
  assert.equal(raw.address.street, 'Service Road')
  assert.equal(coordinatorCompanyCard({ address: null }).address, null)
})

test('coordinator shared editing preserves the requirement format and excludes authority fields', () => {
  const values = { title: 'Shared role', description: 'Updated role context', slots: 3, tags: ['Records'],
    requirements: { Records: 55 }, category_requirements: [], eligible_program_ids: [999], created_by: 123 }
  const shared = coordinatorPositionRequest(values, { shared_institute: { id: 1 }, eligibility_configured: false, can_edit_requirements: true })
  assert.deepEqual(shared, { title: values.title, description: values.description, slots: 3, tags: ['Records'], requirements: { Records: 55 } })
  const otherRubric = coordinatorPositionRequest(values, { can_edit_requirements: false })
  assert.equal('requirements' in otherRubric, false)
  assert.equal('category_requirements' in otherRubric, false)
  assert.deepEqual(coordinatorPositionRequest(values, null, true).category_requirements, [])
  assert.equal(coordinatorPositionRequest(values, null, true).reuse_existing, true)
  assert.deepEqual(coordinatorPositionRequest({ ...values, requirements: {} }, { shared_institute: {}, can_edit_requirements: true }).requirements, {})
})

test('opening details retain shared numerical requirements and prefer exact program rows', () => {
  assert.deepEqual(positionRequirementRows({ requirements: { Programming: 50, 'Web Development': 90 }, category_requirements: [] }),
    [{ name: 'Programming', percentage: 50 }, { name: 'Web Development', percentage: 90 }])
  const scoped = [{ category_id: 3, name: 'Records', percentage: 75 }]
  assert.equal(positionRequirementRows({ category_requirements: scoped, requirements: { Records: 40 } }), scoped)
  assert.deepEqual(positionRequirementRows({}), [])
})

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
