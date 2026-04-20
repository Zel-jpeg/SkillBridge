// src/hooks/instructor/useInstructorDashboard.js
//
// Data hook for InstructorDashboard.
// Fetches student recommendations and derives all display state.
//
// API: GET /api/instructor/students/recommendations/

import { useState, useMemo, useEffect, useCallback } from 'react'
import { useApi } from '../useApi'

const PAGE_SIZE  = 6
const CATEGORIES = ['Web Development', 'Database', 'Design', 'Networking', 'Backend']

function average(scores) {
  const vals = Object.values(scores)
  if (!vals.length) return null
  return Math.round(vals.reduce((a, b) => a + b, 0) / vals.length)
}

export function useInstructorDashboard() {
  const { data: apiData, loading: apiLoading } = useApi('/api/instructor/students/recommendations/')

  // ── Normalize API → student shape ─────────────────────────────────
  const studentsList = useMemo(() => {
    if (!apiData || !Array.isArray(apiData)) return []
    return apiData.map(s => ({
      id:           s.id,
      name:         s.student_name || s.name,
      studentId:    s.school_id    || s.student_id || '',
      email:        s.email        || '',
      course:       s.course       || '',
      status:       s.has_submitted ? 'completed' : 'pending',
      scores:       s.skill_scores  || {},
      retakeAllowed: s.retake_allowed ?? false,
    }))
  }, [apiData])

  // ── UI state ──────────────────────────────────────────────────────
  const [search,          setSearch]          = useState('')
  const [filterStatus,    setFilter]          = useState('all')
  const [sortBy,          setSortBy]          = useState('name')
  const [sortDir,         setSortDir]         = useState('asc')
  const [view,            setView]            = useState('list')
  const [page,            setPage]            = useState(1)
  const [selectedStudent, setSelectedStudent] = useState(null)
  const [toast,           setToast]           = useState(null)

  const showToast = useCallback((msg) => {
    setToast(msg)
    setTimeout(() => setToast(null), 3000)
  }, [])

  // Escape closes modal
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') setSelectedStudent(null) }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  // ── Derived stats ─────────────────────────────────────────────────
  const completed = studentsList.filter(s => s.status === 'completed')
  const pending   = studentsList.filter(s => s.status === 'pending')

  const avgOverall = Math.round(
    completed.reduce((sum, s) => sum + (average(s.scores) ?? 0), 0) / (completed.length || 1)
  )

  // Top scorer per category
  const leaders = CATEGORIES.map(cat => {
    const top = completed.reduce((best, s) => {
      const score = s.scores[cat] ?? 0
      return score > (best?.scores[cat] ?? -1) ? s : best
    }, null)
    return { category: cat, student: top, score: top?.scores[cat] ?? 0 }
  })

  // ── Filtered + sorted ─────────────────────────────────────────────
  const displayed = useMemo(() => {
    let list = [...studentsList]
    if (filterStatus !== 'all') list = list.filter(s => s.status === filterStatus)
    if (search.trim()) {
      const q = search.toLowerCase()
      list = list.filter(s =>
        s.name.toLowerCase().includes(q) ||
        s.studentId.toLowerCase().includes(q) ||
        s.course.toLowerCase().includes(q)
      )
    }
    list.sort((a, b) => {
      if (sortBy === 'name') return sortDir === 'asc'
        ? a.name.localeCompare(b.name) : b.name.localeCompare(a.name)
      const av = sortBy === 'overall' ? (average(a.scores) ?? -1) : (a.scores[sortBy] ?? -1)
      const bv = sortBy === 'overall' ? (average(b.scores) ?? -1) : (b.scores[sortBy] ?? -1)
      return sortDir === 'asc' ? av - bv : bv - av
    })
    return list
  }, [studentsList, search, filterStatus, sortBy, sortDir])

  const paginated = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE
    return displayed.slice(start, start + PAGE_SIZE)
  }, [displayed, page])

  function toggleSort(col) {
    if (sortBy === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortBy(col); setSortDir('asc') }
  }

  return {
    studentsList, loading: apiLoading,
    // UI state
    search, setSearch: (v) => { setSearch(v); setPage(1) },
    filterStatus, setFilter: (v) => { setFilter(v); setPage(1) },
    sortBy, sortDir, toggleSort,
    view, setView,
    page, setPage,
    selectedStudent, setSelectedStudent,
    toast, showToast,
    // Derived
    completed, pending, avgOverall, leaders,
    displayed, paginated,
    PAGE_SIZE, CATEGORIES,
    average,
  }
}
