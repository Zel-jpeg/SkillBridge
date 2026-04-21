// src/pages/instructor/InstructorUpload.jsx
//
// Assessment Creator — fully wired to the backend.
// Supports: MCQ / True-False / Identification questions
// Publish: POST /api/instructor/assessments/
// Batch:   GET  /api/instructor/batches/  → dropdown selector
// TF-IDF:  POST /api/categories/suggest/  → auto-suggest category
// Upload:  Excel (.xlsx/.csv)  OR  Text (.txt) — both parsed client-side

import { useState }     from 'react'
import { useNavigate }  from 'react-router-dom'
import InstructorNav    from '../../components/instructor/InstructorNav'
import {
  useInstructorUpload,
  formatDraftAge,
  QUESTION_TYPES,
} from '../../hooks/instructor/useInstructorUpload'

const CHOICE_LABELS = ['A', 'B', 'C', 'D']

// ── Tiny inline icons ─────────────────────────────────────────────
const CheckIcon   = () => <svg width="12" height="12" viewBox="0 0 24 24" fill="none"><path d="M20 6L9 17l-5-5" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
const SparkleIcon = () => <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2l1.5 4.5L18 8l-4.5 1.5L12 14l-1.5-4.5L6 8l4.5-1.5L12 2z"/></svg>

// ── Question type badge colors ────────────────────────────────────
const TYPE_COLORS = {
  mcq:            'bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300',
  truefalse:      'bg-purple-100 dark:bg-purple-900 text-purple-700 dark:text-purple-300',
  identification: 'bg-amber-100 dark:bg-amber-900 text-amber-700 dark:text-amber-300',
}
const TYPE_LABELS = { mcq: 'MCQ', truefalse: 'T/F', identification: 'IDENT' }

// ── Upload preview table ──────────────────────────────────────────
function PreviewTable({ rows }) {
  return (
    <div className="border border-gray-100 dark:border-gray-800 rounded-xl overflow-hidden">
      <div className="overflow-x-auto max-h-64">
        <table className="w-full text-xs">
          <thead className="sticky top-0">
            <tr className="bg-gray-50 dark:bg-gray-800 border-b border-gray-100 dark:border-gray-800">
              {['#','Question','Type','Answer','Category'].map(h => (
                <th key={h} className="px-3 py-2.5 text-left text-gray-500 dark:text-gray-400 font-semibold">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i} className={`border-b border-gray-50 dark:border-gray-800 last:border-0 ${i % 2 !== 0 ? 'bg-gray-50/50 dark:bg-gray-800/30' : ''}`}>
                <td className="px-3 py-2 text-gray-400 dark:text-gray-600">{i + 1}</td>
                <td className="px-3 py-2 text-gray-900 dark:text-white max-w-[200px] truncate">{r.question}</td>
                <td className="px-3 py-2">
                  <span className={`font-semibold px-2 py-0.5 rounded-full ${TYPE_COLORS[r.type]}`}>
                    {TYPE_LABELS[r.type]}
                  </span>
                </td>
                <td className="px-3 py-2 text-green-700 dark:text-green-300 font-semibold max-w-[120px] truncate">
                  {r.type === 'identification'
                    ? r.identAnswer
                    : r.type === 'truefalse'
                    ? (r.correctIdx === 0 ? 'True' : 'False')
                    : CHOICE_LABELS[r.correctIdx]}
                </td>
                <td className="px-3 py-2 text-gray-500 dark:text-gray-400">{r.category}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ── Upload error list ─────────────────────────────────────────────
function UploadErrors({ errors }) {
  if (!errors.length) return null
  return (
    <div className="bg-red-50 dark:bg-red-950/40 border border-red-100 dark:border-red-900 rounded-xl px-4 py-3 flex flex-col gap-1.5">
      <p className="text-xs font-semibold text-red-700 dark:text-red-300">
        {errors.length} row{errors.length > 1 ? 's' : ''} with issues (skipped):
      </p>
      {errors.map((e, i) => (
        <p key={i} className="text-xs text-red-600 dark:text-red-400">
          Row {e.rowNum}: {e.errors.join(' · ')}
        </p>
      ))}
    </div>
  )
}

// ════════════════════════════════════════════════════════════════
// MAIN PAGE
// ════════════════════════════════════════════════════════════════
export default function InstructorUpload() {
  const navigate = useNavigate()

  const cachedUser = (() => { try { return JSON.parse(localStorage.getItem('sb-user')) } catch { return null } })()
  const instructor = {
    name:     cachedUser?.name    || 'Instructor',
    initials: (cachedUser?.name || 'IN').split(' ').map(n => n[0]).slice(0, 2).join(''),
    subject:  cachedUser?.course  || 'OJT Coordinator',
  }

  const {
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
    // Validation / publish
    errors, setErrors,
    published, publishedId, publishing, publishError,
    handlePublish, resetForm,
    // Derived
    countPerCat, totalTagged, totalAnswered, countByType,
  } = useInstructorUpload()

  // ── Published success screen ──────────────────────────────────
  if (published) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
        <InstructorNav instructor={instructor} activePath="/instructor/assessment/create" />
        <div className="max-w-md mx-auto px-4 py-20 flex flex-col items-center gap-5 text-center">
          <div className="w-16 h-16 bg-green-100 dark:bg-green-900 rounded-2xl flex items-center justify-center">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
              <path d="M9 12l2 2 4-4" stroke="#16a34a" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
              <circle cx="12" cy="12" r="9" stroke="#16a34a" strokeWidth="2"/>
            </svg>
          </div>
          <div>
            <h2 className="text-lg font-bold text-gray-900 dark:text-white">Assessment published!</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              Your assessment is now active{selectedBatchId ? ' for the selected batch' : ''}.
              {publishedId && <span className="text-xs text-gray-400 dark:text-gray-600 ml-1">(ID: {publishedId})</span>}
            </p>
          </div>
          <div className="flex gap-3 w-full">
            <button onClick={() => navigate('/instructor/students')}
              className="flex-1 py-3 rounded-xl border border-gray-200 dark:border-gray-700 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
              View students
            </button>
            <button onClick={resetForm}
              className="flex-1 py-3 rounded-xl bg-green-600 hover:bg-green-700 text-white text-sm font-semibold transition-colors">
              Create another
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      <InstructorNav instructor={instructor} activePath="/instructor/assessment/create" />

      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-6 sm:py-8 flex flex-col gap-6">

        {/* Draft restore banner */}
        {draftBanner && (
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 rounded-2xl px-4 py-3.5">
            <div className="flex items-center gap-2.5 flex-1 min-w-0">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" className="text-amber-600 dark:text-amber-400 shrink-0">
                <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-amber-800 dark:text-amber-300">Unsaved draft found</p>
                <p className="text-xs text-amber-600 dark:text-amber-500 truncate">
                  Saved {formatDraftAge(draftBanner.savedAt)}
                  {draftBanner.title ? ` · "${draftBanner.title}"` : ''}
                  {draftBanner.questions?.length ? ` · ${draftBanner.questions.length} question${draftBanner.questions.length > 1 ? 's' : ''}` : ''}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button onClick={handleDiscardDraft} className="text-xs font-medium text-amber-600 dark:text-amber-400 hover:text-amber-800 dark:hover:text-amber-200 transition-colors px-3 py-1.5 rounded-lg hover:bg-amber-100 dark:hover:bg-amber-900">Discard</button>
              <button onClick={handleRestoreDraft} className="text-xs font-semibold bg-amber-600 hover:bg-amber-700 text-white px-3 py-1.5 rounded-lg transition-colors">Restore draft</button>
            </div>
          </div>
        )}

        {/* Back + header */}
        <button onClick={() => navigate('/instructor/dashboard')}
          className="inline-flex items-center gap-1.5 text-sm text-gray-400 dark:text-gray-500 hover:text-gray-700 dark:hover:text-gray-200 transition-colors group w-fit -mb-2">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" className="transition-transform group-hover:-translate-x-0.5">
            <path d="M19 12H5M12 5l-7 7 7 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          Dashboard
        </button>

        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold text-gray-900 dark:text-white">New assessment</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">Build a skill assessment for your students.</p>
          </div>
          <div className="hidden sm:flex items-center gap-2 shrink-0">
            {lastSaved && (
              <span className="text-xs text-gray-400 dark:text-gray-500 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-green-500 inline-block" />
                Saved {formatDraftAge(lastSaved)}
              </span>
            )}
            <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${totalTagged === questions.length && questions.length > 0 ? 'bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300' : 'bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400'}`}>
              {totalTagged}/{questions.length} tagged
            </span>
            <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${totalAnswered === questions.length && questions.length > 0 ? 'bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300' : 'bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400'}`}>
              {totalAnswered}/{questions.length} answered
            </span>
          </div>
        </div>

        {/* ── SECTION 1: Assessment Details ── */}
        <div className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-2xl p-6 flex flex-col gap-5">
          <p className="text-sm font-semibold text-gray-900 dark:text-white">Assessment details</p>

          {/* Title */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Title</label>
            <input type="text" value={title}
              onChange={e => { setTitle(e.target.value); setErrors(er => ({ ...er, title: '' })) }}
              placeholder="e.g. BSIT OJT Skills Assessment 2025–2026"
              className={`w-full px-4 py-3 rounded-xl border text-sm outline-none transition-colors bg-white dark:bg-gray-800 text-gray-900 dark:text-white ${errors.title ? 'border-red-400' : 'border-gray-200 dark:border-gray-700 focus:border-green-500'}`} />
            {errors.title && <p className="text-xs text-red-500 mt-1.5">{errors.title}</p>}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Duration */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Time limit (minutes)</label>
              <div className="relative">
                <input type="number" value={duration} min={1}
                  onChange={e => { setDuration(e.target.value); setErrors(er => ({ ...er, duration: '' })) }}
                  placeholder="e.g. 60"
                  className={`w-full px-4 py-3 rounded-xl border text-sm outline-none transition-colors bg-white dark:bg-gray-800 text-gray-900 dark:text-white pr-12 ${errors.duration ? 'border-red-400' : 'border-gray-200 dark:border-gray-700 focus:border-green-500'}`} />
                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm text-gray-400 dark:text-gray-500 pointer-events-none">min</span>
              </div>
              {errors.duration && <p className="text-xs text-red-500 mt-1.5">{errors.duration}</p>}
            </div>

            {/* Batch selector */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                Assign to batch
                <span className="text-gray-400 dark:text-gray-600 font-normal ml-1.5">(optional)</span>
              </label>
              {loadingBatches ? (
                <div className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-xs text-gray-400 animate-pulse">
                  Loading batches…
                </div>
              ) : batches.length === 0 ? (
                <div className="w-full px-4 py-3 rounded-xl border border-dashed border-gray-200 dark:border-gray-700 text-xs text-gray-400 dark:text-gray-600">
                  No batches yet —{' '}
                  <button onClick={() => navigate('/instructor/students')} className="text-green-600 dark:text-green-400 hover:underline">
                    create one first
                  </button>
                </div>
              ) : (
                <select
                  value={selectedBatchId ?? ''}
                  onChange={e => setSelectedBatchId(e.target.value ? Number(e.target.value) : null)}
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-white outline-none focus:border-green-500 transition-colors cursor-pointer"
                >
                  <option value="">— No batch assigned —</option>
                  {batches.map(b => (
                    <option key={b.id} value={b.id}>
                      {b.name}{b.status === 'archived' ? ' (Archived)' : ' ★'}
                    </option>
                  ))}
                </select>
              )}
              {selectedBatchId && (
                <p className="text-xs text-green-600 dark:text-green-400 mt-1.5 flex items-center gap-1">
                  <CheckIcon /> Students in this batch will see the assessment
                </p>
              )}
            </div>
          </div>
        </div>

        {/* ── SECTION 2: Skill Categories ── */}
        <div className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-2xl p-6 flex flex-col gap-4">
          <div>
            <p className="text-sm font-semibold text-gray-900 dark:text-white">Skill categories</p>
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
              Define the skill areas this assessment will measure. The system will suggest categories as you type questions.
            </p>
          </div>
          <div className="flex gap-2">
            <input ref={catRef} type="text" value={catInput}
              onChange={e => { setCatInput(e.target.value); setErrors(er => ({ ...er, catDupe: '', categories: '' })) }}
              onKeyDown={e => e.key === 'Enter' && addCategory()}
              placeholder="e.g. Web Development"
              className={`flex-1 px-4 py-2.5 rounded-xl border text-sm outline-none transition-colors bg-white dark:bg-gray-800 text-gray-900 dark:text-white ${errors.catDupe ? 'border-red-400' : 'border-gray-200 dark:border-gray-700 focus:border-green-500'}`} />
            <button onClick={addCategory} className="px-4 py-2.5 bg-green-600 hover:bg-green-700 text-white text-sm font-medium rounded-xl transition-colors shrink-0">Add</button>
          </div>
          {errors.catDupe    && <p className="text-xs text-red-500 -mt-2">{errors.catDupe}</p>}
          {errors.categories && <p className="text-xs text-red-500 -mt-2">{errors.categories}</p>}
          {categories.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {categories.map(cat => {
                const count = questions.filter(q => q.categoryId === cat.id).length
                return (
                  <div key={cat.id} className="inline-flex items-center gap-1.5 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 text-xs font-medium px-3 py-1.5 rounded-full">
                    <span>{cat.name}</span>
                    {count > 0 && <span className="bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300 text-xs font-semibold px-1.5 py-0.5 rounded-full">{count}</span>}
                    <button onClick={() => removeCategory(cat.id)} className="ml-0.5 text-gray-400 dark:text-gray-500 hover:text-red-500 dark:hover:text-red-400 transition-colors leading-none">×</button>
                  </div>
                )
              })}
            </div>
          ) : (
            <p className="text-xs text-gray-400 dark:text-gray-600 italic">No categories yet. Add at least one before publishing.</p>
          )}
        </div>

        {/* ── SECTION 3: Questions ── */}
        <div className="flex flex-col gap-4">
          {/* Section header + mode tabs */}
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <p className="text-sm font-semibold text-gray-900 dark:text-white">
              Questions
              <span className="text-gray-400 dark:text-gray-600 font-normal ml-1">({questions.length})</span>
              {/* Type breakdown badges */}
              {questions.length > 0 && (
                <span className="ml-2 inline-flex items-center gap-1">
                  {countByType.mcq > 0 && <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${TYPE_COLORS.mcq}`}>{countByType.mcq} MCQ</span>}
                  {countByType.truefalse > 0 && <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${TYPE_COLORS.truefalse}`}>{countByType.truefalse} T/F</span>}
                  {countByType.identification > 0 && <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${TYPE_COLORS.identification}`}>{countByType.identification} IDENT</span>}
                </span>
              )}
            </p>
            <div className="flex items-center gap-0 bg-gray-100 dark:bg-gray-800 rounded-xl p-1">
              {[{ key: 'manual', label: 'Manual entry' }, { key: 'upload', label: 'Upload file' }].map(m => (
                <button key={m.key} onClick={() => setQuestionMode(m.key)}
                  className={`px-3.5 py-1.5 rounded-lg text-xs font-medium transition-colors ${questionMode === m.key ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm' : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'}`}>
                  {m.label}
                </button>
              ))}
            </div>
          </div>

          {errors.questions && <p className="text-xs text-red-500">{errors.questions}</p>}

          {/* ── UPLOAD PANEL ── */}
          {questionMode === 'upload' && (
            <div className="flex flex-col gap-4">

              {/* Tab: Excel vs Text */}
              <div className="flex gap-0 bg-gray-100 dark:bg-gray-800 rounded-xl p-1 w-fit">
                {/* We'll use a simple local toggle here */}
                <UploadTabPanel
                  xlsxRef={xlsxRef}
                  xlsxRows={xlsxRows} xlsxErrors={xlsxErrors}
                  xlsxFileName={xlsxFileName} xlsxLoading={xlsxLoading} xlsxImported={xlsxImported}
                  parseExcelQuestions={parseExcelQuestions}
                  importExcelQuestions={importExcelQuestions}
                  downloadExcelTemplate={downloadExcelTemplate}
                  txtRef={txtRef}
                  txtRows={txtRows} txtErrors={txtErrors}
                  txtFileName={txtFileName} txtLoading={txtLoading} txtImported={txtImported}
                  parseTxtFile={parseTxtFile}
                  importTxtQuestions={importTxtQuestions}
                  downloadTextTemplate={downloadTextTemplate}
                />
              </div>
            </div>
          )}

          {/* ── QUESTION CARDS ── */}
          {questions.map((q, idx) => {
            const hasError   = Object.keys(errors).some(k => k.startsWith(`q_${q.id}_`))
            const catName    = categories.find(c => c.id === q.categoryId)?.name
            const suggestion = suggestions[q.id]
            // Don't show suggestion if already tagged with that category
            const showSuggestion = suggestion && !catName

            return (
              <div key={q.id}
                className={`bg-white dark:bg-gray-900 border rounded-2xl overflow-hidden transition-colors ${hasError ? 'border-red-300 dark:border-red-700' : 'border-gray-100 dark:border-gray-800'}`}>

                {/* Card header (click to expand/collapse) */}
                <div className="flex items-center gap-3 px-5 py-4 cursor-pointer select-none hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
                  onClick={() => toggleExpand(q.id)}>
                  <div className="w-6 h-6 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center text-xs font-semibold text-gray-500 dark:text-gray-400 shrink-0">{idx + 1}</div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className={`text-sm truncate ${q.text ? 'text-gray-900 dark:text-white' : 'text-gray-400 dark:text-gray-600 italic'}`}>
                        {q.text || 'No question text yet…'}
                      </p>
                      <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full shrink-0 ${TYPE_COLORS[q.type]}`}>
                        {TYPE_LABELS[q.type]}
                      </span>
                      {q.source === 'upload' && <span className="text-[10px] font-medium bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 px-2 py-0.5 rounded-full shrink-0">Upload</span>}
                    </div>
                    {!q.expanded && (
                      <div className="flex items-center gap-2 mt-0.5">
                        {catName && <span className="text-xs text-gray-400 dark:text-gray-500">{catName}</span>}
                        {q.type === 'identification' && q.identAnswer && (
                          <span className="text-xs text-green-600 dark:text-green-400">· Answer: {q.identAnswer}</span>
                        )}
                        {q.type !== 'identification' && q.correct !== null && (
                          <span className="text-xs text-green-600 dark:text-green-400">
                            · Correct: {q.type === 'truefalse' ? (q.correct === 0 ? 'True' : 'False') : CHOICE_LABELS[q.correct]}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    {hasError && <span className="w-1.5 h-1.5 rounded-full bg-red-400 inline-block" title="Has errors" />}
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" className={`text-gray-400 dark:text-gray-600 transition-transform ${q.expanded ? 'rotate-180' : ''}`}>
                      <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </div>
                </div>

                {/* Expanded body */}
                {q.expanded && (
                  <div className="px-5 pb-5 flex flex-col gap-4 border-t border-gray-50 dark:border-gray-800 pt-4">

                    {/* Question type selector */}
                    <div>
                      <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-2 uppercase tracking-wide">Question type</label>
                      <div className="flex gap-2 flex-wrap">
                        {QUESTION_TYPES.map(qt => (
                          <button key={qt.value}
                            onClick={() => changeQuestionType(q.id, qt.value)}
                            className={`px-3.5 py-2 rounded-xl text-xs font-semibold border transition-all ${q.type === qt.value
                              ? `${TYPE_COLORS[qt.value]} border-current`
                              : 'border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400 hover:border-gray-300 dark:hover:border-gray-600'}`}>
                            {qt.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Question text */}
                    <div>
                      <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5 uppercase tracking-wide">Question</label>
                      <textarea value={q.text}
                        onChange={e => updateQuestion(q.id, 'text', e.target.value)}
                        placeholder="Type the question here…" rows={2}
                        className={`w-full px-4 py-3 rounded-xl border text-sm outline-none transition-colors bg-white dark:bg-gray-800 text-gray-900 dark:text-white resize-none ${errors[`q_${q.id}_text`] ? 'border-red-400' : 'border-gray-200 dark:border-gray-700 focus:border-green-500'}`} />
                      {errors[`q_${q.id}_text`] && <p className="text-xs text-red-500 mt-1">{errors[`q_${q.id}_text`]}</p>}

                      {/* TF-IDF suggestion chip */}
                      {showSuggestion && (
                        <div className="mt-2 flex items-center gap-2">
                          <span className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1">
                            <SparkleIcon /> Suggested category:
                          </span>
                          <button
                            onClick={() => applySuggestion(q.id, suggestion)}
                            className="text-xs font-semibold bg-green-50 dark:bg-green-950 text-green-700 dark:text-green-300 border border-green-200 dark:border-green-800 px-2.5 py-1 rounded-full hover:bg-green-100 dark:hover:bg-green-900 transition-colors">
                            + {suggestion}
                          </button>
                          <button
                            onClick={() => dismissSuggestion(q.id)}
                            className="text-xs text-gray-400 dark:text-gray-600 hover:text-gray-600 dark:hover:text-gray-400 transition-colors">
                            Dismiss
                          </button>
                        </div>
                      )}
                    </div>

                    {/* ── MCQ: choice inputs ── */}
                    {q.type === 'mcq' && (
                      <div>
                        <div className="flex items-center justify-between mb-1.5">
                          <label className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">Answer choices</label>
                          <span className="text-xs text-gray-400 dark:text-gray-600">Click a letter to mark correct</span>
                        </div>
                        <div className="flex flex-col gap-2">
                          {q.choices.map((choice, ci) => (
                            <div key={ci} className="flex items-center gap-2">
                              <button onClick={() => setCorrect(q.id, ci)}
                                className={`w-7 h-7 rounded-lg text-xs font-bold shrink-0 transition-colors border ${q.correct === ci ? 'bg-green-600 border-green-600 text-white' : 'border-gray-200 dark:border-gray-700 text-gray-400 dark:text-gray-500 hover:border-green-400 hover:text-green-600 dark:hover:text-green-400'}`}>
                                {CHOICE_LABELS[ci]}
                              </button>
                              <input type="text" value={choice}
                                onChange={e => updateChoice(q.id, ci, e.target.value)}
                                placeholder={`Choice ${CHOICE_LABELS[ci]}`}
                                className={`flex-1 px-3 py-2.5 rounded-xl border text-sm outline-none transition-colors bg-white dark:bg-gray-800 text-gray-900 dark:text-white ${q.correct === ci ? 'border-green-400 dark:border-green-600 bg-green-50 dark:bg-green-950' : 'border-gray-200 dark:border-gray-700 focus:border-green-500'}`} />
                            </div>
                          ))}
                        </div>
                        {errors[`q_${q.id}_choices`] && <p className="text-xs text-red-500 mt-1.5">{errors[`q_${q.id}_choices`]}</p>}
                        {errors[`q_${q.id}_correct`] && <p className="text-xs text-red-500 mt-1">{errors[`q_${q.id}_correct`]}</p>}
                      </div>
                    )}

                    {/* ── TRUE/FALSE: two big buttons ── */}
                    {q.type === 'truefalse' && (
                      <div>
                        <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-2 uppercase tracking-wide">Correct answer</label>
                        <div className="flex gap-3">
                          {['True', 'False'].map((label, idx) => (
                            <button key={label}
                              onClick={() => setCorrect(q.id, idx)}
                              className={`flex-1 py-3 rounded-xl border text-sm font-semibold transition-all ${q.correct === idx
                                ? 'bg-green-600 border-green-600 text-white shadow-sm'
                                : 'border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:border-green-400 hover:text-green-600 dark:hover:text-green-400'}`}>
                              {q.correct === idx && <CheckIcon />}{' '}
                              {label}
                            </button>
                          ))}
                        </div>
                        {errors[`q_${q.id}_correct`] && <p className="text-xs text-red-500 mt-1.5">{errors[`q_${q.id}_correct`]}</p>}
                      </div>
                    )}

                    {/* ── IDENTIFICATION: text answer ── */}
                    {q.type === 'identification' && (
                      <div>
                        <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5 uppercase tracking-wide">
                          Correct answer
                          <span className="normal-case font-normal text-gray-400 dark:text-gray-600 ml-1">— case-insensitive, exact match</span>
                        </label>
                        <input
                          type="text"
                          value={q.identAnswer}
                          onChange={e => updateIdentAnswer(q.id, e.target.value)}
                          placeholder="e.g. Central Processing Unit"
                          className={`w-full px-4 py-3 rounded-xl border text-sm outline-none transition-colors bg-white dark:bg-gray-800 text-gray-900 dark:text-white ${errors[`q_${q.id}_identAnswer`] ? 'border-red-400' : 'border-gray-200 dark:border-gray-700 focus:border-green-500'}`}
                        />
                        <p className="text-xs text-gray-400 dark:text-gray-600 mt-1.5">
                          Students will type their answer. Graded as correct if it matches this text (case-insensitive).
                        </p>
                        {errors[`q_${q.id}_identAnswer`] && <p className="text-xs text-red-500 mt-1">{errors[`q_${q.id}_identAnswer`]}</p>}
                      </div>
                    )}

                    {/* Category tag + delete row */}
                    <div className="flex items-end gap-3">
                      <div className="flex-1">
                        <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5 uppercase tracking-wide">Skill category</label>
                        {categories.length === 0 ? (
                          <p className="text-xs text-amber-600 dark:text-amber-400 italic py-2">Add skill categories above first.</p>
                        ) : (
                          <div className="flex flex-wrap gap-1.5">
                            {categories.map(cat => (
                              <button key={cat.id}
                                onClick={() => { updateQuestion(q.id, 'categoryId', cat.id); setErrors(e => ({ ...e, [`q_${q.id}_categoryId`]: '' })) }}
                                className={`text-xs font-medium px-3 py-1.5 rounded-full border transition-colors ${q.categoryId === cat.id ? 'bg-green-600 border-green-600 text-white' : 'border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:border-green-400 hover:text-green-700 dark:hover:text-green-300'}`}>
                                {cat.name}
                              </button>
                            ))}
                          </div>
                        )}
                        {errors[`q_${q.id}_categoryId`] && <p className="text-xs text-red-500 mt-1">{errors[`q_${q.id}_categoryId`]}</p>}
                      </div>
                      {questions.length > 1 && (
                        <button onClick={() => removeQuestion(q.id)} className="text-xs font-medium text-red-500 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950 px-3 py-2 rounded-xl transition-colors shrink-0">Remove</button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )
          })}

          {/* Add question buttons */}
          <div className="flex flex-col sm:flex-row gap-2">
            {QUESTION_TYPES.map(qt => (
              <button key={qt.value}
                onClick={() => addQuestion(qt.value)}
                className="flex-1 py-3 rounded-2xl border-2 border-dashed border-gray-200 dark:border-gray-700 text-xs font-medium text-gray-400 dark:text-gray-500 hover:border-green-400 hover:text-green-600 dark:hover:text-green-400 hover:bg-green-50 dark:hover:bg-green-950/30 transition-colors flex items-center justify-center gap-1.5">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none"><path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"/></svg>
                Add {qt.label}
              </button>
            ))}
          </div>

          {questions.length > 2 && (
            <button
              onClick={() => questions.forEach(q => { q.expanded = false; })}
              className="text-xs text-gray-400 dark:text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 transition-colors self-end">
              Collapse all
            </button>
          )}
        </div>

        {/* ── SECTION 4: Summary + Publish ── */}
        <div className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-2xl p-6 flex flex-col gap-4">
          <p className="text-sm font-semibold text-gray-900 dark:text-white">Summary</p>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: 'Questions',   value: questions.length },
              { label: 'Duration',    value: duration ? `${duration} min` : '—' },
              { label: 'Categories',  value: categories.length },
              { label: 'Batch',       value: batches.find(b => b.id === selectedBatchId)?.name ?? 'None' },
            ].map(stat => (
              <div key={stat.label} className="bg-gray-50 dark:bg-gray-800 rounded-xl p-3 text-center">
                <p className="text-xs text-gray-400 dark:text-gray-500 mb-1">{stat.label}</p>
                <p className="text-sm font-bold text-gray-900 dark:text-white truncate">{stat.value}</p>
              </div>
            ))}
          </div>

          {/* Type breakdown */}
          <div className="flex flex-wrap gap-2">
            {Object.entries(countByType).map(([type, count]) => count > 0 ? (
              <span key={type} className={`text-xs font-medium px-2.5 py-1 rounded-full ${TYPE_COLORS[type]}`}>
                {count} {QUESTION_TYPES.find(t => t.value === type)?.label}
              </span>
            ) : null)}
          </div>

          {countPerCat.length > 0 && (
            <div className="flex flex-col gap-2">
              {countPerCat.map(cat => (
                <div key={cat.id} className="flex items-center gap-3">
                  <span className="text-xs text-gray-500 dark:text-gray-400 w-40 truncate">{cat.name}</span>
                  <div className="flex-1 h-1.5 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
                    <div className="h-full bg-green-500 rounded-full transition-all duration-300"
                      style={{ width: questions.length ? `${(cat.count / questions.length) * 100}%` : '0%' }} />
                  </div>
                  <span className="text-xs font-medium text-gray-500 dark:text-gray-400 w-10 text-right">{cat.count}q</span>
                </div>
              ))}
            </div>
          )}

          {/* Publish error */}
          {publishError && (
            <div className="flex items-start gap-2.5 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 rounded-xl px-4 py-3">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2" strokeLinecap="round" className="mt-0.5 shrink-0"><circle cx="12" cy="12" r="9"/><path d="M12 8v4M12 16h.01"/></svg>
              <p className="text-xs text-red-600 dark:text-red-400">{publishError}</p>
            </div>
          )}

          <button
            onClick={handlePublish}
            disabled={publishing}
            className="w-full py-3.5 rounded-xl bg-green-600 hover:bg-green-700 disabled:opacity-60 disabled:cursor-not-allowed text-white text-sm font-semibold transition-colors flex items-center justify-center gap-2">
            {publishing ? (
              <>
                <svg className="animate-spin" width="16" height="16" viewBox="0 0 24 24" fill="none">
                  <circle cx="12" cy="12" r="9" stroke="white" strokeWidth="2" strokeDasharray="42" strokeDashoffset="12"/>
                </svg>
                Publishing…
              </>
            ) : 'Publish assessment'}
          </button>
        </div>

        <div className="h-4" />
      </main>
    </div>
  )
}

// ════════════════════════════════════════════════════════════════
// UploadTabPanel — handles both Excel and Text file uploads
// (extracted to keep the main component clean)
// ════════════════════════════════════════════════════════════════
function UploadTabPanel({
  xlsxRef, xlsxRows, xlsxErrors, xlsxFileName, xlsxLoading, xlsxImported,
  parseExcelQuestions, importExcelQuestions, downloadExcelTemplate,
  txtRef, txtRows, txtErrors, txtFileName, txtLoading, txtImported,
  parseTxtFile, importTxtQuestions, downloadTextTemplate,
}) {
  const [tab, setTab] = useState('excel')

  return (
    <div className="w-full flex flex-col gap-0">
      {/* Sub-tabs */}
      <div className="flex gap-0 bg-gray-100 dark:bg-gray-800 rounded-xl p-1 w-fit mb-4">
        {[{ key: 'excel', label: '📊 Excel / CSV' }, { key: 'text', label: '📄 Text file (.txt)' }].map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-medium transition-colors ${tab === t.key ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm' : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'}`}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Excel tab */}
      {tab === 'excel' && (
        <div className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-2xl p-6 flex flex-col gap-4">
          {/* Template download */}
          <div className="flex items-center justify-between bg-blue-50 dark:bg-blue-950/40 border border-blue-100 dark:border-blue-900 rounded-xl px-4 py-3">
            <div>
              <p className="text-xs font-semibold text-blue-700 dark:text-blue-300">Download the template first</p>
              <p className="text-xs text-blue-500 dark:text-blue-400 mt-0.5">
                Columns: <code className="font-mono">question, type, choice_a–d, correct, category</code>
                <br />
                <span className="opacity-70">type can be: <strong>mcq</strong>, <strong>truefalse</strong>, or <strong>identification</strong></span>
              </p>
            </div>
            <button onClick={downloadExcelTemplate} className="text-xs font-semibold text-blue-700 dark:text-blue-300 hover:underline shrink-0 ml-3">Download ↓</button>
          </div>

          {/* Drop zone */}
          <div
            onDragOver={e => e.preventDefault()}
            onDrop={e => { e.preventDefault(); const f = e.dataTransfer?.files?.[0]; if (f) parseExcelQuestions(f) }}
            onClick={() => xlsxRef.current?.click()}
            className="border-2 border-dashed border-gray-200 dark:border-gray-700 rounded-2xl p-8 flex flex-col items-center gap-3 cursor-pointer hover:border-green-400 hover:bg-green-50 dark:hover:bg-green-950/20 transition-colors">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" className="text-gray-300 dark:text-gray-700">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              <polyline points="14 2 14 8 20 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              <line x1="12" y1="18" x2="12" y2="12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
              <polyline points="9 15 12 12 15 15" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            <div className="text-center">
              <p className="text-sm font-medium text-gray-600 dark:text-gray-300">{xlsxFileName || 'Drop your .xlsx or .csv here'}</p>
              <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">or click to browse</p>
            </div>
            <input ref={xlsxRef} type="file" accept=".xlsx,.xls,.csv" className="hidden"
              onChange={e => { if (e.target.files?.[0]) parseExcelQuestions(e.target.files[0]) }} />
          </div>

          {xlsxLoading && <p className="text-xs text-gray-400 dark:text-gray-500 text-center animate-pulse">Parsing file…</p>}
          <UploadErrors errors={xlsxErrors} />

          {xlsxRows.length > 0 && (
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold text-gray-700 dark:text-gray-300">{xlsxRows.length} question{xlsxRows.length > 1 ? 's' : ''} ready to import:</p>
                {xlsxImported && (
                  <span className="text-xs font-medium text-green-600 dark:text-green-400 flex items-center gap-1"><CheckIcon /> Imported</span>
                )}
              </div>
              <PreviewTable rows={xlsxRows} />
              {!xlsxImported && (
                <button onClick={importExcelQuestions}
                  className="w-full py-3 rounded-xl bg-green-600 hover:bg-green-700 text-white text-sm font-semibold transition-colors">
                  Import {xlsxRows.length} question{xlsxRows.length > 1 ? 's' : ''}
                </button>
              )}
              {xlsxImported && (
                <p className="text-xs text-center text-gray-400 dark:text-gray-500">Questions added below. Switch to <strong>Manual entry</strong> to review or edit.</p>
              )}
            </div>
          )}
        </div>
      )}

      {/* Text file tab */}
      {tab === 'text' && (
        <div className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-2xl p-6 flex flex-col gap-4">
          {/* Template download */}
          <div className="flex items-center justify-between bg-amber-50 dark:bg-amber-950/40 border border-amber-100 dark:border-amber-900 rounded-xl px-4 py-3">
            <div>
              <p className="text-xs font-semibold text-amber-700 dark:text-amber-300">Download the .txt template first</p>
              <p className="text-xs text-amber-600 dark:text-amber-500 mt-0.5">
                One question per block, separated by <code className="font-mono">---</code>
                <br/>
                <span className="opacity-70">Fields: <strong>QUESTION</strong>, <strong>TYPE</strong>, <strong>A–D</strong>, <strong>CORRECT</strong>, <strong>CATEGORY</strong></span>
              </p>
            </div>
            <button onClick={downloadTextTemplate} className="text-xs font-semibold text-amber-700 dark:text-amber-300 hover:underline shrink-0 ml-3">Download ↓</button>
          </div>

          {/* Example snippet */}
          <div className="bg-gray-900 dark:bg-black rounded-xl p-4 font-mono text-xs leading-relaxed overflow-x-auto">
            <p className="text-gray-500"># mcq example</p>
            <p className="text-green-400">QUESTION: What does HTML stand for?</p>
            <p className="text-blue-300">TYPE: mcq</p>
            <p className="text-gray-300">A: HyperText Markup Language</p>
            <p className="text-gray-300">B: High Text Machine Language</p>
            <p className="text-amber-300">CORRECT: A</p>
            <p className="text-purple-300">CATEGORY: Web Development</p>
            <p className="text-gray-600 mt-1">---</p>
            <p className="text-gray-500 mt-1"># identification example</p>
            <p className="text-green-400">QUESTION: What does CPU stand for?</p>
            <p className="text-blue-300">TYPE: identification</p>
            <p className="text-amber-300">CORRECT: Central Processing Unit</p>
            <p className="text-purple-300">CATEGORY: Hardware</p>
          </div>

          {/* Drop zone */}
          <div
            onDragOver={e => e.preventDefault()}
            onDrop={e => { e.preventDefault(); const f = e.dataTransfer?.files?.[0]; if (f) parseTxtFile(f) }}
            onClick={() => txtRef.current?.click()}
            className="border-2 border-dashed border-gray-200 dark:border-gray-700 rounded-2xl p-8 flex flex-col items-center gap-3 cursor-pointer hover:border-amber-400 hover:bg-amber-50 dark:hover:bg-amber-950/20 transition-colors">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" className="text-gray-300 dark:text-gray-700">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              <polyline points="14 2 14 8 20 8" stroke="currentColor" strokeWidth="1.5"/>
              <line x1="8" y1="13" x2="16" y2="13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
              <line x1="8" y1="17" x2="14" y2="17" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
            <div className="text-center">
              <p className="text-sm font-medium text-gray-600 dark:text-gray-300">{txtFileName || 'Drop your .txt file here'}</p>
              <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">or click to browse</p>
            </div>
            <input ref={txtRef} type="file" accept=".txt" className="hidden"
              onChange={e => { if (e.target.files?.[0]) parseTxtFile(e.target.files[0]) }} />
          </div>

          {txtLoading && <p className="text-xs text-gray-400 dark:text-gray-500 text-center animate-pulse">Parsing file…</p>}
          <UploadErrors errors={txtErrors} />

          {txtRows.length > 0 && (
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold text-gray-700 dark:text-gray-300">{txtRows.length} question{txtRows.length > 1 ? 's' : ''} ready to import:</p>
                {txtImported && (
                  <span className="text-xs font-medium text-green-600 dark:text-green-400 flex items-center gap-1"><CheckIcon /> Imported</span>
                )}
              </div>
              <PreviewTable rows={txtRows} />
              {!txtImported && (
                <button onClick={importTxtQuestions}
                  className="w-full py-3 rounded-xl bg-green-600 hover:bg-green-700 text-white text-sm font-semibold transition-colors">
                  Import {txtRows.length} question{txtRows.length > 1 ? 's' : ''}
                </button>
              )}
              {txtImported && (
                <p className="text-xs text-center text-gray-400 dark:text-gray-500">Questions added below. Switch to <strong>Manual entry</strong> to review or edit.</p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}