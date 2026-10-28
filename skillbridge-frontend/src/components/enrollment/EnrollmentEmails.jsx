import { useMemo, useRef, useState } from 'react'
import api from '../../api/axios'
import { requestErrorMessage } from '../../api/requestErrors'
import { useApi, invalidateCache } from '../../hooks/useApi'
import DialogShell from '../DialogShell'
import DataSection from '../DataSection'
import Pagination from '../Pagination'
import Avatar from '../Avatar'
import ActionMenu from '../ActionMenu'
import EmailProgress from './EmailProgress'
import { AlertTriangleIcon, MailIcon, RefreshIcon, SearchIcon, SendIcon } from '../Icons'
import { useToast } from '../../context/ToastContext'
import './enrollmentEmails.css'

const button = 'inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-gray-300 px-3 py-2 text-xs font-medium hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-gray-600 dark:hover:bg-gray-800 focus-visible:outline-2 focus-visible:outline-green-600'
const primary = `${button} border-green-600 bg-green-600 text-white hover:bg-green-700 dark:border-green-600 dark:hover:bg-green-700`
const field = 'mt-1 min-h-11 w-full min-w-0 rounded-lg border border-gray-300 bg-white px-3 py-2 text-xs focus-visible:outline-2 focus-visible:outline-green-600 dark:border-gray-600 dark:bg-gray-900'
const checkbox = 'h-4 w-4 shrink-0 accent-green-600 disabled:cursor-not-allowed'
const link = 'min-h-11 text-left font-medium text-green-800 underline underline-offset-4 disabled:cursor-not-allowed disabled:opacity-50 dark:text-green-300'
const pending = new Set(['queued', 'quota', 'retry', 'sending', 'provider_pending', 'accepted'])
const attention = new Set(['failed', 'uncertain'])
const labels = { send: 'Send selected', retry: 'Retry eligible failures', resend: 'Send again', hold: 'Hold unsent emails', cancel: 'Cancel unsent emails' }
const dateFormatter = new Intl.DateTimeFormat('en-PH', { timeZone: 'Asia/Manila', dateStyle: 'medium', timeStyle: 'short' })
const date = value => value ? dateFormatter.format(new Date(value)) : '—'

function Status({ row }) {
  const tone = row.status === 'delivered' ? 'bg-green-50 text-green-800 dark:bg-green-950 dark:text-green-200'
    : attention.has(row.status) ? 'bg-rose-50 text-rose-800 dark:bg-rose-950 dark:text-rose-200'
      : row.status === 'quota' ? 'bg-amber-50 text-amber-900 dark:bg-amber-950 dark:text-amber-200'
        : pending.has(row.status) ? 'bg-blue-50 text-blue-800 dark:bg-blue-950 dark:text-blue-200'
          : 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-200'
  return <span className={`inline-flex max-w-full items-center gap-1.5 rounded-lg px-2.5 py-1 leading-5 ${tone}`}>
    <span aria-hidden="true" className="h-1.5 w-1.5 shrink-0 rounded-full bg-current" />{row.label}
  </span>
}

function ServiceDetails({ diagnostics }) {
  if (!diagnostics) return null
  return <details className="mt-1 text-gray-600 dark:text-gray-300"><summary className="w-fit cursor-pointer py-2 font-medium underline underline-offset-4">Service details</summary>
    <div className="space-y-1 pb-1 leading-5">
      {!diagnostics.worker_recent && <p>The background sender has not checked in recently. Automatic delivery requires the email worker to be running.</p>}
      <p>Last provider check: {date(diagnostics.allowance_checked_at)}.</p>
      <p>Next allowance check: {diagnostics.next_allowance_check ? date(diagnostics.next_allowance_check) : 'Not available'}. This is not a guaranteed delivery time.</p>
    </div>
  </details>
}

function ServiceNotice({ service, compact, waitingCount }) {
  if (!waitingCount || service.worker_recent && !service.notice) return null
  if (compact && service.worker_recent) return <ServiceDetails diagnostics={service.diagnostics} />
  return <div role="status" className="rounded-xl border border-amber-100 bg-amber-50 p-3 text-amber-950 dark:border-amber-900 dark:bg-amber-950/50 dark:text-amber-200">
    <div className="flex items-start gap-3"><span className="mt-0.5 shrink-0"><AlertTriangleIcon size={18} /></span><div className="min-w-0 flex-1">
      <p className="font-semibold">Emails are waiting</p>
      <p className="mt-1 leading-5">{service.worker_recent ? service.notice : 'Automatic sending needs administrator attention.'}</p>
      <ServiceDetails diagnostics={service.diagnostics} />
    </div></div>
  </div>
}

function EmailHistory({ row, active, busy, prepare }) {
  return <div className="email-history-grid">
    <div className="min-w-0 space-y-3">
      <div><h3 className="font-semibold text-gray-900 dark:text-white">{row.name}</h3><p className="mt-1 break-all text-gray-600 dark:text-gray-300">{row.email}</p></div>
      <div><p className="mb-1.5 text-gray-600 dark:text-gray-300">Current status</p><Status row={row} /></div>
      {row.notice?.reason && <p className="leading-5">{row.notice.reason}</p>}
      {!row.eligible && <p className="text-amber-800 dark:text-amber-200">This account or batch is currently ineligible for sending.</p>}
      {row.notice && <div className="space-y-1 text-gray-600 dark:text-gray-300"><p>Attempts: {row.notice.attempts}</p><p>Last update: {date(row.notice.updated_at)}</p>{row.notice.next_attempt && <p>Next attempt / check: {date(row.notice.next_attempt)}</p>}</div>}
      {active && row.eligible && <div className="flex flex-wrap gap-2">
        {['held', 'history_unavailable'].includes(row.status) && <button className={button} disabled={busy} onClick={() => prepare('send', [row.student_id])}><SendIcon />Send email to {row.name}</button>}
        {['accepted', 'provider_pending', 'delivered', 'uncertain', 'failed', 'cancelled'].includes(row.status) && <button className={button} disabled={busy} onClick={() => prepare('resend', [row.student_id])}>Send again to {row.name}</button>}
      </div>}
    </div>
    <div className="min-w-0"><h3 className="font-semibold text-gray-900 dark:text-white">Recent email history</h3>
      {!row.history.length ? <p className="mt-2 leading-5 text-gray-600 dark:text-gray-300">No saved email history. This does not mean the student never received an email.</p>
        : <><ol className="mt-3 space-y-3">{row.history.map(item => <li key={item.id} className="space-y-1 border-l-2 border-gray-200 pl-3 leading-5 dark:border-gray-600">
          <p className="font-medium">{item.label}</p><p>Requested {date(item.created_at)}</p>{item.reason && <p>{item.reason}</p>}
          {item.accepted_at && <p>Accepted: {date(item.accepted_at)}</p>}{item.delivered_at && <p>Delivered: {date(item.delivered_at)}</p>}
          {item.attempt_history?.map((attempt, index) => <p key={`${attempt.created_at}:${index}`} className="text-gray-600 dark:text-gray-300">Attempt {date(attempt.created_at)}: {attempt.label}{attempt.http_status ? ` (HTTP ${attempt.http_status})` : ''}{attempt.reason ? ` · ${attempt.reason}` : ''}</p>)}
        </li>)}</ol><p className="mt-3 text-gray-600 dark:text-gray-400">Up to five recent notices and five attempts per notice; earlier records remain preserved.</p></>}
    </div>
  </div>
}

export default function EnrollmentEmails({ batchId, onClose, initialGroupId }) {
  const url = `/api/instructor/batches/${batchId}/emails/`
  const { data, loading } = useApi(url)
  const { showToast } = useToast()
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState('all')
  const [page, setPage] = useState(1)
  const [selected, setSelected] = useState(new Set())
  const [historyId, setHistoryId] = useState(null)
  const historyOpener = useRef(null)
  const [review, setReview] = useState(null)
  const [reason, setReason] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const saving = useRef(false)
  const rows = useMemo(() => data?.rows || [], [data])
  const historyRow = rows.find(row => row.enrollment_id === historyId)
  const query = search.trim().toLowerCase()
  const filtered = rows.filter(row => `${row.name} ${row.school_id} ${row.email}`.toLowerCase().includes(query) &&
    (filter === 'all' || filter === 'pending' && pending.has(row.status) || filter === 'attention' && attention.has(row.status) || row.status === filter))
  const currentPage = Math.min(page, Math.ceil(filtered.length / 10) || 1)
  const active = data?.batch.status === 'active'
  const eligible = filtered.filter(row => row.eligible)
  const selectedIds = rows.filter(row => row.eligible && selected.has(row.student_id)).map(row => row.student_id)
  const held = rows.filter(row => row.eligible && row.status === 'held')
  const waitingCount = data?.service.waiting_count ?? rows.filter(row => row.eligible && ['queued', 'retry', 'quota', 'sending'].includes(row.status)).length
  const summary = [
    ['all', 'All', rows.length], ['held', 'Not scheduled', rows.filter(row => row.status === 'held').length],
    ['pending', 'Pending', rows.filter(row => pending.has(row.status)).length],
    ['delivered', 'Delivered', rows.filter(row => row.status === 'delivered').length],
    ['attention', 'Needs attention', rows.filter(row => attention.has(row.status)).length],
  ]
  const legacy = rows.filter(row => row.status === 'history_unavailable').length
  if (legacy) summary.push(['history_unavailable', 'History unavailable', legacy])
  const allFilteredSelected = eligible.length > 0 && eligible.every(row => selected.has(row.student_id))

  function changeFilter(setter, value) { setter(value); setPage(1); setSelected(new Set()); setHistoryId(null) }
  function clearFilters() { setSearch(''); changeFilter(setFilter, 'all') }
  function select(id) { setSelected(current => { const next = new Set(current); if (next.has(id)) next.delete(id); else next.add(id); return next }) }
  function selectFiltered() { setSelected(new Set(eligible.map(row => row.student_id))) }
  function refresh() { invalidateCache(url); setReview(null); setSelected(new Set()) }
  function prepare(action, ids = selectedIds) {
    if (!ids.length || !data || busy) return
    setReason(''); setError('')
    setReview({ action, ids, token: data.review_token, request_id: crypto.randomUUID(),
      recipients: rows.filter(row => ids.includes(row.student_id)) })
  }
  async function confirm() {
    if (saving.current || review.action === 'resend' && !reason.trim()) return
    saving.current = true; setBusy(true); setError('')
    try {
      const result = await api.post(url, { action: review.action, student_ids: review.ids,
        review_token: review.token, request_id: review.request_id, reason })
      showToast(`${result.data.changed} email record${result.data.changed === 1 ? '' : 's'} updated; ${result.data.skipped} skipped. Enrollment is unchanged.`)
      invalidateCache(url); setSelected(new Set()); setReview(null); setHistoryId(null)
    } catch (failure) {
      setError(requestErrorMessage(failure, { mutation: true }))
      // Preserve the reviewed IDs and command ID after an uncertain response.
    } finally { saving.current = false; setBusy(false) }
  }

  return <DialogShell title="Enrollment emails" size="email" description={data?.batch.name || 'Loading batch email history'}
    avatar={<span aria-hidden="true" className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-300"><MailIcon size={23} /></span>}
    headerDetails={<p className="mt-1 text-xs text-gray-600 dark:text-gray-300">{data ? `${data.batch.name} · ${rows.length} student${rows.length === 1 ? '' : 's'}${active ? '' : ' · Archived · Read-only'}` : 'Loading batch…'}</p>}
    onClose={() => { if (!busy) onClose() }} closeLabel="Close enrollment emails"
    footer={<div className="flex items-center justify-between gap-3 text-xs"><p role="status" className="text-gray-600 dark:text-gray-400">{data ? `${filtered.length} ${search || filter !== 'all' ? 'matching ' : ''}student${filtered.length === 1 ? '' : 's'}` : 'Loading email records…'}</p><button className={button} disabled={busy} onClick={onClose}>Close</button></div>}>
    <div className="email-dialog-body">
      <DataSection url={url} layout="table" count={4} label="Loading email records">
        {data && <div className="space-y-5">
          <EmailProgress groups={data.groups} initialGroupId={initialGroupId} />
          <ServiceNotice service={data.service} compact={Boolean(data.groups?.length)} waitingCount={waitingCount} />
          <div className="email-summary" role="group" aria-label="Email status summary">{summary.map(([value, label, count]) => <button key={value} aria-pressed={filter === value}
            onClick={() => changeFilter(setFilter, value)}><span className="text-xs">{label}</span><strong>{count}</strong></button>)}</div>
          <div className="flex flex-wrap items-end gap-3">
            <label className="min-w-0 flex-[2_1_240px] font-medium">Search students<div className="relative"><span className="pointer-events-none absolute top-4 left-3 text-gray-500"><SearchIcon size={16} /></span><input aria-label="Search students" className={`${field} pl-9`} value={search} placeholder="Name, school ID or email" onChange={event => changeFilter(setSearch, event.target.value)} /></div></label>
            <label className="min-w-0 flex-[1_1_170px] font-medium">Email status<select aria-label="Email status" className={field} value={filter} onChange={event => changeFilter(setFilter, event.target.value)}>
              <option value="all">All statuses</option><option value="held">Not scheduled</option><option value="pending">Pending and in progress</option><option value="attention">Needs attention</option><option value="quota">Waiting for allowance</option><option value="delivered">Delivered</option><option value="history_unavailable">History unavailable</option>
            </select></label>
            <button className={button} aria-label="Refresh status" title="Refresh status" disabled={loading || busy} onClick={refresh}><RefreshIcon size={17} /></button>
          </div>
          {active && filtered.length > 0 && <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 rounded-xl bg-gray-50 p-3 dark:bg-gray-800/60" role="group" aria-label="Enrollment email actions">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <p role="status" aria-live="polite" className="font-semibold">{filtered.length} student{filtered.length === 1 ? '' : 's'} · {selectedIds.length} selected</p>
              <button className={link} disabled={!eligible.length || eligible.length > 1000 || loading || busy} onClick={selectFiltered}>Select all filtered</button>
              {selectedIds.length > 0 && <button className={link} disabled={busy} onClick={() => setSelected(new Set())}>Clear selection</button>}
            </div>
            <div className="flex flex-wrap gap-2"><button className={primary} disabled={!selectedIds.length || selectedIds.length > 1000 || busy} onClick={() => prepare('send')}><SendIcon />Send selected</button>
              <ActionMenu label="More actions" className={button} disabled={!selectedIds.length || selectedIds.length > 1000 || busy} onAction={action => prepare(action)}
                items={Object.entries(labels).filter(([action]) => action !== 'send').map(([id, label]) => ({ id, label, danger: id === 'cancel' }))} />
            </div>
          </div>}
          {active && held.length > 0 && filtered.length > 0 && <div className="-mt-3"><button className={`${link} inline-flex items-center gap-2`} disabled={busy} onClick={() => prepare('send', held.slice(0, 1000).map(row => row.student_id))}><SendIcon size={14} />Send all not scheduled ({Math.min(held.length, 1000)})</button></div>}
          {!filtered.length ? <div className="rounded-xl border border-gray-200 px-4 py-8 text-center dark:border-gray-700">
            <span aria-hidden="true" className="mx-auto mb-3 grid h-12 w-12 place-items-center rounded-full bg-gray-50 text-gray-400 dark:bg-gray-800"><MailIcon size={25} /></span>
            <h3 className="font-semibold text-gray-900 dark:text-white">{rows.length ? 'No matching students' : 'No enrolled students yet'}</h3>
            <p className="mt-2 text-gray-600 dark:text-gray-400">{rows.length ? 'Try another search or clear your filters.' : 'Students will appear here after they are enrolled in this batch.'}</p>
            {(search || filter !== 'all') && <button className={`${button} mt-4`} onClick={clearFilters}>Clear filters</button>}
          </div> : <div className="overflow-hidden rounded-xl border border-gray-200 dark:border-gray-700">
            <table className="email-table" aria-label="Student email records"><thead><tr>
              <th className="email-checkbox"><input type="checkbox" className={checkbox} aria-label="Select all filtered students" checked={allFilteredSelected} disabled={!active || !eligible.length || eligible.length > 1000 || busy} onChange={() => allFilteredSelected ? setSelected(new Set()) : selectFiltered()} /></th>
              <th scope="col">Student</th><th scope="col">Email status</th><th scope="col">Last update</th><th scope="col">Details</th>
            </tr></thead><tbody>{filtered.slice((currentPage - 1) * 10, currentPage * 10).map(row =>
              <tr key={row.enrollment_id} className="email-record-row" data-selected={selected.has(row.student_id)}>
                <td className="email-checkbox"><input type="checkbox" className={checkbox} aria-label={`Select ${row.name}`} checked={selected.has(row.student_id)} disabled={!active || !row.eligible || busy} onChange={() => select(row.student_id)} /></td>
                <td className="email-identity"><div className="flex min-w-0 items-center gap-2.5"><Avatar name={row.name} photoUrl={row.photo_url} tone="neutral" className="h-8 w-8 rounded-full text-xs" /><div className="min-w-0"><p className="break-words font-semibold text-gray-900 dark:text-white">{row.name}</p><p className="mt-1 break-words text-gray-600 dark:text-gray-400">{row.school_id || 'School ID unavailable'}</p></div></div></td>
                <td className="email-status"><Status row={row} />{!row.eligible && <p className="mt-1 text-amber-800 dark:text-amber-200">Not eligible for sending</p>}</td>
                <td className="email-updated">{date(row.notice?.updated_at)}</td>
                <td className="email-details"><button className={button} aria-label={`View history for ${row.name}`} aria-haspopup="dialog" onClick={event => { historyOpener.current = event.currentTarget; setHistoryId(row.enrollment_id) }}>View history</button></td>
              </tr>
            )}</tbody></table>
          </div>}
          <Pagination total={filtered.length} page={currentPage} onPage={next => { setPage(next); setHistoryId(null) }} />
          <div className="space-y-1 text-gray-600 dark:text-gray-400"><p>Delivery does not confirm reading or sign-in. Times shown in Philippine time.</p>
            <details><summary className="w-fit cursor-pointer py-2 font-medium underline underline-offset-4">About sending and delivery</summary><p className="max-w-3xl leading-5">Enrollment stays saved regardless of email delivery. Send all not scheduled releases up to 1,000 held notices per action. Already queued or Brevo-accepted messages are not submitted again. History unavailable means no saved email record; it does not mean the student never received an email.</p></details>
          </div>
        </div>}
      </DataSection>
    </div>
    {historyRow && <DialogShell title="Email history" size="email-history" description={`${historyRow.name} · ${data.batch.name}`} restoreFocusRef={historyOpener}
      avatar={<Avatar name={historyRow.name} photoUrl={historyRow.photo_url} tone="neutral" className="h-11 w-11 rounded-full text-sm" />}
      headerDetails={<p className="mt-1 text-xs text-gray-600 dark:text-gray-300">{historyRow.name} · {historyRow.school_id || 'School ID unavailable'}</p>}
      closeLabel="Close email history" onClose={() => { if (!busy) setHistoryId(null) }}
      footer={<div className="flex items-center justify-between gap-3 text-xs"><p className="text-gray-600 dark:text-gray-400">{data.batch.name}{active ? '' : ' · Read-only'}</p><button className={button} disabled={busy} onClick={() => setHistoryId(null)}>Close history</button></div>}>
      <div className="email-dialog-body"><EmailHistory row={historyRow} active={active} busy={busy} prepare={prepare} /></div>
    </DialogShell>}
    {review && <DialogShell title={labels[review.action]} description={`${data.batch.name} · ${review.ids.length} reviewed recipients`} size="confirm" onClose={() => { if (!busy) setReview(null) }}
      footer={<div className="flex gap-2"><button className={button} disabled={busy} onClick={() => setReview(null)}>Cancel</button><button className={primary} disabled={busy || review.action === 'resend' && !reason.trim()} onClick={confirm}>{busy ? 'Saving…' : 'Confirm email action'}</button></div>}>
      <div className="space-y-3 overflow-y-auto p-4 text-xs"><p>Enrollment stays unchanged. Ineligible, suppressed, already queued or recently sent records are skipped. Intentional resends have a 15-minute cooldown and use available sending allowance.</p>
        <p className="font-semibold">{data.batch.name} · {review.ids.length} recipient{review.ids.length === 1 ? '' : 's'}</p>
        {review.action === 'resend' && review.recipients.some(row => ['accepted', 'provider_pending', 'uncertain'].includes(row.status)) && <p>Brevo may already be delivering an earlier notice. Sending again can produce another email.</p>}
        <ul className="max-h-44 space-y-1 overflow-auto">{review.recipients.map(row => <li className="break-all" key={row.student_id}>{row.name} · {row.email}</li>)}</ul>
        {review.action === 'resend' && <label className="block">Reason for sending again<input className={field} maxLength={200} value={reason} onChange={event => setReason(event.target.value)} /></label>}
        {error && <p role="alert" className="text-rose-700 dark:text-rose-300">{error}</p>}
      </div>
    </DialogShell>}
  </DialogShell>
}
