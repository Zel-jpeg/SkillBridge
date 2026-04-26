// src/hooks/admin/useAdminUsers.js
//
// Data hook for AdminUsers page.
// Handles all user data fetching, normalization, filtering, sorting,
// and mutation actions (add/approve/reject/delete instructor, toggle retake, update user).
//
// Real-time updates via SSE:
//   useSSE() keeps a singleton EventSource connection open.
//   When the server detects DB changes it sends invalidate URLs →
//   useApi re-fetches /api/admin/users/ silently → useEffect re-normalizes.

import { useState, useMemo, useEffect, useCallback } from 'react'
import { useApi, invalidateCache } from '../useApi'
import { useSSE } from '../useSSE'

const PAGE_SIZE = 10
const SSE_PATH  = '/api/admin/events/'

export function useAdminUsers() {
  // ── Real-time SSE connection ──────────────────────────────────────
  useSSE(SSE_PATH)

  const { data: usersData, request } = useApi('/api/admin/users/')

  // ── Raw data state ────────────────────────────────────────────────
  const [studentsList,       setStudentsList]       = useState([])
  const [instructors,        setInstructors]        = useState([])
  const [pendingInstructors, setPendingInstructors] = useState([])

  // ── Modal open state ──────────────────────────────────────────────
  const [showAddInstr,       setShowAddInstr]       = useState(false)
  const [selectedUser,       setSelectedUser]       = useState(null)
  const [selectedUserType,   setSelectedUserType]   = useState('student')
  const [selectedPending,    setSelectedPending]    = useState(null)
  const [confirmRemoveInstr, setConfirmRemoveInstr] = useState(null)

  // ── Table state ───────────────────────────────────────────────────
  const [activeTab,        setActiveTab]     = useState('students')
  const [search,           setSearch]        = useState('')
  const [filterStatus,     setFilterStatus]  = useState('all')
  const [filterCourse,     setFilterCourse]  = useState('all')
  const [filterInstructor, setFilterInstr]   = useState('all')
  const [sortCol,          setSortCol]       = useState('name')
  const [sortDir,          setSortDir]       = useState('asc')
  const [page,             setPage]          = useState(1)
  const [view,             setView]          = useState('grid')

  // ── Toast ─────────────────────────────────────────────────────────
  const [toast, setToast] = useState(null)
  const showToast = useCallback((msg) => {
    setToast(msg)
    setTimeout(() => setToast(null), 3000)
  }, [])

  // ── Normalize API response ────────────────────────────────────────
  // Runs whenever usersData changes — including SSE-triggered re-fetches.
  useEffect(() => {
    if (!usersData) return
    const students = Array.isArray(usersData.students)            ? usersData.students            : []
    const approved = Array.isArray(usersData.instructors)         ? usersData.instructors         : []
    const pending  = Array.isArray(usersData.pending_instructors) ? usersData.pending_instructors : []

    setStudentsList(students.map(s => ({
      id:             s.id,
      name:           s.name,
      studentId:      s.student_id    || '',
      email:          s.email         || '',
      course:         s.course        || '',
      instructor:     s.instructor    || 'TBD',
      status:         s.status        || 'pending',
      retakeAllowed:  !!s.retake_allowed,
      match:          s.top_match_score   ?? null,
      position:       s.top_position_name ?? null,
      company:        s.top_company_name  ?? null,
      archived:       false,
      role:           'student',
    })))

    setInstructors(approved.map(i => ({
      id:           i.id,
      name:         i.name,
      instructorId: i.instructor_id  || '',
      email:        i.email          || '',
      department:   i.department     || 'Institute of Computing',
      courses:      i.courses        || 'BSIT / BSIS',
      archived:     false,
      status:       'active',
      role:         'instructor',
    })))

    setPendingInstructors(pending.map(i => ({
      id:           i.id,
      name:         i.name,
      instructorId: i.instructor_id  || '',
      email:        i.email          || '',
      department:   i.department     || 'Institute of Computing',
      courses:      i.courses        || 'BSIT / BSIS',
    })))
  }, [usersData])

  // ── Actions ───────────────────────────────────────────────────────

  async function handleAddInstructor(instr) {
    const res = await request('post', '/api/admin/instructors/', {
      name:          instr.name,
      email:         instr.email,
      instructor_id: instr.instructorId,
      department:    instr.department,
      courses:       instr.courses,
    })
    if (!res.ok) return
    const newInstructor = { ...instr, id: res.data?.id ?? Date.now(), archived: false, status: 'active', role: 'instructor' }
    if (res.data?.is_approved) {
      setInstructors(prev => [...prev, newInstructor])
      showToast(res.data?.email_sent
        ? `"${instr.name}" added. Welcome email sent to ${instr.email}.`
        : `"${instr.name}" added, but email was not sent — check SMTP settings.`)
    } else {
      setPendingInstructors(prev => [...prev, newInstructor])
      showToast(res.data?.email_sent
        ? `"${instr.name}" added as pending. Notification email sent.`
        : `"${instr.name}" added as pending. Email not sent (check SMTP settings).`)
    }
    invalidateCache('/api/admin/users/')   // force fresh fetch on next navigation
    setShowAddInstr(false)
  }

  function handleDeleteInstructor(instr) {
    setConfirmRemoveInstr(instr)
    setSelectedUser(null)
  }

  function confirmDeleteInstructor() {
    setInstructors(prev => prev.map(i => i.id === confirmRemoveInstr.id ? { ...i, archived: true } : i))
    showToast('Instructor archived.')
    setConfirmRemoveInstr(null)
  }

  async function approvePendingInstructor(instr) {
    const res = await request('post', `/api/admin/instructors/${instr.id}/approve/`)
    if (!res.ok) return
    setPendingInstructors(p => p.filter(x => x.id !== instr.id))
    setInstructors(p => [...p, { ...instr, archived: false, status: 'active', role: 'instructor' }])
    showToast(res.data?.email_sent
      ? `${instr.name} approved and notified.`
      : `${instr.name} approved, but email was not sent (check SMTP settings).`)
    invalidateCache('/api/admin/users/')   // force fresh fetch on next navigation
    setSelectedPending(null)
  }

  function rejectPendingInstructor(instr) {
    setPendingInstructors(p => p.filter(x => x.id !== instr.id))
    showToast(`${instr.name} rejected.`)
    invalidateCache('/api/admin/users/')   // force fresh fetch on next navigation
    setSelectedPending(null)
  }

  function handleToggleRetake(studentId) {
    setStudentsList(prev => prev.map(s => s.id === studentId ? { ...s, retakeAllowed: !s.retakeAllowed } : s))
    setSelectedUser(prev => prev?.id === studentId ? { ...prev, retakeAllowed: !prev.retakeAllowed } : prev)
    const st = studentsList.find(s => s.id === studentId)
    if (st) showToast(st.retakeAllowed ? `Retake revoked for ${st.name}.` : `Retake allowed for ${st.name}.`)
    invalidateCache('/api/admin/users/')   // force fresh fetch on next navigation
  }

  function handleUpdateUser(updatedUser, oldType, newType) {
    if (oldType === newType) {
      if (oldType === 'instructor') setInstructors(prev => prev.map(i => i.id === updatedUser.id ? updatedUser : i))
      else                          setStudentsList(prev => prev.map(s => s.id === updatedUser.id ? updatedUser : s))
    } else {
      if (oldType === 'student' && newType === 'instructor') {
        setStudentsList(p => p.filter(s => s.id !== updatedUser.id))
        setInstructors(p => [...p, updatedUser])
      } else {
        setInstructors(p => p.filter(i => i.id !== updatedUser.id))
        setStudentsList(p => [...p, updatedUser])
      }
    }
    showToast(`User ${updatedUser.name} updated.`)
    setSelectedUser(null)
  }

  function handleRemoveUser(user) {
    if (selectedUserType === 'instructor') handleDeleteInstructor(user)
    else {
      setStudentsList(prev => prev.map(s => s.id === user.id ? { ...s, archived: true } : s))
      setSelectedUser(null)
      invalidateCache('/api/admin/users/')   // force fresh fetch on next navigation
      showToast(`Student ${user.name} archived.`)
    }
  }

  // ── Sort toggle ───────────────────────────────────────────────────
  function toggleSort(col) {
    if (sortCol === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortCol(col); setSortDir('asc') }
  }

  // ── Derived / filtered lists ──────────────────────────────────────
  const filtered = useMemo(() => {
    let list

    if (activeTab === 'students') {
      list = studentsList.filter(s => !s.archived)
      if (filterStatus     !== 'all') list = list.filter(s => s.status     === filterStatus)
      if (filterCourse     !== 'all') list = list.filter(s => s.course     === filterCourse)
      if (filterInstructor !== 'all') list = list.filter(s => s.instructor === filterInstructor)
    } else if (activeTab === 'instructors') {
      list = instructors.filter(i => !i.archived)
    } else if (activeTab === 'pending') {
      return pendingInstructors
    } else {
      const combined = [
        ...studentsList.map(s => ({ ...s, role: 'student' })),
        ...instructors.map(i =>  ({ ...i, role: 'instructor' })),
      ]
      list = activeTab === 'archived'
        ? combined.filter(u => u.archived)
        : combined.filter(u => !u.archived)
    }

    if (search.trim()) {
      const q = search.toLowerCase()
      list = list.filter(u =>
        u.name.toLowerCase().includes(q) ||
        (u.email ?? '').toLowerCase().includes(q) ||
        (u.studentId ?? '').toLowerCase().includes(q) ||
        (u.instructorId ?? '').toLowerCase().includes(q)
      )
    }

    list = [...list].sort((a, b) => {
      let av, bv
      if      (sortCol === 'match')  { av = a.match ?? -1; bv = b.match ?? -1 }
      else if (sortCol === 'course') { av = a.course;       bv = b.course }
      else                           { av = a.name;         bv = b.name  }
      if (av < bv) return sortDir === 'asc' ? -1 : 1
      if (av > bv) return sortDir === 'asc' ?  1 : -1
      return 0
    })

    return list
  }, [
    search, filterStatus, filterCourse, filterInstructor,
    sortCol, sortDir, studentsList, instructors, pendingInstructors, activeTab,
  ])

  const displayed = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  const counts = {
    all:         [...studentsList, ...instructors].filter(u => !u.archived).length,
    students:    studentsList.filter(s => !s.archived).length,
    instructors: instructors.filter(i => !i.archived).length,
    pending:     pendingInstructors.length,
    archived:    [...studentsList, ...instructors].filter(u => u.archived).length,
  }

  const instructorsList = [...new Set(studentsList.map(s => s.instructor).filter(Boolean))]

  return {
    studentsList, instructors, pendingInstructors,
    showAddInstr, setShowAddInstr,
    selectedUser, setSelectedUser,
    selectedUserType, setSelectedUserType,
    selectedPending, setSelectedPending,
    confirmRemoveInstr, setConfirmRemoveInstr,
    activeTab, setActiveTab: (v) => { setActiveTab(v); setPage(1) },
    search, setSearch: (v) => { setSearch(v); setPage(1) },
    filterStatus, setFilterStatus: (v) => { setFilterStatus(v); setPage(1) },
    filterCourse, setFilterCourse: (v) => { setFilterCourse(v); setPage(1) },
    filterInstructor, setFilterInstructor: (v) => { setFilterInstr(v); setPage(1) },
    sortCol, sortDir, toggleSort,
    page, setPage,
    view, setView,
    filtered, displayed, counts, instructorsList,
    PAGE_SIZE,
    handleAddInstructor,
    handleDeleteInstructor,
    confirmDeleteInstructor,
    approvePendingInstructor,
    rejectPendingInstructor,
    handleToggleRetake,
    handleUpdateUser,
    handleRemoveUser,
    toast,
  }
}