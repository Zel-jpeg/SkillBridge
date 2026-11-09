import test from 'node:test'
import assert from 'node:assert/strict'
import { ALL_ORGANIZATIONS, matchesOrganization, scopedPartners } from './organizationScope.js'

const it = { id: 1, institute_id: 10 }
const tourism = { id: 2, institute_id: 20 }
const options = {
  institutes: [{ id: 10, code: 'IC', name: 'Institute of Computing' }, { id: 20, code: 'IBPA', name: 'Other institute' }],
  programs: [it, tourism],
}

test('a recorded mixed batch belongs to its institute and keeps its unset program', () => {
  const mixed = { institute_id: 10, program_id: null }
  assert.equal(matchesOrganization(mixed, { institute: '10', program: '' }), true)
  assert.equal(matchesOrganization(mixed, { institute: '10', program: '1' }), true)
  assert.equal(matchesOrganization(mixed, { institute: '20', program: '2' }), false)
  assert.equal(matchesOrganization({ institute_id: null, program_id: null }, { institute: '10', program: '1' }), false)
  assert.equal(matchesOrganization({ institute_id: 10, program_id: 3 }, { institute: '10', program: '1' }), false)
  assert.equal(matchesOrganization(null, ALL_ORGANIZATIONS), true)
})

test('scoped catalogs keep one shared opening, display legacy openings at institute level, and retain unscoped partners in All', () => {
  const shared = { id: 1, eligibility_configured: true, eligible_programs: [it, tourism], remaining_slots: 0 }
  const legacy = { id: 2, eligibility_configured: false }
  const closed = { id: 3, eligibility_configured: true, management_program_id: 2 }
  const companies = [{ id: 1, positions: [shared, legacy, closed] }, { id: 2, positions: [] }]
  assert.equal(scopedPartners(companies, ALL_ORGANIZATIONS, options), companies)
  assert.deepEqual(scopedPartners(companies, { institute: '10', program: '' }, options)[0].positions, [shared, legacy])
  assert.deepEqual(scopedPartners(companies, { institute: '10', program: '1' }, options)[0].positions, [shared, legacy])
  assert.deepEqual(scopedPartners(companies, { institute: '20', program: '2' }, options)[0].positions, [shared, closed])
})

test('shared openings remain visible in both sibling programs while exclusive openings stay within their program', () => {
  const sibling = { id: 3, institute_id: 10 }
  const extra = { ...options, programs: [...options.programs, sibling] }
  const original = { id: 11, eligibility_configured: false }
  const specific = { id: 12, eligibility_configured: true, eligible_programs: [it] }
  const sharedElsewhere = { id: 13, eligibility_configured: true, eligible_programs: [tourism] }
  const companies = [{ id: 20, positions: [original, specific, sharedElsewhere] }]
  assert.deepEqual(scopedPartners(companies, { institute: '10', program: '1' }, extra)[0].positions, [original, specific])
  assert.deepEqual(scopedPartners(companies, { institute: '10', program: '3' }, extra)[0].positions, [original])
  assert.deepEqual(scopedPartners(companies, { institute: '20', program: '2' }, extra)[0].positions, [sharedElsewhere])
  assert.equal(companies[0].positions.length, 3)
})

test('explicitly shared openings work in any institute without exposing a sibling-only opening', () => {
  const sibling = { id: 4, institute_id: 20 }
  const extra = { ...options, programs: [...options.programs, sibling] }
  const shared = { id: 21, eligibility_configured: true, eligible_programs: [tourism, sibling] }
  const specific = { id: 22, eligibility_configured: true, eligible_programs: [tourism] }
  const companies = [{ id: 30, positions: [shared, specific] }]
  assert.deepEqual(scopedPartners(companies, { institute: '20', program: '4' }, extra)[0].positions, [shared])
  assert.equal(scopedPartners(companies, { institute: '10', program: '1' }, extra).length, 0)
})
