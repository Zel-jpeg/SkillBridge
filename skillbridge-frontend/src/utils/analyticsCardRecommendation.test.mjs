import test from 'node:test'
import assert from 'node:assert/strict'
import { analyticsCardRecommendation } from './analyticsCardRecommendation.js'
import { analyticsTable } from './analytics.js'

const row = {
  name: 'Synthetic student', school_id: 'S1', course: 'BSIT', batch: 'Synthetic batch',
  instructor: 'Synthetic owner', required_completed: 1, required_total: 1,
  recommendations_locked: false, placement_status: 'suggested', reasons: [],
  company: 'Allocated partner', position: 'Allocated opening',
  company_image_url: 'https://images.example.invalid/allocated.webp',
  suggested_recommendation: { ranking_policy: 'legacy-hybrid', match_score: 30 },
  top_company: 'Highest alternative partner', top_position: 'Highest alternative opening',
  top_match: 90, top_ranking_policy: 'legacy-hybrid', top_company_image_url: 'https://images.example.invalid/highest.webp',
}

test('suggested cards keep the allocated opening and its lower score consistent with table/export', () => {
  const card = analyticsCardRecommendation(row, true)
  const table = analyticsTable({ skills: [] }, 'placements', 'map-suggested:city:example', [row])
  assert.equal(card.available, true)
  assert.equal(card.label, 'Suggested allocation')
  assert.equal(card.company, table.rows[0][8])
  assert.equal(card.imageUrl, row.company_image_url)
  assert.equal(card.position, table.rows[0][9])
  assert.equal(card.display, table.rows[0][10])
  assert.equal(card.display, '30%')
  assert.equal(analyticsCardRecommendation(row).display, '90%')
  assert.equal(analyticsCardRecommendation(row).company, 'Highest alternative partner')
  assert.equal(analyticsCardRecommendation(row).imageUrl, row.top_company_image_url)
  assert.equal(analyticsCardRecommendation({ ...row, company_image_url: null }, true).imageUrl, null)
})

test('assessment-led allocations show the allocated rank rather than the top alternative rank', () => {
  const ranked = { ...row, suggested_recommendation: {
    ranking_policy: 'assessment-led-option3', assessment_rank: 3, requirement_coverage: 85,
  }, top_ranking_policy: 'assessment-led-option3', top_recommendation_rank: 1, top_requirement_coverage: 100 }
  assert.equal(analyticsCardRecommendation(ranked, true).display, '#3')
  assert.equal(analyticsCardRecommendation(ranked).display, '#1')
})

test('missing or locked allocation never falls back to the highest alternative', () => {
  const missingRow = { ...row, suggested_recommendation: null }
  const missing = analyticsCardRecommendation(missingRow, true)
  assert.equal(missing.available, false)
  assert.equal(missing.label, 'Suggested allocation')
  assert.equal(missing.state, 'Unavailable')
  const table = analyticsTable({ skills: [] }, 'placements', 'map-suggested:city:example', [missingRow])
  assert.equal(table.rows[0][10], 'Not available')
  const locked = analyticsCardRecommendation({ ...row, recommendations_locked: true }, true)
  assert.equal(locked.available, false)
  assert.equal(locked.state, 'Locked / unavailable')
})

test('a real zero allocation score is still available', () => {
  const card = analyticsCardRecommendation({ ...row, suggested_recommendation: { match_score: 0 } }, true)
  assert.equal(card.available, true)
  assert.equal(card.display, '0%')
})
