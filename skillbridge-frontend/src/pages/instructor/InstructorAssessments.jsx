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
import DialogShell from '../../components/DialogShell'
import QuestionImportPanel from '../../components/assessment/QuestionImportPanel'
import AssessmentSettings from '../../components/instructor/AssessmentSettings'
import AssessmentLibrary from '../../components/instructor/AssessmentLibrary'
import AssessmentTitleEditor from '../../components/instructor/AssessmentTitleEditor'
import AssessmentArchiveAction from '../../components/assessment/AssessmentArchiveAction'
import AssessmentDuplicateAction from '../../components/assessment/AssessmentDuplicateAction'
import AssessmentPolicyNotice from '../../components/assessment/AssessmentPolicyNotice'
import { AssessmentStatus } from '../../components/admin/AssessmentPresentation'
import { assessmentChangeImpact } from '../../utils/assessmentPolicy'
import { ChevronDown, LockIcon } from '../../components/Icons'

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
const SaveIcon    = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>

// ── Upload sub-modal preview helpers ─────────────────────────────────────────
export default function InstructorAssessments() {
  const {
    assessments, stats, batchOptions, loadingList, listError,
    selected, loadingQuestions, questionError, retryQuestions,
    openAssessment, closeAssessment,
    editTitle, setEditTitle,
    editDuration, setEditDuration,
    editSettings, setEditSettings,
    visibleQuestions, questionStats, categories, framework,
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
  function closeUpload() { setShowUpload(false) }

  return (
    <div className="min-w-0">



      <AssessmentLibrary assessments={assessments} stats={stats} batches={batchOptions} onOpen={openAssessment} pending={loadingList} error={assessments.length ? undefined : listError} />

      {/* ════════════════════════════════════════════════════════════════════
          FULL EDIT MODAL
          Mobile: fixed inset-0 (full screen)
          Desktop (sm+): centered with margins, max-w-4xl, max-h-[92vh]
      ════════════════════════════════════════════════════════════════════ */}
      {selected && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm sm:p-4">
          <div role="dialog" aria-modal="true" aria-label="Edit assessment" className="relative w-full h-[95dvh] sm:h-auto sm:max-h-[92vh] sm:max-w-4xl bg-white dark:bg-gray-900 sm:rounded-2xl flex flex-col overflow-hidden shadow-2xl border-0 sm:border border-gray-100 dark:border-gray-800">

            {/* ── Assessment identity stays visible above the scrollable form. */}
            <div className="shrink-0 bg-white px-5 pb-5 pt-5 dark:bg-gray-900 sm:px-6">
              <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-x-3 gap-y-2">
                <div className="min-w-0"><AssessmentTitleEditor value={editTitle} onChange={setEditTitle} disabled={saving} /></div>
                <button type="button" aria-label="Close assessment" onClick={requestClose} className="inline-flex h-9 w-9 cursor-pointer items-center justify-center rounded-lg text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-700 focus-visible:outline-2 focus-visible:outline-green-600 dark:hover:bg-gray-800 dark:hover:text-gray-200" title="Close without saving"><CloseIcon /></button>
                <div className="col-span-2 flex min-w-0 flex-wrap items-center gap-2 text-xs">
                  {selected.batch_name && <span className="max-w-full break-words rounded-full bg-blue-50 px-2.5 py-1 font-medium text-blue-700 dark:bg-blue-950/50 dark:text-blue-300">{selected.batch_name}</span>}
                  <AssessmentStatus status={(liveAssessment || selected).publication_status} />
                </div>
              </div>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto" aria-label="Assessment settings and questions"><fieldset disabled={saving || liveAssessment?.is_archived} className="min-w-0">
              <div className="space-y-5 bg-white px-5 pb-5 dark:bg-gray-900 sm:px-6">
                <AssessmentPolicyNotice assessment={liveAssessment || selected} value={editSettings} variant="modal" />
                {selected.framework_id && <p className="text-xs text-gray-500">{selected.framework_name} · v{selected.framework_version}. Categories use this saved framework. Imported names outside it remain unmapped for manual review.</p>}
                {!selected.batch_id && <label className="block space-y-2 text-xs font-medium">Assign draft to batch<select aria-label="Assign draft to batch" value={editSettings.batch_id || ''} onChange={event => setEditSettings(previous => ({ ...previous, batch_id: event.target.value }))} className="min-h-11 w-full rounded-lg border border-gray-200 bg-white px-3 dark:border-gray-700 dark:bg-gray-800"><option value="">Choose later</option>{batchOptions.filter(batch => batch.status === 'active' && (selected.framework_id ? batch.program_id === selected.program_id && (!batch.framework_id || batch.framework_id === selected.framework_id) : !batch.program_id)).map(batch => <option key={batch.id} value={batch.id}>{batch.name}</option>)}</select></label>}
                <AssessmentSettings assessment={liveAssessment || selected} variant="modal" value={editSettings} onChange={setEditSettings} duration={editDuration} onDurationChange={setEditDuration} />
                <div aria-label="Assessment reuse and archive" className="flex flex-wrap items-start gap-3 border-t border-gray-100 pt-4 dark:border-gray-800"><AssessmentDuplicateAction assessment={liveAssessment || selected} role="instructor" disabled={dirty || saving} onSuccess={closeAssessment} /><AssessmentArchiveAction assessment={liveAssessment || selected} disabled={dirty || saving} onSuccess={closeAssessment} variant="inline" /></div>
              </div>
              {!loadingQuestions && visibleQuestions.length > 0 && <div className="flex flex-wrap items-center gap-2 border-y border-gray-100 bg-white px-5 py-3 dark:border-gray-800 dark:bg-gray-900 sm:px-6">
                <h3 className="mr-1 text-sm font-semibold text-gray-800 dark:text-gray-100">Questions <span className="ml-2 text-xs font-normal text-gray-500 dark:text-gray-400">{visibleQuestions.length}</span></h3>
                {questionStats.mcq > 0 && <span className="rounded-full bg-blue-100 px-2.5 py-1 text-[11px] font-medium text-blue-700 dark:bg-blue-950 dark:text-blue-300">{questionStats.mcq} MCQ</span>}
                {questionStats.truefalse > 0 && <span className="rounded-full bg-purple-100 px-2.5 py-1 text-[11px] font-medium text-purple-700 dark:bg-purple-950 dark:text-purple-300">{questionStats.truefalse} T/F</span>}
                {questionStats.identification > 0 && <span className="rounded-full bg-amber-100 px-2.5 py-1 text-[11px] font-medium text-amber-700 dark:bg-amber-950 dark:text-amber-300">{questionStats.identification} Identification</span>}
                <button type="button" onClick={allExpanded ? collapseAll : expandAll} aria-expanded={allExpanded} className="ml-auto inline-flex min-h-9 cursor-pointer items-center gap-2 rounded-lg border border-gray-200 px-3 py-2 text-xs font-medium text-gray-600 transition-colors hover:bg-gray-50 focus-visible:outline-2 focus-visible:outline-green-600 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800">{allExpanded ? 'Collapse all' : 'Expand all'}<ChevronDown size={13} open={allExpanded} /></button>
              </div>}

            {/* ── Scrollable question list ──────────────────────────────── */}
            <div className="px-5 py-5 bg-gray-50 dark:bg-gray-950 sm:px-6">
              {loadingQuestions ? (
                <ContentSkeleton layout="questions" count={2} label="Loading assessment questions" />
              ) : questionError ? (
                <div role="alert" className="sb-data-error"><p>{questionError}</p><button type="button" onClick={retryQuestions}>Retry</button></div>
              ) : (
                <div className="flex flex-col gap-3">
                  {visibleQuestions.length === 0 && (
                    <div className="text-center py-12">
                      <p className="text-sm text-gray-400 dark:text-gray-500">No questions yet. Add some below.</p>
                    </div>
                  )}

                  {liveAssessment?.questions_locked ? visibleQuestions.map((q, i) => <div key={q.id || q._tempId} className="rounded-xl border border-gray-200 bg-white p-3 text-sm text-gray-700 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300"><div className="flex items-start justify-between gap-3"><strong>{i + 1}. {q.question_text}</strong><span aria-hidden="true" className="mt-0.5 shrink-0 text-gray-400"><LockIcon size={15} /></span></div><p className="mt-1 text-xs text-gray-500 dark:text-gray-400">{q.category?.name || 'Uncategorized'} · {q.question_type}</p><p className="mt-1 text-xs">Grading answer: {q.question_type === 'identification' ? q.identAnswer : q.choices.filter(choice => choice.is_correct).map(choice => choice.text).join(', ')}</p></div>) : visibleQuestions.map((q, i) => (
                    <EditableQuestionCard
                      key={q._tempId}
                      q={q}
                      index={i}
                      categories={categories}
                      framework={framework}
                      onUpdate={liveAssessment?.questions_locked ? () => {} : updateQuestion}
                      onChangeType={liveAssessment?.questions_locked ? () => {} : changeQuestionType}
                      onUpdateChoice={liveAssessment?.questions_locked ? () => {} : updateChoice}
                      onSetCorrect={liveAssessment?.questions_locked ? () => {} : setCorrectChoice}
                      onRemove={liveAssessment?.questions_locked ? () => {} : removeQuestion}
                    />
                  ))}

                  {!liveAssessment?.questions_locked && <button type="button" aria-label="Import questions" disabled={saving || loadingQuestions} onClick={() => setShowUpload(true)} className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border border-gray-200 px-3 py-2 text-xs font-medium text-gray-700 hover:bg-white focus-visible:outline-2 focus-visible:outline-green-600 disabled:opacity-50 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800"><UploadIcon />Import questions</button>}
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
            <div className="px-5 py-4 border-t border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 flex items-center justify-end gap-3 shrink-0 sm:px-6">
              <p className="hidden sm:block text-xs text-gray-400 dark:text-gray-500 flex-1">
                Changes are saved when you click Save All Changes.
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

      {showUpload && selected && !liveAssessment?.questions_locked && <DialogShell title="Import questions"
        description={`Add questions to the draft for ${selected.title}.`} onClose={closeUpload}>
        <div className="min-h-0 overflow-y-auto p-4 sm:p-6">
          <QuestionImportPanel key={selected.id} categories={categories} scoped={Boolean(selected.framework_id)}
            onStage={rows => { importQuestions(rows); closeUpload() }} onCancel={closeUpload} />
        </div>
      </DialogShell>}
    </div>
  )
}
