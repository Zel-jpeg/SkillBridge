import test from 'node:test'
import assert from 'node:assert/strict'
import { cycleReportTables } from './cycleReports.js'

function snapshot() {
  return { batch: { id: 1, name: 'Synthetic cycle' }, version: 1, generated_at: '2026-10-28T00:00:00Z', generated_by: { name: 'Synthetic Staff' }, catalog_scope: 'Shared slots', exceptions: {},
    students: [{ id: 2, name: 'Synthetic Student', school_id: '2026-00001', course: 'BSIT', progress: { completed_required_count: 1, total_required_count: 1 },
      combined_profile_finalized: true, combined_profile: { model_used: 'test_model' }, recommendations_stale: true,
      assessments: [{ title: 'Recorded assessment', attempt_status: 'submitted', category_scores: [{ category: 'Networking', raw_score: 7, max_score: 10, percentage: 70 }] }],
      combined_scores: [{ category: 'Networking', raw_score: 7, max_score: 10, percentage: 70, source_assessment_ids: [8] }],
      recommendations: [{ partner: 'Recorded Partner', position: 'Recorded Role', match_score: 0, category: 0, nlp: 0, location: 0, distance_km: 0, model_used: 'test_model', is_current: true }] }],
    placements: [], catalog: [{ partner: 'Recorded Partner', position: 'Recorded Role', slots: 2, ongoing_shared: 0, archived: false, requirements: { Networking: 60 } }] }
}

test('closeout tables preserve raw/max scores, historical slots, actual zero matches and stale evidence without mutating saved facts', () => {
  const saved = snapshot(), before = JSON.stringify(saved), tables = cycleReportTables(saved)
  assert.deepEqual(tables.find(t => t.name === 'Assessment scores').rows[0].slice(-3), [7, 10, 70])
  assert.equal(tables.find(t => t.name === 'Openings at closeout').rows[0][2], 2)
  const match = tables.find(t => t.name === 'Saved matches').rows[0]
  assert.deepEqual(match.slice(4, 9), [0, 0, 0, 0, 0])
  assert.equal(match.at(-1), 'Stale')
  assert.equal(JSON.stringify(saved), before)
})

test('legacy closeouts and absent model/matching evidence remain unavailable instead of inventing scores', () => {
  const saved = snapshot(), student = saved.students[0]
  delete student.recommendations
  delete student.combined_profile_finalized
  student.combined_profile = null
  student.combined_scores = []
  const tables = cycleReportTables(saved)
  assert.deepEqual(tables.find(t => t.name === 'Saved matches').rows, [])
  assert.deepEqual(tables.find(t => t.name === 'Combined scores').rows, [])
  const row = tables.find(t => t.name === 'Students').rows[0]
  assert.deepEqual(row.slice(5, 8), ['No', 'Unavailable', 'Not recorded'])
})

test('recommendation-cycle reports never infer training outcomes and preserve approved decisions', () => {
  const saved = snapshot()
  saved.schema_version = 2
  delete saved.exceptions
  saved.archive_note = 'Recommendation cycle archived'
  saved.catalog[0].current_approved_shared = 1
  saved.placements = [{ student: { id: 2, school_id: '2026-00001', name: 'Synthetic Student' },
    company: { name: 'Recorded Partner' }, position: { title: 'Recorded Role' }, status: 'approved',
    approved_at: '2026-10-28T00:00:00Z', match_score_at_assignment: 73 }]
  const before = JSON.stringify(saved), tables = cycleReportTables(saved)
  assert.equal(tables.find(t => t.name === 'Students').rows[0].at(-1), 'Yes')
  assert.equal(tables.find(t => t.name === 'Decisions').rows[0][4], 'approved')
  assert.equal(tables.find(t => t.name === 'Openings at closeout').rows[0][3], 1)
  assert.doesNotMatch(JSON.stringify(tables), /OJT completed|Ongoing|Completed \(Manila\)/)
  assert.equal(JSON.stringify(saved), before)
  saved.placements = []
  assert.equal(cycleReportTables(saved).find(t => t.name === 'Students').rows[0].at(-1), 'No')
})
