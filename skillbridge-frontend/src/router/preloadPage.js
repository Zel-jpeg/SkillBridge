// The browser's module loader owns code deduplication. Data still lives only in
// queryStore; a chunk failure falls back to the route's normal retry boundary.
const pages = {
  '/student/assessments': () => import('../pages/student/StudentAssessments'),
  '/student/results': () => import('../pages/student/StudentResults'),
  '/student/profile': () => import('../pages/student/StudentProfile'),
  '/instructor/students': () => import('../pages/instructor/EnrolledStudents'),
  '/instructor/assessments': () => import('../pages/instructor/InstructorAssessments'),
  '/instructor/assessments/archives': () => import('../pages/assessments/AssessmentArchives'),
  '/admin/assessments/archives': () => import('../pages/assessments/AssessmentArchives'),
  '/instructor/companies': () => import('../pages/instructor/InstructorCompanies'),
  '/instructor/reports': () => import('../pages/reports/ReportsAnalytics'),
  '/admin/reports': () => import('../pages/admin/AdminReports'),
  '/admin/assessments': () => import('../pages/admin/AdminAssessments'),
  '/admin/batches': () => import('../pages/admin/AdminBatches'),
  '/admin/skills': () => import('../pages/admin/AdminSkills'),
  '/admin/companies': () => import('../pages/admin/AdminCompanies'),
}

export function preloadPage(pathname) {
  return pages[pathname]?.().catch(() => {}) ?? Promise.resolve()
}
