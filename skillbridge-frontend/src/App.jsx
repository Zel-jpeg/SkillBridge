import { Routes, Route } from 'react-router-dom'

// Auth
import LoginPage from './pages/auth/LoginPage'
import AdminLogin from './pages/auth/AdminLogin'

// Student pages
import StudentSetup from './pages/student/StudentSetup'
import StudentDashboard from './pages/student/StudentDashboard'
import StudentAssessment from './pages/student/StudentAssessment'
import StudentResults from './pages/student/StudentResults'
import StudentProfile    from './pages/student/StudentProfile'

// Instructor pages
import InstructorDashboard from './pages/instructor/InstructorDashboard'
import InstructorUpload from './pages/instructor/InstructorUpload'
import EnrolledStudents from './pages/instructor/EnrolledStudents'

// Admin pages
import AdminDashboard from './pages/admin/AdminDashboard'
import AdminCompanies from './pages/admin/AdminCompanies'
import AdminStudents from './pages/admin/AdminStudents'

function App() {
  return (
    <Routes>
      {/* Auth */}
      <Route path="/" element={<LoginPage />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/admin/login" element={<AdminLogin />} />

      {/* Student */}
      <Route path="/student/setup" element={<StudentSetup />} />
      <Route path="/student/dashboard" element={<StudentDashboard />} />
      <Route path="/student/assessment" element={<StudentAssessment />} />
      <Route path="/student/results" element={<StudentResults />} />
      <Route path="/student/profile"     element={<StudentProfile />} />

      {/* Instructor */}
      <Route path="/instructor/dashboard" element={<InstructorDashboard />} />
      <Route path="/instructor/assessment/create" element={<InstructorUpload />} />
      <Route path="/instructor/students" element={<EnrolledStudents />} />

      {/* Admin */}
      <Route path="/admin/dashboard" element={<AdminDashboard />} />
      <Route path="/admin/companies" element={<AdminCompanies />} />
      <Route path="/admin/students" element={<AdminStudents />} />
    </Routes>
  )
}

export default App