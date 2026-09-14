import { useCallback, useMemo, useState } from 'react'
import { fetchWithDedup, invalidateCache, useApi } from './useApi'
import { useToast } from '../context/ToastContext'

const SUGGESTIONS_URL = '/api/placements/suggestions/?include_history=true&include_placed=true'
const HISTORY_URL = '/api/placements/?limit=500'
const PLACEMENT_DEPENDENT_URLS = [
  '/api/admin/placement-analytics/',
  '/api/instructor/students/recommendations/',
  '/api/students/me/',
  '/api/student/results/',
]

export function usePlacements() {
  const suggestionsApi = useApi(SUGGESTIONS_URL)
  const historyApi = useApi(HISTORY_URL)
  const mutationApi = useApi()
  const { showToast } = useToast()
  const [refreshing, setRefreshing] = useState(false)

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
      placements
        .filter(placement => placement.status === 'approved')
        .map(placement => placement.student.id),
    )
    const actionable = positions.reduce((total, position) => total + position.suggested_students.filter(
      suggestion => ['unplaced', 'suggested'].includes(suggestion.placement_status)
    ).length, 0)
    return {
      companies: companies.length,
      positions: positions.length,
      slots,
      approved,
      remaining: Math.max(slots - approved, 0),
      actionable,
      unplaced: students.filter(student => !approvedStudentIds.has(student.id)).length,
    }
  }, [companies.length, placements, positions, students])

  const refresh = useCallback(async () => {
    setRefreshing(true)
    invalidateCache(SUGGESTIONS_URL)
    invalidateCache(HISTORY_URL)
    PLACEMENT_DEPENDENT_URLS.forEach(invalidateCache)
    try {
      const [suggestions, history] = await Promise.all([
        fetchWithDedup(SUGGESTIONS_URL),
        fetchWithDedup(HISTORY_URL),
      ])
      suggestionsApi.setData(suggestions.data)
      historyApi.setData(history.data)
    } catch {
      showToast('Could not refresh placement data.', 'error')
    } finally {
      setRefreshing(false)
    }
  }, [historyApi, showToast, suggestionsApi])

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
    loading: suggestionsApi.loading || historyApi.loading,
    error: suggestionsApi.error || historyApi.error,
    mutating: mutationApi.loading,
    refreshing,
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
      'Placement suggestion removed.',
    ),
    reject: ({ placementId, recommendationId, remarks }) => mutate(
      '/api/placements/reject/',
      {
        ...(placementId ? { placement_id: placementId } : { recommendation_id: recommendationId }),
        remarks,
      },
      'Placement suggestion rejected.',
    ),
    manualAssign: (studentId, positionId, remarks) => mutate(
      '/api/placements/manual-assign/',
      { student_id: studentId, position_id: positionId, remarks },
      'Student manually assigned.',
    ),
  }
}
