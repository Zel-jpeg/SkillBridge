import test from 'node:test'
import assert from 'node:assert/strict'
import { validPin, haversineKm, enrichRecommendation, sortRecommendations, groupRecommendationsByCompany, sortCompanyPositions } from './recommendationResults.js'
import { recommendationDisplay, recommendationValue, recommendationLabel, coverageDisplay,
  recommendationMetrics, summaryRecommendation, placementRecommendation, assessmentMatchProgress, assessmentProgressLabel, hasUnassessedRequirements, comparePositionCandidates } from './recommendationResults.js'

const assessmentMatch = (mean, overrides = {}) => ({ match_score: 12, ranking_policy: 'assessment-average-match-v1',
  assessment_rank: 1, requirement_coverage: 100, match_percentage: mean,
  assessment_details: { policy: 'assessment-average-match-v1', required_mean: mean, all_targets_met: true, unknown: 0 }, ...overrides })

const evidenceMatch = (value, overrides = {}) => ({ match_score: 99, ranking_policy: 'assessment-evidence-match-v2',
  assessment_rank: 1, match_percentage: value,
  assessment_details: { policy: 'assessment-evidence-match-v2', match_percentage: value, required_mean: null,
    all_targets_met: false, unknown: 1, requirements: [
      { target: 50, assessed_percentage: 90 }, { target: 50, assessed_percentage: 90 }, { target: 50, assessed_percentage: null }] }, ...overrides })

test('new policy uses one saved evidence-based percentage and does not display the old partial average', () => {
  const row = evidenceMatch(60)
  assert.equal(recommendationValue(row), 60)
  assert.equal(recommendationDisplay(row), '60%')
  assert.equal(assessmentMatchProgress(row).percentage, 60)
  assert.equal(assessmentProgressLabel(row), '2 of 3 required categories assessed')
  assert.equal(hasUnassessedRequirements(row), true)
  assert.equal(recommendationMetrics(row)[0][1], '60%')
  assert.equal(recommendationDisplay(evidenceMatch(0)), '0%')
  assert.equal(recommendationDisplay(evidenceMatch(null, { match_percentage: null, assessment_details: { policy: 'assessment-evidence-match-v2' } })), 'Not available')
})

test('new cross-student ordering uses demonstrated Match within minimum status, not complete-only mean or legacy reference', () => {
  const incomplete = evidenceMatch(60, { student_id: 1, match_score: 1 })
  const below = evidenceMatch(50, { student_id: 2, match_score: 99, assessment_details: { policy: 'assessment-evidence-match-v2', all_targets_met: false, required_mean: 50, support: 100 } })
  assert.ok(comparePositionCandidates(incomplete, below) < 0)
  const summary = summaryRecommendation({ top_ranking_policy: 'assessment-evidence-match-v2', top_match_percentage: 54, top_match: 99 })
  assert.equal(recommendationValue(summary), 54)
  assert.equal(recommendationDisplay(summary), '54%')
})

test('saved old average and new evidence snapshots retain distinct units for incomplete evidence', () => {
  const old = assessmentMatch(null, { assessment_details: { policy: 'assessment-average-match-v1', required_mean: null, unknown: 1,
    requirements: [{ target: 50, assessed_percentage: 90 }, { target: 50, assessed_percentage: 90 }, { target: 50, assessed_percentage: null }] } })
  assert.equal(recommendationDisplay(old), '90% partial')
  assert.equal(recommendationDisplay(placementRecommendation({ recommendation_evidence: evidenceMatch(60), match_score_at_assignment: 99 })), '60%')
  assert.equal(recommendationValue(old), null)
})

test('assessment Match shows actual category average while coverage keeps its separate units', () => {
  const row = assessmentMatch(80)
  assert.equal(recommendationDisplay(row), '80%')
  assert.equal(recommendationValue(row), 80)
  assert.equal(recommendationLabel(row), 'Match')
  assert.equal(coverageDisplay(row), '100.0%')
  assert.deepEqual(recommendationMetrics(row).slice(0, 2), [['Match', '80%'], ['Minimum requirements', 'All met']])
})

test('incomplete assessment Match never falls back to a legacy score; assessed zero is a real percentage', () => {
  const missing = assessmentMatch(null, { assessment_details: { required_mean: null, unknown: 1, all_targets_met: false } })
  assert.equal(recommendationValue(missing), null)
  assert.equal(recommendationDisplay(missing), '0 assessed')
  assert.equal(recommendationMetrics(missing)[1][1], 'Assessment results missing')
  assert.equal(recommendationDisplay(assessmentMatch(0)), '0%')
})

test('partial percentages average only observed required categories, and cannot become final ranking values', () => {
  const partial = assessmentMatch(null, { assessment_rank: 2, assessment_details: {
    unknown: 1, all_targets_met: false, required_mean: null, requirements: [
      { target: 90, assessed_percentage: 100 }, { target: 20, assessed_percentage: 60 },
      { target: 50, assessed_percentage: null, state: 'unassessed' }, { target: 0, assessed_percentage: 5 }] } })
  const before = structuredClone(partial)
  assert.deepEqual(assessmentMatchProgress(partial), { assessed: 2, required: 3, partial: true, percentage: 80 })
  assert.equal(assessmentProgressLabel(partial), '2 of 3 required categories assessed')
  assert.equal(recommendationDisplay(partial), '80% partial')
  assert.equal(recommendationValue(partial), null)
  const complete = assessmentMatch(70, { assessment_rank: 1, position_id: 1 })
  assert.equal(sortRecommendations([partial, complete])[0], complete)
  assert.deepEqual(partial, before)
})

test('zero observed marks produce a real partial zero; no observed marks produce a count, never invented percentages', () => {
  const partial = assessmentMatch(null, { assessment_details: { required_mean: null, unknown: 1,
    requirements: [{ target: 50, assessed_percentage: 0 }, { target: 50, assessed_percentage: null }] } })
  assert.equal(recommendationDisplay(partial), '0% partial')
  partial.assessment_details.requirements[0].assessed_percentage = null
  assert.equal(recommendationDisplay(partial), '0/2 assessed')
  partial.assessment_details.requirements[0].assessed_percentage = NaN
  assert.equal(assessmentMatchProgress(partial).percentage, null)
  assert.equal(recommendationDisplay({ match_score: 77 }), '77%')
})

test('old rank/coverage and hybrid history retain saved meanings', () => {
  const previous = { ranking_policy: 'assessment-led-option3', assessment_rank: 2, requirement_coverage: 100, match_score: 12 }
  assert.equal(recommendationDisplay(previous), '#2')
  assert.equal(recommendationLabel(previous), 'Recommendation order')
  assert.equal(recommendationDisplay({ match_score: 75 }), '75%')
  const snapshot = { recommendation_evidence: { ...assessmentMatch(80) }, match_score_at_assignment: 12 }
  assert.equal(recommendationDisplay(placementRecommendation(snapshot)), '80%')
  const oldSnapshot = { recommendation_evidence: previous, match_score_at_assignment: 12 }
  assert.equal(recommendationDisplay(placementRecommendation(oldSnapshot)), '#2')
})

test('summary fields and company cards use saved position rank rather than the biggest percentage', () => {
  const top = summaryRecommendation({ top_ranking_policy: 'assessment-average-match-v1', top_match_percentage: 80,
    top_requirement_coverage: 100, top_recommendation_rank: 1, top_match: 12 })
  assert.equal(recommendationDisplay(top), '80%')
  const rows = [assessmentMatch(99, { company_id: 1, position_id: 2, assessment_rank: 2 }),
    assessmentMatch(80, { company_id: 1, position_id: 1, assessment_rank: 1 })]
  assert.equal(groupRecommendationsByCompany(rows)[0].position_id, 1)
  assert.equal(recommendationDisplay(groupRecommendationsByCompany(rows)[0]), '80%')
})

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
