// src/api/prefetch.js
//
// Prefetch — fires all API calls for a given role immediately after auth check,
// populating the useApi in-memory cache BEFORE any page component mounts.
//
// This means when a user navigates to any page, the data is already in cache
// and renders instantly with no loading spinner.
//
// Called from PrivateRoute.jsx on every protected route render.

import { fetchWithDedup } from '../hooks/useApi'

// ── Endpoints to prefetch per role ──────────────────────────────────
const PREFETCH_URLS = {
  admin: [
    '/api/admin/stats/',
    '/api/admin/students/recommendations/',
    '/api/admin/users/',
    '/api/admin/companies/',
  ],
  instructor: [
    '/api/instructor/students/recommendations/',
    '/api/instructor/batches/',
    '/api/auth/me/',
  ],
  student: [
    '/api/students/me/',
    '/api/assessments/active/',
    '/api/student/results/',
  ],
}

// Track which roles we've already prefetched this session
const _prefetched = new Set()

/**
 * Fire all prefetch requests for the given role.
 * Safe to call multiple times — only fires once per role per session.
 */
export function prefetchForRole(role) {
  if (!role || _prefetched.has(role)) return
  _prefetched.add(role)

  const urls = PREFETCH_URLS[role] ?? []
  urls.forEach(url => {
    fetchWithDedup(url).catch(() => {})
  })
}

/** Reset prefetch state (call on logout so next login re-prefetches). */
export function resetPrefetch() {
  _prefetched.clear()
}
