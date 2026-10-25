import CompetencyInsights from './CompetencyInsights'
import GrantExtraTime from './assessment/GrantExtraTime'
import { assessmentSummary, categoryPercentage, scorePercentage } from '../utils/assessmentSummary'
import { useId, useRef, useState } from 'react'
import ConfirmModal from './admin/ConfirmModal'
import PlacementStatusCard from './placements/PlacementStatusCard'
import CompanyImage from './CompanyImage'
import ScoreLabel from './ScoreLabel'
import { AlertTriangleIcon, BriefcaseIcon, CheckCircleIcon, ChevronRightIcon, ListIcon, LockIcon, RefreshIcon, ReportIcon, SkillIcon } from './Icons'
import { manilaDateTime } from '../utils/assessmentDates'
import { assessmentRetakeCandidate } from '../utils/assessmentManagement'
import { attemptLabel, isCurrentPlacement, lockExplanation, percentLabel, studentDetailState } from '../utils/studentDetail'
import './studentDetail.css'

const tabs = [
  { label: 'Overview', Icon: ReportIcon },
  { label: 'Assessments', Icon: ListIcon, count: 'results' },
  { label: 'Combined competency', Icon: SkillIcon },
  { label: 'Recommendations', Icon: BriefcaseIcon },
  { label: 'Retake history', Icon: RefreshIcon, count: 'history' },
]

function EmptyDetail({ title, children, locked = false }) {
  return <div className="sb-detail-empty"><span aria-hidden="true">{locked ? <LockIcon size={20} /> : <ListIcon size={20} />}</span><div className="min-w-0"><h3 className="sb-detail-heading">{title}</h3><p className="text-sm leading-relaxed">{children}</p></div></div>
}

function PanelTitle({ title, children, badge }) {
  return <div className="sb-detail-panel-title"><div><h3>{title}</h3>{children && <p className="sb-detail-muted">{children}</p>}</div>{badge}</div>
}

function TabLink({ children, onClick, outline = false }) {
  return <button type="button" className={outline ? 'sb-detail-link sb-detail-link--outline' : 'sb-detail-link'} onClick={onClick}>{children}<ChevronRightIcon size={16} /></button>
}

function ScoreBar({ value }) {
  const percentage = scorePercentage(value)
  return percentage != null && <span className="sb-detail-score-track" aria-hidden="true"><span style={{ width: `${percentage}%` }} /></span>
}

function IndividualInsights({ scores }) {
  const result = assessmentSummary(scores, { scope: 'individual' })
  const highest = result.leaders[0]?.percentage
  return <section className="sb-detail-individual-insights" aria-label="Individual assessment interpretation">
    <div className="sb-detail-highlight"><p className="sb-detail-eyebrow">{result.highestLabel}</p>{result.highestNames && <p className="sb-detail-heading">{result.highestNames}</p>}{highest > 0 && <strong className="sb-detail-big-score">{categoryPercentage(highest)}</strong>}<p className="sb-detail-muted">Category results in this individual assessment.</p></div>
    <h4 className="sb-detail-heading mt-5">Suggested development focus</h4>
    {result.suggestions.length ? <ul className="sb-detail-focus-list">{result.suggestions.map((item, index) => <li key={index}><div><strong>{item.category}</strong><strong>{categoryPercentage(item.percentage)}</strong></div><p className="sb-detail-muted">{item.message}</p></li>)}</ul> : <p className="sb-detail-muted">Guidance needs assessed category evidence.</p>}
    <details className="sb-detail-disclosure mt-3"><summary>Assessment summary<ChevronRightIcon size={16} /></summary><div><p>{result.summary}</p><p className="sb-detail-muted mt-3">Guidance reflects category scores. Category tags are examples of topics, not separately assessed skills. Review next steps with the student.</p></div></details>
  </section>
}

function ScoreRows({ scores = [], categoryNames }) {
  if (!scores.length) return <p className="sb-detail-muted mt-3">No category scores recorded for this attempt.</p>
  return <div className="mt-3" role="table" aria-label="Category scores">
    <div className="sb-detail-score-row sb-detail-score-row--heading" role="row"><span role="columnheader">Category</span><span role="columnheader">Raw / max</span><span role="columnheader">Percentage</span></div>
    {scores.map((score, index) => <div key={score.category_id ?? index} className="sb-detail-score-row" role="row">
      <span role="cell">{score.category || categoryNames?.get(score.category_id) || (score.category_id != null ? `Category ${score.category_id}` : 'Category not provided')}<ScoreBar value={score.max_score != null && Number(score.max_score) <= 0 ? null : score.percentage} /></span>
      <span role="cell">{score.raw_score ?? '—'} / {score.max_score ?? '—'}</span>
      <strong role="cell">{categoryPercentage(score.percentage)}</strong>
    </div>)}
  </div>
}

function IntegrityDetail({ attempt }) {
  const incident = attempt.is_flagged || (attempt.attempt_status ?? attempt.status) === 'stopped'
  return incident ? <div className="mt-3 flex items-start gap-2 text-xs text-rose-800 dark:text-rose-300">
    <span aria-hidden="true" className="mt-0.5 shrink-0"><AlertTriangleIcon size={16} /></span>
    <p><strong>Integrity review</strong> · {attempt.stopped_reason ? attemptLabel(attempt.stopped_reason) : 'Flagged for review'} · {attempt.violation_count ?? 0} violation(s)</p>
  </div> : <p className="sb-detail-muted mt-2">No integrity flag recorded · {attempt.violation_count ?? 0} violation(s)</p>
}

function AttemptDate({ attempt, historical = false }) {
  const stopped = (attempt.attempt_status ?? attempt.status) === 'stopped'
  // Archived attempts expose stopped_at; current management attempts expose submitted_at.
  const date = stopped && historical ? attempt.stopped_at || attempt.submitted_at : attempt.submitted_at
  return <span>{stopped ? historical && attempt.stopped_at ? 'Stopped' : 'Finalized' : 'Submitted'} {date ? manilaDateTime(date) : 'date not provided'}</span>
}

function Overview({ student, state, instructorName, compact, onTab }) {
  return <div>
    {!compact && <PanelTitle title="Student overview">Assessment progress and placement at a glance.</PanelTitle>}
    <section className={`sb-detail-progress ${state.total > 0 && state.remaining === 0 ? 'sb-detail-progress--complete' : ''}`}>
    <div className="flex items-start gap-3">
      <span className="sb-detail-progress-icon" aria-hidden="true">{state.total > 0 && state.remaining === 0 ? <CheckCircleIcon size={24} /> : <ListIcon size={24} />}</span>
      <div className="min-w-0 flex-1"><h3 className="sb-detail-heading">{state.completionLabel}</h3><p className="sb-detail-muted">{state.total > 0 ? `${state.completed} of ${state.total} completed · ${state.remaining} remaining` : 'Published required assessments included in competency.'}</p></div>
      {state.total > 0 && <strong className="sb-detail-completion-value">{state.percentage}%</strong>}
    </div>
    {state.total > 0 ? <>
      <div role="progressbar" aria-label="Required assessment completion" aria-valuemin={0} aria-valuemax={100} aria-valuenow={state.percentage} aria-valuetext={`${state.completed} of ${state.total} complete; ${state.remaining} remaining`} className="mt-4 h-2 overflow-hidden rounded-full bg-gray-100 dark:bg-gray-800"><div className="h-full bg-green-700 dark:bg-green-500" style={{ width: `${state.percentage}%` }} /></div>
    </> : <p className="mt-3 text-sm">No required assessments are assigned to this batch.</p>}
    </section>
    <div className="sb-detail-summary">
      <section className="sb-detail-surface"><div className="sb-detail-section-title"><h3 className="sb-detail-heading">Profile &amp; enrollment</h3>{state.profile && <span className="sb-detail-status sb-detail-status--success">Finalized</span>}</div><dl className="sb-detail-facts">
        <dt>Recommendations</dt><dd>{state.locked ? 'Locked' : 'Unlocked'}</dd>
        <dt>Combined profile</dt><dd>{state.profile ? 'Finalized' : 'Awaiting completion'}</dd>
        <dt>Finalized</dt><dd>{state.profile?.finalized_at ? manilaDateTime(state.profile?.finalized_at) : 'Not finalized'}</dd>
        <dt>Batch</dt><dd>{student.batch?.name || student.batchLabel || 'No active batch'}</dd>
        <dt>Instructor</dt><dd>{student.instructor || instructorName || 'Instructor not provided'}</dd>
      </dl>{state.locked && <p className="sb-detail-muted mt-4 leading-relaxed">{lockExplanation(state)}</p>}</section>
      <section className="sb-detail-surface sb-detail-placement"><h3 className="sb-detail-heading mb-4">OJT placement</h3>{student.placementKnown === false ? <p className="sb-detail-muted">Placement status is not included in this dashboard. View Placements for the current decision.</p> : student.placement?.status === 'approved' || compact ? <PlacementStatusCard placement={student.placement} audience="instructor" detail={!compact} compact={compact} /> : <div className="sb-detail-unplaced"><span className="sb-detail-status sb-detail-status--amber">Unplaced</span><span className="sb-detail-placement-icon" aria-hidden="true"><BriefcaseIcon size={28} /></span><h4 className="sb-detail-heading">No approved placement yet</h4><p className="sb-detail-muted">Placement approval is separate from recommendation ranking.</p>{!state.locked && <TabLink onClick={() => onTab(3)}>View recommendations</TabLink>}</div>}</section>
    </div>
    {!compact && state.results.length > 0 && <section className="sb-detail-surface mt-4">
      <div className="sb-detail-section-title"><div><h3 className="sb-detail-heading">Assessment snapshot</h3><p className="sb-detail-muted">First {Math.min(3, state.results.length)} of {state.results.length} assigned assessments.</p></div><TabLink onClick={() => onTab(1)}>View assessments</TabLink></div>
      <ul>{state.results.slice(0, 3).map(result => <li key={result.id} className="sb-detail-snapshot"><span className="sb-detail-tile" aria-hidden="true"><ReportIcon size={22} /></span><div className="min-w-0 flex-1"><strong>{result.title}</strong>{['submitted', 'stopped'].includes(result.attempt_status) && <p className="sb-detail-muted"><AttemptDate attempt={result} /></p>}</div><span className="sb-detail-status">{attemptLabel(result.attempt_status)}{result.is_flagged ? ' · Flagged' : ''}</span></li>)}</ul>
    </section>}
  </div>
}

function Assessments({ student, state, canRetake, onRetake, archived, retakeAssessmentId }) {
  if (!state.results.length) return <EmptyDetail title="No assessments assigned">Assessments will appear here when they are assigned to this batch.</EmptyDetail>
  return <div><PanelTitle title="Assessment results">Current assessment attempts. Archived attempts are in Retake history.</PanelTitle>
    {state.results.map(result => <article key={result.id} className="sb-detail-item">
      <div className="flex flex-wrap items-start justify-between gap-2"><h4 className="sb-detail-heading min-w-0 flex-1">{result.title}</h4><span className={`sb-detail-status ${result.attempt_status === 'submitted' && !result.is_flagged ? 'sb-detail-status--success' : ''}`}>{attemptLabel(result.attempt_status)}</span></div>
      <div className="mt-2 flex flex-wrap gap-2"><span className="sb-detail-status">{result.is_required ? 'Required' : 'Optional'}</span><span className="sb-detail-status">{result.include_in_competency ? 'Included in competency' : 'Excluded from competency'}</span><span className="sb-detail-status">Current attempt</span>{result.retake_allowed && <span className="sb-detail-status">Retake approved</span>}</div>
      {['submitted', 'stopped'].includes(result.attempt_status) && <p className="sb-detail-muted mt-2"><AttemptDate attempt={result} /></p>}
      <div className="sb-detail-assessment-grid"><section className="sb-detail-surface"><h4 className="sb-detail-heading">Category scores</h4><p className="sb-detail-muted">Scores from this assessment only. Combined competency pools eligible results across the batch.</p><ScoreRows scores={result.category_scores} /></section>
      {result.attempt_status === 'submitted' && !result.is_flagged && <IndividualInsights scores={result.category_scores} />}</div>
      <div className="sb-detail-integrity"><IntegrityDetail attempt={result} /></div>
      {canRetake && ['admin', 'instructor'].includes(localStorage.getItem('sb-role')) && !result.is_archived && result.publication_status === 'published' && result.attempt_status === 'in_progress' && result.attempt_timing?.remaining_seconds > 0 && (retakeAssessmentId == null || retakeAssessmentId === result.id) && <GrantExtraTime studentId={student.id} assessment={result} />}
      {assessmentRetakeCandidate(student, result.id) && <div className="mt-3">
        {canRetake && (retakeAssessmentId == null || retakeAssessmentId === result.id) ? <button type="button" className="sb-detail-action min-h-11 rounded-lg border border-green-700 px-3 py-2 text-left text-xs font-semibold text-green-800 dark:border-green-500 dark:text-green-300" onClick={() => onRetake(result.id)}>{result.retake_allowed ? 'Revoke retake' : 'Approve retake'} for {result.title}</button>
          : <p className="sb-detail-muted">{result.retake_allowed ? 'Retake approved.' : 'Retake not approved.'} {archived ? 'Archived student records are read-only.' : 'Retake management is unavailable in this view.'}</p>}
      </div>}
      <p className="sb-detail-muted mt-3">Only eligible submitted, unflagged results contribute to the combined profile. Inclusion reflects assessment settings.</p>
    </article>)}
  </div>
}

function CombinedCompetency({ state }) {
  if (state.locked) return <EmptyDetail title="Combined competency is locked" locked>{lockExplanation(state)}</EmptyDetail>
  const sourceIds = [...new Set(state.combined.flatMap(score => score.source_assessment_ids || []))]
  const included = state.results.filter(result => sourceIds.includes(result.id))
  return <div>
    <PanelTitle title="Combined competency" badge={state.profile && <span className="sb-detail-status sb-detail-status--success">Finalized</span>}>Combined results from eligible assessment evidence.</PanelTitle>
    <CompetencyInsights scores={state.combined} />
    <div className="sb-detail-combined-grid"><section className="sb-detail-surface"><h4 className="sb-detail-heading">Combined category scores</h4><p className="sb-detail-muted">For each category: total earned points ÷ total maximum points across eligible assessments in this batch. These scores inform placement recommendations.</p><ScoreRows scores={state.combined} /></section>
    <aside className="sb-detail-surface"><h4 className="sb-detail-heading">Evidence included</h4>{included.length ? <ul className="sb-detail-evidence">{included.map(result => <li key={result.id}><ReportIcon size={20} /><span>{result.title}</span><span className="sb-detail-status sb-detail-status--success">Included</span></li>)}</ul> : <p className="sb-detail-muted">Source assessment details were not provided.</p>}
    <div className="sb-detail-evidence-note"><h4 className="sb-detail-heading">Profile finalized</h4><p className="sb-detail-muted">{state.profile?.finalized_at ? manilaDateTime(state.profile.finalized_at) : 'Date not provided'}</p></div><p className="sb-detail-muted sb-detail-evidence-note">Category totals combine earned and maximum points from eligible evidence.</p></aside></div>
    <p className="sb-detail-muted mt-4">Individual and combined scores can match when only one assessment contributes to a category. Stopped, flagged and excluded attempts do not contribute.</p>
    <details className="sb-detail-disclosure mt-4"><summary>Technical details<ChevronRightIcon size={16} /></summary><dl className="sb-detail-facts"><dt>NLP model used</dt><dd>{state.profile?.model_used || 'Not provided'}</dd></dl></details>
  </div>
}

const components = [
  ['Hybrid match', 'match_score'], ['Category fit', 'category_score_component'],
  ['NLP fit', 'nlp_score_component'], ['Location fit', 'location_score_component'],
]

function Recommendations({ student, state }) {
  if (state.locked) return <EmptyDetail title="Placement recommendations are locked" locked>{lockExplanation(state)}</EmptyDetail>
  if (!state.recommendations.length) return <EmptyDetail title="No eligible positions available">No eligible company positions are currently available for this finalized profile.</EmptyDetail>
  return <div><PanelTitle title="Ranked placement recommendations">Fit scores support a placement decision. Rank does not grant placement approval.</PanelTitle>
    <ol>{state.recommendations.map((rec, i) => <li key={rec.id ?? i} className="sb-detail-recommendation">
      <span aria-label={`Rank ${i + 1}`} className="flex h-8 w-8 items-center justify-center rounded-md bg-gray-100 text-sm font-bold text-gray-700 dark:bg-gray-800 dark:text-gray-200">{i + 1}</span>
      <div className="min-w-0"><div className="sb-detail-recommendation-main"><div className="sb-detail-company"><CompanyImage name={rec.company} imageUrl={rec.company_image_url} className="h-11 w-11 rounded-lg" /><div className="min-w-0"><h4 className="sb-detail-heading">{rec.company || 'Company not provided'}</h4><p>{rec.position || 'Position not provided'}</p></div></div><div className="sb-detail-hybrid"><div><ScoreLabel label="Hybrid match" /><strong>{percentLabel(rec.match_score)}</strong></div><ScoreBar value={rec.match_score} /></div></div>
        {isCurrentPlacement(rec, student.placement) && <span className="sb-detail-status mt-2">Current approved placement</span>}
        <dl className="sb-detail-components">{components.slice(1).map(([name, key]) => <div key={key}><dt><ScoreLabel label={name} /></dt><dd><strong>{percentLabel(rec[key])}</strong></dd></div>)}</dl>
        {rec.distance_km != null && <p className="sb-detail-muted mt-3">Distance: {Number(rec.distance_km).toFixed(1)} km</p>}
      </div>
    </li>)}</ol><details className="sb-detail-disclosure mt-4"><summary>How scores work<ChevronRightIcon size={16} /></summary><div><p>Hybrid match combines 60% category fit, 25% NLP fit and 15% location fit.</p><p className="sb-detail-muted mt-2">Match scores measure fit, not the probability of placement.</p></div></details>
  </div>
}

function RetakeHistory({ state, onTab }) {
  if (!state.historyCount) return <div><PanelTitle title="Retake history" badge={<span className="sb-detail-status">0 archived attempts</span>}>Archived attempts are kept here for reference.</PanelTitle><section className="sb-detail-history-empty sb-detail-surface"><span className="sb-detail-history-icon" aria-hidden="true"><RefreshIcon size={36} /></span><h3 className="sb-detail-heading">No archived attempts</h3><p className="sb-detail-muted">Prior attempts appear here when the student starts an approved retake.<br />Current assessment results remain in Assessments.</p><TabLink outline onClick={() => onTab(1)}>View assessments</TabLink></section><div className="sb-detail-history-help sb-detail-surface mt-5"><section><h4 className="sb-detail-heading">When history appears</h4><p className="sb-detail-muted">The previous attempt is archived when an approved retake starts.</p></section><section><h4 className="sb-detail-heading">Historical results</h4><p className="sb-detail-muted">Archived scores are reference only and are separate from current results.</p></section></div></div>
  const categoryNames = new Map(state.results.flatMap(result => (result.category_scores || []).filter(score => score.category).map(score => [score.category_id, score.category])))
  return <div><PanelTitle title="Archived prior attempts" badge={<span className="sb-detail-status">{state.historyCount} archived attempts</span>}>Historical scores are reference only; they are not the current assessment contribution. Current attempts and approvals appear under Assessments.</PanelTitle>
    {state.results.map(result => (result.prior_attempts || []).map(history => <article key={`${result.id}-${history.attempt_number}`} className="sb-detail-history">
      <h4 className="font-semibold text-gray-900 dark:text-white">{result.title}</h4>
      <div className="mt-2 flex flex-wrap gap-2"><span className="sb-detail-status">Archived attempt {history.attempt_number}</span><span className="sb-detail-status">{attemptLabel(history.status)}</span></div>
      <p className="sb-detail-muted mt-2"><AttemptDate attempt={history} historical /></p><ScoreRows scores={history.category_scores} categoryNames={categoryNames} /><IntegrityDetail attempt={history} />
    </article>))}
  </div>
}

/** One formatting path for modal and compact inline management views. */
export default function AssessmentStudentDetail({ student, instructorName, onToggleRetake, isArchived = false, variant = 'inline', retakeAssessmentId }) {
  const [tab, setTab] = useState(0)
  const [retakeId, setRetakeId] = useState(null)
  const tabRefs = useRef([])
  const panelsRef = useRef(null)
  const id = useId()
  const state = studentDetailState(student)
  const archived = isArchived || student.archived
  const canRetake = Boolean(onToggleRetake) && !archived
  const retake = canRetake ? assessmentRetakeCandidate(student, retakeId) : null
  function selectTab(index) {
    setTab(index)
    panelsRef.current?.scrollTo({ top: 0 })
    tabRefs.current[index]?.focus({ preventScroll: true })
    tabRefs.current[index]?.scrollIntoView({ block: 'nearest', inline: 'nearest' })
  }
  function navigate(event, index) {
    const keys = { ArrowRight: (index + 1) % tabs.length, ArrowLeft: (index + tabs.length - 1) % tabs.length, Home: 0, End: tabs.length - 1 }
    if (!(event.key in keys)) return
    event.preventDefault()
    const next = keys[event.key]
    selectTab(next)
  }
  return <div className={`sb-student-detail sb-student-detail--${variant}`}>
    <div role="tablist" aria-label="Student details" className="sb-detail-tabs">
      {tabs.map((item, index) => <button key={item.label} ref={node => { tabRefs.current[index] = node }} type="button" id={`${id}-tab-${index}`} role="tab" aria-selected={tab === index} aria-controls={`${id}-panel-${index}`} tabIndex={tab === index ? 0 : -1} onKeyDown={event => navigate(event, index)} onClick={() => selectTab(index)} className="sb-detail-tab">
        <span aria-hidden="true"><item.Icon size={16} /></span>{item.label}{item.count && <span className="sb-detail-count">{item.count === 'results' ? state.results.length : state.historyCount}</span>}
      </button>)}
    </div>
    <div ref={panelsRef} className="sb-detail-panels">
      {tabs.map(({ label }, index) => <div key={label} id={`${id}-panel-${index}`} role="tabpanel" aria-labelledby={`${id}-tab-${index}`} hidden={tab !== index} tabIndex={0} className="sb-detail-panel">
        {index === 0 && <Overview student={student} state={state} instructorName={instructorName} compact={variant === 'inline'} onTab={selectTab} />}
        {index === 1 && <Assessments student={student} state={state} archived={archived} canRetake={canRetake} onRetake={setRetakeId} retakeAssessmentId={retakeAssessmentId} />}
        {index === 2 && <CombinedCompetency state={state} />}
        {index === 3 && <Recommendations student={student} state={state} />}
        {index === 4 && <RetakeHistory state={state} onTab={selectTab} />}
      </div>)}
    </div>
    {retake && <ConfirmModal tone="confirm" title={`${retake.retake_allowed ? 'Revoke' : 'Approve'} retake for ${retake.title}?`}
      message={retake.retake_allowed ? 'Revoking approval prevents a new retake from starting for this assessment. Archived prior attempts are retained.' : "The exact assessment is targeted. When the student starts the approved retake, the prior attempt is archived and current scores are cleared. A new submitted score replaces this assessment's contribution and recalculates the combined profile and recommendations."}
      confirmLabel={retake.retake_allowed ? 'Revoke' : 'Approve retake'} onCancel={() => setRetakeId(null)}
      onConfirm={() => { onToggleRetake(student.id, retake.id); setRetakeId(null) }} />}
  </div>
}
