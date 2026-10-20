import { useState, useSyncExternalStore } from 'react'
import { useApi } from './useApi'
import { queryStore } from '../api/queryStore.js'
import { requestErrorMessage } from '../api/requestErrors'
import { useSession } from '../context/SessionContext'

// Keep a last-good report across filter keys without publishing it under a new key.
// The shared store still owns requests, identity isolation, SSE and response races.
export function useAnalyticsData(url) {
  useApi(url)
  useSyncExternalStore(queryStore.observe, queryStore.revision)
  const { expired, triggerSessionExpired } = useSession()
  const current = queryStore.read(url)
  const failure = queryStore.error(url)
  const denied = expired || [401, 403, 404].includes(failure?.response?.status)
  const [snapshot, setSnapshot] = useState(() => ({ url, data: current?.data ?? null }))
  if (denied && snapshot.data) setSnapshot({ url, data: null })
  else if (!denied && current && (snapshot.url !== url || snapshot.data !== current.data)) setSnapshot({ url, data: current.data })
  // A cleared cache/session or revoked source must never survive in this fallback.
  const previous = snapshot.data && queryStore.read(snapshot.url)?.data === snapshot.data ? snapshot.data : null
  const data = denied ? null : current?.data ?? previous
  const updating = queryStore.pending(url) || (!current && !failure && !denied)
  const error = failure ? requestErrorMessage(failure) : null
  function retry() {
    queryStore.fetch(url).catch(error => {
      if (!error.staleIdentity && error.response?.status === 401) triggerSessionExpired()
    })
  }
  return { data, updating, error, denied, previous: !!data && !current, retry }
}
