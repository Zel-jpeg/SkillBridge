import { useEffect, useRef } from 'react'
import { authDestination } from '../api/authDestination'
import { prepareDashboard } from '../api/prefetch.js'

export function useLoginPreparation() {
  const pending = useRef(null)
  useEffect(() => {
    // Expiry of the retiring session must not cancel a new auth exchange.
    const expire = () => { if (pending.current?.preparing) pending.current.controller.abort() }
    window.addEventListener('auth:expired', expire)
    return () => {
      window.removeEventListener('auth:expired', expire)
      pending.current?.controller.abort()
      pending.current = null
    }
  }, [])
  function beginPreparation() {
    pending.current?.controller.abort()
    const controller = new AbortController()
    pending.current = { controller, preparing: false }
    return controller
  }
  async function completePreparation(user, controller) {
    if (controller.signal.aborted) return null
    pending.current.preparing = true
    const destination = authDestination(user)
    const result = await prepareDashboard(destination, { signal: controller.signal, userId: user.id })
    return result.reason === 'cancelled' || controller.signal.aborted ? null : destination
  }
  return { beginPreparation, completePreparation,
    isCurrentPreparation: controller => pending.current?.controller === controller }
}
