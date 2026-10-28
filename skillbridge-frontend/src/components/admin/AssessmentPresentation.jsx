import { ContentSkeleton } from '../loading/Skeletons'
import Pagination from '../Pagination'
import { WarnIcon } from '../Icons'
import AssessmentCategoryPills from '../assessment/AssessmentCategoryPills'

export function AssessmentStatus({ status }) {
  const tone = status === 'published' ? 'bg-green-50 text-green-800 dark:bg-green-950 dark:text-green-300' : status === 'draft' ? 'bg-amber-50 text-amber-800 dark:bg-amber-950 dark:text-amber-300' : 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300'
  return <span className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-2 py-1 text-[11px] font-medium capitalize ${tone}`}><span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden="true" />{status}</span>
}

export function CategorySummary({ categories = [] }) {
  return <AssessmentCategoryPills categories={categories} />
}

export function AssessmentProgress({ assessment: a, showSubmitted = true }) {
  const percentage = Math.max(0, Math.min(100, a.completion_rate || 0))
  return <div className="space-y-1.5 text-xs">
    {showSubmitted && <p className="font-medium text-gray-700 dark:text-gray-200">{a.submission_count} of {a.assigned_count} submitted</p>}
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

export function AssessmentSkeleton({ layout = 'grid', count }) {
  return <ContentSkeleton layout={layout === 'stats' ? 'assessment-stats' : layout === 'grid' ? 'assessment-cards' : 'assessment-table'} count={count ?? (layout === 'stats' ? 5 : 4)} columns={layout === 'list' ? 6 : 4} label="Loading assessments" />
}

export function AssessmentRetry({ onRetry, children = 'Could not load assessments. Please try again.' }) {
  return <div role="alert" className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-200"><p>{children}</p><button type="button" onClick={onRetry} className="mt-2 min-h-9 font-semibold underline">Retry</button></div>
}

export function ActionSpinner() {
  return <span aria-hidden="true" className="inline-block h-3.5 w-3.5 rounded-full border-2 border-current border-r-transparent motion-safe:animate-spin" />
}
