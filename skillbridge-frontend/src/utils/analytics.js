export const ANALYTICS_URL = '/api/management/analytics/'
export const FILTER_KEYS = ['batch_id', 'instructor_id', 'course', 'batch_status', 'assessment_id', 'company_id', 'position_id', 'area', 'date_from', 'date_to']

export function analyticsUrl(params) {
  const filters = new URLSearchParams()
  for (const key of FILTER_KEYS) if (params.get(key)) filters.set(key, params.get(key))
  return ANALYTICS_URL + (filters.size ? `?${filters}` : '')
}

export function analyticsCards(data, role) {
  const summary = data.summary
  const rate = value => value == null ? 'No students in scope' : `${value}% of students in scope`
  const target = (tab, group = '') => `/${role}/reports?${new URLSearchParams({ tab, ...(group && { group }) })}`
  const cards = [
    { label: role === 'admin' ? 'Students in active batches' : 'Enrolled students', value: summary.students, description: role === 'admin' ? 'Distinct students in the current cohort' : 'Students in the current active batch', to: target('assessments') },
    { label: 'Required complete', value: summary.required_complete, description: rate(summary.completion_rate), tone: 'success', to: target('assessments', 'complete') },
  ]
  if (role === 'admin') cards.push({ label: 'Awaiting placement review', value: summary.awaiting_review, description: 'Unplaced with current recommendations', tone: summary.awaiting_review ? 'warning' : 'neutral', to: target('placements', 'awaiting') })
  else cards.push({ label: 'Students needing follow-up', value: summary.needs_followup, description: 'Distinct students with an actionable issue', tone: summary.needs_followup ? 'attention' : 'neutral', to: target('assessments', 'followup') })
  cards.push({ label: 'Placement progress', value: `${summary.approved} / ${summary.students}`, description: `${summary.unplaced} unplaced${summary.approved_other_batch ? ` · ${summary.approved_other_batch} approved in another batch` : ''}`, tone: 'success', to: target('placements') })
  if (role === 'admin') cards.push({ label: 'Remaining OJT slots', value: summary.slots_remaining, description: 'Shared system-wide capacity', to: target('placements', 'capacity') })
  return cards
}

export function selectAnalyticsStudents(data, tab, group, search = '') {
  let rows = tab === 'placements' ? data.placement_students : data.students
  if (group === 'complete') rows = rows.filter(row => row.required_complete)
  else if (group === 'incomplete') rows = rows.filter(row => !row.required_complete)
  else if (group === 'followup') rows = rows.filter(row => row.reasons.length)
  else if (group === 'awaiting') rows = rows.filter(row => row.awaiting_review)
  else if (['approved', 'approved_other_batch', 'unplaced'].includes(group)) rows = rows.filter(row => row.placement_status === group)
  else if (group.startsWith('reason:')) rows = rows.filter(row => row.reasons.includes(group.slice(7)))
  else if (group.startsWith('band:')) rows = rows.filter(row => row.match_band === group.slice(5))
  else if (group.startsWith('attempt:')) { const [, id, state] = group.split(':'); rows = rows.filter(row => row.attempt_states[id] === state) }
  else if (group.startsWith('batch:')) rows = rows.filter(row => String(row.batch_id) === group.slice(6))
  else if (group.startsWith('skill:')) {
    const [, id, band] = group.split(':')
    rows = rows.filter(row => row.scores[id] != null && (!band || (band === 'needs_work' ? row.scores[id] < 60 : band === 'fair' ? row.scores[id] >= 60 && row.scores[id] < 80 : row.scores[id] >= 80)))
  } else if (group.startsWith('company:')) rows = rows.filter(row => String(row.company_id) === group.slice(8))
  else if (group.startsWith('area:')) rows = rows.filter(row => row.company_area === group.slice(5))
  const query = search.trim().toLowerCase()
  return query ? rows.filter(row => [row.name, row.school_id, row.batch, row.instructor, row.course].some(value => value.toLowerCase().includes(query))) : rows
}

// All table exports use the already displayed snapshot, never a second GET.
export function analyticsTable(data, tab, group, students) {
  if (group === 'geography') return { title: 'Residence and company-area comparison', columns: ['Area', 'Cohort residents', 'Unplaced cohort residents', 'Approved deployments to companies', 'Companies with configured positions', 'Shared configured seats', 'Shared remaining seats'], rows: data.geography.map(row => [row.name, row.residents, row.unplaced_residents, row.approved_deployments, row.companies, row.total_slots, row.remaining_slots]) }
  if (group === 'capacity') return { title: 'Shared position capacity', columns: ['Company', 'Position', 'Company area', 'Configured seats', 'Approved assignments', 'Remaining seats'],
    rows: data.capacity.map(row => [row.company, row.name, row.area, row.total, row.occupied, row.remaining]) }
  if (group === 'assessments') return { title: 'Assessment completion', columns: ['Assessment', 'Batch', 'Publication', 'Assigned', 'Valid submitted', 'In progress', 'Not started', 'Stopped / flagged', 'Retakes approved'],
    rows: data.assessments.map(row => [row.name, row.batch, row.publication_status, row.assigned, row.submitted, row.in_progress, row.not_started, row.stopped, row.retake_approved]) }
  if (group === 'activity') return { title: 'Recorded submission activity', columns: ['Philippine date', 'Valid submitted attempts'], rows: data.activity.map(row => [row.date, row.submissions]) }
  if (group === 'skills') return { title: 'Combined skill distribution', columns: ['Category', 'Students with evidence', 'Missing / locked', 'Strong', 'Fair', 'Needs work', 'Mean of final student percentages'], rows: data.skills.map(row => [row.name, row.sample, row.missing, row.strong, row.fair, row.needs_work, row.average]) }
  return { title: tab === 'placements' ? 'Placement records' : tab === 'skills' ? 'Student competency records' : 'Student progress and follow-up',
    columns: ['Student', 'School ID', 'Course', 'Batch', 'Instructor', 'Required complete / total', 'Final evidence', 'Placement status', 'Approved company', 'Approved position', 'Best current match %', 'Follow-up reasons', 'Top recommended position', 'Top recommended company', ...(tab === 'skills' ? data.skills.map(row => `${row.name} %`) : [])],
    rows: students.map(row => [row.name, row.school_id, row.course, row.batch, row.instructor, `${row.required_completed}/${row.required_total}`, row.recommendations_locked ? 'Locked / unavailable' : 'Current', row.placement_status.replaceAll('_', ' '), row.company, row.position, row.top_match, row.reasons.join('; '), row.top_position || null, row.top_company || null, ...(tab === 'skills' ? data.skills.map(skill => row.scores[skill.id] ?? null) : [])]) }
}

export function analyticsSelectionLabel(data, group) {
  if (!group) return 'All records in scope'
  const [kind, id, state] = group.split(':')
  const states = { submitted: 'Valid submitted', in_progress: 'In progress', not_started: 'Not started', stopped: 'Stopped / flagged', strong: 'Strong', fair: 'Fair', needs_work: 'Needs work' }
  if (kind === 'reason') return group.slice(7)
  if (kind === 'band') return `${group.slice(5)} best matches`
  if (kind === 'skill') return `${data.skills.find(row => String(row.id) === id)?.name || 'Selected category'} · ${states[state] || 'All evidence'}`
  if (kind === 'attempt') return `${data.assessments.find(row => String(row.id) === id)?.name || 'Selected assessment'} · ${states[state] || 'All attempts'}`
  if (kind === 'batch') return data.options.batches.find(row => String(row.id) === id)?.name || 'Selected batch'
  if (kind === 'company') return data.options.companies.find(row => String(row.id) === id)?.name || 'Selected company'
  if (kind === 'area') return `Company area: ${group.slice(5)}`
  if (group === 'geography') return 'Cohort residence counts are separate from company deployment and shared capacity'
  return ({ complete: 'Required assessments complete', incomplete: 'Incomplete required assessments', followup: 'Students needing follow-up', awaiting: 'Awaiting placement review', approved: 'Approved in cohort', approved_other_batch: 'Approved in another batch', unplaced: 'Unplaced', capacity: 'Shared position capacity', assessments: 'Assessment completion', skills: 'Combined skill distribution', activity: 'Recorded submission activity' })[group] || 'Selected records'
}

export function analyticsFilterText(data) {
  const scope = data.scope
  const lookup = (collection, id) => data.options[collection].find(row => row.id === id)?.name || 'All'
  return [`Batch status: ${scope.batch_status}`, `Course: ${scope.course || 'All'}`,
    `Instructor: ${lookup('instructors', scope.instructor_id)}`, `Assessment analysis: ${lookup('assessments', scope.assessment_id)}`,
    `Approved company: ${lookup('companies', scope.company_id)}`, `Approved position: ${lookup('positions', scope.position_id)}`,
    `Company area: ${scope.area || 'All'}`].join('; ')
}

export function csvCell(value) {
  let text = value == null ? '' : String(value)
  const first = [...text].find(char => char.charCodeAt(0) > 32 && !/\s/.test(char))
  if (typeof value === 'string' && first && '=+@-'.includes(first)) text = `'${text}`
  return `"${text.replaceAll('"', '""')}"`
}

export function analyticsCsv(table, metadata) {
  return '\ufeff' + [[table.title], ...Object.entries(metadata), [], table.columns, ...table.rows]
    .map(row => row.map(csvCell).join(',')).join('\r\n')
}
