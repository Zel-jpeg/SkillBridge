import DataSection from '../../components/DataSection'
import StudentCycleNotice from '../../components/student/StudentCycleNotice'
import { useNavigate } from 'react-router-dom'
import { useApi } from '../../hooks/useApi'
import { assessmentAction } from './assessmentUiState'
import { assessmentCardPresentation, orderAssessmentCards } from './assessmentCardPresentation'
import { CalendarIcon, CheckCircleIcon, ChevronRightIcon, ClockIcon, ListIcon, LockIcon, RefreshIcon, ReportIcon, WarnIcon } from '../../components/Icons'
import './studentAssessmentCards.css'

function dateLabel(value) {
  if (!value) return ''
  return new Intl.DateTimeFormat('en-PH', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value))
}

const statusIcons = {
  progress: ClockIcon, retake: RefreshIcon, stopped: WarnIcon, flagged: WarnIcon,
  upcoming: CalendarIcon, overdue: ClockIcon, closed: LockIcon, unavailable: LockIcon,
  submitted: ReportIcon, completed: CheckCircleIcon,
}
const requestLabels = { pending: 'Pending', approved: 'Approved', declined: 'Declined' }

function AssessmentCard({ item }) {
  const navigate = useNavigate()
  const action = assessmentAction(item)
  const presentation = assessmentCardPresentation(item)
  const StatusIcon = statusIcons[presentation.key]
  const showRetakeRequest = Boolean(item.is_flagged && item.can_request_retake || item.retake_request?.status)
  const pairedActions = showRetakeRequest && ['stopped', 'flagged'].includes(presentation.key)
  const dateText = item.availability_status === 'upcoming'
    ? `Opens ${dateLabel(item.available_at)}`
    : item.due_at ? `Due ${dateLabel(item.due_at)}` : 'No deadline set'

  return (
    <article className={`sac-card sac-card--${presentation.key}`} data-assessment-state={presentation.key}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${item.is_required ? 'bg-green-100 dark:bg-green-950 text-green-800 dark:text-green-300' : 'bg-blue-100 dark:bg-blue-950 text-blue-800 dark:text-blue-300'}`}>
          {item.is_required ? 'Required' : 'Optional'}
        </span>
        <span className="sac-status"><span aria-hidden="true" className="sac-state-icon">{StatusIcon ? <StatusIcon size={16} /> : <span className="sac-ready-dot" />}</span>{presentation.label}</span>
      </div>
      <div className="sac-title"><span aria-hidden="true" className={`sac-title-icon${presentation.key === 'completed' ? ' sac-completed-mark' : ''}`}>{presentation.key === 'completed' ? <CheckCircleIcon size={23} /> : <ReportIcon size={23} />}</span><h2 className="min-w-0 break-words text-base font-bold leading-snug text-gray-900 dark:text-white">{item.title}</h2></div>
      <div className="sac-facts text-gray-600 dark:text-gray-300">
        <p><span aria-hidden="true"><ClockIcon size={17} /></span>{item.duration_minutes} minutes</p>
        <p><span aria-hidden="true"><ListIcon size={17} /></span>{item.question_count} question{item.question_count === 1 ? '' : 's'}</p>
      </div>
      <div className="sac-details text-xs text-gray-600 dark:text-gray-300">
        <p className="sac-detail"><span aria-hidden="true"><CalendarIcon size={16} /></span>{dateText}</p>
        <p className="sac-detail"><span aria-hidden="true">{item.include_in_competency ? <CheckCircleIcon size={16} /> : <ReportIcon size={16} />}</span>{item.include_in_competency ? 'Included in your final skill profile' : 'Not included in your final skill profile'}</p>
        {!item.is_required && <p>Optional work does not block final results.</p>}
        {item.attempt_status === 'stopped' && (presentation.key !== 'retake' || item.stopped_reason_display) && <p className="sac-notice"><span aria-hidden="true"><WarnIcon size={15} /></span>{item.stopped_reason_display || 'Your recorded attempt is available.'}</p>}
        {item.retake_allowed && <details className="sac-retake-details"><summary>Retake replaces the current score</summary><p>Your next attempt will replace this assessment’s current score. Your earlier attempt remains on record.</p></details>}
        {item.retake_request?.status && !(presentation.key === 'retake' && item.retake_request.status === 'approved') && <p className="sac-request-status">Retake request: {requestLabels[item.retake_request.status] || item.retake_request.status}</p>}
      </div>
      <div className={`sac-actions${pairedActions ? ' sac-actions--pair' : ''}`}>
        <button
          type="button"
          disabled={action.kind === 'disabled'}
          onClick={() => navigate(action.kind === 'result'
            ? `/student/assessments/${item.id}/results`
            : `/student/assessments/${item.id}/take`)}
          className={`sac-primary-action${action.kind === 'result' ? ' sac-primary-action--result' : ''}`}
        >{action.label}{action.kind !== 'disabled' && <span aria-hidden="true"><ChevronRightIcon size={16} /></span>}</button>
        {showRetakeRequest && <button type="button"
          onClick={() => navigate(`/student/assessments/${item.id}/retake-request`)} className="sac-request-action">
          {item.retake_request?.status ? 'View retake request' : 'Request retake'}
        </button>}
      </div>
    </article>
  )
}

export default function StudentAssessments() {
  const navigate = useNavigate()
  const { data, loading, error } = useApi('/api/assessments/')
  const completed = data?.completed_required_count || 0
  const total = data?.total_required_count || 0
  const remaining = data?.remaining_required_count || 0
  const percentage = total ? Math.round(completed / total * 100) : 0
  const assessments = orderAssessmentCards(data?.assessments || [])

  return (
    <div className="min-w-0">

      <section className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-8">
        <StudentCycleNotice historyMode="none" />
        <button onClick={() => navigate('/student/dashboard')} className="mb-5 text-sm font-medium text-green-700 hover:underline dark:text-green-400 focus-visible:outline-2">← Dashboard</button>
        <header className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-gray-900 sm:p-7">
          <p className="text-xs font-semibold uppercase tracking-wide text-green-700 dark:text-green-400">{data?.batch?.name || 'Your batch'}</p>
          <h1 className="mt-1 text-2xl font-bold text-gray-900 dark:text-white">Skills Assessments</h1>
          <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">Complete your required assessments to generate your final skill profile.</p>
<DataSection url="/api/assessments/" layout="progress">          {!loading && !error && <div className="mt-5">
            <div className="flex flex-wrap items-baseline justify-between gap-2 text-sm text-gray-700 dark:text-gray-200">
              <strong>{completed} of {total} required assessments completed</strong>
              <span>{remaining} remaining</span>
            </div>
            <div role="progressbar" aria-label="Required assessment completion" aria-valuemin={0} aria-valuemax={total || 1} aria-valuenow={completed} className="mt-2 h-2.5 overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700">
              <div className="h-full rounded-full bg-green-600" style={{ width: `${percentage}%` }} />
            </div>
            {data?.all_required_completed
              ? <p className="mt-3 text-sm font-medium text-green-700 dark:text-green-300">Required assessments complete. Your final skill profile is ready.</p>
              : total === 0
                ? <p className="mt-3 text-sm text-gray-600 dark:text-gray-300">No required assessments are currently published. Your final profile remains locked.</p>
                : <p className="mt-3 text-sm text-gray-600 dark:text-gray-300">{remaining} required assessment{remaining === 1 ? '' : 's'} to go.</p>}
            {data?.all_required_completed && <button onClick={() => navigate('/student/results')} className="mt-4 rounded-xl bg-green-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-green-700 focus-visible:outline-2 focus-visible:outline-offset-2">View Final Results</button>}
          </div>}</DataSection>
        </header>
<DataSection url="/api/assessments/" layout="assessment-cards" count={6} columns={3} className="mt-6">
        {loading && <p role="status" className="mt-8 text-sm text-gray-600 dark:text-gray-300">Loading your assessments…</p>}
        {error && <div role="alert" className="mt-6 rounded-2xl border border-rose-200 bg-rose-50 p-5 text-sm text-rose-800 dark:border-rose-900 dark:bg-rose-950 dark:text-rose-200">{error === 'not_enrolled' ? 'You are not enrolled in an active batch yet.' : `Assessments could not be loaded. ${error}`}</div>}
        {!loading && !error && (assessments.length
          ? <section aria-label="Assigned assessments" className="sac-card-grid grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
              {assessments.map(item => <AssessmentCard key={item.id} item={item} />)}

      </section>
          : <div className="mt-6 rounded-2xl border border-gray-200 bg-white p-8 text-center text-sm text-gray-600 dark:border-gray-800 dark:bg-gray-900 dark:text-gray-300">No published assessments are assigned to your batch yet. Check back with your instructor.</div>)}
</DataSection>
      </section>
    </div>
  )
}
