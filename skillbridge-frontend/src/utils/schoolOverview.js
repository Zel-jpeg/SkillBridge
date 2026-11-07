export function schoolReportLink(scope, tab = 'assessments', group = '') {
  return `/admin/reports?${new URLSearchParams({ tab, ...(group ? { group } : {}),
    ...(scope.institute ? { institute_id: scope.institute } : {}), ...(scope.program ? { program_id: scope.program } : {}), batch_status: scope.status || 'active' })}`
}

export function schoolDashboardCards(data, scope) {
  const s = data.summary
  const rate = value => value == null ? 'No students in scope' : `${value}% of selected students`
  return [
    { kind: 'students', label: scope.status === 'archived' ? 'Students in archived batches' : scope.status === 'all' ? 'Students in selected batches' : 'Students in active batches', value: s.students, description: 'Distinct students; newest selected enrollment', to: schoolReportLink(scope) },
    { kind: 'complete', label: 'Required assessments complete', value: `${s.required_complete} / ${s.students}`, description: rate(s.completion_rate), to: schoolReportLink(scope, 'assessments', 'complete') },
    { kind: 'review', label: 'Awaiting coordinator review', value: s.awaiting_review, description: 'Unplaced with current recommendations', to: schoolReportLink(scope, 'placements', 'awaiting') },
    { kind: 'approved', label: 'Approved placements', value: `${s.approved} / ${s.students}`, description: rate(s.placement_rate), to: schoolReportLink(scope, 'placements', 'approved') },
    { kind: 'capacity', label: 'Remaining shared slots', value: s.slots_remaining, description: 'Occupancy includes all eligible programs', to: schoolReportLink(scope, 'placements', 'capacity') },
  ]
}

// Partition the server's distinct current cohort using its recorded enrollment,
// not today's profile labels or a sum of independently queried cohorts.
export function schoolOrganizationRows(data, options, instituteId = '') {
  const program = Boolean(instituteId)
  const templates = program ? options.programs.filter(row => String(row.institute_id) === instituteId) : options.institutes
  const batches = new Map(data.options.batches.map(row => [row.id, row]))
  const rows = templates.map(row => ({ ...row, students: 0, complete: 0, approved: 0,
    programs: program ? 1 : options.programs.filter(item => item.institute_id === row.id).length,
    batches: data.scope.batch_ids.filter(id => (program ? batches.get(id)?.program_id : batches.get(id)?.institute_id) === row.id).length }))
  const index = new Map(rows.map(row => [row.id, row]))
  let sharedStudents = 0
  for (const student of data.students) {
    const batch = batches.get(student.batch_id)
    const group = index.get(program ? batch?.program_id : batch?.institute_id)
    if (!group) { sharedStudents++; continue }
    group.students++
    group.complete += Number(student.required_complete)
    group.approved += Number(student.placement_status === 'approved')
  }
  return { rows, sharedStudents }
}
