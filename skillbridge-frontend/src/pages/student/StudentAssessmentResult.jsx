import AssessmentInsights from '../../components/student/AssessmentInsights'
import AssessmentResultSummary from '../../components/student/AssessmentResultSummary'
import SubmittedAnswerReview from '../../components/student/SubmittedAnswerReview'
import '../../components/student/assessmentResult.css'
import SkillCategoryList from '../../components/SkillCategoryList'
import DataSection from '../../components/DataSection'
import { useId, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useApi } from '../../hooks/useApi'

export default function StudentAssessmentResult() {
  const navigate = useNavigate()
  const { assessmentId } = useParams()
  const [categoriesExpanded, setCategoriesExpanded] = useState(false)
  const categoryListId = useId()
  const validId = /^\d+$/.test(assessmentId || '')
  const resultUrl = validId ? `/api/student/results/?assessment_id=${assessmentId}` : null
  const reviewUrl = validId ? `/api/student/results/review/?assessment_id=${assessmentId}` : null
  const { data, loading, error } = useApi(resultUrl)
  const { data: review, loading: reviewLoading, error: reviewError } = useApi(reviewUrl, { skip: !data?.assessment })
  const reviewPending = reviewLoading || (!review && !reviewError)
  const scores = data?.skill_scores || []
  const visibleScores = categoriesExpanded ? scores : scores.slice(0, 6)
  const stopped = data?.assessment?.attempt_status === 'stopped'

  return <div className="min-w-0">

    <section className="mx-auto max-w-4xl px-4 py-6 sm:px-6 sm:py-8">
      <button onClick={() => navigate('/student/assessments')} className="mb-5 text-sm font-medium text-green-700 hover:underline dark:text-green-400 focus-visible:outline-2">← Skills Assessments</button>
      <DataSection urls={resultUrl ? [resultUrl] : []} layout="result-summary">
        {(!validId || error) && <div role="alert" className="sa-card text-rose-700 dark:text-rose-300">{!validId ? 'Invalid assessment link.' : error === 'Finalized attempt not found' ? 'There is no completed attempt to show yet.' : 'This assessment result is unavailable for your batch.'}</div>}
        {loading && <p role="status" className="mt-4 text-sm text-gray-600 dark:text-gray-300">Loading your result…</p>}
        {data?.assessment && !loading && !error && <AssessmentResultSummary data={data} review={review} reviewPending={reviewPending} reviewError={reviewError} />}
      </DataSection>
      {data?.assessment && !loading && !error && <section className="sb-assessment-category-card mt-6 rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-gray-900 sm:p-6" aria-labelledby="category-scores-title">
        <h2 id="category-scores-title" className="mb-4 shrink-0 text-lg font-bold text-gray-900 dark:text-white">Category scores</h2>
        {scores.length ? <SkillCategoryList id={categoryListId} scores={visibleScores} showRaw showTags={false} colorful={false} scrollable={false} /> : <p className="mt-3 text-sm text-gray-600 dark:text-gray-300">No scored answers were recorded.</p>}
        {scores.length > 6 && <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-gray-100 pt-3 dark:border-gray-800">
          <p className="text-xs text-gray-500 dark:text-gray-400">Showing {visibleScores.length} of {scores.length} categories</p>
          <button type="button" aria-expanded={categoriesExpanded} aria-controls={categoryListId}
            onClick={() => setCategoriesExpanded(expanded => !expanded)}
            className="min-h-11 rounded-lg px-3 py-2 text-xs font-semibold text-green-700 transition-colors hover:bg-green-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-green-600 dark:text-green-300 dark:hover:bg-green-950/40">
            {categoriesExpanded ? 'Show less' : `Show ${scores.length - 6} more categories`}
          </button>
        </div>}
      </section>}
      {data?.assessment && !loading && !error && !stopped && <AssessmentInsights scores={scores} profile={data.competency_profile} />}
      <DataSection urls={data?.assessment && reviewUrl ? [reviewUrl] : []} layout="answers" label="Loading submitted answers">
        {data?.assessment && !loading && !error && (reviewPending ? <p role="status" className="mt-5 text-sm text-gray-600 dark:text-gray-300">Loading submitted answers…</p> : reviewError ? <p role="alert" className="mt-5 text-sm text-rose-700 dark:text-rose-300">Submitted answers could not be loaded. Your score is still available above.</p> : <SubmittedAnswerReview questions={review?.questions} answers={review?.answers} />)}
      </DataSection>
    </section>
  </div>
}
