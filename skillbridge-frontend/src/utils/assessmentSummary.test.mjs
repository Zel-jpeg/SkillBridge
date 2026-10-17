import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { assessmentSummary, categoryPercentage } from './assessmentSummary.js'
import { studentDetailState } from './studentDetail.js'
import { studentCompetencySections } from './assessmentReportPdf.js'

const cases = JSON.parse(readFileSync(new URL('../../../knowledge/fixtures/assessment_summaries.json', import.meta.url)))
for (const fixture of cases) test(fixture.name, () => {
  const result = assessmentSummary(fixture.scores, fixture.options)
  assert.deepEqual(result, fixture.expected)
  assert.doesNotMatch([result.highestLabel, result.summary, ...result.suggestions.map(item => item.message)].join(' '), /\u2014|\u00a0|&#xA0;|&nbsp;/i)
  if (fixture.options?.scope === 'individual' || fixture.options?.audience === 'student') return
  const locked = fixture.options?.locked ?? false
  for (const normalized of [false, true]) {
    const state = studentDetailState(normalized
      ? { combinedCategoryScores: fixture.scores, recommendationsLocked: locked }
      : { combined_category_scores: fixture.scores, recommendations_locked: locked })
    assert.equal(assessmentSummary(state.combined, { locked: state.locked }).summary, result.summary)
  }
  const exported = studentCompetencySections({ recommendations_locked: locked, combined_category_scores: fixture.scores,
    combined_competency_profile: { orientation_summary: 'Old misleading orientation' } })
  assert.equal(exported.summary, locked ? '' : result.summary)
  assert.equal(exported.suggestions.length, result.suggestions.length)
})

test('distinct API percentages stay distinct, including numeric strings and missing values', () => {
  assert.equal(categoryPercentage(83.33), '83.33%')
  assert.equal(categoryPercentage('83.34'), '83.34%')
  for (const value of [null, undefined, '', ' ', false, NaN, Infinity, 'bad']) assert.equal(categoryPercentage(value), 'Not available')
})

test('ties are independent of category ID and input order, with no display cap', () => {
  const scores = Array.from({ length: 8 }, (_, i) => ({ category: `Category ${i}`, category_id: 8 - i, percentage: 100 }))
  assert.equal(assessmentSummary(scores).leaders.length, 8)
  assert.deepEqual(assessmentSummary(scores.toReversed()).leaders.toReversed(), assessmentSummary(scores).leaders)
})

test('the requested example reports three leaders and programming development only', () => {
  const result = assessmentSummary([
    { category: 'Database Management', percentage: 100 },
    { category: 'Networking', percentage: 100 },
    { category: 'Web Development', percentage: 100 },
    { category: 'Programming', percentage: 50 },
  ])
  assert.equal(result.highestLabel, 'Highest-scoring areas: tied at 100%')
  assert.equal(result.highestNames, 'Database Management · Networking · Web Development')
  assert.match(result.summary, /equally highest in these 3 areas/)
  assert.match(result.summary, /Programming: 50%/)
  assert.deepEqual(result.suggestions, [{ category: 'Programming', percentage: 50,
    message: 'Continue guided practice and practical activities in programming.' }])
})
