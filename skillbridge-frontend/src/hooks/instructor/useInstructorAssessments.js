// src/hooks/instructor/useInstructorAssessments.js
//
// Data hook for InstructorAssessments page.
// Fetches the assessment list, handles search/filter, drawer state,
// inline editing, and question loading.
//
// API:
//   GET  /api/instructor/assessments/          → list with stats
//   GET  /api/instructor/assessments/:id/questions/  → question detail
//   PATCH /api/instructor/assessments/:id/     → edit title/duration/active
//   GET  /api/instructor/batches/              → batch filter options

import { useState, useMemo, useCallback } from 'react'
import api from '../../api/axios'
import { useApi, invalidateCache } from '../useApi'
import { useSSE } from '../useSSE'

const SSE_PATH = '/api/instructor/events/'

export function useInstructorAssessments() {
  // ── Real-time SSE ─────────────────────────────────────────────────
  useSSE(SSE_PATH)

  // ── Data fetching ─────────────────────────────────────────────────
  const { data: assessmentsRaw, loading: loadingList } = useApi('/api/instructor/assessments/')
  const { data: batchesRaw }                           = useApi('/api/instructor/batches/')

  const assessments  = Array.isArray(assessmentsRaw) ? assessmentsRaw : []
  const batchOptions = Array.isArray(batchesRaw)     ? batchesRaw     : []

  // ── Computed stats ────────────────────────────────────────────────
  const stats = useMemo(() => ({
    total:       assessments.length,
    active:      assessments.filter(a => a.is_active).length,
    questions:   assessments.reduce((s, a) => s + (a.question_count   || 0), 0),
    submissions: assessments.reduce((s, a) => s + (a.submission_count || 0), 0),
  }), [assessments])

  // ── Search / filter state ─────────────────────────────────────────
  const [search,       setSearch]       = useState('')
  const [filterBatch,  setFilterBatch]  = useState('all')
  const [filterStatus, setFilterStatus] = useState('all')

  const filtered = useMemo(() => {
    let list = [...assessments]
    if (filterBatch !== 'all')  list = list.filter(a => String(a.batch_id) === String(filterBatch))
    if (filterStatus === 'active')   list = list.filter(a =>  a.is_active)
    if (filterStatus === 'inactive') list = list.filter(a => !a.is_active)
    if (search.trim()) {
      const q = search.toLowerCase()
      list = list.filter(a =>
        a.title?.toLowerCase().includes(q) ||
        a.batch_name?.toLowerCase().includes(q)
      )
    }
    return list
  }, [assessments, search, filterBatch, filterStatus])

  // ── Drawer state ──────────────────────────────────────────────────
  const [selected,          setSelected]          = useState(null)
  const [questions,         setQuestions]         = useState([])
  const [loadingQuestions,  setLoadingQuestions]  = useState(false)

  // ── Edit state ────────────────────────────────────────────────────
  const [editMode,     setEditMode]     = useState(false)
  const [editTitle,    setEditTitle]    = useState('')
  const [editDuration, setEditDuration] = useState('')
  const [editActive,   setEditActive]   = useState(true)
  const [saving,       setSaving]       = useState(false)
  const [toast,        setToast]        = useState(null)

  const showToast = useCallback((msg) => {
    setToast(msg)
    setTimeout(() => setToast(null), 3500)
  }, [])

  // ── Open assessment drawer ────────────────────────────────────────
  const openAssessment = useCallback(async (a) => {
    setSelected(a)
    setEditMode(false)
    setEditTitle(a.title)
    setEditDuration(String(a.duration_minutes ?? ''))
    setEditActive(a.is_active ?? true)
    setQuestions([])
    setLoadingQuestions(true)
    try {
      const res = await api.get(`/api/instructor/assessments/${a.id}/questions/`)
      setQuestions(res.data?.questions ?? res.data ?? [])
    } catch {
      setQuestions([])
    } finally {
      setLoadingQuestions(false)
    }
  }, [])

  const closeAssessment = useCallback(() => {
    setSelected(null)
    setEditMode(false)
    setQuestions([])
  }, [])

  // ── Question type breakdown ───────────────────────────────────────
  const questionStats = useMemo(() => ({
    mcq:            questions.filter(q => q.question_type === 'mcq').length,
    truefalse:      questions.filter(q => q.question_type === 'truefalse').length,
    identification: questions.filter(q => q.question_type === 'identification').length,
  }), [questions])

  // ── Save edits ────────────────────────────────────────────────────
  const handleSave = useCallback(async () => {
    if (!selected) return
    setSaving(true)
    try {
      const res = await api.patch(`/api/instructor/assessments/${selected.id}/`, {
        title:            editTitle.trim(),
        duration_minutes: Number(editDuration),
        is_active:        editActive,
      })
      const updated = res.data
      setSelected(prev => ({ ...prev, ...updated }))
      invalidateCache('/api/instructor/assessments/')
      setEditMode(false)
      showToast('Assessment updated.')
    } catch (err) {
      showToast(err.response?.data?.error || 'Save failed. Please try again.')
    } finally {
      setSaving(false)
    }
  }, [selected, editTitle, editDuration, editActive, showToast])

  return {
    // List
    loadingList, filtered, stats, batchOptions,
    // Search / filter
    search, setSearch,
    filterBatch,  setFilterBatch,
    filterStatus, setFilterStatus,
    // Drawer
    selected, questions, loadingQuestions, questionStats,
    openAssessment, closeAssessment,
    // Edit
    editMode, setEditMode,
    editTitle, setEditTitle,
    editDuration, setEditDuration,
    editActive, setEditActive,
    saving, handleSave,
    // Toast
    toast,
  }
}