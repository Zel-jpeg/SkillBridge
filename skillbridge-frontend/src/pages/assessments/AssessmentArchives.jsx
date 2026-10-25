import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAdminAssessments } from '../../hooks/admin/useAdminAssessments'
import { useSSE } from '../../hooks/useSSE'
import { fetchWithDedup } from '../../hooks/useApi'
import { ASSESSMENTS_URL } from '../../utils/adminAssessmentState'
import { manilaDateTime } from '../../utils/assessmentDates'
import Pagination from '../../components/Pagination'
import AssessmentManagementDialog from '../../components/admin/AssessmentManagementDialog'
import { AssessmentRetry, AssessmentSkeleton, AssessmentStatus } from '../../components/admin/AssessmentPresentation'
import AssessmentArchiveAction from '../../components/assessment/AssessmentArchiveAction'

const control = 'min-h-10 min-w-0 rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs text-gray-700 focus-visible:outline-2 focus-visible:outline-green-600 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200'
const PAGE_SIZE = 10

export default function AssessmentArchives({ role }) {
  useSSE(`/api/${role}/events/`)
  const { data, error, errorStatus } = useAdminAssessments()
  const [search, setSearch] = useState('')
  const [batch, setBatch] = useState('all')
  const [instructor, setInstructor] = useState('all')
  const [page, setPage] = useState(1)
  const [selectedId, setSelectedId] = useState(null)
  const archives = useMemo(() => (Array.isArray(data) ? data : []).filter(a => a.is_archived).sort((a, b) => new Date(b.archived_at) - new Date(a.archived_at) || b.id - a.id), [data])
  const filtered = archives.filter(a => `${a.title} ${a.batch_name || ''} ${a.instructor_name || ''}`.toLowerCase().includes(search.trim().toLowerCase()) && (batch === 'all' || String(a.batch_id) === batch) && (instructor === 'all' || String(a.instructor_id ?? a.created_by_id) === instructor))
  const visiblePage = Math.min(page, Math.max(1, Math.ceil(filtered.length / PAGE_SIZE)))
  if (page !== visiblePage) setPage(visiblePage)
  const records = filtered.slice((visiblePage - 1) * PAGE_SIZE, visiblePage * PAGE_SIZE)
  const batches = [...new Map(archives.filter(a => a.batch_id).map(a => [String(a.batch_id), a.batch_name])).entries()]
  const instructors = [...new Map(archives.map(a => [String(a.instructor_id ?? a.created_by_id), a.instructor_name])).entries()]
  const unavailable = [403, 404].includes(errorStatus)
  const selected = !unavailable && archives.find(a => a.id === selectedId)
  const activeFilters = search || batch !== 'all' || instructor !== 'all'
  function reset() { setSearch(''); setBatch('all'); setInstructor('all'); setPage(1) }
  return <section className="mx-auto max-w-7xl space-y-6 px-4 py-6 sm:px-6 sm:py-8">
    <header className="flex flex-wrap items-start justify-between gap-4"><div><h1 className="text-xl font-semibold text-gray-900 dark:text-white">Assessment archives</h1><p className="mt-1 max-w-2xl text-xs leading-5 text-gray-500 dark:text-gray-400">Archived assessments are read-only. Results, reports and competency evidence are retained. Restore an assessment before editing it.</p></div><Link className={`${control} inline-flex items-center`} to={`/${role}/assessments`}>Back to assessments</Link></header>
    <section aria-label="Archived assessments" className="space-y-4">
      <div className="flex flex-wrap items-end gap-3"><label className="w-full min-w-0 text-xs sm:w-auto sm:flex-[2] text-gray-600 dark:text-gray-300">Search archives<input type="search" className={`${control} mt-1 w-full`} placeholder="Title, instructor, or batch…" value={search} onChange={e => { setSearch(e.target.value); setPage(1) }} /></label>
        <label className="min-w-40 flex-1 text-xs text-gray-600 dark:text-gray-300">Batch<select className={`${control} mt-1 w-full`} value={batch} onChange={e => { setBatch(e.target.value); setPage(1) }}><option value="all">All batches</option>{batches.map(([id, name]) => <option key={id} value={id}>{name}</option>)}</select></label>
        {role === 'admin' && <label className="min-w-40 flex-1 text-xs text-gray-600 dark:text-gray-300">Instructor<select className={`${control} mt-1 w-full`} value={instructor} onChange={e => { setInstructor(e.target.value); setPage(1) }}><option value="all">All instructors</option>{instructors.map(([id, name]) => <option key={id} value={id}>{name || 'Unassigned'}</option>)}</select></label>}
        {activeFilters && <button type="button" className={control} onClick={reset}>Clear filters</button>}
      </div>
      {error && <AssessmentRetry onRetry={() => fetchWithDedup(ASSESSMENTS_URL).catch(() => {})}>{data && !unavailable ? 'Could not refresh archives. Showing the last loaded records.' : error}</AssessmentRetry>}
      {data == null && !error ? <AssessmentSkeleton layout="list" /> : !unavailable && data != null && <>
        <p aria-live="polite" className="text-xs text-gray-500 dark:text-gray-400">{filtered.length} archived assessment{filtered.length === 1 ? '' : 's'}</p>
        {records.length ? <div className="space-y-3">{records.map(a => <article key={a.id} className="flex flex-col items-stretch justify-between gap-4 rounded-xl sm:flex-row sm:items-center border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900 sm:p-5"><div className="min-w-0 flex-1"><button type="button" onClick={() => setSelectedId(a.id)} className="max-w-full break-words rounded text-left text-sm font-semibold text-gray-900 hover:text-green-700 focus-visible:outline-2 focus-visible:outline-green-600 dark:text-white dark:hover:text-green-300">{a.title}</button><p className="mt-1 break-words text-xs text-gray-500 dark:text-gray-400">{a.batch_name || 'Unassigned batch'}{role === 'admin' ? ` · ${a.instructor_name || 'Unassigned instructor'}` : ''} · {a.question_count} question{a.question_count === 1 ? '' : 's'}</p><p className="mt-2 break-words text-xs text-gray-500 dark:text-gray-400">Archived {manilaDateTime(a.archived_at)}{a.archived_by_name ? ` by ${a.archived_by_name}` : ''}</p><div className="mt-2 flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400"><AssessmentStatus status={a.publication_status} /><span>Read-only · {a.submission_count || 0} submission{a.submission_count === 1 ? '' : 's'}</span></div></div><AssessmentArchiveAction assessment={a} /></article>)}</div> : <div className="rounded-xl border border-gray-200 bg-white px-5 py-12 text-center dark:border-gray-800 dark:bg-gray-900"><h2 className="text-sm font-semibold text-gray-900 dark:text-white">{archives.length ? 'No matching archives' : 'No archived assessments'}</h2><p className="mt-2 text-xs text-gray-500 dark:text-gray-400">{archives.length ? 'Try another search or clear your filters.' : 'Archive a draft or closed assessment from its details in Assessments.'}</p></div>}
        <Pagination total={filtered.length} page={visiblePage} onPage={setPage} pageSize={PAGE_SIZE} />
      </>}
    </section>
    {selectedId !== null && <AssessmentManagementDialog key={selectedId} role={role} assessment={selected || null} onClose={() => setSelectedId(null)} />}
  </section>
}
