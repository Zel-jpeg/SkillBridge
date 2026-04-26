// src/api/prefetch.js
//
// Prefetch — fires all API calls for a given role immediately after login,
// populating the useApi in-memory cache BEFORE any dashboard mounts.
//
// Returns a Promise so the login handler can AWAIT it before navigate().
// This means the loading spinner on the Sign In button covers the fetch time,
// and the dashboard renders instantly with no spinners of its own.
//
// Called from LoginPage.jsx / AdminLogin.jsx:
//   await prefetchForRole(user.role)
//   navigate('/admin/dashboard')   ← data is already cached by this line

import { fetchWithDedup } from '../hooks/useApi'

// ── Endpoints to prefetch per role ──────────────────────────────────
const PREFETCH_URLS = {
  admin: [
    '/api/admin/stats/',
    '/api/admin/students/recommendations/',
    '/api/admin/users/',
    '/api/admin/companies/',
    '/api/categories/',               // needed by Companies page position editor
  ],
  instructor: [
    '/api/instructor/students/recommendations/',
    '/api/instructor/batches/',
    '/api/auth/me/',
    '/api/instructor/assessments/',   // Assessments list page
    '/api/instructor/companies/',     // Companies page
    '/api/categories/',               // assessment question editor
  ],
  student: [
    '/api/students/me/',
    '/api/assessments/active/',
    '/api/student/results/',
    '/api/student/results/review/',   // answer-review panel on Results page
  ],
}

// Track which roles we've already prefetched this session
const _prefetched = new Set()

/**
 * Fire all prefetch requests for the given role and wait for them all.
 * Returns a Promise that resolves when every request has settled
 * (fulfilled or failed — failures are swallowed so login never breaks).
 *
 * Safe to call multiple times — only fires once per role per session.
 * On repeated calls the Promise resolves immediately (already cached).
 */
export function prefetchForRole(role) {
  if (!role || _prefetched.has(role)) return Promise.resolve()
  _prefetched.add(role)

  const urls = PREFETCH_URLS[role] ?? []

  // Promise.allSettled — we don't want a single failed endpoint to
  // prevent navigation. Errors are silently ignored here; components
  // that need the data will surface errors themselves via useApi.
  return Promise.allSettled(
    urls.map(url => fetchWithDedup(url))
  )
}

/** Reset prefetch state (call on logout so next login re-prefetches). */
export function resetPrefetch() {
  _prefetched.clear()
}