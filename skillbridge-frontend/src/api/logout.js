import { clearAllCache } from '../hooks/useApi'
import { resetPrefetch } from './prefetch'
import { closeSSE } from '../hooks/useSSE'
import { ROLE_METADATA } from '../navigation/navigation'

export function logoutSession(navigate, role = localStorage.getItem('sb-role')) {
  for (const key of ['sb-token', 'sb-refresh', 'sb-role', 'sb-user']) localStorage.removeItem(key)
  clearAllCache()
  resetPrefetch()
  closeSSE()
  navigate(ROLE_METADATA[role]?.loginPath ?? '/login', { replace: true })
}
