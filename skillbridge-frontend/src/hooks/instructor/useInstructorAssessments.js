import { useToast } from '../../context/ToastContext'
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
//   PATCH  /api/instructor/assessments/:id/                     → atomic metadata/question save
//   PATCH  /api/instructor/questions/:id/                       → update question
//   DELETE /api/instructor/questions/:id/                       → remove question
//   POST   /api/instructor/assessments/:id/questions/add/       → add new questions

import { useState, useMemo, useCallback, useRef } from 'react'
import api from '../../api/axios'
import { requestErrorMessage } from '../../api/requestErrors'
import { useApi, invalidateCache, fetchWithDedup } from '../useApi'
import { useSSE } from '../useSSE'
import { manilaApiDate, toManilaInput } from '../../utils/assessmentDates'
import { filterAssessments } from '../../utils/assessmentManagement'


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

export function useInstructorAssessments({ role = 'instructor' } = {}) {
  // ── SSE for real-time updates ─────────────────────────────────────────────
  useSSE(`/api/${role}/events/`)

  // ── Assessment + batch lists ──────────────────────────────────────────────
  const { data: assessmentsRaw, loading: loadingList } = useApi('/api/instructor/assessments/')
  const { data: batchesRaw }                           = useApi('/api/instructor/batches/')

  const assessments = useMemo(() => Array.isArray(assessmentsRaw) ? assessmentsRaw : [], [assessmentsRaw])
  const batchOptions = useMemo(() => Array.isArray(batchesRaw) ? batchesRaw : [], [batchesRaw])

  // ── Summary stats ─────────────────────────────────────────────────────────
  const stats = useMemo(() => ({
    total:       assessments.length,
    active:      assessments.filter(a => a.publication_status === 'published').length,
    draft:       assessments.filter(a => a.publication_status === 'draft').length,
    closed:      assessments.filter(a => a.publication_status === 'closed').length,
    questions:   assessments.reduce((s, a) => s + (a.question_count   || 0), 0),
    submissions: assessments.reduce((s, a) => s + (a.submission_count || 0), 0),
  }), [assessments])

  // ── Search / filter ───────────────────────────────────────────────────────
  const [search,       setSearch]       = useState('')
  const [filterBatch,  setFilterBatch]  = useState('all')
  const [filterStatus, setFilterStatus] = useState('all')
  const [filterRequired, setFilterRequired] = useState('all')
  const [filterIncluded, setFilterIncluded] = useState('all')
  const [filterCategory, setFilterCategory] = useState('all')
  const [filterAvailability, setFilterAvailability] = useState('all')

  const filtered = useMemo(() => {
    return filterAssessments(assessments, { search, batch: filterBatch, state: filterStatus,
      required: filterRequired, included: filterIncluded, category: filterCategory,
      availability: filterAvailability })
  }, [assessments, search, filterBatch, filterStatus, filterRequired, filterIncluded, filterCategory, filterAvailability])
  const categoryOptions = [...new Set(assessments.flatMap(a => a.categories || []))].sort()

  // ── Modal state ───────────────────────────────────────────────────────────
  const [selected,         setSelected]         = useState(null)  // selected assessment obj
  const [loadingQuestions, setLoadingQuestions] = useState(false)

  const [questionError, setQuestionError] = useState(null)
  const questionLoad = useRef(0)

  // ── Assessment metadata edit fields ──────────────────────────────────────
  const [editTitle,    setEditTitle]    = useState('')
  const [editDuration, setEditDuration] = useState('')
  const [editSettings, setEditSettings] = useState({ batch_id: '', publication_status: 'draft',
    is_required: true, include_in_competency: true, display_order: '0', available_at: '', due_at: '' })

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
  const [confirmRemoveQuestion, setConfirmRemoveQuestion] = useState(null)
  const [saving,          setSaving]          = useState(false)
  const [saveError, setSaveError] = useState('')
  const savePending = useRef(false)

  const { showToast } = useToast()

  const loadQuestions = useCallback(async (a) => {
    const load = ++questionLoad.current
    setLoadingQuestions(true)
    setQuestionError(null)
    try {
      const [qRes, catRes] = await Promise.all([
        fetchWithDedup(`/api/instructor/assessments/${a.id}/questions/`),
        fetchWithDedup('/api/categories/'),
      ])
      if (load !== questionLoad.current) return
      setEditedQuestions((qRes.data?.questions ?? qRes.data ?? []).map(q => normalizeQuestion(q, false)))
      setCategories(Array.isArray(catRes.data) ? catRes.data : [])
    } catch {
      if (load === questionLoad.current) setQuestionError('Could not load questions and categories. Please try again.')
    } finally {
      if (load === questionLoad.current) setLoadingQuestions(false)
    }
  }, [])

  // Only an explicit open/retry loads restricted questions. Refreshes do not
  // overwrite the metadata or question drafts already being edited.
  const openAssessment = useCallback(async (a) => {
    setSelected(a)
    setEditTitle(a.title || '')
    setEditDuration(String(a.duration_minutes ?? 60))
    setEditSettings({ batch_id: a.batch_id ?? '', publication_status: a.publication_status, is_required: a.is_required,
      include_in_competency: a.include_in_competency, display_order: String(a.display_order ?? 0),
      available_at: toManilaInput(a.available_at), due_at: toManilaInput(a.due_at) })
    setEditedQuestions([])
    setShowSaveConfirm(false)
    await loadQuestions(a)
  }, [loadQuestions])

  // ── Close modal ───────────────────────────────────────────────────────────
  const closeAssessment = useCallback(() => {
    if (savePending.current) return
    questionLoad.current += 1
    setSelected(null)
    setEditedQuestions([])
    setShowSaveConfirm(false)
    setConfirmRemoveQuestion(null)
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
    setConfirmRemoveQuestion(tempId)
  }, [])

  const confirmRemoveQuestionAction = useCallback(() => {
    if (!confirmRemoveQuestion) return
    setEditedQuestions(prev => prev.map(q =>
      q._tempId === confirmRemoveQuestion ? { ...q, _deleted: true } : q
    ))
    setConfirmRemoveQuestion(null)
  }, [confirmRemoveQuestion])

  // ── Save all changes ──────────────────────────────────────────────────────
  const saveAllChanges = useCallback(async () => {
    if (!selected || savePending.current) return
    if (!editTitle.trim() || !Number.isInteger(Number(editDuration)) || Number(editDuration) < 1 ||
        !/^\d+$/.test(String(editSettings.display_order)) ||
        (editSettings.available_at && editSettings.due_at && editSettings.due_at <= editSettings.available_at)) {
      setSaveError('Check title, duration, display order, and dates before saving.')
      return
    }
    savePending.current = true
    setSaveError('')
    setSaving(true)
    setShowSaveConfirm(false)

    try {
      // Question mutations finish before publication so the server validates the final key.
      const toDelete = editedQuestions.filter(q => q._deleted && !q._isNew)
      const toPatch  = editedQuestions.filter(q => !q._deleted && !q._isNew && q._dirty)
      const toAdd    = editedQuestions.filter(q => !q._deleted && q._isNew)

      const saved = await api.patch(`/api/instructor/assessments/${selected.id}/`, {
        title: editTitle.trim(), duration_minutes: Number(editDuration),
        ...(editSettings.batch_id !== '' ? { batch_id: Number(editSettings.batch_id) } : {}),
        question_changes: {
          delete_ids: toDelete.map(question => question.id),
          update: toPatch.map(question => ({ id: question.id, ...questionPayload(question) })),
          add: toAdd.map(questionPayload),
        },
        publication_status: editSettings.publication_status,
        is_required: editSettings.is_required,
        include_in_competency: editSettings.include_in_competency,
        display_order: Number(editSettings.display_order),
        available_at: manilaApiDate(editSettings.available_at),
        due_at: manilaApiDate(editSettings.due_at),
      })

      // 7 ── Invalidate list cache + re-fetch so question/submission counts refresh on next visit
      const changedUrls = ['/api/instructor/assessments/', '/api/instructor/dashboard/',
        '/api/admin/stats/', '/api/admin/users/']
      if (selected.batch_id) changedUrls.push(`/api/instructor/batches/${selected.batch_id}/students/`)
      changedUrls.forEach(invalidateCache)
      window.dispatchEvent(new CustomEvent('sse:data_changed', { detail: { urls: changedUrls } }))
      try {
        await fetchWithDedup('/api/instructor/assessments/')
      } catch { /* non-critical — next mount will fetch fresh */ }

      // The confirmed transaction supplies canonical IDs and choices. A failed
      // follow-up GET cannot make a completed save look unconfirmed or replay it.
      if (!Array.isArray(saved.data.questions)) throw new Error('Save response omitted questions')
      const freshQs = saved.data.questions.map(q => normalizeQuestion(q, false))
      setEditedQuestions(freshQs)

      // 9 ── Update the selected assessment preview
      setSelected(prev => ({
        ...prev,
        title:            editTitle.trim() || prev.title,
        duration_minutes: Number(editDuration) || prev.duration_minutes,
        ...saved.data,
        question_count:   freshQs.length,
      }))
      showToast('Assessment saved successfully.')
      return true
    } catch (err) {
      const message = requestErrorMessage(err, { mutation: true })
      setSaveError(message)
      showToast(message, 'error')
    } finally {
      savePending.current = false
      setSaving(false)
    }
  }, [selected, editTitle, editDuration, editSettings, editedQuestions, showToast])

  // ─────────────────────────────────────────────────────────────────────────
  const dirty = Boolean(selected && (editTitle !== selected.title || String(editDuration) !== String(selected.duration_minutes) ||
    editedQuestions.some(q => q._dirty || q._isNew || q._deleted) ||
    ['publication_status', 'is_required', 'include_in_competency'].some(key => editSettings[key] !== selected[key]) ||
    String(editSettings.batch_id || '') !== String(selected.batch_id || '') ||
    String(editSettings.display_order) !== String(selected.display_order ?? 0) ||
    editSettings.available_at !== toManilaInput(selected.available_at) || editSettings.due_at !== toManilaInput(selected.due_at)))
  return {
    dirty,
    importQuestions: rows => setEditedQuestions(previous => [...previous, ...rows.map(row => normalizeQuestion({
      ...row, category: categories.find(category => category.name.toLowerCase() === row.category.toLowerCase()) || { id: `import:${row.category}`, name: row.category },
      choices: row.question_type === 'identification' ? [{ text: row.correct_answer, is_correct: true }] : row.choices,
    }, true))]),
    // ── List ─────────────────────────────────────────────────────────────────
    assessments, loadingList, filtered, stats, batchOptions,
    // ── Filters ──────────────────────────────────────────────────────────────
    search, setSearch,
    filterBatch,  setFilterBatch,
    filterStatus, setFilterStatus,
    filterRequired, setFilterRequired, filterIncluded, setFilterIncluded,
    filterCategory, setFilterCategory, filterAvailability, setFilterAvailability, categoryOptions,
    // ── Modal open/close ──────────────────────────────────────────────────────
    selected, loadingQuestions, questionError, retryQuestions: () => selected && loadQuestions(selected),
    openAssessment, closeAssessment,
    // ── Assessment metadata edit ──────────────────────────────────────────────
    editTitle,    setEditTitle,
    editDuration, setEditDuration,
    editSettings, setEditSettings,
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
    // ── Save / Confirm ───────────────────────────────────────────────────────
    showSaveConfirm, setShowSaveConfirm,
    confirmRemoveQuestion, setConfirmRemoveQuestion,
    confirmRemoveQuestionAction,
    saving, saveAllChanges, saveError,
  }
}
