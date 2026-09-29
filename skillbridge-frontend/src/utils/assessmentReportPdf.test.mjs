import test from 'node:test'
import assert from 'node:assert/strict'
import { studentCompetencySections } from './assessmentReportPdf.js'

test('unlocked competency sections retain individual, combined, included and ranked evidence', () => {
  const sections = studentCompetencySections({
    student: 'Alex Student', school_id: 'S-1', batch: 'Technology 2026', instructor: 'Instructor',
    completed_required_count: 2, total_required_count: 2, recommendations_locked: false,
    individual_results: [{ title: 'Database Focus', attempt_status: 'submitted',
      category_scores: [{ category: 'Database', raw_score: 3, max_score: 4, percentage: 75 }] }],
    combined_category_scores: [{ category: 'Database', raw_score: 8, max_score: 10, percentage: 80 }],
    included_assessments: [{ title: 'Database Focus' }],
    combined_competency_profile: { orientation_summary: 'Database ready' },
    final_recommendations: [{ rank: 1, company: 'Employer', position: 'Data Intern', match_score: 84,
      category_score_component: 80, nlp_score_component: 86, location_score_component: 90 }],
    placement: { status: 'approved', company: { name: 'Employer' }, position: { title: 'Data Intern' } },
  })
  assert.match(sections.individual[0][2], /3\/4 \(75\.0%\)/)
  assert.deepEqual(sections.combined[0], ['Database', '8/10', '80.0%'])
  assert.deepEqual(sections.included, ['Database Focus'])
  assert.equal(sections.summary, 'Database ready')
  assert.deepEqual(sections.recommendations[0].slice(0, 3), ['1', 'Employer', 'Data Intern'])
  assert.match(sections.placement, /Approved: Employer/)
})

test('locked competency sections suppress stale profile and recommendation fields', () => {
  const sections = studentCompetencySections({ recommendations_locked: true,
    combined_category_scores: [{ category: 'Private', raw_score: 1, max_score: 1, percentage: 100 }],
    included_assessments: [{ title: 'Private assessment' }],
    combined_competency_profile: { orientation_summary: 'Private summary' },
    final_recommendations: [{ company: 'Private employer' }],
    placement: { status: 'unplaced' },
  })
  assert.deepEqual(sections.combined, [])
  assert.deepEqual(sections.included, [])
  assert.equal(sections.summary, '')
  assert.deepEqual(sections.recommendations, [])
  assert.match(sections.recommendationState, /Locked/)
})
