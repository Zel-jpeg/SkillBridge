import { lazy, Suspense, useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import ErrorBoundary from './components/ErrorBoundary'
import { ContentSkeleton } from './components/DataSection'
import { loadDestination, prepareNavigation } from './api/prefetch.js'
import { useSession } from './context/SessionContext'
import { Routes, Route, Navigate, useParams } from 'react-router-dom'
import PrivateRoute from './router/PrivateRoute'
import AuthenticatedShell from './components/layout/AuthenticatedShell'

// Auth
import LoginPage from './pages/auth/LoginPage'
import AdminLogin from './pages/auth/AdminLogin'

// Student pages
const StudentSetup = lazy(() => import('./pages/student/StudentSetup'))
const StudentDashboard = lazy(() => import('./pages/student/StudentDashboard'))
const StudentAssessment = lazy(() => import('./pages/student/StudentAssessment'))
const StudentAssessments = lazy(() => import('./pages/student/StudentAssessments'))
const StudentAssessmentResult = lazy(() => import('./pages/student/StudentAssessmentResult'))
const StudentResults = lazy(() => import('./pages/student/StudentResults'))
const StudentProfile = lazy(() => import('./pages/student/StudentProfile'))

// Instructor pages
const InstructorDashboard = lazy(() => import('./pages/instructor/InstructorDashboard'))
const InstructorUpload = lazy(() => import('./pages/instructor/InstructorUpload'))
const EnrolledStudents = lazy(() => import('./pages/instructor/EnrolledStudents'))
const InstructorPending = lazy(() => import('./pages/instructor/InstructorPending'))
const InstructorAssessments = lazy(() => import('./pages/instructor/InstructorAssessments'))
const AssessmentArchives = lazy(() => import('./pages/assessments/AssessmentArchives'))
const InstructorCompanies = lazy(() => import('./pages/instructor/InstructorCompanies'))
const InstructorPlacements = lazy(() => import('./pages/placements/PlacementsPage').then(module => ({ default: module.InstructorPlacements })))
const ReportsAnalytics = lazy(() => import('./pages/reports/ReportsAnalytics'))

// Admin pages
const AdminDashboard = lazy(() => import('./pages/admin/AdminDashboard'))
const AdminCompanies = lazy(() => import('./pages/admin/AdminCompanies'))
const AdminUsers = lazy(() => import('./pages/admin/AdminUsers'))
const AdminSkills = lazy(() => import('./pages/admin/AdminSkills'))
const AdminAssessments = lazy(() => import('./pages/admin/AdminAssessments'))
const AdminBatches = lazy(() => import('./pages/admin/AdminBatches'))
const AdminReports = lazy(() => import('./pages/admin/AdminReports'))
const AdminPlacements = lazy(() => import('./pages/admin/AdminPlacements'))

function PreparedPage({ children }) {
  const { pathname } = useLocation()
  const { expired } = useSession()
  const role = pathname.split('/')[1]
  useEffect(() => {
    if (expired || pathname === '/student/setup' || pathname.endsWith('/take') || pathname === '/instructor/pending') return
    return prepareNavigation(role, pathname)
  }, [role, pathname, expired])
  return children
}

function Page({ children }) {
  const { pathname } = useLocation()
  const { expired } = useSession()
  useEffect(() => {
    if (!expired) loadDestination(pathname)
  }, [pathname, expired])
  return <ErrorBoundary key={pathname}><Suspense fallback={<div className="p-6"><ContentSkeleton layout="stats" /><div className="mt-6"><ContentSkeleton layout="table" /></div></div>}>
    <PreparedPage>{children}</PreparedPage>
  </Suspense></ErrorBoundary>
}

function AssessmentTakeRoute() {
  const { assessmentId } = useParams()
  return <StudentAssessment key={assessmentId} />
}

function AssessmentResultRoute() {
  const { assessmentId } = useParams()
  return <StudentAssessmentResult key={assessmentId} />
}

function App() {
  return (
    <Routes>
      <Route path="/" element={<LoginPage />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/admin/login" element={<AdminLogin />} />
      <Route path="/instructor/pending" element={<Page><InstructorPending /></Page>} />

      <Route path="/student/setup" element={<PrivateRoute role="student"><Page><StudentSetup /></Page></PrivateRoute>} />
      <Route path="/student/assessments/:assessmentId/take" element={<PrivateRoute role="student"><Page><AssessmentTakeRoute /></Page></PrivateRoute>} />

      <Route element={<PrivateRoute role="student"><AuthenticatedShell role="student" /></PrivateRoute>}>
        <Route path="/student/dashboard" element={<Page><StudentDashboard /></Page>} />
        <Route path="/student/assessment" element={<Navigate to="/student/assessments" replace />} />
        <Route path="/student/assessments" element={<Page><StudentAssessments /></Page>} />
        <Route path="/student/assessments/:assessmentId/results" element={<Page><AssessmentResultRoute /></Page>} />
        <Route path="/student/results" element={<Page><StudentResults /></Page>} />
        <Route path="/student/profile" element={<Page><StudentProfile /></Page>} />
      </Route>

      <Route element={<PrivateRoute role="instructor"><AuthenticatedShell role="instructor" /></PrivateRoute>}>
        <Route path="/instructor/dashboard" element={<Page><InstructorDashboard /></Page>} />
        <Route path="/instructor/reports" element={<Page><ReportsAnalytics role="instructor" /></Page>} />
        <Route path="/instructor/students" element={<Page><EnrolledStudents /></Page>} />
        <Route path="/instructor/assessments" element={<Page><InstructorAssessments /></Page>} />
        <Route path="/instructor/assessments/archives" element={<Page><AssessmentArchives role="instructor" /></Page>} />
        <Route path="/instructor/assessment/create" element={<Page><InstructorUpload /></Page>} />
        <Route path="/instructor/companies" element={<Page><InstructorCompanies /></Page>} />
        <Route path="/instructor/placements" element={<Page><InstructorPlacements /></Page>} />
      </Route>

      <Route element={<PrivateRoute role="admin"><AuthenticatedShell role="admin" /></PrivateRoute>}>
        <Route path="/admin/dashboard" element={<Page><AdminDashboard /></Page>} />
        <Route path="/admin/skills" element={<Page><AdminSkills /></Page>} />
        <Route path="/admin/companies" element={<Page><AdminCompanies /></Page>} />
        <Route path="/admin/placements" element={<Page><AdminPlacements /></Page>} />
        <Route path="/admin/users" element={<Page><AdminUsers /></Page>} />
        <Route path="/admin/assessments" element={<Page><AdminAssessments /></Page>} />
        <Route path="/admin/assessments/archives" element={<Page><AssessmentArchives role="admin" /></Page>} />
        <Route path="/admin/assessment/create" element={<Page><InstructorUpload role="admin" /></Page>} />
        <Route path="/admin/batches" element={<Page><AdminBatches /></Page>} />
        <Route path="/admin/reports" element={<Page><AdminReports /></Page>} />
      </Route>
      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  )
}

export default App
