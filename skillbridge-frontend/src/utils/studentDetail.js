/** Presentation only: completion and final evidence are supplied by the scoped API. */
export function studentDetailState(student) {
  const results = student.assessmentResults ?? student.assessment_results ?? []
  const locked = student.recommendationsLocked ?? student.recommendations_locked ?? true
  const completed = student.completedRequiredCount ?? student.completed_required_count ?? 0
  const total = student.totalRequiredCount ?? student.total_required_count ?? 0
  const remaining = student.remainingRequiredCount ?? student.remaining_required_count ?? 0
  return {
    results, locked, completed, total, remaining,
    percentage: total > 0 ? Math.min(100, Math.max(0, Math.round(completed / total * 100))) : 0,
    completionLabel: total === 0 ? 'No required assessments' : remaining > 0 ? 'Required assessments in progress' : 'Required assessments complete',
    combined: locked ? [] : student.combinedCategoryScores ?? student.combined_category_scores ?? [],
    profile: locked ? null : student.combinedCompetencyProfile ?? student.combined_competency_profile ?? null,
    recommendations: locked ? [] : (student.top_recommendations ?? []).filter(rec => rec.is_current !== false),
    historyCount: results.reduce((count, result) => count + (result.prior_attempts?.length ?? 0), 0),
  }
}

export function percentLabel(value) {
  return value == null || value === '' || !Number.isFinite(Number(value)) ? 'Not available' : `${Number(value).toFixed(1)}%`
}

export function attemptLabel(value) {
  return value ? value.replaceAll('_', ' ').replace(/^./, char => char.toUpperCase()) : 'Not started'
}

export function suggestionText(item) {
  if (typeof item === 'string') return item
  if (!item || typeof item !== 'object') return ''
  const category = item.category ? `${item.category}${item.percentage != null ? ` (${percentLabel(item.percentage)})` : ''}: ` : ''
  return `${category}${item.message || 'Development guidance not provided.'}`
}

export function lockExplanation({ total, remaining }) {
  if (total === 0) return 'No required assessments are assigned. A required assessment must be assigned and completed before a final profile and recommendations can become available.'
  if (remaining > 0) return `Complete ${remaining} remaining required assessment${remaining === 1 ? '' : 's'} with valid submitted attempts to unlock the final profile and placement recommendations.`
  return 'Required assessments are complete. Final evidence must be current and finalized in an active batch before the profile and recommendations can become available.'
}

export function isCurrentPlacement(rec, placement) {
  if (placement?.status !== 'approved') return false
  if (rec.position_id != null && placement.position?.id != null) return rec.position_id === placement.position.id
  return Boolean(rec.company && rec.position && rec.company === placement.company?.name && rec.position === placement.position?.title)
}
