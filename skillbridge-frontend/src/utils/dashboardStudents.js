// Presentation of evidence already authorized and scoped by the dashboard APIs.
import { recommendationValue, sortRecommendations } from './recommendationResults.js'
export function normalizeDashboardStudent(row) {
  const locked = row.recommendations_locked !== false
  const competencyLocked = (row.competency_locked ?? row.recommendations_locked) !== false
  const scores = Object.fromEntries((competencyLocked ? [] : row.combined_category_scores ?? [])
    .filter(score => score.percentage != null && Number.isFinite(Number(score.percentage)))
    .map(score => [score.category, Number(score.percentage)]))
  const recommendations = locked ? [] : sortRecommendations(row.top_recommendations ?? [])
    .filter(rec => rec.is_current !== false && rec.match_score != null && Number.isFinite(Number(rec.match_score)))
  const top = recommendations[0]
  return {
    id: row.id,
    name: row.student_name || row.name || 'Student',
    studentId: String(row.school_id || row.student_id || ''),
    email: row.email || '',
    course: row.course || '',
    instructor: row.instructor_name || row.instructor || '',
    batch: row.batch ?? null,
    batchLabel: row.batch === undefined ? 'View batch details in Students / Batches' : null,
    status: row.attempt_status === 'stopped' ? 'stopped' : row.has_submitted ? 'completed' : 'pending',
    scores,
    match: top ? recommendationValue(top) : null,
    topRecommendation: top ?? null,
    position: top?.position ?? null,
    company: top?.company ?? null,
    top_recommendations: recommendations,
    retakeAllowed: row.retake_allowed ?? false,
    isFlagged: row.is_flagged ?? false,
    stoppedReason: row.stopped_reason_display || '',
    violationCount: row.violation_count ?? 0,
    competencyProfile: row.competency_profile ?? null,
    placement: row.placement,
    placementKnown: row.placement !== undefined,
    address: row.address ?? {},
    photoUrl: row.photo_url || null,
    assessmentResults: row.assessment_results ?? [],
    combinedCategoryScores: competencyLocked ? [] : row.combined_category_scores ?? [],
    combinedCompetencyProfile: competencyLocked ? null : row.combined_competency_profile ?? null,
    recommendationsLocked: locked, competencyLocked,
    completedRequiredCount: row.completed_required_count ?? 0,
    totalRequiredCount: row.total_required_count ?? 0,
    remainingRequiredCount: row.remaining_required_count ?? 0,
  }
}

export function skillRankings(students, category) {
  const ranked = students.filter(student => student.status === 'completed' &&
    (student.competencyLocked ?? student.recommendationsLocked) !== true && Number.isFinite(student.scores[category]))
    .sort((a, b) => b.scores[category] - a.scores[category] || a.name.localeCompare(b.name) || a.id - b.id)
  let rank = 0
  return ranked.map((student, index) => {
    const score = student.scores[category]
    if (index === 0 || score !== ranked[index - 1].scores[category]) rank = index + 1
    return { student, score, rank }
  })
}

export function categoryPointsLabel(student, category) {
  const evidence = student.combinedCategoryScores?.find(row => row.category === category)
  const raw = evidence?.raw_score, maximum = evidence?.max_score
  return Number.isFinite(raw) && Number.isFinite(maximum) && maximum > 0 && raw >= 0 && raw <= maximum
    ? `${raw}/${maximum} assessment points` : null
}

export function dashboardHighlights(students) {
  const eligible = students.filter(student => student.status === 'completed' &&
    (student.competencyLocked ?? student.recommendationsLocked) !== true)
  const categories = [...new Set(eligible.flatMap(student => Object.keys(student.scores)))].sort()
  const leaders = categories.map(category => {
    const ranked = skillRankings(eligible, category)
    return { category, ...ranked[0], tiedCount: ranked.filter(row => row.rank === 1).length }
  })
  const topMatches = eligible.filter(student => !student.recommendationsLocked && Number.isFinite(student.match))
    .sort((a, b) => b.match - a.match || a.name.localeCompare(b.name) || a.id - b.id)
    .slice(0, 4)
  return { leaders, topMatches }
}
