import { Routes, Route, Navigate } from 'react-router-dom'
import PrivateRoute from './router/PrivateRoute'

// Auth
import LoginPage from './pages/auth/LoginPage'
import AdminLogin from './pages/auth/AdminLogin'
import ChooseRolePage from './pages/auth/ChooseRolePage'

// Student pages
import StudentSetup from './pages/student/StudentSetup'
import StudentDashboard from './pages/student/StudentDashboard'
import StudentAssessment from './pages/student/StudentAssessment'
import StudentResults from './pages/student/StudentResults'
import StudentProfile from './pages/student/StudentProfile'

// Instructor pages
import InstructorDashboard from './pages/instructor/InstructorDashboard'
import InstructorUpload from './pages/instructor/InstructorUpload'
import EnrolledStudents from './pages/instructor/EnrolledStudents'
import InstructorPending from './pages/instructor/InstructorPending'
import InstructorAssessments from './pages/instructor/InstructorAssessments'

// Admin pages
import AdminDashboard from './pages/admin/AdminDashboard'
import AdminCompanies from './pages/admin/AdminCompanies'
import AdminUsers from './pages/admin/AdminUsers'
import AdminNotifications from './pages/admin/AdminNotifications'

function App() {
  return (
    <Routes>
      {/* ── Public routes ──────────────────────────────────────────── */}
      <Route path="/"            element={<LoginPage />} />
      <Route path="/login"       element={<LoginPage />} />
      <Route path="/admin/login" element={<AdminLogin />} />
      <Route path="/account/choose-role" element={<ChooseRolePage />} />

      {/*
        /instructor/pending is PUBLIC — an unapproved instructor lands here
        before they have a valid role, so we cannot guard it.
      */}
      <Route path="/instructor/pending" element={<InstructorPending />} />

      {/* ── Student routes (requires role="student") ───────────────── */}
      {/*
        /student/setup is accessible by students who just authenticated via
        Google OAuth but haven't finished profile setup yet.
        The backend endpoint itself still requires a valid JWT.
      */}
      <Route path="/student/setup" element={
        <PrivateRoute role="student"><StudentSetup /></PrivateRoute>
      } />
      <Route path="/student/dashboard" element={
        <PrivateRoute role="student"><StudentDashboard /></PrivateRoute>
      } />
      <Route path="/student/assessment" element={
        <PrivateRoute role="student"><StudentAssessment /></PrivateRoute>
      } />
      <Route path="/student/results" element={
        <PrivateRoute role="student"><StudentResults /></PrivateRoute>
      } />
      <Route path="/student/profile" element={
        <PrivateRoute role="student"><StudentProfile /></PrivateRoute>
      } />

      {/* ── Instructor routes (requires role="instructor") ─────────── */}
      <Route path="/instructor/dashboard" element={
        <PrivateRoute role="instructor"><InstructorDashboard /></PrivateRoute>
      } />
      <Route path="/instructor/assessment/create" element={
        <PrivateRoute role="instructor"><InstructorUpload /></PrivateRoute>
      } />
      <Route path="/instructor/students" element={
        <PrivateRoute role="instructor"><EnrolledStudents /></PrivateRoute>
      } />
      <Route path="/instructor/assessments" element={
        <PrivateRoute role="instructor"><InstructorAssessments /></PrivateRoute>
      } />

      {/* ── Admin routes (requires role="admin") ───────────────────── */}
      <Route path="/admin/dashboard" element={
        <PrivateRoute role="admin"><AdminDashboard /></PrivateRoute>
      } />
      <Route path="/admin/companies" element={
        <PrivateRoute role="admin"><AdminCompanies /></PrivateRoute>
      } />
      <Route path="/admin/users" element={
        <PrivateRoute role="admin"><AdminUsers /></PrivateRoute>
      } />
      <Route path="/admin/notifications" element={
        <PrivateRoute role="admin"><AdminNotifications /></PrivateRoute>
      } />

      {/* ── Catch-all → redirect unknown URLs to login ─────────────── */}
      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  )
}

export default App