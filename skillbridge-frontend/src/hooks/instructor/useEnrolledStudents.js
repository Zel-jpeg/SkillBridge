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
//   When a student submits an assessment the server detects the submission
//   count change and sends { invalidate: ['/api/instructor/batches/', ...] }.
//   useApi re-fetches the batch list silently, which triggers a useEffect
//   that re-fetches per-batch student data → statuses update automatically.
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
import { useApi, invalidateCache } from '../useApi'
import { useSSE } from '../useSSE'

const PAGE_SIZE = 10
const SSE_PATH  = '/api/instructor/events/'

// ── Normalize raw API student → local shape ───────────────────────────────────
function normalizeStudent(s) {
  return {
    id:            s.id,
    name:          s.name,
    studentId:     s.school_id || '',
    email:         s.email,
    course:        s.course,
    status:        s.has_submitted ? 'completed' : 'pending',
    retakeAllowed: s.retake_allowed ?? false,
    scores:        s.skill_scores   ?? {},
  }
}

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

  // ── Local state ───────────────────────────────────────────────────
  // IMPORTANT: seed batches + activeBatchId directly from batchesRaw in the
  // useState initializer. useApi already returns cached data synchronously on
  // mount, so batchesRaw is available here. Without this, batches starts as []
  // for one render even when cache exists → the stats show 0 for one frame → flicker.
  const [batches, setBatches] = useState(() => {
    if (!batchesRaw || !Array.isArray(batchesRaw)) return []
    return batchesRaw.map(b => ({
      id: b.id, name: b.name, status: b.status,
      archivedAt: b.archived_at ?? null, students: [],
    }))
  })

  const [activeBatchId, setActiveBatchId] = useState(() => {
    if (!batchesRaw || !Array.isArray(batchesRaw)) return null
    const active = batchesRaw.find(b => b.status === 'active')
    return active?.id ?? batchesRaw[batchesRaw.length - 1]?.id ?? null
  })

  // Track whether per-batch student fetches are running
  const fetchingRef = useRef(false)

  // ── Modal / UI state ──────────────────────────────────────────────
  const [search,          setSearch]          = useState('')
  const [course,          setCourse]          = useState('all')
  const [status,          setStatus]          = useState('all')
  const [view,            setView]            = useState('grid')
  const [page,            setPage]            = useState(1)
  const [showModal,       setShowModal]       = useState(false)
  const [selectedStudent, setSelectedStudent] = useState(null)
  const [confirmRemove,   setConfirmRemove]   = useState(null)
  const [showArchiveConf, setShowArchiveConf] = useState(false)
  const [showNewBatch,    setShowNewBatch]    = useState(false)
  const [newBatchName,    setNewBatchName]    = useState('')
  const [toast,           setToast]           = useState(null)

  const showToast = useCallback((msg) => {
    setToast(msg)
    setTimeout(() => setToast(null), 4000)
  }, [])

  // Escape closes all modals
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') {
        setSelectedStudent(null)
        setShowNewBatch(false)
        setShowArchiveConf(false)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  // ── Fetch per-batch students ──────────────────────────────────────
  // Called whenever the batch list changes (initial load OR SSE re-fetch).
  // Preserves existing optimistic student state where possible so actions
  // like retake-toggle don't flicker back on a background refresh.
  const fetchStudentsForBatches = useCallback(async (batchList) => {
    if (fetchingRef.current) return
    fetchingRef.current = true
    try {
      await Promise.all(batchList.map(async (b) => {
        try {
          const r = await api.get(`/api/instructor/batches/${b.id}/students/`)
          const fresh = (r.data.students || []).map(normalizeStudent)
          setBatches(prev => prev.map(pb =>
            pb.id === b.id ? { ...pb, students: fresh } : pb
          ))
        } catch {
          // Keep existing student data if a per-batch fetch fails
        }
      }))
    } finally {
      fetchingRef.current = false
    }
  }, [])

  // ── React to batch list changes (initial load + SSE re-fetches) ──────
  useEffect(() => {
    if (!batchesRaw || !Array.isArray(batchesRaw)) return

    const normalized = batchesRaw.map(b => ({
      id:         b.id,
      name:       b.name,
      status:     b.status,
      archivedAt: b.archived_at ?? null,
      students:   [],   // populated by fetchStudentsForBatches below
    }))

    // Preserve existing student arrays during SSE background refreshes
    // so the UI doesn't flash empty while we re-fetch
    setBatches(prev => normalized.map(nb => {
      const existing = prev.find(pb => pb.id === nb.id)
      return existing ? { ...nb, students: existing.students } : nb
    }))

    // Preserve active batch selection across re-renders
    setActiveBatchId(prev => {
      if (prev && normalized.some(b => b.id === prev)) return prev
      const active = normalized.find(b => b.status === 'active')
      return active?.id ?? normalized[normalized.length - 1]?.id ?? null
    })

    fetchStudentsForBatches(normalized)
  }, [batchesRaw, fetchStudentsForBatches])

  // ── SSE: re-fetch students when submissions change ────────────────
  // useApi already handles re-fetching /api/instructor/batches/ when SSE
  // fires (which triggers the useEffect above). This listener catches the
  // same event to also refresh per-batch student statuses (pending→completed)
  // independently in case the batch list hasn't changed but a student's
  // submission status has.
  useEffect(() => {
    const handler = (e) => {
      const urls = e.detail?.urls
      if (!Array.isArray(urls)) return
      const relevant = urls.some(u => u.includes('/api/instructor/'))
      if (!relevant || !batches.length) return
      fetchStudentsForBatches(batches)
    }
    window.addEventListener('sse:data_changed', handler)
    return () => window.removeEventListener('sse:data_changed', handler)
  }, [batches, fetchStudentsForBatches])

  // ── Derived: active batch + students ─────────────────────────────
  const viewedBatch = batches.find(b => b.id === activeBatchId)
  const isArchived  = viewedBatch?.status === 'archived'
  const students    = viewedBatch?.students ?? []
  const activeBatch = batches.find(b => b.status === 'active')

  function setStudents(updater) {
    setBatches(prev => prev.map(b =>
      b.id === activeBatchId
        ? { ...b, students: typeof updater === 'function' ? updater(b.students) : updater }
        : b
    ))
  }

  // ── Actions ───────────────────────────────────────────────────────

  async function handleArchiveBatch() {
    try { await api.post(`/api/instructor/batches/${activeBatchId}/archive/`) } catch {}
    setBatches(prev => prev.map(b =>
      b.id === activeBatchId
        ? { ...b, status: 'archived', archivedAt: new Date().toISOString().slice(0, 10) }
        : b
    ))
    // Invalidate cache so next navigation sees the updated status
    invalidateCache('/api/instructor/batches/')
    setShowArchiveConf(false)
    setShowNewBatch(true)
  }

  async function handleCreateBatch() {
    const name  = newBatchName.trim() || `AY ${new Date().getFullYear()}–${new Date().getFullYear() + 1}`
    let newId = Date.now()
    try { const res = await api.post('/api/instructor/batches/', { name }); newId = res.data.id } catch {}
    const nb = { id: newId, name, status: 'active', archivedAt: null, students: [] }
    setBatches(prev => [...prev, nb])
    setActiveBatchId(nb.id)
    // Invalidate so cache reflects the new batch on next visit
    invalidateCache('/api/instructor/batches/')
    setShowNewBatch(false)
    setNewBatchName('')
    showToast(`New batch "${name}" created.`)
  }

  async function handleToggleRetake(studentId) {
    const st = students.find(s => s.id === studentId)
    try {
      await api.patch(`/api/instructor/students/${studentId}/retake/`, { retake_allowed: !st?.retakeAllowed })
    } catch {}
    setBatches(prev => prev.map(b =>
      b.id === activeBatchId
        ? { ...b, students: b.students.map(s => s.id === studentId ? { ...s, retakeAllowed: !s.retakeAllowed } : s) }
        : b
    ))
    setSelectedStudent(prev =>
      prev?.id === studentId ? { ...prev, retakeAllowed: !prev.retakeAllowed } : prev
    )
    if (st) showToast(st.retakeAllowed ? `Retake revoked for ${st.name}.` : `Retake allowed for ${st.name}.`)
  }

  async function handleEnroll(newStudents) {
    if (!activeBatchId) { showToast('No active batch. Create one first.'); return }
    try {
      const res = await api.post(`/api/instructor/batches/${activeBatchId}/enroll/`, { students: newStudents })
      const added = (res.data.enrolled || newStudents).map(s => ({
        id:            s.id || Date.now() + Math.random(),
        name:          s.name,
        studentId:     s.school_id || s.student_id || newStudents.find(n => n.email === s.email)?.studentId || '',
        email:         s.email,
        course:        s.course,
        status:        'pending',
        retakeAllowed: false,
        scores:        {},
      }))
      setStudents(p => [...p, ...added])
      showToast(`${added.length} student${added.length > 1 ? 's' : ''} enrolled successfully`)
    } catch (err) {
      showToast(`❌ ${err.response?.data?.error || 'Enrollment failed. Please try again.'}`)
    }
    setShowModal(false)
    setPage(1)
  }

  function handleRemove(s) {
    setStudents(p => p.filter(x => x.id !== s.id))
    setConfirmRemove(null)
  }

  // ── Derived stats ─────────────────────────────────────────────────
  const completed = students.filter(s => s.status === 'completed')

  // ── Filters ───────────────────────────────────────────────────────
  const filtered = useMemo(() => {
    let list = [...students]
    if (course !== 'all') list = list.filter(s => s.course === course)
    if (status !== 'all') list = list.filter(s => s.status === status)
    if (search.trim()) {
      const q = search.toLowerCase()
      list = list.filter(s =>
        s.name.toLowerCase().includes(q) ||
        s.studentId.toLowerCase().includes(q) ||
        s.email.toLowerCase().includes(q)
      )
    }
    return list
  }, [search, course, status, students])

  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  return {
    instructor,
    // Batch
    batches, activeBatchId, setActiveBatchId, loadingBatches,
    viewedBatch, isArchived, students, activeBatch, completed,
    // Batch actions
    showArchiveConf, setShowArchiveConf, handleArchiveBatch,
    showNewBatch, setShowNewBatch,
    newBatchName, setNewBatchName, handleCreateBatch,
    // Student actions
    handleEnroll, handleRemove, handleToggleRetake,
    // Modal state
    showModal, setShowModal,
    selectedStudent, setSelectedStudent,
    confirmRemove, setConfirmRemove,
    // Search / filter
    search, setSearch: (v) => { setSearch(v); setPage(1) },
    course, setCourse: (v) => { setCourse(v); setPage(1) },
    status, setStatus: (v) => { setStatus(v); setPage(1) },
    view, setView,
    page, setPage,
    // Derived
    filtered, paginated,
    // Toast
    toast, showToast,
    PAGE_SIZE,
  }
}