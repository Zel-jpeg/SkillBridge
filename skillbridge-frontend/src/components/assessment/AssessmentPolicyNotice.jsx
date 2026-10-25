import { assessmentChangeImpact, assessmentLocks } from '../../utils/assessmentPolicy'
import { ChevronDown, LockIcon } from '../Icons'

const timingGuidance = 'A student’s countdown shows the shorter of the assessment time limit and the time remaining until its deadline. Existing attempts keep their assigned cutoff; use Grant extra time to extend a current attempt.'

export function AssessmentTimingGuidance() {
  return <details className="group text-xs leading-5">
    <summary className="flex w-fit cursor-pointer list-none items-center gap-1.5 rounded text-green-700 hover:text-green-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-green-600 dark:text-green-400 dark:hover:text-green-300 [&::-webkit-details-marker]:hidden">How student timing works<span aria-hidden="true" className="-rotate-90 transition-transform group-open:rotate-0"><ChevronDown size={13} /></span></summary>
    <p className="mt-2 max-w-2xl text-gray-500 dark:text-gray-400">{timingGuidance}</p>
  </details>
}

export default function AssessmentPolicyNotice({ assessment, value, variant = 'default' }) {
  const locks = assessmentLocks(assessment)
  const impact = value ? assessmentChangeImpact(assessment, value) : []
  if (variant === 'modal' && !locks.attempted && !impact.length) return null
  return <div className="space-y-3 text-xs leading-5">
    {locks.attempted && (variant === 'modal' ? <details className="group rounded-lg border border-amber-200 bg-amber-50/80 text-amber-950 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-200">
      <summary className="grid cursor-pointer list-none grid-cols-[36px_minmax(0,1fr)] items-start gap-x-3 gap-y-2 rounded-lg p-3 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-green-600 sm:grid-cols-[36px_minmax(0,1fr)_auto] sm:items-center sm:p-4 [&::-webkit-details-marker]:hidden">
        <span aria-hidden="true" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-300"><LockIcon size={17} /></span>
        <span className="min-w-0 flex-1"><strong className="block text-sm font-semibold">Some settings are locked</strong><span className="mt-0.5 block text-xs text-amber-900/80 dark:text-amber-200/80">A student attempt exists. Questions, answer keys, duration and opening time are locked.</span></span>
        <span className="col-start-2 inline-flex items-center gap-2 text-xs font-medium sm:col-start-auto">View editing rules<span aria-hidden="true" className="transition-transform group-open:rotate-180"><ChevronDown size={13} /></span></span>
      </summary>
      <ul className="mx-3 mb-3 list-disc space-y-1.5 border-t border-amber-200 pt-3 pl-5 text-amber-900 dark:border-amber-800 dark:text-amber-200 sm:mx-4 sm:mb-4">
        <li>Question content, categories, answer keys and imports cannot be changed after an attempt.</li>
        <li>{assessment.due_at ? 'The assessment deadline can only be extended or removed.' : 'A new deadline cannot be introduced.'}</li>
        {locks.publication && <li>Publication is locked while students are taking the assessment.</li>}
        <li>Titles, display order and allowed settings remain editable. Student attempts, scores and placement history are preserved.</li>
      </ul>
    </details> : <p role="status" className="rounded-lg bg-gray-50 p-3 text-gray-600 dark:bg-gray-800 dark:text-gray-300">A student attempt exists. Questions, answer keys, the standard duration and opening time are locked. {assessment.due_at ? 'The assessment deadline can only be extended or removed.' : 'A new deadline cannot be introduced.'} {locks.publication ? 'Publication is locked while students are taking the assessment.' : ''}</p>)}
    {variant !== 'modal' && <p className="text-gray-500 dark:text-gray-400">{timingGuidance}</p>}
    {impact.length > 0 && <section aria-label="Effect of assessment changes" className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-amber-900 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200"><h4 className="font-semibold">Review the effect of these changes</h4><ul className="mt-2 list-disc space-y-2 pl-4">{impact.map(message => <li key={message}>{message}</li>)}</ul><p className="mt-2">Saved individual results and placement snapshots are preserved.</p></section>}
  </div>
}
