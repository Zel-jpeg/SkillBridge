import { useEffect, useState } from 'react'
import DialogShell from '../DialogShell'
import ConfirmModal from '../admin/ConfirmModal'
import Pagination from '../Pagination'
import AssessmentSettings from '../instructor/AssessmentSettings'
import EditableQuestionCard from './EditableQuestionCard'
import { useInstructorAssessments } from '../../hooks/instructor/useInstructorAssessments'
import AssessmentPolicyNotice from './AssessmentPolicyNotice'
import { assessmentChangeImpact, assessmentLocks } from '../../utils/assessmentPolicy'
import { useAssessmentUpload } from '../../hooks/instructor/useAssessmentUpload'
import AssessmentDurationSuggestions from './AssessmentDurationSuggestions'

const field = 'w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-800'
const button = 'min-h-10 rounded-xl border border-gray-200 px-3 py-2 text-xs font-semibold hover:bg-green-50 focus-visible:outline-2 focus-visible:outline-green-600 disabled:opacity-50 dark:border-gray-700 dark:hover:bg-green-950'

export default function AssessmentAuthoringDialog({ assessment, onClose, role = 'admin' }) {
  const editor = useInstructorAssessments({ role })
  const { openAssessment } = editor
  const [initial] = useState(assessment)
  useEffect(() => { openAssessment(initial) }, [initial, openAssessment])
  const [confirm, setConfirm] = useState(null)
  const [page, setPage] = useState(1)
  const [importing, setImporting] = useState(false)
  const upload = useAssessmentUpload({ assessmentId: assessment.id, onImport: rows => {
    editor.importQuestions(rows); setImporting(false)
  } })
  const current = editor.liveAssessment || assessment
  const locks = assessmentLocks(current)
  const locked = current.questions_locked || current.is_archived
  const remoteChanged = ['title', 'batch_id', 'publication_status', 'duration_minutes', 'is_required', 'include_in_competency', 'question_count', 'questions_locked'].some(key => assessment[key] !== initial[key])
  const visiblePage = Math.min(page, Math.ceil(editor.visibleQuestions.length / 10) || 1)
  function close() {
    if (editor.saving || upload.submitting) return
    if (editor.dirty) setConfirm('discard')
    else onClose()
  }
  async function save() {
    setConfirm(null)
    if (await editor.saveAllChanges()) onClose()
  }
  return <DialogShell title={`Edit assessment: ${assessment.title}`} description="Settings and question changes save together. Questions lock after the first attempt." onClose={close}
    footer={<div className="flex flex-wrap items-center justify-between gap-3"><p className="text-xs text-gray-500">{editor.dirty ? 'Unsaved changes' : 'No unsaved changes'}</p><div className="flex gap-2"><button className={button} onClick={close} disabled={editor.saving}>Close editor</button><button className={`${button} bg-green-700 text-white hover:bg-green-800`} disabled={editor.saving || editor.loadingQuestions || !!editor.questionError || !editor.dirty || assessment.is_archived} onClick={() => setConfirm('save')}>{editor.saving ? 'Saving…' : 'Review & save authoring'}</button></div></div>}>
    <div className="min-h-0 flex-1 space-y-5 overflow-y-auto p-4 sm:p-6">
      {editor.saveError && <p role="alert" className="rounded-xl bg-rose-50 p-3 text-sm text-rose-800">{editor.saveError}</p>}
      {remoteChanged && <p role="status" className="rounded-xl bg-amber-50 p-3 text-xs text-amber-900">The assessment changed on the server. Your authoring draft is preserved. Review the latest record before saving; the server enforces attempt locks.</p>}
      <fieldset disabled={editor.saving || editor.loadingQuestions || assessment.is_archived} className="space-y-4">
        <label className="block text-xs font-semibold">Assessment title<input aria-label="Assessment title" className={field} value={editor.editTitle} onChange={event => editor.setEditTitle(event.target.value)} /></label>
        <label className="block text-xs font-semibold">Duration in minutes<input aria-label="Duration in minutes" className={field} type="number" min="1" disabled={locks.duration} value={editor.editDuration} onChange={event => editor.setEditDuration(event.target.value)} /></label>
        <AssessmentDurationSuggestions value={editor.editDuration} onChange={editor.setEditDuration} disabled={locks.duration} />
        {!assessment.batch_id && <label className="block text-xs font-semibold">Assign draft to batch<select aria-label="Assign draft to batch" className={field} value={editor.editSettings.batch_id || ''} onChange={event => editor.setEditSettings(previous => ({ ...previous, batch_id: event.target.value }))}><option value="">Choose later</option>{editor.batchOptions.filter(batch => batch.status === 'active').map(batch => <option key={batch.id} value={batch.id}>{batch.name} · {batch.instructor_name}</option>)}</select></label>}
        <AssessmentSettings assessment={current} value={editor.editSettings} onChange={next => editor.setEditSettings(previous => ({ ...previous, ...next }))} />
        <AssessmentPolicyNotice assessment={current} value={editor.editSettings} />
      </fieldset>
      <section className="space-y-3" aria-label="Question authoring">
        <h3 className="text-sm font-semibold">Questions and answer keys</h3>
        {locked && <p role="status" className="rounded-xl bg-amber-50 p-3 text-xs text-amber-900">A student attempt exists. Questions and answer keys are locked; settings remain editable.</p>}
        {editor.loadingQuestions ? <p role="status">Loading authorized questions…</p> : editor.questionError ? <div role="alert">{editor.questionError}<button className={button} onClick={editor.retryQuestions}>Retry questions</button></div> : <>
          {editor.visibleQuestions.slice((visiblePage - 1) * 10, visiblePage * 10).map((question, index) => locked ? <article className="rounded-xl border border-gray-200 p-3 dark:border-gray-700" key={question._tempId}><p className="text-sm">{question.question_text}</p><p className="mt-2 text-xs text-green-800 dark:text-green-300">Key: {question.question_type === 'identification' ? question.identAnswer : question.choices.filter(choice => choice.is_correct).map(choice => choice.text).join(', ')}</p></article> : <fieldset className="min-w-0" disabled={editor.saving} key={question._tempId}><EditableQuestionCard q={question} index={(visiblePage - 1) * 10 + index} categories={editor.categories} onUpdate={editor.updateQuestion} onChangeType={editor.changeQuestionType} onUpdateChoice={editor.updateChoice} onSetCorrect={editor.setCorrectChoice} onRemove={editor.removeQuestion} /></fieldset>)}
          {!editor.visibleQuestions.length && <p className="text-xs text-gray-500">No questions yet. Add or import questions before publishing.</p>}
          <Pagination total={editor.visibleQuestions.length} page={visiblePage} onPage={setPage} />
          {!locked && <div className="flex flex-wrap gap-2">{[['mcq', 'Multiple Choice'], ['truefalse', 'True / False'], ['identification', 'Identification']].map(([type, label]) => <button key={type} className={button} disabled={editor.saving} onClick={() => { editor.addQuestion(type); setPage(Math.ceil((editor.visibleQuestions.length + 1) / 10)) }}>Add {label}</button>)}<button className={button} disabled={editor.saving} onClick={() => { upload.reset(); setImporting(value => !value) }}>Import questions</button></div>}
        </>}
        {importing && !locked && <section aria-label="Import questions" className="space-y-3 rounded-xl border border-gray-200 p-4 dark:border-gray-700">
          <p className="text-xs text-gray-500">Review parsed questions, then add them to this draft. They are saved with the authoring changes.</p>
          <select aria-label="Question import format" className={field} value={upload.tab} onChange={event => upload.setTab(event.target.value)}><option value="excel">Excel / CSV</option><option value="text">Text file</option></select>
          <input aria-label="Question import file" type="file" accept={upload.tab === 'excel' ? '.xlsx,.csv' : '.txt'} disabled={upload.activeLoading || upload.submitting} onChange={event => { const file = event.target.files?.[0]; if (file) (upload.tab === 'excel' ? upload.parseExcelQuestions : upload.parseTxtFile)(file) }} />
          {upload.activeLoading && <p role="status">Reading file…</p>}
          {upload.activeErrors.map((error, index) => <p role="alert" className="text-xs text-rose-700" key={index}>Row {error.rowNum}: {error.errors.join(' ')}</p>)}
          {upload.submitError && <p role="alert">{upload.submitError}</p>}
          <ol className="max-h-64 space-y-2 overflow-y-auto text-xs">{upload.activeRows.map((row, index) => <li key={index}><strong>{index + 1}. {row.question}</strong><p>{row.type} · {row.category || 'Uncategorized'} · Key: {row.type === 'identification' ? row.identAnswer : row.choices[row.correctIdx]}</p></li>)}</ol>
          <button className={button} disabled={!upload.activeRows.length || upload.activeLoading || upload.submitting} onClick={upload.handleSubmit}>Add {upload.activeRows.length} imported questions to draft</button>
        </section>}
      </section>
    </div>
    {confirm && <ConfirmModal tone={confirm === 'discard' ? 'danger' : 'confirm'} title={confirm === 'discard' ? 'Discard authoring changes?' : 'Save assessment authoring?'} message={confirm === 'discard' ? 'Unsaved settings and question edits will be discarded.' : 'The server validates and saves settings and questions together. ' + assessmentChangeImpact(current, editor.editSettings).join(' ')} confirmLabel={confirm === 'discard' ? 'Discard' : 'Save changes'} onCancel={() => setConfirm(null)} onConfirm={confirm === 'discard' ? onClose : save} />}
    {editor.confirmRemoveQuestion && <ConfirmModal title="Remove question from draft?" message="This removal is applied only when you save the assessment." confirmLabel="Remove question" onCancel={() => editor.setConfirmRemoveQuestion(null)} onConfirm={editor.confirmRemoveQuestionAction} />}
  </DialogShell>
}
