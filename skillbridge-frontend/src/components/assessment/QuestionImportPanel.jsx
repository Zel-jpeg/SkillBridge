import { useEffect, useRef, useState } from 'react'
import api from '../../api/axios'
import Pagination from '../Pagination'
import {
  CHOICE_LABELS, parseAikenQuestions, parseNativeQuestions, parseSpreadsheetQuestions, QUESTION_IMPORT_TEMPLATES,
} from '../../utils/questionImport'

const field = 'w-full min-w-0 rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-800'
const button = 'min-h-10 rounded-xl border border-gray-200 px-3 py-2 text-xs font-semibold hover:bg-green-50 focus-visible:outline-2 focus-visible:outline-green-600 disabled:opacity-50 dark:border-gray-700 dark:hover:bg-green-950'
const formats = {
  aiken: 'AIKEN (.txt)',
  native: 'SkillBridge text (.txt)',
  excel: 'Excel / CSV',
}
const help = {
  aiken: 'Upload UTF-8 text with one question per block, two to four lettered choices, and one ANSWER key. Assign skill categories during review.',
  native: 'Use QUESTION, CORRECT and CATEGORY fields, separated into question blocks by a line of dashes. Supports multiple choice, true/false and identification.',
  excel: 'Use the spreadsheet template columns. Supports multiple choice, true/false and identification.',
}
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

export default function QuestionImportPanel({ categories, scoped = false, onStage, onCancel }) {
  const [format, setFormat] = useState('aiken')
  const [filename, setFilename] = useState('')
  const [preview, setPreview] = useState(emptyPreview)
  const [loading, setLoading] = useState(false)
  const [selected, setSelected] = useState([])
  const [bulkCategory, setBulkCategory] = useState('')
  const [page, setPage] = useState(1)
  const [suggestions, setSuggestions] = useState({})
  const generation = useRef(0)
  const formatControl = useRef(null)
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
    setPreview(emptyPreview)
    setSelected([])
    setBulkCategory('')
    setPage(1)
    setSuggestions({})
  }

  async function readFile(file) {
    clearPreview()
    const attempt = generation.current
    setFilename(file.name)
    setLoading(true)
    try {
      const data = await file.arrayBuffer()
      let parsed
      if (format === 'excel') {
        const XLSX = await import('xlsx')
        const workbook = XLSX.read(data, { type: 'array' })
        const rows = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]], { defval: '' })
        parsed = parseSpreadsheetQuestions(rows)
      } else {
        const content = new TextDecoder('utf-8', { fatal: true }).decode(data)
        parsed = (format === 'aiken' ? parseAikenQuestions : parseNativeQuestions)(content)
      }
      if (attempt !== generation.current) return
      setPreview(parsed)
      // A partial import needs a deliberate choice of valid rows.
      setSelected(parsed.errs.length ? [] : parsed.rows.map(row => row.rowNum))
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

  async function suggest(row) {
    const attempt = generation.current
    setSuggestions(previous => ({ ...previous, [row.rowNum]: { loading: true } }))
    let value = ''
    try {
      const response = await api.post('/api/categories/suggest/', { question_text: row.question })
      value = response.data.suggested_category || ''
    } catch { /* Category assistance is optional. */ }
    if (attempt === generation.current) setSuggestions(previous => ({ ...previous, [row.rowNum]: { value } }))
  }

  function acceptSuggestion(rowNum, value) {
    setPreview(previous => ({ ...previous, rows: previous.rows.map(row => row.rowNum === rowNum
      ? { ...row, categoryId: null, category: value } : row) }))
    setSuggestions(previous => ({ ...previous, [rowNum]: undefined }))
  }

  const selection = new Set(selected)
  const { rows, errs } = preview
  const unmapped = rows.filter(row => !categoryFor(row, categories) && (scoped || !row.category)).length
  const visibleRows = rows.slice((page - 1) * pageSize, page * pageSize)
  function stage() {
    if (!selected.length || loading) return
    const staged = rows.filter(row => selection.has(row.rowNum)).map(row => {
      const category = categoryFor(row, categories)
      return { ...row, categoryId: category?.id ?? null, category: category?.name || (scoped ? '' : row.category) }
    })
    onStage(staged)
    clearPreview()
  }

  return <section aria-label="Import questions" className="min-w-0 space-y-4 rounded-xl border border-gray-200 p-4 text-sm dark:border-gray-700">
    <p className="text-xs leading-5 text-gray-600 dark:text-gray-300">Review the question text, choices, keys and categories before adding questions to your draft. Save the assessment to apply the draft.</p>
    <div className="flex flex-wrap items-end gap-3">
      <label className="min-w-0 flex-1 text-xs font-semibold">Question import format
        <select ref={formatControl} aria-label="Question import format" className={field} value={format} onChange={event => { setFormat(event.target.value); clearPreview() }}>
          {Object.entries(formats).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select>
      </label>
      <button type="button" className={button} onClick={() => downloadTemplate(format)}>Download template</button>
    </div>
    <p className="text-xs leading-5 text-gray-600 dark:text-gray-300">{help[format]}</p>
    <div className="min-w-0 rounded-xl border border-dashed border-gray-300 p-3 dark:border-gray-700"
      onDragOver={event => event.preventDefault()} onDrop={event => { event.preventDefault(); const file = event.dataTransfer.files[0]; if (file) void readFile(file) }}>
      <label className="block text-xs font-semibold">Question import file
        <input aria-label="Question import file" type="file" className={`${field} mt-1`} accept={format === 'excel' ? '.xlsx,.xls,.csv' : '.txt'}
          onChange={event => { const file = event.target.files?.[0]; event.target.value = ''; if (file) void readFile(file) }} />
      </label>
      {filename && <p className="mt-1 break-words text-xs text-gray-600 dark:text-gray-300">{filename}</p>}
    </div>
    {loading && <p role="status">Reading file…</p>}
    {(rows.length > 0 || errs.length > 0) && <p role="status" className="text-xs text-gray-700 dark:text-gray-200">
      {rows.length + errs.length} reviewed · {rows.length} valid · {errs.length} with errors · {unmapped} unmapped · {selected.length} selected
    </p>}
    {errs.length > 0 && <section aria-label="Import errors" className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-900 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-200">
      <p className="font-semibold">Review import errors</p>
      {rows.length > 0 && <p>Select the valid questions you want to stage. To include the others, correct the file and upload it again.</p>}
      <ul className="mt-2 max-h-48 space-y-2 overflow-y-auto">
        {errs.map(error => <li key={error.rowNum} className="break-words"><strong>{format === 'excel' ? 'Row' : 'Question'} {error.rowNum}{error.line ? ` · line ${error.line}` : ''}</strong>
          {error.question && <p>{error.question}</p>}<p>{error.errors.join(' ')}</p></li>)}
      </ul>
    </section>}
    {rows.length > 0 && <>
      <div className="flex flex-wrap gap-2">
        <button type="button" className={button} onClick={() => setSelected(rows.map(row => row.rowNum))}>Select all valid</button>
        <button type="button" className={button} onClick={() => setSelected([])}>Clear selection</button>
      </div>
      {categories.length > 0 && <div className="flex flex-wrap items-end gap-2">
        <label className="min-w-0 flex-1 basis-44 text-xs font-semibold">Category for selected questions
          <select aria-label="Category for selected questions" className={field} value={bulkCategory} onChange={event => setBulkCategory(event.target.value)}>
            <option value="">Choose a saved category</option>
            {categories.map(category => <option key={category.id} value={category.id}>{category.name}</option>)}
          </select>
        </label>
        <button type="button" className={button} disabled={!bulkCategory || !selected.length} onClick={() => assign(selected, bulkCategory)}>Apply category to selected</button>
      </div>}
      <ol aria-label="Valid questions" className="space-y-2">
        {visibleRows.map(row => <li key={row.rowNum} className="min-w-0 space-y-2 rounded-xl border border-gray-200 p-3 text-xs dark:border-gray-700">
          <label className="flex min-h-10 items-start gap-2 break-words font-semibold">
            <input type="checkbox" className="mt-0.5" aria-label={`Select question ${row.rowNum}`} checked={selection.has(row.rowNum)}
              onChange={event => {
                const checked = event.target.checked
                setSelected(previous => checked ? [...previous, row.rowNum] : previous.filter(number => number !== row.rowNum))
              }} />
            <span className="min-w-0">{row.rowNum}. {row.question}</span>
          </label>
          {row.type === 'identification' ? <p className="break-words">Identification · Key: {row.identAnswer}</p> : <ul className="space-y-1">
            {row.choices.map((choice, index) => choice && <li key={index} className="break-words">{CHOICE_LABELS[index]}. {choice}
              {row.correctIdx === index && <strong className="ml-2 text-green-700 dark:text-green-300">Correct</strong>}
            </li>)}
          </ul>}
          <label className="block font-semibold">Category for question {row.rowNum}
            <select aria-label={`Category for question ${row.rowNum}`} className={field} value={categoryFor(row, categories)?.id ?? ''} onChange={event => assign([row.rowNum], event.target.value)}>
              <option value="">{!scoped && row.category ? `File category: ${row.category}` : 'Unmapped'}</option>
              {categories.map(category => <option key={category.id} value={category.id}>{category.name}</option>)}
            </select>
          </label>
          {scoped && row.category && !categoryFor(row, categories) && <p className="break-words">File category: {row.category}</p>}
          {!scoped && format !== 'aiken' && <div className="flex flex-wrap items-center gap-2">
            <button type="button" className={button} disabled={suggestions[row.rowNum]?.loading} onClick={() => { void suggest(row) }}>
              {suggestions[row.rowNum]?.loading ? 'Looking up category…' : 'Suggest category'}
            </button>
            {suggestions[row.rowNum]?.value && <button type="button" className={button}
              onClick={() => acceptSuggestion(row.rowNum, suggestions[row.rowNum].value)}>Use {suggestions[row.rowNum].value}</button>}
            {suggestions[row.rowNum]?.value === '' && <span>No category suggestion available.</span>}
          </div>}
        </li>)}
      </ol>
      <Pagination total={rows.length} page={page} pageSize={pageSize} onPage={setPage} />
    </>}
    <div className="flex flex-wrap gap-2">
      <button type="button" className={`${button} bg-green-700 text-white hover:bg-green-800 dark:hover:bg-green-800`} disabled={!selected.length || loading} onClick={stage}>
        Add {selected.length} {selected.length === 1 ? 'question' : 'questions'} to draft
      </button>
      <button type="button" className={button} onClick={onCancel}>Cancel import</button>
    </div>
    {unmapped > 0 && <p className="text-xs text-gray-600 dark:text-gray-300">Unmapped questions can stay in a draft. Assign every category before publishing.</p>}
  </section>
}
