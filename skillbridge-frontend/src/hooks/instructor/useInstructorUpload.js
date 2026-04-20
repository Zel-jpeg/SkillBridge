// src/hooks/instructor/useInstructorUpload.js
//
// Data hook for InstructorUpload (Assessment Creator).
// Manages assessment metadata, skill categories, questions,
// Excel upload/parsing, auto-save draft, and validation.

import { useState, useRef, useEffect, useCallback } from 'react'

const DRAFT_KEY    = 'sb_assessment_draft'
const CHOICE_LABELS = ['A', 'B', 'C', 'D']

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
export function makeQuestion(id) {
  return { id, text: '', choices: ['', '', '', ''], correct: null, categoryId: null, expanded: true, source: 'manual' }
}
export function makeCategory(id, name = '') {
  return { id, name: name.trim() }
}

// ── Main hook ─────────────────────────────────────────────────────
export function useInstructorUpload() {
  // Assessment metadata
  const [title,    setTitle]    = useState('')
  const [duration, setDuration] = useState('')

  // Skill categories
  const [categories, setCategories] = useState([])
  const [catInput,   setCatInput]   = useState('')
  const catRef = useRef(null)

  // Questions
  const [questions,     setQuestions]     = useState(() => [makeQuestion(nextQid())])
  const [questionMode,  setQuestionMode]  = useState('manual')

  // Excel upload
  const xlsxRef = useRef(null)
  const [xlsxRows,     setXlsxRows]     = useState([])
  const [xlsxErrors,   setXlsxErrors]   = useState([])
  const [xlsxFileName, setXlsxFileName] = useState(null)
  const [xlsxLoading,  setXlsxLoading]  = useState(false)
  const [xlsxImported, setXlsxImported] = useState(false)

  // Validation errors
  const [errors, setErrors] = useState({})

  // Publish state
  const [published, setPublished] = useState(false)

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
      saveDraft({ title, duration, categories, questions })
      setLastSaved(Date.now())
    }, 1000)
    return () => clearTimeout(saveTimer.current)
  }, [title, duration, categories, questions, published])

  // ── Draft actions ─────────────────────────────────────────────────
  function handleRestoreDraft() {
    if (!draftBanner) return
    if (draftBanner.title)               setTitle(draftBanner.title)
    if (draftBanner.duration)            setDuration(String(draftBanner.duration))
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

  // ── Category actions ──────────────────────────────────────────────
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
  }

  // ── Question actions ──────────────────────────────────────────────
  function addQuestion() {
    setQuestions(prev => [
      ...prev.map(q => ({ ...q, expanded: false })),
      makeQuestion(nextQid()),
    ])
  }

  function removeQuestion(id) {
    setQuestions(prev => prev.filter(q => q.id !== id))
  }

  function toggleExpand(id) {
    setQuestions(prev => prev.map(q => q.id === id ? { ...q, expanded: !q.expanded } : q))
  }

  function updateQuestion(id, field, value) {
    setQuestions(prev => prev.map(q => q.id === id ? { ...q, [field]: value } : q))
    setErrors(e => ({ ...e, [`q_${id}_${field}`]: '' }))
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

  // ── Excel parsing ─────────────────────────────────────────────────
  async function parseExcelQuestions(file) {
    setXlsxLoading(true); setXlsxRows([]); setXlsxErrors([]); setXlsxFileName(file.name); setXlsxImported(false)
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
        const correct  = String(row['correct']  || '').trim().toUpperCase()
        const category = String(row['category'] || '').trim()
        const rowErrors = []
        if (!question) rowErrors.push('Question text is required')
        if (!category) rowErrors.push('Category is required')
        if (type === 'mcq') {
          if (!choiceA || !choiceB) rowErrors.push('At least choice_a and choice_b are required')
          if (!['A','B','C','D'].includes(correct)) rowErrors.push(`Correct must be A, B, C, or D (got "${correct}")`)
        } else if (type === 'truefalse') {
          if (!['TRUE','FALSE'].includes(correct)) rowErrors.push(`Correct must be True or False (got "${correct}")`)
        } else {
          rowErrors.push(`Type must be "mcq" or "truefalse" (got "${type}")`)
        }
        if (rowErrors.length) { errs.push({ rowNum, errors: rowErrors }); return }
        const choices    = type === 'truefalse' ? ['True', 'False', '', ''] : [choiceA, choiceB, choiceC, choiceD]
        const correctIdx = type === 'truefalse' ? (correct === 'TRUE' ? 0 : 1) : ['A','B','C','D'].indexOf(correct)
        rows.push({ question, type, choices, correctIdx, category })
      })
      setXlsxRows(rows); setXlsxErrors(errs)
    } catch {
      setXlsxErrors([{ rowNum: '–', errors: ['Could not read file. Make sure it is a valid .xlsx or .csv file.'] }])
    } finally {
      setXlsxLoading(false)
    }
  }

  function importExcelQuestions() {
    if (!xlsxRows.length) return
    const uniqueCatNames = [...new Set(xlsxRows.map(r => r.category))]
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
    const newQuestions = xlsxRows.map(r => ({
      id: nextQid(), text: r.question, choices: r.choices, correct: r.correctIdx,
      categoryId: catMap[r.category.toLowerCase()], expanded: false, source: 'excel',
    }))
    setQuestions(prev => {
      const isPlaceholder = prev.length === 1 && !prev[0].text && prev[0].source === 'manual'
      const base = isPlaceholder ? [] : prev.map(q => ({ ...q, expanded: false }))
      return [...base, ...newQuestions]
    })
    setXlsxImported(true)
    setErrors(e => ({ ...e, questions: '' }))
  }

  function downloadQuestionsTemplate() {
    const header = 'question,type,choice_a,choice_b,choice_c,choice_d,correct,category\n'
    const rows = [
      'What does SQL stand for?,mcq,Structured Query Language,Simple Query Logic,Sequential Query List,Standard Question Language,A,Database',
      'HTML stands for HyperText Markup Language.,truefalse,,,,, True,Web Development',
    ].join('\n')
    const a = Object.assign(document.createElement('a'), {
      href: URL.createObjectURL(new Blob([header + rows], { type: 'text/csv' })),
      download: 'questions_template.csv',
    })
    a.click()
  }

  // ── Validation ────────────────────────────────────────────────────
  function validate() {
    const e = {}
    if (!title.trim())    e.title    = 'Assessment title is required'
    if (!duration || isNaN(Number(duration)) || Number(duration) < 1) e.duration = 'Enter a valid duration (minutes)'
    if (categories.length === 0) e.categories = 'Add at least one skill category'
    if (questions.length === 0)  e.questions  = 'Add at least one question'
    questions.forEach(q => {
      if (!q.text.trim()) e[`q_${q.id}_text`] = 'Question text is required'
      if (q.choices.filter(c => c.trim()).length < 2) e[`q_${q.id}_choices`] = 'Enter at least 2 answer choices'
      if (q.correct === null)     e[`q_${q.id}_correct`]     = 'Mark the correct answer'
      if (q.categoryId === null)  e[`q_${q.id}_categoryId`]  = 'Tag a skill category'
    })
    setErrors(e)
    const errorQids = new Set(Object.keys(e).filter(k => k.startsWith('q_')).map(k => Number(k.split('_')[1])))
    if (errorQids.size > 0) {
      setQuestions(prev => prev.map(q => errorQids.has(q.id) ? { ...q, expanded: true } : q))
    }
    return Object.keys(e).length === 0
  }

  function handlePublish() {
    if (!validate()) return
    // TODO Week 4: POST /api/instructor/assessments/
    const payload = {
      title:            title.trim(),
      duration_minutes: Number(duration),
      categories:       categories.map(c => c.name),
      questions:        questions.map(q => ({
        text:     q.text.trim(),
        choices:  q.choices.map(c => c.trim()),
        correct:  q.correct,
        category: categories.find(c => c.id === q.categoryId)?.name,
      })),
    }
    console.log('Publishing assessment:', payload)
    clearDraft()
    setPublished(true)
  }

  // ── Derived counts ────────────────────────────────────────────────
  const countPerCat  = categories.map(cat => ({ ...cat, count: questions.filter(q => q.categoryId === cat.id).length }))
  const totalTagged  = questions.filter(q => q.categoryId !== null).length
  const totalCorrect = questions.filter(q => q.correct !== null).length

  return {
    // Metadata
    title, setTitle, duration, setDuration,
    // Categories
    categories, catInput, setCatInput, catRef,
    addCategory, removeCategory,
    // Questions
    questions, questionMode, setQuestionMode,
    addQuestion, removeQuestion, toggleExpand,
    updateQuestion, updateChoice, setCorrect,
    // Excel
    xlsxRef, xlsxRows, xlsxErrors, xlsxFileName, xlsxLoading, xlsxImported,
    parseExcelQuestions, importExcelQuestions, downloadQuestionsTemplate,
    // Draft
    draftBanner, lastSaved, handleRestoreDraft, handleDiscardDraft,
    formatDraftAge,
    // Validation / publish
    errors, setErrors, published, handlePublish, validate,
    // Derived counts
    countPerCat, totalTagged, totalCorrect,
    CHOICE_LABELS,
  }
}
