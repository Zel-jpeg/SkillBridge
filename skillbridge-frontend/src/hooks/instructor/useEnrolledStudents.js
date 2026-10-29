import { normalizeStudent } from '../../utils/managementStudent'
import { filterRosterStudents } from '../../utils/studentRosterFilters'
import { useToast } from '../../context/ToastContext'
// src/hooks/instructor/useEnrolledStudents.js
//
// Data hook for EnrolledStudents.
// Handles batch management, student enrollment, retake toggling,
// and student removal — all with optimistic local state.
//
// ── Caching fix vs original ──────────────────────────────────────────────────
//   The original used a custom cache (sb_apicache_ prefix) that was inconsistent
//   with useApi's sessionStorage keys (sb_api_ prefix). This meant the cache was
//   written under one key and never read back — causing flicker on every refresh.
//   Fixed by switching the batch list to useApi, which handles sessionStorage
//   persistence, TTL, and SSE invalidation automatically.
//
// ── Real-time updates ────────────────────────────────────────────────────────
//   useSSE() opens a singleton EventSource to /api/instructor/events/.
//   Complete committed operations publish scoped invalidation topics.
//   The selected roster revalidates through useApi's shared dependency contract.
//
// API:
//   GET  /api/instructor/batches/                       → list batches
//   GET  /api/instructor/batches/:id/students/          → batch students
//   POST /api/instructor/batches/                       → create batch
//   POST /api/instructor/batches/:id/enroll/            → enroll students
//   POST /api/instructor/batches/:id/archive/           → archive batch
//   PATCH /api/instructor/students/:id/retake/          → toggle retake
//   DELETE /api/instructor/students/:id/                → remove student

import { useState, useMemo, useEffect, useCallback, useRef } from 'react'
import api from '../../api/axios'
import { requestErrorMessage } from '../../api/requestErrors'
import { assessmentRetakeCandidate } from '../../utils/assessmentManagement'
import { useApi, invalidateCache, fetchWithDedup, getCachedData, updateCachedData } from '../useApi'
import { useSSE } from '../useSSE'
import { getPalette } from './useInstructorDashboard'
export { getPalette }

const PAGE_SIZE = 10
const SSE_PATH  = '/api/instructor/events/'

// ── Normalize raw API student → local shape ───────────────────────────────────
export function useEnrolledStudents() {
  // ── Real-time SSE connection ──────────────────────────────────────
  // Singleton — shared with useInstructorDashboard if both are mounted.
  useSSE(SSE_PATH)

  // ── Instructor info from localStorage ────────────────────────────
  const cachedUser = (() => { try { return JSON.parse(localStorage.getItem('sb-user')) } catch { return null } })()
  const instructor = {
    name:     cachedUser?.name   || 'Instructor',
    initials: (cachedUser?.name  || 'IN').split(' ').map(n => n[0]).slice(0, 2).join(''),
    subject:  cachedUser?.course || 'OJT Coordinator',
  }

  // ── Batch list via useApi ─────────────────────────────────────────
  // useApi handles sessionStorage persistence (survives page refresh)
  // and SSE-triggered re-fetches automatically.
  const { data: batchesRaw, loading: loadingBatches } = useApi('/api/instructor/batches/')
  const [batchesReady, setBatchesReady] = useState(batchesRaw != null)

  // ── Local state ───────────────────────────────────────────────────
  // IMPORTANT: seed batches + activeBatchId directly from batchesRaw in the
  // useState initializer. useApi already returns cached data synchronously on
  // mount, so batchesRaw is available here. Without this, batches starts as []
  // for one render even when cache exists → the stats show 0 for one frame → flicker.
  const [batches, setBatches] = useState(() => {
    if (!batchesRaw || !Array.isArray(batchesRaw)) return []
    return batchesRaw.map(b => ({
      id: b.id, name: b.name, status: b.status,
      archivedAt: b.archived_at ?? null,
      students: (getCachedData(`/api/instructor/batches/${b.id}/students/`)?.students ?? []).map(normalizeStudent),
    }))
  })

  const [activeBatchId, setActiveBatchId] = useState(() => {
    const requested = Number(new URLSearchParams(window.location.search).get('batch_id'))
    if (batches.some(batch => batch.id === requested)) return requested
    if (batches.length > 0) {
      const active = batches.find(b => b.status === 'active')
      return active?.id ?? batches[batches.length - 1]?.id ?? null
    }
    if (!batchesRaw || !Array.isArray(batchesRaw)) return null
    const active = batchesRaw.find(b => b.status === 'active')
    return active?.id ?? batchesRaw[batchesRaw.length - 1]?.id ?? null
  })

  const [loadedRosters, setLoadedRosters] = useState(() => new Set(batches
    .filter(batch => getCachedData(`/api/instructor/batches/${batch.id}/students/`) != null)
    .map(batch => batch.id)))
  const rosterUrl = activeBatchId ? `/api/instructor/batches/${activeBatchId}/students/` : null
  const { data: rosterRaw, errorStatus: rosterErrorStatus } = useApi(rosterUrl)

  useEffect(() => {
    if (!activeBatchId || (!rosterRaw && ![403, 404].includes(rosterErrorStatus))) return
    const fresh = (rosterRaw?.students || []).map(s => ({
      ...normalizeStudent(s), batch: rosterRaw.batch ?? { id: activeBatchId },
    }))
    setLoadedRosters(previous => {
      if (previous.has(activeBatchId) === Boolean(rosterRaw)) return previous
      const next = new Set(previous)
      if (rosterRaw) next.add(activeBatchId)
      else next.delete(activeBatchId)
      return next
    })
    // Mirror the shared roster into this hook's existing optimistic batch state.
    setBatches(prev => prev.map(b => b.id === activeBatchId ? { ...b, students: fresh } : b))
  }, [rosterRaw, activeBatchId, rosterErrorStatus])

  // ── Modal / UI state ──────────────────────────────────────────────
  const [search,          setSearch]          = useState('')
  const [accountStatus, setAccountStatus] = useState('all')
  const [course,          setCourse]          = useState('all')
  const [assessmentStatus, setAssessmentStatus] = useState('all')
  const [recommendationStatus, setRecommendationStatus] = useState('all')
  const [view,            setView]            = useState('grid')
  const [page,            setPage]            = useState(1)
  const [showModal,       setShowModal]       = useState(false)
  const [selectedStudent, setSelectedStudent] = useState(null)
  const [confirmRemove,   setConfirmRemove]   = useState(null)
  const [showArchiveConf, setShowArchiveConf] = useState(false)
  const [showNewBatch,    setShowNewBatch]    = useState(false)
  const [newBatchName,    setNewBatchName]    = useState('')
  const [batchBusy, setBatchBusy] = useState(false)
  const [batchError, setBatchError] = useState('')
  const batchPending = useRef(false)

  const { showToast } = useToast()

  // Escape closes all modals
  useEffect(() => {
    const onKey = (e) => {
      // Native dialogs handle only the topmost modal, including retake confirmations.
      if (document.querySelector('dialog[open]')) return
      if (e.key === 'Escape' && !batchPending.current) {
        setShowNewBatch(false)
        setShowArchiveConf(false)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  // Refresh only the selected roster after an action or relevant SSE event.
  const refreshSelectedRoster = useCallback(async () => {
    if (!activeBatchId) return
    const url = `/api/instructor/batches/${activeBatchId}/students/`
    invalidateCache(url)
    try {
      await fetchWithDedup(url)
    } catch { /* Keep the last roster on a background failure. */ }
  }, [activeBatchId])

  // ── React to batch list changes (initial load + SSE re-fetches) ──────
  useEffect(() => {
    if (!batchesRaw || !Array.isArray(batchesRaw)) return

    const normalized = batchesRaw.map(b => ({
      id:         b.id,
      name:       b.name,
      status:     b.status,
      archivedAt: b.archived_at ?? null,
      students:   [],
    }))

    setBatchesReady(true)

    // Preserve existing student arrays during SSE background refreshes
    // so the UI doesn't flash empty while we re-fetch
    setBatches(prev => normalized.map(nb => {
      const existing = prev.find(pb => pb.id === nb.id)
      return existing ? { ...nb, students: existing.students } : nb
    }))

    // Preserve active batch selection across re-renders
    setActiveBatchId(prev => {
      if (prev && normalized.some(b => b.id === prev)) return prev
      const requested = Number(new URLSearchParams(window.location.search).get('batch_id'))
      if (normalized.some(batch => batch.id === requested)) return requested
      const active = normalized.find(b => b.status === 'active')
      return active?.id ?? normalized[normalized.length - 1]?.id ?? null
    })

  }, [batchesRaw])

  // ── Derived: active batch + students ─────────────────────────────
  const viewedBatch = batches.find(b => b.id === activeBatchId)
  const isArchived  = viewedBatch?.status === 'archived'
  const students = useMemo(() => viewedBatch?.students ?? [], [viewedBatch])
  const activeBatch = batches.find(b => b.status === 'active')

  // ── Sync selectedStudent with fresh data ────────────────────────────
  useEffect(() => {
    if (!selectedStudent) return
    const fresh = students.find(s => s.id === selectedStudent.id)
    setSelectedStudent(fresh ?? null)
  }, [students]) // eslint-disable-line react-hooks/exhaustive-deps

  function setStudents(updater) {
    setBatches(prev => prev.map(b =>
      b.id === activeBatchId
        ? { ...b, students: typeof updater === 'function' ? updater(b.students) : updater }
        : b
    ))
  }

  // ── Actions ───────────────────────────────────────────────────────

  async function writeBatch(endpoint, payload) {
    if (batchPending.current) return null
    batchPending.current = true; setBatchBusy(true); setBatchError('')
    try {
      const { data } = await api.post(endpoint, payload)
      const current = getCachedData('/api/instructor/batches/') ?? []
      const existing = current.find(row => row.id === data.id)
      updateCachedData('/api/instructor/batches/', existing
        ? current.map(row => row.id === data.id ? { ...row, ...data } : row)
        : [...current, { ...data, student_count: 0 }])
      invalidateCache('/api/instructor/batches/')
      invalidateCache('/api/instructor/assessments/')
      return data
    } catch (error) {
      const message = requestErrorMessage(error, { mutation: true })
      setBatchError(message)
      showToast(message, 'error')
      return null
    } finally { batchPending.current = false; setBatchBusy(false) }
  }

  async function handleArchiveBatch() {
    const data = await writeBatch(`/api/instructor/batches/${activeBatchId}/archive/`)
    if (!data) return
    setBatches(prev => prev.map(batch => batch.id === data.id
      ? { ...batch, status: data.status, archivedAt: data.archived_at } : batch))
    setShowArchiveConf(false)
    showToast('Batch archived successfully.')
    setShowNewBatch(true)
  }

  async function handleUnarchiveBatch() {
    const data = await writeBatch(`/api/instructor/batches/${activeBatchId}/unarchive/`)
    if (!data) return
    setBatches(prev => prev.map(batch => batch.id === data.id
      ? { ...batch, status: data.status, archivedAt: data.archived_at } : batch))
    showToast('Batch unarchived.')
  }

  async function handleCreateBatch() {
    const name = newBatchName.trim() || `AY ${new Date().getFullYear()}–${new Date().getFullYear() + 1}`
    const data = await writeBatch('/api/instructor/batches/', { name })
    if (!data) return
    const batch = { id: data.id, name: data.name, status: data.status, archivedAt: null, students: [] }
    setBatches(prev => [...prev.filter(row => row.id !== batch.id), batch])
    setActiveBatchId(batch.id)
    setShowNewBatch(false); setNewBatchName('')
    showToast(`New batch "${data.name}" created.`)
  }

  async function handleToggleRetake(studentId, assessmentId) {
    const st = students.find(s => s.id === studentId)
    const attempt = st && assessmentRetakeCandidate(st, assessmentId)
    if (!attempt) {
      showToast('Select a finalized assessment attempt for retake approval.', 'warning')
      return
    }
    try {
      const response = await api.patch(`/api/instructor/students/${studentId}/retake/`, { retake_allowed: !attempt.retake_allowed, assessment_id: assessmentId })
      if (rosterUrl && rosterRaw) {
        updateCachedData(rosterUrl, {
          ...rosterRaw,
          students: rosterRaw.students.map(student => student.id === studentId ? {
            ...student,
            assessment_results: student.assessment_results.map(result => result.id === assessmentId
              ? { ...result, retake_allowed: response.data.retake_allowed } : result),
          } : student),
        })
      }
      // Invalidate so the next page visit re-fetches the updated retake status
      invalidateCache('/api/instructor/batches/')
      invalidateCache('/api/instructor/students/recommendations/')
    } catch (err) { showToast(requestErrorMessage(err, { mutation: true }), 'error'); return }
    setBatches(prev => prev.map(b =>
      b.id === activeBatchId
        ? { ...b, students: b.students.map(s => s.id === studentId ? { ...s, assessmentResults: s.assessmentResults.map(a => a.id === assessmentId ? { ...a, retake_allowed: !a.retake_allowed } : a) } : s) }
        : b
    ))
    setSelectedStudent(prev =>
      prev?.id === studentId ? { ...prev, assessmentResults: prev.assessmentResults.map(a => a.id === assessmentId ? { ...a, retake_allowed: !a.retake_allowed } : a) } : prev
    )
    refreshSelectedRoster()
    if (st) showToast(attempt.retake_allowed ? `Retake revoked for ${st.name}.` : `Retake approved for ${st.name}.`)
  }

  function handleEnroll() {
    invalidateCache('/api/instructor/batches/')
    invalidateCache('/api/instructor/students/recommendations/')
    refreshSelectedRoster()
    setPage(1)
  }

  async function handleRemove(student) {
    try {
      await api.delete(`/api/instructor/students/${student.id}/`, { params: { batch_id: activeBatchId } })
      const current = rosterUrl && getCachedData(rosterUrl)
      if (current) updateCachedData(rosterUrl, { ...current, students: current.students.filter(row => row.id !== student.id) })
      setStudents(rows => rows.filter(row => row.id !== student.id))
      setConfirmRemove(null)
      invalidateCache('/api/instructor/batches/')
      invalidateCache(`/api/instructor/batches/${activeBatchId}/unenrolled/`)
      showToast(`${student.name} has been unenrolled from this batch. Assessment history is preserved.`)
      return { ok: true }
    } catch (error) {
      const message = requestErrorMessage(error, { mutation: true })
      showToast(message, 'error')
      return { ok: false, message }
    }
  }

  // ── Derived stats ─────────────────────────────────────────────────
  const completed = students.filter(s => s.allRequiredCompleted)

  // Derive categories dynamically from actual score keys
  const categories = useMemo(() => {
    const seen = new Set()
    for (const s of completed) Object.keys(s.scores).forEach(k => seen.add(k))
    if (seen.size === 0) for (const s of students) Object.keys(s.scores).forEach(k => seen.add(k))
    return Array.from(seen).sort()
  }, [completed, students])

  // ── Filters ───────────────────────────────────────────────────────
  const filtered = useMemo(() => filterRosterStudents(students, {
    search, course, accountStatus, assessmentStatus, recommendationStatus,
  }), [search, course, assessmentStatus, recommendationStatus, students, accountStatus])
  const hasActiveFilters = Boolean(search.trim() || course !== 'all' || accountStatus !== 'all' || assessmentStatus !== 'all' || recommendationStatus !== 'all')
  function clearFilters() {
    setSearch(''); setCourse('all'); setAccountStatus('all')
    setAssessmentStatus('all'); setRecommendationStatus('all'); setPage(1)
  }
  function applyFilters(values) {
    setSearch(values.search); setCourse(values.course); setAccountStatus(values.accountStatus)
    setAssessmentStatus(values.enrollment === 'enrolled' ? values.assessmentStatus : 'all')
    setRecommendationStatus(values.enrollment === 'enrolled' ? values.recommendationStatus : 'all')
    setPage(1)
  }

  const visiblePage = Math.min(page, Math.max(1, Math.ceil(filtered.length / PAGE_SIZE)))
  const paginated = filtered.slice((visiblePage - 1) * PAGE_SIZE, visiblePage * PAGE_SIZE)

  return {
    instructor,
    // Batch
    batches, activeBatchId, setActiveBatchId, loadingBatches,
    initialBatchPending: !batchesReady,
    initialRosterPending: !batchesReady || Boolean(activeBatchId && !loadedRosters.has(activeBatchId) && !rosterErrorStatus),
    viewedBatch, isArchived, students, activeBatch, completed,
    // Batch actions
    showArchiveConf, setShowArchiveConf, handleArchiveBatch, handleUnarchiveBatch,
    showNewBatch, setShowNewBatch,
    newBatchName, setNewBatchName, handleCreateBatch, batchBusy, batchError,
    // Student actions
    handleEnroll, handleRemove, handleToggleRetake,
    // Modal state
    showModal, setShowModal,
    selectedStudent, setSelectedStudent,
    confirmRemove, setConfirmRemove,
    // Search / filter
    accountStatus, setAccountStatus: value => { setAccountStatus(value); setPage(1) },
    search, setSearch: (v) => { setSearch(v); setPage(1) },
    course, setCourse: (v) => { setCourse(v); setPage(1) },
    assessmentStatus, setAssessmentStatus: value => { setAssessmentStatus(value); setPage(1) },
    recommendationStatus, setRecommendationStatus: value => { setRecommendationStatus(value); setPage(1) },
    hasActiveFilters, clearFilters, applyFilters,
    view, setView,
    page: visiblePage, setPage,
    // Derived
    filtered, paginated, categories,
    // Toast
    showToast,
    PAGE_SIZE,
  }
}
