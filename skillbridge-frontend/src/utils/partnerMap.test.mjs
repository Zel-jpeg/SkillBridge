import test from 'node:test'
import assert from 'node:assert/strict'
import { partnerMapData, partnerMembership, groupPartnerPins, instituteMapColor } from './partnerMap.js'

const institutes = [{ id: 1, code: 'IC', name: 'Computing' }, { id: 2, code: 'IBPA', name: 'Business' }, { id: 3, code: 'FIELD', name: 'Synthetic fields' }]
const programs = [{ id: 11, institute_id: 1, code: 'IT', name: 'Technology' }, { id: 21, institute_id: 2, code: 'ENT', name: 'Enterprise' }, { id: 22, institute_id: 2, code: 'TOUR', name: 'Tourism' }]
const options = { institutes, programs, shared_skill_institute_id: 1 }
const all = { institute: '', program: '' }
const opening = (id, eligible, remaining = 2) => ({ id, eligibility_configured: true, eligible_programs: eligible, remaining_slots: remaining })
const companies = [
  { id: 1, name: 'Original IC', lat: 7, lng: 125, positions: [{ id: 1, eligibility_configured: false, remaining_slots: 4 }] },
  { id: 2, name: 'Shared program partner', lat: 8, lng: 125, positions: [opening(2, [programs[1], programs[2]], 0), opening(3, [programs[2]], 3)] },
  { id: 3, name: 'Owned empty partner', management_program_id: 21, lat: null, lng: null, positions: [] },
  { id: 4, name: 'Shared institute partner', lat: 8, lng: 125, positions: [opening(4, [programs[0], programs[1]], 1)] },
  { id: 5, name: 'Unassigned partner', lat: 0, lng: 0, positions: [] },
]

test('school map includes active partners and counts missing locations without inventing pins', () => {
  const data = partnerMapData(companies, options, all)
  assert.equal(data.rows.length, 5)
  assert.equal(data.mapped.length, 4)
  assert.equal(data.missing, 1)
  assert.equal(data.rows.find(row => row.id === 5).markerLabel, 'Unassigned')
})
test('institute and program selection strictly removes unrelated partners and openings', () => {
  const institute = partnerMapData(companies, options, { institute: '2', program: '' })
  assert.deepEqual(institute.rows.map(row => row.id), [2, 3, 4])
  const tourism = partnerMapData(companies, options, { institute: '2', program: '22' })
  assert.deepEqual(tourism.rows.map(row => row.id), [2])
  assert.equal(tourism.rows[0].remaining, 3)
  const enterprise = partnerMapData(companies, options, { institute: '2', program: '21' })
  assert.deepEqual(enterprise.rows[0].positions.map(row => row.id), [2])
  assert.equal(enterprise.rows[0].remaining, 0)
})
test('original shared IC openings stay with IC, without assigning them to another program', () => {
  assert.equal(partnerMapData(companies, options, { institute: '1', program: '' }).rows.some(row => row.id === 1), true)
  assert.equal(partnerMapData(companies, options, { institute: '1', program: '11' }).rows.some(row => row.id === 1), true)
  assert.equal(partnerMapData(companies, options, { institute: '2', program: '21' }).rows.some(row => row.id === 1), false)
  assert.equal(partnerMembership(companies[0], options).icShared, true)
})
test('shared institutes are labeled once and capacity is not multiplied by eligible programs', () => {
  const shared = partnerMapData(companies, options, all).rows.find(row => row.id === 4)
  assert.equal(shared.markerLabel, 'Shared')
  assert.equal(shared.remaining, 1)
  assert.deepEqual(shared.institutes.map(row => row.code), ['IC', 'IBPA'])
})
test('invalid context or zero matches never falls back to all pins', () => {
  for (const scope of [{ institute: '999', program: '' }, { institute: '1', program: '21' }, { institute: '', program: '21' }]) {
    assert.equal(partnerMapData(companies, options, scope).mapped.length, 0)
  }
  assert.equal(partnerMapData(companies, options, { institute: '3', program: '' }).mapped.length, 0)
})
test('archived partners/openings and invalid coordinates are explicit', () => {
  const fixtures = [{ ...companies[0], archived_at: '2026-01-01' }, { ...companies[1], lat: true },
    { ...companies[2], lat: 100, lng: 125 }, { ...companies[3], positions: [{ ...companies[3].positions[0], archived_at: '2026-01-01' }] }]
  assert.equal(partnerMapData(fixtures, options, all).mapped.length, 1)
  assert.equal(partnerMapData(fixtures, options, all, 'archived').mapped.length, 1)
  assert.equal(partnerMapData(fixtures, options, { institute: '2', program: '' }).rows.some(row => row.id === 4), false)
})
test('overlapping saved coordinates retain every partner in a single accessible marker', () => {
  const groups = groupPartnerPins(partnerMapData(companies, options, all).mapped)
  assert.equal(groups.length, 3)
  assert.deepEqual(groups.find(group => group.length === 2).map(row => row.id), [2, 4])
})
test('map colors are stable across institute ordering and missing capacity stays unavailable', () => {
  assert.equal(instituteMapColor(2, options), instituteMapColor(2, { ...options, institutes: [...institutes].reverse() }))
  assert.notEqual(instituteMapColor(1, options), instituteMapColor(2, options))
  const row = partnerMapData([{ ...companies[0], positions: [{ eligibility_configured: false }] }], options, all).rows[0]
  assert.equal(row.remaining, null)
})
