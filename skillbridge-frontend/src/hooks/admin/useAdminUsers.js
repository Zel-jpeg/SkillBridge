import { useToast } from '../../context/ToastContext'
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

import { useState, useMemo, useEffect, useRef } from 'react'
import { useApi, invalidateCache, fetchWithDedup, getCachedData, updateCachedData } from '../useApi'
import { reconcileAccountCollection } from '../../utils/accountCollection'
import { assessmentRetakeCandidate } from '../../utils/assessmentManagement'
import { useSSE } from '../useSSE'

const PAGE_SIZE = 10
const SSE_PATH  = '/api/admin/events/'

function normalizeUsers(usersData) {
    const students = [...(Array.isArray(usersData?.students) ? usersData.students : []), ...(usersData?.archived_students ?? [])]
    const approved = [...(Array.isArray(usersData?.instructors) ? usersData.instructors : []), ...(usersData?.archived_instructors ?? [])]
    const pending  = Array.isArray(usersData?.pending_instructors) ? usersData.pending_instructors : []

  return {
    students: students.map(s => ({
      id:               s.id,
      name:             s.name,
      studentId:        s.student_id    || '',
      email:            s.email         || '',
      course:           s.course        || '',
      instructor:       s.instructor    || '',
      batch:            s.batch ?? null,
      placement:        s.placement ?? null,
      status:           s.status        || 'pending',
      retakeAllowed:    !!s.retake_allowed,
      assessmentId:     s.assessment_id ?? null,
      isFlagged:        !!s.is_flagged,
      stoppedReason:    s.stopped_reason_display || '',
      violationCount:   s.violation_count ?? 0,
      match:            s.top_match_score   ?? null,
      position:         s.top_position_name ?? null,
      company:          s.top_company_name  ?? null,
      archived:         s.is_active === false,
      role:             'student',
      address:          s.address           ?? {},
      photoUrl:         s.photo_url         || null,
      competencyProfile: s.competency_profile ?? null,
      assessmentResults: s.assessment_results ?? [],
      combinedCategoryScores: s.combined_category_scores ?? [],
      combinedCompetencyProfile: s.combined_competency_profile ?? null,
      recommendationsLocked: s.recommendations_locked ?? true,
      completedRequiredCount: s.completed_required_count ?? 0,
      totalRequiredCount: s.total_required_count ?? 0,
      remainingRequiredCount: s.remaining_required_count ?? 0,
      top_recommendations: s.recommendations_locked ? [] : (s.top_recommendations ?? []),
    })),
    instructors: approved.map(i => ({
      id:           i.id,
      name:         i.name,
      instructorId: i.instructor_id  || '',
      email:        i.email          || '',
      department:   i.department     || '',
      courses:      i.courses        || '',
      archived:     i.is_active === false,
      status:       'active',
      role:         'instructor',
      photoUrl:     i.photo_url      || null,
    })),
    pending: pending.map(i => ({
      id:           i.id,
      name:         i.name,
      instructorId: i.instructor_id  || '',
      email:        i.email          || '',
      department:   i.department     || 'Institute of Computing',
      courses:      i.courses        || 'BSIT / BSIS',
      photoUrl:     i.photo_url      || null,
    })),
  }
}

export function useAdminUsers() {
  // ── Real-time SSE connection ──────────────────────────────────────
  useSSE(SSE_PATH)

  const { data: usersData, request } = useApi('/api/admin/users/')
  const accountPending = useRef(new Set())
  async function accountRequest(method, endpoint, payload) {
    const key = method + endpoint
    if (accountPending.current.has(key)) return { ok: false, message: 'This action is already in progress.' }
    accountPending.current.add(key)
    try { return await request(method, endpoint, payload) }
    finally { accountPending.current.delete(key) }
  }
  function publishAccount(account, role) {
    const next = reconcileAccountCollection(getCachedData('/api/admin/users/'), account, role)
    if (next) updateCachedData('/api/admin/users/', next)
    invalidateCache('/api/admin/users/')
  }
  const normalized = useMemo(() => normalizeUsers(usersData), [usersData])
  const [usersReady, setUsersReady] = useState(usersData != null)

  async function handleEnrollmentComplete() {
    invalidateCache('/api/admin/users/')
    try { await fetchWithDedup('/api/admin/users/') } catch { /* Keep the last user list. */ }
  }

  // ── Raw data state ────────────────────────────────────────────────
  const [studentsList,       setStudentsList]       = useState(normalized.students)
  const [instructors,        setInstructors]        = useState(normalized.instructors)
  const [pendingInstructors, setPendingInstructors] = useState(normalized.pending)

  // ── Modal open state ──────────────────────────────────────────────
  const [showAddInstr,       setShowAddInstr]       = useState(false)
  const [selectedUser,       setSelectedUser]       = useState(null)
  const [selectedUserType,   setSelectedUserType]   = useState('student')
  const [selectedPending,    setSelectedPending]    = useState(null)
  const [confirmRemoveInstr, setConfirmRemoveInstr] = useState(null)
  const [confirmRemoveStudent, setConfirmRemoveStudent] = useState(null)
  const [confirmRejectPending, setConfirmRejectPending] = useState(null)

  // ── Table state ───────────────────────────────────────────────────
  const [activeTab,        setActiveTab]     = useState(() => new URLSearchParams(window.location.search).get('tab') === 'pending' ? 'pending' : 'students')
  const [search,           setSearch]        = useState('')
  const [filterStatus,     setFilterStatus]  = useState('all')
  const [filterCourse,     setFilterCourse]  = useState('all')
  const [filterInstructor, setFilterInstr]   = useState('all')
  const [sortCol,          setSortCol]       = useState('name')
  const [sortDir,          setSortDir]       = useState('asc')
  const [page,             setPage]          = useState(1)
  const [view,             setView]          = useState('grid')

  // ── Toast ─────────────────────────────────────────────────────────
  const { showToast } = useToast()

  // ── Normalize API response ────────────────────────────────────────
  // Runs whenever usersData changes — including SSE-triggered re-fetches.
  useEffect(() => {
    if (!usersData) return
    // Initial sections remain placeholders until optimistic state is seeded.
    setStudentsList(normalized.students)
    setInstructors(normalized.instructors)
    setPendingInstructors(normalized.pending)
    setUsersReady(true)
  }, [usersData, normalized])

  // ── Sync selectedUser with fresh data ─────────────────────────────
  // If a background fetch brings in new data (e.g. adding the address field),
  // we must update the currently open modal's user object so it re-renders.
  useEffect(() => {
    if (!selectedUser) return
    if (selectedUserType === 'instructor') {
      const fresh = instructors.find(i => i.id === selectedUser.id)
        setSelectedUser(fresh ?? null)
    } else {
      const fresh = studentsList.find(s => s.id === selectedUser.id)
      setSelectedUser(fresh ?? null)
    }
  }, [studentsList, instructors]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!selectedPending) return
    // Pending detail is read-only; another admin may have approved the account.
    setSelectedPending(pendingInstructors.find(item => item.id === selectedPending.id) ?? null)
  }, [pendingInstructors]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Actions ───────────────────────────────────────────────────────

  async function handleAddInstructor(instr) {
    const res = await accountRequest('post', '/api/admin/instructors/', {
      name:          instr.name,
      email:         instr.email,
      instructor_id: instr.instructorId,
      department:    instr.department,
      courses:       instr.courses,
    })
    if (!res.ok) return res
    const newInstructor = { ...instr, id: res.data.id, archived: false, status: 'active', role: 'instructor' }
    if (res.data?.is_approved) {
      setInstructors(prev => [...prev, newInstructor])
      showToast(res.data?.email_queued
        ? `"${instr.name}" added. Welcome email queued; delivery is not confirmed.`
        : `"${instr.name}" added. Email could not be queued; the instructor can use DNSC Google sign-in.`)
    } else {
      setPendingInstructors(prev => [...prev, newInstructor])
      showToast(res.data?.email_queued
        ? `"${instr.name}" added as pending. Notification email queued; delivery is not confirmed.`
        : `"${instr.name}" added as pending. Email could not be queued.`)
    }
    invalidateCache('/api/admin/users/')   // force fresh fetch on next navigation
    setShowAddInstr(false)
    return res
  }

  function handleDeleteInstructor(instr) {
    setConfirmRemoveInstr(instr)
    setSelectedUser(null)
  }

  async function confirmDeleteInstructor() {
    if (!confirmRemoveInstr) return { ok: false, message: 'Select an instructor first.' }
    const res = await accountRequest('delete', `/api/admin/users/${confirmRemoveInstr.id}/`)
    if (!res.ok) return res
    publishAccount(res.data, 'instructor')
    showToast('Instructor archived.')
    setConfirmRemoveInstr(null)
    return res
  }

  async function approvePendingInstructor(instr) {
    const res = await accountRequest('post', `/api/admin/instructors/${instr.id}/approve/`)
    if (!res.ok) return
    setPendingInstructors(p => p.filter(x => x.id !== instr.id))
    setInstructors(p => [...p, { ...instr, archived: false, status: 'active', role: 'instructor' }])
    showToast(res.data?.already_approved ? 'Instructor is already approved. No additional email was queued.' : res.data?.email_queued
      ? `${instr.name} approved. Notification email queued; delivery is not confirmed.`
      : `${instr.name} approved. Email could not be queued; DNSC Google sign-in is available.`)
    invalidateCache('/api/admin/users/')   // force fresh fetch on next navigation
    setSelectedPending(null)
  }

  function rejectPendingInstructor(instr) {
    setConfirmRejectPending(instr)
    setSelectedPending(null)
  }

  async function confirmRejectInstructor() {
    if (!confirmRejectPending) return { ok: false, message: 'Select an instructor first.' }
    const res = await accountRequest('delete', `/api/admin/users/${confirmRejectPending.id}/`)
    if (!res.ok) return res
    publishAccount(res.data, 'instructor')
    showToast(`${confirmRejectPending.name} rejected.`)
    invalidateCache('/api/admin/users/')   // force fresh fetch on next navigation
    setSelectedPending(null)
    setConfirmRejectPending(null)
    return res
  }

  async function handleToggleRetake(studentId, assessmentId) {
    const st = studentsList.find(s => s.id === studentId)
    if (!st) return
    const attempt = assessmentRetakeCandidate(st, assessmentId)
    if (!attempt) return
    const next = !attempt.retake_allowed
    const res = await request('patch', `/api/instructor/students/${studentId}/retake/`, { retake_allowed: next, assessment_id: assessmentId })
    if (!res.ok) return
    const update = s => ({ ...s, assessmentResults: s.assessmentResults.map(a => a.id === assessmentId ? { ...a, retake_allowed: next } : a) })
    setStudentsList(prev => prev.map(s => s.id === studentId ? update(s) : s))
    setSelectedUser(prev => prev?.id === studentId ? update(prev) : prev)
    showToast(next ? `Retake approved for ${st.name}.` : `Retake revoked for ${st.name}.`)
    invalidateCache('/api/admin/users/')   // force fresh fetch on next navigation
  }

  async function handleUpdateUser(updatedUser, oldType, newType) {
    const res = await accountRequest('patch', `/api/admin/users/${updatedUser.id}/`, {
      name: updatedUser.name, email: updatedUser.email, instructor_id: updatedUser.instructorId,
      department: updatedUser.department, courses: updatedUser.courses,
    })
    if (!res.ok) return res
    publishAccount(res.data, oldType)
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
    return res
  }

  function handleRemoveUser(user) {
    if (selectedUserType === 'instructor') handleDeleteInstructor(user)
    else {
      setConfirmRemoveStudent(user)
      setSelectedUser(null)
    }
  }

  async function confirmDeleteStudent() {
    if (!confirmRemoveStudent) return { ok: false, message: 'Select a student first.' }
    const res = await accountRequest('delete', `/api/admin/users/${confirmRemoveStudent.id}/`)
    if (!res.ok) return res
    publishAccount(res.data, 'student')
    showToast(`Student ${confirmRemoveStudent.name} archived.`)
    setConfirmRemoveStudent(null)
    return res
  }

  async function handleRestoreUser(user) {
    const res = await accountRequest('patch', `/api/admin/users/${user.id}/`, { is_active: true })
    if (!res.ok) return res
    publishAccount(res.data, user.role)
    showToast('Account restored.')
    setSelectedUser(null)
    return res
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

  const visiblePage = Math.min(page, Math.max(1, Math.ceil(filtered.length / PAGE_SIZE)))
  const displayed = filtered.slice((visiblePage - 1) * PAGE_SIZE, visiblePage * PAGE_SIZE)

  const counts = {
    all:         [...studentsList, ...instructors].filter(u => !u.archived).length,
    students:    studentsList.filter(s => !s.archived).length,
    instructors: instructors.filter(i => !i.archived).length,
    pending:     pendingInstructors.length,
    archived:    [...studentsList, ...instructors].filter(u => u.archived).length,
  }

  const instructorsList = [...new Set(studentsList.map(s => s.instructor).filter(Boolean))]

  return {
    handleEnrollmentComplete,
    studentsList, instructors, pendingInstructors, initialUsersPending: !usersReady,
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
    page: visiblePage, setPage,
    view, setView,
    filtered, displayed, counts, instructorsList,
    PAGE_SIZE,
    handleAddInstructor,
    handleDeleteInstructor,
    confirmDeleteInstructor,
    approvePendingInstructor,
    rejectPendingInstructor,
    confirmRejectInstructor,
    handleToggleRetake,
    handleUpdateUser,
    handleRestoreUser,
    handleRemoveUser,
    confirmDeleteStudent,
    confirmRemoveStudent, setConfirmRemoveStudent,
    confirmRejectPending, setConfirmRejectPending,
  }
}
