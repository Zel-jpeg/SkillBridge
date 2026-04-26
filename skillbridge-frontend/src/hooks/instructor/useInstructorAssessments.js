// src/hooks/instructor/useInstructorAssessments.js
//
// Data hook for InstructorAssessments page.
// Handles the assessment list, search/filter, and the full-edit modal state.
//
// Edit modal capabilities:
//   - Edit assessment title, duration, active status
//   - Edit existing question text, type, choices, correct answer, category
//   - Add new questions (MCQ / True-False / Identification)
//   - Remove questions (marked locally, deleted on save)
//   - Collapse / expand individual question cards
//   - Save all changes at once with a confirmation step
//
// APIs used:
//   GET    /api/instructor/assessments/                         → list
//   GET    /api/instructor/assessments/:id/questions/           → question detail
//   GET    /api/categories/                                     → skill categories
//   PATCH  /api/instructor/assessments/:id/                     → update metadata
//   PATCH  /api/instructor/questions/:id/                       → update question
//   DELETE /api/instructor/questions/:id/                       → remove question
//   POST   /api/instructor/assessments/:id/questions/add/       → add new questions

import { useState, useMemo, useCallback } from 'react'
import api from '../../api/axios'
import { useApi, invalidateCache, _setCache } from '../useApi'
import { useSSE } from '../useSSE'

const SSE_PATH = '/api/instructor/events/'

// ── Default choices for each question type ────────────────────────────────────
function defaultChoicesForType(type) {
  if (type === 'truefalse') return [
    { id: null, text: 'True',  is_correct: true  },
    { id: null, text: 'False', is_correct: false },
  ]
  if (type === 'identification') return []
  // MCQ — four blank slots
  return [
    { id: null, text: '', is_correct: false },
    { id: null, text: '', is_correct: false },
    { id: null, text: '', is_correct: false },
    { id: null, text: '', is_correct: false },
  ]
}

// ── Normalize one API question into local edit shape ──────────────────────────
function normalizeQuestion(q, expanded = false) {
  let identAnswer = ''
  let choices = []

  if (q.question_type === 'identification') {
    const correct = (q.choices || []).find(c => c.is_correct)
    identAnswer = correct?.text || ''
    choices = []
  } else if (q.question_type === 'truefalse') {
    const trueC  = (q.choices || []).find(c => c.text?.toLowerCase() === 'true')
    const falseC = (q.choices || []).find(c => c.text?.toLowerCase() === 'false')
    // Normalize True/False order; guarantee one is correct
    const trueCorrect  = trueC?.is_correct  ?? false
    const falseCorrect = falseC?.is_correct ?? false
    const neitherSet   = !trueCorrect && !falseCorrect
    choices = [
      { id: trueC?.id  || null, text: 'True',  is_correct: neitherSet ? true : trueCorrect  },
      { id: falseC?.id || null, text: 'False', is_correct: neitherSet ? false : falseCorrect },
    ]
  } else {
    // MCQ — preserve existing choices, pad to 4 slots
    const db = q.choices || []
    choices = [0, 1, 2, 3].map(i => ({
      id:         db[i]?.id         || null,
      text:       db[i]?.text       || '',
      is_correct: db[i]?.is_correct || false,
    }))
  }

  return {
    // Stable local key — existing questions use their real id as tempId
    _tempId:    q.id ? `e_${q.id}` : `n_${Date.now()}_${Math.random().toString(36).slice(2)}`,
    id:         q.id     || null,   // null for brand-new questions
    question_text: q.question_text  || '',
    question_type: q.question_type  || 'mcq',
    category:      q.category       || null,   // { id, name } or null
    choices,
    identAnswer,
    question_order: q.question_order || 0,
    _isNew:     !q.id,
    _deleted:   false,
    _dirty:     false,        // true once any field has been changed
    _expanded:  expanded,     // new questions start expanded; existing collapsed
  }
}

// ── Build the API payload for updating/adding a question ─────────────────────
function questionPayload(q) {
  const base = {
    question_text: (q.question_text || '').trim(),
    question_type: q.question_type,
    category:      q.category?.name || '',
  }

  if (q.question_type === 'identification') {
    return { ...base, choices: [], correct_answer: (q.identAnswer || '').trim() }
  }

  return {
    ...base,
    choices: q.choices
      .filter(c => (c.text || '').trim())
      .map(c => ({ text: c.text.trim(), is_correct: c.is_correct })),
  }
}

// ─────────────────────────────────────────────────────────────────────────────

export function useInstructorAssessments() {
  // ── SSE for real-time updates ─────────────────────────────────────────────
  useSSE(SSE_PATH)

  // ── Assessment + batch lists ──────────────────────────────────────────────
  const { data: assessmentsRaw, loading: loadingList } = useApi('/api/instructor/assessments/')
  const { data: batchesRaw }                           = useApi('/api/instructor/batches/')

  const assessments  = Array.isArray(assessmentsRaw) ? assessmentsRaw : []
  const batchOptions = Array.isArray(batchesRaw)     ? batchesRaw     : []

  // ── Summary stats ─────────────────────────────────────────────────────────
  const stats = useMemo(() => ({
    total:       assessments.length,
    active:      assessments.filter(a => a.is_active).length,
    questions:   assessments.reduce((s, a) => s + (a.question_count   || 0), 0),
    submissions: assessments.reduce((s, a) => s + (a.submission_count || 0), 0),
  }), [assessments])

  // ── Search / filter ───────────────────────────────────────────────────────
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

  // ── Modal state ───────────────────────────────────────────────────────────
  const [selected,         setSelected]         = useState(null)  // selected assessment obj
  const [loadingQuestions, setLoadingQuestions] = useState(false)

  // ── Assessment metadata edit fields ──────────────────────────────────────
  const [editTitle,    setEditTitle]    = useState('')
  const [editDuration, setEditDuration] = useState('')
  const [editActive,   setEditActive]   = useState(true)

  // ── Question edit state ───────────────────────────────────────────────────
  const [editedQuestions, setEditedQuestions] = useState([])
  const [categories,      setCategories]      = useState([])

  // Questions visible in the list (excludes deleted)
  const visibleQuestions = useMemo(
    () => editedQuestions.filter(q => !q._deleted),
    [editedQuestions]
  )

  // Per-type question counts for the stats bar
  const questionStats = useMemo(() => ({
    mcq:            visibleQuestions.filter(q => q.question_type === 'mcq').length,
    truefalse:      visibleQuestions.filter(q => q.question_type === 'truefalse').length,
    identification: visibleQuestions.filter(q => q.question_type === 'identification').length,
  }), [visibleQuestions])

  // ── Save / confirm state ──────────────────────────────────────────────────
  const [showSaveConfirm, setShowSaveConfirm] = useState(false)
  const [saving,          setSaving]          = useState(false)
  const [toast,           setToast]           = useState(null)

  const showToast = useCallback((msg) => {
    setToast(msg)
    setTimeout(() => setToast(null), 4000)
  }, [])

  // ── Open edit modal ───────────────────────────────────────────────────────
  const openAssessment = useCallback(async (a) => {
    setSelected(a)
    setEditTitle(a.title || '')
    setEditDuration(String(a.duration_minutes ?? 60))
    setEditActive(a.is_active ?? true)
    setEditedQuestions([])
    setShowSaveConfirm(false)
    setLoadingQuestions(true)

    try {
      const [qRes, catRes] = await Promise.all([
        api.get(`/api/instructor/assessments/${a.id}/questions/`),
        api.get('/api/categories/'),
      ])
      const qs = (qRes.data?.questions ?? qRes.data ?? []).map(q => normalizeQuestion(q, false))
      setEditedQuestions(qs)
      setCategories(Array.isArray(catRes.data) ? catRes.data : [])
    } catch {
      setEditedQuestions([])
      setCategories([])
    } finally {
      setLoadingQuestions(false)
    }
  }, [])

  // ── Close modal ───────────────────────────────────────────────────────────
  const closeAssessment = useCallback(() => {
    setSelected(null)
    setEditedQuestions([])
    setShowSaveConfirm(false)
  }, [])

  // ── Collapse / expand all ─────────────────────────────────────────────────
  const expandAll = useCallback(() => {
    setEditedQuestions(prev => prev.map(q => ({ ...q, _expanded: true })))
  }, [])

  const collapseAll = useCallback(() => {
    setEditedQuestions(prev => prev.map(q => ({ ...q, _expanded: false })))
  }, [])

  const allExpanded  = visibleQuestions.length > 0 && visibleQuestions.every(q => q._expanded)

  // ── Question field update ─────────────────────────────────────────────────
  // General-purpose: merges `updates` into the matching question
  const updateQuestion = useCallback((tempId, updates) => {
    setEditedQuestions(prev => prev.map(q =>
      q._tempId === tempId ? { ...q, ...updates, _dirty: true } : q
    ))
  }, [])

  // ── Change question type (resets choices) ─────────────────────────────────
  const changeQuestionType = useCallback((tempId, newType) => {
    setEditedQuestions(prev => prev.map(q =>
      q._tempId !== tempId ? q : {
        ...q,
        question_type: newType,
        choices:       defaultChoicesForType(newType),
        identAnswer:   '',
        _dirty:        true,
      }
    ))
  }, [])

  // ── Update one choice field ───────────────────────────────────────────────
  const updateChoice = useCallback((tempId, choiceIdx, field, value) => {
    setEditedQuestions(prev => prev.map(q => {
      if (q._tempId !== tempId) return q
      const newChoices     = [...q.choices]
      newChoices[choiceIdx] = { ...newChoices[choiceIdx], [field]: value }
      return { ...q, choices: newChoices, _dirty: true }
    }))
  }, [])

  // ── Set the correct choice (deselects all others) ─────────────────────────
  const setCorrectChoice = useCallback((tempId, choiceIdx) => {
    setEditedQuestions(prev => prev.map(q => {
      if (q._tempId !== tempId) return q
      const newChoices = q.choices.map((c, i) => ({ ...c, is_correct: i === choiceIdx }))
      return { ...q, choices: newChoices, _dirty: true }
    }))
  }, [])

  // ── Add a new blank question ──────────────────────────────────────────────
  const addQuestion = useCallback((type = 'mcq') => {
    const tempId = `n_${Date.now()}_${Math.random().toString(36).slice(2)}`
    const newQ = {
      _tempId:       tempId,
      id:            null,
      question_text: '',
      question_type: type,
      category:      null,
      choices:        defaultChoicesForType(type),
      identAnswer:   '',
      question_order: 0,
      _isNew:        true,
      _deleted:      false,
      _dirty:        true,
      _expanded:     true,   // new questions start open
    }
    setEditedQuestions(prev => [...prev, newQ])
    // Small delay, then scroll to the new card
    setTimeout(() => {
      document.getElementById(`q_${tempId}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }, 100)
  }, [])

  // ── Remove / restore a question ───────────────────────────────────────────
  const removeQuestion = useCallback((tempId) => {
    setEditedQuestions(prev => prev.map(q =>
      q._tempId === tempId ? { ...q, _deleted: true } : q
    ))
  }, [])

  // ── Save all changes ──────────────────────────────────────────────────────
  const saveAllChanges = useCallback(async () => {
    if (!selected) return
    setSaving(true)
    setShowSaveConfirm(false)

    try {
      // 1 ── Assessment metadata
      await api.patch(`/api/instructor/assessments/${selected.id}/`, {
        title:            editTitle.trim() || selected.title,
        duration_minutes: Number(editDuration) || selected.duration_minutes,
        is_active:        editActive,
      })

      // 2 ── Categorise changes
      const toDelete = editedQuestions.filter(q => q._deleted && !q._isNew)
      const toPatch  = editedQuestions.filter(q => !q._deleted && !q._isNew && q._dirty)
      const toAdd    = editedQuestions.filter(q => !q._deleted && q._isNew)

      // 3 ── Delete removed questions
      const deleteResults = await Promise.allSettled(
        toDelete.map(q => api.delete(`/api/instructor/questions/${q.id}/`))
      )

      // 4 ── Patch edited questions
      const patchResults = await Promise.allSettled(
        toPatch.map(q => api.patch(`/api/instructor/questions/${q.id}/`, questionPayload(q)))
      )

      // 5 ── Add new questions (clear_submissions: false — the instructor is just
      //      refining the assessment, not replacing it wholesale)
      if (toAdd.length > 0) {
        await api.post(
          `/api/instructor/assessments/${selected.id}/questions/add/`,
          { questions: toAdd.map(questionPayload), clear_submissions: false }
        )
      }

      // 6 ── Count errors
      const errorCount = [
        ...deleteResults.filter(r => r.status === 'rejected'),
        ...patchResults.filter(r => r.status === 'rejected'),
      ].length

      // 7 ── Invalidate list cache + re-fetch so question/submission counts refresh on next visit
      invalidateCache('/api/instructor/assessments/')
      try {
        const listRes = await api.get('/api/instructor/assessments/')
        if (listRes.data) _setCache('/api/instructor/assessments/', listRes.data)
      } catch { /* non-critical — next mount will fetch fresh */ }

      // 8 ── Reload questions into clean state
      const qRes = await api.get(`/api/instructor/assessments/${selected.id}/questions/`)
      const freshQs = (qRes.data?.questions ?? qRes.data ?? []).map(q => normalizeQuestion(q, false))
      setEditedQuestions(freshQs)

      // 9 ── Update the selected assessment preview
      setSelected(prev => ({
        ...prev,
        title:            editTitle.trim() || prev.title,
        duration_minutes: Number(editDuration) || prev.duration_minutes,
        is_active:        editActive,
        question_count:   freshQs.length,
      }))

      if (errorCount > 0) {
        showToast(`Saved with ${errorCount} error${errorCount > 1 ? 's' : ''}. Some questions may not have been updated.`)
      } else {
        showToast('Assessment saved successfully.')
      }
    } catch (err) {
      showToast(err.response?.data?.error || 'Save failed. Please try again.')
    } finally {
      setSaving(false)
    }
  }, [selected, editTitle, editDuration, editActive, editedQuestions, showToast])

  // ─────────────────────────────────────────────────────────────────────────
  return {
    // ── List ─────────────────────────────────────────────────────────────────
    loadingList, filtered, stats, batchOptions,
    // ── Filters ──────────────────────────────────────────────────────────────
    search, setSearch,
    filterBatch,  setFilterBatch,
    filterStatus, setFilterStatus,
    // ── Modal open/close ──────────────────────────────────────────────────────
    selected, loadingQuestions,
    openAssessment, closeAssessment,
    // ── Assessment metadata edit ──────────────────────────────────────────────
    editTitle,    setEditTitle,
    editDuration, setEditDuration,
    editActive,   setEditActive,
    // ── Question state ────────────────────────────────────────────────────────
    visibleQuestions, questionStats, categories,
    expandAll, collapseAll, allExpanded,
    // ── Question edit functions ───────────────────────────────────────────────
    updateQuestion,
    changeQuestionType,
    updateChoice,
    setCorrectChoice,
    addQuestion,
    removeQuestion,
    // ── Save ─────────────────────────────────────────────────────────────────
    showSaveConfirm, setShowSaveConfirm,
    saving, saveAllChanges,
    toast,
  }
}