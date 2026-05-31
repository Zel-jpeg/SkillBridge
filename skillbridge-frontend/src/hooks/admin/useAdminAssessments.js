import { useState } from 'react'
import { useApi } from '../useApi'

export function useAdminAssessments() {
  const { data: rawData, loading } = useApi('/api/instructor/assessments/')
  const assessments = Array.isArray(rawData) ? rawData : []

  const [search,     setSearch]     = useState('')
  const [filterStatus, setFilterStatus] = useState('all') // 'all' | 'active' | 'inactive'
  const [page,       setPage]       = useState(1)
  const PAGE_SIZE = 10

  const filtered = assessments.filter(a => {
    const matchSearch =
      a.title.toLowerCase().includes(search.toLowerCase()) ||
      (a.batch_name || '').toLowerCase().includes(search.toLowerCase())
    const matchStatus =
      filterStatus === 'all' ||
      (filterStatus === 'active'   &&  a.is_active) ||
      (filterStatus === 'inactive' && !a.is_active)
    return matchSearch && matchStatus
  })

  const sorted = [...filtered].sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
  const paginated = sorted.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  const counts = {
    all:      assessments.length,
    active:   assessments.filter(a =>  a.is_active).length,
    inactive: assessments.filter(a => !a.is_active).length,
  }

  return {
    assessments: paginated,
    loading,
    search, setSearch: v => { setSearch(v); setPage(1) },
    filterStatus, setFilterStatus: v => { setFilterStatus(v); setPage(1) },
    page, setPage,
    total: sorted.length,
    PAGE_SIZE,
    counts,
  }
}
