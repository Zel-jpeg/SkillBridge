import { useNavigate, useParams } from 'react-router-dom'
import { useApi } from '../../hooks/useApi'

function AnswerReview({ questions, answers }) {
  if (!questions?.length) return null
  return <section className="mt-6 rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-gray-900 sm:p-6" aria-labelledby="answer-review-title">
    <h2 id="answer-review-title" className="text-lg font-bold text-gray-900 dark:text-white">Submitted answers</h2>
    <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">Only your selected answer and its result are marked. The answer key is not shown.</p>
    <ol className="mt-5 space-y-5">
      {questions.map((question, index) => {
        const answer = answers?.[String(question.id)] || answers?.[question.id]
        const selectedId = answer?.selected_choice_id
        const typed = answer?.text_answer?.trim()
        const answered = question.question_type === 'identification' ? Boolean(typed) : selectedId != null
        const result = !answered ? 'Unanswered' : answer?.submitted_answer_correct ? 'Correct' : 'Incorrect'
        return <li key={question.id} className="min-w-0 border-t border-gray-100 pt-4 dark:border-gray-800">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <h3 className="min-w-0 text-sm font-semibold leading-relaxed text-gray-900 dark:text-white">{index + 1}. {question.question_text}</h3>
            <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ${result === 'Correct' ? 'bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300' : result === 'Incorrect' ? 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300' : 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300'}`}>{result}</span>
          </div>
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">{question.category || 'General'}</p>
          {question.question_type === 'identification'
            ? <p className="mt-3 rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm text-gray-800 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200">Your answer: {typed || 'No answer submitted'}</p>
            : <ul className="mt-3 space-y-2">
                {(question.choices || []).map(choice => {
                  const selected = choice.id === selectedId
                  return <li key={choice.id} className={`rounded-xl border px-3 py-2.5 text-sm ${selected ? answer?.submitted_answer_correct ? 'border-green-400 bg-green-50 text-green-900 dark:border-green-700 dark:bg-green-950 dark:text-green-200' : 'border-rose-400 bg-rose-50 text-rose-900 dark:border-rose-700 dark:bg-rose-950 dark:text-rose-200' : 'border-gray-200 bg-gray-50 text-gray-700 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300'}`}>
                    {choice.text}{selected ? ` · Your answer (${result.toLowerCase()})` : ''}
                  </li>
                })}
              </ul>}
        </li>
      })}
    </ol>
  </section>
}

export default function StudentAssessmentResult() {
  const navigate = useNavigate()
  const { assessmentId } = useParams()
  const validId = /^\d+$/.test(assessmentId || '')
  const resultUrl = validId ? `/api/student/results/?assessment_id=${assessmentId}` : null
  const reviewUrl = validId ? `/api/student/results/review/?assessment_id=${assessmentId}` : null
  const { data, loading, error } = useApi(resultUrl)
  const { data: review, loading: reviewLoading, error: reviewError } = useApi(reviewUrl, { skip: !data?.assessment })
  const reviewPending = reviewLoading || (!review && !reviewError)
  const scores = data?.skill_scores || []
  const raw = scores.reduce((sum, row) => sum + row.raw_score, 0)
  const maximum = scores.reduce((sum, row) => sum + row.max_score, 0)
  const percentage = maximum ? Math.round(raw / maximum * 100) : 0
  const answerValues = Object.values(review?.answers || {})
  const correct = answerValues.filter(answer => answer.submitted_answer_correct).length
  const incorrect = answerValues.length - correct
  const unanswered = Math.max(0, (review?.questions?.length || 0) - answerValues.length)
  const stopped = data?.assessment?.attempt_status === 'stopped'

  return <div className="min-w-0">

    <section className="mx-auto max-w-4xl px-4 py-6 sm:px-6 sm:py-8">
      <button onClick={() => navigate('/student/assessments')} className="mb-5 text-sm font-medium text-green-700 hover:underline dark:text-green-400 focus-visible:outline-2">← Skills Assessments</button>
      <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-gray-900 sm:p-7">
        <p className="text-xs font-semibold uppercase tracking-wide text-green-700 dark:text-green-400">Assessment Result</p>
        {(!validId || error) && <div role="alert" className="mt-4 text-sm text-rose-700 dark:text-rose-300">{!validId ? 'Invalid assessment link.' : error === 'Finalized attempt not found' ? 'There is no completed attempt to show yet.' : 'This assessment result is unavailable for your batch.'}</div>}
        {loading && <p role="status" className="mt-4 text-sm text-gray-600 dark:text-gray-300">Loading your result…</p>}
        {data?.assessment && !loading && !error && <>
          <h1 className="mt-1 break-words text-2xl font-bold text-gray-900 dark:text-white">{data.assessment.title}</h1>
          <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">{data.assessment.submitted_at ? `Recorded ${new Intl.DateTimeFormat('en-PH', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(data.assessment.submitted_at))}` : 'Attempt recorded'}</p>
          <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[[`${raw}/${maximum}`, 'Raw score'], [`${percentage}%`, 'Percentage'], [reviewPending || reviewError ? '—' : correct, 'Correct'], [reviewPending || reviewError ? '—' : incorrect, 'Incorrect']].map(([value, label]) => <div key={label} className="rounded-xl bg-gray-50 p-3 dark:bg-gray-800"><p className="text-xl font-bold text-gray-900 dark:text-white">{value}</p><p className="text-xs text-gray-600 dark:text-gray-300">{label}</p></div>)}
          </div>
          {!reviewPending && !reviewError && unanswered > 0 && <p className="mt-3 text-sm text-gray-600 dark:text-gray-300">{unanswered} unanswered question{unanswered === 1 ? '' : 's'}</p>}
          <p className="mt-4 text-sm text-gray-700 dark:text-gray-200">{data.completed_required_count} of {data.total_required_count} required assessments completed · {data.remaining_required_count} remaining</p>
          <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">{stopped ? 'This stopped attempt does not contribute to your final skill profile.' : data.assessment.include_in_competency ? 'This assessment contributes to your final skill profile.' : 'This assessment is not included in your final skill profile.'}</p>
          {stopped && <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-900 dark:border-rose-900 dark:bg-rose-950 dark:text-rose-200">
            <strong>Attempt stopped.</strong> Your completed answers were recorded. {data.assessment.stopped_reason_display || 'An assessment integrity rule was triggered.'} Ask your instructor or administrator to approve a retake.
          </div>}
          <div className="mt-5 flex flex-wrap gap-3">
            <button onClick={() => navigate('/student/assessments')} className="rounded-xl border border-gray-300 px-4 py-2.5 text-sm font-semibold text-gray-800 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800">All Assessments</button>
            {!data.recommendations_locked && <button onClick={() => navigate('/student/results')} className="rounded-xl bg-green-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-green-700">View Final Results</button>}
          </div>
        </>}
      </div>
      {data?.assessment && !loading && !error && <section className="mt-6 rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-gray-900 sm:p-6" aria-labelledby="category-scores-title">
        <h2 id="category-scores-title" className="text-lg font-bold text-gray-900 dark:text-white">Category scores</h2>
        {scores.length ? <div className="mt-4 space-y-4">{scores.map(row => <div key={row.category}>
          <div className="flex justify-between gap-2 text-sm text-gray-800 dark:text-gray-200"><span>{row.category}</span><strong>{row.raw_score}/{row.max_score} · {row.percentage}%</strong></div>
          <div className="mt-1 h-2 overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700"><div className="h-full bg-green-600" style={{ width: `${Math.min(100, Math.max(0, row.percentage))}%` }} /></div>
        </div>)}</div> : <p className="mt-3 text-sm text-gray-600 dark:text-gray-300">No scored answers were recorded.</p>}
      </section>}
      {data?.assessment && !loading && !error && (reviewPending ? <p role="status" className="mt-5 text-sm text-gray-600 dark:text-gray-300">Loading submitted answers…</p> : reviewError ? <p role="alert" className="mt-5 text-sm text-rose-700 dark:text-rose-300">Submitted answers could not be loaded. Your score is still available above.</p> : <AnswerReview questions={review?.questions} answers={review?.answers} />)}
    </section>
  </div>
}
