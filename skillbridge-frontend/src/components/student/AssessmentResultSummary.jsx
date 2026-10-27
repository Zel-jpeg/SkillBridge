import { useNavigate } from 'react-router-dom'
import { CalendarIcon, CheckCircleIcon, ChevronRightIcon, ReportIcon, SkillIcon, WarnIcon, XIcon } from '../Icons'

export default function AssessmentResultSummary({ data, review, reviewPending, reviewError }) {
  const navigate = useNavigate()
  const scores = data.skill_scores || []
  const raw = scores.reduce((sum, row) => sum + row.raw_score, 0)
  const maximum = scores.reduce((sum, row) => sum + row.max_score, 0)
  const percentage = maximum ? Math.round(raw / maximum * 100) : null
  const answerValues = Object.values(review?.answers || {})
  const correct = answerValues.filter(answer => answer.submitted_answer_correct).length
  const incorrect = answerValues.length - correct
  const unanswered = Math.max(0, (review?.questions?.length || 0) - answerValues.length)
  const stopped = data.assessment.attempt_status === 'stopped'
  const completed = data.completed_required_count ?? 0
  const total = data.total_required_count ?? 0
  const remaining = data.remaining_required_count ?? Math.max(0, total - completed)
  const requiredComplete = data.all_required_completed ?? (total > 0 && completed >= total && remaining === 0)
  const recorded = new Date(data.assessment.submitted_at)
  const recordedLabel = data.assessment.submitted_at && Number.isFinite(recorded.getTime())
    ? `Recorded ${new Intl.DateTimeFormat('en-PH', { dateStyle: 'medium', timeStyle: 'short' }).format(recorded)}` : 'Attempt recorded'
  const tone = percentage == null ? 'neutral' : percentage >= 80 ? 'strong' : percentage >= 60 ? 'fair' : 'low'

  return <section className="sa-card sa-result-summary" aria-label="Assessment result summary">
    <header className="sa-summary-heading">
      <div className="sa-heading-copy">
        <p className="sa-eyebrow">Assessment result</p>
        <h1>{data.assessment.title}</h1>
        <p className="sa-recorded"><span aria-hidden="true"><CalendarIcon size={15} /></span>{recordedLabel}</p>
      </div>
      <span className={`sa-status ${stopped ? 'is-stopped' : ''}`}><span aria-hidden="true">{stopped ? <WarnIcon /> : <CheckCircleIcon />}</span>{stopped ? 'Stopped' : 'Submitted'}</span>
    </header>
    <div className="sa-score-layout">
      <div className={`sa-overall sa-score-${tone}`}>
        <svg className="sa-score-ring" viewBox="0 0 72 72" aria-hidden="true">
          <circle className="sa-ring-track" cx="36" cy="36" r="28" />
          {percentage != null && <circle className="sa-ring-value" cx="36" cy="36" r="28" strokeDasharray={2 * Math.PI * 28} strokeDashoffset={2 * Math.PI * 28 * (1 - percentage / 100)} transform="rotate(-90 36 36)" />}
        </svg>
        <div><strong>{percentage == null ? '—' : `${percentage}%`}</strong><p>Overall score</p></div>
      </div>
      <dl className="sa-answer-totals">
        {[{ value: `${raw}/${maximum}`, label: 'Raw score', icon: <ReportIcon size={20} /> },
          { value: reviewPending || reviewError ? '—' : correct, label: 'Correct', icon: <CheckCircleIcon size={20} />, tone: 'correct' },
          { value: reviewPending || reviewError ? '—' : incorrect, label: 'Incorrect', icon: <XIcon size={20} />, tone: 'incorrect' },
        ].map(metric => <div key={metric.label} className={`sa-answer-total ${metric.tone || ''}`}>
          <span className="sa-metric-icon" aria-hidden="true">{metric.icon}</span>
          <div><dd>{metric.value}</dd><dt>{metric.label}</dt></div>
        </div>)}
      </dl>
    </div>
    {!reviewPending && !reviewError && unanswered > 0 && <p className="sa-muted sa-unanswered">{unanswered} unanswered question{unanswered === 1 ? '' : 's'}</p>}
    <div className={`sa-completion ${requiredComplete ? 'is-complete' : ''}`}>
      <span aria-hidden="true">{requiredComplete ? <CheckCircleIcon size={23} /> : <ReportIcon size={23} />}</span>
      <div><p className="sa-completion-title">{requiredComplete ? 'Required assessments complete' : total ? 'Required assessment progress' : 'No required assessments published'}</p>
        <p>{completed} of {total} completed · {remaining} remaining</p></div>
    </div>
    <p className="sa-inclusion"><span aria-hidden="true"><SkillIcon size={17} /></span>{stopped ? 'This stopped attempt does not contribute to your final skill profile.' : data.assessment.include_in_competency ? 'Included in your final skill profile.' : 'This assessment is not included in your final skill profile.'}</p>
    {stopped && <div className="sa-stopped-note"><strong>Attempt stopped.</strong> Your completed answers were recorded. {data.assessment.stopped_reason_display || 'An assessment integrity rule was triggered.'} Ask your instructor or administrator to approve a retake.</div>}
    <footer className={`sa-summary-actions ${data.recommendations_locked === false ? 'has-final-results' : ''}`}>
      <button type="button" className="sa-button sa-button-secondary" onClick={() => navigate('/student/assessments')}>All Assessments</button>
      {data.recommendations_locked === false && <button type="button" className="sa-button sa-button-primary" onClick={() => navigate('/student/results')}>View Final Results<span aria-hidden="true"><ChevronRightIcon size={17} /></span></button>}
    </footer>
  </section>
}
