import { analyticsCardRecommendation } from '../../utils/analyticsCardRecommendation'
import Avatar from '../Avatar'
import CompanyImage from '../CompanyImage'
import StatusBadge from '../StatusBadge'
import { scoreColor } from '../../utils/formatters'
import { analyticsSkillName } from '../../utils/analytics'
import '../studentPerformanceCard.css'
import './analyticsStudentCards.css'

// Analytics records are scoped snapshots, not management student profiles. Render
// their supplied progress and reasons directly; never synthesize an overall score.
export default function AnalyticsStudentCards({ records, skills = [], onStudent, suggested = false }) {
  return <div className="analytics-student-grid">{records.map(({ student: row }) => {
    const stopped = Object.values(row.attempt_states || {}).includes('stopped')
    const progress = row.required_total > 0 ? Math.max(0, Math.min(100, row.required_completed / row.required_total * 100)) : 0
    const recommendation = analyticsCardRecommendation(row, suggested)
    const evidenceLocked = row.competency_locked ?? row.recommendations_locked
    return <article className="sp-card analytics-student-card" key={row.id} data-student-id={row.id}>
      <header className="sp-card-header">
        <div className="sp-card-identity"><Avatar name={row.name} photoUrl={row.photo_url} className="h-10 w-10 rounded-full text-sm" />
          <div><h3><button type="button" aria-label={`View details for ${row.name}`} aria-haspopup="dialog" className="sp-card-open" onClick={event => onStudent(row, event.currentTarget)}>{row.name}</button></h3><p>{row.school_id || 'No school ID'} · {row.course || 'No course'}</p></div>
        </div>
        <div className="sp-card-status"><StatusBadge status={row.required_complete ? 'completed' : stopped ? 'stopped' : 'pending'} /></div>
      </header>
      <dl className="analytics-student-context"><div><dt>Batch</dt><dd>{row.batch || 'Not provided'}</dd></div><div><dt>Instructor</dt><dd>{row.instructor || 'Not provided'}</dd></div></dl>
      <div className="analytics-student-placement"><span>Placement</span><StatusBadge status={row.placement_status} label={row.placement_status === 'approved_other_batch' ? 'Approved in another batch' : undefined} />{row.company && !suggested && <p>{row.company} · {row.position}</p>}</div>
      <div className="analytics-student-progress"><div><span>Required progress</span><strong>{row.required_completed} / {row.required_total} complete</strong></div>
        {row.required_total > 0 ? <div className="sp-card-track" role="progressbar" aria-label={`Required assessment completion for ${row.name}`} aria-valuemin={0} aria-valuemax={row.required_total} aria-valuenow={row.required_completed}><div style={{ width: `${progress}%` }} /></div> : <p>No required assessments</p>}
        <p>Final evidence: {evidenceLocked ? 'Locked / unavailable' : 'Current'}</p>
      </div>
      {skills.length > 0 && <dl className="analytics-student-skills">{skills.map(skill => {
        const score = evidenceLocked ? null : row.scores[skill.id]
        return <div key={skill.id}><dt><span aria-hidden="true" className={`analytics-skill-dot${score == null ? '' : score >= 80 ? ' analytics-skill-dot--strong' : score >= 60 ? ' analytics-skill-dot--fair' : ' analytics-skill-dot--low'}`} />{analyticsSkillName(skill)}</dt><dd className={score == null ? '' : scoreColor(score)}>{score == null ? 'Missing / locked' : `${score}%`}</dd></div>
      })}</dl>}
      {row.reasons.length ? <div className="analytics-student-followup"><strong>Needs follow-up</strong><ul>{row.reasons.map(reason => <li key={reason}>{reason}</li>)}</ul></div>
        : <p className="analytics-student-note">{row.batch_status === 'archived' ? 'Archived record · read-only' : 'No follow-up flagged'}</p>}
      {recommendation.available ? <div className="analytics-student-match"><span className="analytics-partner-logo"><CompanyImage name={recommendation.company} imageUrl={recommendation.imageUrl} className="h-8 w-8 rounded-md" /></span><div className="analytics-match-copy"><span>{recommendation.label}</span><strong>{recommendation.position}</strong><p>{recommendation.company}</p></div><strong>{recommendation.display}</strong></div>
        : <p className="analytics-student-note">{recommendation.label}: {recommendation.state}</p>}
    </article>
  })}</div>
}
