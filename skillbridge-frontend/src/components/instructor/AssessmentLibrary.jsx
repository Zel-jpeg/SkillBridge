import { useMemo, useReducer, useState } from 'react'
import { Link } from 'react-router-dom'
import DataSection from '../DataSection'
import Pagination from '../Pagination'
import CollectionViewToggle from '../CollectionViewToggle'
import AssessmentReportPanel from '../AssessmentReportPanel'
import CategoryPills from '../assessment/AssessmentCategoryPills'
import { AssessmentStatus } from '../admin/AssessmentPresentation'
import { ChevronRightIcon, ClockIcon, ListIcon, PlusIcon, ReportIcon, SearchIcon, SkillIcon, UserIcon, WarnIcon } from '../Icons'
import { ASSESSMENTS_URL, assessmentPage, assessmentViewReducer, DEFAULT_FILTERS, initialAssessmentView } from '../../utils/adminAssessmentState'
import { manilaDateTime } from '../../utils/assessmentDates'

const surface = 'rounded-xl border border-gray-200/80 bg-white dark:border-gray-800 dark:bg-gray-900'
const control = 'min-h-10 min-w-0 rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs text-gray-700 focus-visible:outline-2 focus-visible:outline-green-600 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200'
const statusTabs = [['all', 'All'], ['published', 'Published'], ['draft', 'Drafts'], ['closed', 'Closed']]
const PAGE_SIZE = 4
const readable = value => value.replaceAll('_', ' ').replace(/^\w/, c => c.toUpperCase())

function Schedule({ assessment: a }) {
  return <p className="text-xs leading-5 text-gray-500 dark:text-gray-400">
    {a.available_at ? `Opens ${manilaDateTime(a.available_at)}` : 'Availability not set'}
    <span className="px-1.5" aria-hidden="true">·</span>
    {a.due_at ? `Due ${manilaDateTime(a.due_at)}` : 'Due date not set'}
  </p>
}

function Counts({ assessment: a, stacked = false }) {
  return <div className={`${stacked ? 'grid gap-1.5' : 'flex flex-wrap items-center gap-x-5 gap-y-2'} text-xs text-gray-500 dark:text-gray-400`}>
    <span className="inline-flex items-center gap-1.5"><span aria-hidden="true"><SkillIcon size={14} /></span><strong className="font-semibold text-gray-800 dark:text-gray-200">{a.question_count}</strong> questions</span>
    <span className="inline-flex items-center gap-1.5"><span aria-hidden="true"><UserIcon size={14} /></span><strong className="font-semibold text-gray-800 dark:text-gray-200">{a.submission_count}</strong> submitted</span>
    <span className={`inline-flex items-center gap-1.5 ${a.flagged_count ? 'text-amber-700 dark:text-amber-300' : stacked ? 'pl-5' : ''}`}>{a.flagged_count > 0 && <span aria-hidden="true"><WarnIcon size={14} /></span>}{a.flagged_count || 0} stopped / flagged</span>
  </div>
}

function Metadata({ assessment: a }) {
  return <div className="flex flex-wrap gap-x-3 gap-y-2 text-xs leading-5 text-gray-600 dark:text-gray-300">
    <span>{a.is_required ? 'Required' : 'Optional'}</span>
    <span>{a.include_in_competency ? 'Competency included' : 'Result only'}</span>
    <span>Order {a.display_order ?? 0}</span>
    <span className="text-gray-500 dark:text-gray-400">{readable(a.availability_status || 'Not set')}</span>
  </div>
}

function AssessmentCards({ records, view, onOpen }) {
  return <div className={`${view === 'grid' ? 'grid' : 'grid sm:hidden'} grid-cols-1 gap-4 lg:grid-cols-2`}>
    {records.map(a => <article key={a.id} className={`${surface} relative flex min-w-0 flex-col gap-4 p-5 transition-[border-color,box-shadow] hover:border-green-300 hover:shadow-sm dark:hover:border-green-700 sm:p-6`}>
      <div className="flex items-start justify-between gap-4">
        <h2 className="min-w-0 break-words text-sm font-semibold leading-6 text-gray-900 dark:text-white"><button type="button" aria-label={`Open assessment ${a.title}`} aria-haspopup="dialog" onClick={event => { event.currentTarget.focus(); onOpen(a) }} className="cursor-pointer text-left after:absolute after:inset-0 after:rounded-xl focus-visible:outline-none focus-visible:after:outline-2 focus-visible:after:outline-offset-2 focus-visible:after:outline-green-600 dark:focus-visible:after:outline-green-400">{a.title}</button></h2>
        <AssessmentStatus status={a.publication_status} />
      </div>
      <div className="flex flex-wrap items-center gap-3 text-xs">
        <span className="max-w-full break-words rounded-full bg-blue-50 px-2.5 py-1 font-medium text-blue-700 dark:bg-blue-950/50 dark:text-blue-300">{a.batch_name || 'No batch'}</span>
        <span className="inline-flex items-center gap-1.5 text-gray-500 dark:text-gray-400"><ClockIcon size={14} />{a.duration_minutes} min</span>
      </div>
      <Metadata assessment={a} />
      <CategoryPills categories={a.categories} />
      <div className="mt-auto pt-1"><Schedule assessment={a} /></div>
      <footer className="border-t border-gray-100 pt-4 dark:border-gray-800"><Counts assessment={a} /></footer>
    </article>)}
  </div>
}

function AssessmentList({ records, total, onOpen }) {
  return <div className={`${surface} hidden overflow-hidden sm:block`}>
    <div role="region" aria-label="Assessment list, scroll horizontally for all columns" tabIndex={0} className="overflow-x-auto focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-green-600">
      <table className="w-full min-w-[1080px] table-fixed text-left text-xs">
        <caption className="sr-only">Assessments, configuration, categories, schedule and activity</caption>
        <colgroup>{[21, 11, 16, 20, 14, 18].map((width, index) => <col key={index} style={{ width: `${width}%` }} />)}</colgroup>
        <thead className="border-b border-gray-100 bg-gray-50 text-gray-600 dark:border-gray-800 dark:bg-gray-800/60 dark:text-gray-300"><tr>{['Assessment', 'Status', 'Configuration', 'Categories', 'Schedule', 'Activity'].map(name => <th key={name} scope="col" className="px-4 py-3.5 font-semibold first:pl-5 last:pr-5">{name}</th>)}</tr></thead>
        <tbody className="divide-y divide-gray-100 dark:divide-gray-800">{records.map(a => <tr key={a.id} onClick={event => { if (!event.target.closest('button')) event.currentTarget.querySelector('button').click() }} className="group cursor-pointer align-top transition-colors hover:bg-green-50/80 dark:hover:bg-green-950/25">
          <td className="py-5 pl-5 pr-4">
            <button type="button" aria-label={`Open assessment ${a.title}`} aria-haspopup="dialog" onClick={event => { event.currentTarget.focus(); onOpen(a) }} className="cursor-pointer break-words rounded text-left text-sm font-semibold leading-5 text-gray-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-green-600 dark:text-white">{a.title}</button>
            <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-gray-500 dark:text-gray-400"><span className="break-words">{a.batch_name || 'No batch'}</span><span aria-hidden="true">·</span><span className="inline-flex items-center gap-1.5"><ClockIcon size={13} />{a.duration_minutes} min</span></div>
          </td>
          <td className="px-4 py-5"><AssessmentStatus status={a.publication_status} /></td>
          <td className="space-y-1.5 px-4 py-5 leading-4"><p className="font-medium text-gray-800 dark:text-gray-200">{a.is_required ? 'Required' : 'Optional'}</p><p className="text-gray-500 dark:text-gray-400">{a.include_in_competency ? 'Competency included' : 'Result only'}</p><p className="text-gray-500 dark:text-gray-400">Order {a.display_order ?? 0}</p></td>
          <td className="px-4 py-5"><CategoryPills categories={a.categories} /></td>
          <td className="px-4 py-5"><p className="mb-1.5 break-words font-medium leading-4 text-gray-800 dark:text-gray-200">{readable(a.availability_status || 'Not set')}</p><dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-2 gap-y-1 leading-4 text-gray-500 dark:text-gray-400"><dt>Opens</dt><dd>{a.available_at ? manilaDateTime(a.available_at) : '—'}</dd><dt>Due</dt><dd>{a.due_at ? manilaDateTime(a.due_at) : '—'}</dd></dl></td>
          <td className="py-5 pl-4 pr-5"><div className="flex items-center justify-between gap-2"><Counts assessment={a} stacked /><span aria-hidden="true" className="shrink-0 text-gray-400 transition-colors group-hover:text-green-700 dark:text-gray-500 dark:group-hover:text-green-400"><ChevronRightIcon size={16} /></span></div></td>
        </tr>)}</tbody>
      </table>
    </div>
    {total <= PAGE_SIZE && <footer className="flex flex-wrap items-center justify-between gap-2 border-t border-gray-100 px-5 py-3 text-xs text-gray-500 dark:border-gray-800 dark:text-gray-400"><p>Showing 1–{total} of {total} assessment{total === 1 ? '' : 's'}</p><p>{PAGE_SIZE} per page</p></footer>}
  </div>
}

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
      <DataSection url={ASSESSMENTS_URL} layout={view === 'grid' ? 'assessment-cards' : 'assessment-table'} count={view === 'grid' ? 3 : 4}>
        {total ? <><AssessmentCards records={records} view={view} onOpen={onOpen} />{view === 'list' && <AssessmentList records={records} total={total} onOpen={onOpen} />}<Pagination total={total} page={page} pageSize={PAGE_SIZE} onPage={value => dispatch({ type: 'page', value })} /></> : <div className={`${surface} px-6 py-12 text-center`}><h2 className="text-sm font-semibold text-gray-800 dark:text-gray-200">{assessments.length ? 'No assessments match your filters' : 'No assessments yet'}</h2><p className="mt-2 text-xs text-gray-500 dark:text-gray-400">{assessments.length ? 'Try another search or clear your filters.' : 'Create your first assessment using the button above.'}</p></div>}
      </DataSection>
    </section>
    <AssessmentReportPanel />
  </section>
}
