import { useEffect, useRef, useState } from 'react'
import api from '../../api/axios'
import Pagination from '../Pagination'
import DialogShell from '../DialogShell'
import { BookOpenIcon, ReportIcon } from '../Icons'
import EditableQuestionCard from './EditableQuestionCard'
import {
  CHOICE_LABELS, detectQuestionTextFormat, parseAikenQuestions, parseNativeQuestions, parseSpreadsheetQuestions, QUESTION_IMPORT_TEMPLATES,
} from '../../utils/questionImport'

const field = 'w-full min-w-0 rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-800'
const button = 'min-h-10 rounded-xl border border-gray-200 px-3 py-2 text-xs font-semibold hover:bg-green-50 focus-visible:outline-2 focus-visible:outline-green-600 disabled:opacity-50 dark:border-gray-700 dark:hover:bg-green-950'
const formats = {
  aiken: 'AIKEN (.txt)',
  excel: 'Excel / CSV',
}
const questionTypes = { mcq: 'MCQ', truefalse: 'True / False', identification: 'Identification' }
const help = {
  aiken: 'Upload UTF-8 text with one question per block, two to four lettered choices, and one ANSWER key. Assign skill categories during review.',
  excel: 'Use the spreadsheet template columns. Supports multiple choice, true/false and identification.',
}
const guideSteps = [
  'Download the template for your format.',
  'Upload your file and check the answer keys in Review questions.',
  'Assign skill categories, then add the questions and save the draft.',
]
const pageSize = 6
const emptyPreview = { rows: [], errs: [] }

function downloadTemplate(format) {
  const [filename, content] = QUESTION_IMPORT_TEMPLATES[format]
  const url = URL.createObjectURL(new Blob([content], { type: 'text/plain;charset=utf-8' }))
  const link = Object.assign(document.createElement('a'), { href: url, download: filename })
  link.click()
  setTimeout(() => URL.revokeObjectURL(url), 0)
}

function categoryFor(row, categories) {
  if (row.categoryId != null) return categories.find(item => item.id === row.categoryId)
  return categories.find(item => item.name.toLowerCase() === row.category.toLowerCase())
}

function reviewError(row) {
  if (!row.question.trim()) return 'Enter the question text.'
  if (row.type === 'identification') return row.identAnswer.trim() ? '' : 'Enter the correct answer.'
  if (row.choices.filter(choice => choice.trim()).length < 2) return 'Enter at least two answer choices.'
  if (!row.choices[row.correctIdx]?.trim()) return 'Mark a non-empty correct answer.'
  return ''
}

function QuestionImportGuide({ initialFormat, onClose, restoreFocusRef }) {
  const [format, setFormat] = useState(initialFormat)

  return <DialogShell title="Question import guide" description="File examples and steps for importing assessment questions."
    size="import-guide" closeLabel="Close question import guide" onClose={onClose} restoreFocusRef={restoreFocusRef}>
    <div className="min-h-0 space-y-4 overflow-y-auto p-4 text-xs leading-5 sm:p-6">
      <div role="group" aria-label="Guide format" className="grid grid-cols-2 gap-1 rounded-xl bg-gray-100 p-1 dark:bg-gray-800">
        {Object.entries(formats).map(([value, label]) => <button key={value} type="button" aria-pressed={format === value}
          onClick={() => setFormat(value)} className={`min-h-10 cursor-pointer rounded-lg px-2 font-semibold motion-safe:transition-colors ${format === value
            ? 'bg-green-100 text-green-900 dark:bg-green-900/70 dark:text-green-100'
            : 'text-gray-600 hover:bg-white hover:text-gray-900 dark:text-gray-300 dark:hover:bg-gray-700 dark:hover:text-white'}`}>
          {label}
        </button>)}
      </div>
      <ol className="space-y-2 text-gray-700 dark:text-gray-200">
        {guideSteps.map((step, index) => <li key={step} className="flex items-start gap-2.5">
          <span aria-hidden="true" className="grid size-5 shrink-0 place-items-center rounded-full bg-green-700 text-[11px] font-semibold text-white dark:bg-green-200 dark:text-green-950">{index + 1}</span>
          <span>{step}</span>
        </li>)}
      </ol>
      <div className="space-y-1.5">
        <h3 className="font-semibold text-gray-900 dark:text-white">{format === 'aiken' ? 'AIKEN example' : 'CSV example'}</h3>
        <pre className="rounded-lg border border-gray-200 bg-gray-50 p-3 font-mono whitespace-pre-wrap wrap-anywhere text-gray-800 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-200"><code>{QUESTION_IMPORT_TEMPLATES[format][1].trimEnd()}</code></pre>
      </div>
      {format === 'aiken' && <p className="text-gray-600 dark:text-gray-300">
        Upload older SkillBridge text files in the AIKEN tab. SkillBridge detects their format automatically.
      </p>}
    </div>
  </DialogShell>
}

export default function QuestionImportPanel({ categories, scoped = false, onStage, onCancel }) {
  const [format, setFormat] = useState('aiken')
  const [guideOpen, setGuideOpen] = useState(false)
  const [filename, setFilename] = useState('')
  const [preview, setPreview] = useState(emptyPreview)
  const [loading, setLoading] = useState(false)
  const [dragging, setDragging] = useState(false)
  const [reviewing, setReviewing] = useState(false)
  const [expandedRow, setExpandedRow] = useState(null)
  const [detectedFormat, setDetectedFormat] = useState(null)
  const [selected, setSelected] = useState([])
  const [bulkCategory, setBulkCategory] = useState('')
  const [page, setPage] = useState(1)
  const [suggestions, setSuggestions] = useState({})
  const generation = useRef(0)
  const formatControl = useRef(null)
  const guideButton = useRef(null)
  useEffect(() => {
    const frame = requestAnimationFrame(() => formatControl.current?.focus())
    return () => {
      cancelAnimationFrame(frame)
      generation.current += 1
    }
  }, [])

  function clearPreview() {
    generation.current += 1
    setFilename('')
    setLoading(false)
    setDragging(false)
    setReviewing(false)
    setExpandedRow(null)
    setDetectedFormat(null)
    setPreview(emptyPreview)
    setSelected([])
    setBulkCategory('')
    setPage(1)
    setSuggestions({})
  }

  function changeFormat(next) {
    if (next === format) return
    setFormat(next)
    clearPreview()
  }

  async function readFile(file) {
    clearPreview()
    const attempt = generation.current
    setFilename(file.name)
    setLoading(true)
    try {
      const data = await file.arrayBuffer()
      let parsed
      let fileFormat = format
      if (format === 'excel') {
        const XLSX = await import('xlsx')
        const workbook = XLSX.read(data, { type: 'array' })
        const rows = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]], { defval: '' })
        parsed = parseSpreadsheetQuestions(rows)
      } else {
        const content = new TextDecoder('utf-8', { fatal: true }).decode(data)
        fileFormat = detectQuestionTextFormat(content)
        parsed = (fileFormat === 'aiken' ? parseAikenQuestions : parseNativeQuestions)(content)
      }
      if (attempt !== generation.current) return
      setPreview(parsed)
      setDetectedFormat(fileFormat === format ? null : fileFormat)
      // A partial import needs a deliberate choice of valid rows.
      setSelected(parsed.errs.length ? [] : parsed.rows.map(row => row.rowNum))
      setReviewing(parsed.errs.length > 0 && parsed.rows.length > 0)
      setExpandedRow(parsed.rows[0]?.rowNum ?? null)
    } catch {
      if (attempt === generation.current) setPreview({ rows: [], errs: [{ rowNum: '–', errors: [format === 'excel'
        ? 'Could not read this spreadsheet. Use an Excel or CSV file.'
        : 'Could not read this text file. Save it as UTF-8 and upload it again.'] }] })
    } finally {
      if (attempt === generation.current) setLoading(false)
    }
  }

  function assign(ids, value) {
    const category = categories.find(item => String(item.id) === value)
    setPreview(previous => ({ ...previous, rows: previous.rows.map(row => ids.includes(row.rowNum)
      ? { ...row, categoryId: category?.id ?? null, category: category?.name || '' } : row) }))
  }

  function updateRow(rowNum, changes) {
    setPreview(previous => ({ ...previous, rows: previous.rows.map(row => row.rowNum === rowNum ? { ...row, ...changes } : row) }))
    if ('question' in changes) setSuggestions(previous => ({ ...previous, [rowNum]: undefined }))
  }

  async function suggest(row) {
    const attempt = generation.current
    const pending = { loading: true }
    setSuggestions(previous => ({ ...previous, [row.rowNum]: pending }))
    let value = ''
    try {
      const response = await api.post('/api/categories/suggest/', { question_text: row.question })
      value = response.data.suggested_category || ''
    } catch { /* Category assistance is optional. */ }
    if (attempt === generation.current) setSuggestions(previous => previous[row.rowNum] === pending
      ? { ...previous, [row.rowNum]: { value } } : previous)
  }

  function acceptSuggestion(rowNum, value) {
    setPreview(previous => ({ ...previous, rows: previous.rows.map(row => row.rowNum === rowNum
      ? { ...row, categoryId: null, category: value } : row) }))
    setSuggestions(previous => ({ ...previous, [rowNum]: undefined }))
  }

  const selection = new Set(selected)
  const { rows, errs } = preview
  const fileFormat = detectedFormat ?? format
  const unmapped = rows.filter(row => !categoryFor(row, categories) && (scoped || !row.category)).length
  const invalidSelected = rows.flatMap((row, index) => selection.has(row.rowNum) && reviewError(row) ? [index + 1] : [])
  const pageStart = (page - 1) * pageSize
  const visibleRows = rows.slice(pageStart, pageStart + pageSize)
  function stage() {
    if (!selected.length || loading || invalidSelected.length) return
    const staged = rows.filter(row => selection.has(row.rowNum)).map(row => {
      const category = categoryFor(row, categories)
      return { ...row, question: row.question.trim(), choices: row.choices.map(choice => choice.trim()),
        identAnswer: row.identAnswer.trim(), categoryId: category?.id ?? null, category: category?.name || (scoped ? '' : row.category) }
    })
    onStage(staged)
    clearPreview()
  }

  return <section aria-label="Import questions" className="min-w-0 space-y-4 rounded-xl border border-gray-200 p-4 text-sm dark:border-gray-700">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <div role="group" aria-label="Question import format" className="inline-flex max-w-full flex-wrap gap-1 rounded-xl bg-gray-100 p-1 dark:bg-gray-800">
        {Object.entries(formats).map(([value, label]) => <button key={value} type="button" ref={value === 'aiken' ? formatControl : undefined}
          aria-pressed={format === value} onClick={() => changeFormat(value)}
          className={`min-h-9 rounded-lg px-3 text-xs font-semibold ${format === value ? 'bg-white text-gray-900 shadow-sm dark:bg-gray-700 dark:text-white' : 'text-gray-600 hover:text-gray-900 dark:text-gray-300 dark:hover:text-white'}`}>
          {label}
        </button>)}
      </div>
      <button ref={guideButton} type="button" aria-haspopup="dialog" onClick={() => setGuideOpen(true)}
        className={`${button} ml-auto inline-flex h-11 max-w-full cursor-pointer items-center gap-2 bg-white dark:bg-gray-900`}>
        <BookOpenIcon size={16} /> Question import guide
      </button>
    </div>
    {guideOpen && <QuestionImportGuide initialFormat={format} onClose={() => setGuideOpen(false)} restoreFocusRef={guideButton} />}
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-blue-100 bg-blue-50 p-3 dark:border-blue-900 dark:bg-blue-950/35">
      <div className="min-w-0 flex-1 basis-48 text-xs leading-5 text-blue-900 dark:text-blue-200">
        <p className="font-semibold">{formats[format]} template</p>
        <p className="mt-1">{help[format]}</p>
      </div>
      <button type="button" className="min-h-10 rounded-lg border border-blue-200 bg-white px-3 py-2 text-xs font-semibold text-blue-900 hover:bg-blue-100 dark:border-blue-800 dark:bg-gray-900 dark:text-blue-200 dark:hover:bg-blue-950" onClick={() => downloadTemplate(format)}>Download template</button>
    </div>
    <label className={`relative flex min-h-36 min-w-0 cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border border-dashed p-4 text-center focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-green-700 dark:focus-within:outline-green-400 ${dragging ? 'border-green-600 bg-green-50 dark:border-green-400 dark:bg-green-950/40' : 'border-gray-300 bg-gray-50/60 hover:border-green-600 hover:bg-green-50/60 dark:border-gray-600 dark:bg-gray-800/40 dark:hover:border-green-500 dark:hover:bg-green-950/25'}`}
      onDragOver={event => { event.preventDefault(); if (event.dataTransfer.types.includes('Files')) setDragging(true) }}
      onDragLeave={event => { if (!event.currentTarget.contains(event.relatedTarget)) setDragging(false) }}
      onDrop={event => {
        event.preventDefault()
        setDragging(false)
        const file = event.dataTransfer.files[0]
        if (file) void readFile(file)
      }}>
      <input aria-label="Question import file" type="file" className="absolute inset-0 h-full w-full cursor-pointer opacity-0" accept={format === 'excel' ? '.xlsx,.xls,.csv' : '.txt'}
        onChange={event => { const file = event.target.files?.[0]; event.target.value = ''; if (file) void readFile(file) }} />
      <span aria-hidden="true" className="pointer-events-none grid size-9 place-items-center rounded-lg bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300"><ReportIcon size={20} /></span>
      <span className="pointer-events-none max-w-full font-semibold wrap-anywhere text-gray-900 dark:text-white">{filename || (format === 'excel' ? 'Drop your Excel or CSV file here' : 'Drop your .txt file here')}</span>
      <span className="pointer-events-none text-xs text-gray-600 dark:text-gray-300">{filename ? 'Click to replace or drop another file' : 'or click to browse'}</span>
    </label>
    {loading && <p role="status">Reading file…</p>}
    {detectedFormat && <p role="status" className="rounded-lg bg-blue-50 px-3 py-2 text-xs text-blue-900 dark:bg-blue-950/50 dark:text-blue-200">
      Detected SkillBridge text. This file uses the question types, answer keys, and categories specified in its text.
    </p>}
    {(rows.length > 0 || errs.length > 0) && <div className="flex flex-wrap items-center justify-between gap-2">
      <p role="status" className="text-xs text-gray-700 dark:text-gray-200">
        {rows.length + errs.length} reviewed · {rows.length} valid · {errs.length} with errors · {unmapped} unmapped · {selected.length} selected
      </p>
      {rows.length > 0 && <button type="button" aria-expanded={reviewing} onClick={() => setReviewing(value => !value)}
        className="min-h-9 rounded-lg px-2 text-xs font-semibold text-green-800 hover:bg-green-50 focus-visible:outline-2 focus-visible:outline-green-600 dark:text-green-300 dark:hover:bg-green-950">
        {reviewing ? 'Done reviewing' : 'Review questions'}
      </button>}
    </div>}
    {errs.length > 0 && <section aria-label="Import errors" className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-900 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-200">
      <p className="font-semibold">Review import errors</p>
      {rows.length > 0 && <p>Select the valid questions you want to stage. To include the others, correct the file and upload it again.</p>}
      <ul className="mt-2 max-h-48 space-y-2 overflow-y-auto">
        {errs.map(error => <li key={error.rowNum} className="break-words">
          {error.rowNum !== '–' && <strong>{fileFormat === 'excel' ? 'Spreadsheet row' : 'File question'} {error.rowNum}{error.line ? ` · line ${error.line}` : ''}</strong>}
          {error.question && <p>{error.question}</p>}<p>{error.errors.join(' ')}</p></li>)}
      </ul>
    </section>}
    {rows.length > 0 && <>
      {reviewing && <div className="flex flex-wrap gap-2">
        <button type="button" className={button} onClick={() => setSelected(rows.map(row => row.rowNum))}>Select all valid</button>
        <button type="button" className={button} onClick={() => setSelected([])}>Clear selection</button>
      </div>}
      {reviewing && categories.length > 0 && <div className="flex flex-wrap items-end gap-2">
        <label className="min-w-0 flex-1 basis-44 text-xs font-semibold">Category for selected questions
          <select aria-label="Category for selected questions" className={field} value={bulkCategory} onChange={event => setBulkCategory(event.target.value)}>
            <option value="">Choose a saved category</option>
            {categories.map(category => <option key={category.id} value={category.id}>{category.name}</option>)}
          </select>
        </label>
        <button type="button" className={button} disabled={!bulkCategory || !selected.length} onClick={() => assign(selected, bulkCategory)}>Apply category to selected</button>
      </div>}
      {reviewing ? <div role="region" aria-label="Question review" className="space-y-2">
        {visibleRows.map((row, index) => {
          const questionNumber = pageStart + index + 1
          const category = categoryFor(row, categories)
          const error = reviewError(row)
          const question = {
            _tempId: `import-${row.rowNum}`,
            _expanded: expandedRow === row.rowNum,
            question_type: row.type,
            question_text: row.question,
            choices: (row.type === 'mcq' ? CHOICE_LABELS.map((_, index) => row.choices[index] ?? '') : row.choices)
              .map((text, index) => ({ text, is_correct: index === row.correctIdx })),
            identAnswer: row.identAnswer,
            category,
          }
          return <div key={row.rowNum} className="grid grid-cols-[auto_minmax(0,1fr)] items-start gap-2">
            <label className="grid size-7 cursor-pointer place-items-center self-start mt-3" title={`Include question ${questionNumber} in the draft`}>
              <input type="checkbox" className="accent-green-700" aria-label={`Select question ${questionNumber}`} checked={selection.has(row.rowNum)}
                onChange={event => {
                  const checked = event.target.checked
                  setSelected(previous => checked ? [...previous, row.rowNum] : previous.filter(number => number !== row.rowNum))
                }} />
            </label>
            <div className="min-w-0">
              <EditableQuestionCard q={question} index={questionNumber - 1}
                categories={categories} autoSuggest={false}
                onUpdate={(_, changes) => {
                  if ('_expanded' in changes) setExpandedRow(changes._expanded ? row.rowNum : null)
                  if ('question_text' in changes) updateRow(row.rowNum, { question: changes.question_text })
                  if ('identAnswer' in changes) updateRow(row.rowNum, { identAnswer: changes.identAnswer })
                  if (changes.category) assign([row.rowNum], String(changes.category.id))
                }}
                onChangeType={(_, type) => {
                  if (type === row.type) return
                  updateRow(row.rowNum, { type, choices: type === 'truefalse' ? ['True', 'False'] : [], correctIdx: null, identAnswer: '' })
                }}
                onUpdateChoice={(_, index, _field, value) => {
                  const choices = question.choices.map((choice, position) => position === index ? value : choice.text)
                  updateRow(row.rowNum, { choices })
                }}
                onSetCorrect={(_, index) => updateRow(row.rowNum, { correctIdx: index })}
                categoryActions={<div className="mt-2 space-y-2">
                  {row.category && !category && <p className="wrap-anywhere text-gray-600 dark:text-gray-300">File category: {row.category}</p>}
                  <div className="flex flex-wrap items-center gap-2">
                    {row.category && <button type="button" className={button} onClick={() => assign([row.rowNum], '')}>Clear category</button>}
                    {!scoped && fileFormat !== 'aiken' && <>
                      <button type="button" className={button} disabled={!row.question.trim() || suggestions[row.rowNum]?.loading} onClick={() => { void suggest(row) }}>
                        {suggestions[row.rowNum]?.loading ? 'Looking up category…' : 'Suggest category'}
                      </button>
                      {suggestions[row.rowNum]?.value && <button type="button" className={button}
                        onClick={() => acceptSuggestion(row.rowNum, suggestions[row.rowNum].value)}>Use {suggestions[row.rowNum].value}</button>}
                      {suggestions[row.rowNum]?.value === '' && <span>No category suggestion available.</span>}
                    </>}
                  </div>
                </div>} />
              {error && <p className="px-2 pt-1 text-xs text-rose-700 dark:text-rose-300">Question {questionNumber}: {error}</p>}
            </div>
          </div>
        })}
      </div> : <div role="region" aria-label="Valid questions preview" tabIndex={0} className="min-w-0 overflow-x-auto rounded-xl border border-gray-200 focus-visible:outline-2 focus-visible:outline-green-600 dark:border-gray-700">
        <table className="w-full min-w-[36rem] table-fixed text-left text-xs">
          <thead className="bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300">
            <tr>
              <th scope="col" className="w-10 px-3 py-2">#</th>
              <th scope="col" className="px-3 py-2">Question</th>
              <th scope="col" className="w-24 px-2 py-2">Type</th>
              <th scope="col" className="w-20 px-2 py-2">Answer</th>
              <th scope="col" className="w-[22%] px-3 py-2">Category</th>
            </tr>
          </thead>
          <tbody>{visibleRows.map((row, index) => {
            const questionNumber = pageStart + index + 1
            const category = categoryFor(row, categories)
            const categoryName = category?.name || (scoped && row.category ? `Unmapped · ${row.category}` : row.category || 'Unmapped')
            const answer = row.type === 'identification' ? row.identAnswer
              : row.type === 'truefalse' ? row.choices[row.correctIdx] : CHOICE_LABELS[row.correctIdx]
            return <tr key={row.rowNum} className="border-t border-gray-100 align-middle even:bg-gray-50/60 dark:border-gray-800 dark:even:bg-gray-800/30">
              <td className="px-3 py-1.5 tabular-nums text-gray-600 dark:text-gray-300">{questionNumber}</td>
              <td className="px-3 py-1.5">
                <p className="truncate" title={row.question}>{row.question || 'Missing question text'}</p>
                {!selection.has(row.rowNum) && <span className="text-gray-600 dark:text-gray-300">Excluded from draft</span>}
              </td>
              <td className="px-2 py-1.5"><span className="inline-block rounded-full bg-blue-50 px-1.5 py-0.5 font-medium whitespace-nowrap text-blue-800 dark:bg-blue-950 dark:text-blue-200">{questionTypes[row.type]}</span></td>
              <td className="px-2 py-1.5 font-semibold text-green-800 dark:text-green-300"><p className="truncate" title={answer}>{answer || '—'}</p></td>
              <td className="px-3 py-1.5 wrap-anywhere text-gray-700 dark:text-gray-200">{categoryName}</td>
            </tr>
          })}</tbody>
        </table>
      </div>}
      <Pagination total={rows.length} page={page} pageSize={pageSize} onPage={next => {
        setPage(next)
        setExpandedRow(rows[(next - 1) * pageSize]?.rowNum ?? null)
      }} />
    </>}
    {invalidSelected.length > 0 && <p role="status" className="text-xs text-rose-700 dark:text-rose-300">
      Finish or deselect {invalidSelected.length === 1 ? 'question' : 'questions'} {invalidSelected.join(', ')} before adding to the draft.
    </p>}
    <div className="flex flex-wrap gap-2">
      <button type="button" className={`${button} flex-1 basis-44 bg-green-700 text-white enabled:hover:bg-green-800 dark:enabled:hover:bg-green-800`} disabled={!selected.length || loading || invalidSelected.length > 0} onClick={stage}>
        Add {selected.length} {selected.length === 1 ? 'question' : 'questions'} to draft
      </button>
      <button type="button" className={button} onClick={onCancel}>Cancel import</button>
    </div>
    {unmapped > 0 && <p className="text-xs text-gray-600 dark:text-gray-300">Unmapped questions can stay in a draft. Assign every category before publishing.</p>}
  </section>
}
