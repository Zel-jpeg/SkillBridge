import { useEffect } from 'react'
import api from '../api/axios'
import { createEventStream } from '../api/eventStream'
import { createRealtimeStream } from '../api/realtimeStream'
import { applyDataChange } from './useApi'

const BASE_URL = import.meta.env.VITE_API_URL ?? 'http://127.0.0.1:8000'
function identity() {
  const token = localStorage.getItem('sb-token')
  const role = localStorage.getItem('sb-role')
  let id = ''
  try { id = JSON.parse(localStorage.getItem('sb-user'))?.id ?? '' } catch { /* Invalid identity. */ }
  return { token, role, key: `${role}:${id}:${localStorage.getItem('sb-session-id') ?? ''}:${token}` }
}
const sse = createEventStream({
  identity,
  preflight: user => api.get(`/api/${user.role}/events/?check=1`, { _sbToken: user.token }),
  source: user => new EventSource(`${BASE_URL}/api/${user.role}/events/?token=${encodeURIComponent(user.token)}`),
  changed: applyDataChange,
  unauthorized: () => window.dispatchEvent(new Event('auth:expired')),
  visible: () => document.visibilityState === 'visible',
})
const manager = import.meta.env.VITE_SUPABASE_REALTIME_PILOT === 'true'
  ? createRealtimeStream({
    enabled: true,
    identity,
    session: async (user, { signal }) => (await api.post('/api/realtime/session/', {}, {
      _sbToken: user.token, signal, timeout: 5000,
    })).data,
    load: async () => (await import('../api/supabaseRealtime')).openSupabaseRealtime,
    sse,
    changed: applyDataChange,
    unauthorized: () => window.dispatchEvent(new Event('auth:expired')),
    visible: () => document.visibilityState === 'visible',
  }) : sse
let listening = false
function storageChanged(event) {
  if (event.type === 'auth:renewed' || ['sb-token', 'sb-role', 'sb-user', 'sb-session-id', null].includes(event.key)) manager.start()
}
export function startSSE() {
  if (!listening) {
    document.addEventListener('visibilitychange', manager.visibilityChanged)
    window.addEventListener('storage', storageChanged)
    window.addEventListener('auth:renewed', storageChanged)
    listening = true
  }
  manager.start()
}
export function closeSSE() {
  manager.stop()
  document.removeEventListener('visibilitychange', manager.visibilityChanged)
  window.removeEventListener('storage', storageChanged)
  window.removeEventListener('auth:renewed', storageChanged)
  listening = false
}
// Existing page hooks may still ensure the connection; PrivateRoute owns cleanup.
export function useSSE() {
  useEffect(() => { startSSE() }, [])
}
