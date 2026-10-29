import { useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useApi, invalidateCache } from '../../hooks/useApi'
import Pagination from '../Pagination'

const button = 'inline-flex min-h-11 items-center rounded-xl border border-green-300 px-3 py-2 text-xs font-semibold text-green-800 hover:bg-green-50 focus-visible:outline-2 focus-visible:outline-green-600 dark:border-green-800 dark:text-green-300 dark:hover:bg-green-950'

export default function StudentCycleNotice({ review = false, historyInitiallyOpen = false }) {
  const { data: student } = useApi('/api/students/me/')
  const [historyOpen, setHistoryOpen] = useState(historyInitiallyOpen)
  const { data: history, error: historyError, loading } = useApi(historyOpen ? '/api/students/me/history/' : null)
  const { request } = useApi()
  const [page, setPage] = useState(1)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const pending = useRef(false)
  async function confirm() {
    if (pending.current) return
    pending.current = true; setBusy(true); setMessage('')
    try {
      const result = await request('post', '/api/students/me/confirm-profile/', { batch_id: student.batch.id }, { silentError: true })
      setMessage(result.ok ? 'Your details are confirmed. You can start your new batch assessments.' : result.message || 'Save your profile details, then try confirming again.')
      if (result.ok) { invalidateCache('/api/students/me/'); invalidateCache('/api/assessments/'); invalidateCache('/api/student/results/') }
    } finally { pending.current = false; setBusy(false) }
  }
  const batches = history?.batches || []
  const currentPage = Math.min(page, Math.max(1, Math.ceil(batches.length / 5)))
  return <section className="my-5 space-y-4 rounded-2xl border border-gray-200 bg-white p-4 text-xs dark:border-gray-800 dark:bg-gray-900 sm:p-5" aria-label="Your OJT batch and history">
    {student?.profile_review_required && <div className="space-y-3"><h2 className="text-sm font-semibold">Welcome to {student.batch?.name}</h2><p className="leading-6 text-gray-600 dark:text-gray-300">Your previous records are preserved. Review your phone, residence, travel preference and map pin before starting the new assessments.</p>{review ? <><p className="leading-6">Save any changes in the profile below, then confirm your saved details for this batch.</p><button className={button} disabled={busy} onClick={confirm}>{busy ? 'Confirming…' : 'Confirm saved details for this batch'}</button></> : <Link className={button} to="/student/profile">Review & confirm profile</Link>}</div>}
    {student && !student.batch && <div className="space-y-2"><h2 className="text-sm font-semibold">No active OJT batch</h2><p className="leading-6 text-gray-600 dark:text-gray-300">Your previous results remain on record. Your instructor or administrator can enroll your existing account in the next batch.</p></div>}
    {message && <p role="status" className="leading-6">{message}</p>}
    <button className={button} aria-expanded={historyOpen} onClick={() => setHistoryOpen(v => !v)}>{historyOpen ? 'Hide batch history' : 'View batch history'}</button>
    {historyOpen && <div className="space-y-4">
      {loading && !history && <p role="status">Loading your recorded batches…</p>}
      {historyError && <p role="alert" className="text-rose-700 dark:text-rose-300">Could not load your history. {historyError}</p>}
      {history && !batches.length && <p>No recorded batches yet.</p>}
      {batches.slice((currentPage - 1) * 5, currentPage * 5).map(item => <details key={item.batch.id} className="rounded-xl border border-gray-200 p-3 dark:border-gray-700"><summary className="min-h-10 cursor-pointer font-semibold leading-6 focus-visible:outline-2 focus-visible:outline-green-600">{item.batch.name} · {item.batch.status === 'archived' ? 'Archived' : 'Active'}</summary>
        <div className="mt-3 space-y-3 leading-6"><p className="text-gray-500">{item.snapshot_at ? `Saved closeout: ${new Date(item.snapshot_at).toLocaleString('en-PH', { timeZone: 'Asia/Manila' })} (Manila)` : 'No final closeout snapshot. These are retained assessment records.'}</p>{item.outcome && <p>Recorded outcome: {item.outcome}</p>}
          {item.placements.map(p => <p key={p.id}>{p.status === 'completed' ? 'Legacy decision record' : p.status === 'approved' ? 'Approved decision' : p.status}: {p.position.title} at {p.company.name}</p>)}
          {item.assessments.map(a => <div key={a.id}><h3 className="font-semibold">{a.title} · {a.attempt_status || 'Not started'}</h3>{a.category_scores.map(c => <p key={c.category_id}>{c.category}: {c.raw_score}/{c.max_score} ({c.percentage}%)</p>)}</div>)}
        </div></details>)}
      <Pagination total={batches.length} page={currentPage} pageSize={5} onPage={setPage} />
    </div>}
  </section>
}
