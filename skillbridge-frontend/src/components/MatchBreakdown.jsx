import { useRef, useState } from 'react'
import DialogShell from './DialogShell'
import { CheckCircleIcon, InfoCircleIcon, PinIcon, ReportIcon, WarnIcon } from './Icons'
import { assessmentMatchProgress, assessmentProgressLabel, isEvidenceMatch, isAssessmentMatch, recommendationDetails, recommendationDisplay, recommendationValue, componentPercent } from '../utils/recommendationResults'
import './matchBreakdown.css'

export default function MatchBreakdown({ recommendation, partnerName, triggerClassName }) {
  const [open, setOpen] = useState(false)
  const opener = useRef(null)
  if (!isAssessmentMatch(recommendation)) return null

  const details = recommendationDetails(recommendation)
  const rows = details.requirements || []
  const progress = assessmentMatchProgress(recommendation)
  const total = details.match_calculation?.assessed_percentage_total ?? rows.reduce((sum, row) => sum + (Number.isFinite(row.assessed_percentage) ? row.assessed_percentage : 0), 0)
  const totalLabel = Number.isFinite(total) ? Number(total.toFixed(2)) : 'Unavailable'
  const company = partnerName || (typeof recommendation.company === 'string' ? recommendation.company : recommendation.company?.name)
  const position = typeof recommendation.position === 'string' ? recommendation.position : recommendation.position?.title || recommendation.title
  const context = [company, position].filter(Boolean).join(' · ')
  const complete = rows.length > 0 && rows.every(row => Number.isFinite(row.assessed_percentage))
  const status = details.all_targets_met ? 'All category minimums met' : details.unknown || !complete ? 'Some required categories are unassessed' : 'Below one or more category minimums'
  const shortFormula = complete && rows.length === progress.required && rows.length <= 4 && rows.every(row => row.assessed_percentage === Number(row.assessed_percentage.toFixed(1)))
    ? `(${rows.map(row => `${Number(row.assessed_percentage.toFixed(1))}%`).join(' + ')}) ÷ ${rows.length} = ${recommendationDisplay(recommendation)}`
    : `${totalLabel} assessed percentage points ÷ ${progress.required} required ${progress.required === 1 ? 'category' : 'categories'} = ${recommendationDisplay(recommendation)}`

  return <>
    <button type="button" aria-haspopup="dialog" aria-label={context ? `View match breakdown for ${context}` : 'View match breakdown'}
      onClick={event => { opener.current = event.currentTarget; setOpen(true) }}
      className={triggerClassName || 'mb-open'}>
      <span aria-hidden="true"><ReportIcon size={16} /></span><span>View match breakdown</span>
    </button>
    {open && <DialogShell size="match" title="Match breakdown" description={context || 'Assessment-based match for this position.'}
      avatar={<span className="mb-header-icon" aria-hidden="true"><ReportIcon size={23} /></span>}
      headerDetails={context && <p className="mb-context">{context}</p>}
      onClose={() => setOpen(false)} closeLabel="Close match breakdown" restoreFocusRef={opener}>
      <div className="mb-body" tabIndex={0} role="region" aria-label="Match breakdown content">
        <div className={`mb-summary${details.all_targets_met ? ' mb-summary--met' : ''}`}>
          <div className="mb-summary-score"><strong>{recommendationDisplay(recommendation)}</strong><span>Match</span></div>
          <div className="mb-summary-status"><span aria-hidden="true">{details.all_targets_met ? <CheckCircleIcon size={20} /> : <WarnIcon size={20} />}</span><div><p>{status}</p><span>{assessmentProgressLabel(recommendation)}</span></div></div>
        </div>
        {rows.length ? <table className="mb-table">
          <caption className="sr-only">Required category assessment scores and minimums</caption>
          <thead><tr><th scope="col">Category</th><th scope="col">Your score</th><th scope="col">Minimum</th></tr></thead>
          <tbody>{rows.map((row, index) => <tr key={row.category_id || `${row.category}:${index}`}>
            <th scope="row"><span>{row.category}</span>{Number.isFinite(row.assessed_percentage) && <span className="mb-category-track" aria-hidden="true"><span style={{ width: `${Math.max(0, Math.min(100, row.assessed_percentage))}%` }} /></span>}</th>
            <td>{Number.isFinite(row.assessed_percentage) ? `${Number(row.assessed_percentage.toFixed(1))}%` : 'Unassessed'}</td><td>{row.target}%</td>
          </tr>)}</tbody>
        </table> : <p className="mb-no-rows">No category breakdown is available for this saved match.</p>}
        <section className="mb-calculation" aria-label="Match calculation">
          <h3>How this match is calculated</h3>
          {isEvidenceMatch(recommendation) ? <>
            <p className="mb-formula">{shortFormula}</p>
            <p>Required categories have equal weight. Minimums are checked separately.</p>
            <p>Unassessed categories earn no match credit; their grades remain unassessed.</p>
          </> : <>
            <p className="mb-formula">{recommendationValue(recommendation) == null ? `${assessmentProgressLabel(recommendation)}. ${progress.percentage == null ? 'No partial percentage is available yet.' : `${recommendationDisplay(recommendation)} averages only those assessed categories.`} A complete Match needs results for every required category.` : `Average of ${rows.length} required ${rows.length === 1 ? 'category' : 'categories'} = ${recommendationDisplay(recommendation)} Match.`}</p>
            <p>Each required category has equal weight. Minimums are checked separately.</p>
          </>}
        </section>
        <section className="mb-tiebreakers" aria-label="Supporting tie-breakers">
          <div className="mb-tiebreaker-heading"><h3>Tie-breakers</h3><p>Used to break ties. Excluded from the Match percentage.</p></div>
          <dl><div><dt><ReportIcon size={17} />NLP text similarity</dt><dd>{componentPercent(recommendation.nlp_score_component)}</dd></div><div><dt><PinIcon size={17} />Location</dt><dd>{componentPercent(recommendation.location_score_component)}</dd></div></dl>
        </section>
        <p className="mb-evidence-note"><span aria-hidden="true"><InfoCircleIcon size={16} /></span>Match reflects assessment evidence, not a hiring probability.</p>
      </div>
    </DialogShell>}
  </>
}
