import test from 'node:test'
import assert from 'node:assert/strict'
import { sortRecommendations, groupRecommendationsByCompany, sortCompanyPositions, recommendationDisplay,
  recommendationValue, coverageDisplay, placementRecommendation, recommendationMetrics, comparePositionCandidates } from './recommendationResults.js'
import { normalizeDashboardStudent, dashboardHighlights } from './dashboardStudents.js'
import { studentCardEvidence } from './studentCard.js'
import { studentDetailState } from './studentDetail.js'

const row = (id, rank, coverage, score = 1) => ({ id, position_id: id, company_id: id,
  assessment_rank: rank, match_score: score, ranking_policy: 'assessment-led-option3',
  assessment_details: { policy: 'assessment-led-option3', coverage }, requirement_coverage: coverage })

test('saved personal order overrides legacy hybrid; all partners and nearest sorting remain available', () => {
  const a = { ...row(1, 2, 100, 99), distKm: 1 }
  const b = { ...row(2, 1, 100), distKm: 40 }
  assert.deepEqual(sortRecommendations([a, b]).map(r => r.id), [2, 1])
  assert.deepEqual(sortCompanyPositions([a, b]).map(r => r.id), [2, 1])
  assert.deepEqual(groupRecommendationsByCompany([a, b]).map(r => r.id), [2, 1])
  assert.deepEqual(groupRecommendationsByCompany([a, b], 'distance').map(r => r.id), [1, 2])
  assert.equal(recommendationDisplay(b), '#1')
  assert.equal(recommendationValue(b), 100)
  assert.equal(recommendationDisplay({ match_score: 47.06 }), '47.06%')
})

test('sub-100 coverage is never displayed as 100 and metrics retain raw NLP percentage', () => {
  const item = { ...row(1, 1, 99.999), nlp_score_component: 15.3, location_score_component: 96.69 }
  assert.equal(coverageDisplay(item), '<100%')
  assert.equal(coverageDisplay(row(2, 2, 100)), '100.0%')
  assert.deepEqual(recommendationMetrics(item).slice(0, 3), [
    ['Recommendation order', '#1'], ['Requirement coverage', '<100%'], ['NLP text similarity', '15.3%']])
  assert.equal(coverageDisplay(row(3, 3, null)), 'Unavailable')
})

test('decision presentation reads frozen audit evidence, including historical legacy fallback', () => {
  const snapshot = { ranking_policy: 'assessment-led-option3', recommendation_rank: 2,
    assessment_details: { policy: 'assessment-led-option3', coverage: 95 } }
  const placement = { recommendation_evidence: snapshot, match_score_at_assignment: 47, nlp_score_component_at_assignment: 15 }
  assert.equal(recommendationDisplay(placementRecommendation(placement)), '#2')
  assert.equal(coverageDisplay(placementRecommendation(placement)), '95.0%')
  assert.equal(recommendationMetrics(placementRecommendation(placement))[2][1], '15.0%')
  assert.equal(recommendationDisplay(placementRecommendation({ match_score_at_assignment: 47 })), '47%')
  assert.equal(placementRecommendation({}).match_score, undefined)
})

test('candidate comparison uses required-category scores; personal ranks cannot pick a student', () => {
  const a = { ...row(1, 1, 100, 99), assessment_details: { policy: 'assessment-led-option3', all_targets_met: true, required_mean: 80, support: 100 } }
  const b = { ...row(2, 3, 100), assessment_details: { policy: 'assessment-led-option3', all_targets_met: true, required_mean: 90, support: 0 } }
  assert.deepEqual([a, b].sort(comparePositionCandidates).map(r => r.id), [2, 1])
})

test('stale recommendations never hide valid category profiles in staff cards or details', () => {
  const raw = { id: 1, name: 'Synthetic learner', has_submitted: true,
    recommendations_locked: true, competency_locked: false,
    combined_category_scores: [{ category: 'Custom domain', percentage: 90, raw_score: 9, max_score: 10 }],
    combined_competency_profile: { summary: 'Saved assessment evidence' }, top_recommendations: [] }
  const student = normalizeDashboardStudent(raw)
  assert.deepEqual(student.scores, { 'Custom domain': 90 })
  assert.equal(studentCardEvidence(student).overall, 90)
  assert.equal(studentCardEvidence(student).recommendation, null)
  assert.equal(studentDetailState(student).combined.length, 1)
  assert.equal(studentDetailState(student).recommendations.length, 0)
  assert.equal(dashboardHighlights([student]).leaders.length, 1)
  assert.equal(dashboardHighlights([student]).topMatches.length, 0)
})
