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
  assert.equal(matchesOrganization(mixed, { institute: '10', program: '1' }), false)
  assert.equal(matchesOrganization(null, ALL_ORGANIZATIONS), true)
})

test('scoped catalogs keep one shared opening, display legacy openings at institute level, and retain unscoped partners in All', () => {
  const shared = { id: 1, eligibility_configured: true, eligible_programs: [it, tourism], remaining_slots: 0 }
  const legacy = { id: 2, eligibility_configured: false }
  const closed = { id: 3, eligibility_configured: true, management_program_id: 2 }
  const companies = [{ id: 1, positions: [shared, legacy, closed] }, { id: 2, positions: [] }]
  assert.equal(scopedPartners(companies, ALL_ORGANIZATIONS, options), companies)
  assert.deepEqual(scopedPartners(companies, { institute: '10', program: '' }, options)[0].positions, [shared, legacy])
  assert.deepEqual(scopedPartners(companies, { institute: '10', program: '1' }, options)[0].positions, [shared])
  assert.deepEqual(scopedPartners(companies, { institute: '20', program: '2' }, options)[0].positions, [shared, closed])
})
