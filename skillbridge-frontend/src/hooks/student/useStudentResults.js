// src/hooks/student/useStudentResults.js
//
// Fetches GET /api/student/results/combined/ and enriches recommendations with:
//   - distKm       — Haversine distance from student's pinned location
//   - backend-provided hybrid component scores and distance
//
// Usage:
//   const { skillScores, recommendations, recommendationsLocked,
//           sortMode, setSortMode, hasPin, studentPin } = useStudentResults()

import { useState, useMemo } from 'react'
import { useApi } from '../useApi'
import { scorePercentage } from '../../utils/assessmentSummary'

const RESULTS_URL = '/api/student/results/combined/'

import { validPin, haversineKm, enrichRecommendation, sortRecommendations, groupRecommendationsByCompany } from '../../utils/recommendationResults'

// ── Color helpers (shared between Results and Dashboard) ──────────────────────
export function matchColor(pct) {
  if (pct >= 80) return 'text-green-600 dark:text-green-400'
  if (pct >= 60) return 'text-amber-600 dark:text-amber-400'
  return 'text-gray-400 dark:text-gray-500'
}
export function matchBadge(pct) {
  if (pct >= 80) return 'bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300'
  if (pct >= 60) return 'bg-amber-100 dark:bg-amber-900 text-amber-700 dark:text-amber-300'
  return 'bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400'
}
export const BAR_COLORS = [
  'bg-green-500', 'bg-blue-500', 'bg-violet-500', 'bg-amber-500', 'bg-rose-500',
]

// ── Main hook ─────────────────────────────────────────────────────────────────
export function useStudentResults() {
  const { data, loading, error } = useApi(RESULTS_URL)

  const { data: student } = useApi('/api/students/me/')
  // Only the authenticated profile supplies a pin; a previous account's local
  // fallback must not appear during loading or after a failed profile read.
  const studentPin = useMemo(() => validPin(student?.address?.pinLat, student?.address?.pinLng), [student])
  const hasPin     = studentPin != null

  const [sortMode, setSortMode] = useState('match')

  // ── Skill scores — formatted for bar charts ─────────────────────────────
  const skillScores = useMemo(() => {
    if (data?.recommendations_locked !== false || !data?.combined_category_scores?.length) return []
    return data.combined_category_scores.map((s, i) => ({
      label:    s.category,
      pct:      scorePercentage(s.percentage),
      tag:      s.tag,
      rawScore: s.raw_score,
      maxScore: s.max_score,
      barColor: BAR_COLORS[i % BAR_COLORS.length],
    })).sort((left, right) => (right.pct ?? -1) - (left.pct ?? -1))
  }, [data])

  const overallScore = data?.recommendations_locked === false ? data?.overall_percentage : null

  // ── Recommendations — enriched with distance + scores ───────────────────
  const enrichedRecs = useMemo(() => {
    if (data?.recommendations_locked !== false || !data?.recommendations?.length) return []
    return data.recommendations.map(row => enrichRecommendation(row, studentPin))
  }, [data, studentPin])

  const recommendations = useMemo(() => sortRecommendations(enrichedRecs, sortMode), [enrichedRecs, sortMode])
  const recommendedCompanies = useMemo(() => groupRecommendationsByCompany(enrichedRecs, sortMode), [enrichedRecs, sortMode])
  const topMatches = useMemo(() => groupRecommendationsByCompany(enrichedRecs).slice(0, 3), [enrichedRecs])

  return {
    skillScores, overallScore,
    competencyProfile: data?.combined_competency_profile ?? null,
    resultData: data,
    recommendationsLocked: data?.recommendations_locked !== false,
    placement: data?.placement ?? null,
    recommendations, recommendedCompanies, topMatches,
    loading, error,
    sortMode, setSortMode,
    hasPin, studentPin, haversineKm,
  }
}
