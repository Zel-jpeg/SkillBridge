import { useMemo, useReducer } from 'react'
import { Link } from 'react-router-dom'
import DataSection from '../DataSection'
import Pagination from '../Pagination'
import CollectionFilterToolbar from '../CollectionFilterToolbar'
import { assessmentFilterGroups } from '../../utils/assessmentFilterGroups'
import CollectionViewToggle from '../CollectionViewToggle'
import AssessmentReportPanel from '../AssessmentReportPanel'
import AssessmentCollection from '../assessment/AssessmentCollection'
import PublishAssessmentDrafts from '../assessment/PublishAssessmentDrafts'
import { ListIcon, PlusIcon, ReportIcon, SkillIcon, UserIcon } from '../Icons'
import { ASSESSMENTS_URL, assessmentPage, assessmentViewReducer, DEFAULT_FILTERS, initialAssessmentView } from '../../utils/adminAssessmentState'

const surface = 'rounded-xl border border-gray-200/80 bg-white dark:border-gray-800 dark:bg-gray-900'
const control = 'min-h-10 min-w-0 rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs text-gray-700 focus-visible:outline-2 focus-visible:outline-green-600 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200'
const PAGE_SIZE = 4
const readable = value => value.replaceAll('_', ' ').replace(/^\w/, c => c.toUpperCase())

export default function AssessmentLibrary({ assessments, stats, batches, onOpen, pending = false, error }) {
  const [state, dispatch] = useReducer(assessmentViewReducer, initialAssessmentView)
  const { filters, view } = state
  const { records, total, page } = useMemo(() => assessmentPage(assessments, filters, state.page, PAGE_SIZE), [assessments, filters, state.page])
  // Persist a clamp so a later refresh cannot jump back to a previously removed page.
  if (page !== state.page) dispatch({ type: 'page', value: page })
  const set = (key, value) => dispatch({ type: 'filter', key, value })
  const categories = [...new Set(assessments.flatMap(a => a.categories || []))].sort()
  const availability = [...new Set(['available', 'upcoming', 'overdue', 'closed', ...assessments.map(a => a.availability_status).filter(Boolean)])]
  const groups = assessmentFilterGroups({ batches: batches.map(batch => [String(batch.id), batch.name]), categories: categories.map(value => [value, value]), availability: availability.map(value => [value, readable(value)]) })

  return <section className="mx-auto flex max-w-7xl flex-col gap-6 px-4 py-6 sm:px-6 sm:py-8 lg:px-10">
    <header className="flex flex-wrap items-center justify-between gap-4">
      <div><h1 className="text-xl font-semibold text-gray-900 dark:text-white">Assessments</h1><p className="mt-1 text-xs leading-5 text-gray-500 dark:text-gray-400">Manage assessments, batches, and competency settings.</p></div>
      <div className="flex flex-wrap gap-2"><PublishAssessmentDrafts assessments={assessments} /><Link to="/instructor/assessments/archives" className={`${control} inline-flex items-center`}>Assessment archives</Link><Link to="/instructor/assessment/create" className="inline-flex min-h-10 items-center gap-2 rounded-lg bg-green-600 px-4 py-2.5 text-xs font-semibold text-white transition-colors hover:bg-green-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-green-600"><PlusIcon size={15} />Create assessment</Link></div>
    </header>
    <DataSection url={ASSESSMENTS_URL} layout="library-stats" count={4}>
      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4" aria-label="Assessment totals">{[
        ['Total assessments', stats.total, <ReportIcon size={19} />], ['Active', stats.active, <UserIcon size={19} />], ['Questions', stats.questions, <ListIcon size={19} />], ['Submissions', stats.submissions, <SkillIcon size={19} />],
      ].map(([name, value, icon]) => <div key={name} className={`${surface} flex items-center gap-4 px-4 py-4 sm:px-5`}><span aria-hidden="true" className={`rounded-lg p-2.5 ${name === 'Active' ? 'bg-green-50 text-green-700 dark:bg-green-950/50 dark:text-green-400' : 'bg-gray-50 text-gray-500 dark:bg-gray-800 dark:text-gray-400'}`}>{icon}</span><div><strong className="text-2xl font-semibold tabular-nums text-gray-900 dark:text-white">{value}</strong><p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">{name}</p></div></div>)}</div>
    </DataSection>
    <section aria-label="Assessment library" className="min-w-0 space-y-4">
      <CollectionFilterToolbar filters={filters} defaults={DEFAULT_FILTERS} groups={groups}
        onApply={value => dispatch({ type: 'filters', value })} onSearch={value => set('search', value)}
        getPreviewCount={draft => assessmentPage(assessments, draft, 1, PAGE_SIZE).total}
        count={total} total={assessments.length} pending={pending} error={error} noun="assessments" label="Assessment filters" searchLabel="Search assessments" placeholder="Search assessments…">
        <CollectionViewToggle label="Assessment view" view={view} onChange={value => dispatch({ type: 'view', value })} />
      </CollectionFilterToolbar>
      <DataSection url={ASSESSMENTS_URL} layout={view === 'grid' ? 'assessment-cards' : 'assessment-table'} count={4} columns={view === 'grid' ? 4 : 6}>
        {total ? <><AssessmentCollection records={records} total={total} view={view} onOpen={onOpen} /><Pagination total={total} page={page} pageSize={PAGE_SIZE} onPage={value => dispatch({ type: 'page', value })} /></> : <div className={`${surface} px-6 py-12 text-center`}><h2 className="text-sm font-semibold text-gray-800 dark:text-gray-200">{assessments.length ? 'No assessments match your filters' : 'No assessments yet'}</h2><p className="mt-2 text-xs text-gray-500 dark:text-gray-400">{assessments.length ? 'Try another search or clear your filters.' : 'Create your first assessment using the button above.'}</p></div>}
      </DataSection>
    </section>
    <AssessmentReportPanel />
  </section>
}
