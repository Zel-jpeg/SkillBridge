import { useNavigate } from 'react-router-dom'
import NavBar from '../../components/NavBar'
import { useApi } from '../../hooks/useApi'
import { assessmentAction } from './assessmentUiState'

function cachedStudent() {
  try { return JSON.parse(localStorage.getItem('sb-user')) || {} } catch { return {} }
}

function dateLabel(value) {
  if (!value) return ''
  return new Intl.DateTimeFormat('en-PH', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value))
}

function statusLabel(item) {
  if (item.retake_allowed && item.availability_status === 'available') return 'Retake approved'
  if (item.attempt_status === 'stopped') return 'Stopped / awaiting retake approval'
  if (item.attempt_status === 'submitted') return 'Submitted'
  if (item.availability_status === 'upcoming') return 'Upcoming'
  if (item.availability_status === 'overdue') return 'Deadline passed'
  if (item.availability_status === 'closed') return 'Closed'
  if (item.attempt_status === 'in_progress') return 'In progress'
  return 'Ready to start'
}

function AssessmentCard({ item }) {
  const navigate = useNavigate()
  const action = assessmentAction(item)
  const dateText = item.availability_status === 'upcoming'
    ? `Opens ${dateLabel(item.available_at)}`
    : item.due_at ? `Due ${dateLabel(item.due_at)}` : 'No deadline set'

  return (
    <article className="min-w-0 h-full flex flex-col rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-5 shadow-sm">
      <div className="flex flex-wrap items-center gap-2 mb-3">
        <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${item.is_required ? 'bg-green-100 dark:bg-green-950 text-green-800 dark:text-green-300' : 'bg-blue-100 dark:bg-blue-950 text-blue-800 dark:text-blue-300'}`}>
          {item.is_required ? 'Required' : 'Optional'}
        </span>
        <span className="text-xs text-gray-600 dark:text-gray-300">{statusLabel(item)}</span>
      </div>
      <h2 className="text-lg font-bold leading-snug break-words text-gray-900 dark:text-white">{item.title}</h2>
      <div className="flex flex-wrap gap-1.5 mt-3" aria-label="Skill categories">
        {item.categories?.length ? item.categories.map(category => (
          <span key={category} className="max-w-full break-words rounded-lg bg-gray-100 dark:bg-gray-800 px-2.5 py-1 text-xs text-gray-700 dark:text-gray-200">{category}</span>
        )) : <span className="text-xs text-gray-500 dark:text-gray-400">General skills</span>}
      </div>
      <div className="mt-4 space-y-1 text-sm text-gray-600 dark:text-gray-300">
        <p>{item.duration_minutes} minutes · {item.question_count} question{item.question_count === 1 ? '' : 's'}</p>
        <p>{dateText}</p>
        {item.include_in_competency ? <p>Included in your final skill profile</p> : <p>Not included in your final skill profile</p>}
        {!item.is_required && <p>Optional work does not block final results.</p>}
        {item.attempt_status === 'stopped' && <p className="text-rose-700 dark:text-rose-300">{item.stopped_reason_display || 'Completed answers were recorded.'}</p>}
        {item.retake_allowed && <p className="text-blue-700 dark:text-blue-300">Your next attempt will replace this assessment’s current score. Your earlier attempt remains on record.</p>}
      </div>
      <div className="mt-auto pt-5">
        <button
          type="button"
          disabled={action.kind === 'disabled'}
          onClick={() => navigate(action.kind === 'result'
            ? `/student/assessments/${item.id}/results`
            : `/student/assessments/${item.id}/take`)}
          className="w-full min-h-11 rounded-xl bg-green-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-green-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-green-600 disabled:cursor-not-allowed disabled:bg-gray-200 disabled:text-gray-600 dark:disabled:bg-gray-800 dark:disabled:text-gray-300"
        >{action.label}</button>
      </div>
    </article>
  )
}

export default function StudentAssessments() {
  const navigate = useNavigate()
  const { data, loading, error } = useApi('/api/assessments/', { fresh: true })
  const student = cachedStudent()
  const navStudent = {
    name: student.name || 'Student',
    initials: (student.name || 'ST').split(' ').map(part => part[0]).slice(0, 2).join(''),
    studentId: student.school_id || '', course: student.course || '', photoUrl: student.photo_url || null,
  }
  const completed = data?.completed_required_count || 0
  const total = data?.total_required_count || 0
  const remaining = data?.remaining_required_count || 0
  const percentage = total ? Math.round(completed / total * 100) : 0
  const assessments = data?.assessments || []

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      <NavBar student={navStudent} />
      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-8">
        <button onClick={() => navigate('/student/dashboard')} className="mb-5 text-sm font-medium text-green-700 hover:underline dark:text-green-400 focus-visible:outline-2">← Dashboard</button>
        <header className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-gray-900 sm:p-7">
          <p className="text-xs font-semibold uppercase tracking-wide text-green-700 dark:text-green-400">{data?.batch?.name || 'Your batch'}</p>
          <h1 className="mt-1 text-2xl font-bold text-gray-900 dark:text-white">Skills Assessments</h1>
          <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">Complete your required assessments to generate your final skill profile.</p>
          {!loading && !error && <div className="mt-5">
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
          </div>}
        </header>
        {loading && <p role="status" className="mt-8 text-sm text-gray-600 dark:text-gray-300">Loading your assessments…</p>}
        {error && <div role="alert" className="mt-6 rounded-2xl border border-rose-200 bg-rose-50 p-5 text-sm text-rose-800 dark:border-rose-900 dark:bg-rose-950 dark:text-rose-200">{error === 'not_enrolled' ? 'You are not enrolled in an active batch yet.' : `Assessments could not be loaded. ${error}`}</div>}
        {!loading && !error && (assessments.length
          ? <section aria-label="Assigned assessments" className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
              {assessments.map(item => <AssessmentCard key={item.id} item={item} />)}
            </section>
          : <div className="mt-6 rounded-2xl border border-gray-200 bg-white p-8 text-center text-sm text-gray-600 dark:border-gray-800 dark:bg-gray-900 dark:text-gray-300">No published assessments are assigned to your batch yet. Check back with your instructor.</div>)}
      </main>
    </div>
  )
}
