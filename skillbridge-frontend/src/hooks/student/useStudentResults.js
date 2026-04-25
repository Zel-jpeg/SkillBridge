// src/hooks/student/useStudentResults.js
//
// Fetches GET /api/student/results/ and enriches recommendations with:
//   - distKm       — Haversine distance from student's pinned location
//   - proximityPct — 0-100 score (0 km = 100, ≥200 km = 0)
//   - combined     — 70% skill match + 30% proximity
//
// Also accepts `routerState` — the data passed through navigate() state
// immediately after an assessment submit.  That data is used as the
// initial display value (zero loading delay) and is persisted to
// sessionStorage so the same cache as useApi is warmed.
//
// Usage:
//   const { skillScores, recommendations, reviewData, loading, error,
//           sortMode, setSortMode, hasPin, studentPin } = useStudentResults(routerState)

import { useState, useEffect, useMemo } from 'react'
import { useApi, _setCache } from '../useApi'

const RESULTS_URL = '/api/student/results/'
const REVIEW_URL  = '/api/student/results/review/'

// ── Haversine distance (km) ───────────────────────────────────────────────────
function haversineKm(lat1, lng1, lat2, lng2) {
  const R    = 6371
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLng = (lng2 - lng1) * Math.PI / 180
  const a    = Math.sin(dLat / 2) ** 2
    + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

// Proximity score: 0–100 (0 km → 100, ≥200 km → 0)
function proximityScore(distKm) {
  return Math.max(0, Math.round(100 - (distKm / 200) * 100))
}

// Combined: 70% skill match + 30% proximity
function combinedScore(matchPct, distKm) {
  return Math.round(matchPct * 0.7 + proximityScore(distKm) * 0.3)
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
export function useStudentResults(routerState = null) {
  // If we just came from a submit, warm the cache so useApi returns immediately
  useEffect(() => {
    if (!routerState) return
    const { scores, recommendations } = routerState
    if (!scores && !recommendations) return
    _setCache(RESULTS_URL, {
      skill_scores:    scores        ?? [],
      recommendations: recommendations ?? [],
    })
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const { data, loading, error }                    = useApi(RESULTS_URL)
  // Backend review: correct answers from DB — fixes "all wrong" on return visit
  const { data: reviewRaw, loading: reviewLoading } = useApi(REVIEW_URL)

  const studentPin = useMemo(() => readPin(), [])
  const hasPin     = studentPin != null

  const [sortMode, setSortMode] = useState('match')

  // ── Review data: router state → backend DB → localStorage ───────────────
  const reviewData = useMemo(() => {
    // 1. Freshly enriched from submit response (instant, has is_correct on choices)
    if (routerState?.reviewData?.questions?.length) {
      try { localStorage.setItem('sb_review_data', JSON.stringify(routerState.reviewData)) } catch {}
      return routerState.reviewData
    }
    // 2. Backend DB — always correct, bypasses stale localStorage
    if (reviewRaw?.questions?.length) {
      return { questions: reviewRaw.questions, answers: reviewRaw.answers }
    }
    // 3. localStorage fallback (legacy, may not have is_correct)
    try {
      const saved = JSON.parse(localStorage.getItem('sb_review_data'))
      if (saved?.questions?.length) return saved
    } catch {}
    return null
  }, [routerState, reviewRaw]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Skill scores — formatted for bar charts ─────────────────────────────
  const skillScores = useMemo(() => {
    if (!data?.skill_scores?.length) return []
    return data.skill_scores.map((s, i) => ({
      label:    s.category,
      pct:      Math.round(s.percentage),
      rawScore: s.raw_score,
      maxScore: s.max_score,
      barColor: BAR_COLORS[i % BAR_COLORS.length],
    }))
  }, [data])

  const overallScore = useMemo(() => {
    if (!skillScores.length) return 0
    return Math.round(skillScores.reduce((sum, s) => sum + s.pct, 0) / skillScores.length)
  }, [skillScores])

  // ── Recommendations — enriched with distance + scores ───────────────────
  const enrichedRecs = useMemo(() => {
    if (!data?.recommendations?.length) return []
    return data.recommendations.map(r => {
      const match = Math.round(r.match_score)
      if (hasPin && r.lat != null && r.lng != null) {
        const dist = haversineKm(studentPin.lat, studentPin.lng, r.lat, r.lng)
        return { ...r, match, distKm: dist, proximityPct: proximityScore(dist), combined: combinedScore(match, dist) }
      }
      return { ...r, match, distKm: null, proximityPct: null, combined: match }
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
    recommendations, topMatches,
    reviewData, reviewLoading,
    loading, error,
    sortMode, setSortMode,
    hasPin, studentPin, haversineKm,
  }
}
