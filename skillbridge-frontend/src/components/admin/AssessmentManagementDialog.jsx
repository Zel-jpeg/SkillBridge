import { useEffect, useId, useReducer, useRef, useState } from 'react'
import DialogShell from '../DialogShell'
import ConfirmModal from './ConfirmModal'
import AssessmentSettings from '../instructor/AssessmentSettings'
import AssessmentStudentDetail from '../AssessmentStudentDetail'
import Avatar from '../Avatar'
import api from '../../api/axios'
import { fetchWithDedup, getCachedData, invalidateCache, updateCachedData } from '../../hooks/useApi'
import { useAssessmentQuery } from '../../hooks/admin/useAdminAssessments'
import { ASSESSMENTS_URL, assessmentDraft, assessmentEditorReducer, draftIsDirty, initialEditor, validateAssessmentDraft } from '../../utils/adminAssessmentState'
import { manilaApiDate, manilaDateTime } from '../../utils/assessmentDates'
import { ActionSpinner, AssessmentIntegrity, AssessmentPagination, AssessmentProgress, AssessmentRetry, AssessmentSkeleton, AssessmentStatus, CategorySummary } from './AssessmentPresentation'

const sections = ['Overview', 'Settings', 'Students & attempts', 'Questions']
const input = 'mt-1 w-full min-w-0 rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 dark:border-gray-700 dark:bg-gray-800 dark:text-white'
const primary = 'inline-flex min-h-10 items-center justify-center gap-2 rounded-xl bg-green-700 px-4 py-2 text-xs font-semibold text-white hover:bg-green-800 disabled:opacity-50'
const secondary = 'min-h-10 rounded-xl border border-gray-200 px-3 py-2 text-xs font-medium text-gray-700 hover:bg-gray-100 disabled:opacity-50 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800'

function UnavailableDialog({ onClose }) {
  return <DialogShell title="Assessment unavailable" description="This assessment was removed or you no longer have access." onClose={onClose} closeLabel="Close assessment details" size="confirm" footer={<button className={secondary} onClick={onClose}>Close details</button>} />
}

export default function AssessmentManagementDialog({ assessment, onClose }) {
  return assessment ? <ManagementDetails assessment={assessment} onClose={onClose} /> : <UnavailableDialog onClose={onClose} />
}

function ManagementDetails({ assessment: a, onClose }) {
  const [editor, edit] = useReducer(assessmentEditorReducer, a, initialEditor)
  const { draft, baseline } = editor
  const dirty = draftIsDirty(draft, baseline)
  useEffect(() => { edit({ type: 'remote', assessment: a }) }, [a])
  const [section, setSection] = useState(0)
  const [confirmation, setConfirmation] = useState(null)
  const [saving, setSaving] = useState(false)
  const [retaking, setRetaking] = useState(false)
  const [lostAccess, setLostAccess] = useState(false)
  const [feedback, setFeedback] = useState(null)
  const [errors, setErrors] = useState({})
  const [studentId, setStudentId] = useState(null)
  const [studentPage, setStudentPage] = useState(1)
  const [studentSearch, setStudentSearch] = useState('')
  const [authorizedKey, setAuthorizedKey] = useState(false)
  const [questionPage, setQuestionPage] = useState(1)
  const id = useId()
  const tabRefs = useRef([])
  const rosterUrl = section === 2 && a.batch_id && !lostAccess ? `/api/instructor/batches/${a.batch_id}/students/` : null
  const questionUrl = section === 3 && authorizedKey && !lostAccess ? `${ASSESSMENTS_URL}${a.id}/questions/` : null
  const { data: rosterData, error: rosterError, errorStatus: rosterStatus } = useAssessmentQuery(rosterUrl)
  const { data: questionData, error: questionError, errorStatus: questionStatus } = useAssessmentQuery(questionUrl)
  const unavailable = lostAccess || (rosterUrl && [403, 404].includes(rosterStatus)) || (questionUrl && [403, 404].includes(questionStatus))
  const roster = rosterData?.students || []
  const students = roster.filter(s => `${s.name} ${s.school_id}`.toLowerCase().includes(studentSearch.trim().toLowerCase()))
  const currentStudentPage = Math.min(studentPage, Math.ceil(students.length / 10) || 1)
  const selectedStudent = roster.find(student => student.id === studentId)
  const questions = questionData?.questions || []
  const currentQuestionPage = Math.min(questionPage, Math.ceil(questions.length / 10) || 1)
  const remoteChanges = dirty && draftIsDirty(assessmentDraft(a), baseline)
  const retry = url => { fetchWithDedup(url).catch(() => {}) }

  function close() {
    if (saving || retaking) return
    if (dirty) setConfirmation('discard')
    else onClose()
  }
  function navigate(event, index) {
    const keys = { ArrowRight: (index + 1) % sections.length, ArrowLeft: (index + sections.length - 1) % sections.length, Home: 0, End: sections.length - 1 }
    if (!(event.key in keys)) return
    event.preventDefault()
    setSection(keys[event.key])
    tabRefs.current[keys[event.key]].focus()
    tabRefs.current[keys[event.key]].scrollIntoView({ block: 'nearest', inline: 'nearest' })
  }
  function prepareSave(event) {
    event.preventDefault()
    const next = validateAssessmentDraft(draft)
    setErrors(next)
    if (!Object.keys(next).length) setConfirmation('save')
    else setFeedback({ error: true, text: 'Check the highlighted settings before saving.' })
  }
  async function save() {
    setConfirmation(null)
    setSaving(true)
    setFeedback(null)
    try {
      const response = await api.patch(`${ASSESSMENTS_URL}${a.id}/`, { ...draft, duration_minutes: Number(draft.duration_minutes), display_order: Number(draft.display_order), available_at: manilaApiDate(draft.available_at), due_at: manilaApiDate(draft.due_at) })
      const updated = { ...a, ...response.data }
      // Publish immediately, then let the same cache/SSE path reconcile counts.
      updateCachedData(ASSESSMENTS_URL, (getCachedData(ASSESSMENTS_URL) || []).map(item => item.id === a.id ? { ...item, ...response.data } : item))
      edit({ type: 'saved', assessment: updated })
      const urls = [ASSESSMENTS_URL, '/api/admin/users/', '/api/admin/stats/']
      if (a.batch_id) urls.push(`/api/instructor/batches/${a.batch_id}/students/`)
      urls.forEach(invalidateCache)
      setFeedback({ text: 'Assessment updated. Student completion and recommendations now reflect the server state.' })
      setErrors({})
    } catch (err) {
      if ([403, 404].includes(err.response?.status)) setLostAccess(true)
      else {
        setFeedback({ error: true, text: err.response?.data?.error || 'Update failed. Please retry saving.' })
        if (err.response?.data?.field) setErrors({ [err.response.data.field]: err.response.data.error })
      }
    } finally { setSaving(false) }
  }
  async function retake(nextStudentId, assessmentId) {
    // This dialog manages only this assessment, including its retake approval.
    if (assessmentId !== a.id || retaking) return
    const attempt = roster.find(s => s.id === nextStudentId)?.assessment_results?.find(result => result.id === a.id)
    if (!attempt) return
    setRetaking(true)
    setFeedback(null)
    try {
      await api.patch(`/api/instructor/students/${nextStudentId}/retake/`, { assessment_id: a.id, retake_allowed: !attempt.retake_allowed })
      invalidateCache(rosterUrl)
      await fetchWithDedup(rosterUrl)
      const urls = [ASSESSMENTS_URL, '/api/admin/users/', '/api/admin/stats/']
      urls.forEach(invalidateCache)
      setFeedback({ text: 'Assessment-specific retake updated.' })
    } catch (err) {
      setFeedback({ error: true, text: err.response?.data?.error || 'Retake update failed. Please retry.' })
    } finally { setRetaking(false) }
  }

  if (unavailable) return <UnavailableDialog onClose={onClose} />
  return <DialogShell title={a.title} description="Review assessment details, edit settings, and manage student attempts." onClose={close} closeLabel="Close assessment details"
    headerDetails={<div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-gray-500 dark:text-gray-400"><AssessmentStatus status={a.publication_status} /><span>{a.instructor_name} · {a.batch_name || 'Unassigned batch'}</span></div>}
    footer={<div className="flex flex-wrap items-center justify-between gap-2"><p aria-live="polite" className={`text-xs ${dirty ? 'text-amber-800 dark:text-amber-300' : 'text-gray-500 dark:text-gray-400'}`}>{saving ? 'Saving changes…' : dirty ? 'Unsaved changes' : 'All settings saved'}</p><div className="flex gap-2"><button className={secondary} disabled={saving || retaking} onClick={close}>{dirty ? 'Cancel' : 'Close'}</button>{section === 1 && <button type="submit" form={`${id}-settings`} disabled={!dirty || saving || retaking} className={primary}>{saving && <ActionSpinner />}{saving ? 'Saving…' : 'Review & save'}</button>}</div></div>}>
    <div className="sb-detail-tabs px-2 sm:px-5" role="tablist" aria-label="Assessment management sections">{sections.map((name, index) => <button type="button" key={name} ref={node => { tabRefs.current[index] = node }} className="sb-detail-tab" role="tab" id={`${id}-tab-${index}`} aria-selected={section === index} aria-controls={`${id}-panel-${index}`} tabIndex={section === index ? 0 : -1} onClick={() => setSection(index)} onKeyDown={event => navigate(event, index)}>{name}</button>)}</div>
    <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-4 sm:p-6">
      {feedback && <p role={feedback.error ? 'alert' : 'status'} className={`mb-4 rounded-xl p-3 text-xs ${feedback.error ? 'bg-rose-50 text-rose-800 dark:bg-rose-950 dark:text-rose-300' : 'bg-green-50 text-green-800 dark:bg-green-950 dark:text-green-300'}`}>{feedback.text}</p>}
      {remoteChanges && <p role="status" className="mb-4 rounded-xl bg-amber-50 p-3 text-xs text-amber-900 dark:bg-amber-950 dark:text-amber-200">Settings changed on the server. Your unsaved edits are preserved. Review the latest overview before saving, or reset your draft to load current settings.</p>}
      {sections.map((name, index) => <div key={name} hidden={section !== index} role="tabpanel" id={`${id}-panel-${index}`} aria-labelledby={`${id}-tab-${index}`} tabIndex={0} className="min-w-0 focus-visible:outline-2 focus-visible:outline-green-600">
        {index === 0 && section === 0 && <div className="space-y-6"><div className="grid grid-cols-2 gap-3 sm:grid-cols-4">{[['Questions', a.question_count], ['Duration', `${a.duration_minutes} min`], ['Requirement', a.is_required ? 'Required' : 'Optional'], ['Competency', a.include_in_competency ? 'Included' : 'Excluded']].map(([title, value]) => <div key={title} className="rounded-xl border border-gray-100 p-3 dark:border-gray-800"><p className="text-xs text-gray-500 dark:text-gray-400">{title}</p><p className="mt-1 text-sm font-semibold text-gray-900 dark:text-white">{value}</p></div>)}</div>
          <section><h3 className="mb-3 text-sm font-semibold text-gray-900 dark:text-white">Completion & integrity</h3><AssessmentProgress assessment={a} /><div className="mt-3"><AssessmentIntegrity count={a.flagged_count} /></div></section>
          <section><h3 className="mb-3 text-sm font-semibold text-gray-900 dark:text-white">Schedule</h3><dl className="sb-detail-facts text-xs"><dt>Availability</dt><dd className="capitalize">{a.availability_status?.replaceAll('_', ' ')}</dd><dt>Opens · Manila</dt><dd>{a.available_at ? manilaDateTime(a.available_at) : 'No scheduled opening'}</dd><dt>Due · Manila</dt><dd>{a.due_at ? manilaDateTime(a.due_at) : 'No due date'}</dd><dt>Student display order</dt><dd>{a.display_order}</dd></dl></section>
          <section><h3 className="mb-3 text-sm font-semibold text-gray-900 dark:text-white">Skill categories</h3><CategorySummary categories={a.categories} /></section>
        </div>}
        {index === 1 && section === 1 && <form id={`${id}-settings`} onSubmit={prepareSave} noValidate><fieldset disabled={saving} className="space-y-5"><legend className="mb-1 text-sm font-semibold text-gray-900 dark:text-white">Assessment settings</legend><p className="text-xs text-gray-500 dark:text-gray-400">Review your changes before confirming. Dates use Asia/Manila.</p><div className="grid gap-4 sm:grid-cols-2"><label className="text-xs font-semibold text-gray-700 dark:text-gray-300">Title<input aria-label="Title" className={input} value={draft.title} aria-invalid={!!errors.title} aria-describedby={errors.title ? `${id}-title-error` : undefined} onChange={event => edit({ type: 'edit', draft: { ...draft, title: event.target.value } })} />{errors.title && <span id={`${id}-title-error`} className="text-rose-700 dark:text-rose-300">{errors.title}</span>}</label><label className="text-xs font-semibold text-gray-700 dark:text-gray-300">Duration · minutes<input aria-label="Duration · minutes" type="number" min="1" step="1" className={input} value={draft.duration_minutes} aria-invalid={!!errors.duration_minutes} onChange={event => edit({ type: 'edit', draft: { ...draft, duration_minutes: event.target.value } })} />{errors.duration_minutes && <span className="text-rose-700 dark:text-rose-300">{errors.duration_minutes}</span>}</label></div>
          <AssessmentSettings value={draft} errors={errors} onChange={next => edit({ type: 'edit', draft: next })} /><p className="text-xs leading-relaxed text-gray-500 dark:text-gray-400">Changing a required or included assessment can lock or recalculate final recommendations. Existing attempts and scores remain preserved.</p><button type="button" className={secondary} disabled={!dirty} onClick={() => { edit({ type: 'reset', assessment: a }); setErrors({}); setFeedback(null) }}>Reset to current settings</button>
        </fieldset></form>}
        {index === 2 && section === 2 && <section><h3 className="text-sm font-semibold text-gray-900 dark:text-white">Student attempts</h3><p className="mt-1 text-xs text-gray-500 dark:text-gray-400">Assessment-specific attempts and retake approvals.</p>{!a.batch_id ? <p className="py-6 text-sm">No batch assigned.</p> : <>
          <label className="mt-4 block text-xs text-gray-600 dark:text-gray-300">Search students<input type="search" className={input} value={studentSearch} onChange={event => { setStudentSearch(event.target.value); setStudentPage(1) }} placeholder="Name or student ID" /></label>
          {rosterError && <AssessmentRetry onRetry={() => retry(rosterUrl)}>{rosterData ? 'Could not refresh students. Showing the last loaded roster.' : 'Could not load student attempts.'}</AssessmentRetry>}
          {!rosterData && !rosterError ? <AssessmentSkeleton layout="list" count={5} /> : rosterData && <><fieldset disabled={retaking} aria-busy={retaking} className="mt-3 min-w-0"><legend className="sr-only">Students</legend>{students.slice((currentStudentPage - 1) * 10, currentStudentPage * 10).map(student => <button key={student.id} type="button" aria-pressed={studentId === student.id} className={`flex w-full flex-wrap items-center justify-between gap-2 border-b border-gray-100 p-3 text-left text-xs dark:border-gray-800 ${studentId === student.id ? 'bg-green-50 dark:bg-green-950' : 'hover:bg-gray-50 dark:hover:bg-gray-800'}`} onClick={() => setStudentId(student.id)}><span className="flex min-w-0 items-center gap-2"><Avatar name={student.name} photoUrl={student.photo_url} className="h-8 w-8 shrink-0 rounded-lg text-xs" /><span className="break-words">{student.name}<span className="mt-1 block text-gray-500 dark:text-gray-400">{student.school_id}</span></span></span><span className="capitalize text-gray-500 dark:text-gray-400">{student.assessment_results?.find(result => result.id === a.id)?.attempt_status?.replaceAll('_', ' ') || 'Not started'}</span></button>)}{!students.length && <p className="py-6 text-xs">{roster.length ? 'No students match this search.' : 'No students enrolled.'}</p>}
          </fieldset><AssessmentPagination total={students.length} page={currentStudentPage} onPage={setStudentPage} noun="students" /></>}
          {retaking && <p role="status" className="my-3 flex items-center gap-2 text-xs"><ActionSpinner />Updating retake approval…</p>}
          {selectedStudent && <fieldset disabled={retaking} className="mt-5 min-w-0 border-t border-gray-100 pt-4 dark:border-gray-800"><legend className="sr-only">Selected student details</legend><h4 className="mb-3 text-sm font-semibold text-gray-900 dark:text-white">{selectedStudent.name}</h4><AssessmentStudentDetail key={selectedStudent.id} student={selectedStudent} retakeAssessmentId={a.id} onToggleRetake={retake} /></fieldset>}
        </>}</section>}
        {index === 3 && section === 3 && <section className="space-y-4"><h3 className="text-sm font-semibold text-gray-900 dark:text-white">Questions & authorized answer key</h3><p className="text-xs text-gray-500 dark:text-gray-400">Answer keys load only when you explicitly request them. This view is restricted to authorized assessment managers.</p><button className={secondary} aria-expanded={authorizedKey} onClick={() => { setAuthorizedKey(value => !value); setQuestionPage(1) }}>{authorizedKey ? 'Hide answer key' : 'View authorized answer key'}</button>
          {authorizedKey && <>{questionError && <AssessmentRetry onRetry={() => retry(questionUrl)}>Could not load the authorized answer key.</AssessmentRetry>}{!questionData && !questionError ? <AssessmentSkeleton layout="list" count={4} /> : questionData && <><ol start={(currentQuestionPage - 1) * 10 + 1} className="list-decimal space-y-3 pl-5">{questions.slice((currentQuestionPage - 1) * 10, currentQuestionPage * 10).map(q => <li key={q.id} className="break-words rounded-lg border border-gray-100 p-3 text-sm dark:border-gray-800"><p className="font-medium text-gray-900 dark:text-white">{q.question_text}</p><p className="mt-1 text-xs text-gray-500 dark:text-gray-400">{q.category?.name || 'Uncategorized'} · {q.question_type?.replaceAll('_', ' ')}</p><p className="mt-2 text-xs text-green-800 dark:text-green-300">Key: {q.choices?.filter(c => c.is_correct).map(c => c.text).join(', ') || 'No answer key provided'}</p></li>)}</ol>{!questions.length && <p className="text-xs">No questions added.</p>}<AssessmentPagination total={questions.length} page={currentQuestionPage} onPage={setQuestionPage} noun="questions" /></>}</>}
        </section>}
      </div>)}
    </div>
    {confirmation && <ConfirmModal tone={confirmation === 'discard' ? 'danger' : 'confirm'} title={confirmation === 'discard' ? 'Discard unsaved changes?' : 'Save assessment changes?'} message={confirmation === 'discard' ? 'Your unsaved settings will be lost. Saved assessment data and attempts will stay intact.' : 'Publication, required status, and competency inclusion can change student completion and recommendation locks. Existing attempts stay intact. The server will recalculate affected profiles.'} confirmLabel={confirmation === 'discard' ? 'Discard changes' : 'Save'} onCancel={() => setConfirmation(null)} onConfirm={confirmation === 'discard' ? onClose : save} />}
  </DialogShell>
}
