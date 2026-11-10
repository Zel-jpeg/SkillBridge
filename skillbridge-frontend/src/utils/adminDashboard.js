import { normalizeDashboardStudent } from './dashboardStudents.js'
import { schoolReportLink } from './schoolOverview.js'

export const ADMIN_DASHBOARD_URL = '/api/management/analytics/?view=dashboard'

export function adminDashboardCards(data, scope) {
  const s = data.summary
  return [
    { kind: 'enrolled', label: 'Students', value: s.students,
      description: `In ${scope.status === 'all' ? 'all selected' : scope.status} batches`, to: schoolReportLink(scope) },
    { kind: 'complete', label: 'Required complete', value: s.required_complete, supportingValue: `of ${s.students} students`,
      description: s.completion_rate == null ? 'No students in scope' : `${s.completion_rate}% completed`,
      progress: s.completion_rate, tone: 'success', to: schoolReportLink(scope, 'assessments', 'complete') },
    { kind: 'followup', label: 'Needs follow-up', value: s.needs_followup, tone: s.needs_followup ? 'attention' : 'neutral',
      description: 'Students with an actionable issue', to: schoolReportLink(scope, 'assessments', 'followup') },
    { kind: 'placement', label: 'Placement progress', value: `${s.approved} / ${s.students}`, tone: 'success',
      description: `${s.unplaced} unplaced${s.approved_other_batch ? ` · ${s.approved_other_batch} approved in another batch` : ''}`,
      progress: s.placement_rate, to: schoolReportLink(scope, 'placements') },
  ]
}

export function adminDashboardStudents(data, options) {
  const institutes = new Map(options.institutes.map(row => [row.id, row]))
  const programs = new Map(options.programs.map(row => [row.id, row]))
  // Identically named categories from separate frameworks are separate evidence.
  const names = new Map()
  for (const skill of data.skills) names.set(skill.name, (names.get(skill.name) || 0) + 1)
  const labels = new Map(data.skills.map(skill => [skill.id, names.get(skill.name) > 1
    ? `${skill.name} · ${skill.framework_label || 'Institute shared skills'} (#${skill.id})` : skill.name]))
  return data.students.map(row => {
    const combined = (row.combined_category_scores || []).map(score => ({ ...score, category: labels.get(score.category_id) || score.category }))
    const student = normalizeDashboardStudent({ ...row, combined_category_scores: combined,
      has_submitted: row.required_complete, completed_required_count: row.required_completed,
      total_required_count: row.required_total, remaining_required_count: Math.max(0, row.required_total - row.required_completed),
      batch: { id: row.batch_id, name: row.batch, status: row.batch_status } })
    return { ...student, detailUrl: row.detail_url, archived: row.batch_status === 'archived',
      placementStatus: row.placement_status, instituteId: row.institute_id, programId: row.program_id,
      organization: `${institutes.get(row.institute_id)?.code || 'Unassigned institute'} · ${programs.get(row.program_id)?.code || 'Shared programs'}` }
  })
}

// These are counts of the current dashboard cohort, not cross-discipline skill
// averages. Shared-institute rows are visible in every program's card as well.
export function adminOrganizationHighlights(students, options, instituteId = '') {
  const isProgram = Boolean(instituteId)
  const templates = isProgram ? options.programs.filter(row => String(row.institute_id) === instituteId) : options.institutes
  return templates.map(entity => {
    const members = students.filter(student => isProgram
      ? String(student.instituteId) === instituteId && (student.programId == null || student.programId === entity.id)
      : student.instituteId === entity.id)
    const assessed = members.filter(student => Object.keys(student.scores).length)
    return { ...entity, students: members.length,
      matches: members.filter(student => !student.recommendationsLocked && student.topRecommendation).length,
      assessed: assessed.length, categories: new Set(assessed.flatMap(student => student.combinedCategoryScores.map(score => score.category_id))).size,
      programs: options.programs.filter(program => program.institute_id === entity.id).length,
      shared: isProgram ? members.filter(student => student.programId == null).length : 0 }
  })
}

export function averageCategoryScore(student) {
  const values = Object.values(student.scores).filter(Number.isFinite)
  return values.length ? Math.round(values.reduce((sum, score) => sum + score, 0) / values.length) : null
}
