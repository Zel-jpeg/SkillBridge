// The browser's module loader owns code deduplication. Data still lives only in
// queryStore; a chunk failure falls back to the route's normal retry boundary.
const pages = {
  '/student/dashboard': () => import('../pages/student/StudentDashboard'),
  '/student/assessments': () => import('../pages/student/StudentAssessments'),
  '/student/results': () => import('../pages/student/StudentResults'),
  '/student/profile': () => import('../pages/student/StudentProfile'),
  '/instructor/students': () => import('../pages/instructor/EnrolledStudents'),
  '/instructor/dashboard': () => import('../pages/instructor/InstructorDashboard'),
  '/instructor/assessment/create': () => import('../pages/instructor/InstructorUpload'),
  '/instructor/placements': () => import('../pages/placements/PlacementsPage'),
  '/instructor/assessments': () => import('../pages/instructor/InstructorAssessments'),
  '/instructor/assessments/archives': () => import('../pages/assessments/AssessmentArchives'),
  '/admin/assessments/archives': () => import('../pages/assessments/AssessmentArchives'),
  '/instructor/companies': () => import('../pages/instructor/InstructorCompanies'),
  '/instructor/reports': () => import('../pages/reports/ReportsAnalytics'),
  '/admin/reports': () => import('../pages/admin/AdminReports'),
  '/admin/dashboard': () => import('../pages/admin/AdminDashboard'),
  '/admin/assessment/create': () => import('../pages/instructor/InstructorUpload'),
  '/admin/placements': () => import('../pages/admin/AdminPlacements'),
  '/admin/assessments': () => import('../pages/admin/AdminAssessments'),
  '/admin/batches': () => import('../pages/admin/AdminBatches'),
  '/admin/skills': () => import('../pages/admin/AdminSkills'),
  '/admin/companies': () => import('../pages/admin/AdminCompanies'),
}

export function preloadPage(pathname) {
  return pages[pathname]?.().catch(() => {}) ?? Promise.resolve()
}
