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

const RESULTS_URL = '/api/student/results/combined/'

// ── Haversine distance (km) ───────────────────────────────────────────────────
function haversineKm(lat1, lng1, lat2, lng2) {
  const R    = 6371
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLng = (lng2 - lng1) * Math.PI / 180
  const a    = Math.sin(dLat / 2) ** 2
    + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

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

// ── Read student pin from localStorage ───────────────────────────────────────
function readPin() {
  try { return JSON.parse(localStorage.getItem('sb_pin_location')) } catch { return null }
}

// ── Main hook ─────────────────────────────────────────────────────────────────
export function useStudentResults() {
  const { data, loading, error } = useApi(RESULTS_URL, { fresh: true })

  const studentPin = useMemo(() => readPin(), [])
  const hasPin     = studentPin != null

  const [sortMode, setSortMode] = useState('match')

  // ── Skill scores — formatted for bar charts ─────────────────────────────
  const skillScores = useMemo(() => {
    if (data?.recommendations_locked !== false || !data?.combined_category_scores?.length) return []
    return data.combined_category_scores.map((s, i) => ({
      label:    s.category,
      pct:      Math.round(s.percentage),
      tag:      s.tag,
      rawScore: s.raw_score,
      maxScore: s.max_score,
      barColor: BAR_COLORS[i % BAR_COLORS.length],
    }))
  }, [data])

  const overallScore = data?.recommendations_locked === false ? data?.overall_percentage : null

  // ── Recommendations — enriched with distance + scores ───────────────────
  const enrichedRecs = useMemo(() => {
    if (data?.recommendations_locked !== false || !data?.recommendations?.length) return []
    return data.recommendations.map(r => {
      const match = Math.round(r.match_score)
      const localDistance = hasPin && r.lat != null && r.lng != null
        ? haversineKm(studentPin.lat, studentPin.lng, r.lat, r.lng)
        : null
      const distKm = r.distance_km ?? localDistance
      return {
        ...r,
        match,
        distKm,
        proximityPct: r.location_score_component ?? null,
        combined: match,
      }
    })
  }, [data, hasPin, studentPin])

  const recommendations = useMemo(() => {
    return [...enrichedRecs].sort((a, b) => {
      if (sortMode === 'distance') return (a.distKm ?? Infinity) - (b.distKm ?? Infinity)
      if (sortMode === 'combined') return b.combined - a.combined
      return b.match - a.match
    })
  }, [enrichedRecs, sortMode])

  const topMatches = useMemo(() => {
    return [...enrichedRecs].sort((a, b) => b.match - a.match).slice(0, 3)
  }, [enrichedRecs])

  return {
    skillScores, overallScore,
    competencyProfile: data?.combined_competency_profile ?? null,
    resultData: data,
    recommendationsLocked: data?.recommendations_locked !== false,
    placement: data?.placement ?? null,
    recommendations, topMatches,
    loading, error,
    sortMode, setSortMode,
    hasPin, studentPin, haversineKm,
  }
}
