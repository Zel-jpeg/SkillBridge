import { assessmentSummary, categoryPercentage } from '../../utils/assessmentSummary'
import { developmentAdvice } from '../../utils/developmentAdvice'
import DevelopmentFocusItem from './DevelopmentFocusItem'
import { ChevronRightIcon, ReportIcon, StarIcon } from '../Icons'

export default function AssessmentInsights({ scores, profile }) {
  const result = assessmentSummary(scores, { scope: 'individual', audience: 'student' })
  const highest = result.leaders[0]?.percentage
  const positive = highest > 0
  const suggestions = developmentAdvice(result.suggestions, { profile }).sort((left, right) => left.percentage - right.percentage)
  return <section className="sa-card sa-insights" aria-label="Individual assessment interpretation">
    <header className="sa-insights-heading"><span className="sa-insights-symbol" aria-hidden="true"><ReportIcon size={21} /></span><div><h2>Assessment insights</h2><p className="sa-muted">Individual assessment</p></div></header>
    <div className={`sa-strength ${positive ? '' : 'is-neutral'}`}>
      {positive && <span className="sa-strength-symbol" aria-hidden="true"><StarIcon size={24} /></span>}
      <div className="sa-strength-copy"><p>{positive ? result.leaders.length > 1 ? 'Strongest areas · tied' : 'Strongest area' : result.highestLabel}</p>
        {result.highestNames && <div className="sa-strength-names" role={result.leaders.length > 3 ? 'region' : undefined} aria-label={result.leaders.length > 3 ? 'Highest-scoring categories' : undefined} tabIndex={result.leaders.length > 3 ? 0 : undefined}>{result.highestNames}</div>}
      </div>
      {highest != null && <div className="sa-strength-score"><strong>{categoryPercentage(highest)}</strong><span>Category score{result.leaders.length > 1 ? ' · each' : ''}</span></div>}
    </div>
    <p className="sa-insights-intro">{highest == null ? result.summary : highest === 0 ? 'Use guided practice to build your skills in the categories below.' : suggestions.some(item => item.percentage < 80) ? 'Start with your lowest-scoring categories below, then build on your strongest areas.' : 'Build on these results with more complex practical activities.'}</p>
    <div className="sa-focus-heading"><h3>Suggested development focus</h3><p className="sa-muted">{suggestions.length ? `${suggestions.length} focus area${suggestions.length === 1 ? '' : 's'} · lowest scores first` : 'Based on your category scores'}</p></div>
    {suggestions.length ? <ul className="sa-focus-list">{suggestions.map((item, index) => <DevelopmentFocusItem key={`${item.category}-${index}`} item={item} />)}</ul> : <p className="sa-muted">Guidance needs assessed category evidence.</p>}
    <footer className="sa-guidance-footer"><p>Review next steps with your instructor or OJT coordinator.</p>
      <details className="sa-guidance-details"><summary>How this guidance works<span aria-hidden="true"><ChevronRightIcon size={15} /></span></summary>
        <div><p>Guidance reflects category scores. Category tags are examples of topics, not separately assessed skills.</p><h4>Assessment summary</h4><p>{result.summary}</p></div>
      </details>
    </footer>
  </section>
}
