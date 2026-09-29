import { useId, useRef, useState } from 'react'
import ConfirmModal from './admin/ConfirmModal'
import PlacementStatusCard from './placements/PlacementStatusCard'
import ScoreLabel from './ScoreLabel'
import { AlertTriangleIcon, BriefcaseIcon, ListIcon, LockIcon, RefreshIcon, ReportIcon, SkillIcon } from './Icons'
import { manilaDateTime } from '../utils/assessmentDates'
import { assessmentRetakeCandidate } from '../utils/assessmentManagement'
import { attemptLabel, isCurrentPlacement, lockExplanation, percentLabel, studentDetailState, suggestionText } from '../utils/studentDetail'
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

function ScoreRows({ scores = [], categoryNames }) {
  if (!scores.length) return <p className="sb-detail-muted mt-3">No category scores recorded for this attempt.</p>
  return <div className="mt-3" role="table" aria-label="Category scores">
    <div className="sb-detail-score-row sb-detail-score-row--heading" role="row"><span role="columnheader">Category</span><span role="columnheader">Raw / max</span><span role="columnheader">Percentage</span></div>
    {scores.map((score, index) => <div key={score.category_id ?? index} className="sb-detail-score-row" role="row">
      <span role="cell">{score.category || categoryNames?.get(score.category_id) || (score.category_id != null ? `Category ${score.category_id}` : 'Category not provided')}</span>
      <span role="cell">{score.raw_score ?? '—'} / {score.max_score ?? '—'}</span>
      <strong role="cell">{percentLabel(score.percentage)}</strong>
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

function Overview({ student, state, instructorName, compact }) {
  return <div>
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div><h3 className="sb-detail-heading">Required assessment progress</h3><p className="sb-detail-muted">Published required assessments included in competency.</p></div>
      {state.total > 0 && <span className="text-lg font-bold tabular-nums text-gray-900 dark:text-white">{state.percentage}%</span>}
    </div>
    {state.total > 0 ? <>
      <div role="progressbar" aria-label="Required assessment completion" aria-valuemin={0} aria-valuemax={100} aria-valuenow={state.percentage} aria-valuetext={`${state.completed} of ${state.total} complete; ${state.remaining} remaining`} className="mt-4 h-2 overflow-hidden rounded-full bg-gray-100 dark:bg-gray-800"><div className="h-full bg-green-700 dark:bg-green-500" style={{ width: `${state.percentage}%` }} /></div>
      <p className="mt-3 text-sm"><strong>{state.completed} of {state.total}</strong> completed <span className="text-gray-500 dark:text-gray-400">· {state.remaining} remaining</span></p>
    </> : <p className="mt-3 text-sm">No required assessments are assigned to this batch.</p>}
    <div className="sb-detail-summary">
      <section><h3 className="sb-detail-heading mb-4">Profile and enrollment</h3><dl className="sb-detail-facts">
        <dt>Recommendations</dt><dd>{state.locked ? 'Locked' : 'Unlocked'}</dd>
        <dt>Combined profile</dt><dd>{state.profile ? 'Finalized' : 'Awaiting completion'}</dd>
        <dt>Finalized</dt><dd>{state.profile?.finalized_at ? manilaDateTime(state.profile.finalized_at) : 'Not finalized'}</dd>
        <dt>Batch</dt><dd>{student.batch?.name || 'No active batch'}</dd>
        <dt>Instructor</dt><dd>{student.instructor || instructorName || 'Instructor not provided'}</dd>
      </dl>{state.locked && <p className="sb-detail-muted mt-4 leading-relaxed">{lockExplanation(state)}</p>}</section>
      <section className="min-w-0"><h3 className="sb-detail-heading mb-4">Current OJT placement</h3><PlacementStatusCard placement={student.placement} audience="instructor" detail={!compact} compact={compact} /></section>
    </div>
    {!compact && state.results.length > 0 && <section className="mt-6 border-t border-gray-200 pt-5 dark:border-gray-700">
      <h3 className="sb-detail-heading">Assessment snapshot</h3><p className="sb-detail-muted">First {Math.min(3, state.results.length)} of {state.results.length} assigned assessments. Full current results are under Assessments.</p>
      <ul className="mt-2">{state.results.slice(0, 3).map(result => <li key={result.id} className="flex items-start justify-between gap-4 border-b border-gray-100 py-3 text-xs dark:border-gray-800"><span className="min-w-0">{result.title}</span><span className="sb-detail-status">{attemptLabel(result.attempt_status)}{result.is_flagged ? ' · Flagged' : ''}</span></li>)}</ul>
    </section>}
  </div>
}

function Assessments({ student, state, canRetake, onRetake, archived }) {
  if (!state.results.length) return <EmptyDetail title="No assessments assigned">Assessments will appear here when they are assigned to this batch.</EmptyDetail>
  return <div><h3 className="sb-detail-heading">Individual assessment results</h3><p className="sb-detail-muted">Inclusion reflects assessment settings. Only eligible submitted, unflagged results contribute to the combined profile. Archived attempts are separate from current results.</p>
    {state.results.map(result => <article key={result.id} className="sb-detail-item">
      <div className="flex flex-wrap items-start justify-between gap-2"><h4 className="min-w-0 flex-1 font-semibold text-gray-900 dark:text-white">{result.title}</h4><span className="sb-detail-status">{attemptLabel(result.attempt_status)}</span></div>
      <div className="mt-2 flex flex-wrap gap-2"><span className="sb-detail-status">{result.is_required ? 'Required' : 'Optional'}</span><span className="sb-detail-status">{result.include_in_competency ? 'Included in competency' : 'Excluded from competency'}</span><span className="sb-detail-status">Current attempt</span>{result.retake_allowed && <span className="sb-detail-status">Retake approved</span>}</div>
      {['submitted', 'stopped'].includes(result.attempt_status) && <p className="sb-detail-muted mt-2"><AttemptDate attempt={result} /></p>}
      <ScoreRows scores={result.category_scores} />
      <IntegrityDetail attempt={result} />
      {assessmentRetakeCandidate(student, result.id) && <div className="mt-3">
        {canRetake ? <button type="button" className="min-h-11 rounded-lg border border-green-700 px-3 py-2 text-left text-xs font-semibold text-green-800 dark:border-green-500 dark:text-green-300" onClick={() => onRetake(result.id)}>{result.retake_allowed ? 'Revoke retake' : 'Approve retake'} for {result.title}</button>
          : <p className="sb-detail-muted">{result.retake_allowed ? 'Retake approved.' : 'Retake not approved.'} {archived ? 'Archived student records are read-only.' : 'Retake management is unavailable in this view.'}</p>}
      </div>}
    </article>)}
  </div>
}

function CombinedCompetency({ state }) {
  if (state.locked) return <EmptyDetail title="Combined competency is locked" locked>{lockExplanation(state)}</EmptyDetail>
  if (!state.profile) return <EmptyDetail title="Final profile unavailable">A finalized combined profile has not been provided for this student.</EmptyDetail>
  const sourceIds = [...new Set(state.combined.flatMap(score => score.source_assessment_ids || []))]
  const included = state.results.filter(result => sourceIds.includes(result.id))
  return <div>
    <h3 className="sb-detail-heading">{state.profile.orientation_label || 'Combined competency profile'}</h3>
    <p className="mt-2 max-w-prose whitespace-pre-line leading-relaxed">{state.profile.orientation_summary || 'Orientation summary not provided.'}</p>
    <section className="mt-6"><h4 className="sb-detail-heading">Combined category scores</h4><ScoreRows scores={state.combined} /></section>
    {included.length > 0 && <p className="sb-detail-muted mt-3">Included assessments: {included.map(result => result.title).join('; ')}</p>}
    {state.profile.development_suggestions?.length > 0 && <section className="mt-6"><h4 className="sb-detail-heading">Development suggestions</h4><ul className="max-w-prose list-disc space-y-2 pl-5">{state.profile.development_suggestions.map((item, i) => <li key={i}>{suggestionText(item)}</li>)}</ul></section>}
    <dl className="sb-detail-facts mt-6 border-t border-gray-200 pt-4 dark:border-gray-700"><dt>NLP model used</dt><dd>{state.profile.model_used || 'Not provided'}</dd><dt>Finalized</dt><dd>{state.profile.finalized_at ? manilaDateTime(state.profile.finalized_at) : 'Date not provided'}</dd></dl>
  </div>
}

const components = [
  ['Hybrid match', 'match_score'], ['Category fit', 'category_score_component'],
  ['NLP fit', 'nlp_score_component'], ['Location fit', 'location_score_component'],
]

function Recommendations({ student, state }) {
  if (state.locked) return <EmptyDetail title="Placement recommendations are locked" locked>{lockExplanation(state)}</EmptyDetail>
  if (!state.recommendations.length) return <EmptyDetail title="No eligible positions available">No eligible company positions are currently available for this finalized profile.</EmptyDetail>
  return <div><h3 className="sb-detail-heading">Ranked placement recommendations</h3><p className="sb-detail-muted">Fit scores support a placement decision. Rank does not grant placement approval.</p>
    <ol>{state.recommendations.map((rec, i) => <li key={rec.id ?? i} className="sb-detail-recommendation">
      <span aria-label={`Rank ${i + 1}`} className="flex h-8 w-8 items-center justify-center rounded-md bg-gray-100 text-sm font-bold text-gray-700 dark:bg-gray-800 dark:text-gray-200">{i + 1}</span>
      <div className="min-w-0"><h4 className="font-semibold text-gray-900 dark:text-white">{rec.company || 'Company not provided'}</h4><p className="text-sm">{rec.position || 'Position not provided'}</p>
        {isCurrentPlacement(rec, student.placement) && <span className="sb-detail-status mt-2">Current approved placement</span>}
        <dl className="sb-detail-components">{components.map(([name, key]) => <div key={key}><dt><ScoreLabel label={name} /></dt><dd><strong>{percentLabel(rec[key])}</strong></dd></div>)}</dl>
        {rec.distance_km != null && <p className="sb-detail-muted mt-3">Distance: {Number(rec.distance_km).toFixed(1)} km</p>}
      </div>
    </li>)}</ol>
  </div>
}

function RetakeHistory({ state }) {
  if (!state.historyCount) return <EmptyDetail title="No archived attempts">Prior attempts are preserved here when the student starts an approved retake.</EmptyDetail>
  const categoryNames = new Map(state.results.flatMap(result => (result.category_scores || []).filter(score => score.category).map(score => [score.category_id, score.category])))
  return <div><h3 className="sb-detail-heading">Archived prior attempts</h3><p className="sb-detail-muted">Historical scores are reference only; they are not the current assessment contribution. Current attempts and approvals appear under Assessments.</p>
    {state.results.map(result => (result.prior_attempts || []).map(history => <article key={`${result.id}-${history.attempt_number}`} className="sb-detail-history">
      <h4 className="font-semibold text-gray-900 dark:text-white">{result.title}</h4>
      <div className="mt-2 flex flex-wrap gap-2"><span className="sb-detail-status">Archived attempt {history.attempt_number}</span><span className="sb-detail-status">{attemptLabel(history.status)}</span></div>
      <p className="sb-detail-muted mt-2"><AttemptDate attempt={history} historical /></p><ScoreRows scores={history.category_scores} categoryNames={categoryNames} /><IntegrityDetail attempt={history} />
    </article>))}
  </div>
}

/** One formatting path for modal and compact inline management views. */
export default function AssessmentStudentDetail({ student, instructorName, onToggleRetake, isArchived = false, variant = 'inline' }) {
  const [tab, setTab] = useState(0)
  const [retakeId, setRetakeId] = useState(null)
  const tabRefs = useRef([])
  const id = useId()
  const state = studentDetailState(student)
  const archived = isArchived || student.archived
  const canRetake = Boolean(onToggleRetake) && !archived
  const retake = canRetake ? assessmentRetakeCandidate(student, retakeId) : null
  function navigate(event, index) {
    const keys = { ArrowRight: (index + 1) % tabs.length, ArrowLeft: (index + tabs.length - 1) % tabs.length, Home: 0, End: tabs.length - 1 }
    if (!(event.key in keys)) return
    event.preventDefault()
    const next = keys[event.key]
    setTab(next)
    tabRefs.current[next].focus()
    tabRefs.current[next].scrollIntoView({ block: 'nearest', inline: 'nearest' })
  }
  return <div className={`sb-student-detail sb-student-detail--${variant}`}>
    <div role="tablist" aria-label="Student details" className="sb-detail-tabs">
      {tabs.map((item, index) => <button key={item.label} ref={node => { tabRefs.current[index] = node }} type="button" id={`${id}-tab-${index}`} role="tab" aria-selected={tab === index} aria-controls={`${id}-panel-${index}`} tabIndex={tab === index ? 0 : -1} onKeyDown={event => navigate(event, index)} onClick={() => setTab(index)} className="sb-detail-tab">
        <span aria-hidden="true"><item.Icon size={16} /></span>{item.label}{item.count && <span className="sb-detail-count">{item.count === 'results' ? state.results.length : state.historyCount}</span>}
      </button>)}
    </div>
    <div className="sb-detail-panels">
      {tabs.map(({ label }, index) => <div key={label} id={`${id}-panel-${index}`} role="tabpanel" aria-labelledby={`${id}-tab-${index}`} hidden={tab !== index} tabIndex={0} className="sb-detail-panel">
        {index === 0 && <Overview student={student} state={state} instructorName={instructorName} compact={variant === 'inline'} />}
        {index === 1 && <Assessments student={student} state={state} archived={archived} canRetake={canRetake} onRetake={setRetakeId} />}
        {index === 2 && <CombinedCompetency state={state} />}
        {index === 3 && <Recommendations student={student} state={state} />}
        {index === 4 && <RetakeHistory state={state} />}
      </div>)}
    </div>
    {retake && <ConfirmModal tone="confirm" title={`${retake.retake_allowed ? 'Revoke' : 'Approve'} retake for ${retake.title}?`}
      message={retake.retake_allowed ? 'Revoking approval prevents a new retake from starting for this assessment. Archived prior attempts are retained.' : "The exact assessment is targeted. When the student starts the approved retake, the prior attempt is archived and current scores are cleared. A new submitted score replaces this assessment's contribution and recalculates the combined profile and recommendations."}
      confirmLabel={retake.retake_allowed ? 'Revoke' : 'Approve retake'} onCancel={() => setRetakeId(null)}
      onConfirm={() => { onToggleRetake(student.id, retake.id); setRetakeId(null) }} />}
  </div>
}
