import CompanyImage from '../CompanyImage'
import MatchBreakdown from '../MatchBreakdown'
import ScoreLabel from '../ScoreLabel'
import { CheckCircleIcon, PinIcon, WarnIcon } from '../Icons'
import { assessmentMatchProgress, assessmentProgressLabel, componentPercent, coverageDisplay, hasUnassessedRequirements, isAssessmentLed, isAssessmentMatch, isEvidenceMatch, recommendationDetails, recommendationDisplay, recommendationLabel, recommendationValue } from '../../utils/recommendationResults'
import './scoreDetailsCard.css'

const RANK_COLORS = ['sd-rank--first', 'sd-rank--second', 'sd-rank--third']

export default function ScoreDetailsCard({ recommendation: r, rank, onViewPartner }) {
  const value = recommendationValue(r)
  const incomplete = hasUnassessedRequirements(r)
  const tone = incomplete || value == null ? 'sd-score--muted' : value >= 80 ? 'sd-score--strong' : value >= 60 ? 'sd-score--fair' : 'sd-score--muted'
  const details = recommendationDetails(r)
  const progress = assessmentMatchProgress(r)
  const bar = value ?? (isAssessmentMatch(r) ? progress.percentage : null)
  const minimumLabel = details.all_targets_met ? 'Meets all category minimums' : incomplete ? `${assessmentProgressLabel(r)} · ${isEvidenceMatch(r) ? 'unassessed categories earn no match credit.' : 'some categories are not assessed yet.'}` : 'Below one or more category minimums'

  return <article className="sd-score-card">
    <div className="sd-card-content">
      <header className="sd-card-header">
        <span aria-label={`Partner rank ${rank}`} className={`sd-rank ${RANK_COLORS[rank - 1] || ''}`}>#{rank}</span>
        <div className="sd-card-identity">
          <div className="sd-company"><CompanyImage name={r.company} imageUrl={r.company_image_url} className="h-9 w-9 rounded-lg" /><h3>{r.company}</h3></div>
          <p className="sd-role-label">Top suggested position</p><p className="sd-role">{r.position}</p>
          <p className="sd-address"><span aria-hidden="true"><PinIcon size={14} /></span>{r.address || 'Address not provided'}</p>
        </div>
        <div className={`sd-card-score ${tone}`}><strong>{recommendationDisplay(r)}</strong><span><ScoreLabel label={recommendationLabel(r)} /></span></div>
      </header>
      <div className="sd-tags">{r.tags.slice(0, 3).map(tag => <span key={tag}>{tag}</span>)}{r.tags.length > 3 && <p>+{r.tags.length - 3} more</p>}</div>
      <div className="sd-card-meta"><p>{r.suggestedPositionCount} suggested position{r.suggestedPositionCount !== 1 ? 's' : ''}<span aria-hidden="true"> · </span>Top role: {r.slots} slot{r.slots !== 1 ? 's' : ''}</p>
        {r.distKm != null && <span className="sd-distance"><PinIcon size={13} />{r.distKm.toFixed(1)} km straight-line</span>}
      </div>
      <div className={`sd-card-track ${tone}`} aria-hidden="true"><span style={{ width: Number.isFinite(bar) ? `${Math.max(0, Math.min(100, bar))}%` : '0%' }} /></div>
      {isAssessmentMatch(r) ? <p className={`sd-minimum${details.all_targets_met ? ' sd-minimum--met' : ''}`}><span aria-hidden="true">{details.all_targets_met ? <CheckCircleIcon size={17} /> : <WarnIcon size={17} />}</span>{minimumLabel}</p> : <div className="sd-legacy-components">
        <span><ScoreLabel label={isAssessmentLed(r) ? 'Requirement coverage' : 'Category fit'} /> {isAssessmentLed(r) ? coverageDisplay(r) : componentPercent(r.category_score_component)}</span>
        <span>NLP text similarity {componentPercent(r.nlp_score_component)}</span><span>Location {componentPercent(r.location_score_component)}</span>
        <span>{r.model_used || 'fallback'} model</span>
      </div>}
    </div>
    <footer className="sd-card-actions">
      <MatchBreakdown recommendation={r} triggerClassName="sd-card-action sd-card-action--secondary" />
      <button type="button" className="sd-card-action sd-card-action--primary" onClick={onViewPartner} aria-label={`View partner details for ${r.company}, ${r.position}`} aria-haspopup="dialog">View partner details</button>
    </footer>
  </article>
}
