import test from 'node:test'
import assert from 'node:assert/strict'
import { adminDashboardCards, adminDashboardStudents, adminOrganizationHighlights, averageCategoryScore } from './adminDashboard.js'

const options = { institutes: [{ id: 1, code: 'ONE' }, { id: 2, code: 'TWO' }], programs: [{ id: 11, institute_id: 1, code: 'A' }, { id: 12, institute_id: 1, code: 'B' }] }
const row = { id: 8, name: 'Synthetic learner', batch_id: 4, batch: 'Synthetic batch', batch_status: 'active', institute_id: 1, program_id: null,
  detail_url: '/api/instructor/batches/4/students/?student_id=8', required_complete: true, required_completed: 2, required_total: 2,
  competency_locked: false, recommendations_locked: false, placement_status: 'unplaced',
  combined_category_scores: [{ category_id: 4, category: 'Communication', percentage: 0, raw_score: 0, max_score: 10 }],
  top_recommendations: [{ ranking_policy: 'assessment-evidence-match-v2', match_percentage: 77.5, match_score: 10, position: 'Intern', company: 'Synthetic partner' }] }
const data = { students: [row], skills: [{ id: 4, name: 'Communication' }] }
test('dashboard preserves zero, saved Match units and batch-specific detail scope', () => {
  const [s] = adminDashboardStudents(data, options)
  assert.equal(s.scores.Communication, 0)
  assert.equal(s.match, 77.5)
  assert.equal(s.detailUrl, row.detail_url)
  assert.equal(s.batch.id, 4)
  assert.equal(s.organization, 'ONE · Shared programs')
  assert.equal(s.status, 'completed')
  assert.equal(averageCategoryScore(s), 0)
})
test('stale rankings do not erase independent valid category evidence', () => {
  const [s] = adminDashboardStudents({ ...data, students: [{ ...row, recommendations_locked: true }] }, options)
  assert.equal(s.match, null)
  assert.equal(s.scores.Communication, 0)
  const [locked] = adminDashboardStudents({ ...data, students: [{ ...row, competency_locked: true }] }, options)
  assert.deepEqual(locked.scores, {})
  assert.equal(averageCategoryScore(locked), null)
})
test('same category names from separate saved definitions stay distinct', () => {
  const duplicate = { category_id: 5, category: 'Communication', percentage: 100 }
  const [s] = adminDashboardStudents({ ...data, skills: [...data.skills, { id: 5, name: 'Communication', framework_label: 'Program A v2' }],
    students: [{ ...row, combined_category_scores: [...row.combined_category_scores, duplicate] }] }, options)
  assert.equal(Object.keys(s.scores).length, 2)
  assert.equal(averageCategoryScore(s), 50)
  assert.equal(new Set(s.combinedCategoryScores.map(score => score.category)).size, 2)
})
test('institute counts stay distinct; shared students appear in both programs; empty cards remain', () => {
  const students = adminDashboardStudents(data, options)
  assert.deepEqual(adminOrganizationHighlights(students, options).map(r => [r.students, r.matches, r.assessed, r.categories]), [[1, 1, 1, 1], [0, 0, 0, 0]])
  assert.deepEqual(adminOrganizationHighlights(students, options, '1').map(r => [r.students, r.shared, r.matches]), [[1, 1, 1], [1, 1, 1]])
  assert.equal(adminOrganizationHighlights(students, options, '2').length, 0)
})
test('summary keeps completion, actual follow-up and approved placements separate with scoped links', () => {
  const cards = adminDashboardCards({ summary: { students: 10, required_complete: 7, needs_followup: 2, approved: 1, unplaced: 9, completion_rate: 70, placement_rate: 10 } }, { institute: '1', program: '11', status: 'archived' })
  assert.equal(cards.length, 4)
  assert.equal(cards[2].value, 2)
  assert.equal(cards[1].progress, 70)
  assert.equal(cards[3].value, '1 / 10')
  assert.match(cards[0].description, /archived/)
  assert.match(cards[2].to, /program_id=11/)
  assert.match(cards[2].to, /group=followup/)
})
