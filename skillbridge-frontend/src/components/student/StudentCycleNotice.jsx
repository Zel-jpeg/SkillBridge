import { useEffect, useId, useRef, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useApi, invalidateCache, fetchWithDedup } from '../../hooks/useApi'
import { ArchiveIcon, CheckCircleIcon, ChevronRightIcon, ClockIcon } from '../Icons'
import Pagination from '../Pagination'
import './studentPreviousBatches.css'

const HISTORY_URL = '/api/students/me/history/?previous=1'
const button = 'inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border border-green-300 px-3 py-2 text-xs font-semibold text-green-800 transition-colors hover:border-green-600 hover:bg-green-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-green-600 disabled:cursor-not-allowed disabled:opacity-50 dark:border-green-800 dark:text-green-300 dark:hover:border-green-500 dark:hover:bg-green-950'
const attemptLabels = { submitted: 'Submitted', stopped: 'Stopped', in_progress: 'In progress' }

function PreviousBatch({ item }) {
  const assessments = item.assessments || []
  const submitted = assessments.filter(assessment => assessment.attempt_status === 'submitted').length
  return <details className="sb-previous-batch">
    <summary className="sb-previous-batch-summary">
      <span aria-hidden="true" className="sb-previous-batch-chevron"><ChevronRightIcon size={16} /></span>
      <span className="min-w-0 flex-1"><span className="block break-words font-semibold text-gray-900 dark:text-white">{item.batch.name}</span><span className="mt-1 block text-gray-500 dark:text-gray-400">{submitted} of {assessments.length} assessments submitted</span></span>
      <span className="sb-previous-batch-badge">{item.batch.status === 'archived' ? 'Archived' : 'Previous batch'}</span>
    </summary>
    <div className="sb-previous-batch-body">
      <section aria-label="Previous assessment results" className="min-w-0">
        <h3 className="font-semibold text-gray-900 dark:text-white">Assessment results</h3>
        {assessments.length ? <div className="sb-previous-assessments">{assessments.map(assessment => <article key={assessment.id} className="sb-previous-assessment">
          {(assessment.category_scores?.length ? assessment.category_scores : [null]).map((category, index) => {
            const hasScore = typeof category?.percentage === 'number' && Number.isFinite(category.percentage)
            return <div key={category?.category_id ?? 'unscored'} className="sb-previous-result-row">
              <div className="sb-previous-result-identity">{index === 0 && <h4 className="font-semibold text-gray-900 dark:text-white">{assessment.title}</h4>}<p className="mt-1 break-words text-gray-500 dark:text-gray-400">{category?.category || '—'}</p></div>
              {index === 0 ? <span className={`sb-previous-attempt-status ${assessment.attempt_status === 'submitted' ? 'is-submitted' : ''}`}><span aria-hidden="true">{assessment.attempt_status === 'submitted' ? <CheckCircleIcon size={13} /> : <ClockIcon size={13} />}</span>{attemptLabels[assessment.attempt_status] || 'Not started'}</span> : <span aria-hidden="true" />}
              <dl className="sb-previous-result-score"><dt className="sr-only">{category?.category ? `${category.category} score` : 'Assessment score'}</dt><dd className="sb-previous-score-value"><span aria-hidden="true" className="sb-previous-score-track">{hasScore && <span style={{ width: `${Math.min(100, Math.max(0, category.percentage))}%` }} />}</span><span className="sb-previous-score-number">{hasScore ? `${category.raw_score}/${category.max_score} (${category.percentage}%)` : <><span aria-hidden="true">—</span><span className="sr-only">No submitted score</span></>}</span></dd></dl>
            </div>
          })}
        </article>)}</div> : <p className="mt-3 text-gray-500 dark:text-gray-400">No assessment records for this batch.</p>}

      </section>
      <aside className="sb-previous-decisions" aria-label="Previous placement decisions">
        <h3 className="font-semibold text-gray-900 dark:text-white">Recorded placement {item.placements?.length > 1 ? 'decisions' : 'decision'}</h3>
        {item.placements?.length ? <div className="mt-3 space-y-2">{item.placements.map(placement => <div key={placement.id} className="sb-previous-decision">
          <span aria-hidden="true" className="shrink-0"><CheckCircleIcon size={30} /></span><div className="min-w-0 space-y-1"><p className="font-semibold">{placement.status === 'completed' ? 'Legacy decision record' : 'Approved'}</p><p className="break-words font-medium text-gray-900 dark:text-white">{placement.position.title}</p><p className="break-words text-gray-600 dark:text-gray-300">{placement.company.name}</p></div>
        </div>)}</div> : <p className="mt-3 leading-5 text-gray-500 dark:text-gray-400">No placement decision recorded for this batch.</p>}
        <p className="sb-previous-readonly"><span aria-hidden="true" className="sb-previous-info">i</span><span>These records are read-only.</span></p>
        {item.snapshot_at && <p className="mt-2 leading-5 text-gray-500 dark:text-gray-400">Records saved {new Date(item.snapshot_at).toLocaleDateString('en-PH', { timeZone: 'Asia/Manila', month: 'short', day: 'numeric', year: 'numeric' })}.</p>}
        {item.outcome && <p className="mt-2 break-words leading-5 text-gray-600 dark:text-gray-300">Recorded note: {item.outcome}</p>}
      </aside>
    </div>
  </details>
}

export default function StudentCycleNotice({ review = false, historyInitiallyOpen = false, historyMode = 'full', showNotices = true }) {
  const { data: student } = useApi('/api/students/me/')
  const location = useLocation()
  const [historyOpen, setHistoryOpen] = useState(() => historyInitiallyOpen || (historyMode === 'full' && location.hash === '#previous-batches'))
  const hasPrevious = student?.has_previous_batches === true
  const showHistory = hasPrevious && historyMode === 'full'
  const showHistoryLink = hasPrevious && historyMode === 'link'
  const { data: history, error: historyError, loading } = useApi(showHistory && historyOpen ? HISTORY_URL : null)
  const { request } = useApi()
  const [page, setPage] = useState(1)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const pending = useRef(false)
  const historyId = useId()
  const historyRef = useRef(null)
  useEffect(() => {
    if (showHistory && location.hash === '#previous-batches') historyRef.current?.scrollIntoView({ block: 'start' })
  }, [showHistory, location.hash])
  async function confirm() {
    if (pending.current) return
    pending.current = true; setBusy(true); setMessage('')
    try {
      const result = await request('post', '/api/students/me/confirm-profile/', { batch_id: student.batch.id }, { silentError: true })
      setMessage(result.ok ? 'Your details are confirmed. You can start your new batch assessments.' : result.message || 'Save your profile details, then try confirming again.')
      if (result.ok) { invalidateCache('/api/students/me/'); invalidateCache('/api/assessments/'); invalidateCache('/api/student/results/') }
    } finally { pending.current = false; setBusy(false) }
  }
  // Filter cached responses too, so a transfer never shows the current batch as history.
  const batches = (history?.batches || []).filter(item => item.batch.id !== student?.batch?.id)
  const currentPage = Math.min(page, Math.max(1, Math.ceil(batches.length / 5)))
  const needsNotice = showNotices && (student?.profile_review_required || (student && !student.batch) || message)
  if (!student || (!needsNotice && !showHistory && !showHistoryLink)) return null
  const historyLink = <Link className="inline-flex min-h-10 items-center gap-1 rounded-lg px-2 text-xs font-medium text-green-800 transition-colors hover:bg-green-50 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-green-600 dark:text-green-300 dark:hover:bg-green-950" to="/student/profile#previous-batches">View previous records<ChevronRightIcon size={14} /></Link>
  if (!needsNotice && showHistoryLink) return <div className="my-2 flex justify-end">{historyLink}</div>
  return <section className={`my-5 space-y-4 rounded-2xl border border-gray-200 bg-white p-4 text-xs dark:border-gray-800 dark:bg-gray-900 sm:p-5 ${showHistory ? 'sb-previous-records' : ''}`} aria-label={showHistory ? 'Previous batch records' : 'Current batch notice'}>
    {showNotices && student.profile_review_required && <div className="space-y-3 rounded-xl bg-green-50 p-4 dark:bg-green-950/50"><h2 className="text-sm font-semibold text-gray-900 dark:text-white">Welcome to {student.batch?.name}</h2><p className="leading-5 text-gray-600 dark:text-gray-300">Review your phone, residence, travel preference and map pin before starting this batch's assessments.</p>{review ? <><p className="leading-5 text-gray-600 dark:text-gray-300">Save any profile changes below, then confirm your details for this batch.</p><button className={button} disabled={busy} onClick={confirm}>{busy ? 'Confirming…' : 'Confirm saved details for this batch'}</button></> : <Link className={button} to="/student/profile">Review & confirm profile</Link>}</div>}
    {showNotices && !student.batch && <div className="space-y-2"><h2 className="text-sm font-semibold text-gray-900 dark:text-white">No active OJT batch</h2><p className="leading-5 text-gray-600 dark:text-gray-300">Your instructor or administrator can enroll your existing account in a new batch.{showHistory ? ' Your earlier records remain available below.' : hasPrevious ? ' Your earlier records are available in Profile.' : ''}</p></div>}
    {showNotices && message && <p role="status" className="leading-5 text-gray-700 dark:text-gray-200">{message}</p>}
    {showHistoryLink && <div className="flex justify-end">{historyLink}</div>}
    {showHistory && <div ref={historyRef} id="previous-batches" className="scroll-mt-24 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3"><span aria-hidden="true" className="rounded-xl bg-gray-100 p-2.5 text-gray-500 dark:bg-gray-800 dark:text-gray-400"><ArchiveIcon size={18} /></span><div><h2 className="sb-previous-heading">Previous batches</h2><p className="mt-1 leading-5 text-gray-500 dark:text-gray-400">View your earlier assessment results and placement decisions.</p></div></div>
        <button className="sb-previous-toggle" aria-controls={historyId} aria-expanded={historyOpen} onClick={() => setHistoryOpen(value => !value)}>{historyOpen ? 'Hide records' : 'View records'}<span aria-hidden="true" className={`transition-transform ${historyOpen ? '-rotate-90' : 'rotate-90'}`}><ChevronRightIcon size={14} /></span></button>
      </div>
      {historyOpen && <div id={historyId} className="space-y-3">
        {loading && !history && <p role="status" className="rounded-lg bg-gray-50 p-4 text-gray-500 dark:bg-gray-800 dark:text-gray-400">Loading your previous batches…</p>}
        {historyError && <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-rose-50 p-3 text-rose-800 dark:bg-rose-950 dark:text-rose-200"><p>We couldn't load your previous batches. Please try again.</p><button className={button} onClick={() => fetchWithDedup(HISTORY_URL).catch(() => {})}>Retry previous batches</button></div>}
        {history && !batches.length && !historyError && <p className="rounded-lg bg-gray-50 p-4 leading-5 text-gray-500 dark:bg-gray-800 dark:text-gray-400">No previous batch records to show. Find your current assessments on the Assessments page.</p>}
        {batches.slice((currentPage - 1) * 5, currentPage * 5).map(item => <PreviousBatch key={item.batch.id} item={item} />)}
        <Pagination total={batches.length} page={currentPage} pageSize={5} onPage={setPage} />
      </div>}
    </div>}
  </section>
}
