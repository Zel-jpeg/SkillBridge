import { ContentSkeleton } from '../../components/DataSection'
// src/pages/instructor/InstructorAssessments.jsx
//
// Assessment Library — browse, review, and fully edit all published assessments.
//
// Features:
//   • Summary stats (total, active, questions, submissions)
//   • Search by title or batch name + filter by batch / status
//   • Paginated cards/list — click an assessment to open the FULL EDIT MODAL
//
// Edit modal features:
//   • Edit assessment title (inline), duration, active toggle
//   • All questions shown as collapsible cards (collapsed by default)
//   • Per-question: edit text, change type (MCQ/T-F/Identification), edit choices,
//     mark correct answer, change skill category, delete question
//   • Add new questions: + Multiple Choice / + True/False / + Identification
//   • Expand All / Collapse All toggle for navigating 50-100 question assessments
//   • "Upload Questions" button → opens the existing bulk-file upload sub-modal
//   • Single "Save All Changes" → confirmation dialog → batch API calls
//   • Toast feedback on success / error

import { useState }           from 'react'
import EditableQuestionCard from '../../components/assessment/EditableQuestionCard'
import ConfirmModal                      from '../../components/admin/ConfirmModal'
import { useInstructorAssessments }      from '../../hooks/instructor/useInstructorAssessments'
import { useAssessmentUpload }           from '../../hooks/instructor/useAssessmentUpload'
import AssessmentSettings from '../../components/instructor/AssessmentSettings'
import AssessmentLibrary from '../../components/instructor/AssessmentLibrary'
import AssessmentTitleEditor from '../../components/instructor/AssessmentTitleEditor'
import AssessmentArchiveAction from '../../components/assessment/AssessmentArchiveAction'
import AssessmentDuplicateAction from '../../components/assessment/AssessmentDuplicateAction'
import AssessmentPolicyNotice from '../../components/assessment/AssessmentPolicyNotice'
import { assessmentChangeImpact } from '../../utils/assessmentPolicy'
import { ChevronDown, LockIcon } from '../../components/Icons'

/* eslint-disable react-hooks/refs -- The upload hook returns refs alongside ordinary state and callbacks. */
// ── Type meta ─────────────────────────────────────────────────────────────────
const TYPE_META = {
  mcq:            { label: 'MCQ',   color: 'bg-blue-100 dark:bg-blue-900/60 text-blue-700 dark:text-blue-300'       },
  truefalse:      { label: 'T / F', color: 'bg-purple-100 dark:bg-purple-900/60 text-purple-700 dark:text-purple-300' },
  identification: { label: 'IDENT', color: 'bg-amber-100 dark:bg-amber-900/60 text-amber-700 dark:text-amber-300'   },
}
// ── Icons ─────────────────────────────────────────────────────────────────────
const CloseIcon   = () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M18 6 6 18M6 6l12 12"/></svg>
const PlusIcon    = () => <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M12 5v14M5 12h14"/></svg>
const UploadIcon  = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
const WarnIcon    = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
const SaveIcon    = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>

// ── Upload sub-modal preview helpers ─────────────────────────────────────────
const UPLOAD_TYPE_COLORS = {
  mcq:            'bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300',
  truefalse:      'bg-purple-100 dark:bg-purple-900 text-purple-700 dark:text-purple-300',
  identification: 'bg-amber-100 dark:bg-amber-900 text-amber-700 dark:text-amber-300',
}
const UPLOAD_TYPE_LABELS = { mcq: 'MCQ', truefalse: 'T/F', identification: 'IDENT' }

function PreviewTable({ rows, onApplySuggestion }) {
  return (
    <div className="border border-gray-100 dark:border-gray-800 rounded-xl overflow-hidden">
      <div className="overflow-x-auto max-h-48">
        <table className="w-full text-xs">
          <thead className="sticky top-0">
            <tr className="bg-gray-50 dark:bg-gray-800 border-b border-gray-100 dark:border-gray-800">
              {['#', 'Question', 'Type', 'Answer', 'Category'].map(h => (
                <th key={h} className="px-3 py-2 text-left text-gray-500 dark:text-gray-400 font-semibold whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i} className={`border-b border-gray-50 dark:border-gray-800 last:border-0 ${i % 2 ? 'bg-gray-50/50 dark:bg-gray-800/30' : ''}`}>
                <td className="px-3 py-2 text-gray-400">{i + 1}</td>
                <td className="px-3 py-2 text-gray-900 dark:text-white max-w-160px truncate">{r.question}</td>
                <td className="px-3 py-2">
                  <span className={`font-semibold px-2 py-0.5 rounded-full text-[10px] ${UPLOAD_TYPE_COLORS[r.type]}`}>
                    {UPLOAD_TYPE_LABELS[r.type]}
                  </span>
                </td>
                <td className="px-3 py-2 text-green-700 dark:text-green-300 font-semibold max-w-90px truncate">
                  {r.type === 'identification' ? r.identAnswer
                    : r.type === 'truefalse' ? (r.correctIdx === 0 ? 'True' : 'False')
                    : ['A','B','C','D'][r.correctIdx]}
                </td>
                <td className="px-3 py-2">
                  <div className="flex flex-col gap-1 items-start">
                    <span className="text-gray-500 dark:text-gray-400 max-w-90px truncate">{r.category}</span>
                    {r.suggestedCategory && r.suggestedCategory.toLowerCase() !== r.category.toLowerCase() && (
                      <button
                        onClick={() => onApplySuggestion(i, r.suggestedCategory)}
                        className="text-[10px] font-medium px-2 py-0.5 rounded-full border border-indigo-200 dark:border-indigo-800 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-100 dark:hover:bg-indigo-900/50 transition-colors"
                      >
                        Suggested: {r.suggestedCategory}
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function UploadErrors({ errors }) {
  if (!errors.length) return null
  return (
    <div className="bg-red-50 dark:bg-red-950/40 border border-red-100 dark:border-red-900 rounded-xl px-4 py-3 flex flex-col gap-1">
      <p className="text-xs font-semibold text-red-700 dark:text-red-300">
        {errors.length} row{errors.length > 1 ? 's' : ''} with issues (skipped):
      </p>
      {errors.map((e, i) => (
        <p key={i} className="text-xs text-red-600 dark:text-red-400">Row {e.rowNum}: {e.errors.join(' · ')}</p>
      ))}
    </div>
  )
}

// ════════════════════════════════════════════════════════════════════════════
// MAIN PAGE
// ════════════════════════════════════════════════════════════════════════════
export default function InstructorAssessments() {
  const {
    assessments, stats, batchOptions,
    selected, loadingQuestions, questionError, retryQuestions,
    openAssessment, closeAssessment,
    editTitle, setEditTitle,
    editDuration, setEditDuration,
    editSettings, setEditSettings,
    visibleQuestions, questionStats, categories,
    expandAll, collapseAll, allExpanded,
    updateQuestion, changeQuestionType, updateChoice, setCorrectChoice,
    addQuestion, removeQuestion,
    showSaveConfirm, setShowSaveConfirm,
    confirmRemoveQuestion, setConfirmRemoveQuestion,
    confirmRemoveQuestionAction,
    saving, saveAllChanges, saveError, dirty, importQuestions, liveAssessment,

  } = useInstructorAssessments()

  // ── Upload sub-modal (existing bulk file upload) ──────────────────────────
  const [showUpload, setShowUpload] = useState(false)
  const [discard, setDiscard] = useState(false)
  function requestClose() {
    if (saving) return
    if (dirty) setDiscard(true)
    else closeAssessment()
  }
  function closeUpload() { setShowUpload(false); upload.reset() }
  const upload = useAssessmentUpload({
    assessmentId: selected?.id,
    onImport: (rows) => {
      importQuestions(rows)
      setShowUpload(false)
    },
  })

  return (
    <div className="min-w-0">



      <AssessmentLibrary assessments={assessments} stats={stats} batches={batchOptions} onOpen={openAssessment} />

      {/* ════════════════════════════════════════════════════════════════════
          FULL EDIT MODAL
          Mobile: fixed inset-0 (full screen)
          Desktop (sm+): centered with margins, max-w-4xl, max-h-[92vh]
      ════════════════════════════════════════════════════════════════════ */}
      {selected && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm sm:p-4">
          <div role="dialog" aria-modal="true" aria-label="Edit assessment" className="relative w-full h-[95dvh] sm:h-auto sm:max-h-[92vh] sm:max-w-4xl bg-white dark:bg-gray-900 sm:rounded-2xl flex flex-col overflow-hidden shadow-2xl border-0 sm:border border-gray-100 dark:border-gray-800">

            {/* ── Assessment identity stays visible above the scrollable form. */}
            <div className="shrink-0 bg-white px-5 pb-4 pt-5 dark:bg-gray-900">
              <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-x-3 gap-y-2">
                <div className="col-span-2 min-w-0 sm:col-span-1"><AssessmentTitleEditor value={editTitle} onChange={setEditTitle} disabled={saving} /></div>
                <div className="col-start-2 row-start-2 flex shrink-0 items-center gap-2 sm:row-start-1">

                  <button type="button" onClick={requestClose} className="inline-flex h-9 w-9 cursor-pointer items-center justify-center rounded-lg text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-700 focus-visible:outline-2 focus-visible:outline-green-600 dark:hover:bg-gray-800 dark:hover:text-gray-200" title="Close without saving"><CloseIcon /></button>
                </div>
                <div className="col-start-1 row-start-2 flex min-w-0 flex-wrap items-center gap-2 self-center text-xs sm:col-span-2">
                  {selected.batch_name && <span className="max-w-full break-words rounded-full bg-blue-50 px-2.5 py-1 font-medium text-blue-700 dark:bg-blue-950/50 dark:text-blue-300">{selected.batch_name}</span>}
                  <span className="hidden text-gray-500 dark:text-gray-400 sm:inline">Assessment settings</span>
                </div>
              </div>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto" aria-label="Assessment settings and questions"><fieldset disabled={saving || liveAssessment?.is_archived} className="min-w-0">
              <div className="space-y-4 bg-white px-5 pb-4 dark:bg-gray-900">
                <div className="flex flex-wrap items-start gap-3"><AssessmentDuplicateAction assessment={liveAssessment || selected} role="instructor" disabled={dirty || saving} onSuccess={closeAssessment} /><AssessmentArchiveAction assessment={liveAssessment || selected} disabled={dirty || saving} onSuccess={closeAssessment} /></div>
                <AssessmentSettings assessment={liveAssessment || selected} variant="modal" value={editSettings} onChange={setEditSettings} duration={editDuration} onDurationChange={setEditDuration} />
                <AssessmentPolicyNotice assessment={liveAssessment || selected} value={editSettings} />
                {liveAssessment?.questions_locked && <div role="note" className="flex items-start gap-2.5 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-xs leading-5 text-amber-800 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-300"><span aria-hidden="true" className="mt-0.5 shrink-0"><LockIcon size={16} /></span><p><strong className="font-semibold">Question editing is locked</strong><span className="mx-2 hidden text-amber-300 sm:inline" aria-hidden="true">|</span><span className="block sm:inline">An attempt already exists. Allowed settings remain editable; attempts and scores are preserved.</span></p></div>}
              </div>
              {liveAssessment?.questions_locked && <p className="px-5 pb-3 text-xs text-gray-500 dark:text-gray-400">Import questions is unavailable after a student attempt exists.</p>}
              {!loadingQuestions && visibleQuestions.length > 0 && <div className="flex flex-wrap items-center gap-2 border-y border-gray-100 bg-white px-5 py-3 dark:border-gray-800 dark:bg-gray-900">
                <h3 className="mr-1 text-sm font-semibold text-gray-800 dark:text-gray-100">Questions <span className="ml-2 text-xs font-normal text-gray-500 dark:text-gray-400">{visibleQuestions.length}</span></h3>
                {questionStats.mcq > 0 && <span className="rounded-full bg-blue-100 px-2.5 py-1 text-[11px] font-medium text-blue-700 dark:bg-blue-950 dark:text-blue-300">{questionStats.mcq} MCQ</span>}
                {questionStats.truefalse > 0 && <span className="rounded-full bg-purple-100 px-2.5 py-1 text-[11px] font-medium text-purple-700 dark:bg-purple-950 dark:text-purple-300">{questionStats.truefalse} T/F</span>}
                {questionStats.identification > 0 && <span className="rounded-full bg-amber-100 px-2.5 py-1 text-[11px] font-medium text-amber-700 dark:bg-amber-950 dark:text-amber-300">{questionStats.identification} Identification</span>}
                <button type="button" onClick={allExpanded ? collapseAll : expandAll} aria-expanded={allExpanded} className="ml-auto inline-flex min-h-9 cursor-pointer items-center gap-2 rounded-lg border border-gray-200 px-3 py-2 text-xs font-medium text-gray-600 transition-colors hover:bg-gray-50 focus-visible:outline-2 focus-visible:outline-green-600 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800">{allExpanded ? 'Collapse all' : 'Expand all'}<ChevronDown size={13} open={allExpanded} /></button>
              </div>}

            {/* ── Scrollable question list ──────────────────────────────── */}
            <div className="px-5 py-5 bg-gray-50 dark:bg-gray-950">
              {loadingQuestions ? (
                <ContentSkeleton layout="table" count={5} label="Loading assessment questions" />
              ) : questionError ? (
                <div role="alert" className="sb-data-error"><p>{questionError}</p><button type="button" onClick={retryQuestions}>Retry</button></div>
              ) : (
                <div className="flex flex-col gap-3">
                  {visibleQuestions.length === 0 && (
                    <div className="text-center py-12">
                      <p className="text-sm text-gray-400 dark:text-gray-500">No questions yet. Add some below.</p>
                    </div>
                  )}

                  {liveAssessment?.questions_locked ? visibleQuestions.map((q, i) => <div key={q.id || q._tempId} className="rounded-xl border border-gray-200 bg-white p-3 text-sm text-gray-700 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300"><strong>{i + 1}. {q.question_text}</strong><p className="text-xs">{q.category?.name || 'Uncategorized'} · {q.question_type}</p><p className="mt-1 text-xs">Grading answer: {q.question_type === 'identification' ? q.identAnswer : q.choices.filter(choice => choice.is_correct).map(choice => choice.text).join(', ')}</p></div>) : visibleQuestions.map((q, i) => (
                    <EditableQuestionCard
                      key={q._tempId}
                      q={q}
                      index={i}
                      categories={categories}
                      onUpdate={liveAssessment?.questions_locked ? () => {} : updateQuestion}
                      onChangeType={liveAssessment?.questions_locked ? () => {} : changeQuestionType}
                      onUpdateChoice={liveAssessment?.questions_locked ? () => {} : updateChoice}
                      onSetCorrect={liveAssessment?.questions_locked ? () => {} : setCorrectChoice}
                      onRemove={liveAssessment?.questions_locked ? () => {} : removeQuestion}
                    />
                  ))}

                  {!liveAssessment?.questions_locked && <button type="button" aria-label="Import questions" disabled={saving || loadingQuestions} onClick={() => { setShowUpload(true); upload.reset() }} className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border border-gray-200 px-3 py-2 text-xs font-medium text-gray-700 hover:bg-white focus-visible:outline-2 focus-visible:outline-green-600 disabled:opacity-50 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800"><UploadIcon />Import questions</button>}
                  {/* Add question buttons */}
                  {!liveAssessment?.questions_locked && <div className="flex flex-col sm:flex-row gap-2 mt-2 pb-2">
                    {[
                      { type: 'mcq',            label: '+ Add Multiple Choice' },
                      { type: 'truefalse',       label: '+ Add True / False'   },
                      { type: 'identification',  label: '+ Add Identification'  },
                    ].map(t => (
                      <button
                        key={t.type}
                        onClick={() => addQuestion(t.type)}
                        className="flex-1 py-3 rounded-2xl border-2 border-dashed border-gray-200 dark:border-gray-700 text-sm text-gray-400 dark:text-gray-500 hover:border-green-400 hover:text-green-600 dark:hover:text-green-400 hover:bg-green-50 dark:hover:bg-green-950/30 transition-colors"
                      >
                        {t.label}
                      </button>
                    ))}
                  </div>}
                </div>
              )}
            </div>

            </fieldset></div>

            {saveError && <p role="alert" className="px-5 py-2 text-sm text-rose-700 dark:text-rose-300">{saveError}</p>}
            {/* ── Footer ───────────────────────────────────────────────── */}
            <div className="px-5 py-4 border-t border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 flex items-center gap-3 shrink-0">
              <p className="hidden sm:block text-xs text-gray-400 dark:text-gray-500 flex-1">
                Changes are not saved until you click "Save All Changes".
              </p>
              <button
                onClick={requestClose}
                className="px-5 py-3 rounded-xl bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 text-sm font-semibold transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => setShowSaveConfirm(true)}
                disabled={saving || loadingQuestions || !!questionError}
                className="flex items-center gap-2 px-5 py-3 rounded-xl bg-green-600 hover:bg-green-700 active:bg-green-800 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-semibold transition-colors shadow-sm"
              >
                <SaveIcon />
                {saving ? 'Saving…' : 'Save All Changes'}
              </button>
            </div>
          </div>
        </div>
      )}

      {showSaveConfirm && <ConfirmModal tone="confirm" title="Save all changes?" confirmLabel="Confirm Save"
        message={'Settings and question changes save together. Individual results and placement history are preserved. ' + assessmentChangeImpact(liveAssessment || selected, editSettings).join(' ')}
        onCancel={() => setShowSaveConfirm(false)} onConfirm={saveAllChanges} />}

      {discard && <ConfirmModal title="Discard unsaved changes?" message="Your unsaved settings, question edits and imports will be discarded." confirmLabel="Discard changes" onCancel={() => setDiscard(false)} onConfirm={() => { setDiscard(false); closeAssessment() }} />}

      {/* ── Question Delete Confirmation ── */}
      {confirmRemoveQuestion && (
        <ConfirmModal
          title="Remove question?"
          message="This question will be marked for deletion. It will be permanently removed when you save all changes."
          confirmLabel="Remove"
          onConfirm={confirmRemoveQuestionAction}
          onCancel={() => setConfirmRemoveQuestion(null)}
        />
      )}

      {/* ── Upload Questions sub-modal (z-70, topmost) ─────────────────────── */}
      {showUpload && selected && (
        <>
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-70" onClick={closeUpload} />
          <div className="fixed inset-x-0 bottom-0 sm:inset-auto sm:top-1/2 sm:left-1/2 sm:-translate-x-1/2 sm:-translate-y-1/2 w-full sm:w-560px max-h-[90dvh] bg-white dark:bg-gray-900 rounded-t-3xl sm:rounded-2xl shadow-2xl z-80 flex flex-col overflow-hidden border-0 sm:border border-gray-100 dark:border-gray-800">

            {/* Upload modal header */}
            <div className="px-6 py-4 border-b border-gray-100 dark:border-gray-800 flex items-start justify-between gap-3 shrink-0">
              <div>
                <h3 className="text-sm font-bold text-gray-900 dark:text-white">Import questions</h3>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 truncate max-w-360px">
                  Adding to draft: {selected.title}
                </p>
              </div>
              <button onClick={closeUpload} className="p-2 rounded-lg text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
                <CloseIcon />
              </button>
            </div>

            {/* Warning */}
            <div className="mx-6 mt-4 flex items-start gap-2.5 bg-amber-50 dark:bg-amber-900/30 border border-amber-200 dark:border-amber-800 rounded-xl px-4 py-3 shrink-0">
              <span className="text-amber-600 dark:text-amber-400 shrink-0 mt-0.5"><WarnIcon /></span>
              <p className="text-xs text-amber-800 dark:text-amber-300 leading-relaxed">
                Imported questions append to this draft. Existing questions and unsaved edits are kept. Nothing is saved until you confirm Save All Changes. Imports are locked after a student attempt.
              </p>
            </div>

            {/* Tab switcher */}
            <div className="flex mx-6 mt-4 bg-gray-100 dark:bg-gray-800 rounded-xl p-1 shrink-0">
              {[{ key: 'excel', label: 'Excel / CSV' }, { key: 'text', label: 'Text file (.txt)' }].map(t => (
                <button key={t.key} onClick={() => upload.setTab(t.key)}
                  className={`flex-1 py-2 rounded-lg text-xs font-semibold transition-colors ${
                    upload.tab === t.key
                      ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm'
                      : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>

            {/* Upload body */}
            <div className="flex-1 overflow-y-auto px-6 py-4 flex flex-col gap-4">
              {/* Drop zone */}
              <div
                onDragOver={e => e.preventDefault()}
                onDrop={e => {
                  e.preventDefault()
                  const f = e.dataTransfer?.files?.[0]
                  if (!f) return
                  upload.tab === 'excel' ? upload.parseExcelQuestions(f) : upload.parseTxtFile(f)
                }}
                onClick={() => (upload.tab === 'excel' ? upload.xlsxRef : upload.txtRef).current?.click()}
                className="border-2 border-dashed border-gray-200 dark:border-gray-700 rounded-2xl p-8 flex flex-col items-center gap-3 cursor-pointer hover:border-green-400 hover:bg-green-50 dark:hover:bg-green-950/20 transition-colors"
              >
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" className="text-gray-300 dark:text-gray-700">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                  <polyline points="14 2 14 8 20 8" stroke="currentColor" strokeWidth="1.5"/>
                  <line x1="12" y1="18" x2="12" y2="12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                  <polyline points="9 15 12 12 15 15" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                </svg>
                <div className="text-center">
                  <p className="text-sm font-medium text-gray-600 dark:text-gray-300">
                    {upload.tab === 'excel'
                      ? (upload.xlsxFileName || 'Drop your .xlsx or .csv here')
                      : (upload.txtFileName  || 'Drop your .txt file here')}
                  </p>
                  <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">or click to browse</p>
                </div>
                <input ref={upload.xlsxRef} type="file" accept=".xlsx,.xls,.csv" className="hidden"
                  onChange={e => { if (e.target.files?.[0]) upload.parseExcelQuestions(e.target.files[0]) }} />
                <input ref={upload.txtRef}  type="file" accept=".txt" className="hidden"
                  onChange={e => { if (e.target.files?.[0]) upload.parseTxtFile(e.target.files[0]) }} />
              </div>

              {upload.activeLoading && (
                <p className="text-xs text-gray-400 text-center animate-pulse">Parsing file…</p>
              )}
              <UploadErrors errors={upload.activeErrors} />
              {upload.activeRows.length > 0 && (
                <div className="flex flex-col gap-2">
                  <p className="text-xs font-semibold text-gray-700 dark:text-gray-300">
                    {upload.activeRows.length} question{upload.activeRows.length > 1 ? 's' : ''} ready to add:
                  </p>
                  <PreviewTable rows={upload.activeRows} onApplySuggestion={upload.applySuggestion} />
                </div>
              )}
              {upload.submitError && (
                <p className="text-xs text-red-600 dark:text-red-400 text-center">{upload.submitError}</p>
              )}
            </div>

            {/* Upload footer */}
            <div className="px-6 py-4 border-t border-gray-100 dark:border-gray-800 flex gap-3 shrink-0">
              <button onClick={closeUpload}
                className="flex-1 py-3 rounded-xl bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 text-sm font-semibold transition-colors">
                Cancel
              </button>
              <button
                onClick={upload.handleSubmit}
                disabled={upload.activeRows.length === 0 || upload.submitting || upload.activeLoading}
                className="flex-1 py-3 rounded-xl bg-green-600 hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-semibold transition-colors"
              >
                {upload.submitting
                  ? 'Adding…'
                  : upload.activeRows.length > 0
                  ? `Add ${upload.activeRows.length} question${upload.activeRows.length > 1 ? 's' : ''} to draft`
                  : 'Add Questions'}
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
