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

const ROLE_REDIRECTS = {
  admin:      '/admin/login',
  instructor: '/admin/login',  // same login page, different role
  student:    '/login',
}

export default function PrivateRoute({ children, role }) {
  const token = localStorage.getItem('sb-token')
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

  return children
}
