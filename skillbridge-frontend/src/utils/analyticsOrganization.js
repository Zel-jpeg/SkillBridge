import { schoolOrganizationRows } from './schoolOverview.js'

export function organizationComparison(data, search = '') {
  const institute = data.scope.institute_id ? String(data.scope.institute_id) : ''
  if (data.scope.program_id) return []
  const options = { institutes: data.options.institutes || [], programs: data.options.programs || [] }
  const { rows, sharedStudents } = schoolOrganizationRows(data, options, institute)
  if (sharedStudents) {
    const batches = new Map(data.options.batches.map(row => [row.id, row]))
    const shared = data.students.filter(row => institute ? !batches.get(row.batch_id)?.program_id : !batches.get(row.batch_id)?.institute_id)
    rows.push({ id: 'shared', name: institute ? 'Shared institute batches' : 'Institute not assigned', students: sharedStudents,
      complete: shared.filter(row => row.required_complete).length, approved: shared.filter(row => row.placement_status === 'approved').length })
  }
  const query = search.trim().toLowerCase()
  return rows.filter(row => `${row.name} ${row.code || ''}`.toLowerCase().includes(query)).map(row => ({ ...row,
    completionRate: row.students ? Math.round(row.complete / row.students * 1000) / 10 : null,
    placementRate: row.students ? Math.round(row.approved / row.students * 1000) / 10 : null }))
}

export function analyticsScopeText(data, compact = false) {
  const lookup = (key, id, fallback) => id ? data.options[key]?.find(row => String(row.id) === String(id))?.name || `Unavailable ${key === 'institutes' ? 'institute' : 'program'} (${id})` : fallback
  const batches = compact && data.scope.batch_ids.length > 3 ? `${data.scope.batch_ids.length} selected batches` : data.scope.batch_ids.map(id => data.options.batches.find(row => row.id === id)?.name || id).join(', ') || 'none'
  const instructor = data.scope.instructor_id ? `; instructor: ${data.options.instructors?.find(row => row.id === data.scope.instructor_id)?.name || data.scope.instructor_id}` : ''
  return `Institute: ${lookup('institutes', data.scope.institute_id, 'All institutes')}; Program: ${lookup('programs', data.scope.program_id, 'All programs')}; Batches: ${batches}; ${data.scope.batch_status}; course: ${data.scope.course || 'all'}${instructor}`
}
