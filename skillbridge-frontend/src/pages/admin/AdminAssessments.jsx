import { Link } from 'react-router-dom'
import { useEffect, useMemo, useReducer, useState } from 'react'
import { fetchWithDedup } from '../../hooks/useApi'
import { useAdminAssessments } from '../../hooks/admin/useAdminAssessments'
import { ASSESSMENTS_URL, assessmentPage, assessmentViewReducer, DEFAULT_FILTERS, initialAssessmentView } from '../../utils/adminAssessmentState'
import { manilaDateTime } from '../../utils/assessmentDates'
import { ArchiveIcon, GridIcon, ListIcon, ReportIcon, SearchIcon, WarnIcon } from '../../components/Icons'
import { AssessmentIntegrity, AssessmentPagination, AssessmentProgress, AssessmentRetry, AssessmentSkeleton, AssessmentStatus, CategorySummary } from '../../components/admin/AssessmentPresentation'
import AssessmentManagementDialog from '../../components/admin/AssessmentManagementDialog'

const normalAssessments = data => Array.isArray(data) ? data.filter(a => !a.is_archived) : []

const control = 'min-h-10 min-w-0 rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs text-gray-700 focus-visible:outline-2 focus-visible:outline-green-600 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300'
const surface = 'rounded-2xl border border-gray-100 bg-white dark:border-gray-800 dark:bg-gray-900'
const statusTabs = [['all', 'All'], ['published', 'Published'], ['draft', 'Drafts'], ['closed', 'Closed']]
const label = value => value.replaceAll('_', ' ').replace(/^\w/, c => c.toUpperCase())

function Schedule({ assessment: a }) {
  return <div className="space-y-1 text-xs"><p className="text-gray-700 dark:text-gray-200">{label(a.availability_status || 'Not set')}</p><p className="text-[11px] text-gray-500 dark:text-gray-400">{a.available_at ? `Opens ${manilaDateTime(a.available_at)}` : 'No scheduled opening'}</p><p className="text-[11px] text-gray-500 dark:text-gray-400">{a.due_at ? `Due ${manilaDateTime(a.due_at)}` : 'No due date'}</p></div>
}

function AssessmentResults({ records, view, onOpen }) {
  function trigger(a) {
    return <button className="min-h-10 rounded-lg px-1 text-left text-xs font-semibold text-green-800 hover:text-green-600 dark:text-green-300" aria-label={`View details for ${a.title}`} aria-haspopup="dialog" onClick={event => { event.currentTarget.focus(); onOpen(a.id) }}>{a.title}</button>
  }
  if (view === 'grid') return <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{records.map(a => <article key={a.id} className="relative flex min-w-0 flex-col gap-4 rounded-xl border border-gray-200/80 bg-white p-5 transition-[border-color,box-shadow] hover:border-green-300 hover:shadow-sm dark:border-gray-800 dark:bg-gray-900 dark:hover:border-green-700">
    <div className="flex items-start justify-between gap-3"><div className="min-w-0"><h3 className="break-words text-sm font-semibold leading-6 text-gray-900 dark:text-white"><button type="button" aria-label={`View details for ${a.title}`} aria-haspopup="dialog" className="cursor-pointer text-left after:absolute after:inset-0 after:rounded-xl focus-visible:outline-none focus-visible:after:outline-2 focus-visible:after:outline-offset-2 focus-visible:after:outline-green-600 dark:focus-visible:after:outline-green-400" onClick={event => { event.currentTarget.focus(); onOpen(a.id) }}>{a.title}</button></h3><p className="mt-1 text-xs text-gray-500 dark:text-gray-400">{a.question_count} questions · {a.duration_minutes} min</p></div><AssessmentStatus status={a.publication_status} /></div>
    <div className="space-y-2 text-xs"><p className="font-medium text-gray-700 dark:text-gray-200">{a.instructor_name || 'Instructor not provided'}</p><span className="inline-block max-w-full break-words rounded-full bg-blue-50 px-2.5 py-1 font-medium text-blue-700 dark:bg-blue-950/50 dark:text-blue-300">{a.batch_name || 'Unassigned batch'}</span><div className="flex flex-wrap gap-x-3 gap-y-1 text-gray-600 dark:text-gray-300"><span>{a.is_required ? 'Required' : 'Optional'}</span><span>{a.include_in_competency ? 'Competency included' : 'Result only'}</span><span>Order {a.display_order ?? 0}</span></div></div>
    <CategorySummary categories={a.categories} /><AssessmentProgress assessment={a} />
    <div className="mt-auto border-t border-gray-100 pt-3 dark:border-gray-800"><Schedule assessment={a} /></div>
    <AssessmentIntegrity count={a.flagged_count} />
  </article>)}</div>
  return <div className="max-w-full overflow-x-auto rounded-xl border border-gray-100 focus-visible:outline-2 focus-visible:outline-green-600 dark:border-gray-800" role="region" aria-label="Assessment list, scroll horizontally for all columns" tabIndex={0}>
    <table className="w-full min-w-[1040px] table-fixed text-left text-xs"><caption className="sr-only">Assessments and their publication, completion, and integrity status</caption><thead className="bg-gray-50 text-[11px] text-gray-500 dark:bg-gray-800 dark:text-gray-400"><tr>{['Assessment', 'Instructor / batch', 'Status', 'Categories', 'Schedule', 'Submissions', 'Integrity'].map((name, i) => <th key={name} scope="col" className={`px-3 py-3 font-medium ${i === 0 ? 'w-[19%]' : i === 2 ? 'w-[10%]' : i === 6 ? 'w-[13%]' : ''}`}>{name}</th>)}</tr></thead>
      <tbody className="divide-y divide-gray-100 dark:divide-gray-800">{records.map(a => <tr key={a.id} className="align-top hover:bg-gray-50/70 dark:hover:bg-gray-800/40">
        <td className="break-words px-3 py-4">{trigger(a)}<p className="mt-1 text-[11px] text-gray-500 dark:text-gray-400">{a.question_count} questions · {a.duration_minutes} min</p><span className="mt-2 inline-block rounded-md bg-gray-100 px-2 py-0.5 text-[10px] text-gray-600 dark:bg-gray-800 dark:text-gray-300">{a.is_required ? 'Required' : 'Optional'}</span></td>
        <td className="break-words px-3 py-4"><p className="font-medium text-gray-700 dark:text-gray-200">{a.instructor_name}</p><p className="mt-1 text-[11px] text-gray-500 dark:text-gray-400">{a.batch_name || 'Unassigned'}</p></td>
        <td className="px-3 py-4"><AssessmentStatus status={a.publication_status} /></td><td className="px-3 py-4"><CategorySummary categories={a.categories} /></td><td className="px-3 py-4"><Schedule assessment={a} /></td><td className="px-3 py-4"><AssessmentProgress assessment={a} /></td><td className="px-3 py-4"><AssessmentIntegrity count={a.flagged_count} /></td>
      </tr>)}</tbody>
    </table>
  </div>
}

export default function AdminAssessments() {
  const { data, error, errorStatus } = useAdminAssessments()
  const assessments = useMemo(() => normalAssessments(data), [data])
  const [state, dispatch] = useReducer(assessmentViewReducer, initialAssessmentView)
  const [selectedId, setSelectedId] = useState(null)
  const [moreFilters, setMoreFilters] = useState(false)
  const { filters, view } = state
  const { records, total, page } = useMemo(() => assessmentPage(assessments, filters, state.page), [assessments, filters, state.page])
  useEffect(() => { if (state.page !== page) dispatch({ type: 'page', value: page }) }, [state.page, page])
  const set = (key, value) => dispatch({ type: 'filter', key, value })
  const reset = () => dispatch({ type: 'reset' })
  const retry = () => { fetchWithDedup(ASSESSMENTS_URL).catch(() => {}) }
  const pending = data == null && !error
  const counts = useMemo(() => ({ all: assessments.length, published: assessments.filter(a => a.publication_status === 'published').length, draft: assessments.filter(a => a.publication_status === 'draft').length, closed: assessments.filter(a => a.publication_status === 'closed').length, flagged: assessments.reduce((sum, a) => sum + (a.flagged_count || 0), 0) }), [assessments])
  const options = useMemo(() => ({
    instructor: [...new Set(assessments.map(a => a.instructor_name).filter(Boolean))].sort().map(name => [name, name]),
    batch: [...new Map(assessments.filter(a => a.batch_id != null).map(a => [String(a.batch_id), a.batch_name || `Batch ${a.batch_id}`])).entries()].sort((a, b) => a[1].localeCompare(b[1])),
    category: [...new Set(assessments.flatMap(a => a.categories || []))].sort().map(name => [name, name]),
    availability: [...new Set(assessments.map(a => a.availability_status).filter(Boolean))].sort().map(value => [value, label(value)]),
  }), [assessments])
  const activeFilters = Object.entries(filters).filter(([key, value]) => key === 'search' ? value.trim() : value !== 'all')
  const secondaryCount = activeFilters.filter(([key]) => ['required', 'category', 'completion', 'included', 'availability'].includes(key)).length
  const selected = assessments.find(a => a.id === selectedId)
  const unavailable = [403, 404].includes(errorStatus)
  function selectFilter(key, title, values) {
    return <label className="min-w-0"><span className="sr-only">{title}</span><select aria-label={title} className={`${control} w-full`} value={filters[key]} onChange={event => set(key, event.target.value)}><option value="all">{title}</option>{values.map(([value, text]) => <option key={value} value={value}>{text}</option>)}</select></label>
  }

  return <div className="min-w-0"><section className="mx-auto max-w-7xl space-y-5 px-4 py-6 sm:px-6 sm:py-8">
    <header className="flex flex-wrap items-center justify-between gap-3"><div><h1 className="text-xl font-semibold text-gray-900 dark:text-white">Assessment oversight</h1><p className="mt-0.5 text-sm text-gray-500 dark:text-gray-400">Create assessments and manage publication, completion, and assessment integrity.</p></div><div className="flex flex-wrap gap-2"><Link to="/admin/assessments/archives" className={`${control} inline-flex items-center`}>Assessment archives</Link><Link to="/admin/assessment/create" className="min-h-11 rounded-xl bg-green-700 px-4 py-3 text-sm font-semibold text-white hover:bg-green-800 focus-visible:outline-2 focus-visible:outline-green-600">New Assessment</Link></div></header>
    {pending ? <AssessmentSkeleton layout="stats" count={5} /> : data != null && !unavailable ? <div className="grid grid-cols-2 gap-3 lg:grid-cols-5" aria-label="Global assessment totals">{[
      ['Total assessments', counts.all, <ReportIcon size={18} />], ['Published', counts.published, <ListIcon size={18} />], ['Drafts', counts.draft, <ReportIcon size={18} />], ['Closed', counts.closed, <ArchiveIcon size={18} />], ['Stopped / flagged', counts.flagged, <WarnIcon size={18} />],
    ].map(([name, count, icon]) => <div key={name} className={`${surface} flex items-start justify-between gap-2 p-4`}><div><strong className="text-2xl font-semibold tabular-nums text-gray-900 dark:text-white">{count}</strong><p className="mt-1 text-xs text-gray-500 dark:text-gray-400">{name}</p></div><span aria-hidden="true" className={`rounded-xl p-2 ${name === 'Published' ? 'bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-300' : 'bg-gray-50 text-gray-400 dark:bg-gray-800'}`}>{icon}</span></div>)}</div> : null}
    <section className={`${surface} min-w-0`} aria-label="Assessment results">
      <div className="border-b border-gray-100 px-4 pt-4 dark:border-gray-800 sm:px-5"><div className="mb-3 flex items-center gap-2"><h2 className="text-sm font-semibold text-gray-900 dark:text-white">All assessments</h2>{data != null && !unavailable && <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600 dark:bg-gray-800 dark:text-gray-300">{total} results</span>}</div>
        <div className="flex gap-1 overflow-x-auto pb-3" role="group" aria-label="Publication status">{statusTabs.map(([value, text]) => <button key={value} type="button" aria-pressed={filters.state === value} onClick={() => set('state', value)} className={`flex min-h-9 shrink-0 items-center gap-2 rounded-xl px-3 py-1.5 text-xs font-medium ${filters.state === value ? 'bg-green-50 text-green-800 dark:bg-green-950 dark:text-green-300' : 'text-gray-500 hover:bg-gray-50 dark:text-gray-400 dark:hover:bg-gray-800'}`}>{text}{data != null && !unavailable && <span className="rounded-full bg-gray-100 px-1.5 py-0.5 text-[10px] text-gray-600 dark:bg-gray-800 dark:text-gray-300">{counts[value]}</span>}</button>)}</div>
      </div>
      <div className="space-y-3 p-4 sm:p-5">
        <div className="flex flex-wrap items-center gap-2.5">
          <label className="relative w-full min-w-0 sm:min-w-56 sm:flex-1"><span className="sr-only">Search assessments</span><span aria-hidden="true" className="pointer-events-none absolute left-3 top-3 text-gray-400"><SearchIcon size={14} /></span><input type="search" className={`${control} w-full pl-9`} placeholder="Search title, instructor, or batch…" value={filters.search} onChange={event => set('search', event.target.value)} /></label>
          <div className="grid w-full min-w-0 grid-cols-2 gap-2.5 sm:w-auto">{selectFilter('instructor', 'All instructors', options.instructor)}{selectFilter('batch', 'All batches', options.batch)}</div>
          <button type="button" className={`${control} flex items-center gap-2 ${secondaryCount ? 'border-green-600 text-green-800 dark:text-green-300' : ''}`} aria-expanded={moreFilters} aria-controls="assessment-more-filters" onClick={() => setMoreFilters(value => !value)}>More filters{secondaryCount ? ` (${secondaryCount})` : ''}<span aria-hidden="true">{moreFilters ? '−' : '+'}</span></button>
          <div className="ml-auto flex items-center gap-1 rounded-xl bg-gray-100 p-1 dark:bg-gray-800" role="group" aria-label="Assessment view">{[['grid', <GridIcon size={14} />, 'Card view'], ['list', <ListIcon size={14} />, 'List view']].map(([value, icon, name]) => <button key={value} type="button" aria-label={name} aria-pressed={view === value} onClick={() => dispatch({ type: 'view', value })} className={`rounded-lg p-2.5 ${view === value ? 'bg-white text-gray-900 shadow-sm dark:bg-gray-700 dark:text-white' : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'}`}>{icon}</button>)}</div>
        </div>
        <div id="assessment-more-filters" hidden={!moreFilters} className="rounded-xl bg-gray-50 p-3 dark:bg-gray-950"><div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{[
          ['required', 'Requirement', [['required', 'Required'], ['optional', 'Optional']]], ['category', 'Category', options.category], ['completion', 'Completion', [['complete', '100% complete'], ['incomplete', 'Below 100%']]], ['included', 'Competency inclusion', [['included', 'Included'], ['excluded', 'Excluded']]], ['availability', 'Availability', options.availability],
        ].map(([key, title, values]) => <label key={key} className="min-w-0 text-xs font-medium text-gray-600 dark:text-gray-300">{title}<select aria-label={title} className={`${control} mt-1 w-full`} value={filters[key]} onChange={event => set(key, event.target.value)}><option value="all">All</option>{values.map(([value, text]) => <option key={value} value={value}>{text}</option>)}</select></label>)}</div></div>
        {activeFilters.length > 0 && <div className="flex flex-wrap items-center gap-2 text-xs"><span className="text-gray-500 dark:text-gray-400">{activeFilters.length} active filter{activeFilters.length === 1 ? '' : 's'}</span>{activeFilters.map(([key, value]) => <button key={key} className="max-w-full break-words rounded-lg bg-green-50 px-2 py-1.5 text-left text-green-800 dark:bg-green-950 dark:text-green-300" aria-label={`Remove ${key} filter: ${value}`} onClick={() => set(key, DEFAULT_FILTERS[key])}>{key === 'batch' ? options.batch.find(([id]) => id === value)?.[1] || value : label(value)} <span aria-hidden="true">×</span></button>)}<button className="min-h-9 px-2 font-medium text-gray-600 underline dark:text-gray-300" onClick={reset}>Clear all</button></div>}
        {error && <AssessmentRetry onRetry={retry}>{data != null && !unavailable ? 'Could not refresh. Showing the last loaded assessments.' : error}</AssessmentRetry>}
        {pending ? <AssessmentSkeleton layout={view} /> : !unavailable && data != null && (total ? <AssessmentResults records={records} view={view} onOpen={setSelectedId} /> : <div className="py-12 text-center"><span aria-hidden="true" className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-xl bg-gray-50 text-gray-400 dark:bg-gray-800"><ListIcon size={22} /></span><h3 className="text-sm font-semibold text-gray-900 dark:text-white">{assessments.length ? 'No matching assessments' : 'No assessments yet'}</h3><p className="mt-1 text-xs text-gray-500 dark:text-gray-400">{assessments.length ? 'Try another search or clear your filters.' : 'Create an assessment or ask an instructor to add one.'}</p>{activeFilters.length > 0 && <button className="mt-3 min-h-10 px-3 text-xs font-semibold text-green-800 dark:text-green-300" onClick={reset}>Reset filters</button>}</div>)}
      </div>
      {!pending && !unavailable && data != null && <AssessmentPagination total={total} page={page} onPage={value => dispatch({ type: 'page', value })} />}
    </section>
    <p className="text-xs text-gray-500 dark:text-gray-400">Open an assessment to review settings, student attempts, and authorized answer keys. Summary cards show totals for assessments outside the archive.</p>
  </section>{selectedId != null && <AssessmentManagementDialog key={selectedId} assessment={unavailable ? null : selected} onClose={() => setSelectedId(null)} />}</div>
}
