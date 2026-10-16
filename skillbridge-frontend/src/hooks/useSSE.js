import { useEffect } from 'react'
import api from '../api/axios'
import { createEventStream } from '../api/eventStream'
import { applyDataChange } from './useApi'

const BASE_URL = import.meta.env.VITE_API_URL ?? 'http://127.0.0.1:8000'
function identity() {
  const token = localStorage.getItem('sb-token')
  const role = localStorage.getItem('sb-role')
  let id = ''
  try { id = JSON.parse(localStorage.getItem('sb-user'))?.id ?? '' } catch { /* Invalid identity. */ }
  return { token, role, key: `${role}:${id}:${token}` }
}
const manager = createEventStream({
  identity,
  preflight: user => api.get(`/api/${user.role}/events/?check=1`, { _sbToken: user.token }),
  source: user => new EventSource(`${BASE_URL}/api/${user.role}/events/?token=${encodeURIComponent(user.token)}`),
  changed: applyDataChange,
  unauthorized: () => window.dispatchEvent(new Event('auth:expired')),
  visible: () => document.visibilityState === 'visible',
})
let listening = false
function storageChanged(event) {
  if (['sb-token', 'sb-role', 'sb-user', null].includes(event.key)) manager.start()
}
export function startSSE() {
  if (!listening) {
    document.addEventListener('visibilitychange', manager.visibilityChanged)
    window.addEventListener('storage', storageChanged)
    listening = true
  }
  manager.start()
}
export function closeSSE() {
  manager.stop()
  document.removeEventListener('visibilitychange', manager.visibilityChanged)
  window.removeEventListener('storage', storageChanged)
  listening = false
}
// Existing page hooks may still ensure the connection; PrivateRoute owns cleanup.
export function useSSE() {
  useEffect(() => { startSSE() }, [])
}
