import test from 'node:test'
import assert from 'node:assert/strict'
import { studentCardEvidence } from './studentCard.js'

const student = extra => ({ status: 'completed', recommendationsLocked: false,
  combinedCategoryScores: [{ category: 'Web', percentage: 100 }, { category: 'Database', percentage: 66.67 }, { category: 'Networking', percentage: 50 }, { category: 'Programming', percentage: 50 }], ...extra })

test('management cards use combined evidence and the same rounded category average as the dashboard', () => {
  const result = studentCardEvidence(student({ scores: { Legacy: 999 } }))
  assert.equal(result.overall, 67)
  assert.equal(result.scores.length, 4)
  assert.deepEqual(result.leaders.map(row => row.category), ['Web'])
})

test('missing or locked final evidence never leaks legacy scores or recommendations', () => {
  for (const recommendationsLocked of [true, undefined]) {
    const result = studentCardEvidence(student({ recommendationsLocked, scores: { Legacy: 99 }, top_recommendations: [{ match_score: 99 }] }))
    assert.deepEqual(result.scores, [])
    assert.equal(result.overall, null)
    assert.equal(result.recommendation, null)
  }
})

test('stopped, flagged and archived cards retain state without positive interpretation', () => {
  for (const extra of [{ status: 'stopped' }, { isFlagged: true }, { archived: true }]) {
    const result = studentCardEvidence(student(extra))
    assert.equal(result.overall, null)
    assert.deepEqual(result.leaders, [])
  }
})

test('invalid/missing scores are not zero and a zero maximum is not assessed', () => {
  const result = studentCardEvidence(student({ combinedCategoryScores: [
    { category: 'Absent', percentage: null }, { category: 'Invalid', percentage: 'oops' },
    { category: 'Empty', percentage: 0, max_score: 0 }, { category: 'Valid', percentage: '66.67' },
  ] }))
  assert.equal(result.scores.length, 1)
  assert.equal(result.scores[0].percentage, 66.67)
  assert.equal(result.overall, 67)
  assert.equal(studentCardEvidence(student({ combinedCategoryScores: [] })).overall, null)
})

test('earned zero and zero recommendation fit are preserved; stale recommendations are skipped', () => {
  const result = studentCardEvidence(student({ combinedCategoryScores: [{ category: 'Web', percentage: 0 }],
    top_recommendations: [{ company: 'Stale', is_current: false, match_score: 99 }, { company: 'Zero fit', match_score: 0 }] }))
  assert.equal(result.overall, 0)
  assert.equal(result.leaders[0].percentage, 0)
  assert.equal(result.recommendation.company, 'Zero fit')
})

test('all tied category leaders remain available without changing source evidence', () => {
  const record = student({ combinedCategoryScores: Array.from({ length: 30 }, (_, i) => ({ category: `Category ${i}`, percentage: 80 })) })
  const copy = structuredClone(record)
  assert.equal(studentCardEvidence(record).leaders.length, 30)
  assert.deepEqual(record, copy)
})
