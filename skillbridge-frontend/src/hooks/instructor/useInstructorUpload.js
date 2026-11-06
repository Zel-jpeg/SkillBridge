import { useToast } from '../../context/ToastContext'
// src/hooks/instructor/useInstructorUpload.js
//
// Data hook for InstructorUpload (Assessment Creator).
// Manages assessment metadata, skill categories, questions,
// staged imports, auto-save draft, and validation.
//
// WIRED (Week 6):
//   GET  /api/instructor/batches/          → batch selector
//   POST /api/instructor/assessments/      → publish assessment
//   POST /api/categories/suggest/          → TF-IDF category suggestion
//
// Question types supported: mcq | truefalse | identification

import { useState, useRef, useEffect } from 'react'
import api from '../../api/axios'
import { useApi, invalidateCache } from '../useApi'
import { authoringDraftKey, readAuthoringDraft, authoringDraftSignature, isRecoverableAuthoringDraft, writeAuthoringDraft } from '../../utils/authoringDraft'
import { requestErrorMessage } from '../../api/requestErrors'

const CHOICE_LABELS = ['A', 'B', 'C', 'D']
const EMPTY_CATEGORIES = []

// ── Question type definitions ─────────────────────────────────────
export const QUESTION_TYPES = [
  { value: 'mcq',            label: 'Multiple Choice', short: 'MCQ'  },
  { value: 'truefalse',      label: 'True / False',    short: 'T/F'  },
  { value: 'identification', label: 'Identification',  short: 'IDENT'},
]

// ── Draft persistence helpers ─────────────────────────────────────
function clearDraft(key) {
  if (!key) return
  try { localStorage.removeItem(key) } catch { /* Storage may be disabled. */ }
}
export function formatDraftAge(ts) {
  const mins = Math.floor((Date.now() - ts) / 60000)
  if (mins <  1)  return 'just now'
  if (mins < 60)  return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs  < 24)  return `${hrs}h ago`
  return `${Math.floor(hrs / 24)}d ago`
}

// ── ID counters ───────────────────────────────────────────────────
let _qid = 1
let _cid = 1
function nextQid() { return _qid++ }
function nextCid() { return _cid++ }

// ── Object factories ──────────────────────────────────────────────
export function makeQuestion(id, type = 'mcq') {
  return {
    id,
    text:        '',
    type,                                        // 'mcq' | 'truefalse' | 'identification'
    choices:     type === 'truefalse' ? ['True', 'False', '', ''] : ['', '', '', ''],
    correct:     null,                           // index for mcq/truefalse
    identAnswer: '',                             // text answer for identification
    categoryId:  null,
    expanded:    true,
    source:      'manual',
  }
}
export function makeCategory(id, name = '') {
  return { id, name: name.trim() }
}

// ── TF-IDF suggestion helper ──────────────────────────────────────
// Called via a per-question debounced timer (300ms).
// Returns the suggested category name or null.
async function fetchCategorySuggestion(questionText) {
  try {
    const res = await api.post('/api/categories/suggest/', { question_text: questionText })
    return res.data.suggested_category ?? null
  } catch {
    return null
  }
}

export function useInstructorUpload() {
  const { showToast } = useToast()
  const [draftKey] = useState(() => authoringDraftKey())
  const publishingRef = useRef(false)
  // ── Batches ───────────────────────────────────────────────────
  const { data: batchesData, loading: loadingBatches } = useApi('/api/instructor/batches/')
  const batches = Array.isArray(batchesData) ? batchesData : []

  // Assessment metadata
  const [title,           setTitle]           = useState('')
  const [duration,        setDuration]        = useState('')
  const [selectedBatchId, setSelectedBatchId] = useState(() => {
    const value = new URLSearchParams(window.location.search).get('batch_id')
    return value && /^\d+$/.test(value) ? Number(value) : null
  })
  const [draftProgramId, setDraftProgramId] = useState('')
  const [selectedFrameworkId, setSelectedFrameworkId] = useState(null)
  const selectedBatch = batches.find(batch => batch.id === selectedBatchId)
  const programId = selectedBatch?.program_id || (!selectedBatchId ? draftProgramId : null)
  const frameworkId = selectedBatch?.framework_id || (programId ? selectedFrameworkId : null)
  const scoped = Boolean(programId)
  const catalogUrl = frameworkId ? `/api/management/programs/${programId}/frameworks/${frameworkId}/authoring/` : null
  const { data: catalog, error: catalogError } = useApi(catalogUrl)
  const scopedFramework = catalog?.framework
  const [publicationStatus, setPublicationStatus] = useState('draft')
  const [isRequired, setIsRequired] = useState(true)
  const [includeInCompetency, setIncludeInCompetency] = useState(true)
  const [displayOrder, setDisplayOrder] = useState('0')
  const [availableAt, setAvailableAt] = useState('')
  const [dueAt, setDueAt] = useState('')
  const pristineDraft = useRef({ title: '', duration: '', selectedBatchId,
    publicationStatus: 'draft', isRequired: true, includeInCompetency: true,
    displayOrder: '0', availableAt: '', dueAt: '', categories: [], questions: [makeQuestion(0)] })
  const restoredOrder = useRef(null)
  const orderSeededForBatch = useRef(null)
  const { data: existingAssessments } = useApi('/api/instructor/assessments/')

  useEffect(() => {
    if (!selectedBatchId || !Array.isArray(existingAssessments)) return
    if (orderSeededForBatch.current === selectedBatchId) return
    if (restoredOrder.current?.batchId === selectedBatchId) {
      setDisplayOrder(restoredOrder.current.order)
      restoredOrder.current = null
      orderSeededForBatch.current = selectedBatchId
      return
    }
    const orders = existingAssessments.filter(a => a.batch_id === selectedBatchId).map(a => Number(a.display_order) || 0)
    const nextOrder = String(Math.max(0, ...orders) + 1)
    setDisplayOrder(nextOrder)
    pristineDraft.current.displayOrder = nextOrder
    orderSeededForBatch.current = selectedBatchId
  }, [selectedBatchId, existingAssessments])

  // Skill categories — pre-populated from the global admin-managed list
  const [manualCategories, setCategories] = useState([])
  const categories = scoped ? catalog?.categories || EMPTY_CATEGORIES : manualCategories
  const [catInput,   setCatInput]   = useState('')
  const catRef = useRef(null)
  const { data: sharedCategories } = useApi(scoped || selectedBatchId && !selectedBatch ? null : '/api/categories/')
  const categoriesSeeded = useRef(false)

  // Pre-load global skill categories so instructors see the shared list
  useEffect(() => {
    if (categoriesSeeded.current || categories.length || !Array.isArray(sharedCategories) || !sharedCategories.length) return
    categoriesSeeded.current = true
    const defaults = sharedCategories.map(c => makeCategory(c.id, c.name))
    pristineDraft.current.categories = defaults
    setCategories(defaults)
    const maxId = Math.max(...sharedCategories.map(c => c.id))
    _cid = Math.max(_cid, maxId + 1)
  }, [sharedCategories, categories.length])

  // Questions
  const [questions,    setQuestions]    = useState(() => [makeQuestion(nextQid(), 'mcq')])
  const [questionMode, setQuestionMode] = useState('manual')

  // TF-IDF suggestions: { [qid]: 'SuggestedCategoryName' }
  const [suggestions,      setSuggestions]      = useState({})
  const suggestionTimers   = useRef({})
  const suggestionRevisions = useRef({})
  useEffect(() => {
    const timers = suggestionTimers.current
    const revisions = suggestionRevisions.current
    return () => {
      Object.values(timers).forEach(clearTimeout)
      Object.keys(revisions).forEach(id => { revisions[id] += 1 })
    }
  }, [])

  // Validation errors
  const [errors, setErrors] = useState({})

  // Publish state
  const [published,    setPublished]    = useState(false)
  const [publishedId,  setPublishedId]  = useState(null)
  const [publishing,   setPublishing]   = useState(false)
  const [publishError, setPublishError] = useState('')

  // Draft
  const [pendingDraft, setDraftBanner] = useState(() => readAuthoringDraft(draftKey))
  const draftBanner = isRecoverableAuthoringDraft(pendingDraft, sharedCategories) ? pendingDraft : null
  const [lastSaved, setLastSaved] = useState(null)
  const saveTimer = useRef(null)
  const pendingSave = useRef(null)

  // Auto-save draft, debounced 1s
  useEffect(() => {
    clearTimeout(saveTimer.current)
    pendingSave.current = null
    if (published || draftBanner) return
    const data = { title, duration, categories, questions, selectedBatchId, draftProgramId, selectedFrameworkId: frameworkId,
      publicationStatus, isRequired, includeInCompetency, displayOrder, availableAt, dueAt }
    if (authoringDraftSignature(data) === authoringDraftSignature(pristineDraft.current)) {
      // Do not remove an unclassified legacy save until shared categories arrive.
      if (!pendingDraft || Array.isArray(sharedCategories)) clearDraft(draftKey)
      setLastSaved(null)
      return
    }
    const save = () => {
      const savedAt = writeAuthoringDraft(draftKey, data)
      setLastSaved(savedAt)
      if (savedAt) pendingSave.current = null
    }
    pendingSave.current = () => writeAuthoringDraft(draftKey, data)
    saveTimer.current = setTimeout(save, 1000)
    return () => clearTimeout(saveTimer.current)
  }, [title, duration, categories, questions, selectedBatchId, draftProgramId, frameworkId, publicationStatus,
    isRequired, includeInCompetency, displayOrder, availableAt, dueAt, published, draftKey,
    draftBanner, pendingDraft, sharedCategories])

  useEffect(() => {
    const flush = () => {
      clearTimeout(saveTimer.current)
      if (pendingSave.current?.()) pendingSave.current = null
    }
    const onVisibility = () => { if (document.visibilityState === 'hidden') flush() }
    window.addEventListener('pagehide', flush)
    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      window.removeEventListener('pagehide', flush)
      document.removeEventListener('visibilitychange', onVisibility)
      flush()
    }
  }, [])

  // ── Draft actions ─────────────────────────────────────────────
  function handleRestoreDraft() {
    if (!draftBanner) return
    setTitle(draftBanner.title || '')
    setDuration(String(draftBanner.duration || ''))
    setSelectedBatchId(draftBanner.selectedBatchId || null)
    setDraftProgramId(draftBanner.draftProgramId || '')
    setSelectedFrameworkId(draftBanner.selectedFrameworkId || null)
    if (draftBanner.selectedBatchId) {
      restoredOrder.current = { batchId: draftBanner.selectedBatchId, order: String(draftBanner.displayOrder ?? 0) }
      setSelectedBatchId(draftBanner.selectedBatchId)
    }
    setPublicationStatus(draftBanner.publicationStatus || 'draft')
    setIsRequired(draftBanner.isRequired ?? true)
    setIncludeInCompetency(draftBanner.includeInCompetency ?? true)
    setDisplayOrder(String(draftBanner.displayOrder ?? 0))
    setAvailableAt(draftBanner.availableAt || '')
    setDueAt(draftBanner.dueAt || '')
    if (draftBanner.categories) {
      categoriesSeeded.current = true
      setCategories(draftBanner.categories)
      _cid = Math.max(_cid, ...draftBanner.categories.map(c => c.id + 1))
    }
    if (draftBanner.questions) {
      setQuestions(draftBanner.questions)
      _qid = Math.max(_qid, ...draftBanner.questions.map(q => q.id + 1))
    }
    setDraftBanner(null)
  }

  function handleDiscardDraft() {
    clearTimeout(saveTimer.current)
    pendingSave.current = null
    clearDraft(draftKey)
    setLastSaved(null)
    setDraftBanner(null)
  }

  // ── Category actions ──────────────────────────────────────────
  function addCategory() {
    const name = catInput.trim()
    if (!name) return
    if (categories.some(c => c.name.toLowerCase() === name.toLowerCase())) {
      setErrors(e => ({ ...e, catDupe: `"${name}" already exists` }))
      return
    }
    setCategories(prev => [...prev, makeCategory(nextCid(), name)])
    setCatInput('')
    setErrors(e => ({ ...e, catDupe: '', categories: '' }))
    catRef.current?.focus()
  }

  function removeCategory(id) {
    setCategories(prev => prev.filter(c => c.id !== id))
    setQuestions(prev => prev.map(q => q.categoryId === id ? { ...q, categoryId: null } : q))
    setSuggestions(prev => {
      const next = { ...prev }
      Object.keys(next).forEach(k => { if (next[k] === categories.find(c => c.id === id)?.name) delete next[k] })
      return next
    })
  }

  // ── TF-IDF suggestion ─────────────────────────────────────────
  function requestCategorySuggestion(qid, text) {
    dismissSuggestion(qid)
    const revision = suggestionRevisions.current[qid]
    if (scoped || text.trim().length < 8) {
      setSuggestions(prev => { const n = { ...prev }; delete n[qid]; return n })
      return
    }
    suggestionTimers.current[qid] = setTimeout(async () => {
      const suggested = await fetchCategorySuggestion(text)
      if (suggestionRevisions.current[qid] !== revision) return
      if (suggested) {
        setSuggestions(prev => ({ ...prev, [qid]: suggested }))
      } else {
        setSuggestions(prev => { const n = { ...prev }; delete n[qid]; return n })
      }
    }, 300) // Reduced to 300ms for snappier feedback
  }

  function dismissSuggestion(qid) {
    clearTimeout(suggestionTimers.current[qid])
    suggestionRevisions.current[qid] = (suggestionRevisions.current[qid] ?? 0) + 1
    setSuggestions(prev => { const n = { ...prev }; delete n[qid]; return n })
  }

  function applySuggestion(qid, categoryName) {
    // Find existing category or create new one
    let cat = categories.find(c => c.name.toLowerCase() === categoryName.toLowerCase())
    if (!cat) {
      cat = makeCategory(nextCid(), categoryName)
      setCategories(prev => [...prev, cat])
    }
    setQuestions(prev => prev.map(q => q.id === qid ? { ...q, categoryId: cat.id } : q))
    setErrors(e => ({ ...e, [`q_${qid}_categoryId`]: '', categories: '' }))
    dismissSuggestion(qid)
  }

  // ── Question type change ──────────────────────────────────────
  function changeQuestionType(id, newType) {
    setQuestions(prev => prev.map(q => {
      if (q.id !== id) return q
      return {
        ...q,
        type:        newType,
        choices:     newType === 'truefalse' ? ['True', 'False', '', ''] : ['', '', '', ''],
        correct:     null,
        identAnswer: newType === 'identification' ? '' : q.identAnswer,
      }
    }))
    setErrors(e => {
      const next = { ...e }
      delete next[`q_${id}_choices`]
      delete next[`q_${id}_correct`]
      delete next[`q_${id}_identAnswer`]
      return next
    })
  }

  // ── Question actions ──────────────────────────────────────────
  function addQuestion(type = 'mcq') {
    setQuestions(prev => [
      ...prev.map(q => ({ ...q, expanded: false })),
      makeQuestion(nextQid(), type),
    ])
  }

  function removeQuestion(id) {
    setQuestions(prev => prev.filter(q => q.id !== id))
    dismissSuggestion(id)
  }

  function toggleExpand(id) {
    setQuestions(prev => prev.map(q => q.id === id ? { ...q, expanded: !q.expanded } : q))
  }

  function updateQuestion(id, field, value) {
    setQuestions(prev => prev.map(q => q.id === id ? { ...q, [field]: value } : q))
    setErrors(e => ({ ...e, [`q_${id}_${field}`]: '' }))
    // Trigger TF-IDF suggestion when question text changes
    if (field === 'text') {
      requestCategorySuggestion(id, value)
    }
    if (field === 'categoryId') dismissSuggestion(id)
  }

  function updateIdentAnswer(id, value) {
    setQuestions(prev => prev.map(q => q.id === id ? { ...q, identAnswer: value } : q))
    setErrors(e => ({ ...e, [`q_${id}_identAnswer`]: '' }))
  }

  function updateChoice(qid, idx, value) {
    setQuestions(prev => prev.map(q => {
      if (q.id !== qid) return q
      const choices = [...q.choices]; choices[idx] = value
      return { ...q, choices }
    }))
    setErrors(e => ({ ...e, [`q_${qid}_choices`]: '' }))
  }

  function setCorrect(qid, idx) {
    setQuestions(prev => prev.map(q => q.id === qid ? { ...q, correct: idx } : q))
    setErrors(e => ({ ...e, [`q_${qid}_correct`]: '' }))
  }

  // ── Shared import function (used by both Excel and text) ───────
  function importUploadedQuestions(sourceRows) {
    if (!sourceRows.length) return

    const uniqueCatNames = [...new Set(sourceRows.map(r => r.category).filter(Boolean))]
    const updatedCategories = [...categories]
    const catMap = new Map(updatedCategories.map(category => [category.name.toLowerCase(), category.id]))
    uniqueCatNames.forEach(name => {
      const key = name.toLowerCase()
      if (!catMap.has(key) && !scoped) {
        const newCat = makeCategory(nextCid(), name)
        updatedCategories.push(newCat)
        catMap.set(key, newCat.id)
      }
    })
    if (!scoped) setCategories(updatedCategories)

    const newQuestions = sourceRows.map(r => ({
      id:          nextQid(),
      text:        r.question,
      type:        r.type,
      choices:     CHOICE_LABELS.map((_, index) => r.choices[index] || ''),
      correct:     r.correctIdx,
      identAnswer: r.identAnswer || '',
      categoryId:  r.categoryId ?? catMap.get(r.category.toLowerCase()) ?? null,
      expanded:    false,
      source:      'upload',
    }))

    setQuestions(prev => {
      const isPlaceholder = prev.length === 1 && !prev[0].text && prev[0].source === 'manual'
      const base = isPlaceholder ? [] : prev.map(q => ({ ...q, expanded: false }))
      return [...base, ...newQuestions]
    })

    setQuestionMode('manual')
    setErrors(e => ({ ...e, questions: '' }))
  }

  // ── Validation ────────────────────────────────────────────────
  function validate() {
    const e = {}
    if (scoped && (!frameworkId || !catalog || catalogError)) e.categories = 'Choose an available program framework and load its categories first.'
    if (!title.trim()) e.title = 'Assessment title is required'
    if (publicationStatus === 'published' && !selectedBatchId) e.batch_id = 'Choose a batch before publishing'
    if (!/^\d+$/.test(String(displayOrder))) e.display_order = 'Enter a non-negative order'
    if (availableAt && dueAt && dueAt <= availableAt) e.due_at = 'Due time must be after availability time'
    if (!duration || isNaN(Number(duration)) || Number(duration) < 1) e.duration = 'Enter a valid duration in minutes'
    if (publicationStatus === 'published' && categories.length === 0) e.categories = 'Add at least one skill category'
    if (publicationStatus === 'published' && questions.length === 0) e.questions = 'Add at least one question'

    if (publicationStatus === 'published') questions.forEach(q => {
      if (!q.text.trim()) e[`q_${q.id}_text`] = 'Question text is required'
      if (q.categoryId === null) e[`q_${q.id}_categoryId`] = 'Tag a skill category'

      if (q.type === 'mcq') {
        if (q.choices.filter(c => c.trim()).length < 2) e[`q_${q.id}_choices`] = 'Enter at least 2 answer choices'
        if (q.correct === null || !q.choices[q.correct]?.trim()) e[`q_${q.id}_correct`] = 'Mark a non-empty correct answer'
      } else if (q.type === 'truefalse') {
        if (q.correct === null) e[`q_${q.id}_correct`] = 'Select the correct answer (True or False)'
      } else if (q.type === 'identification') {
        if (!q.identAnswer.trim()) e[`q_${q.id}_identAnswer`] = 'Enter the correct answer for this question'
      }
    })

    setErrors(e)
    const errorQids = new Set(
      Object.keys(e)
        .filter(k => k.startsWith('q_'))
        .map(k => Number(k.split('_')[1]))
    )
    if (errorQids.size > 0) {
      setQuestions(prev => prev.map(q => errorQids.has(q.id) ? { ...q, expanded: true } : q))
    }
    return Object.keys(e).length === 0
  }

  // ── Publish — wired to POST /api/instructor/assessments/ ────────
  async function handlePublish() {
    if (publishingRef.current) return
    if (!validate()) return
    publishingRef.current = true
    setPublishing(true)
    setPublishError('')

    const payload = {
      title:            title.trim(),
      batch_id:         selectedBatchId || undefined,
      ...(scoped ? { framework_id: frameworkId, framework_digest: scopedFramework?.digest } : {}),
      duration_minutes: Number(duration),
      publication_status: publicationStatus,
      is_required: isRequired,
      include_in_competency: includeInCompetency,
      display_order: Number(displayOrder),
      available_at: availableAt ? `${availableAt}:00+08:00` : null,
      due_at: dueAt ? `${dueAt}:00+08:00` : null,
      questions:        questions.map(q => {
        const categoryName = categories.find(c => c.id === q.categoryId)?.name || ''

        if (q.type === 'identification') {
          return {
            question_text:  q.text.trim(),
            question_type:  'identification',
            ...(scoped ? { category_id: q.categoryId } : { category: categoryName }),
            choices:        [],
            correct_answer: q.identAnswer.trim(),
          }
        }

        if (q.type === 'truefalse') {
          return {
            question_text: q.text.trim(),
            question_type: 'truefalse',
            ...(scoped ? { category_id: q.categoryId } : { category: categoryName }),
            choices: [
              { text: 'True',  is_correct: q.correct === 0 },
              { text: 'False', is_correct: q.correct === 1 },
            ],
          }
        }

        // MCQ
        return {
          question_text: q.text.trim(),
          question_type: 'mcq',
          ...(scoped ? { category_id: q.categoryId } : { category: categoryName }),
          choices:       q.choices
            .map((c, i) => ({ text: c.trim(), is_correct: q.correct === i }))
            .filter(c => c.text),
        }
      }),
    }

    try {
      const res = await api.post('/api/instructor/assessments/', payload)
      invalidateCache('/api/instructor/batches/')
      invalidateCache('/api/instructor/assessments/')
      if (catalogUrl) invalidateCache(catalogUrl)
      if (programId) invalidateCache(`/api/management/programs/${programId}/frameworks/`)
      clearTimeout(saveTimer.current)
      pendingSave.current = null
      clearDraft(draftKey)
      setDraftBanner(null)
      setLastSaved(null)
      setPublished(true)
      setPublishedId(res.data.id)
      showToast(publicationStatus === 'published' ? 'Assessment published successfully.' : 'Assessment draft saved successfully.')
    } catch (err) {
      const msg = requestErrorMessage(err, { mutation: true })
      setPublishError(msg)
      showToast(msg, 'error')
    } finally {
      publishingRef.current = false
      setPublishing(false)
    }
  }

  function resetForm() {
    clearTimeout(saveTimer.current)
    pendingSave.current = null
    clearDraft(draftKey)
    setDraftBanner(null); setLastSaved(null)
    orderSeededForBatch.current = null; restoredOrder.current = null
    pristineDraft.current = { ...pristineDraft.current, selectedBatchId: null, displayOrder: '0' }
    setTitle(''); setDuration(''); setSelectedBatchId(null)
    setDraftProgramId(''); setSelectedFrameworkId(null)
    setPublicationStatus('draft'); setIsRequired(true); setIncludeInCompetency(true)
    setDisplayOrder('0'); setAvailableAt(''); setDueAt('')
    setCategories(pristineDraft.current.categories); setCatInput('')
    setQuestions([makeQuestion(nextQid(), 'mcq')]); setQuestionMode('manual')
    setErrors({}); setPublished(false); setPublishedId(null); setPublishError('')
  }

  // ── Derived counts ────────────────────────────────────────────
  const countPerCat   = categories.map(cat => ({ ...cat, count: questions.filter(q => q.categoryId === cat.id).length }))
  const totalTagged   = questions.filter(q => q.categoryId !== null).length
  const totalAnswered = questions.filter(q => {
    if (q.type === 'mcq' || q.type === 'truefalse') return q.correct !== null
    return q.identAnswer.trim().length > 0
  }).length
  const countByType = {
    mcq:            questions.filter(q => q.type === 'mcq').length,
    truefalse:      questions.filter(q => q.type === 'truefalse').length,
    identification: questions.filter(q => q.type === 'identification').length,
  }

  return {
    // Batches
    batches, loadingBatches, selectedBatchId, setSelectedBatchId: value => {
      setSelectedBatchId(value); setSelectedFrameworkId(null)
      Object.keys(suggestionTimers.current).forEach(dismissSuggestion)
      setQuestions(previous => previous.map(question => ({ ...question, categoryId: null })))
    },
    draftProgramId, setDraftProgramId: value => {
      setDraftProgramId(value); setSelectedFrameworkId(null)
      Object.keys(suggestionTimers.current).forEach(dismissSuggestion)
      setQuestions(previous => previous.map(question => ({ ...question, categoryId: null })))
    },
    programId, frameworkId, scoped, scopedFramework, catalogUrl, catalogError,
    refreshCatalog: () => catalogUrl && invalidateCache(catalogUrl),
    chooseFramework: value => {
      if (value === frameworkId) return
      setSelectedFrameworkId(value)
      setQuestions(previous => previous.map(question => ({ ...question, categoryId: null })))
    },
    // Metadata
    title, setTitle, duration, setDuration,
    publicationStatus, setPublicationStatus, isRequired, setIsRequired,
    includeInCompetency, setIncludeInCompetency, displayOrder, setDisplayOrder,
    availableAt, setAvailableAt, dueAt, setDueAt,
    // Categories
    categories, catInput, setCatInput, catRef,
    addCategory, removeCategory,
    // TF-IDF suggestions
    suggestions, applySuggestion, dismissSuggestion,
    // Questions
    questions, questionMode, setQuestionMode,
    addQuestion, removeQuestion, toggleExpand,
    updateQuestion, updateIdentAnswer, updateChoice, setCorrect,
    changeQuestionType,
    importUploadedQuestions,
    // Draft
    draftBanner, lastSaved, handleRestoreDraft, handleDiscardDraft,
    formatDraftAge,
    // Validation / publish
    errors, setErrors,
    published, publishedId, publishing, publishError,
    handlePublish, resetForm, validate,
    // Derived counts
    countPerCat, totalTagged, totalAnswered, countByType,
    CHOICE_LABELS,
  }
}
