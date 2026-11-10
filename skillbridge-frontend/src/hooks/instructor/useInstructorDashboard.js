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

import { useState, useMemo, useEffect } from 'react'
import { useApi } from '../useApi'
import { useSSE } from '../useSSE'
import { normalizeDashboardStudent } from '../../utils/dashboardStudents'

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

export function useInstructorDashboard() {
  // ── Real-time SSE connection ──────────────────────────────────────
  // Singleton — shared with useEnrolledStudents if both are mounted.
  useSSE(SSE_PATH)
  // Add a cache-buster so the browser doesn't intercept this and serve the old JSON from disk
  const { data: apiData, loading: apiLoading } = useApi('/api/instructor/students/recommendations/')

  // ── Normalize API → student shape ─────────────────────────────────
  const studentsList = useMemo(() => {
    if (!apiData || !Array.isArray(apiData)) return []
    return apiData.map(normalizeDashboardStudent)
  }, [apiData])

  const [selectedStudent, setSelectedStudent] = useState(null)

  // ── Sync selectedStudent with fresh data ────────────────────────────
  useEffect(() => {
    if (!selectedStudent) return
    const fresh = studentsList.find(s => s.id === selectedStudent.id)
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSelectedStudent(fresh ?? null)
  }, [studentsList]) // eslint-disable-line react-hooks/exhaustive-deps

  return { studentsList, loading: apiLoading, selectedStudent, setSelectedStudent }
}
