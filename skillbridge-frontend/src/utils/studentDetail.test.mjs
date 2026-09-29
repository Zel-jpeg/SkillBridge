import test from 'node:test'
import assert from 'node:assert/strict'
import { isCurrentPlacement, lockExplanation, percentLabel, studentDetailState, suggestionText } from './studentDetail.js'

test('missing lock defaults closed and hides all final data, including stale profile', () => {
  const state = studentDetailState({ combinedCompetencyProfile: { orientation_label: 'SECRET' }, combinedCategoryScores: [{ percentage: 99 }], top_recommendations: [{ match_score: 99 }] })
  assert.equal(state.locked, true)
  assert.equal(state.profile, null)
  assert.deepEqual(state.combined, [])
  assert.deepEqual(state.recommendations, [])
})

test('progress uses API counts rather than submitted/flagged assessment counting', () => {
  const state = studentDetailState({ assessment_results: [{ attempt_status: 'submitted', is_flagged: true }], completed_required_count: 2, total_required_count: 3, remaining_required_count: 1 })
  assert.equal(state.percentage, 67)
  assert.equal(state.remaining, 1)
  assert.match(lockExplanation(state), /1 remaining required assessment with valid submitted attempts/)
})

test('no required assessments never implies completion', () => {
  const state = studentDetailState({ totalRequiredCount: 0 })
  assert.equal(state.percentage, 0)
  assert.equal(state.completionLabel, 'No required assessments')
  assert.match(lockExplanation(state), /No required assessments/)
})

test('complete but locked evidence explains finalization rather than zero pending assessments', () => {
  assert.match(lockExplanation({ total: 2, remaining: 0 }), /current and finalized in an active batch/)
})

test('unlocked evidence is not recalculated, known stale recommendations are omitted', () => {
  const scores = [{ category_id: 1, raw_score: 7, max_score: 11, percentage: 63.64 }]
  const state = studentDetailState({ recommendations_locked: false, combined_category_scores: scores, top_recommendations: [{ id: 1, match_score: 67 }, { id: 2, is_current: false }], assessment_results: [{ prior_attempts: [{ attempt_number: 1 }, { attempt_number: 2 }] }] })
  assert.equal(state.combined, scores)
  assert.deepEqual(state.recommendations, [{ id: 1, match_score: 67 }])
  assert.equal(state.historyCount, 2)
})

test('missing scores and structured development suggestions have honest formatting', () => {
  assert.equal(percentLabel(0), '0.0%')
  assert.equal(percentLabel(null), 'Not available')
  assert.equal(percentLabel('invalid'), 'Not available')
  assert.equal(suggestionText({ category: 'Networking', percentage: 60, message: 'Practice routing.' }), 'Networking (60.0%): Practice routing.')
  assert.equal(suggestionText('Practice routing.'), 'Practice routing.')
})

test('recommendations do not imply approved placement; IDs take precedence', () => {
  const rec = { position_id: 9, company: 'QA Company', position: 'QA Position' }
  const placement = { status: 'approved', company: { name: 'QA Company' }, position: { id: 8, title: 'QA Position' } }
  assert.equal(isCurrentPlacement(rec, placement), false)
  assert.equal(isCurrentPlacement({ ...rec, position_id: 8 }, placement), true)
  assert.equal(isCurrentPlacement(rec, { ...placement, status: 'unplaced' }), false)
  assert.equal(isCurrentPlacement({ company: 'QA Company', position: 'QA Position' }, placement), true)
})
