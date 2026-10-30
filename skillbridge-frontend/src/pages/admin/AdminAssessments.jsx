import { Link } from 'react-router-dom'
import { useMemo, useReducer, useState } from 'react'
import { fetchWithDedup } from '../../hooks/useApi'
import { useAdminAssessments } from '../../hooks/admin/useAdminAssessments'
import { ASSESSMENTS_URL, assessmentPage, assessmentViewReducer, DEFAULT_FILTERS, initialAssessmentView } from '../../utils/adminAssessmentState'
import AssessmentCollection from '../../components/assessment/AssessmentCollection'
import PublishAssessmentDrafts from '../../components/assessment/PublishAssessmentDrafts'
import CollectionFilterToolbar from '../../components/CollectionFilterToolbar'
import { assessmentFilterGroups } from '../../utils/assessmentFilterGroups'
import CollectionViewToggle from '../../components/CollectionViewToggle'
import Pagination from '../../components/Pagination'
import { ArchiveIcon, ListIcon, PlusIcon, ReportIcon, WarnIcon } from '../../components/Icons'
import { AssessmentRetry, AssessmentSkeleton } from '../../components/admin/AssessmentPresentation'
import AssessmentManagementDialog from '../../components/admin/AssessmentManagementDialog'

const normalAssessments = data => Array.isArray(data) ? data.filter(a => !a.is_archived) : []

const control = 'min-h-10 min-w-0 rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs text-gray-700 focus-visible:outline-2 focus-visible:outline-green-600 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300'
const surface = 'rounded-xl border border-gray-200/80 bg-white dark:border-gray-800 dark:bg-gray-900'
const label = value => value.replaceAll('_', ' ').replace(/^\w/, c => c.toUpperCase())

const PAGE_SIZE = 4

export default function AdminAssessments() {
  const { data, error, errorStatus } = useAdminAssessments()
  const assessments = useMemo(() => normalAssessments(data), [data])
  const [state, dispatch] = useReducer(assessmentViewReducer, initialAssessmentView)
  const [selectedId, setSelectedId] = useState(null)
  const { filters, view } = state
  const { records, total, page } = useMemo(() => assessmentPage(assessments, filters, state.page, PAGE_SIZE), [assessments, filters, state.page])
  if (state.page !== page) dispatch({ type: 'page', value: page })
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
  const selected = assessments.find(a => a.id === selectedId)
  const unavailable = [403, 404].includes(errorStatus)
  const groups = assessmentFilterGroups({ batches: options.batch, instructors: options.instructor, categories: options.category, availability: options.availability, oversight: true })

  return <div className="min-w-0"><section className="mx-auto max-w-7xl space-y-6 px-4 py-6 sm:px-6 sm:py-8 lg:px-10">
    <header className="flex flex-wrap items-center justify-between gap-3"><div><h1 className="text-xl font-semibold text-gray-900 dark:text-white">Assessment oversight</h1><p className="mt-1 text-xs leading-5 text-gray-500 dark:text-gray-400">Create assessments and manage publication, completion, and assessment integrity.</p></div><div className="flex flex-wrap gap-2"><PublishAssessmentDrafts assessments={assessments} /><Link to="/admin/assessments/archives" className={`${control} inline-flex items-center`}>Assessment archives</Link><Link to="/admin/assessment/create" className="inline-flex min-h-10 items-center gap-2 rounded-lg bg-green-600 px-4 py-2.5 text-xs font-semibold text-white hover:bg-green-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-green-600"><PlusIcon size={15} />Create assessment</Link></div></header>
    {pending ? <AssessmentSkeleton layout="stats" count={5} /> : data != null && !unavailable ? <div className="grid grid-cols-2 gap-3 lg:grid-cols-5" aria-label="Global assessment totals">{[
      ['Total assessments', counts.all, <ReportIcon size={18} />], ['Published', counts.published, <ListIcon size={18} />], ['Drafts', counts.draft, <ReportIcon size={18} />], ['Closed', counts.closed, <ArchiveIcon size={18} />], ['Stopped / flagged', counts.flagged, <WarnIcon size={18} />],
    ].map(([name, count, icon]) => <div key={name} className={`${surface} flex items-center gap-3 px-4 py-4`}><span aria-hidden="true" className={`shrink-0 rounded-lg p-2 ${name === 'Published' ? 'bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-300' : 'bg-gray-50 text-gray-400 dark:bg-gray-800'}`}>{icon}</span><div className="min-w-0"><strong className="text-2xl font-semibold tabular-nums text-gray-900 dark:text-white">{count}</strong><p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">{name}</p></div></div>)}</div> : null}
    <section className="min-w-0 space-y-4" aria-label="Assessment results">
      <h2 className="sr-only">All assessments</h2>
      <CollectionFilterToolbar filters={filters} defaults={DEFAULT_FILTERS} groups={groups}
        onApply={value => dispatch({ type: 'filters', value })} onSearch={value => set('search', value)}
        getPreviewCount={draft => assessmentPage(assessments, draft, 1, PAGE_SIZE).total}
        count={total} total={assessments.length} pending={pending} error={unavailable || (data == null && error) ? 'Assessments unavailable' : undefined}
        noun="assessments" label="Assessment filters" searchLabel="Search assessments" placeholder="Search title, instructor, or batch…">
        <CollectionViewToggle label="Assessment view" view={view} onChange={value => dispatch({ type: 'view', value })} />
      </CollectionFilterToolbar>
        {error && <AssessmentRetry onRetry={retry}>{data != null && !unavailable ? 'Could not refresh. Showing the last loaded assessments.' : error}</AssessmentRetry>}
        {pending ? <AssessmentSkeleton layout={view} count={4} /> : !unavailable && data != null && (total ? <AssessmentCollection records={records} total={total} view={view} onOpen={assessment => setSelectedId(assessment.id)} oversight /> : <div className="py-12 text-center"><span aria-hidden="true" className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-xl bg-gray-50 text-gray-400 dark:bg-gray-800"><ListIcon size={22} /></span><h3 className="text-sm font-semibold text-gray-900 dark:text-white">{assessments.length ? 'No matching assessments' : 'No assessments yet'}</h3><p className="mt-1 text-xs text-gray-500 dark:text-gray-400">{assessments.length ? 'Try another search or clear your filters.' : 'Create an assessment or ask an instructor to add one.'}</p>{activeFilters.length > 0 && <button className="mt-3 min-h-10 px-3 text-xs font-semibold text-green-800 dark:text-green-300" onClick={reset}>Reset filters</button>}</div>)}
      {!pending && !unavailable && data != null && <Pagination total={total} page={page} pageSize={PAGE_SIZE} onPage={value => dispatch({ type: 'page', value })} />}
    </section>
    <p className="text-xs text-gray-500 dark:text-gray-400">Open an assessment to review settings, student attempts, and authorized answer keys. Summary cards show totals for assessments outside the archive.</p>
  </section>{selectedId != null && <AssessmentManagementDialog key={selectedId} assessment={unavailable ? null : selected} onClose={() => setSelectedId(null)} />}</div>
}
