import test from 'node:test'
import assert from 'node:assert/strict'
import { validPin, haversineKm, enrichRecommendation, sortRecommendations, groupRecommendationsByCompany, sortCompanyPositions } from './recommendationResults.js'

test('invalid or incomplete coordinates remain missing; valid numeric strings are normalized', () => {
  for (const pair of [[NaN, 125], [Infinity, 125], [91, 125], [7, 181], [true, 125], ['', 125], [null, 125], [[], 125]]) {
    assert.equal(validPin(...pair), null)
    assert.equal(haversineKm(7, 125, ...pair), null)
    const row = enrichRecommendation({ lat: pair[0], lng: pair[1], match_score: 50 }, null)
    assert.equal(row.lat, null)
    assert.equal(row.lng, null)
    assert.equal(row.distKm, null)
  }
  assert.deepEqual(validPin('7', '125'), { lat: 7, lng: 125 })
  assert.equal(haversineKm(7, 125, 7, 125), 0)
  assert.ok(Number.isFinite(haversineKm(0, 0, 0, 180)))
})

test('ranking keeps score precision and breaks exact ties by stable position id', () => {
  const input = [{ position_id: 3, match_score: 70.01 }, { position_id: 2, match_score: 70.02 }, { position_id: 1, match_score: 70.01 }]
  const rows = input.map(row => enrichRecommendation(row, null))
  assert.equal(rows[0].match, 70.01)
  assert.deepEqual(sortRecommendations(rows).map(row => row.position_id), [2, 1, 3])
  assert.deepEqual(input.map(row => row.position_id), [3, 2, 1])
})

test('distance mode puts missing distances last and breaks ties by score then position', () => {
  const rows = [{ position_id: 3, match_score: 90, distKm: null }, { position_id: 2, match_score: 50, distKm: 1 },
    { position_id: 1, match_score: 60, distKm: 1 }]
  assert.deepEqual(sortRecommendations(rows, 'distance').map(row => row.position_id), [1, 2, 3])
})

test('company cards use the highest individual position score and retain all position counts', () => {
  const rows = [
    { id: 1, company_id: 10, position_id: 101, match_score: 54.16, distKm: 5 },
    { id: 2, company_id: 20, position_id: 201, match_score: 73.43, distKm: 1 },
    { id: 3, company_id: 10, position_id: 102, match_score: 73.44, distKm: 5 },
    { id: 4, company_id: 10, position_id: 103, match_score: 65.25, distKm: 5 },
  ]
  const grouped = groupRecommendationsByCompany(rows)
  assert.deepEqual(grouped.map(row => [row.company_id, row.position_id, row.match_score, row.suggestedPositionCount]),
    [[10, 102, 73.44, 3], [20, 201, 73.43, 1]])
  const nearest = groupRecommendationsByCompany(rows, 'distance')
  assert.deepEqual(nearest.map(row => row.position_id), [201, 102])
  assert.deepEqual(rows.map(row => row.match_score), [54.16, 73.43, 73.44, 65.25])
})

test('same-name companies remain separate and exact ties keep position-ID ordering', () => {
  const rows = [
    { company_id: 20, company: 'Same name', position_id: 202, match_score: 70 },
    { company_id: 10, company: 'Same name', position_id: 102, match_score: 70 },
    { company_id: 10, company: 'Same name', position_id: 101, match_score: 70 },
  ]
  assert.deepEqual(groupRecommendationsByCompany(rows).map(row => row.position_id), [101, 202])
  const legacy = rows.map(({ company_id, ...row }) => { assert.ok(company_id); return row })
  assert.equal(groupRecommendationsByCompany(legacy).length, 3)
})

test('company details rank all scored positions including zero before unscored positions', () => {
  const positions = [{ id: 5, match_score: null }, { id: 3, match_score: 0 },
    { id: 2, match_score: 54.16 }, { id: 1, match_score: 54.16 }, { id: 4 }]
  assert.deepEqual(sortCompanyPositions(positions).map(row => row.id), [1, 2, 3, 4, 5])
  assert.deepEqual(positions.map(row => row.id), [5, 3, 2, 1, 4])
})
