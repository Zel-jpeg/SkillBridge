import test from 'node:test'
import assert from 'node:assert/strict'
import { categoryPointsLabel, dashboardHighlights, normalizeDashboardStudent, skillRankings } from './dashboardStudents.js'

const row = (id, extra = {}) => ({ id, student_name: `Student ${id}`, has_submitted: true,
  recommendations_locked: false, combined_category_scores: [{ category: 'Web', percentage: 80 }],
  top_recommendations: [{ company: 'Synthetic Agency', position: 'Developer', match_score: 75 }], ...extra })

test('both dashboard contracts retain combined evidence and read-only assessment history', () => {
  const results = [{ id: 1, title: 'Assessment', prior_attempts: [{ attempt_number: 1 }] }]
  const admin = normalizeDashboardStudent(row(1, { assessment_results: results }))
  const instructor = normalizeDashboardStudent(row(1, { assessment_results: results, skill_scores: { Web: 20 }, batch: { name: 'Cohort' }, placement: { status: 'approved' } }))
  assert.deepEqual(admin.scores, { Web: 80 })
  assert.deepEqual(admin.scores, instructor.scores)
  assert.equal(admin.assessmentResults, results)
  assert.equal(admin.placementKnown, false)
  assert.equal(instructor.placementKnown, true)
  assert.match(admin.batchLabel, /View batch details/)
})

test('locked or missing lock state suppresses historical scores and recommendation snapshots', () => {
  for (const recommendations_locked of [true, undefined]) {
    const student = normalizeDashboardStudent(row(1, { recommendations_locked, skill_scores: { Web: 100 }, top_match_score: 99 }))
    assert.deepEqual(student.scores, {})
    assert.equal(student.match, null)
    assert.deepEqual(student.top_recommendations, [])
    assert.deepEqual(dashboardHighlights([student]), { leaders: [], topMatches: [] })
  }
})

test('zero is earned evidence, while missing/non-numeric categories and stale recommendations are excluded', () => {
  const student = normalizeDashboardStudent(row(1, {
    combined_category_scores: [{ category: 'Web', percentage: 0 }, { category: 'Database', percentage: null }, { category: 'Invalid', percentage: 'oops' }],
    top_recommendations: [{ match_score: 100, is_current: false }, { match_score: null }, { match_score: 0, company: 'Synthetic Agency', position: 'Developer' }],
  }))
  assert.deepEqual(student.scores, { Web: 0 })
  assert.equal(student.match, 0)
  const { leaders, topMatches } = dashboardHighlights([student])
  assert.equal(leaders[0].score, 0)
  assert.equal(topMatches[0], student)
})

test('rankings use full scoped collection, deterministic ties, and keep source records unmodified', () => {
  const records = [row(1, { student_name: 'Zeta', top_recommendations: [{ match_score: 99 }] }), row(2, { student_name: 'Alpha', top_recommendations: [{ match_score: 10 }] }),
    ...Array.from({ length: 5 }, (_, i) => row(i + 3)), row(9, { has_submitted: false })].map(normalizeDashboardStudent)
  const original = [...records]
  const { leaders, topMatches } = dashboardHighlights(records)
  assert.equal(leaders[0].student.name, 'Alpha')
  assert.equal(topMatches[0].name, 'Zeta')
  assert.equal(topMatches.length, 4)
  assert.deepEqual(records, original)
  assert.ok(!topMatches.some(student => student.id === 9))
})

test('actual full category marks keep 100%, with raw points and shared ranks for tied students', () => {
  const students = [row(1, { student_name: 'Zeta', combined_category_scores: [{ category: 'Custom category', percentage: 100, raw_score: 9, max_score: 9 }] }),
    row(2, { student_name: 'Alpha', combined_category_scores: [{ category: 'Custom category', percentage: 100, raw_score: 20, max_score: 20 }] }),
    row(3, { combined_category_scores: [{ category: 'Custom category', percentage: 80, raw_score: 8, max_score: 10 }] })].map(normalizeDashboardStudent)
  const ranked = skillRankings(students, 'Custom category')
  assert.deepEqual(ranked.map(row => [row.student.name, row.score, row.rank]), [['Alpha', 100, 1], ['Zeta', 100, 1], ['Student 3', 80, 3]])
  assert.equal(dashboardHighlights(students).leaders[0].tiedCount, 2)
  assert.equal(categoryPointsLabel(students[0], 'Custom category'), '9/9 assessment points')
  assert.equal(categoryPointsLabel(students[1], 'Custom category'), '20/20 assessment points')
})

test('skill cards and rankings retain unlocked category results when only recommendations are stale', () => {
  const valid = normalizeDashboardStudent(row(1, { recommendations_locked: true, competency_locked: false,
    combined_category_scores: [{ category: 'Custom category', percentage: 0, raw_score: 0, max_score: 10 }] }))
  const locked = normalizeDashboardStudent(row(2, { recommendations_locked: false, competency_locked: true }))
  assert.equal(skillRankings([valid, locked], 'Custom category')[0].score, 0)
  assert.equal(dashboardHighlights([valid, locked]).leaders[0].student.id, valid.id)
  assert.equal(dashboardHighlights([valid, locked]).topMatches.length, 0)
  assert.equal(categoryPointsLabel(valid, 'Custom category'), '0/10 assessment points')
  assert.equal(categoryPointsLabel(valid, 'Missing'), null)
  assert.equal(categoryPointsLabel({ combinedCategoryScores: [{ category: 'Bad', raw_score: 1, max_score: 0 }] }, 'Bad'), null)
  assert.deepEqual(dashboardHighlights([{ id: 3, name: 'Locked compatibility row', status: 'completed',
    recommendationsLocked: true, scores: { 'Custom category': 100 } }]), { leaders: [], topMatches: [] })
})
