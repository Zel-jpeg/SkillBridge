import { Routes, Route, Navigate, useParams } from 'react-router-dom'
import PrivateRoute from './router/PrivateRoute'
import AuthenticatedShell from './components/layout/AuthenticatedShell'

// Auth
import LoginPage from './pages/auth/LoginPage'
import AdminLogin from './pages/auth/AdminLogin'

// Student pages
import StudentSetup from './pages/student/StudentSetup'
import StudentDashboard from './pages/student/StudentDashboard'
import StudentAssessment from './pages/student/StudentAssessment'
import StudentAssessments from './pages/student/StudentAssessments'
import StudentAssessmentResult from './pages/student/StudentAssessmentResult'
import StudentResults from './pages/student/StudentResults'
import StudentProfile from './pages/student/StudentProfile'

// Instructor pages
import InstructorDashboard from './pages/instructor/InstructorDashboard'
import InstructorUpload from './pages/instructor/InstructorUpload'
import EnrolledStudents from './pages/instructor/EnrolledStudents'
import InstructorPending from './pages/instructor/InstructorPending'
import InstructorAssessments from './pages/instructor/InstructorAssessments'
import InstructorCompanies from './pages/instructor/InstructorCompanies'
import { InstructorPlacements } from './pages/placements/PlacementsPage'

// Admin pages
import AdminDashboard from './pages/admin/AdminDashboard'
import AdminCompanies from './pages/admin/AdminCompanies'
import AdminUsers from './pages/admin/AdminUsers'
import AdminSkills from './pages/admin/AdminSkills'
import AdminAssessments from './pages/admin/AdminAssessments'
import AdminReports from './pages/admin/AdminReports'
import AdminPlacements from './pages/admin/AdminPlacements'

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
      <Route path="/instructor/pending" element={<InstructorPending />} />

      <Route path="/student/setup" element={<PrivateRoute role="student"><StudentSetup /></PrivateRoute>} />
      <Route path="/student/assessments/:assessmentId/take" element={<PrivateRoute role="student"><AssessmentTakeRoute /></PrivateRoute>} />

      <Route element={<PrivateRoute role="student"><AuthenticatedShell role="student" /></PrivateRoute>}>
        <Route path="/student/dashboard" element={<StudentDashboard />} />
        <Route path="/student/assessment" element={<Navigate to="/student/assessments" replace />} />
        <Route path="/student/assessments" element={<StudentAssessments />} />
        <Route path="/student/assessments/:assessmentId/results" element={<AssessmentResultRoute />} />
        <Route path="/student/results" element={<StudentResults />} />
        <Route path="/student/profile" element={<StudentProfile />} />
      </Route>

      <Route element={<PrivateRoute role="instructor"><AuthenticatedShell role="instructor" /></PrivateRoute>}>
        <Route path="/instructor/dashboard" element={<InstructorDashboard />} />
        <Route path="/instructor/students" element={<EnrolledStudents />} />
        <Route path="/instructor/assessments" element={<InstructorAssessments />} />
        <Route path="/instructor/assessment/create" element={<InstructorUpload />} />
        <Route path="/instructor/companies" element={<InstructorCompanies />} />
        <Route path="/instructor/placements" element={<InstructorPlacements />} />
      </Route>

      <Route element={<PrivateRoute role="admin"><AuthenticatedShell role="admin" /></PrivateRoute>}>
        <Route path="/admin/dashboard" element={<AdminDashboard />} />
        <Route path="/admin/skills" element={<AdminSkills />} />
        <Route path="/admin/companies" element={<AdminCompanies />} />
        <Route path="/admin/placements" element={<AdminPlacements />} />
        <Route path="/admin/users" element={<AdminUsers />} />
        <Route path="/admin/assessments" element={<AdminAssessments />} />
        <Route path="/admin/reports" element={<AdminReports />} />
      </Route>
      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  )
}

export default App
