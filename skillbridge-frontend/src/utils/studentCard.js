import { assessmentSummary, scorePercentage } from './assessmentSummary.js'

// Card presentation only. Never treat this average or these labels as ranking inputs.
export function studentCardEvidence(student) {
  const locked = student.recommendationsLocked !== false
  const stopped = student.status === 'stopped' || student.isFlagged === true
  const available = !locked && !stopped && !student.archived && student.status === 'completed'
  const scores = available ? (student.combinedCategoryScores ?? []).map(row => ({
    ...row,
    category: row.category || (row.category_id != null ? `Category ${row.category_id}` : 'Category not provided'),
    percentage: row.max_score != null && Number(row.max_score) <= 0 ? null : scorePercentage(row.percentage),
  })).filter(row => row.percentage != null) : []
  const overall = scores.length ? Math.round(scores.reduce((sum, row) => sum + row.percentage, 0) / scores.length) : null
  const summary = assessmentSummary(scores)
  const recommendation = available ? (student.top_recommendations ?? []).find(row => row.is_current !== false && scorePercentage(row.match_score) != null) : null
  return { locked, stopped, scores, overall, leaders: summary.leaders, recommendation }
}
