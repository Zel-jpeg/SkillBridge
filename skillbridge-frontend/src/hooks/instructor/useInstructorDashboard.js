// src/hooks/instructor/useInstructorDashboard.js
//
// Data hook for InstructorDashboard.
// Fetches student recommendations and derives all display state.
//
// Real-time updates via SSE:
//   useSSE() keeps a singleton EventSource connection open.
//   When a student submits an assessment, the server detects the change
//   and sends invalidate URLs → useApi re-fetches silently →
//   components re-render automatically with updated statuses.
//
// API: GET /api/instructor/students/recommendations/

import { useState, useMemo, useEffect, useCallback } from 'react'
import { useApi } from '../useApi'
import { useSSE } from '../useSSE'

const PAGE_SIZE  = 6
const SSE_PATH   = '/api/instructor/events/'

// Dynamic color palette — cycles for any number of categories
const PALETTE = [
  { pill: 'bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300',       bar: 'bg-blue-500'   },
  { pill: 'bg-violet-100 dark:bg-violet-900 text-violet-700 dark:text-violet-300', bar: 'bg-violet-500' },
  { pill: 'bg-pink-100 dark:bg-pink-900 text-pink-700 dark:text-pink-300',        bar: 'bg-pink-500'   },
  { pill: 'bg-amber-100 dark:bg-amber-900 text-amber-700 dark:text-amber-300',    bar: 'bg-amber-500'  },
  { pill: 'bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300',    bar: 'bg-green-500'  },
  { pill: 'bg-cyan-100 dark:bg-cyan-900 text-cyan-700 dark:text-cyan-300',        bar: 'bg-cyan-500'   },
  { pill: 'bg-rose-100 dark:bg-rose-900 text-rose-700 dark:text-rose-300',        bar: 'bg-rose-500'   },
  { pill: 'bg-indigo-100 dark:bg-indigo-900 text-indigo-700 dark:text-indigo-300', bar: 'bg-indigo-500' },
  { pill: 'bg-teal-100 dark:bg-teal-900 text-teal-700 dark:text-teal-300',        bar: 'bg-teal-500'   },
  { pill: 'bg-orange-100 dark:bg-orange-900 text-orange-700 dark:text-orange-300', bar: 'bg-orange-500' },
]
export function getPalette(idx) { return PALETTE[idx % PALETTE.length] }

function average(scores) {
  const vals = Object.values(scores)
  if (!vals.length) return null
  return Math.round(vals.reduce((a, b) => a + b, 0) / vals.length)
}

export function useInstructorDashboard() {
  // ── Real-time SSE connection ──────────────────────────────────────
  // Singleton — shared with useEnrolledStudents if both are mounted.
  useSSE(SSE_PATH)

  const { data: apiData, loading: apiLoading } = useApi('/api/instructor/students/recommendations/')

  // ── Normalize API → student shape ─────────────────────────────────
  const studentsList = useMemo(() => {
    if (!apiData || !Array.isArray(apiData)) return []
    return apiData.map(s => ({
      id:                  s.id,
      name:                s.student_name || s.name,
      studentId:           s.school_id    || s.student_id || '',
      email:               s.email        || '',
      course:              s.course       || '',
      status:              s.has_submitted ? 'completed' : 'pending',
      scores:              s.skill_scores  || {},
      retakeAllowed:       s.retake_allowed ?? false,
      top_recommendations: s.top_recommendations ?? [],
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

  // Derive categories dynamically from actual score keys in completed students
  // This ensures we always show exactly the skill categories from the assessment.
  const categories = useMemo(() => {
    const seen = new Set()
    for (const s of completed) {
      Object.keys(s.scores).forEach(k => seen.add(k))
    }
    // Fallback: if no one has submitted yet, check pending too
    if (seen.size === 0) {
      for (const s of studentsList) {
        Object.keys(s.scores).forEach(k => seen.add(k))
      }
    }
    return Array.from(seen).sort()
  }, [completed, studentsList])

  // Top scorer per category
  const leaders = categories.map(cat => {
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
    PAGE_SIZE, categories,
    average,
  }
}