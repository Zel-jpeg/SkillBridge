export function adminUsersUrl({ page = 1, tab = 'students', sortCol = 'name', sortDir = 'asc', search = '', filterStatus = 'all', filterCourse = 'all', filterInstructor = 'all', countsOnly = false } = {}) {
  const params = new URLSearchParams({ page: String(page), tab, sort: sortCol, direction: sortDir })
  if (search.trim()) params.set('search', search.trim())
  if (filterStatus !== 'all') params.set('status', filterStatus)
  if (filterCourse !== 'all') params.set('course', filterCourse)
  if (filterInstructor !== 'all') params.set('instructor', filterInstructor)
  if (countsOnly) params.set('counts_only', '1')
  return `/api/admin/users/?${params}`
}

export function rosterUrl(batchId, { page = 1, search = '', course = 'all', accountStatus = 'all', assessmentStatus = 'all', recommendationStatus = 'all', countsOnly = false } = {}) {
  if (!batchId) return null
  const params = new URLSearchParams({ page: String(page) })
  if (search.trim()) params.set('search', search.trim())
  for (const [key, value] of [['course', course], ['account', accountStatus], ['assessment', assessmentStatus], ['recommendation', recommendationStatus]]) {
    if (value !== 'all') params.set(key, value)
  }
  if (countsOnly) params.set('counts_only', '1')
  return `/api/instructor/batches/${batchId}/students/?${params}`
}
