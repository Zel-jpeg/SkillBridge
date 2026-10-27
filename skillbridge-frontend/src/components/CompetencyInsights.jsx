import { assessmentSummary, categoryPercentage } from '../utils/assessmentSummary'
import { developmentAdvice } from '../utils/developmentAdvice'
import DevelopmentAdviceText from './DevelopmentAdviceText'
import { ChevronRightIcon } from './Icons'

export function HighestScoringAreas({ scores, audience = 'staff' }) {
  const result = assessmentSummary(scores, { audience })
  return <div className="min-w-0 text-sm leading-6 text-gray-800 dark:text-gray-200">
    <p className="font-semibold">{result.highestLabel}</p>
    {result.highestNames && <p className="mt-1 break-words">{result.highestNames}</p>}
  </div>
}

/** Uses current category evidence, including for profiles saved before this UI. */
export default function CompetencyInsights({ scores, profile, scope = 'combined', audience = 'staff', locked = false }) {
  const result = assessmentSummary(scores, { scope, audience, locked })
  const suggestions = developmentAdvice(result.suggestions, { profile, audience, scope })
  const content = <>
    <p className="font-semibold text-gray-900 dark:text-white">{result.highestLabel}</p>
    {result.highestNames && <p className="mt-1 break-words">{result.highestNames}</p>}
    <h3 className="mt-5 text-base font-semibold text-gray-900 dark:text-white">Assessment summary</h3>
    <p className="mt-2 break-words">{result.summary}</p>
    <section className="mt-6 border-t border-gray-200 pt-5 dark:border-gray-700">
      <h3 className="text-base font-semibold text-gray-900 dark:text-white">Suggested development focus</h3>
      {suggestions.length ? <ul className="mt-3 grid gap-3 md:grid-cols-2">
        {suggestions.map((item, index) => <li key={index} className="min-w-0 rounded-xl border border-gray-200 bg-gray-50 p-4 dark:border-gray-700 dark:bg-gray-800/50">
          <p className="break-words font-semibold text-gray-900 dark:text-white">{item.category}: <span className="whitespace-nowrap">{categoryPercentage(item.percentage)}</span></p>
          <DevelopmentAdviceText item={item} className="mt-1" />
        </li>)}
      </ul> : <p className="mt-2">{locked ? 'Guidance is available when results are unlocked.' : 'Guidance needs assessed category evidence.'}</p>}
      {!locked && result.suggestions.length > 0 && <p className="mt-4">Guidance reflects category scores. Category tags are examples of topics, not separately assessed skills. {audience === 'student' ? 'Review your next steps with your instructor or OJT coordinator.' : 'Review next steps with the student.'}</p>}
    </section>
  </>
  return <section aria-label={`${scope === 'combined' ? 'Combined' : 'Individual'} assessment interpretation`} className="min-w-0 rounded-2xl border border-gray-200 bg-white text-sm leading-6 text-gray-700 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200">
    {scope === 'combined' ? <details className="group">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-4 rounded-2xl p-5 transition-colors hover:bg-green-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-green-700 dark:hover:bg-green-950/20 dark:focus-visible:outline-green-400 sm:p-6 [&::-webkit-details-marker]:hidden">
        <span className="min-w-0">
          <span className="block text-base font-semibold text-gray-900 dark:text-white">Combined assessment results</span>
          <span className="mt-1 block text-sm text-gray-600 dark:text-gray-300">Summary and suggested development focus</span>
        </span>
        <span aria-hidden="true" className="shrink-0 text-green-800 transition-transform group-open:rotate-90 dark:text-green-300"><ChevronRightIcon size={18} /></span>
      </summary>
      <div className="border-t border-gray-200 p-5 dark:border-gray-700 sm:p-6">{content}</div>
    </details> : <div className="p-5 sm:p-6">
      <p className="mb-3 font-medium text-green-800 dark:text-green-300">Individual assessment results</p>
      {content}
    </div>}
  </section>
}
