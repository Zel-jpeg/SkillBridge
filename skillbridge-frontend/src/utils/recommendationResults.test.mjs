import test from 'node:test'
import assert from 'node:assert/strict'
import { validPin, haversineKm, enrichRecommendation, sortRecommendations } from './recommendationResults.js'

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
