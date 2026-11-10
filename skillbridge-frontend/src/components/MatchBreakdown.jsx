import { isAssessmentMatch, recommendationDetails, recommendationDisplay, recommendationValue, componentPercent } from '../utils/recommendationResults'

export default function MatchBreakdown({ recommendation }) {
  if (!isAssessmentMatch(recommendation)) return null
  const details = recommendationDetails(recommendation)
  const rows = details.requirements || []
  return <details className="relative z-10 mt-3 text-xs text-gray-600 dark:text-gray-300">
    <summary className="w-fit cursor-pointer rounded font-semibold text-green-700 focus-visible:outline-2 focus-visible:outline-green-600 dark:text-green-300">View match breakdown</summary>
    <p className="mt-2 font-medium">{details.all_targets_met ? 'Meets all required category minimums' : details.unknown ? 'Incomplete evidence — some required categories are unassessed' : 'Below one or more category minimums'}</p>
    <dl className="mt-2 space-y-2">{rows.map((row, index) => <div key={row.category_id || `${row.category}:${index}`} className="flex flex-wrap justify-between gap-x-3 gap-y-1">
      <dt className="min-w-0 break-words">{row.category}</dt>
      <dd>{Number.isFinite(row.assessed_percentage) ? `${Number(row.assessed_percentage.toFixed(1))}%` : 'Unassessed'} · minimum {row.target}%</dd>
    </div>)}</dl>
    <p className="mt-3">{recommendationValue(recommendation) == null ? 'A complete match percentage is unavailable until every required category has assessment evidence.' : `Average of ${rows.length} required ${rows.length === 1 ? 'category' : 'categories'} = ${recommendationDisplay(recommendation)} Match.`}</p>
    <p className="mt-2">Each category has equal weight. Minimums are checked separately. NLP and location are tie-breakers and are excluded from this percentage.</p>
    <p className="mt-2">Supporting scores: NLP text similarity {componentPercent(recommendation.nlp_score_component)} · location {componentPercent(recommendation.location_score_component)}.</p>
  </details>
}
