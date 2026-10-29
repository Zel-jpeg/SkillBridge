import { useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useApi, invalidateCache, fetchWithDedup } from '../hooks/useApi'
import DialogShell from './DialogShell'
import ConfirmModal from './admin/ConfirmModal'
import { downloadCycleReport } from '../utils/cycleReports'

const button = 'inline-flex min-h-11 items-center justify-center rounded-xl border border-gray-300 px-3 py-2 text-xs font-semibold text-green-800 hover:bg-green-50 disabled:opacity-50 dark:border-gray-700 dark:text-green-300 dark:hover:bg-green-950 focus-visible:outline-2 focus-visible:outline-green-600'

export default function BatchReportReview({ batchId, role, mode = 'launcher', onClose, onSaved }) {
  const [screen, setScreen] = useState(null)
  const [confirming, setConfirming] = useState(false)
  const [reviewed, setReviewed] = useState(false)
  const [note, setNote] = useState('')
  const [version, setVersion] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const pending = useRef(false)
  const current = mode === 'launcher' ? screen : mode
  const url = `/api/instructor/batches/${batchId}/closeout/`
  const { data, loading, error: readError, errorStatus } = useApi(current ? url : null)
  const { request } = useApi()
  const preview = [401, 403, 404].includes(errorStatus) ? null : data?.preview
  const blocked = preview && (preview.unfinished_attempts > 0 || preview.pending_retakes > 0)
  function close() { if (!pending.current) { setScreen(null); onClose?.() } }
  async function archive() {
    if (pending.current) return
    pending.current = true; setBusy(true); setError('')
    try {
      const result = await request('post', url, { review_token: data.review_token, note }, { silentError: true })
      if (!result.ok) { setError(result.message || 'Review the latest batch records before retrying.'); setConfirming(false); invalidateCache(url); return result }
      setConfirming(false); setVersion(String(result.data.version)); setScreen('reports')
      invalidateCache('/api/instructor/batches/'); invalidateCache('/api/placements/'); invalidateCache(url)
      onSaved?.()
      await fetchWithDedup(url)
    } catch { setError('The report may have been saved. Refresh the batch before retrying.') }
    finally { pending.current = false; setBusy(false) }
  }
  async function download(format) {
    if (pending.current) return
    pending.current = true; setBusy(true); setError('')
    try {
      const { data: saved } = await fetchWithDedup(`${url}?version=${version || preview.snapshot_count}`)
      await downloadCycleReport(saved, format)
    } catch { setError('Could not download this saved version. Try again; its records remain preserved.') }
    finally { pending.current = false; setBusy(false) }
  }
  const content = <div className="space-y-5 p-4 text-xs leading-6 sm:p-6">
    {loading && !preview && <p role="status">Loading batch records…</p>}
    {(error || readError) && <p role="alert" className="text-rose-700 dark:text-rose-300">{error || readError}</p>}
    {preview && (current === 'reports' ? <>
      <div><h3 className="text-sm font-semibold">Saved batch reports</h3><p className="mt-1 text-gray-600 dark:text-gray-300">{preview.batch.name} · Downloads use the facts recorded when each report was saved.</p></div>
      {preview.snapshot_count > 0 ? <div className="flex flex-wrap items-center gap-3"><label>Saved version <select className="ml-2 min-h-11 rounded-xl border border-gray-300 bg-transparent px-3 dark:border-gray-700" value={version || String(preview.snapshot_count)} onChange={e => setVersion(e.target.value)}>{Array.from({ length: preview.snapshot_count }, (_, i) => <option key={i} value={i + 1}>Version {i + 1}</option>)}</select></label>{['pdf', 'xlsx', 'csv'].map(format => <button key={format} className={button} disabled={busy} onClick={() => download(format)}>Download {format.toUpperCase()}</button>)}</div> : <p className="rounded-xl border border-gray-200 p-4 text-gray-600 dark:border-gray-700 dark:text-gray-300">No saved report yet. Use Batch actions → Save report & archive batch when this recommendation cycle is ready to close. Older archives may not have a saved report.</p>}
      <p className="text-gray-500 dark:text-gray-400">Saved reports preserve assessment scores, ranked matches, coordinator decisions and the openings recorded at that time.</p>
    </> : <>
      <p className="text-gray-600 dark:text-gray-300">Review <strong>{preview.batch.name}</strong> before archiving this recommendation batch. Its student records and approved decisions will stay in history.</p>
      <dl className="grid grid-cols-3 gap-3">{[['Students', preview.students.length], ['Assessments', preview.assessment_definitions.length], ['Approved decisions', preview.approved_decisions]].map(([label, value]) => <div className="rounded-xl border border-gray-200 p-3 dark:border-gray-700" key={label}><dt className="text-gray-500 dark:text-gray-400">{label}</dt><dd className="mt-1 text-xl font-bold">{value}</dd></div>)}</dl>
      <div className="space-y-2"><p>{preview.unfinished_attempts} unfinished assessment attempts · {preview.pending_retakes} unresolved retakes</p>{blocked && <p role="alert" className="text-amber-800 dark:text-amber-300">Resolve these assessment items before archiving. Students who have not started or have no approved decision may remain on the final report.</p>}<div className="flex flex-wrap gap-2"><Link className={button} to={`/${role}/assessments`}>Review assessments</Link><Link className={button} to={`/${role}/retake-requests`}>Review retakes</Link><Link className={button} to={`/${role}/placements`}>Review decisions</Link></div></div>
      <div className="rounded-xl bg-gray-50 p-4 dark:bg-gray-800"><p className="font-semibold">What happens next</p><ul className="mt-2 list-disc space-y-1 pl-5"><li>A dated report version is saved.</li><li>This batch becomes read-only. Its current allocations release their slots.</li><li>Previous decisions stay unchanged. Partners remain available for other batches.</li></ul></div>
      <label className="block">Archive note (optional)<textarea value={note} onChange={e => setNote(e.target.value)} maxLength={500} rows={2} className="mt-2 block w-full rounded-xl border border-gray-300 bg-transparent p-3 dark:border-gray-700" /></label>
      {preview.batch.status === 'active' ? <><label className="flex items-start gap-3"><input type="checkbox" checked={reviewed} onChange={e => setReviewed(e.target.checked)} className="mt-1" />I have reviewed this batch’s records and allocation changes.</label><button className={`${button} bg-green-50 dark:bg-green-950`} disabled={busy || blocked || !reviewed} onClick={() => setConfirming(true)}>Save report & archive batch</button></> : <p>This batch is archived. Open Saved reports to download its recorded versions.</p>}
    </>)}
  </div>
  return <>
    {mode === 'launcher' && <div className="flex flex-wrap gap-2"><button className={button} onClick={() => { setScreen('review'); setReviewed(false) }}>Review & archive batch</button><button className={button} onClick={() => setScreen('reports')}>Saved reports</button></div>}
    {current && (mode === 'reports' ? <section className="rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900">{content}</section> : <DialogShell title={current === 'reports' ? 'Saved batch reports' : 'Review & archive batch'} description="Save recommendation records and archive the selected batch." onClose={close} closeDisabled={busy}>{content}</DialogShell>)}
    {confirming && <ConfirmModal tone="confirm" title="Save report and archive?" message={`Save a report for ${preview.batch.name} and make the batch read-only? Its current allocations will release their slots. Student records and coordinator decisions stay preserved.`} confirmLabel="Save report & archive" onCancel={() => { if (!busy) setConfirming(false) }} onConfirm={archive} />}
  </>
}
