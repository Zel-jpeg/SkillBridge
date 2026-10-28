import { useMemo, useReducer, useState } from 'react'
import { Link } from 'react-router-dom'
import DataSection from '../DataSection'
import Pagination from '../Pagination'
import CollectionViewToggle from '../CollectionViewToggle'
import AssessmentReportPanel from '../AssessmentReportPanel'
import AssessmentCollection from '../assessment/AssessmentCollection'
import { ListIcon, PlusIcon, ReportIcon, SearchIcon, SkillIcon, UserIcon } from '../Icons'
import { ASSESSMENTS_URL, assessmentPage, assessmentViewReducer, DEFAULT_FILTERS, initialAssessmentView } from '../../utils/adminAssessmentState'

const surface = 'rounded-xl border border-gray-200/80 bg-white dark:border-gray-800 dark:bg-gray-900'
const control = 'min-h-10 min-w-0 rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs text-gray-700 focus-visible:outline-2 focus-visible:outline-green-600 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200'
const statusTabs = [['all', 'All'], ['published', 'Published'], ['draft', 'Drafts'], ['closed', 'Closed']]
const PAGE_SIZE = 4
const readable = value => value.replaceAll('_', ' ').replace(/^\w/, c => c.toUpperCase())

export default function AssessmentLibrary({ assessments, stats, batches, onOpen }) {
  const [state, dispatch] = useReducer(assessmentViewReducer, initialAssessmentView)
  const [moreFilters, setMoreFilters] = useState(false)
  const { filters, view } = state
  const { records, total, page } = useMemo(() => assessmentPage(assessments, filters, state.page, PAGE_SIZE), [assessments, filters, state.page])
  // Persist a clamp so a later refresh cannot jump back to a previously removed page.
  if (page !== state.page) dispatch({ type: 'page', value: page })
  const set = (key, value) => dispatch({ type: 'filter', key, value })
  const reset = () => dispatch({ type: 'reset' })
  const categories = [...new Set(assessments.flatMap(a => a.categories || []))].sort()
  const availability = [...new Set(['available', 'upcoming', 'overdue', 'closed', ...assessments.map(a => a.availability_status).filter(Boolean)])]
  const counts = { all: stats.total, published: stats.active, draft: stats.draft, closed: stats.closed }
  const active = Object.entries(filters).filter(([key, value]) => key === 'search' ? value.trim() : value !== 'all')
  const secondaryCount = active.filter(([key]) => ['required', 'included', 'category', 'availability'].includes(key)).length
  const filterNames = { search: 'Search', batch: 'Batch', state: 'Status', required: 'Requirement', included: 'Scoring', category: 'Category', availability: 'Availability' }
  function selectedLabel(key, value) {
    return key === 'batch' ? batches.find(b => String(b.id) === value)?.name || value : readable(value)
  }

  return <section className="mx-auto flex max-w-7xl flex-col gap-6 px-4 py-6 sm:px-6 sm:py-8 lg:px-10">
    <header className="flex flex-wrap items-center justify-between gap-4">
      <div><h1 className="text-xl font-semibold text-gray-900 dark:text-white">Assessments</h1><p className="mt-1 text-xs leading-5 text-gray-500 dark:text-gray-400">Manage assessments, batches, and competency settings.</p></div>
      <div className="flex flex-wrap gap-2"><Link to="/instructor/assessments/archives" className={`${control} inline-flex items-center`}>Assessment archives</Link><Link to="/instructor/assessment/create" className="inline-flex min-h-10 items-center gap-2 rounded-lg bg-green-600 px-4 py-2.5 text-xs font-semibold text-white transition-colors hover:bg-green-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-green-600"><PlusIcon size={15} />Create assessment</Link></div>
    </header>
    <DataSection url={ASSESSMENTS_URL} layout="library-stats" count={4}>
      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4" aria-label="Assessment totals">{[
        ['Total assessments', stats.total, <ReportIcon size={19} />], ['Active', stats.active, <UserIcon size={19} />], ['Questions', stats.questions, <ListIcon size={19} />], ['Submissions', stats.submissions, <SkillIcon size={19} />],
      ].map(([name, value, icon]) => <div key={name} className={`${surface} flex items-center gap-4 px-4 py-4 sm:px-5`}><span aria-hidden="true" className={`rounded-lg p-2.5 ${name === 'Active' ? 'bg-green-50 text-green-700 dark:bg-green-950/50 dark:text-green-400' : 'bg-gray-50 text-gray-500 dark:bg-gray-800 dark:text-gray-400'}`}>{icon}</span><div><strong className="text-2xl font-semibold tabular-nums text-gray-900 dark:text-white">{value}</strong><p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">{name}</p></div></div>)}</div>
    </DataSection>
    <section aria-label="Assessment library" className="min-w-0 space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <div role="group" aria-label="Publication status" className="flex flex-wrap gap-1.5">{statusTabs.map(([value, name]) => <button key={value} type="button" aria-pressed={filters.state === value} onClick={() => set('state', value)} className={`inline-flex min-h-9 cursor-pointer items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-green-600 ${filters.state === value ? 'bg-green-600 text-white' : 'text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800'}`}>{name}<span className={`rounded px-1.5 tabular-nums ${filters.state === value ? 'bg-white/15' : 'bg-gray-100 dark:bg-gray-800'}`}>{counts[value]}</span></button>)}{active.length > 0 && <button type="button" onClick={reset} className="min-h-9 cursor-pointer px-2 text-xs font-medium text-gray-600 underline focus-visible:outline-2 focus-visible:outline-green-600 dark:text-gray-300">Clear filters</button>}</div>
        <div className="ml-auto flex items-center gap-3"><p className="text-xs text-gray-500 dark:text-gray-400" aria-live="polite">{total} assessment{total === 1 ? '' : 's'}</p><CollectionViewToggle label="Assessment view" view={view} onChange={value => dispatch({ type: 'view', value })} /></div>
      </div>
      <div className="flex flex-wrap items-center gap-2.5">
        <label className="relative w-full min-w-0 sm:flex-1"><span className="sr-only">Search assessments</span><span aria-hidden="true" className="pointer-events-none absolute left-3 top-3 text-gray-400"><SearchIcon size={15} /></span><input type="search" placeholder="Search assessments…" value={filters.search} onChange={e => set('search', e.target.value)} className={`${control} w-full pl-9`} /></label>
        <label className="min-w-0 flex-1 sm:max-w-56"><span className="sr-only">All batches</span><select aria-label="All batches" value={filters.batch} onChange={e => set('batch', e.target.value)} className={`${control} w-full`}><option value="all">All batches</option>{batches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}</select></label>
        <button type="button" aria-expanded={moreFilters} aria-controls="instructor-assessment-filters" onClick={() => setMoreFilters(value => !value)} className={`${control} inline-flex cursor-pointer items-center gap-3 hover:border-green-400 ${secondaryCount ? 'border-green-600 text-green-800 dark:text-green-300' : ''}`}><ListIcon size={14} />More filters{secondaryCount > 0 && ` (${secondaryCount})`}<span aria-hidden="true">{moreFilters ? '−' : '+'}</span></button>
      </div>
      <div id="instructor-assessment-filters" hidden={!moreFilters} className={`${surface} p-4`}><div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{[
        ['required', 'Requirement', [['required', 'Required'], ['optional', 'Optional']]],
        ['included', 'Competency inclusion', [['included', 'Included'], ['excluded', 'Result only']]],
        ['category', 'Skill category', categories.map(c => [c, c])],
        ['availability', 'Availability', availability.map(value => [value, readable(value)])],
      ].map(([key, name, options]) => <label key={key} className="min-w-0 text-xs font-medium text-gray-600 dark:text-gray-300">{name}<select aria-label={name} value={filters[key]} onChange={e => set(key, e.target.value)} className={`${control} mt-1.5 w-full`}><option value="all">All</option>{options.map(([value, text]) => <option key={value} value={value}>{text}</option>)}</select></label>)}</div></div>
      {active.length > 0 && <div className="flex flex-wrap items-center gap-2 text-xs">{active.map(([key, value]) => <button type="button" key={key} aria-label={`Remove ${filterNames[key]} filter`} onClick={() => set(key, DEFAULT_FILTERS[key])} className="max-w-full cursor-pointer break-words rounded-lg bg-green-50 px-2.5 py-1.5 text-left text-green-800 hover:bg-green-100 focus-visible:outline-2 focus-visible:outline-green-600 dark:bg-green-950 dark:text-green-300 dark:hover:bg-green-900">{filterNames[key]}: {selectedLabel(key, value)} <span aria-hidden="true">×</span></button>)}</div>}
      <DataSection url={ASSESSMENTS_URL} layout={view === 'grid' ? 'assessment-cards' : 'assessment-table'} count={4} columns={view === 'grid' ? 4 : 6}>
        {total ? <><AssessmentCollection records={records} total={total} view={view} onOpen={onOpen} /><Pagination total={total} page={page} pageSize={PAGE_SIZE} onPage={value => dispatch({ type: 'page', value })} /></> : <div className={`${surface} px-6 py-12 text-center`}><h2 className="text-sm font-semibold text-gray-800 dark:text-gray-200">{assessments.length ? 'No assessments match your filters' : 'No assessments yet'}</h2><p className="mt-2 text-xs text-gray-500 dark:text-gray-400">{assessments.length ? 'Try another search or clear your filters.' : 'Create your first assessment using the button above.'}</p></div>}
      </DataSection>
    </section>
    <AssessmentReportPanel />
  </section>
}
