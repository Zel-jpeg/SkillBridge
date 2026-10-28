import { HighestScoringAreas } from '../../components/CompetencyInsights'
import DataSection from '../../components/DataSection'
// src/pages/student/StudentDashboard.jsx
//
// BENTO GRID — wired to GET /api/students/me/ (Week 4)
//   - Replaces mock STUDENT constant with real API data
//   - hasTakenAssessment now comes from API has_submitted field
//   - retakeAllowed now comes from API retake_allowed field
//   - Shows a loading skeleton while the API call is in flight
//   - studentPin follows the shared student profile (local fallback during load)

import { useState } from 'react'
import NearbyMap from '../../components/student/NearbyMap'
import { useNavigate } from 'react-router-dom'
import Avatar from '../../components/Avatar'
import DashboardCompanyHighlights from '../../components/student/DashboardCompanyHighlights'
import StudentCompanyDetails from '../../components/StudentCompanyDetails'
import SkillCategoryList from '../../components/SkillCategoryList'
import { useApi } from '../../hooks/useApi'
import { useStudentResults } from '../../hooks/student/useStudentResults'
import PlacementStatusCard from '../../components/placements/PlacementStatusCard'
import { givenNamesForGreeting } from '../../utils/formatters'
import { dashboardAssessmentAction } from './assessmentUiState'

// Read the user object saved by the login response
// This lets pages render instantly without a skeleton on every navigation.
function getCachedUser() {
  try { return JSON.parse(localStorage.getItem('sb-user')) } catch { return null }
}


export default function StudentDashboard() {
  const [companySelection, setCompanySelection] = useState(null)
  const navigate = useNavigate()

  // Each initial data section has its own skeleton; cached data remains
  // visible while the existing live queries reconcile in the background.
  const { data: student } = useApi('/api/students/me/')
  const { data: assessmentList } = useApi('/api/assessments/')


  // ── Derived display values (safe fallbacks if API is slow/offline) ──
  const cachedUser      = getCachedUser()
  const displayName     = student?.name || cachedUser?.name || 'Student'
  const givenNames      = givenNamesForGreeting(displayName, student?.email || cachedUser?.email)
  const displayCourse   = student?.course   ?? ''
  const displayId       = student?.school_id ?? ''
  const attempts = assessmentList?.assessments || []
  const stoppedAssessment = attempts.find(item => item.attempt_status === 'stopped' && !item.retake_allowed)
  const retakeAssessment = attempts.find(item => item.retake_allowed && item.availability_status === 'available')
  const attemptStopped = Boolean(stoppedAssessment)
  const retakeAllowed = Boolean(retakeAssessment)


  // ── Results data (cached — same key as StudentResults, zero duplicate fetch if visited) ──
  const {
    skillScores,
    overallScore,
    topMatches,
    recommendedCompanies: allRecs,
    resultData,
    recommendationsLocked,
    studentPin,
  } = useStudentResults()
  const hasTakenAssessment = !recommendationsLocked && resultData?.all_required_completed === true
  const dashboardAction = dashboardAssessmentAction({ ...resultData, recommendations_locked: recommendationsLocked }, attempts)

  const enrichedCompanies = allRecs.filter(r => r.lat != null && r.lng != null)

  const nearestThree = studentPin
    ? [...enrichedCompanies].sort((a, b) => (a.distKm ?? Infinity) - (b.distKm ?? Infinity)).slice(0, 3)
    : enrichedCompanies.slice(0, 3)

  const hour = new Date().getHours()
  const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening'

  // ── Placement data ─────────────────────────────────────────────
  const placement = student?.placement
  const isUnplaced = !placement || placement.status !== 'approved'

  // ── Bento tile base style ─────────────────────────────────────
  const tile = 'bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-2xl'


  return (
    <div className="min-w-0">

      {/*
        ── Bento grid CSS ───────────────────────────────────────
        Named areas only kick in at lg (1024px+).
        Below that, sm uses col-span utilities; mobile stacks.

        Desktop layout:
          "greeting  greeting  status   "
          "matches   skills    map      "
          "nearest   skills    map      "
          "placement placement placement"

        The map tile spans rows 2–3 on desktop, making it tall
        enough to show the Leaflet map without scrolling.
        The placement tile spans the full bottom row when visible.
      */}
      <style>{`
        @media (min-width: 1024px) {
          .sb-bento {
            grid-template-columns: 1fr 1fr 1.6fr;
            grid-template-rows: auto 1fr 1fr auto;
            grid-template-areas:
              "greeting  greeting  status   "
              "matches   skills    map      "
              "nearest   skills    map      "
              "placement placement placement";
          }
          .sb-greeting   { grid-area: greeting;   }
          .sb-status     { grid-area: status;     }
          .sb-skills     { grid-area: skills;     }
          .sb-matches    { grid-area: matches;    }
          .sb-map        { grid-area: map;        }
          .sb-nearest    { grid-area: nearest;    }
          .sb-placement  { grid-area: placement;  }
        }
      `}</style>



      {/* ── Retake Available Banner ── */}
      {retakeAllowed && (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 pt-5">
          <div className="bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800 rounded-2xl px-5 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center shrink-0 shadow">
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M23 4v6h-6"/><path d="M1 20v-6h6"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>
                </svg>
              </div>
              <div>
                <p className="text-sm font-semibold text-blue-900 dark:text-blue-100">Retake Assessment Available</p>
                <p className="text-xs text-blue-700 dark:text-blue-300 mt-0.5">Your instructor approved a retake of {retakeAssessment?.title}. Your earlier attempt remains on record.</p>
              </div>
            </div>
            <button
              onClick={() => navigate(`/student/assessments/${retakeAssessment.id}/take`)}
              className="w-full sm:w-auto shrink-0 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white text-xs font-semibold px-4 py-2.5 rounded-xl transition-colors whitespace-nowrap"
            >
              Retake now
            </button>
          </div>
        </div>
      )}

      {attemptStopped && !retakeAllowed && (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 pt-5">
          <div className="bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 rounded-2xl px-5 py-4 flex items-start gap-3 shadow-sm">
            <div className="w-10 h-10 rounded-xl bg-rose-600 text-white flex items-center justify-center shrink-0 font-bold">!</div>
            <div>
              <p className="text-sm font-semibold text-rose-900 dark:text-rose-100">Assessment stopped / flagged</p>
              <p className="text-xs text-rose-700 dark:text-rose-300 mt-0.5">{stoppedAssessment?.stopped_reason_display || 'An assessment integrity rule was triggered.'} Your completed answers were recorded. Contact your instructor or administrator to request a retake.</p>
            </div>
          </div>
        </div>
      )}

      <section className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
        {/*
          HTML order optimised for mobile reading:
            greeting → status → matches → skills → map → nearest
          On desktop, named grid-areas reposition everything correctly.
        */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sb-bento">

          {/* ── GREETING ─────────────────────────────────────── */}
          <DataSection url="/api/students/me/" layout="greeting" className="sb-greeting sm:col-span-2"><div className={`sb-greeting ${tile} px-5 py-4 sm:col-span-2 flex items-center justify-between gap-4`}>
            <div>
              <h1 className="flex items-center gap-2 text-lg sm:text-xl font-bold text-gray-900 dark:text-white">
                <span>{greeting}, {givenNames}</span>
                <span aria-hidden="true">👋</span>
              </h1>
              <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 mt-0.5">
                {displayCourse} · {displayId} · Skill Assessment Portal
              </p>
            </div>
            {hasTakenAssessment && (
              <span className="hidden sm:inline-flex items-center gap-1.5 text-xs bg-green-100 dark:bg-green-950 text-green-700 dark:text-green-300 px-3 py-1.5 rounded-full font-medium shrink-0">
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none">
                  <path d="M20 6L9 17l-5-5" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                Required assessments complete
              </span>
            )}
          </div></DataSection>

          {/* ── STATUS ───────────────────────────────────────── */}
          <DataSection urls={['/api/assessments/', '/api/student/results/combined/']} layout="status" className="sb-status"><div className="sb-status">
            {!hasTakenAssessment ? (
              <div className="h-full bg-green-600 rounded-2xl p-5 flex flex-col justify-between gap-4 min-h-140px">
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-green-300 animate-pulse inline-block" />
                    <span className="text-xs text-green-200 font-medium">Assessment open</span>
                  </div>
                  <p className="text-white font-semibold text-sm">Your skills assessments</p>
                  <p className="text-green-200 text-xs mt-1 leading-relaxed">
                    {resultData?.total_required_count ? `${resultData.completed_required_count} of ${resultData.total_required_count} required assessments completed. ${resultData.remaining_required_count} remaining.` : 'View your assigned assessments and required progress.'}
                  </p>
                </div>
                <button
                  onClick={() => navigate(dashboardAction.to)}
                  className="bg-white text-green-700 font-semibold text-sm px-4 py-2.5 rounded-xl hover:bg-green-50 active:bg-green-100 transition-colors text-center"
                >
                  {dashboardAction.label} →
                </button>
              </div>
            ) : (
              <div className={`h-full ${tile} bg-green-50 dark:bg-green-950 border-green-200 dark:border-green-800 p-5 flex flex-col justify-between gap-4 min-h-140px`}>
                <div className="flex items-start gap-3">
                  <div className="w-9 h-9 bg-green-600 rounded-xl flex items-center justify-center shrink-0">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                      <path d="M20 6L9 17l-5-5" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-green-800 dark:text-green-200">Required assessments complete</p>
                    <p className="text-xs text-green-600 dark:text-green-400 mt-0.5">Your combined skill profile and matches are ready.</p>
                  </div>
                </div>
                <button
                  onClick={() => navigate('/student/results')}
                  className="bg-green-600 text-white font-semibold text-sm px-4 py-2.5 rounded-xl hover:bg-green-700 active:bg-green-800 transition-colors text-center"
                >
                  {dashboardAction.label} →
                </button>
              </div>
            )}
          </div></DataSection>

          {/* ── TOP MATCHES ──────────────────────────────────── */}
          <DataSection url="/api/student/results/combined/" layout="matches" className="sb-matches"><div className={`sb-matches ${tile} p-5`}>
            <p className="text-sm font-semibold text-gray-900 dark:text-white">Top partners for you</p>
            <p className="mt-1 mb-3 text-xs text-gray-500 dark:text-gray-400">Best position match per partner</p>
            {hasTakenAssessment ? (
              <DashboardCompanyHighlights companies={topMatches} onSelect={setCompanySelection} onSeeAll={() => navigate('/student/results')} />
            ) : (
              <div className="flex flex-col gap-2">
                {[1, 2, 3].map(i => (
                  <div key={i} className="flex items-center justify-between bg-gray-50 dark:bg-gray-800 rounded-xl px-3 py-2.5">
                    <div>
                      <div className="h-2.5 w-24 bg-gray-200 dark:bg-gray-700 rounded mb-1.5" />
                      <div className="h-2 w-16 bg-gray-100 dark:bg-gray-800 rounded" />
                    </div>
                    <span className="text-xs font-semibold text-gray-300 dark:text-gray-700">--%</span>
                  </div>
                ))}
                <p className="text-xs text-gray-400 dark:text-gray-500 text-center mt-1">Unlocks after all required assessments</p>
              </div>
            )}
          </div></DataSection>

          {/* ── SKILL PROFILE ────────────────────────────────── */}
          {/* Spans 2 rows on desktop via grid-area "skills" */}
          <DataSection url="/api/student/results/combined/" layout="skills" className="sb-skills relative min-h-0 sm:col-span-2"><div className={`sb-student-skill-card ${tile} p-5`}>
            <div className="flex shrink-0 items-center justify-between mb-4">
              <p className="text-sm font-semibold text-gray-900 dark:text-white">Skill profile</p>
              {hasTakenAssessment && (
                <span className="text-xs text-gray-400 dark:text-gray-500">Combined result</span>
              )}
            </div>
            {hasTakenAssessment ? (
              <>
                <div className="flex max-h-40 shrink-0 items-start gap-3 mb-4 overflow-y-auto p-3 bg-green-50 dark:bg-green-950 rounded-xl border border-green-100 dark:border-green-900" role="region" aria-label="Skill profile summary" tabIndex={0}>
                  <div className="w-9 h-9 rounded-full bg-green-600 flex items-center justify-center shrink-0">
                    <span className="text-xs font-bold text-white">{overallScore}</span>
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-green-800 dark:text-green-200">Overall skill score</p>
                    <HighestScoringAreas scores={skillScores.map(score => ({ category: score.label, percentage: score.pct, max_score: score.maxScore }))} audience="student" />
                  </div>
                </div>
                <SkillCategoryList scores={skillScores} />
              </>
            ) : (
              <div className="min-h-0 flex-1 overflow-y-auto flex flex-col gap-3">
                {['Web Dev', 'Networking', 'Database', 'Design'].map(label => (
                  <div key={label}>
                    <div className="flex justify-between mb-1">
                      <span className="text-xs text-gray-300 dark:text-gray-700">{label}</span>
                      <span className="text-xs text-gray-300 dark:text-gray-700">--%</span>
                    </div>
                    <div className="h-1.5 bg-gray-100 dark:bg-gray-800 rounded-full" />
                  </div>
                ))}
                <p className="text-xs text-gray-400 dark:text-gray-500 text-center mt-2">Unlocks after all required assessments</p>
              </div>
            )}
          </div></DataSection>

          {/* ── MAP ──────────────────────────────────────────── */}
          {/*
            Spans rows 2–3 on desktop (grid-area "map") — this is the
            tall bento tile. On tablet/mobile it's full-width with a
            fixed height so the map renders correctly.
          */}
          <DataSection url="/api/student/results/combined/" layout="map" count={1} className="sb-map sm:col-span-2"><div className={`sb-map ${tile} overflow-hidden flex flex-col sm:col-span-2`}>
            {/* Tile header */}
            <div className="flex flex-wrap items-center justify-between gap-2 px-5 py-3.5 border-b border-gray-100 dark:border-gray-800 shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-lg bg-blue-50 dark:bg-blue-950 flex items-center justify-center shrink-0">
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#2563eb" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polygon points="3 6 9 3 15 6 21 3 21 18 15 21 9 18 3 21"/>
                    <line x1="9" y1="3" x2="9" y2="18"/><line x1="15" y1="6" x2="15" y2="21"/>
                  </svg>
                </div>
                <div>
                  <p className="text-sm font-semibold text-gray-900 dark:text-white leading-tight">Nearby Partners</p>
                  {hasTakenAssessment && studentPin && enrichedCompanies.length > 0 && (
                    <p className="text-xs text-gray-400 dark:text-gray-500 leading-tight">
                      Closest: {nearestThree[0]?.company ?? nearestThree[0]?.name} · {nearestThree[0]?.distKm?.toFixed(1) ?? '?'} km
                    </p>
                  )}
                </div>
              </div>
              {studentPin && hasTakenAssessment && (
                <span className="text-xs font-medium text-blue-600 dark:text-blue-400">Straight-line distance</span>
              )}
            </div>

            {hasTakenAssessment ? (
              /* ── Active map state ── */
              <div className="flex-1 flex flex-col p-3 gap-2.5 min-h-0">

                {/* No-pin prompt */}
                {!studentPin && (
                  <div className="flex items-center justify-between gap-3 bg-amber-50 dark:bg-amber-950 border border-amber-100 dark:border-amber-900 rounded-xl px-4 py-2.5 shrink-0">
                    <p className="text-xs text-amber-700 dark:text-amber-300">
                      Pin your location to see distances to each partner.
                    </p>
                    <button
                      onClick={() => navigate('/student/profile')}
                      className="text-xs font-medium text-amber-700 dark:text-amber-300 underline whitespace-nowrap shrink-0"
                    >
                      Set pin →
                    </button>
                  </div>
                )}

                {/* Legend */}
                {studentPin && (
                  <div className="flex items-center gap-4 shrink-0 px-1">
                    <div className="flex items-center gap-1.5 text-xs text-blue-600 dark:text-blue-400">
                      <svg width="8" height="8" viewBox="0 0 24 24" fill="#2563eb" stroke="none">
                        <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z"/>
                      </svg>
                      You
                    </div>
                    <div className="flex items-center gap-1.5 text-xs text-green-600 dark:text-green-400">
                      <svg width="8" height="8" viewBox="0 0 24 24" fill="#16a34a" stroke="none">
                        <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z"/>
                      </svg>
                      OJT partners
                    </div>
                  </div>
                )}

                {/*
                  Map container: on desktop the tile stretches via grid,
                  so flex-1 + min-h-0 lets the map fill the remaining height.
                  On mobile/tablet it falls back to a fixed min-height.
                */}
                <div className="flex-1 min-h-0" style={{ minHeight: 320 }}>
                  <NearbyMap companies={enrichedCompanies} studentPin={studentPin} initialCenter={studentPin} />
                </div>
              </div>
            ) : (
              /* ── Locked state (pre-assessment) ── */
              <div className="flex-1 flex flex-col items-center justify-center gap-3 p-8" style={{ minHeight: 260 }}>
                <div className="w-12 h-12 rounded-2xl bg-gray-100 dark:bg-gray-800 flex items-center justify-center">
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"
                    className="text-gray-400 dark:text-gray-600">
                    <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
                    <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                  </svg>
                </div>
                <p className="text-sm text-gray-400 dark:text-gray-600 text-center max-w-xs">
                  {resultData?.recommendations_stale
                    ? 'Matching inputs have changed. Ask your administrator to re-run recommendations to refresh this map.'
                    : 'Complete all required assessments to unlock the nearby partners map.'}
                </p>
              </div>
            )}
          </div></DataSection>

          {/* ── NEAREST / QUICK ACTIONS ──────────────────────── */}
          <DataSection url="/api/student/results/combined/" layout="matches" className="sb-nearest sm:col-span-2"><div className={`sb-nearest ${tile} p-5 sm:col-span-2`}>
            {hasTakenAssessment && studentPin ? (
              /* Nearest 3 companies */
              <>
                <p className="text-sm font-semibold text-gray-900 dark:text-white">Nearest to you</p>
                <p className="mt-1 mb-3 text-xs text-gray-500 dark:text-gray-400">Straight-line distance · nearest first</p>
                <DashboardCompanyHighlights companies={nearestThree} nearest onSelect={setCompanySelection} onSeeAll={() => navigate('/student/results')} />
              </>
            ) : hasTakenAssessment ? (
              /* Assessment done but no pin yet */
              <>
                <p className="text-sm font-semibold text-gray-900 dark:text-white mb-3">Quick actions</p>
                <div className="flex flex-col gap-2">
                  <button
                    onClick={() => navigate('/student/profile')}
                    className="flex items-center gap-3 bg-gray-50 dark:bg-gray-800 rounded-xl px-3 py-2.5 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors text-left w-full"
                  >
                    <span className="text-base">📍</span>
                    <div>
                      <p className="text-xs font-medium text-gray-900 dark:text-white">Set your location pin</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">See distances to partners</p>
                    </div>
                  </button>
                  <button
                    onClick={() => navigate('/student/results')}
                    className="flex items-center gap-3 bg-gray-50 dark:bg-gray-800 rounded-xl px-3 py-2.5 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors text-left w-full"
                  >
                    <span className="text-base">📊</span>
                    <div>
                      <p className="text-xs font-medium text-gray-900 dark:text-white">View all matches</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">Full hybrid recommendation details</p>
                    </div>
                  </button>
                </div>
              </>
            ) : (
              /* Pre-assessment: onboarding checklist */
              <>
                <p className="text-sm font-semibold text-gray-900 dark:text-white mb-3">Next steps</p>
                <div className="flex flex-col gap-2">
                  {[
                    {
                      num: '1', label: 'Complete assessments',
                      sub: 'Complete your skill evaluation',
                      done: false, active: true,
                    },
                    {
                      num: '2', label: 'Set your location',
                      sub: studentPin ? 'Location pinned ✓' : "Pin where you'll be staying for OJT",
                      done: !!studentPin, active: false,
                    },
                    {
                      num: '3', label: 'View your matches',
                      sub: 'See top partners matched to you',
                      done: false, active: false,
                    },
                  ].map(step => (
                    <div
                      key={step.num}
                      className={`flex items-center gap-3 px-3 py-2.5 rounded-xl
                        ${step.done
                          ? 'bg-gray-50 dark:bg-gray-800'
                          : step.active
                          ? 'bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800'
                          : 'bg-gray-50 dark:bg-gray-800'}`}
                    >
                      <span className={`w-5 h-5 rounded-full text-xs font-bold flex items-center justify-center shrink-0
                        ${step.done
                          ? 'bg-green-100 dark:bg-green-900 text-green-600 dark:text-green-400'
                          : step.active
                          ? 'bg-green-600 text-white'
                          : 'bg-gray-200 dark:bg-gray-700 text-gray-500 dark:text-gray-400'}`}>
                        {step.done ? '✓' : step.num}
                      </span>
                      <div>
                        <p className={`text-xs font-medium ${
                          step.done ? 'text-gray-500 dark:text-gray-400 line-through'
                          : step.active ? 'text-green-800 dark:text-green-200'
                          : 'text-gray-900 dark:text-white'}`}>
                          {step.label}
                        </p>
                        <p className={`text-xs ${
                          step.done ? 'text-green-600 dark:text-green-400'
                          : step.active ? 'text-green-600 dark:text-green-400'
                          : 'text-gray-500 dark:text-gray-400'}`}>
                          {step.sub}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div></DataSection>

          {/* ── PLACEMENT STATUS ──────────────────────────────── */}
          {isUnplaced && (
            <div className="sb-placement sm:col-span-2">
              <PlacementStatusCard placement={placement} audience="student" />
            </div>
          )}

        </div>
      </section>
      {companySelection && hasTakenAssessment && <StudentCompanyDetails {...companySelection} onClose={() => setCompanySelection(null)} />}
    </div>
  )
}
