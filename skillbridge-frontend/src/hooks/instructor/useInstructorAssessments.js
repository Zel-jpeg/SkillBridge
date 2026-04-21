// src/hooks/instructor/useAssessmentUpload.js
//
// State + logic for the "Add Questions" upload modal inside InstructorAssessments.
// Supports Excel (.xlsx/.csv) and Text (.txt) — same formats as InstructorUpload.
//
// After a successful upload the server appends questions and clears all student
// submissions so everyone retakes the assessment with the full question set.
//
// API: POST /api/instructor/assessments/:id/questions/add/

import { useState, useRef, useCallback } from 'react'
import api from '../../api/axios'
import { parseTextFileContent } from './useInstructorUpload'
import { invalidateCache } from '../useApi'

const CHOICE_LABELS = ['A', 'B', 'C', 'D']

// ── Convert parsed rows → API payload ────────────────────────────────────────
function rowsToPayload(rows) {
  return rows.map(r => {
    if (r.type === 'identification') {
      return {
        question_text:  r.question,
        question_type:  'identification',
        category:       r.category,
        choices:        [],
        correct_answer: r.identAnswer,
      }
    }
    if (r.type === 'truefalse') {
      return {
        question_text: r.question,
        question_type: 'truefalse',
        category:      r.category,
        choices: [
          { text: 'True',  is_correct: r.correctIdx === 0 },
          { text: 'False', is_correct: r.correctIdx === 1 },
        ],
      }
    }
    // MCQ
    return {
      question_text: r.question,
      question_type: 'mcq',
      category:      r.category,
      choices:       r.choices
        .map((c, i) => ({ text: c, is_correct: r.correctIdx === i }))
        .filter(c => c.text.trim()),
    }
  })
}

export function useAssessmentUpload({ assessmentId, onSuccess }) {
  // ── Tab ───────────────────────────────────────────────────────────────────
  const [tab, setTab] = useState('excel')  // 'excel' | 'text'

  // ── Excel state ───────────────────────────────────────────────────────────
  const xlsxRef = useRef(null)
  const [xlsxRows,     setXlsxRows]     = useState([])
  const [xlsxErrors,   setXlsxErrors]   = useState([])
  const [xlsxFileName, setXlsxFileName] = useState(null)
  const [xlsxLoading,  setXlsxLoading]  = useState(false)

  // ── Text state ────────────────────────────────────────────────────────────
  const txtRef = useRef(null)
  const [txtRows,     setTxtRows]     = useState([])
  const [txtErrors,   setTxtErrors]   = useState([])
  const [txtFileName, setTxtFileName] = useState(null)
  const [txtLoading,  setTxtLoading]  = useState(false)

  // ── Submit state ──────────────────────────────────────────────────────────
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState('')

  // ── Excel parsing (mirrors useInstructorUpload.parseExcelQuestions) ────────
  async function parseExcelQuestions(file) {
    setXlsxLoading(true)
    setXlsxRows([])
    setXlsxErrors([])
    setXlsxFileName(file.name)
    try {
      if (!window.XLSX) {
        await new Promise((resolve, reject) => {
          const s = document.createElement('script')
          s.src = 'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js'
          s.onload = resolve
          s.onerror = reject
          document.head.appendChild(s)
        })
      }
      const wb  = window.XLSX.read(await file.arrayBuffer(), { type: 'array' })
      const raw = window.XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { defval: '' })
      const rows = []
      const errs = []

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
          if (!choiceA || !choiceB)
            rowErrors.push('At least choice_a and choice_b are required for MCQ')
          if (!['A', 'B', 'C', 'D'].includes(correct.toUpperCase()))
            rowErrors.push(`Correct must be A, B, C, or D for MCQ (got "${correct}")`)
        } else if (type === 'truefalse') {
          if (!['TRUE', 'FALSE'].includes(correct.toUpperCase()))
            rowErrors.push(`Correct must be True or False (got "${correct}")`)
        } else if (type === 'identification') {
          if (!correct.trim())
            rowErrors.push('Correct answer is required for Identification')
        }

        if (rowErrors.length) { errs.push({ rowNum, errors: rowErrors }); return }

        if (type === 'identification') {
          rows.push({ question, type: 'identification', choices: ['', '', '', ''], correctIdx: null, identAnswer: correct, category })
        } else if (type === 'truefalse') {
          rows.push({ question, type: 'truefalse', choices: ['True', 'False', '', ''], correctIdx: correct.toUpperCase() === 'TRUE' ? 0 : 1, identAnswer: '', category })
        } else {
          rows.push({ question, type: 'mcq', choices: [choiceA, choiceB, choiceC, choiceD], correctIdx: ['A', 'B', 'C', 'D'].indexOf(correct.toUpperCase()), identAnswer: '', category })
        }
      })

      setXlsxRows(rows)
      setXlsxErrors(errs)
    } catch {
      setXlsxErrors([{ rowNum: '–', errors: ['Could not read file. Make sure it is a valid .xlsx or .csv file.'] }])
    } finally {
      setXlsxLoading(false)
    }
  }

  // ── Text file parsing (delegates to shared parser) ────────────────────────
  async function parseTxtFile(file) {
    setTxtLoading(true)
    setTxtRows([])
    setTxtErrors([])
    setTxtFileName(file.name)
    try {
      const content = await file.text()
      const { rows, errs } = parseTextFileContent(content)
      setTxtRows(rows)
      setTxtErrors(errs)
    } catch {
      setTxtErrors([{ rowNum: '–', errors: ['Could not read file. Make sure it is a valid .txt file.'] }])
    } finally {
      setTxtLoading(false)
    }
  }

  // ── Submit parsed rows to the backend ─────────────────────────────────────
  const handleSubmit = useCallback(async () => {
    const rows = tab === 'excel' ? xlsxRows : txtRows
    if (!rows.length || !assessmentId) return

    setSubmitting(true)
    setSubmitError('')
    try {
      const res = await api.post(
        `/api/instructor/assessments/${assessmentId}/questions/add/`,
        {
          questions:         rowsToPayload(rows),
          clear_submissions: true,
        }
      )
      // Invalidate cache so the list and questions drawer both refresh
      invalidateCache('/api/instructor/assessments/')
      invalidateCache(`/api/instructor/assessments/${assessmentId}/questions/`)
      onSuccess?.(res.data)
      reset()
    } catch (err) {
      const msg = err.response?.data?.error || err.response?.data?.detail || 'Upload failed. Please try again.'
      setSubmitError(msg)
    } finally {
      setSubmitting(false)
    }
  }, [tab, xlsxRows, txtRows, assessmentId, onSuccess])

  // ── Reset all state ───────────────────────────────────────────────────────
  function reset() {
    setTab('excel')
    setXlsxRows([]); setXlsxErrors([]); setXlsxFileName(null)
    setTxtRows([]);  setTxtErrors([]);  setTxtFileName(null)
    setSubmitError('')
  }

  const activeRows   = tab === 'excel' ? xlsxRows   : txtRows
  const activeErrors = tab === 'excel' ? xlsxErrors : txtErrors
  const activeLoading = tab === 'excel' ? xlsxLoading : txtLoading

  return {
    // Tab
    tab, setTab,
    // Excel
    xlsxRef, xlsxRows, xlsxErrors, xlsxFileName, xlsxLoading, parseExcelQuestions,
    // Text
    txtRef, txtRows, txtErrors, txtFileName, txtLoading, parseTxtFile,
    // Derived (whichever tab is active)
    activeRows, activeErrors, activeLoading,
    // Submit
    submitting, submitError, handleSubmit,
    // Utils
    reset,
    CHOICE_LABELS,
  }
}