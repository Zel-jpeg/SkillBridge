import { useSyncExternalStore } from 'react'
import { queryStore } from '../../api/queryStore'
import { useApi } from '../useApi'
import { ASSESSMENTS_URL } from '../../utils/adminAssessmentState'

// Observe failures as well as last-good data during background reconciliation.
// useApi remains the sole owner of requests, deduplication and live subscriptions.
export function useAssessmentQuery(url) {
  const result = useApi(url)
  useSyncExternalStore(queryStore.observe, queryStore.revision)
  const failure = url ? queryStore.error(url) : null
  return { ...result, error: failure ? failure.response?.data?.error || 'Could not refresh this section.' : result.error,
    errorStatus: failure?.response?.status ?? result.errorStatus }
}

export function useAdminAssessments() {
  return useAssessmentQuery(ASSESSMENTS_URL)
}
