// src/hooks/admin/useAdminDashboard.js
//
// Data hook for AdminDashboard.
// Fetches stats + student recommendations and derives UI state.
//
// Real-time updates via SSE:
//   useSSE() keeps a singleton EventSource connection open.
//   When the server detects DB changes it sends invalidate URLs →
//   useApi re-fetches silently → components re-render automatically.

import { useState, useMemo } from 'react'
import { useApi } from '../useApi'
import { useSSE } from '../useSSE'
import { normalizeDashboardStudent } from '../../utils/dashboardStudents'

const PAGE_SIZE = 10
const SSE_PATH  = '/api/admin/events/'

export function useAdminDashboard() {
  // ── Real-time SSE connection ──────────────────────────────────────
  useSSE(SSE_PATH)

  const { data: studentsData } = useApi('/api/admin/students/recommendations/')

  // ── Normalize API data ────────────────────────────────────────────
  const students = useMemo(() => {
    if (!studentsData || !Array.isArray(studentsData)) return []
    return studentsData.map(normalizeDashboardStudent)
  }, [studentsData])

  // ── UI state ──────────────────────────────────────────────────────
  const [search,       setSearch]  = useState('')
  const [filterStatus, setFilter]  = useState('all')
  const [page,         setPage]    = useState(1)
  const [view,         setView]    = useState('grid')

  const filtered = useMemo(() => {
    let list = students
    if (filterStatus !== 'all') list = list.filter(s => s.status === filterStatus)
    if (search.trim()) {
      const q = search.toLowerCase()
      list = list.filter(s =>
        s.name.toLowerCase().includes(q) ||
        s.studentId.toLowerCase().includes(q) ||
        s.course.toLowerCase().includes(q) ||
        s.instructor.toLowerCase().includes(q) ||
        (s.company ?? '').toLowerCase().includes(q)
      )
    }
    return list
  }, [students, search, filterStatus])

  const visiblePage = Math.min(page, Math.max(1, Math.ceil(filtered.length / PAGE_SIZE)))
  const paginated = filtered.slice((visiblePage - 1) * PAGE_SIZE, visiblePage * PAGE_SIZE)


  return {
    students,
    loading: !studentsData,
    search, setSearch: (v) => { setSearch(v); setPage(1) },
    filterStatus, setFilter: (v) => { setFilter(v); setPage(1) },
    view, setView,
    page: visiblePage, setPage,
    filtered,
    paginated,
    PAGE_SIZE,
  }
}
