// src/pages/instructor/InstructorUpload.jsx  (SLIMMED — 1128 → ~500 lines, logic now in hook)
// All data + logic now in useInstructorUpload.js
// InstructorNav now imported from components/instructor/

import { useNavigate } from 'react-router-dom'
import InstructorNav from '../../components/instructor/InstructorNav'
import { useInstructorUpload, formatDraftAge } from '../../hooks/instructor/useInstructorUpload'

const CHOICE_LABELS = ['A', 'B', 'C', 'D']

export default function InstructorUpload() {
  const navigate = useNavigate()

  // Instructor info from localStorage
  const cachedUser = (() => { try { return JSON.parse(localStorage.getItem('sb-user')) } catch { return null } })()
  const instructor = {
    name:     cachedUser?.name    || 'Instructor',
    initials: (cachedUser?.name || 'IN').split(' ').map(n => n[0]).slice(0, 2).join(''),
    subject:  cachedUser?.course  || 'OJT Coordinator',
  }

  const {
    title, setTitle, duration, setDuration,
    categories, catInput, setCatInput, catRef,
    addCategory, removeCategory,
    questions, questionMode, setQuestionMode,
    addQuestion, removeQuestion, toggleExpand,
    updateQuestion, updateChoice, setCorrect,
    xlsxRef, xlsxRows, xlsxErrors, xlsxFileName, xlsxLoading, xlsxImported,
    parseExcelQuestions, importExcelQuestions, downloadQuestionsTemplate,
    draftBanner, lastSaved, handleRestoreDraft, handleDiscardDraft,
    errors, setErrors, published, handlePublish,
    countPerCat, totalTagged, totalCorrect,
  } = useInstructorUpload()

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      <InstructorNav instructor={instructor} activePath="/instructor/assessment/create" />

      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-6 sm:py-8 flex flex-col gap-6">

        {/* Draft restore banner */}
        {draftBanner && (
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 rounded-2xl px-4 py-3.5">
            <div className="flex items-center gap-2.5 flex-1 min-w-0">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" className="text-amber-600 dark:text-amber-400 shrink-0"><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
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

        {/* Back */}
        <button onClick={() => navigate('/instructor/dashboard')}
          className="inline-flex items-center gap-1.5 text-sm text-gray-400 dark:text-gray-500 hover:text-gray-700 dark:hover:text-gray-200 transition-colors group w-fit -mb-2">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" className="transition-transform group-hover:-translate-x-0.5"><path d="M19 12H5M12 5l-7 7 7 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
          Dashboard
        </button>

        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold text-gray-900 dark:text-white">New assessment</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">Build a skill assessment for your students.</p>
          </div>
          <div className="hidden sm:flex items-center gap-2 shrink-0">
            {lastSaved && !published && (
              <span className="text-xs text-gray-400 dark:text-gray-500 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-green-500 inline-block" />
                Saved {formatDraftAge(lastSaved)}
              </span>
            )}
            <span className={`text-xs font-medium px-2.5 py-1 rounded-full transition-colors ${totalTagged === questions.length && questions.length > 0 ? 'bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300' : 'bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400'}`}>
              {totalTagged}/{questions.length} tagged
            </span>
            <span className={`text-xs font-medium px-2.5 py-1 rounded-full transition-colors ${totalCorrect === questions.length && questions.length > 0 ? 'bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300' : 'bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400'}`}>
              {totalCorrect}/{questions.length} answered
            </span>
          </div>
        </div>

        {/* ── SECTION 1: Assessment Details ── */}
        <div className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-2xl p-6 flex flex-col gap-5">
          <p className="text-sm font-semibold text-gray-900 dark:text-white">Assessment details</p>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Title</label>
            <input type="text" value={title} onChange={e => { setTitle(e.target.value); setErrors(er => ({ ...er, title: '' })) }}
              placeholder="e.g. BSIT OJT Skills Assessment 2025–2026"
              className={`w-full px-4 py-3 rounded-xl border text-sm outline-none transition-colors bg-white dark:bg-gray-800 text-gray-900 dark:text-white ${errors.title ? 'border-red-400' : 'border-gray-200 dark:border-gray-700 focus:border-green-500'}`} />
            {errors.title && <p className="text-xs text-red-500 mt-1.5">{errors.title}</p>}
          </div>
          <div className="max-w-xs">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Time limit (minutes)</label>
            <div className="relative">
              <input type="number" value={duration} min={1} onChange={e => { setDuration(e.target.value); setErrors(er => ({ ...er, duration: '' })) }}
                placeholder="e.g. 60"
                className={`w-full px-4 py-3 rounded-xl border text-sm outline-none transition-colors bg-white dark:bg-gray-800 text-gray-900 dark:text-white pr-20 ${errors.duration ? 'border-red-400' : 'border-gray-200 dark:border-gray-700 focus:border-green-500'}`} />
              <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm text-gray-400 dark:text-gray-500 pointer-events-none">min</span>
            </div>
            {errors.duration && <p className="text-xs text-red-500 mt-1.5">{errors.duration}</p>}
          </div>
        </div>

        {/* ── SECTION 2: Skill Categories ── */}
        <div className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-2xl p-6 flex flex-col gap-4">
          <div>
            <p className="text-sm font-semibold text-gray-900 dark:text-white">Skill categories</p>
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
              Define the skill areas this assessment will measure. Questions will be tagged to these.
              {questionMode === 'excel' && <span className="ml-1 text-blue-500 dark:text-blue-400">Categories found in your Excel file will be added automatically on import.</span>}
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
                    <button onClick={() => removeCategory(cat.id)} className="ml-0.5 text-gray-400 dark:text-gray-500 hover:text-red-500 dark:hover:text-red-400 transition-colors leading-none" title="Remove category">×</button>
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
            <p className="text-sm font-semibold text-gray-900 dark:text-white">Questions <span className="text-gray-400 dark:text-gray-600 font-normal">({questions.length})</span></p>
            <div className="flex items-center gap-0 bg-gray-100 dark:bg-gray-800 rounded-xl p-1">
              {[{ key: 'manual', label: 'Manual entry' }, { key: 'excel', label: 'Upload Excel' }].map(m => (
                <button key={m.key} onClick={() => setQuestionMode(m.key)}
                  className={`px-3.5 py-1.5 rounded-lg text-xs font-medium transition-colors ${questionMode === m.key ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm' : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'}`}>
                  {m.label}
                </button>
              ))}
            </div>
          </div>

          {errors.questions && <p className="text-xs text-red-500">{errors.questions}</p>}

          {/* Excel upload panel */}
          {questionMode === 'excel' && (
            <div className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-2xl p-6 flex flex-col gap-4">
              {/* Template download */}
              <div className="flex items-center justify-between bg-blue-50 dark:bg-blue-950/40 border border-blue-100 dark:border-blue-900 rounded-xl px-4 py-3">
                <div>
                  <p className="text-xs font-semibold text-blue-700 dark:text-blue-300">Download the template first</p>
                  <p className="text-xs text-blue-500 dark:text-blue-400 mt-0.5">Columns: <code className="font-mono">question, type, choice_a–d, correct, category</code></p>
                </div>
                <button onClick={downloadQuestionsTemplate} className="text-xs font-semibold text-blue-700 dark:text-blue-300 hover:underline shrink-0">Download ↓</button>
              </div>
              {/* Drop zone */}
              <div onDragOver={e => e.preventDefault()} onDrop={e => { e.preventDefault(); const f = e.dataTransfer?.files?.[0]; if (f) parseExcelQuestions(f) }}
                onClick={() => xlsxRef.current?.click()}
                className="border-2 border-dashed border-gray-200 dark:border-gray-700 rounded-2xl p-8 flex flex-col items-center gap-3 cursor-pointer hover:border-green-400 hover:bg-green-50 dark:hover:bg-green-950/20 transition-colors">
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" className="text-gray-300 dark:text-gray-700">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  <polyline points="14 2 14 8 20 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  <line x1="12" y1="18" x2="12" y2="12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                  <polyline points="9 15 12 12 15 15" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                <div className="text-center">
                  <p className="text-sm font-medium text-gray-600 dark:text-gray-300">{xlsxFileName ? xlsxFileName : 'Drop your .xlsx or .csv here'}</p>
                  <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">or click to browse</p>
                </div>
                <input ref={xlsxRef} type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={e => { if (e.target.files?.[0]) parseExcelQuestions(e.target.files[0]) }} />
              </div>

              {xlsxLoading && <p className="text-xs text-gray-400 dark:text-gray-500 text-center animate-pulse">Parsing file…</p>}

              {/* Row errors */}
              {xlsxErrors.length > 0 && (
                <div className="bg-red-50 dark:bg-red-950/40 border border-red-100 dark:border-red-900 rounded-xl px-4 py-3 flex flex-col gap-1.5">
                  <p className="text-xs font-semibold text-red-700 dark:text-red-300">{xlsxErrors.length} row{xlsxErrors.length > 1 ? 's' : ''} with issues (skipped):</p>
                  {xlsxErrors.map((e, i) => <p key={i} className="text-xs text-red-600 dark:text-red-400">Row {e.rowNum}: {e.errors.join(' · ')}</p>)}
                </div>
              )}

              {/* Preview table */}
              {xlsxRows.length > 0 && (
                <div className="flex flex-col gap-2">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-semibold text-gray-700 dark:text-gray-300">{xlsxRows.length} question{xlsxRows.length > 1 ? 's' : ''} ready to import:</p>
                    {xlsxImported && (
                      <span className="text-xs font-medium text-green-600 dark:text-green-400 flex items-center gap-1">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none"><path d="M20 6L9 17l-5-5" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                        Imported
                      </span>
                    )}
                  </div>
                  <div className="border border-gray-100 dark:border-gray-800 rounded-xl overflow-hidden">
                    <div className="overflow-x-auto max-h-64">
                      <table className="w-full text-xs">
                        <thead className="sticky top-0">
                          <tr className="bg-gray-50 dark:bg-gray-800 border-b border-gray-100 dark:border-gray-800">
                            {['#', 'Question', 'Type', 'Answer', 'Category'].map(h => <th key={h} className={`${h === '#' ? 'px-3' : 'px-3 min-w-max'} py-2.5 text-left text-gray-500 dark:text-gray-400 font-semibold`}>{h}</th>)}
                          </tr>
                        </thead>
                        <tbody>
                          {xlsxRows.map((r, i) => (
                            <tr key={i} className={`border-b border-gray-50 dark:border-gray-800 last:border-0 ${i % 2 !== 0 ? 'bg-gray-50/50 dark:bg-gray-800/30' : ''}`}>
                              <td className="px-3 py-2 text-gray-400 dark:text-gray-600">{i + 1}</td>
                              <td className="px-3 py-2 text-gray-900 dark:text-white max-w-[200px] truncate">{r.question}</td>
                              <td className="px-3 py-2"><span className={`font-semibold px-2 py-0.5 rounded-full ${r.type === 'truefalse' ? 'bg-purple-100 dark:bg-purple-900 text-purple-700 dark:text-purple-300' : 'bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300'}`}>{r.type === 'truefalse' ? 'T/F' : 'MCQ'}</span></td>
                              <td className="px-3 py-2 text-green-700 dark:text-green-300 font-semibold">{r.type === 'truefalse' ? (r.correctIdx === 0 ? 'True' : 'False') : CHOICE_LABELS[r.correctIdx]}</td>
                              <td className="px-3 py-2 text-gray-500 dark:text-gray-400">{r.category}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                  {!xlsxImported && (
                    <button onClick={importExcelQuestions} className="w-full py-3 rounded-xl bg-green-600 hover:bg-green-700 text-white text-sm font-semibold transition-colors">
                      Import {xlsxRows.length} question{xlsxRows.length > 1 ? 's' : ''} into assessment
                    </button>
                  )}
                  {xlsxImported && (
                    <p className="text-xs text-center text-gray-400 dark:text-gray-500">Questions have been added below. Switch to <strong>Manual entry</strong> to review or edit them.</p>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Question cards */}
          {questions.map((q, idx) => {
            const hasError = Object.keys(errors).some(k => k.startsWith(`q_${q.id}_`))
            const catName  = categories.find(c => c.id === q.categoryId)?.name
            return (
              <div key={q.id} className={`bg-white dark:bg-gray-900 border rounded-2xl overflow-hidden transition-colors ${hasError ? 'border-red-300 dark:border-red-700' : 'border-gray-100 dark:border-gray-800'}`}>
                {/* Header */}
                <div className="flex items-center gap-3 px-5 py-4 cursor-pointer select-none hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors" onClick={() => toggleExpand(q.id)}>
                  <div className="w-6 h-6 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center text-xs font-semibold text-gray-500 dark:text-gray-400 shrink-0">{idx + 1}</div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className={`text-sm truncate ${q.text ? 'text-gray-900 dark:text-white' : 'text-gray-400 dark:text-gray-600 italic'}`}>{q.text || 'No question text yet…'}</p>
                      {q.source === 'excel' && <span className="text-xs font-medium bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 px-2 py-0.5 rounded-full shrink-0">Excel</span>}
                    </div>
                    {!q.expanded && (
                      <div className="flex items-center gap-2 mt-0.5">
                        {catName && <span className="text-xs text-gray-400 dark:text-gray-500">{catName}</span>}
                        {q.correct !== null && <span className="text-xs text-green-600 dark:text-green-400">· Answer: {CHOICE_LABELS[q.correct]}</span>}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    {hasError && <span className="w-1.5 h-1.5 rounded-full bg-red-400 inline-block" title="Has errors" />}
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" className={`text-gray-400 dark:text-gray-600 transition-transform ${q.expanded ? 'rotate-180' : ''}`}><path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                  </div>
                </div>

                {/* Expanded body */}
                {q.expanded && (
                  <div className="px-5 pb-5 flex flex-col gap-4 border-t border-gray-50 dark:border-gray-800 pt-4">
                    {/* Question text */}
                    <div>
                      <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5 uppercase tracking-wide">Question</label>
                      <textarea value={q.text} onChange={e => updateQuestion(q.id, 'text', e.target.value)}
                        placeholder="Type the question here…" rows={2}
                        className={`w-full px-4 py-3 rounded-xl border text-sm outline-none transition-colors bg-white dark:bg-gray-800 text-gray-900 dark:text-white resize-none ${errors[`q_${q.id}_text`] ? 'border-red-400' : 'border-gray-200 dark:border-gray-700 focus:border-green-500'}`} />
                      {errors[`q_${q.id}_text`] && <p className="text-xs text-red-500 mt-1">{errors[`q_${q.id}_text`]}</p>}
                    </div>

                    {/* Answer choices */}
                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <label className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">Answer choices</label>
                        <span className="text-xs text-gray-400 dark:text-gray-600">Click a label to mark correct</span>
                      </div>
                      <div className="flex flex-col gap-2">
                        {q.choices.map((choice, ci) => (
                          <div key={ci} className="flex items-center gap-2">
                            <button onClick={() => setCorrect(q.id, ci)}
                              className={`w-7 h-7 rounded-lg text-xs font-bold shrink-0 transition-colors border ${q.correct === ci ? 'bg-green-600 border-green-600 text-white' : 'border-gray-200 dark:border-gray-700 text-gray-400 dark:text-gray-500 hover:border-green-400 hover:text-green-600 dark:hover:text-green-400'}`}
                              title={q.correct === ci ? 'Correct answer' : 'Mark as correct'}>
                              {CHOICE_LABELS[ci]}
                            </button>
                            <input type="text" value={choice} onChange={e => updateChoice(q.id, ci, e.target.value)}
                              placeholder={`Choice ${CHOICE_LABELS[ci]}`}
                              className={`flex-1 px-3 py-2.5 rounded-xl border text-sm outline-none transition-colors bg-white dark:bg-gray-800 text-gray-900 dark:text-white ${q.correct === ci ? 'border-green-400 dark:border-green-600 bg-green-50 dark:bg-green-950' : 'border-gray-200 dark:border-gray-700 focus:border-green-500'}`} />
                          </div>
                        ))}
                      </div>
                      {errors[`q_${q.id}_choices`]  && <p className="text-xs text-red-500 mt-1.5">{errors[`q_${q.id}_choices`]}</p>}
                      {errors[`q_${q.id}_correct`]  && <p className="text-xs text-red-500 mt-1">{errors[`q_${q.id}_correct`]}</p>}
                    </div>

                    {/* Category + delete */}
                    <div className="flex items-end gap-3">
                      <div className="flex-1">
                        <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5 uppercase tracking-wide">Skill category</label>
                        {categories.length === 0 ? (
                          <p className="text-xs text-amber-600 dark:text-amber-400 italic py-2">Add skill categories above first.</p>
                        ) : (
                          <div className="flex flex-wrap gap-1.5">
                            {categories.map(cat => (
                              <button key={cat.id} onClick={() => { updateQuestion(q.id, 'categoryId', cat.id); setErrors(e => ({ ...e, [`q_${q.id}_categoryId`]: '' })) }}
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

          {/* Add question */}
          <button onClick={addQuestion}
            className="w-full py-3 rounded-2xl border-2 border-dashed border-gray-200 dark:border-gray-700 text-sm text-gray-400 dark:text-gray-500 hover:border-green-400 hover:text-green-600 dark:hover:text-green-400 hover:bg-green-50 dark:hover:bg-green-950/30 transition-colors flex items-center justify-center gap-2">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"/></svg>
            Add question manually
          </button>

          {questions.length > 1 && (
            <button onClick={() => questions.forEach(q => q.expanded = false)}
              className="text-xs text-gray-400 dark:text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 transition-colors self-end">
              Collapse all
            </button>
          )}
        </div>

        {/* ── Summary + Publish ── */}
        <div className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-2xl p-6 flex flex-col gap-4">
          <p className="text-sm font-semibold text-gray-900 dark:text-white">Summary</p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: 'Questions',  value: questions.length },
              { label: 'Duration',   value: duration ? `${duration} min` : '—' },
              { label: 'Categories', value: categories.length },
              { label: 'Tagged',     value: `${totalTagged}/${questions.length}` },
            ].map(stat => (
              <div key={stat.label} className="bg-gray-50 dark:bg-gray-800 rounded-xl p-3 text-center">
                <p className="text-xs text-gray-400 dark:text-gray-500 mb-1">{stat.label}</p>
                <p className="text-sm font-bold text-gray-900 dark:text-white">{stat.value}</p>
              </div>
            ))}
          </div>
          {countPerCat.length > 0 && (
            <div className="flex flex-col gap-2">
              {countPerCat.map(cat => (
                <div key={cat.id} className="flex items-center gap-3">
                  <span className="text-xs text-gray-500 dark:text-gray-400 w-40 truncate">{cat.name}</span>
                  <div className="flex-1 h-1.5 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
                    <div className="h-full bg-green-500 rounded-full transition-all duration-300" style={{ width: questions.length ? `${(cat.count / questions.length) * 100}%` : '0%' }} />
                  </div>
                  <span className="text-xs font-medium text-gray-500 dark:text-gray-400 w-10 text-right">{cat.count}q</span>
                </div>
              ))}
            </div>
          )}
          <div className="flex flex-col gap-2 pt-2">
            <button onClick={handlePublish} className="w-full py-3.5 rounded-xl bg-green-600 hover:bg-green-700 text-white text-sm font-semibold transition-colors">Publish assessment</button>
            {published && <p className="text-center text-xs text-green-600 dark:text-green-400 font-medium">Assessment published successfully</p>}
          </div>
        </div>

        <div className="h-4" />
      </main>
    </div>
  )
}