// src/hooks/instructor/useEnrolledStudents.js
//
// Data hook for EnrolledStudents.
// Handles batch management, student enrollment, retake toggling,
// and student removal — all with optimistic local state.
//
// API:
//   GET  /api/instructor/batches/                       → list batches
//   GET  /api/instructor/batches/:id/students/          → batch students
//   POST /api/instructor/batches/                       → create batch
//   POST /api/instructor/batches/:id/enroll/            → enroll students
//   POST /api/instructor/batches/:id/archive/           → archive batch
//   PATCH /api/instructor/students/:id/retake/          → toggle retake
//   DELETE /api/instructor/students/:id/                → remove student

import { useState, useMemo, useEffect, useCallback } from 'react'
import api from '../../api/axios'
import { _setCache } from '../useApi'

const PAGE_SIZE  = 10
const CACHE_URL  = '/api/instructor/batches/'

function getApiCache(url) {
  const ss = sessionStorage.getItem('sb_apicache_' + url.replace(/\/+/g, '_'))
  if (ss) { try { return JSON.parse(ss) } catch {} }
  return null
}

function setApiCache(url, data) {
  _setCache(url, data)
  try { sessionStorage.setItem('sb_apicache_' + url.replace(/\/+/g, '_'), JSON.stringify(data)) } catch {}
}

export function useEnrolledStudents() {
  // ── Instructor info from localStorage ────────────────────────────
  const cachedUser = (() => { try { return JSON.parse(localStorage.getItem('sb-user')) } catch { return null } })()
  const instructor = {
    name:     cachedUser?.name    || 'Instructor',
    initials: (cachedUser?.name || 'IN').split(' ').map(n => n[0]).slice(0, 2).join(''),
    subject:  cachedUser?.course  || 'OJT Coordinator',
  }

  // ── Batch / student state ─────────────────────────────────────────
  const [batches,       setBatches]       = useState([])
  const [activeBatchId, setActiveBatchId] = useState(null)
  const [loadingBatches, setLoadingBatches] = useState(true)

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

  // ── Load batches on mount ─────────────────────────────────────────
  useEffect(() => {
    // Instant render from cache
    const cached = getApiCache(CACHE_URL)
    if (cached) {
      const normalized = cached.map(b => ({
        id: b.id, name: b.name, status: b.status,
        archivedAt: b.archived_at ?? null, students: b.students ?? [],
      }))
      setBatches(normalized)
      const active = normalized.find(b => b.status === 'active')
      setActiveBatchId(active?.id ?? normalized[normalized.length - 1]?.id ?? null)
      setLoadingBatches(false)
    }

    // Background API refresh
    api.get(CACHE_URL)
      .then(async res => {
        const apiData = res.data
        setApiCache(CACHE_URL, apiData)
        const normalized = apiData.map(b => ({
          id: b.id, name: b.name, status: b.status,
          archivedAt: b.archived_at ?? null, students: [],
        }))
        setBatches(normalized)
        setActiveBatchId(prev => {
          if (prev && normalized.some(b => b.id === prev)) return prev
          const active = normalized.find(b => b.status === 'active')
          return active?.id ?? normalized[normalized.length - 1]?.id ?? null
        })
        // Fetch students per batch in parallel
        await Promise.all(normalized.map(async b => {
          try {
            const r = await api.get(`/api/instructor/batches/${b.id}/students/`)
            const students = (r.data.students || []).map(s => ({
              id:            s.id,
              name:          s.name,
              studentId:     s.school_id || '',
              email:         s.email,
              course:        s.course,
              status:        s.has_submitted ? 'completed' : 'pending',
              retakeAllowed: s.retake_allowed ?? false,
              scores:        s.skill_scores   ?? {},
            }))
            setBatches(prev => prev.map(pb => pb.id === b.id ? { ...pb, students } : pb))
          } catch {}
        }))
      })
      .catch(() => {})
      .finally(() => setLoadingBatches(false))
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

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
    setSelectedStudent(prev => prev?.id === studentId ? { ...prev, retakeAllowed: !prev.retakeAllowed } : prev)
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
