// src/router/PrivateRoute.jsx
//
// Protects routes from:
//   1. Unauthenticated access (no token) → redirect to /login
//   2. Wrong-role access (student on admin page) → redirect to correct login
//   3. Back button after logout → replace: true means back goes to login, not the protected page
//
// Usage in App.jsx:
//   <Route path="/admin/dashboard" element={
//     <PrivateRoute role="admin"><AdminDashboard /></PrivateRoute>
//   } />
//
// Public routes (login pages) need NO wrapper.

import { Navigate } from 'react-router-dom'
import { useEffect } from 'react'
import { startSSE, closeSSE } from '../hooks/useSSE'

function LiveSession({ children }) {
  useEffect(() => { startSSE(); return closeSSE }, [])
  return children
}

const ROLE_REDIRECTS = {
  admin:      '/admin/login',
  instructor: '/login',
  student:    '/login',
}

export default function PrivateRoute({ children, role }) {
  const token    = localStorage.getItem('sb-token')
  const userRole = localStorage.getItem('sb-role')

  // No token at all → send to login
  if (!token) {
    const loginPage = ROLE_REDIRECTS[role] ?? '/login'
    return <Navigate to={loginPage} replace />
  }

  // Token exists but wrong role (e.g., student trying to visit /admin/*)
  if (role && userRole !== role) {
    const loginPage = ROLE_REDIRECTS[role] ?? '/login'
    return <Navigate to={loginPage} replace />
  }

  let user
  try { user = JSON.parse(localStorage.getItem('sb-user')) } catch { /* Server remains authoritative. */ }
  if (user?.role === userRole && userRole !== 'admin' && user.is_approved === false) {
    return <Navigate to="/instructor/pending" replace state={{ type: userRole === 'student' ? 'student_waiting' : 'instructor_waiting' }} />
  }

  return <LiveSession key={`${userRole}:${token}`}>{children}</LiveSession>
}
