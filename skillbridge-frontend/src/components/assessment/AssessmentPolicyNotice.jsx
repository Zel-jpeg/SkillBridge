import { assessmentChangeImpact, assessmentLocks } from '../../utils/assessmentPolicy'

export default function AssessmentPolicyNotice({ assessment, value }) {
  const locks = assessmentLocks(assessment)
  const impact = value ? assessmentChangeImpact(assessment, value) : []
  return <div className="space-y-3 text-xs leading-5">
    {locks.attempted && <p role="status" className="rounded-lg bg-gray-50 p-3 text-gray-600 dark:bg-gray-800 dark:text-gray-300">A student attempt exists. Questions, answer keys, the standard duration and opening time are locked. {assessment.due_at ? 'The assessment deadline can only be extended or removed.' : 'A new deadline cannot be introduced.'} {locks.publication ? 'Publication is locked while students are taking the assessment.' : ''}</p>}
    <p className="text-gray-500 dark:text-gray-400">A student’s countdown shows the shorter of the assessment time limit and the time remaining until its deadline. Existing attempts keep their assigned cutoff; use Grant extra time to extend a current attempt.</p>
    {impact.length > 0 && <section aria-label="Effect of assessment changes" className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-amber-900 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200"><h4 className="font-semibold">Review the effect of these changes</h4><ul className="mt-2 list-disc space-y-2 pl-4">{impact.map(message => <li key={message}>{message}</li>)}</ul><p className="mt-2">Saved individual results and placement snapshots are preserved.</p></section>}
  </div>
}
