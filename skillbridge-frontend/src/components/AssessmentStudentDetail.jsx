import { useState } from 'react'
import ConfirmModal from './admin/ConfirmModal'
import PlacementStatusCard from './placements/PlacementStatusCard'
import { manilaDateTime } from '../utils/assessmentDates'

const tabs = ['Overview', 'Assessments', 'Combined competency', 'Recommendations', 'Retake history']
const label = value => value ? value.replaceAll('_', ' ') : 'Not started'

/** Shared instructor/admin view. All final data comes from the scoped management API. */
export default function AssessmentStudentDetail({ student, onToggleRetake, isArchived = false }) {
  const [tab, setTab] = useState('Overview')
  const [retake, setRetake] = useState(null)
  const results = student.assessmentResults ?? student.assessment_results ?? []
  const locked = student.recommendationsLocked ?? student.recommendations_locked ?? true
  const completed = student.completedRequiredCount ?? student.completed_required_count ?? 0
  const total = student.totalRequiredCount ?? student.total_required_count ?? 0
  const remaining = student.remainingRequiredCount ?? student.remaining_required_count ?? 0
  const combined = student.combinedCategoryScores ?? student.combined_category_scores ?? []
  const profile = student.combinedCompetencyProfile ?? student.combined_competency_profile
  const recs = locked ? [] : student.top_recommendations ?? []
  const placement = student.placement
  const section = 'space-y-3 text-sm text-gray-700 dark:text-gray-300'
  return <div className="min-w-0">
    <div role="tablist" aria-label="Student assessment details" className="flex gap-1 overflow-x-auto border-b border-gray-200 dark:border-gray-700">
      {tabs.map(item => <button key={item} role="tab" aria-selected={tab === item} onClick={() => setTab(item)}
        className={`shrink-0 rounded-t-lg px-3 py-2 text-xs font-semibold focus-visible:outline-2 focus-visible:outline-green-600 ${tab === item ? 'border-b-2 border-green-600 text-green-700 dark:text-green-400' : 'text-gray-500 dark:text-gray-400'}`}>{item}</button>)}
    </div>
    <div role="tabpanel" className="min-w-0 py-4">
      {tab === 'Overview' && <div className={section}>
        {student.batch && <p>Batch: <strong>{student.batch.name}</strong>{student.instructor ? ` · Instructor: ${student.instructor}` : ''}</p>}
        <p><strong>{completed} of {total}</strong> required assessments complete · {remaining} remaining</p>
        <p>Final recommendations: <strong>{locked ? 'Locked' : 'Unlocked'}</strong></p>
        <p>Combined profile: {profile ? `Finalized ${manilaDateTime(profile.finalized_at)}` : 'Awaiting completion'}</p>
        {placement && <PlacementStatusCard placement={placement} audience="instructor" />}
      </div>}
      {tab === 'Assessments' && <div className={section}>
        {results.length === 0 ? <p>No assessments assigned to this batch.</p> : results.map(result => <div key={result.id} className="border-b border-gray-100 pb-3 dark:border-gray-800">
          <div className="flex flex-wrap items-start justify-between gap-2"><strong className="min-w-0 wrap-break-word">{result.title}</strong><span className="text-xs">{result.is_required ? 'Required' : 'Optional'} · {label(result.attempt_status)}</span></div>
          <p className="text-xs text-gray-500 dark:text-gray-400">Submitted {manilaDateTime(result.submitted_at)} · {result.include_in_competency ? 'Included in competency' : 'Result only'}</p>
          {result.category_scores?.length > 0 && <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs">{result.category_scores.map(score => <li key={score.category_id}>{score.category}: {score.raw_score}/{score.max_score} ({Number(score.percentage).toFixed(1)}%)</li>)}</ul>}
          {(result.is_flagged || result.attempt_status === 'stopped') && <p className="mt-1 text-xs text-rose-700 dark:text-rose-300">Integrity: {result.stopped_reason || 'Flagged for review'} · {result.violation_count} violation(s)</p>}
          {!isArchived && ['submitted', 'stopped'].includes(result.attempt_status) && <button className="mt-2 rounded-lg border border-green-600 px-3 py-1.5 text-xs font-semibold text-green-700 dark:text-green-400" onClick={() => setRetake(result)}>{result.retake_allowed ? 'Revoke retake' : 'Approve retake'} for {result.title}</button>}
        </div>)}
      </div>}
      {tab === 'Combined competency' && <div className={section}>
        {locked ? <p>Locked until {remaining} required assessment(s) are submitted.</p> : <>
          <p className="font-semibold">{profile?.orientation_label || 'Combined skill profile'}</p>
          <p>{profile?.orientation_summary}</p>
          <ul>{combined.map(score => <li key={score.category_id}>{score.category}: {score.raw_score}/{score.max_score} ({Number(score.percentage).toFixed(1)}%)</li>)}</ul>
          {profile?.development_suggestions?.length > 0 && <ul className="list-inside list-disc">{profile.development_suggestions.map((item, i) => <li key={i}>{item}</li>)}</ul>}
          <p className="text-xs">Model: {profile?.model_used || profile?.active_model || 'Unavailable'} · Finalized {manilaDateTime(profile?.finalized_at)}</p>
        </>}
      </div>}
      {tab === 'Recommendations' && <div className={section}>
        {locked ? <p>Final placement recommendations are locked until {remaining} required assessment(s) are submitted.</p> : recs.length ? recs.map((rec, i) => <div key={i} className="border-b border-gray-100 pb-2 dark:border-gray-800"><strong>{rec.company} · {rec.position}</strong><p className="text-xs">Match {rec.match_score}% · Category {rec.category_score_component}% · NLP {rec.nlp_score_component}% · Location {rec.location_score_component}%</p></div>) : <p>No eligible company positions are currently available.</p>}
      </div>}
      {tab === 'Retake history' && <div className={section}>
        {results.flatMap(result => (result.prior_attempts || []).map(history => ({ ...history, title: result.title }))).length === 0 ? <p>No archived attempts.</p> : results.flatMap(result => (result.prior_attempts || []).map(history => <div key={`${result.id}-${history.attempt_number}`} className="border-b border-gray-100 pb-2 dark:border-gray-800"><strong>{result.title} · Attempt {history.attempt_number}</strong><p className="text-xs">{label(history.status)} · {manilaDateTime(history.submitted_at || history.stopped_at)} · {history.violation_count} violation(s)</p>{history.category_scores?.map((score, i) => <p key={i} className="text-xs">{score.category}: {score.raw_score}/{score.max_score}</p>)}</div>))}
      </div>}
    </div>
    {retake && <ConfirmModal tone="confirm" title={`${retake.retake_allowed ? 'Revoke' : 'Approve'} retake for ${retake.title}?`}
      message="The exact assessment attempt is targeted. On approval, the previous attempt is preserved in history; a new submitted score replaces this assessment's current contribution and recalculates the combined profile and recommendations."
      confirmLabel={retake.retake_allowed ? 'Revoke' : 'Approve retake'} onCancel={() => setRetake(null)}
      onConfirm={() => { onToggleRetake(student.id, retake.id); setRetake(null) }} />}
  </div>
}
