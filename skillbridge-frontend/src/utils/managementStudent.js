export function normalizeStudent(s) {
  const parsedScores = {}
  const parsedTags = {}
  for (const [k, v] of Object.entries(s.skill_scores ?? {})) {
    if (typeof v === 'object' && v !== null) {
      parsedScores[k] = v.percentage
      parsedTags[k] = v.tag
    } else {
      parsedScores[k] = v
      parsedTags[k] = null
    }
  }
  if (!s.recommendations_locked && s.combined_category_scores?.length) {
    for (const key of Object.keys(parsedScores)) delete parsedScores[key]
    for (const score of s.combined_category_scores) parsedScores[score.category] = score.percentage
  }

  return {
    id:                  s.id,
    archived:            s.is_active === false,
    historicalEvidence:  s.historical_evidence === true,
    name:                s.name,
    studentId:           s.school_id || '',
    email:               s.email,
    course:              s.course,
    status:              s.assessment_results?.some(a => a.attempt_status === 'stopped' || a.is_flagged) ? 'stopped' : s.all_required_completed ? 'completed' : 'pending',
    retakeAllowed:       s.retake_allowed ?? false,
    assessmentId:       s.assessment_id ?? null,
    isFlagged:           s.is_flagged ?? false,
    stoppedReason:       s.stopped_reason_display || '',
    violationCount:      s.violation_count ?? 0,
    scores:              parsedScores,
    tags:                parsedTags,
    top_recommendations: s.top_recommendations ?? [],
    competencyProfile:   s.competency_profile ?? null,
    placement:           s.placement ?? { status: 'unplaced' },
    address:             s.address        ?? {},
    photoUrl:            s.photo_url      || null,
    assessmentResults: s.assessment_results ?? [],
    combinedCategoryScores: s.combined_category_scores ?? [],
    combinedCompetencyProfile: s.combined_competency_profile ?? null,
    recommendationsLocked: s.recommendations_locked ?? true,
    completedRequiredCount: s.completed_required_count ?? 0,
    totalRequiredCount: s.total_required_count ?? 0,
    remainingRequiredCount: s.remaining_required_count ?? 0,
    allRequiredCompleted: s.all_required_completed === true,
    hasCurrentApproval: s.has_current_approval ?? (s.placement?.status === 'approved'),
  }
}

