import { useState } from 'react'
import { useApi, invalidateCache, fetchWithDedup } from '../hooks/useApi'
import Pagination from '../components/Pagination'
import Avatar from '../components/Avatar'
import { GridIcon, ListIcon, SearchIcon } from '../components/Icons'
import { reportTableStyles as table } from '../components/analytics/reportTableStyles'
import RetakeReviewDialog from '../components/RetakeReviewDialog'
import './RetakeRequests.css'

const filters = [['all', 'All'], ['pending', 'Pending'], ['approved', 'Approved'], ['declined', 'Declined'], ['history', 'Previous attempts']]
const views = [{ value: 'cards', Icon: GridIcon, label: 'Show request cards' }, { value: 'list', Icon: ListIcon, label: 'Show request list' }]
const focus = 'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-green-600'
const actionStyle = `min-h-11 cursor-pointer rounded-lg border px-3 py-2 text-xs font-semibold transition-colors ${focus}`
function rowKey(row) { return `${row.id}-${row.history_id || 'current'}-${row.request.request_id}` }
function requestedAt(row) {
  return row.request.requested_at ? new Intl.DateTimeFormat('en-PH', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZone: 'Asia/Manila' }).format(new Date(row.request.requested_at)) : 'Not recorded'
}
function RequestAction({ row, onOpen }) {
  const review = row.request.status === 'pending' && !row.read_only
  return <button type="button" aria-label={`${review ? 'Review request' : 'View request details'} for ${row.student}`} onClick={onOpen}
    className={`${actionStyle} ${review ? 'border-green-600 text-green-700 hover:bg-green-50 dark:border-green-500 dark:text-green-300 dark:hover:bg-green-950' : 'border-gray-300 text-gray-600 hover:bg-gray-100 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-800'}`}>
    {review ? 'Review' : 'View details'}
  </button>
}
function StudentIdentity({ row }) {
  return <div className="flex min-w-0 items-center gap-3"><Avatar name={row.student} tone="neutral" className="h-8 w-8 rounded-full text-xs" /><div className="min-w-0"><p className="break-words font-semibold text-gray-900 dark:text-white">{row.student}</p><p className="mt-0.5 break-words text-gray-500 dark:text-gray-400">{row.school_id || 'No student ID'}</p></div></div>
}
function EvidenceLabel({ row }) { return <span className="text-gray-500 dark:text-gray-400">{row.has_image ? 'Image attached' : 'No image'}</span> }

export default function RetakeRequests() {
  const [search, setSearch] = useState(''), [status, setStatus] = useState('pending'), [page, setPage] = useState(1)
  const [view, setView] = useState('list'), [selected, setSelected] = useState(null), [message, setMessage] = useState('')
  const url = `/api/retake-requests/?${new URLSearchParams({ search: search.trim(), status, page: String(page) })}`
  const { data, loading, error } = useApi(url)
  const rows = data?.results || []
  // Resolve the selected identity against refreshed data, rather than reviewing a stale row.
  const selectedRow = !loading && !error && rows.find(row => rowKey(row) === selected)
  function reset() { setSearch(''); setStatus('pending'); setPage(1); setSelected(null) }
  function open(row) { setSelected(rowKey(row)); setMessage('') }
  function saved(decision) {
    setSelected(null); setMessage(`Retake request ${decision}.`)
    invalidateCache('/api/retake-requests/')
    fetchWithDedup(url).catch(() => {})
  }

  return <section className="mx-auto min-w-0 max-w-7xl space-y-6 px-4 py-6 text-gray-900 dark:text-gray-100 sm:px-6 sm:py-8">
    <header><h1 className="text-2xl font-bold">Retake requests</h1><p className="mt-2 text-xs leading-relaxed text-gray-600 dark:text-gray-300">Review student explanations and supporting evidence.</p></header>
    <div className="retake-toolbar space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        <p className="shrink-0 text-sm font-semibold">All requests</p>
        <div className="relative min-w-0 basis-full lg:flex-1 lg:basis-48"><span aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"><SearchIcon size={14} /></span>
          <input type="search" aria-label="Search student, ID or assessment" placeholder="Search student, ID or assessment…" value={search} onChange={event => { setSearch(event.target.value); setPage(1); setSelected(null) }}
            className="w-full rounded-xl border border-gray-200 bg-white py-2 pl-8 pr-3 text-sm outline-none focus:border-green-600 focus:ring-1 focus:ring-green-600 dark:border-gray-700 dark:bg-gray-800 dark:text-white" />
        </div>
        <div role="group" aria-label="Request status" className="flex min-w-0 flex-wrap gap-1.5">{filters.map(([value, label]) => <button type="button" key={value} aria-pressed={status === value} onClick={() => { setStatus(value); setPage(1); setSelected(null) }}
          className={`cursor-pointer rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${focus} ${status === value ? 'bg-gray-900 text-white dark:bg-white dark:text-gray-900' : 'bg-gray-100 text-gray-500 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-400 dark:hover:bg-gray-700'}`}>{label}</button>)}</div>
        <div role="group" aria-label="Request view" className="ml-auto hidden items-center gap-1 rounded-xl bg-gray-100 p-1 dark:bg-gray-800 lg:flex">{views.map(item => <button type="button" key={item.value} aria-label={item.label} title={item.label} aria-pressed={view === item.value} onClick={() => setView(item.value)}
          className={`flex cursor-pointer items-center justify-center rounded-lg p-1.5 transition-colors ${focus} ${view === item.value ? 'bg-white text-gray-900 shadow-sm dark:bg-gray-700 dark:text-white' : 'text-gray-400 hover:text-gray-700 dark:text-gray-500 dark:hover:text-gray-300'}`}><span aria-hidden="true"><item.Icon size={14} /></span></button>)}</div>
        <p role="status" className="shrink-0 text-xs text-gray-400 dark:text-gray-500">{loading ? 'Loading requests…' : `${data?.count || 0} request${data?.count === 1 ? '' : 's'}`}</p>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs"><p className="text-gray-500 dark:text-gray-400">{status === 'history' ? 'Previous assessment attempts' : 'Current assessment attempts'}</p>
        {(search || status !== 'pending') && <button type="button" onClick={reset} className={`min-h-11 cursor-pointer rounded-lg px-2 text-green-700 hover:bg-green-50 hover:underline dark:text-green-300 dark:hover:bg-green-950 ${focus}`}>Reset filters</button>}
      </div>
    </div>
    {message && <p role="status" className="rounded-lg bg-green-50 p-3 text-xs text-green-800 dark:bg-green-950 dark:text-green-200">{message}</p>}
    {error && <div role="alert" className="rounded-xl border border-rose-200 p-5 text-xs dark:border-rose-900"><p>Requests could not be loaded.</p><button type="button" className={`${actionStyle} mt-3 border-gray-300 hover:bg-gray-100 dark:border-gray-600 dark:hover:bg-gray-800`} onClick={() => fetchWithDedup(url).catch(() => {})}>Retry</button></div>}
    {!loading && !error && <>
      {rows.length ? <>
        <div className={`${view === 'cards' ? 'grid' : 'grid lg:hidden'} grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3`}>{rows.map(row => <article key={rowKey(row)} className="flex min-w-0 flex-col rounded-2xl border border-gray-200 bg-white p-5 text-xs leading-relaxed transition-colors hover:border-green-300 dark:border-gray-800 dark:bg-gray-900 dark:hover:border-green-700">
          <div className="flex flex-wrap items-start justify-between gap-3"><StudentIdentity row={row} /><span className="retake-status" data-status={row.request.status}>{row.request.status}</span></div>
          <p className="mt-4 break-words font-semibold">{row.assessment}</p><p className="mt-1 break-words text-gray-500 dark:text-gray-400">{row.batch || 'No batch'}</p>
          <p className="mt-3 line-clamp-2 break-words text-gray-600 dark:text-gray-300">{row.request.explanation}</p>
          <div className="mt-auto pt-4"><div className="space-y-1 border-t border-gray-100 pt-3 dark:border-gray-800"><EvidenceLabel row={row} /><p className="text-gray-500 dark:text-gray-400">{requestedAt(row)}</p></div><div className="mt-3 [&>button]:w-full"><RequestAction row={row} onOpen={() => open(row)} /></div></div>
        </article>)}</div>
        {view === 'list' && <div className={`${table.frame} hidden lg:block`} role="region" aria-label="Retake request list" tabIndex={0}>
          <table className={`${table.table} min-w-[900px]`}><caption className="sr-only">Retake requests and review actions</caption><thead className={table.head}><tr>{['Student', 'Assessment', 'Batch', 'Evidence', 'Requested', 'Status', 'Action'].map(label => <th key={label} scope="col" className="px-3 py-3.5 text-left font-semibold">{label}</th>)}</tr></thead>
            <tbody>{rows.map(row => <tr key={rowKey(row)} className={table.row}>
              <td className={`${table.cell} min-w-44`}><StudentIdentity row={row} /></td><td className={`${table.cell} min-w-48`}><p className="font-semibold text-gray-900 dark:text-gray-100">{row.assessment}</p><p className="mt-1 line-clamp-2 text-gray-500 dark:text-gray-400">{row.request.explanation}</p></td>
              <td className={table.cell}>{row.batch || 'No batch'}</td><td className={table.cell}><EvidenceLabel row={row} /></td><td className={`${table.cell} min-w-32`}>{requestedAt(row)}</td><td className={table.cell}><span className="retake-status" data-status={row.request.status}>{row.request.status}</span></td><td className={`${table.cell} whitespace-nowrap`}><RequestAction row={row} onOpen={() => open(row)} /></td>
            </tr>)}</tbody>
          </table>
        </div>}
      </> : <div className="rounded-2xl border border-gray-200 bg-white p-8 text-center text-xs dark:border-gray-800 dark:bg-gray-900"><p>No requests match these filters.</p><button type="button" onClick={reset} className={`${actionStyle} mt-4 border-green-600 text-green-700 hover:bg-green-50 dark:text-green-300 dark:hover:bg-green-950`}>Reset filters</button></div>}
      {rows.length > 0 && <div className="text-xs text-gray-500 dark:text-gray-400">{data.count > 8 ? <Pagination total={data.count} page={data.page || 1} pageSize={8} onPage={next => { setPage(next); setSelected(null) }} /> : <p>Showing 1–{rows.length} of {data.count} request{data.count === 1 ? '' : 's'}</p>}</div>}
    </>}
    {selectedRow && <RetakeReviewDialog key={rowKey(selectedRow)} row={selectedRow} onClose={() => setSelected(null)} onSaved={saved} />}
  </section>
}
