export const DEFAULT_ROSTER_FILTERS = Object.freeze({
  search: '', course: 'all', enrollment: 'enrolled', accountStatus: 'all',
  assessmentStatus: 'all', recommendationStatus: 'all',
})

export function rosterFilterCount(filters) {
  return ['course', 'enrollment', 'accountStatus', 'assessmentStatus', 'recommendationStatus']
    .filter(key => filters[key] !== DEFAULT_ROSTER_FILTERS[key]).length
}

export function filterPreviouslyUnenrolled(students, { search = '', course = 'all', accountStatus = 'all' } = {}) {
  const query = search.trim().toLowerCase()
  return students.filter(student =>
    (course === 'all' || student.course === course) &&
    (accountStatus === 'all' || (student.is_active === false) === (accountStatus === 'archived')) &&
    [student.name, student.school_id, student.email].join(' ').toLowerCase().includes(query))
}

export function filterRosterStudents(students, {
  search = '', course = 'all', accountStatus = 'all',
  assessmentStatus = 'all', recommendationStatus = 'all',
} = {}) {
  const query = search.trim().toLowerCase()
  return students.filter(student => {
    if (course !== 'all' && student.course !== course) return false
    if (accountStatus !== 'all' && student.archived !== (accountStatus === 'archived')) return false
    if (assessmentStatus === 'complete' && !student.allRequiredCompleted) return false
    if (assessmentStatus === 'incomplete' && student.allRequiredCompleted) return false
    if (assessmentStatus === 'stopped' && student.status !== 'stopped') return false
    if (assessmentStatus === 'retake' && !student.assessmentResults?.some(attempt => attempt.retake_allowed)) return false
    const available = !student.recommendationsLocked && student.top_recommendations?.length > 0
    const approved = student.hasCurrentApproval ?? (student.placement?.status === 'approved')
    if (recommendationStatus === 'available' && !available) return false
    if (recommendationStatus === 'awaiting' && (!available || approved)) return false
    if (recommendationStatus === 'approved' && student.placement?.status !== 'approved') return false
    return !query || [student.name, student.studentId, student.email].some(value => value?.toLowerCase().includes(query))
  })
}
