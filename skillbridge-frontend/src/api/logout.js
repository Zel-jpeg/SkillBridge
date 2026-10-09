import { clearAllCache } from '../hooks/useApi'
import { resetPrefetch } from './prefetch'
import { closeSSE } from '../hooks/useSSE'
import { ROLE_METADATA } from '../navigation/navigation'

export function resetSessionData() {
  clearAllCache()
  resetPrefetch()
  closeSSE()
  try { sessionStorage.removeItem('sb_instructor_students_cache') } catch { /* Storage may be unavailable. */ }
}

export function logoutSession(navigate, role = localStorage.getItem('sb-role')) {
  for (const key of ['sb-token', 'sb-refresh', 'sb-role', 'sb-user']) localStorage.removeItem(key)
  resetSessionData()
  navigate(ROLE_METADATA[role]?.loginPath ?? '/login', { replace: true })
}
