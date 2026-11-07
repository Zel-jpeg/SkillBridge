import { useState } from 'react'
import { organizationComparison } from '../../utils/analyticsOrganization'
import Pagination from '../Pagination'
import { reportTableStyles as styles } from './reportTableStyles'

export default function OrganizationComparison({ data, onOpen, onRecords, disabled = false }) {
  const [search, setSearch] = useState(''), [page, setPage] = useState(1)
  const rows = organizationComparison(data, search)
  const current = Math.min(page, Math.max(1, Math.ceil(rows.length / 6)))
  const kind = data.scope.institute_id ? 'Program' : 'Institute'
  const rate = value => value == null ? '—' : `${value}%`
  return <section aria-busy={disabled} aria-label={`${kind} comparison`} className="space-y-4">
    <header className="flex flex-wrap items-center justify-between gap-3"><div><h3 className="text-sm font-semibold">{kind} comparison</h3><p className="mt-2 text-xs leading-5 text-gray-500 dark:text-gray-400">Counts partition this report’s distinct-student cohort by recorded enrollment. Rates use each row’s student count. Empty cohorts have no rate.</p></div><button type="button" className="min-h-11 rounded-lg px-3 text-xs font-semibold text-green-700 hover:bg-green-50 focus-visible:outline-2 focus-visible:outline-green-600 dark:text-green-300 dark:hover:bg-green-950" onClick={onRecords}>View comparison records</button></header>
    <label className="block max-w-sm text-xs">Search comparison<input type="search" value={search} onChange={event => { setSearch(event.target.value); setPage(1) }} className="mt-2 min-h-11 w-full rounded-xl border border-gray-300 bg-white px-3 dark:border-gray-700 dark:bg-gray-900" /></label>
    <p className="text-xs text-gray-500">{rows.length} comparison rows</p>
    <div className={styles.frame} role="region" aria-label={`${kind} comparison table`} tabIndex={0}><table className={`${styles.table} min-w-[600px]`}><thead className={styles.head}><tr>{[kind, 'Students', 'Required complete', 'Completion rate', 'Approved placements', 'Approval rate'].map(label => <th key={label} scope="col" className="px-3 py-4 font-medium">{label}</th>)}</tr></thead><tbody>{rows.slice((current - 1) * 6, current * 6).map(row => <tr key={row.id} className={styles.row}><th scope="row" className="max-w-72 break-words px-3 py-4 text-xs font-medium">{row.id === 'shared' ? row.name : <button type="button" disabled={disabled} className="min-h-11 disabled:opacity-50 text-left text-green-800 underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-green-600 dark:text-green-300" onClick={() => onOpen(row.id)}>{row.name}{row.is_active === false ? ' (archived)' : ''}</button>}</th>{[row.students, `${row.complete} / ${row.students}`, rate(row.completionRate), `${row.approved} / ${row.students}`, rate(row.placementRate)].map((value, i) => <td key={i} className={`${styles.cell} tabular-nums`}>{value}</td>)}</tr>)}</tbody></table></div>
    {!rows.length && <p className="text-xs">No comparison rows match.</p>}<Pagination total={rows.length} page={current} pageSize={6} onPage={setPage} />
    <p className="text-xs leading-5 text-gray-500 dark:text-gray-400">Opening a row recalculates that scope from its own enrollments. A student with multiple enrollments may move between scopes. Approved placement decisions do not establish OJT completion.</p>
  </section>
}
