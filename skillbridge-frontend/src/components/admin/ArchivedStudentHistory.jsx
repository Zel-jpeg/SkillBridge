import { useEffect, useState } from 'react'
import { fetchWithDedup, getCachedData, useApi } from '../../hooks/useApi'
import DataSection from '../DataSection'
import StudentDetailModal from '../StudentDetailModal'

export default function ArchivedStudentHistory({ student, onClose, footer }) {
  const url = `/api/admin/users/${student.id}/history/`
  const { data } = useApi(url)
  useEffect(() => {
    // The same account can be restored and archived again. A 404 from its
    // active period must not permanently suppress its newly authorized history.
    if (!getCachedData(url)) void fetchWithDedup(url).catch(() => {})
  }, [url])
  const [index, setIndex] = useState(0)
  const records = data?.records || []
  const record = records[Math.min(index, Math.max(0, records.length - 1))]
  const historical = { ...student, recommendationsLocked: true, historicalEvidence: true,
    batch: record?.batch, instructor: record?.instructor, assessmentResults: record?.assessment_results || [],
    combinedCategoryScores: record?.combined_category_scores || [],
    combinedCompetencyProfile: record?.combined_competency_profile,
    completedRequiredCount: record?.completed_required_count || 0, totalRequiredCount: record?.total_required_count || 0,
    remainingRequiredCount: record?.remaining_required_count || 0,
    placementHistory: record?.placement_history || [], placementKnown: false }
  return <StudentDetailModal student={historical} onClose={onClose} footer={footer} isArchived historyUrl={url}
    contextControls={<div className="px-5 pt-4 text-xs"><DataSection url={url} layout="control" label="Loading preserved student history">
      <p className="mb-3 text-gray-500">Preserved records · Read-only · Historical evidence does not unlock current recommendations.</p>
      {records.length ? <label>History batch<select aria-label="History batch" className="ml-3 min-h-11 max-w-full rounded-lg border border-gray-200 bg-white p-2 dark:border-gray-700 dark:bg-gray-900" value={Math.min(index, records.length - 1)} onChange={event => setIndex(Number(event.target.value))}>{records.map((row, i) => <option key={row.batch?.id ?? 'detached'} value={i}>{row.batch?.name || 'Unassigned assessment history'}</option>)}</select></label> : <p>No assessment, enrollment or placement history is recorded.</p>}
    </DataSection></div>} />
}
