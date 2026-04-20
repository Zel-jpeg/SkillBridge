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

const PAGE_SIZE = 10
const SSE_PATH  = '/api/admin/events/'

export function useAdminDashboard() {
  // ── Real-time SSE connection ──────────────────────────────────────
  useSSE(SSE_PATH)

  const { data: statsData }    = useApi('/api/admin/stats/')
  const { data: studentsData } = useApi('/api/admin/students/recommendations/')

  // ── Normalize API data ────────────────────────────────────────────
  const students = useMemo(() => {
    if (!studentsData || !Array.isArray(studentsData)) return []
    return studentsData.map(s => ({
      id:         s.id,
      name:       s.student_name || s.name,
      studentId:  s.school_id    || s.student_id || '',
      email:      s.email        || '',
      course:     s.course       || '',
      instructor: s.instructor_name || s.instructor || '',
      status:     s.has_submitted ? 'completed' : 'pending',
      match:      s.top_match_score   ?? null,
      position:   s.top_position_name ?? null,
      company:    s.top_company_name  ?? null,
    }))
  }, [studentsData])

  const topMatches = useMemo(() =>
    [...students]
      .filter(s => s.match !== null)
      .sort((a, b) => (b.match ?? 0) - (a.match ?? 0))
      .slice(0, 4)
      .map(s => ({
        student:   s.name,
        studentId: s.studentId,
        course:    s.course,
        company:   s.company,
        position:  s.position,
        match:     s.match,
      }))
  , [students])

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

  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  const stats = {
    total_students:       statsData?.total_students       ?? 0,
    total_companies:      statsData?.total_companies      ?? 0,
    open_positions:       statsData?.open_positions       ?? 0,
    recommendations_made: statsData?.recommendations_made ?? 0,
  }

  return {
    stats,
    students,
    topMatches,
    loading: !statsData && !studentsData,
    search, setSearch: (v) => { setSearch(v); setPage(1) },
    filterStatus, setFilter: (v) => { setFilter(v); setPage(1) },
    view, setView,
    page, setPage,
    filtered,
    paginated,
    PAGE_SIZE,
  }
}