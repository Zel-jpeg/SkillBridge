import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { fetchWithDedup, invalidateCache, updateCachedData, useApi } from './useApi'
import { useToast } from '../context/ToastContext'

const SUGGESTIONS_URL = '/api/placements/suggestions/?include_history=true&include_placed=true'
const HISTORY_URL = '/api/placements/?limit=500'
export const DRAFT_URL = '/api/placements/draft/'
const PLACEMENT_DEPENDENT_URLS = [
  '/api/admin/placement-analytics/',
  '/api/instructor/students/recommendations/',
  '/api/students/me/',
  '/api/student/results/',
]

export function usePlacements(historyUrl = HISTORY_URL) {
  const suggestionsApi = useApi(SUGGESTIONS_URL)
  const historyApi = useApi(historyUrl)
  const draftApi = useApi(DRAFT_URL)
  const mutationApi = useApi()
  const syncApi = useApi()
  const attemptedSync = useRef(null)
  const { showToast } = useToast()
  const [refreshing, setRefreshing] = useState(false)
  const { request: syncRequest, loading: syncing, error: syncError } = syncApi
  const synchronize = useCallback(async () => {
    const result = await syncRequest('post', DRAFT_URL, { action: 'sync' }, { silentError: true })
    if (result.ok) {
      updateCachedData(DRAFT_URL, result.data)
      if (result.data.changed) invalidateCache(SUGGESTIONS_URL)
    }
    return result
  }, [syncRequest])

  useEffect(() => {
    const draft = draftApi.data
    if (!draft || syncing || document.visibilityState !== 'visible') return
    const key = draft.sync_key || `${draft.revision}:${draft.updated_at}:${draft.stale}`
    // One initial server reconciliation and one attempt per changed input key.
    // Failed automatic writes require explicit retry instead of a request loop.
    if (attemptedSync.current === key || (attemptedSync.current !== null && draft.generated && !draft.stale)) return
    attemptedSync.current = key
    void synchronize()
  }, [draftApi.data, syncing, synchronize])

  const companies = useMemo(
    () => suggestionsApi.data?.companies ?? [],
    [suggestionsApi.data],
  )
  const placements = useMemo(
    () => historyApi.data?.placements ?? [],
    [historyApi.data],
  )
  const students = useMemo(
    () => suggestionsApi.data?.eligible_students ?? [],
    [suggestionsApi.data],
  )
  const approvedPlacements = useMemo(() => suggestionsApi.data?.approved_placements ?? [], [suggestionsApi.data])

  const positions = useMemo(() => companies.flatMap(company =>
    company.positions.map(position => ({
      ...position,
      company_id: company.id,
      company_name: company.name,
    }))
  ), [companies])

  const stats = useMemo(() => {
    const slots = positions.reduce((total, position) => total + position.slots_available, 0)
    const approved = positions.reduce((total, position) => total + position.approved_count, 0)
    const approvedStudentIds = new Set(
      approvedPlacements
        .map(placement => placement.student.id),
    )
    const actionable = positions.reduce((total, position) => total + position.suggested_students.filter(
      suggestion => ['unplaced', 'suggested'].includes(suggestion.placement_status)
    ).length, 0)
    return {
      companies: companies.length,
      positions: positions.length,
      slots,
      approved: approvedPlacements.length,
      remaining: Math.max(slots - approved, 0),
      actionable,
      unplaced: students.filter(student => !approvedStudentIds.has(student.id)).length,
    }
  }, [approvedPlacements, companies.length, positions, students])

  const refresh = useCallback(async ({ includeDraft = true, silentError = false } = {}) => {
    setRefreshing(true)
    invalidateCache(SUGGESTIONS_URL)
    invalidateCache('/api/placements/')
    if (includeDraft) invalidateCache(DRAFT_URL)
    PLACEMENT_DEPENDENT_URLS.forEach(invalidateCache)
    try {
      const results = await Promise.allSettled([
        fetchWithDedup(SUGGESTIONS_URL),
        fetchWithDedup(historyUrl),
        ...(includeDraft ? [fetchWithDedup(DRAFT_URL)] : []),
      ])
      // Each successful read publishes through the shared store, whose version
      // checks prevent an older read from replacing a newer mutation response.
      const ok = results.every(result => result.status === 'fulfilled')
      if (!ok && !silentError) showToast('Could not refresh placement data.', 'error')
      return { ok }
    } finally {
      setRefreshing(false)
    }
  }, [historyUrl, showToast])

  const draftAction = async payload => {
    const result = await mutationApi.request('post', DRAFT_URL, payload, { silentError: true })
    if (result.ok) updateCachedData(DRAFT_URL, result.data)
    return result
  }

  const mutate = useCallback(async (endpoint, payload, successMessage) => {
    const result = await mutationApi.request('post', endpoint, payload, { silentError: true })
    if (!result.ok) {
      showToast(result.message || 'Placement action failed.', 'error')
      return result
    }
    showToast(successMessage, 'success')
    await refresh()
    return result
  }, [mutationApi, refresh, showToast])

  return {
    companies,
    positions,
    placements,
    students,
    stats,
    draft: draftApi.data,
    approvedPlacements,
    historyCount: historyApi.data?.count ?? placements.length,
    historyUrl,
    draftAction,
    suggestionsReady: suggestionsApi.data != null,
    historyReady: historyApi.data != null,
    loading: suggestionsApi.loading || historyApi.loading,
    error: suggestionsApi.error || historyApi.error,
    mutating: mutationApi.loading,
    refreshing,
    syncing,
    syncError,
    synchronize,
    refresh,
    approve: (recommendationId, remarks) => mutate(
      '/api/placements/approve/',
      { recommendation_id: recommendationId, remarks },
      'Student placement approved.',
    ),
    remove: ({ placementId, recommendationId, remarks }) => mutate(
      '/api/placements/remove/',
      {
        ...(placementId ? { placement_id: placementId } : { recommendation_id: recommendationId }),
        remarks,
      },
      'Approved placement removed.',
    ),
    reject: ({ placementId, recommendationId, remarks }) => mutate(
      '/api/placements/reject/',
      {
        ...(placementId ? { placement_id: placementId } : { recommendation_id: recommendationId }),
        remarks,
      },
      'Placement suggestion declined.',
    ),
    manualAssign: (studentId, positionId, remarks) => mutate(
      '/api/placements/manual-assign/',
      { student_id: studentId, position_id: positionId, remarks },
      'Student manually assigned.',
    ),
  }
}
