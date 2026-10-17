import Pagination from '../Pagination'
import { WarnIcon } from '../Icons'

export function AssessmentStatus({ status }) {
  const tone = status === 'published' ? 'bg-green-50 text-green-800 dark:bg-green-950 dark:text-green-300' : status === 'draft' ? 'bg-amber-50 text-amber-800 dark:bg-amber-950 dark:text-amber-300' : 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300'
  return <span className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-2 py-1 text-[11px] font-medium capitalize ${tone}`}><span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden="true" />{status}</span>
}

export function CategorySummary({ categories = [] }) {
  const badge = 'max-w-full break-words rounded-md bg-gray-100 px-2 py-1 text-[11px] text-gray-600 dark:bg-gray-800 dark:text-gray-300'
  return <div className="flex flex-wrap items-start gap-1">
    {categories.slice(0, 2).map(name => <span key={name} className={badge}>{name}</span>)}
    {categories.length > 2 && <details className="max-w-full"><summary className={`${badge} cursor-pointer focus-visible:outline-2 focus-visible:outline-green-600`} aria-label={`Show ${categories.length - 2} more categories`}>+{categories.length - 2}</summary><ul className="mt-1 space-y-1 text-xs text-gray-600 dark:text-gray-300">{categories.slice(2).map(name => <li key={name} className="break-words">{name}</li>)}</ul></details>}
    {!categories.length && <span className="text-xs text-gray-500 dark:text-gray-400">No categories</span>}
  </div>
}

export function AssessmentProgress({ assessment: a }) {
  const percentage = Math.max(0, Math.min(100, a.completion_rate || 0))
  return <div className="space-y-1.5 text-xs">
    <p className="font-medium text-gray-700 dark:text-gray-200">{a.submission_count} of {a.assigned_count} submitted</p>
    <div className="flex items-center gap-2"><div role="progressbar" aria-label={`${a.title} completion`} aria-valuenow={percentage} aria-valuemin={0} aria-valuemax={100} className="h-1.5 min-w-12 flex-1 overflow-hidden rounded-full bg-gray-100 dark:bg-gray-800"><div className="h-full rounded-full bg-green-600" style={{ width: `${percentage}%` }} /></div><span className="text-gray-500 dark:text-gray-400">{percentage}%</span></div>
    <p className="text-[11px] text-gray-500 dark:text-gray-400">{a.assigned_count ? `${a.completion_count ?? 0} completed` : 'No participants'}</p>
  </div>
}

export function AssessmentIntegrity({ count }) {
  return <span className={`inline-flex items-center gap-1.5 text-xs ${count ? 'text-amber-800 dark:text-amber-300' : 'text-gray-500 dark:text-gray-400'}`}>{count > 0 && <WarnIcon size={14} />}{count || 0} stopped / flagged</span>
}

export function AssessmentPagination({ total, page, onPage, pageSize = 10, noun = 'assessments' }) {
  if (!total) return null
  return <nav aria-label={`${noun} pagination`} className="border-t border-gray-100 px-4 py-3 dark:border-gray-800">
    {total > pageSize ? <Pagination total={total} page={page} onPage={onPage} pageSize={pageSize} /> : <p className="text-xs text-gray-500 dark:text-gray-400">Showing 1–{total} of {total} {noun}</p>}
  </nav>
}

export function AssessmentSkeleton({ layout = 'grid', count = 6 }) {
  return <div role="status" aria-label="Loading assessments" aria-busy="true" className={layout === 'stats' ? 'grid grid-cols-2 gap-3 lg:grid-cols-5' : layout === 'grid' ? 'grid gap-3 md:grid-cols-2 xl:grid-cols-3' : 'space-y-0'}>
    {Array.from({ length: count }, (_, i) => <div aria-hidden="true" key={i} className={`motion-safe:animate-pulse rounded-2xl border border-gray-100 bg-white p-4 dark:border-gray-800 dark:bg-gray-900 ${layout === 'list' ? 'flex gap-5 rounded-none border-x-0' : ''}`}>
      <div className="flex-1"><div className="h-4 w-2/3 rounded bg-gray-200 dark:bg-gray-700" /><div className="mt-3 h-3 w-1/2 rounded bg-gray-100 dark:bg-gray-800" />{layout === 'grid' && <><div className="my-6 h-2 rounded bg-gray-100 dark:bg-gray-800" /><div className="mt-4 h-3 w-3/4 rounded bg-gray-100 dark:bg-gray-800" /><div className="mt-4 h-3 w-1/2 rounded bg-gray-100 dark:bg-gray-800" /></>}</div>
      {layout === 'list' && <div className="hidden w-2/3 grid-cols-4 gap-5 sm:grid">{[0, 1, 2, 3].map(n => <div key={n} className="h-3 rounded bg-gray-100 dark:bg-gray-800" />)}</div>}
    </div>)}<span className="sr-only">Loading assessments…</span>
  </div>
}

export function AssessmentRetry({ onRetry, children = 'Could not load assessments. Please try again.' }) {
  return <div role="alert" className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-200"><p>{children}</p><button type="button" onClick={onRetry} className="mt-2 min-h-9 font-semibold underline">Retry</button></div>
}

export function ActionSpinner() {
  return <span aria-hidden="true" className="inline-block h-3.5 w-3.5 rounded-full border-2 border-current border-r-transparent motion-safe:animate-spin" />
}
