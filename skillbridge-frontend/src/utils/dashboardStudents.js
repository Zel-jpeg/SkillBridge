// Presentation of evidence already authorized and scoped by the dashboard APIs.
export function normalizeDashboardStudent(row) {
  const locked = row.recommendations_locked !== false
  const scores = Object.fromEntries((locked ? [] : row.combined_category_scores ?? [])
    .filter(score => score.percentage != null && Number.isFinite(Number(score.percentage)))
    .map(score => [score.category, Number(score.percentage)]))
  const recommendations = locked ? [] : (row.top_recommendations ?? [])
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
    match: top ? Number(top.match_score) : null,
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
    combinedCategoryScores: locked ? [] : row.combined_category_scores ?? [],
    combinedCompetencyProfile: locked ? null : row.combined_competency_profile ?? null,
    recommendationsLocked: locked,
    completedRequiredCount: row.completed_required_count ?? 0,
    totalRequiredCount: row.total_required_count ?? 0,
    remainingRequiredCount: row.remaining_required_count ?? 0,
  }
}

export function dashboardHighlights(students) {
  const eligible = students.filter(student => student.status === 'completed' && !student.recommendationsLocked)
  const categories = [...new Set(eligible.flatMap(student => Object.keys(student.scores)))].sort()
  const leaders = categories.map(category => {
    const ranked = eligible.filter(student => Number.isFinite(student.scores[category]))
      .sort((a, b) => b.scores[category] - a.scores[category] || a.name.localeCompare(b.name) || a.id - b.id)
    return { category, student: ranked[0], score: ranked[0].scores[category] }
  })
  const topMatches = eligible.filter(student => Number.isFinite(student.match))
    .sort((a, b) => b.match - a.match || a.name.localeCompare(b.name) || a.id - b.id)
    .slice(0, 4)
  return { leaders, topMatches }
}
