import CategoryPills from './AssessmentCategoryPills'
import { AssessmentIntegrity, AssessmentProgress, AssessmentStatus } from '../admin/AssessmentPresentation'
import { CalendarIcon, ChevronRightIcon, ClockIcon, SkillIcon, UserIcon, WarnIcon } from '../Icons'
import { manilaDateTime } from '../../utils/assessmentDates'
import './assessmentCollection.css'

const surface = 'rounded-xl border border-gray-200/80 bg-white dark:border-gray-800 dark:bg-gray-900'
const readable = value => value.replaceAll('_', ' ').replace(/^\w/, c => c.toUpperCase())

function Schedule({ assessment: a }) {
  return <div className="ac-schedule text-gray-500 dark:text-gray-400">
    <span aria-hidden="true"><CalendarIcon size={14} /></span>
    {!a.available_at && !a.due_at ? <p>No opening or due date set</p> : <div>
      <p>{a.available_at ? `Opens ${manilaDateTime(a.available_at)}` : 'No scheduled opening'}</p>
      <p>{a.due_at ? `Due ${manilaDateTime(a.due_at)}` : 'No due date set'}</p>
    </div>}
  </div>
}

function Counts({ assessment: a, stacked = false }) {
  return <div className={`${stacked ? 'grid gap-1.5' : 'flex flex-wrap items-center gap-x-5 gap-y-2'} text-xs text-gray-500 dark:text-gray-400`}>
    <span className="inline-flex items-center gap-1.5"><span aria-hidden="true"><SkillIcon size={14} /></span><strong className="font-semibold text-gray-800 dark:text-gray-200">{a.question_count}</strong> questions</span>
    <span className="inline-flex items-center gap-1.5"><span aria-hidden="true"><UserIcon size={14} /></span><strong className="font-semibold text-gray-800 dark:text-gray-200">{a.submission_count}</strong> submitted</span>
    <span className={`inline-flex items-center gap-1.5 ${a.flagged_count ? 'text-amber-700 dark:text-amber-300' : stacked ? 'pl-5' : ''}`}>{a.flagged_count > 0 && <span aria-hidden="true"><WarnIcon size={14} /></span>}{a.flagged_count || 0} stopped / flagged</span>
  </div>
}

function Metadata({ assessment: a }) {
  const availabilityTone = a.availability_status === 'available'
    ? 'text-green-700 dark:text-green-400' : a.availability_status === 'upcoming'
      ? 'text-blue-700 dark:text-blue-400' : a.availability_status === 'overdue'
        ? 'text-amber-700 dark:text-amber-400' : 'text-gray-500 dark:text-gray-400'
  return <div className="ac-configuration text-gray-600 dark:text-gray-300">
    <div className="flex flex-wrap items-center gap-2">
      <span className="rounded-md border border-gray-200 px-2 py-1 text-[11px] dark:border-gray-700">{a.is_required ? 'Required' : 'Optional'}</span>
      <span>{a.include_in_competency ? 'Competency included' : 'Result only'}</span>
    </div>
    <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
      <span className={`inline-flex items-center gap-1.5 ${availabilityTone}`}><span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-current" />{readable(a.availability_status || 'Not set')}</span>
      <span className="text-gray-500 dark:text-gray-400">Order {a.display_order ?? 0}</span>
    </div>
  </div>
}

function CardActivity({ assessment: a, oversight }) {
  return <div className="ac-activity border-gray-100 dark:border-gray-800">
    <dl className="ac-metrics divide-gray-100 dark:divide-gray-800">
      <div><dt className="text-gray-500 dark:text-gray-400">Questions</dt><dd className="text-gray-900 dark:text-white"><span aria-hidden="true"><SkillIcon size={17} /></span><strong>{a.question_count ?? '—'}</strong></dd></div>
      <div><dt className="text-gray-500 dark:text-gray-400">Submitted</dt><dd className="text-gray-900 dark:text-white"><span aria-hidden="true"><UserIcon size={17} /></span><strong>{a.submission_count ?? '—'}</strong>{oversight && <span className="text-[11px] text-gray-500 dark:text-gray-400">/ {a.assigned_count ?? '—'}</span>}</dd></div>
    </dl>
    {oversight && <div className="space-y-1.5"><p className="text-[11px] font-medium text-gray-500 dark:text-gray-400">Completion</p><AssessmentProgress assessment={a} showSubmitted={false} /></div>}
    <div className="flex min-w-0 items-center justify-between gap-2"><AssessmentIntegrity count={a.flagged_count} /><span aria-hidden="true" className="shrink-0 text-gray-400 transition-colors group-hover:text-green-700 dark:group-hover:text-green-400"><ChevronRightIcon size={17} /></span></div>
  </div>
}

function AssessmentCards({ records, view, onOpen, oversight }) {
  return <div className={`${view === 'grid' ? 'grid' : 'grid sm:hidden'} grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4`}>
    {records.map(a => <article key={a.id} className={`${surface} ac-card group relative flex min-w-0 flex-col transition-[border-color,box-shadow] hover:border-green-300 hover:shadow-sm dark:hover:border-green-700`}>
      <div className="flex items-start justify-between gap-2.5">
        <h2 className="min-w-0 break-words text-sm font-semibold leading-6 text-gray-900 dark:text-white"><button type="button" aria-label={`${oversight ? 'View details for' : 'Open assessment'} ${a.title}`} aria-haspopup="dialog" onClick={event => { event.currentTarget.focus(); onOpen(a) }} className="cursor-pointer text-left after:absolute after:inset-0 after:rounded-xl focus-visible:outline-none focus-visible:after:outline-2 focus-visible:after:outline-offset-2 focus-visible:after:outline-green-600 dark:focus-visible:after:outline-green-400">{a.title}</button></h2>
        <AssessmentStatus status={a.publication_status} />
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
        <span className="max-w-full break-words rounded-full bg-blue-50 px-2.5 py-1 font-medium text-blue-700 dark:bg-blue-950/50 dark:text-blue-300">{a.batch_name || 'No batch'}</span>
        <span className="inline-flex items-center gap-1.5 text-gray-500 dark:text-gray-400"><ClockIcon size={14} />{a.duration_minutes} min</span>
      </div>
      <Metadata assessment={a} />
      {oversight && <p className="break-words text-xs text-gray-600 dark:text-gray-300">{a.instructor_name || 'Instructor not provided'}</p>}
      <CategoryPills categories={a.categories} />
      <div className="mt-auto"><Schedule assessment={a} /></div>
      <CardActivity assessment={a} oversight={oversight} />
    </article>)}
  </div>
}

function AssessmentList({ records, total, pageSize, onOpen, oversight }) {
  return <div className={`${surface} hidden overflow-hidden sm:block`}>
    <div role="region" aria-label="Assessment list, scroll horizontally for all columns" tabIndex={0} className="overflow-x-auto focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-green-600">
      <table className="w-full min-w-[1080px] table-fixed text-left text-xs">
        <caption className="sr-only">Assessments, configuration, categories, schedule and activity</caption>
        <colgroup>{[21, 11, 16, 20, 14, 18].map((width, index) => <col key={index} style={{ width: `${width}%` }} />)}</colgroup>
        <thead className="border-b border-gray-100 bg-gray-50 text-gray-600 dark:border-gray-800 dark:bg-gray-800/60 dark:text-gray-300"><tr>{['Assessment', 'Status', 'Configuration', 'Categories', 'Schedule', 'Activity'].map(name => <th key={name} scope="col" className="px-4 py-3.5 font-semibold first:pl-5 last:pr-5">{name}</th>)}</tr></thead>
        <tbody className="divide-y divide-gray-100 dark:divide-gray-800">{records.map(a => <tr key={a.id} onClick={event => { if (!event.target.closest('button, a, input, select, textarea, summary')) event.currentTarget.querySelector('button').click() }} className="group cursor-pointer align-top transition-colors hover:bg-green-50/80 dark:hover:bg-green-950/25">
          <td className="py-5 pl-5 pr-4">
            <button type="button" aria-label={`${oversight ? 'View details for' : 'Open assessment'} ${a.title}`} aria-haspopup="dialog" onClick={event => { event.currentTarget.focus(); onOpen(a) }} className="cursor-pointer break-words rounded text-left text-sm font-semibold leading-5 text-gray-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-green-600 dark:text-white">{a.title}</button>
            {oversight && <p className="mt-1 break-words text-xs text-gray-600 dark:text-gray-300">{a.instructor_name || 'Instructor not provided'}</p>}
            <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-gray-500 dark:text-gray-400"><span className="break-words">{a.batch_name || 'No batch'}</span><span aria-hidden="true">·</span><span className="inline-flex items-center gap-1.5"><ClockIcon size={13} />{a.duration_minutes} min</span></div>
          </td>
          <td className="px-4 py-5"><AssessmentStatus status={a.publication_status} /></td>
          <td className="space-y-1.5 px-4 py-5 leading-4"><p className="font-medium text-gray-800 dark:text-gray-200">{a.is_required ? 'Required' : 'Optional'}</p><p className="text-gray-500 dark:text-gray-400">{a.include_in_competency ? 'Competency included' : 'Result only'}</p><p className="text-gray-500 dark:text-gray-400">Order {a.display_order ?? 0}</p></td>
          <td className="px-4 py-5"><CategoryPills categories={a.categories} /></td>
          <td className="px-4 py-5"><p className="mb-1.5 break-words font-medium leading-4 text-gray-800 dark:text-gray-200">{readable(a.availability_status || 'Not set')}</p><dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-2 gap-y-1 leading-4 text-gray-500 dark:text-gray-400"><dt>Opens</dt><dd>{a.available_at ? manilaDateTime(a.available_at) : '—'}</dd><dt>Due</dt><dd>{a.due_at ? manilaDateTime(a.due_at) : '—'}</dd></dl></td>
          <td className="py-5 pl-4 pr-5"><div className="flex items-center justify-between gap-2">{oversight ? <div className="min-w-0 space-y-2"><span className="text-gray-500 dark:text-gray-400">{a.question_count} questions</span><AssessmentProgress assessment={a} /><AssessmentIntegrity count={a.flagged_count} /></div> : <Counts assessment={a} stacked />}<span aria-hidden="true" className="shrink-0 text-gray-400 transition-colors group-hover:text-green-700 dark:text-gray-500 dark:group-hover:text-green-400"><ChevronRightIcon size={16} /></span></div></td>
        </tr>)}</tbody>
      </table>
    </div>

    {total <= pageSize && <footer className="flex flex-wrap items-center justify-between gap-2 border-t border-gray-100 px-5 py-3 text-xs text-gray-500 dark:border-gray-800 dark:text-gray-400"><p>Showing 1–{total} of {total} assessment{total === 1 ? '' : 's'}</p><p>{pageSize} per page</p></footer>}
  </div>
}

export default function AssessmentCollection({ records, view, onOpen, total = records.length, pageSize = 4, oversight = false }) {
  return <><AssessmentCards records={records} view={view} onOpen={onOpen} oversight={oversight} />
    {view === 'list' && <AssessmentList records={records} total={total} pageSize={pageSize} onOpen={onOpen} oversight={oversight} />}</>
}
