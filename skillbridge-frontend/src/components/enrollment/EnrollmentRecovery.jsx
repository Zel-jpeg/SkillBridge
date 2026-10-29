import { useState } from 'react'
import { Link } from 'react-router-dom'
import Avatar from '../Avatar'
import DataSection from '../DataSection'
import Pagination from '../Pagination'
import StudentEnrollmentModal from './StudentEnrollmentModal'
import { getCachedData, invalidateCache, updateCachedData, useApi } from '../../hooks/useApi'
import { manilaDateTime } from '../../utils/assessmentDates'
import { reportTableStyles as table } from '../analytics/reportTableStyles'
import { filterPreviouslyUnenrolled } from '../../utils/studentRosterFilters'

const field = 'min-h-11 rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs dark:border-gray-700 dark:bg-gray-900'
const button = 'inline-flex min-h-11 items-center justify-center rounded-xl border border-green-700 px-3 py-2 text-xs font-semibold text-green-800 hover:bg-green-50 focus-visible:outline-2 focus-visible:outline-green-600 disabled:opacity-50 dark:text-green-300 dark:hover:bg-green-950'

export function EnrollmentRecoveryFilters({ enrollment, onEnrollment, account, onAccount, className = '' }) {
  return <div className={`flex flex-wrap gap-3 ${className}`}>
    <label className="flex min-w-0 flex-col gap-1 text-xs">Enrollment<select aria-label="Enrollment" className={field} value={enrollment} onChange={event => onEnrollment(event.target.value)}><option value="enrolled">Enrolled students</option><option value="unenrolled">Previously unenrolled</option></select></label>
    <label className="flex min-w-0 flex-col gap-1 text-xs">Account status<select aria-label="Account status" className={field} value={account} onChange={event => onAccount(event.target.value)}><option value="all">All accounts</option><option value="active">Active accounts</option><option value="archived">Archived accounts</option></select></label>
  </div>
}

export default function PreviouslyUnenrolled({ batch, search = '', course = 'all', account = 'all', view = 'grid', onChanged }) {
  const url = `/api/instructor/batches/${batch.id}/unenrolled/`
  const { data } = useApi(url)
  const [page, setPage] = useState({ key: '', value: 1 })
  const [student, setStudent] = useState(null)
  const key = `${batch.id}:${search}:${course}:${account}`
  const rows = filterPreviouslyUnenrolled(data?.students || [], { search, course, accountStatus: account })
  const current = Math.min(page.key === key ? page.value : 1, Math.max(1, Math.ceil(rows.length / 10)))
  if (page.key !== key || page.value !== current) setPage({ key, value: current })
  const records = rows.slice((current - 1) * 10, current * 10)
  function enrolled(result) {
    const ids = new Set(result.rows.filter(row => ['enrolled', 'already_enrolled'].includes(row.status)).map(row => row.id))
    const cached = getCachedData(url)
    if (cached) updateCachedData(url, { ...cached, students: cached.students.filter(row => !ids.has(row.id)) })
    invalidateCache(url)
    invalidateCache(`/api/instructor/batches/${batch.id}/students/`)
    onChanged?.(result)
  }
  function action(row) {
    if (batch.status !== 'active') return <span className="text-xs text-gray-500">Reactivate batch first</span>
    if (row.is_active === false) return localStorage.getItem('sb-role') === 'admin'
      ? <Link className={button} to="/admin/users?tab=archived">Restore account in Users</Link>
      : <span className="text-xs text-gray-500">Admin restoration required</span>
    return <button type="button" className={button} onClick={() => setStudent(row)}>Re-enroll in this batch</button>
  }
  function identity(row) {
    return <div className="flex min-w-0 items-center gap-3"><Avatar name={row.name} photoUrl={row.photo_url} className="h-8 w-8 shrink-0 rounded-full text-xs" /><div className="min-w-0 break-words"><strong>{row.name}</strong><p className="text-xs text-gray-500">{row.school_id} · {row.course}</p>{row.is_active === false && <span className="text-xs text-amber-800 dark:text-amber-300">Account archived</span>}</div></div>
  }
  return <section aria-label="Previously unenrolled students" className="space-y-4">
    <p className="text-xs text-gray-500">Only recorded unenrollments appear here. Older removals without an audit record may not be listed.</p>
    <DataSection url={url} layout="cards" label="Loading previously unenrolled students">
      <p role="status" className="text-xs text-gray-500">{rows.length} previously unenrolled students</p>
      {records.length === 0 ? <p className="rounded-xl border border-gray-200 p-6 text-xs dark:border-gray-800">{data?.students.length ? 'No previously unenrolled students match your filters.' : 'No recorded unenrollments for this batch.'}</p> : <>
        <div className={`${view === 'list' ? 'grid sm:hidden' : 'grid'} grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3`}>{records.map(row => <article key={row.id} className="min-w-0 space-y-4 rounded-2xl border border-gray-200 bg-white p-5 text-xs dark:border-gray-800 dark:bg-gray-900">{identity(row)}<p>Unenrolled {manilaDateTime(row.removed_at)}</p>{action(row)}</article>)}</div>
        {view === 'list' && <div className={`hidden sm:block ${table.frame}`}><table className={table.table}><caption className="sr-only">Previously unenrolled students in {batch.name}</caption><thead className={table.head}><tr><th className="px-3 py-4 font-semibold">Student</th><th className="px-3 py-4 font-semibold">Unenrolled</th><th className="px-3 py-4 font-semibold">Action</th></tr></thead><tbody>{records.map(row => <tr key={row.id} className={table.row}><td className={table.cell}>{identity(row)}</td><td className={table.cell}>{manilaDateTime(row.removed_at)}</td><td className={table.cell}>{action(row)}</td></tr>)}</tbody></table></div>}
      </>}
      <Pagination total={rows.length} page={current} pageSize={10} onPage={value => setPage({ key, value })} />
    </DataSection>
    {student && <StudentEnrollmentModal batchId={batch.id} initialStudent={student} requireConfirmation onClose={() => setStudent(null)} onEnrolled={enrolled} />}
  </section>
}
