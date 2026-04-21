// src/hooks/instructor/useInstructorUpload.js
//
// Data hook for InstructorUpload (Assessment Creator).
// Manages assessment metadata, skill categories, questions,
// Excel/text upload/parsing, auto-save draft, and validation.
//
// WIRED (Week 6):
//   GET  /api/instructor/batches/          → batch selector
//   POST /api/instructor/assessments/      → publish assessment
//   POST /api/categories/suggest/          → TF-IDF category suggestion
//
// Question types supported: mcq | truefalse | identification

import { useState, useRef, useEffect, useCallback } from 'react'
import api from '../../api/axios'
import { useApi } from '../useApi'

const DRAFT_KEY     = 'sb_assessment_draft'
const CHOICE_LABELS = ['A', 'B', 'C', 'D']

// ── Question type definitions ─────────────────────────────────────
export const QUESTION_TYPES = [
  { value: 'mcq',            label: 'Multiple Choice', short: 'MCQ'  },
  { value: 'truefalse',      label: 'True / False',    short: 'T/F'  },
  { value: 'identification', label: 'Identification',  short: 'IDENT'},
]

// ── Draft persistence helpers ─────────────────────────────────────
function saveDraft(data) {
  try { localStorage.setItem(DRAFT_KEY, JSON.stringify({ ...data, savedAt: Date.now() })) } catch {}
}
function loadDraft() {
  try { const raw = localStorage.getItem(DRAFT_KEY); return raw ? JSON.parse(raw) : null } catch { return null }
}
function clearDraft() {
  try { localStorage.removeItem(DRAFT_KEY) } catch {}
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
// Called via a per-question debounced timer (600ms).
// Returns the suggested category name or null.
async function fetchCategorySuggestion(questionText) {
  try {
    const res = await api.post('/api/categories/suggest/', { question_text: questionText })
    return res.data.suggested_category ?? null
  } catch {
    return null
  }
}

// ── Text file parser (.txt) ───────────────────────────────────────
// Expected format (blocks separated by ---):
//
//   QUESTION: What is HTML?
//   TYPE: mcq
//   A: HyperText Markup Language
//   B: High Text Language
//   C: Hyper Transfer Markup Language
//   D: None of the above
//   CORRECT: A
//   CATEGORY: Web Development
//   ---
//   QUESTION: SQL stands for Structured Query Language.
//   TYPE: truefalse
//   CORRECT: True
//   CATEGORY: Database
//   ---
//   QUESTION: What does CPU stand for?
//   TYPE: identification
//   CORRECT: Central Processing Unit
//   CATEGORY: Hardware
//
export function parseTextFileContent(content) {
  const rows = []
  const errs = []

  const blocks = content
    .split(/\n\s*---+\s*\n/)
    .map(b => b.trim())
    .filter(b => b && !b.startsWith('#'))

  blocks.forEach((block, i) => {
    const rowNum = i + 1
    const rowErrors = []

    // Parse key: value pairs (case-insensitive keys)
    const map = {}
    block.split('\n').forEach(line => {
      const colonIdx = line.indexOf(':')
      if (colonIdx === -1) return
      const key = line.slice(0, colonIdx).trim().toUpperCase()
      const val = line.slice(colonIdx + 1).trim()
      if (key) map[key] = val
    })

    const question = map['QUESTION'] || ''
    const type     = (map['TYPE'] || 'mcq').toLowerCase()
    const correct  = (map['CORRECT'] || '').trim()
    const category = map['CATEGORY'] || ''

    if (!question)  rowErrors.push('QUESTION is required')
    if (!category)  rowErrors.push('CATEGORY is required')
    if (!correct)   rowErrors.push('CORRECT is required')
    if (!['mcq', 'truefalse', 'identification'].includes(type)) {
      rowErrors.push(`TYPE must be mcq, truefalse, or identification (got "${type}")`)
    }

    if (type === 'mcq') {
      const choiceA = map['A'] || ''
      const choiceB = map['B'] || ''
      if (!choiceA || !choiceB) rowErrors.push('At least choices A and B are required for MCQ')
      if (!['A', 'B', 'C', 'D'].includes(correct.toUpperCase())) {
        rowErrors.push(`CORRECT must be A, B, C, or D for MCQ (got "${correct}")`)
      }
    } else if (type === 'truefalse') {
      if (!['TRUE', 'FALSE'].includes(correct.toUpperCase())) {
        rowErrors.push(`CORRECT must be True or False (got "${correct}")`)
      }
    }

    if (rowErrors.length) { errs.push({ rowNum, errors: rowErrors }); return }

    if (type === 'identification') {
      rows.push({ question, type: 'identification', choices: ['', '', '', ''], correctIdx: null, identAnswer: correct, category })
    } else if (type === 'truefalse') {
      rows.push({ question, type: 'truefalse', choices: ['True', 'False', '', ''], correctIdx: correct.toUpperCase() === 'TRUE' ? 0 : 1, identAnswer: '', category })
    } else {
      const choiceA = map['A'] || ''; const choiceB = map['B'] || ''
      const choiceC = map['C'] || ''; const choiceD = map['D'] || ''
      const correctIdx = ['A', 'B', 'C', 'D'].indexOf(correct.toUpperCase())
      rows.push({ question, type: 'mcq', choices: [choiceA, choiceB, choiceC, choiceD], correctIdx, identAnswer: '', category })
    }
  })

  return { rows, errs }
}

// ── Text template content ─────────────────────────────────────────
export function getTextTemplate() {
  return `# SkillBridge Assessment Text File
# Lines starting with # are comments. Blocks are separated by ---
# Supported types: mcq | truefalse | identification

QUESTION: What does HTML stand for?
TYPE: mcq
A: HyperText Markup Language
B: High Text Machine Language
C: Hyper Transfer Markup Language
D: None of the above
CORRECT: A
CATEGORY: Web Development

---

QUESTION: SQL stands for Structured Query Language.
TYPE: truefalse
CORRECT: True
CATEGORY: Database

---

QUESTION: What does CPU stand for?
TYPE: identification
CORRECT: Central Processing Unit
CATEGORY: Computer Hardware
`
}

// ════════════════════════════════════════════════════════════════
// MAIN HOOK
// ════════════════════════════════════════════════════════════════
export function useInstructorUpload() {
  // ── Batches ───────────────────────────────────────────────────
  const { data: batchesData, loading: loadingBatches } = useApi('/api/instructor/batches/')
  const batches = Array.isArray(batchesData) ? batchesData : []

  // Assessment metadata
  const [title,           setTitle]           = useState('')
  const [duration,        setDuration]        = useState('')
  const [selectedBatchId, setSelectedBatchId] = useState(null)

  // Skill categories
  const [categories, setCategories] = useState([])
  const [catInput,   setCatInput]   = useState('')
  const catRef = useRef(null)

  // Questions
  const [questions,    setQuestions]    = useState(() => [makeQuestion(nextQid(), 'mcq')])
  const [questionMode, setQuestionMode] = useState('manual')

  // TF-IDF suggestions: { [qid]: 'SuggestedCategoryName' }
  const [suggestions,      setSuggestions]      = useState({})
  const suggestionTimers   = useRef({})

  // Excel upload
  const xlsxRef = useRef(null)
  const [xlsxRows,     setXlsxRows]     = useState([])
  const [xlsxErrors,   setXlsxErrors]   = useState([])
  const [xlsxFileName, setXlsxFileName] = useState(null)
  const [xlsxLoading,  setXlsxLoading]  = useState(false)
  const [xlsxImported, setXlsxImported] = useState(false)

  // Text file upload
  const txtRef = useRef(null)
  const [txtRows,     setTxtRows]     = useState([])
  const [txtErrors,   setTxtErrors]   = useState([])
  const [txtFileName, setTxtFileName] = useState(null)
  const [txtLoading,  setTxtLoading]  = useState(false)
  const [txtImported, setTxtImported] = useState(false)

  // Validation errors
  const [errors, setErrors] = useState({})

  // Publish state
  const [published,    setPublished]    = useState(false)
  const [publishedId,  setPublishedId]  = useState(null)
  const [publishing,   setPublishing]   = useState(false)
  const [publishError, setPublishError] = useState('')

  // Draft
  const [draftBanner, setDraftBanner] = useState(() => {
    const d = loadDraft()
    return d && (d.title || d.categories?.length || d.questions?.some(q => q.text)) ? d : null
  })
  const [lastSaved, setLastSaved] = useState(null)
  const saveTimer = useRef(null)

  // Auto-save draft, debounced 1s
  useEffect(() => {
    if (published) return
    clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(() => {
      saveDraft({ title, duration, categories, questions, selectedBatchId })
      setLastSaved(Date.now())
    }, 1000)
    return () => clearTimeout(saveTimer.current)
  }, [title, duration, categories, questions, selectedBatchId, published])

  // ── Draft actions ─────────────────────────────────────────────
  function handleRestoreDraft() {
    if (!draftBanner) return
    if (draftBanner.title)               setTitle(draftBanner.title)
    if (draftBanner.duration)            setDuration(String(draftBanner.duration))
    if (draftBanner.selectedBatchId)     setSelectedBatchId(draftBanner.selectedBatchId)
    if (draftBanner.categories?.length) {
      setCategories(draftBanner.categories)
      _cid = Math.max(_cid, ...draftBanner.categories.map(c => c.id + 1))
    }
    if (draftBanner.questions?.length) {
      setQuestions(draftBanner.questions)
      _qid = Math.max(_qid, ...draftBanner.questions.map(q => q.id + 1))
    }
    setDraftBanner(null)
  }

  function handleDiscardDraft() {
    clearDraft()
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
    clearTimeout(suggestionTimers.current[qid])
    if (text.trim().length < 8) return
    suggestionTimers.current[qid] = setTimeout(async () => {
      const suggested = await fetchCategorySuggestion(text)
      if (suggested) {
        setSuggestions(prev => ({ ...prev, [qid]: suggested }))
      }
    }, 600)
  }

  function dismissSuggestion(qid) {
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

  // ── Excel parsing (supports mcq, truefalse, identification) ───
  async function parseExcelQuestions(file) {
    setXlsxLoading(true)
    setXlsxRows([]); setXlsxErrors([]); setXlsxFileName(file.name); setXlsxImported(false)
    try {
      if (!window.XLSX) {
        await new Promise((resolve, reject) => {
          const s = document.createElement('script')
          s.src = 'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js'
          s.onload = resolve; s.onerror = reject
          document.head.appendChild(s)
        })
      }
      const wb  = window.XLSX.read(await file.arrayBuffer(), { type: 'array' })
      const raw = window.XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { defval: '' })
      const rows = [], errs = []

      raw.forEach((row, i) => {
        const rowNum   = i + 2
        const question = String(row['question'] || '').trim()
        const type     = String(row['type']     || 'mcq').trim().toLowerCase()
        const choiceA  = String(row['choice_a'] || '').trim()
        const choiceB  = String(row['choice_b'] || '').trim()
        const choiceC  = String(row['choice_c'] || '').trim()
        const choiceD  = String(row['choice_d'] || '').trim()
        const correct  = String(row['correct']  || '').trim()
        const category = String(row['category'] || '').trim()
        const rowErrors = []

        if (!question)  rowErrors.push('Question text is required')
        if (!category)  rowErrors.push('Category is required')

        if (!['mcq', 'truefalse', 'identification'].includes(type)) {
          rowErrors.push(`Type must be mcq, truefalse, or identification (got "${type}")`)
        } else if (type === 'mcq') {
          if (!choiceA || !choiceB) rowErrors.push('At least choice_a and choice_b are required for MCQ')
          if (!['A','B','C','D'].includes(correct.toUpperCase())) {
            rowErrors.push(`Correct must be A, B, C, or D for MCQ (got "${correct}")`)
          }
        } else if (type === 'truefalse') {
          if (!['TRUE','FALSE'].includes(correct.toUpperCase())) {
            rowErrors.push(`Correct must be True or False (got "${correct}")`)
          }
        } else if (type === 'identification') {
          if (!correct.trim()) rowErrors.push('Correct answer text is required for Identification')
        }

        if (rowErrors.length) { errs.push({ rowNum, errors: rowErrors }); return }

        if (type === 'identification') {
          rows.push({ question, type: 'identification', choices: ['', '', '', ''], correctIdx: null, identAnswer: correct, category })
        } else if (type === 'truefalse') {
          rows.push({ question, type: 'truefalse', choices: ['True', 'False', '', ''], correctIdx: correct.toUpperCase() === 'TRUE' ? 0 : 1, identAnswer: '', category })
        } else {
          rows.push({ question, type: 'mcq', choices: [choiceA, choiceB, choiceC, choiceD], correctIdx: ['A','B','C','D'].indexOf(correct.toUpperCase()), identAnswer: '', category })
        }
      })

      setXlsxRows(rows); setXlsxErrors(errs)
    } catch {
      setXlsxErrors([{ rowNum: '–', errors: ['Could not read file. Make sure it is a valid .xlsx or .csv file.'] }])
    } finally {
      setXlsxLoading(false)
    }
  }

  // ── Text file parsing ─────────────────────────────────────────
  async function parseTxtFile(file) {
    setTxtLoading(true)
    setTxtRows([]); setTxtErrors([]); setTxtFileName(file.name); setTxtImported(false)
    try {
      const content = await file.text()
      const { rows, errs } = parseTextFileContent(content)
      setTxtRows(rows); setTxtErrors(errs)
    } catch {
      setTxtErrors([{ rowNum: '–', errors: ['Could not read file. Make sure it is a valid .txt file.'] }])
    } finally {
      setTxtLoading(false)
    }
  }

  // ── Shared import function (used by both Excel and text) ───────
  function importUploadedQuestions(sourceRows, setImported) {
    if (!sourceRows.length) return

    const uniqueCatNames = [...new Set(sourceRows.map(r => r.category))]
    const updatedCategories = [...categories]
    const catMap = {}
    updatedCategories.forEach(c => { catMap[c.name.toLowerCase()] = c.id })
    uniqueCatNames.forEach(name => {
      const key = name.toLowerCase()
      if (!catMap[key]) {
        const newCat = makeCategory(nextCid(), name)
        updatedCategories.push(newCat); catMap[key] = newCat.id
      }
    })
    setCategories(updatedCategories)

    const newQuestions = sourceRows.map(r => ({
      id:          nextQid(),
      text:        r.question,
      type:        r.type,
      choices:     r.choices,
      correct:     r.correctIdx,
      identAnswer: r.identAnswer || '',
      categoryId:  catMap[r.category.toLowerCase()],
      expanded:    false,
      source:      'upload',
    }))

    setQuestions(prev => {
      const isPlaceholder = prev.length === 1 && !prev[0].text && prev[0].source === 'manual'
      const base = isPlaceholder ? [] : prev.map(q => ({ ...q, expanded: false }))
      return [...base, ...newQuestions]
    })

    setImported(true)
    setErrors(e => ({ ...e, questions: '' }))
  }

  function importExcelQuestions() { importUploadedQuestions(xlsxRows, setXlsxImported) }
  function importTxtQuestions()   { importUploadedQuestions(txtRows,  setTxtImported)  }

  function downloadExcelTemplate() {
    const header = 'question,type,choice_a,choice_b,choice_c,choice_d,correct,category\n'
    const rows = [
      'What does SQL stand for?,mcq,Structured Query Language,Simple Query Logic,Sequential Query List,Standard Question Language,A,Database',
      'HTML stands for HyperText Markup Language.,truefalse,,,,, True,Web Development',
      'What does CPU stand for?,identification,,,,,Central Processing Unit,Computer Hardware',
    ].join('\n')
    const a = Object.assign(document.createElement('a'), {
      href: URL.createObjectURL(new Blob([header + rows], { type: 'text/csv' })),
      download: 'questions_template.csv',
    })
    a.click()
  }

  function downloadTextTemplate() {
    const content = getTextTemplate()
    const a = Object.assign(document.createElement('a'), {
      href: URL.createObjectURL(new Blob([content], { type: 'text/plain' })),
      download: 'questions_template.txt',
    })
    a.click()
  }

  // ── Validation ────────────────────────────────────────────────
  function validate() {
    const e = {}
    if (!title.trim()) e.title = 'Assessment title is required'
    if (!duration || isNaN(Number(duration)) || Number(duration) < 1) e.duration = 'Enter a valid duration in minutes'
    if (categories.length === 0) e.categories = 'Add at least one skill category'
    if (questions.length === 0)  e.questions  = 'Add at least one question'

    questions.forEach(q => {
      if (!q.text.trim()) e[`q_${q.id}_text`] = 'Question text is required'
      if (q.categoryId === null) e[`q_${q.id}_categoryId`] = 'Tag a skill category'

      if (q.type === 'mcq') {
        if (q.choices.filter(c => c.trim()).length < 2) e[`q_${q.id}_choices`] = 'Enter at least 2 answer choices'
        if (q.correct === null) e[`q_${q.id}_correct`] = 'Mark the correct answer'
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
    if (!validate()) return
    setPublishing(true)
    setPublishError('')

    const payload = {
      title:            title.trim(),
      batch_id:         selectedBatchId || undefined,
      duration_minutes: Number(duration),
      questions:        questions.map(q => {
        const categoryName = categories.find(c => c.id === q.categoryId)?.name || ''

        if (q.type === 'identification') {
          return {
            question_text:  q.text.trim(),
            question_type:  'identification',
            category:       categoryName,
            choices:        [],
            correct_answer: q.identAnswer.trim(),
          }
        }

        if (q.type === 'truefalse') {
          return {
            question_text: q.text.trim(),
            question_type: 'truefalse',
            category:      categoryName,
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
          category:      categoryName,
          choices:       q.choices
            .map((c, i) => ({ text: c.trim(), is_correct: q.correct === i }))
            .filter(c => c.text),
        }
      }),
    }

    try {
      const res = await api.post('/api/instructor/assessments/', payload)
      clearDraft()
      setPublished(true)
      setPublishedId(res.data.id)
    } catch (err) {
      const msg = err.response?.data?.error || err.response?.data?.detail || 'Failed to publish. Please try again.'
      setPublishError(msg)
    } finally {
      setPublishing(false)
    }
  }

  function resetForm() {
    setTitle(''); setDuration(''); setSelectedBatchId(null)
    setCategories([]); setCatInput('')
    setQuestions([makeQuestion(nextQid(), 'mcq')]); setQuestionMode('manual')
    setXlsxRows([]); setXlsxErrors([]); setXlsxFileName(null); setXlsxImported(false)
    setTxtRows([]); setTxtErrors([]); setTxtFileName(null); setTxtImported(false)
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
    batches, loadingBatches, selectedBatchId, setSelectedBatchId,
    // Metadata
    title, setTitle, duration, setDuration,
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
    // Excel
    xlsxRef, xlsxRows, xlsxErrors, xlsxFileName, xlsxLoading, xlsxImported,
    parseExcelQuestions, importExcelQuestions, downloadExcelTemplate,
    // Text file
    txtRef, txtRows, txtErrors, txtFileName, txtLoading, txtImported,
    parseTxtFile, importTxtQuestions, downloadTextTemplate,
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