export function filterAssessments(assessments, filters = {}) {
  const query = (filters.search || '').trim().toLowerCase()
  return assessments.filter(a =>
    (!query || `${a.title || ''} ${a.batch_name || ''} ${a.instructor_name || ''}`.toLowerCase().includes(query)) &&
    (!filters.batch || filters.batch === 'all' || String(a.batch_id) === String(filters.batch)) &&
    (!filters.instructor || filters.instructor === 'all' || a.instructor_name === filters.instructor) &&
    (!filters.state || filters.state === 'all' || a.publication_status === filters.state) &&
    (!filters.required || filters.required === 'all' || a.is_required === (filters.required === 'required')) &&
    (!filters.included || filters.included === 'all' || a.include_in_competency === (filters.included === 'included')) &&
    (!filters.category || filters.category === 'all' || (a.categories || []).includes(filters.category)) &&
    (!filters.availability || filters.availability === 'all' || a.availability_status === filters.availability) &&
    (!filters.completion || filters.completion === 'all' || (filters.completion === 'complete' ? a.completion_rate === 100 : a.completion_rate < 100))
  )
}

export function assessmentRetakeCandidate(student, assessmentId) {
  const attempts = student.assessmentResults ?? student.assessment_results ?? []
  const attempt = attempts.find(a => a.id === assessmentId)
  return attempt && ['submitted', 'stopped'].includes(attempt.attempt_status) ? attempt : null
}
