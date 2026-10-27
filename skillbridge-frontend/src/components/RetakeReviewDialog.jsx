import { useId, useRef, useState } from 'react'
import api from '../api/axios'
import DialogShell from './DialogShell'
import Avatar from './Avatar'
import RetakeEvidence from './RetakeEvidence'
import { ChevronDown, RefreshIcon } from './Icons'

const button = 'min-h-11 cursor-pointer rounded-lg border px-4 py-2 text-xs font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-green-600 disabled:cursor-not-allowed disabled:opacity-50'
const reasonLabels = { window_lost_focus: 'Window lost focus', tab_hidden: 'Assessment hidden', fullscreen_exited: 'Fullscreen exited', page_closed: 'Page closed or reloaded' }
const seconds = new Intl.NumberFormat('en-PH', { maximumFractionDigits: 1 })
const recordDate = new Intl.DateTimeFormat('en-PH', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZone: 'Asia/Manila' })
function hasDuration(event) { return typeof event.duration_seconds === 'number' && Number.isFinite(event.duration_seconds) && event.duration_seconds >= 0 }
function recordedAt(value) {
  const date = value ? new Date(value) : null
  return date && !Number.isNaN(date.getTime()) ? recordDate.format(date) : 'Time not recorded'
}

function InterruptionRecords({ events, draftCount }) {
  const [expanded, setExpanded] = useState(false)
  const recordsId = useId()
  const recorded = events.filter(hasDuration)
  const total = recorded.reduce((sum, event) => sum + event.duration_seconds, 0)
  const durationSummary = recorded.length ? `${seconds.format(total)} seconds ${recorded.length === events.length ? 'total' : 'recorded'}` : 'Duration not recorded'
  return <section className="retake-records">
    <div className="retake-records-heading"><h3>Interruption records</h3><p className="retake-muted">{events.length} record{events.length === 1 ? '' : 's'}{events.length > 0 && ` · ${durationSummary}`}</p></div>
    <button type="button" className="retake-records-toggle" aria-expanded={expanded} aria-controls={recordsId} onClick={() => setExpanded(value => !value)}><span aria-hidden="true"><ChevronDown open={expanded} size={16} /></span>Interruption records · {events.length}</button>
    <div id={recordsId} className={`retake-records-content ${expanded ? 'is-open' : ''}`}>
      <p className="retake-records-mobile-total retake-muted">{events.length > 0 && durationSummary}</p>
      {events.length ? <ol className="retake-timeline">{events.map(event => <li key={event.id}>
        <div className="min-w-0"><p className="font-semibold text-gray-900 dark:text-gray-100">{event.reasons?.map(reason => reasonLabels[reason] || reason.replaceAll('_', ' ')).join(' · ') || 'Interruption recorded'}</p><p className="mt-1 retake-muted">{recordedAt(event.started_at)}</p></div>
        <span className={`retake-duration ${hasDuration(event) ? '' : 'is-unknown'}`}>{hasDuration(event) ? `${seconds.format(event.duration_seconds)} sec` : 'Recovery not recorded'}</span>
      </li>)}</ol> : <p className="retake-muted">No interruption records available.</p>}
      {draftCount > 0 && <p className="mt-3 retake-muted">{draftCount} unsubmitted draft answers retained, without grading or completion credit.</p>}
    </div>
  </section>
}

export default function RetakeReviewDialog({ row, onClose, onSaved }) {
  const formId = useId()
  const [note, setNote] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const pending = useRef(false)
  const canReview = row.request.status === 'pending' && !row.read_only

  async function review(event) {
    event.preventDefault()
    const decision = event.nativeEvent.submitter?.value
    if (pending.current || !canReview || !['approved', 'declined'].includes(decision)) return
    pending.current = true
    setSaving(true); setError('')
    try {
      await api.post(`/api/assessments/${row.assessment_id}/retake-requests/${row.student_id}/review/`, {
        decision, note: note.trim(), attempt_started_at: row.attempt_started_at, request_id: row.request.request_id,
      })
      onSaved(decision)
    } catch (failure) {
      setError(failure.response?.data?.error || 'Review could not be saved. Refresh the queue before retrying.')
    } finally { pending.current = false; setSaving(false) }
  }

  return <DialogShell title={canReview ? 'Review retake request' : 'Retake request details'}
    description={`Retake request from ${row.student} for ${row.assessment}.`}
    avatar={<span className="retake-review-symbol" aria-hidden="true"><RefreshIcon size={24} /></span>}
    headerDetails={<p className="mt-1 text-xs text-gray-500 dark:text-gray-400">Assessment attempt review</p>}
    size="retake" closeLabel="Close retake request" onClose={() => { if (!saving) onClose() }}
    footer={canReview ? <>
      <div className="retake-review-footer"><p className="text-xs text-gray-500 dark:text-gray-400">Approval allows a new attempt; it does not start it.</p>
      <div className="flex flex-wrap justify-end gap-2">
        <button type="submit" form={formId} value="declined" disabled={saving} className={`${button} border-gray-300 bg-white text-gray-700 hover:border-rose-300 hover:bg-rose-50 hover:text-rose-800 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-200 dark:hover:bg-rose-950/40 dark:hover:text-rose-200`}>Decline</button>
        <button type="submit" form={formId} value="approved" disabled={saving} className={`${button} border-green-700 bg-green-700 text-white hover:bg-green-800`}>{saving ? 'Saving decision…' : 'Approve retake'}</button>
      </div>
      </div>
    </> : <button type="button" onClick={onClose} className={`${button} border-gray-300 bg-white text-gray-700 hover:bg-gray-100 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-200 dark:hover:bg-gray-800`}>Close</button>}>
    <div className="retake-review-body text-xs leading-relaxed">
      <div className="retake-review-identity">
        <div className="retake-review-student"><Avatar name={row.student} tone="neutral" className="h-10 w-10 rounded-full text-xs" /><div className="min-w-0"><p className="break-words font-semibold text-gray-900 dark:text-white">{row.student}</p><p className="break-words retake-muted">{row.school_id || 'No student ID'} · {row.batch || 'No batch'}</p></div></div>
        <div className="retake-review-assessment"><p className="font-semibold text-gray-900 dark:text-white">{row.assessment}</p><p className="retake-muted">{row.attempt_status === 'stopped' ? 'Stopped' : row.attempt_status} · {row.stopped_reason || 'No stop reason recorded'}</p>
          {row.history_id && <p className="retake-muted">Previous attempt · Read only</p>}
          {row.read_only && !row.history_id && <p className="retake-muted">Archived account, batch or assessment · Read only</p>}
        </div>
        <span className="retake-status" data-status={row.request.status}>{row.request.status}</span>
      </div>
      <div className="retake-review-columns">
        <div className="retake-review-evidence space-y-6">
          <section><h3>Student explanation</h3><p className="mt-2 whitespace-pre-wrap break-words">{row.request.explanation}</p></section>
          <section><h3>Supporting image</h3><p className="mb-3 retake-muted">Student-provided evidence</p>
            {row.has_image ? <RetakeEvidence assessmentId={row.assessment_id} studentId={row.student_id} historyId={row.history_id} /> : <p className="rounded-xl border border-dashed border-gray-200 p-4 whitespace-pre-wrap break-words dark:border-gray-700"><span className="font-medium">No image available: </span>{row.request.no_image_reason || 'No reason recorded.'}</p>}
          </section>
        </div>
        <div className="retake-review-decision space-y-5">
          <InterruptionRecords events={row.interruptions || []} draftCount={row.unsubmitted_draft_count} />
          {row.request.review_note && <section className="retake-review-note"><h3>Review note</h3><p className="mt-2 whitespace-pre-wrap break-words">{row.request.review_note}</p></section>}
          {canReview && <form id={formId} onSubmit={review} className="retake-review-note">
            <label htmlFor={`${formId}-note`} className="block font-semibold text-gray-900 dark:text-gray-100">Review note</label>
            <p id={`${formId}-help`} className="mb-2 retake-muted">Required · 10–1000 characters</p>
            <textarea id={`${formId}-note`} required minLength={10} maxLength={1000} aria-describedby={`${formId}-help ${formId}-count`} rows={5} value={note} disabled={saving} onChange={event => setNote(event.target.value)}
              className="w-full rounded-lg border border-gray-300 bg-white p-3 text-xs font-normal focus:border-green-600 focus:outline-2 focus:outline-green-600 dark:border-gray-600 dark:bg-gray-950 dark:text-gray-100" />
            <p id={`${formId}-count`} className="mt-1 text-right retake-muted">{note.length}/1000</p>
            {error && <p role="alert" className="mt-3 text-rose-700 dark:text-rose-300">{error}</p>}
          </form>}
        </div>
      </div>
      <p className="retake-review-info"><span aria-hidden="true">i</span>Evidence supports review; it does not confirm the cause of an interruption.</p>
    </div>
  </DialogShell>
}
