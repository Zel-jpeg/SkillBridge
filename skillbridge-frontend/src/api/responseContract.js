const object = value => value !== null && typeof value === 'object' && !Array.isArray(value)
const id = value => Number.isSafeInteger(value) && value > 0

// Check the envelopes consumed as collections/profiles before they reach React
// or persistent caches. Download payloads intentionally use a different contract.
export function validateApiResponse(response) {
  const { data, config = {}, status } = response
  if (status === 204 || ['blob', 'arraybuffer', 'text'].includes(config.responseType)) return response
  const method = (config.method ?? 'get').toLowerCase()
  const path = (config.url ?? '').split('?')[0]
  let valid = object(data) || Array.isArray(data)
  if (path === '/api/students/me/' || path === '/api/students/me/profile/') {
    valid = object(data) && id(data.id) && data.role === 'student' && typeof data.name === 'string'
  } else if (method === 'get' && path === '/api/student/results/combined/') {
    valid = object(data) && typeof data.recommendations_locked === 'boolean' &&
      Array.isArray(data.recommendations) && Array.isArray(data.combined_category_scores) &&
      data.recommendations.every(row => object(row) && id(row.id) && Number.isFinite(row.match_score) &&
        typeof row.company === 'string' && typeof row.position === 'string' && Array.isArray(row.tags))
  } else if (method === 'get' && ['/api/admin/companies/', '/api/instructor/companies/', '/api/student/companies/'].includes(path)) {
    valid = Array.isArray(data) && data.every(row => object(row) && id(row.id) && typeof row.name === 'string' && Array.isArray(row.positions))
  } else if (method === 'get' && path === '/api/admin/batch-instructors/') {
    valid = Array.isArray(data) && data.every(row => object(row) && id(row.id) && typeof row.name === 'string')
  } else if (method === 'get' && path === '/api/admin/management-actions/') {
    valid = object(data) && Number.isSafeInteger(data.count) && data.count >= 0 && Array.isArray(data.results) &&
      data.results.every(row => object(row) && id(row.id) && typeof row.action === 'string' && typeof row.actor_name === 'string')
  } else if (method === 'patch' && /^\/api\/admin\/batches\/\d+\/$/.test(path)) {
    valid = object(data) && id(data.id) && id(data.instructor_id) && typeof data.name === 'string'
  } else if (method === 'get' && ['/api/categories/', '/api/instructor/batches/', '/api/instructor/assessments/'].includes(path)) {
    valid = Array.isArray(data) && data.every(row => object(row) && id(row.id))
  } else if (method === 'get' && path === '/api/admin/users/') {
    valid = object(data) && ['students', 'instructors', 'pending_instructors'].every(field => Array.isArray(data[field]))
  } else if (method === 'get' && path === '/api/admin/skills/') {
    valid = Array.isArray(data) && data.every(row => object(row) && id(row.id) && typeof row.name === 'string' &&
      Array.isArray(row.tags) && row.tags.every(tag => typeof tag === 'string'))
  } else if (method === 'get' && path === '/api/placements/suggestions/') {
    valid = object(data) && Array.isArray(data.companies) && Array.isArray(data.eligible_students) &&
      data.companies.every(company => object(company) && Array.isArray(company.positions) &&
        company.positions.every(position => object(position) && Array.isArray(position.suggested_students)))
  } else if (path === '/api/placements/draft/') {
    valid = object(data) && Number.isSafeInteger(data.revision) && data.revision >= 0 &&
      typeof data.generated === 'boolean' && typeof data.stale === 'boolean' &&
      object(data.proposed_counts) && Array.isArray(data.students) &&
      data.students.every(row => object(row) && object(row.student) && id(row.student.id) &&
        object(row.batch) && typeof row.status === 'string' && Array.isArray(row.alternatives))
  } else if (method === 'get' && path === '/api/placements/') {
    valid = object(data) && Array.isArray(data.placements)
  } else if (method === 'get' && path === '/api/placements/reports/') {
    valid = object(data) && Array.isArray(data.records) && object(data.summary)
  } else if (method === 'get' && path === '/api/management/analytics/') {
    valid = object(data) && object(data.summary) && object(data.scope) && object(data.options) &&
      typeof data.generated_at === 'string' && ['admin', 'instructor'].includes(data.role) &&
      ['students', 'required_complete', 'approved', 'unplaced', 'awaiting_review', 'needs_followup', 'slots_remaining'].every(key => Number.isSafeInteger(data.summary[key]) && data.summary[key] >= 0) &&
      ['students', 'placement_students', 'assessments', 'batches', 'skills', 'capacity', 'match_bands', 'companies', 'areas', 'geography', 'activity'].every(key => Array.isArray(data[key])) &&
      data.students.every(row => object(row) && id(row.id) && id(row.batch_id) && typeof row.name === 'string' && Array.isArray(row.reasons) && object(row.scores) && object(row.attempt_states)) &&
      ['batches', 'instructors', 'courses', 'assessments', 'companies', 'positions', 'areas'].every(key => Array.isArray(data.options[key])) &&
      (data.activity_days === undefined || (Array.isArray(data.activity_days) && data.activity_days.every(row =>
        object(row) && /^\d{4}-\d{2}-\d{2}$/.test(row.date) && Number.isFinite(Date.parse(row.date)) && Number.isSafeInteger(row.submissions) && row.submissions >= 0)))
  } else if (method === 'get' && path === '/api/management/assessment-reports/') {
    valid = object(data) && Array.isArray(data.rows) && typeof data.generated_at === 'string' && Number.isFinite(Date.parse(data.generated_at))
  } else if (method === 'get' && /^\/api\/instructor\/assessments\/\d+\/questions\/$/.test(path)) {
    valid = object(data) && Array.isArray(data.questions) && data.questions.every(question => object(question) && id(question.id) && Array.isArray(question.choices))
  } else if (method === 'post' && path === '/api/instructor/assessments/') {
    valid = object(data) && id(data.id)
  } else if (method === 'post' && /^\/api\/instructor\/assessments\/\d+\/(archive|restore)\/$/.test(path)) {
    valid = object(data) && id(data.id) && typeof data.is_archived === 'boolean' &&
      (data.is_archived ? typeof data.archived_at === 'string' && Number.isFinite(Date.parse(data.archived_at)) : data.archived_at === null)
  } else if (method === 'post' && /^\/api\/instructor\/assessments\/\d+\/duplicate\/$/.test(path)) {
    valid = object(data) && id(data.id) && typeof data.title === 'string' && ['draft', 'published', 'closed'].includes(data.publication_status)
  } else if ((method === 'get' && /^\/api\/assessments\/\d+\/timing\/$/.test(path)) ||
             (method === 'post' && /^\/api\/instructor\/assessments\/\d+\/students\/\d+\/extra-time\/$/.test(path))) {
    valid = object(data) && Number.isFinite(data.remaining_seconds) && data.remaining_seconds >= 0 &&
      typeof data.deadline_at === 'string' && Number.isFinite(Date.parse(data.deadline_at)) &&
      (method !== 'get' || ['in_progress', 'submitted', 'stopped'].includes(data.status))
  } else if (method === 'post' && (path === '/api/admin/companies/' || /^\/api\/admin\/companies\/\d+\/positions\/$/.test(path))) {
    valid = object(data) && id(data.id)
  } else if (method === 'post' && path === '/api/admin/instructors/') {
    valid = object(data) && id(data.id) && typeof data.is_approved === 'boolean'
  } else if (method === 'post' && /^\/api\/instructor\/batches\/(?:\d+\/(?:archive|unarchive)\/)?$/.test(path)) {
    valid = object(data) && id(data.id) && ['active', 'archived'].includes(data.status)
  } else if (['patch', 'delete'].includes(method) && /^\/api\/admin\/users\/\d+\/$/.test(path)) {
    valid = object(data) && id(data.id) && typeof data.is_active === 'boolean'
  }
  if (!valid) {
    const error = new Error('Invalid API response envelope')
    error.code = 'ERR_BAD_RESPONSE'
    error.userMessage = ['get', 'head', 'options'].includes(method)
      ? 'The server returned invalid data. Please retry.'
      : 'The save could not be confirmed. Refresh the current records before trying again.'
    error.response = { ...response, data: { error: error.userMessage } }
    throw error
  }
  return response
}
