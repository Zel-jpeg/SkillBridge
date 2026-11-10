import { useState } from 'react'
import { Link } from 'react-router-dom'
import Pagination from '../Pagination'
import DialogShell from '../DialogShell'
import { ChevronRightIcon, WarnIcon } from '../Icons'
import { organizationButton as button, organizationField as field, organizationCard } from '../admin/organizationUi'
const surface = 'rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900'

export function AttentionCard({ rows, available }) {
  const rowClass = 'flex min-h-14 w-full items-center justify-between gap-3 rounded-lg px-3 py-2 text-left text-xs hover:bg-green-50 focus-visible:outline-2 focus-visible:outline-green-600 dark:hover:bg-green-950'
  return <section aria-label="Needs attention" className={`${surface} min-w-0 p-4`}>
    <header className="mb-3 flex items-center gap-2">
      <span aria-hidden="true" className="rounded-lg bg-amber-50 p-2 text-amber-700 dark:bg-amber-950 dark:text-amber-300"><WarnIcon size={18} /></span>
      <h2 className="text-base font-bold">Needs attention</h2>
    </header>
    {rows.length ? <ul className="divide-y divide-gray-100 dark:divide-gray-800">
      {rows.map(row => {
        const content = <>
          <span><strong>{row.label}</strong><span className="mt-1 block text-gray-500 dark:text-gray-400">{row.note}</span></span>
          <span className="flex shrink-0 items-center gap-2 font-semibold tabular-nums">{row.count}<ChevronRightIcon size={16} /></span>
        </>
        return <li key={row.label}>{row.to
          ? <Link className={rowClass} to={row.to}>{content}</Link>
          : <button type="button" className={`${rowClass} cursor-pointer`} onClick={row.action}>{content}</button>}
        </li>
      })}
    </ul> : <p className="px-2 py-3 text-xs text-gray-500 dark:text-gray-400">
      {available ? 'No current attention items in this scope.' : 'Attention details are unavailable. Refresh the dashboard to load them.'}
    </p>}
  </section>
}

export function AttentionDialog({ kind, data, options, scope, onClose }) {
  const [search, setSearch] = useState(''), [page, setPage] = useState(1)
  const attention = data.dashboard_attention
  const rows = kind === 'retakes' ? attention.retake_scopes.map((row, index) => {
    const institute = options.institutes.find(item => item.id === row.institute_id)
    const program = options.programs.find(item => item.id === row.program_id)
    return { id: index, name: program?.name || (institute ? `${institute.code} shared batches` : 'Institute not assigned'), detail: `${row.count} pending requests`,
      to: row.institute_id ? `/admin/retake-requests?${new URLSearchParams({ institute: row.institute_id, program: row.program_id || 'all', active_batches: '1' })}` : '/admin/retake-requests' }
  }) : attention.batches_without_required.map(id => {
    const batch = data.options.batches.find(row => row.id === id)
    return { id, name: batch?.name || `Batch ${id}`, detail: 'No published required assessments', to: `/admin/batches?${new URLSearchParams({ ...(batch?.institute_id ? { institute: batch.institute_id, program: batch.program_id || 'all' } : {}), batch_id: id })}` }
  })
  const filtered = rows.filter(row => row.name.toLowerCase().includes(search.trim().toLowerCase()))
  const currentPage = Math.min(page, Math.max(1, Math.ceil(filtered.length / 8)))
  return <DialogShell title={kind === 'retakes' ? 'Pending retake requests' : 'Batches without required assessments'} description="Open the relevant program or batch to review its records." onClose={onClose} size="collection" footer={<button type="button" className={button} onClick={onClose}>Done</button>}>
    <div className="min-h-0 space-y-4 overflow-y-auto p-5"><label className="block text-xs">Search attention records<input type="search" className={field} value={search} onChange={event => { setSearch(event.target.value); setPage(1) }} /></label>
      <ul className="space-y-2">{filtered.slice((currentPage - 1) * 8, currentPage * 8).map(row => <li key={row.id}><Link className={`${organizationCard} flex items-center justify-between gap-3 p-4 text-xs focus-visible:outline-2 focus-visible:outline-green-600`} to={row.to}><span className="min-w-0"><strong className="block break-words">{row.name}</strong><span className="mt-1 block text-gray-500 dark:text-gray-400">{row.detail}</span></span><ChevronRightIcon /></Link></li>)}</ul>
      {!filtered.length && <p className="text-xs">No attention records match.</p>}<Pagination total={filtered.length} page={currentPage} pageSize={8} onPage={setPage} />
      <p className="text-xs text-gray-500">Scope: {scope.program ? 'Selected program' : scope.institute ? 'Selected institute' : 'School-wide'}</p>
    </div>
  </DialogShell>
}
