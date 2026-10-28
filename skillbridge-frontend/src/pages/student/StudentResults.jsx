import NearbyMap from '../../components/student/NearbyMap'
import DataSection from '../../components/DataSection'
// src/pages/student/StudentResults.jsx
//
// Final combined skill profile and company matches.
// GET /api/student/results/combined/ is the source of final scores and lock state.
//
// If the student's shared profile has a pinned location:
//   - Map shows student pin (blue) + company pins (green)
//   - Distance in km on each card
//   - Sort modes: Best Match | Nearest | Combined

import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import ScoreLabel from '../../components/ScoreLabel'
import CompanyImage from '../../components/CompanyImage'
import SkillCategoryList from '../../components/SkillCategoryList'
import { useApi } from '../../hooks/useApi'
import { useStudentResults, matchColor } from '../../hooks/student/useStudentResults'
import CompetencyInsights, { HighestScoringAreas } from '../../components/CompetencyInsights'
import PlacementStatusCard from '../../components/placements/PlacementStatusCard'
import PlacementGuidance from '../../components/placements/PlacementGuidance'
import StudentCompanyDetails from '../../components/StudentCompanyDetails'
import { sortCompanyPositions } from '../../utils/recommendationResults'




// ── Helpers ───────────────────────────────────────────────────────
function distBadgeColor(km) {
  if (km < 5)  return 'bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300'
  if (km < 20) return 'bg-sky-100 dark:bg-sky-900 text-sky-700 dark:text-sky-300'
  return 'bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400'
}

// MAIN COMPONENT
// ════════════════════════════════════════════════════════════════
export default function StudentResults() {
  const navigate = useNavigate()
  // Final results always come from the current batch-scoped API.
  const {
    skillScores,
    placement,
    recommendations,
    recommendedCompanies: sorted,
    loading: resultsLoading,
    error: resultsError,
    resultData,
    recommendationsLocked,
    sortMode,
    setSortMode,
    hasPin,
    studentPin,
  } = useStudentResults()

  // ── All companies tab ───────────────────────────────────────────
  const [companyTab, setCompanyTab] = useState('recommended') // 'recommended' | 'all'
  const [companySelection, setCompanySelection] = useState(null)
  const { data: allCompaniesRaw, loading: allCompLoading } = useApi('/api/student/companies/', { skip: recommendationsLocked || companyTab !== 'all' })
  const allCompanies = allCompaniesRaw ?? []

  // Animated skill bars
  const [animated, setAnimated] = useState(false)
  useEffect(() => { const t = setTimeout(() => setAnimated(true), 100); return () => clearTimeout(t) }, [])

  const { data: apiStudent } = useApi('/api/students/me/')
  const displayId = apiStudent?.school_id ?? ''
  const displayCourse = apiStudent?.course ?? ''

  if (resultsLoading || !resultData || resultsError || recommendationsLocked) return (
    <div className="min-w-0">

      <DataSection url="/api/student/results/combined/" layout="result-summary"><section className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
        <button onClick={() => navigate('/student/assessments')} className="mb-5 text-sm font-medium text-green-700 hover:underline dark:text-green-400">← Skills Assessments</button>
        <div className="rounded-2xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-gray-900 sm:p-8">
          {resultsLoading || (!resultData && !resultsError) ? <p role="status" className="text-sm text-gray-600 dark:text-gray-300">Loading your final skill profile…</p>
            : resultsError ? <><h1 className="text-xl font-bold text-gray-900 dark:text-white">Final results unavailable</h1><p role="alert" className="mt-2 text-sm text-gray-600 dark:text-gray-300">{resultsError === 'not_enrolled' ? 'You are not enrolled in an active batch.' : 'We could not load your results. Please try again.'}</p></>
            : <>
                <p className="text-xs font-semibold uppercase tracking-wide text-amber-700 dark:text-amber-400">Final results</p>
                <h1 className="mt-1 text-2xl font-bold text-gray-900 dark:text-white">{resultData?.recommendations_stale ? 'Recommendations need refreshing' : 'Final Skill Profile Locked'}</h1>
                <p className="mt-3 text-sm leading-relaxed text-gray-600 dark:text-gray-300">{resultData?.recommendations_stale
                  ? 'Matching inputs have changed or these saved results need verification. Your assessment scores are preserved. Ask your administrator to re-run recommendations.'
                  : resultData?.has_required_assessments
                  ? `Complete your remaining ${resultData.remaining_required_count} required assessment${resultData.remaining_required_count === 1 ? '' : 's'} to generate your combined competency profile and OJT placement recommendations.`
                  : 'No required assessments are currently published. Your final skill profile will be available after required work is assigned and completed.'}</p>
                <p className="mt-4 text-sm font-semibold text-gray-800 dark:text-gray-200">{resultData?.completed_required_count || 0} of {resultData?.total_required_count || 0} required assessments completed</p>
                <div role="progressbar" aria-label="Required assessment completion" aria-valuemin={0} aria-valuemax={resultData?.total_required_count || 1} aria-valuenow={resultData?.completed_required_count || 0} className="mt-2 h-2.5 overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700"><div className="h-full bg-green-600" style={{ width: `${resultData?.total_required_count ? (resultData.completed_required_count / resultData.total_required_count * 100) : 0}%` }} /></div>
              </>}
          <button onClick={() => navigate('/student/assessments')} className="mt-6 rounded-xl bg-green-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-green-700 focus-visible:outline-2 focus-visible:outline-offset-2">View Assessments</button>
        </div>
      </section></DataSection>
    </div>
  )

  return (
    <div className="min-w-0 pb-12">


      <section className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-8">

        {/* Back */}
        <button onClick={() => navigate('/student/dashboard')}
          className="inline-flex items-center gap-1.5 text-sm text-gray-400 dark:text-gray-500 hover:text-gray-700 dark:hover:text-gray-200 transition-colors group w-fit mb-4">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" className="transition-transform group-hover:-translate-x-0.5">
            <path d="M19 12H5M12 5l-7 7 7 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          Dashboard
        </button>

        {/* Header with Buttons */}
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 border-b border-gray-100 dark:border-gray-800 pb-5">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white tracking-tight">Final Skill Profile</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              Combined from {resultData?.included_assessments?.map(item => item.title).join(', ') || 'your completed assessments'} · {displayCourse} · {displayId}
            </p>
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">Generated {resultData?.generated_at ? new Intl.DateTimeFormat('en-PH', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(resultData.generated_at)) : 'recently'} · Model used: {resultData?.model_used || 'No model result available'}</p>
          </div>
          <div className="flex items-center gap-2">

            <button onClick={() => navigate('/student/assessments')} className="rounded-xl bg-blue-100 px-3.5 py-2 text-xs font-semibold text-blue-700 hover:bg-blue-200 dark:bg-blue-900/40 dark:text-blue-300">Assessments</button>
          </div>
        </div>

        <div className="mt-6">
          <PlacementStatusCard placement={placement ?? apiStudent?.placement} audience="student" />
        </div>


        {/* ── TOP ROW: Map (left) + Skill Profile (right) side by side ── */}
        <div className="mt-6 mb-8 flex flex-col lg:flex-row gap-6 lg:items-start">

          {/* Map — takes ~65% width on desktop */}
          <div className="flex-1 min-w-0 bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-2xl shadow-sm flex flex-col" style={{ isolation: 'isolate' }}>
            <div className="flex items-center justify-between px-4 py-3 shrink-0">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-blue-50 dark:bg-blue-950 flex items-center justify-center shrink-0">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#2563eb" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <polygon points="3 6 9 3 15 6 21 3 21 18 15 21 9 18 3 21"/><line x1="9" y1="3" x2="9" y2="18"/><line x1="15" y1="6" x2="15" y2="21"/>
                  </svg>
                </div>
                <div>
                  <p className="text-sm font-semibold text-gray-900 dark:text-white">Interactive Placement Map</p>
                  <p className="text-[10px] text-gray-500 dark:text-gray-400 mt-0.5">Select a partner pin for driving distance</p>
                </div>
              </div>
              {!hasPin ? (
                <button onClick={() => navigate('/student/profile')} className="flex items-center gap-2 bg-amber-50 dark:bg-amber-950/40 px-3 py-1.5 rounded-lg border border-amber-200 dark:border-amber-800 hover:bg-amber-100 dark:hover:bg-amber-900/40 transition-colors shrink-0">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#d97706" strokeWidth="2" strokeLinecap="round" className="shrink-0"><circle cx="12" cy="12" r="10"/><path d="M12 8v4M12 16h.01"/></svg>
                  <p className="text-[10px] text-amber-800 dark:text-amber-300 font-semibold">Pin location</p>
                </button>
              ) : (
                <span className="text-[10px] text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-800 px-2.5 py-1 rounded-full border border-gray-200 dark:border-gray-700 hidden sm:inline">⭐ Dynamic</span>
              )}
            </div>
            {/* Map fills remaining card area, no extra padding */}
            <div className="flex-1 w-full min-h-0 px-3 pb-3">
              {resultsLoading && !sorted.length ? (
                <div className="w-full h-full bg-gray-50 dark:bg-gray-800 animate-pulse rounded-xl" style={{ minHeight: 280 }} />
              ) : (
                <div className="w-full" style={{ height: 'clamp(280px, 45vw, 460px)' }}>
                  <NearbyMap companies={sorted} studentPin={studentPin} initialCenter={studentPin} />
                </div>
              )}
            </div>
          </div>

          {/* Skill Assessment Profile — ~35% width on desktop, sticky */}
          <div className="sb-student-skill-card w-full lg:w-[35%] shrink-0 bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-2xl p-5 shadow-sm lg:sticky lg:top-6">
            <p className="shrink-0 text-sm font-semibold text-gray-900 dark:text-white mb-4">Skill assessment profile</p>
            {resultsLoading && !skillScores.length ? (
              <div className="flex flex-col gap-3">
                {[1,2,3].map(i => <div key={i} className="h-6 bg-gray-100 dark:bg-gray-800 rounded animate-pulse" />)}
              </div>
            ) : <SkillCategoryList scores={skillScores} animated={animated} />}
            <div className="mt-5 max-h-32 shrink-0 overflow-y-auto border-t border-gray-200 pt-4 dark:border-gray-700" role="region" aria-label="Highest scoring areas" tabIndex={0}>
              <HighestScoringAreas scores={resultData.combined_category_scores} audience="student" />
            </div>
          </div>
        </div>

        <div className="mb-8">
          <CompetencyInsights scores={resultData.combined_category_scores} profile={resultData.combined_competency_profile} audience="student" />
        </div>

        {/* ── COMPANY MATCHES — full width below ── */}
        <div className="flex flex-col gap-5">

          <PlacementGuidance />

          {/* Tab bar: Recommended vs All Companies */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-1 bg-gray-100 dark:bg-gray-800 rounded-xl p-1 w-fit">
                {[
                  { key: 'recommended', label: 'Recommended' },
                  { key: 'all',         label: 'All Partners' },
                ].map(({ key, label }) => (
                  <button
                    key={key}
                    aria-pressed={companyTab === key}
                    onClick={() => setCompanyTab(key)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap
                      ${companyTab === key
                        ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm'
                        : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
                      }`}
                  >
                    {label}
                    {key === 'recommended' && sorted.length > 0 && (
                      <span className="ml-1.5 bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300 text-[10px] font-bold px-1.5 py-0.5 rounded-full">{sorted.length}</span>
                    )}
                    {key === 'all' && allCompanies.length > 0 && (
                      <span className="ml-1.5 bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-300 text-[10px] font-bold px-1.5 py-0.5 rounded-full">{allCompanies.length}</span>
                    )}
                  </button>
                ))}
              </div>
              <p className="text-xs text-gray-400 dark:text-gray-500 mt-1.5">
                {companyTab === 'recommended'
                  ? (resultsLoading && !sorted.length ? 'Loading…' : `${sorted.length} partner${sorted.length === 1 ? '' : 's'} · ${recommendations.length} suggested position${recommendations.length !== 1 ? 's' : ''}`)
                  : (allCompLoading ? 'Loading…' : `${allCompanies.length} partner${allCompanies.length !== 1 ? 's' : ''} · ${allCompanies.reduce((n, c) => n + c.positions.length, 0)} position${allCompanies.reduce((n, c) => n + c.positions.length, 0) !== 1 ? 's' : ''}`)}
              </p>
              {companyTab === 'recommended' && sorted.length > 0 && <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">{sortMode === 'distance' ? 'Partners ordered by straight-line distance from your saved location.' : 'Partners ranked by their best position match.'}</p>}
            </div>

            {/* Sort toggle — only for recommended tab */}
            {companyTab === 'recommended' && (
            <div className="flex items-center gap-1 bg-gray-100 dark:bg-gray-800 rounded-xl p-1 self-start sm:self-auto">
              {[
                { key: 'match',    label: 'Hybrid Match' },
                { key: 'distance', label: 'Nearest',    disabled: !hasPin },
                { key: 'combined', label: 'Score Details' },
              ].map(({ key, label, disabled }) => (
                <button
                  key={key}
                  aria-pressed={sortMode === key}
                  onClick={() => !disabled && setSortMode(key)}
                  disabled={disabled}
                  title={disabled ? 'Pin your location first' : undefined}
                  className={`px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap
                    ${sortMode === key
                      ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm'
                      : disabled
                        ? 'text-gray-300 dark:text-gray-600 cursor-not-allowed'
                        : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
                    }`}
                >
                  {label}
                </button>
              ))}
            </div>
            )}
          </div>

          {/* Sort explanation banners */}
          {companyTab === 'recommended' && sortMode === 'combined' && (
            <div className="bg-blue-50 dark:bg-blue-950 border border-blue-100 dark:border-blue-900 rounded-xl px-4 py-2.5 flex items-center gap-2">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#2563eb" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><path d="M12 8v4M12 16h.01"/></svg>
              <p className="text-xs text-blue-700 dark:text-blue-300">Hybrid match = 60% Category fit + 25% NLP fit + 15% Location fit</p>
            </div>
          )}

          {companyTab === 'recommended' && !hasPin && sortMode === 'match' && (
            <div className="bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-2.5 flex items-center justify-between gap-3">
              <p className="text-xs text-gray-500 dark:text-gray-400">
                📍 Pin your location to unlock <strong>Nearest</strong> and <strong>Combined</strong> sorting.
              </p>
              <button onClick={() => navigate('/student/profile')}
                className="text-xs font-medium text-green-600 dark:text-green-400 hover:underline whitespace-nowrap shrink-0">
                Set pin →
              </button>
            </div>
          )}

          {/* All Companies tab */}
          {companyTab === 'all' && (
            <div className="flex flex-col gap-3">
<DataSection url="/api/student/companies/" layout="cards">              {allCompLoading && (
                <div className="flex items-center justify-center py-12 text-gray-400 dark:text-gray-600">
                  <svg className="animate-spin mr-2" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>
                  Loading partners…
                </div>
              )}
              {!allCompLoading && allCompanies.length === 0 && (
                <div className="bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-2xl p-8 text-center">
                  <p className="text-sm font-medium text-gray-600 dark:text-gray-400">No partners yet</p>
                  <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">Check back after your OJT coordinator adds partners.</p>
                </div>
              )}
              {allCompanies.map(co => (
                <article key={co.id} className="relative bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-4 sm:p-5 shadow-sm hover:shadow-md hover:border-green-300 dark:hover:border-green-700 hover:ring-2 hover:ring-green-200 dark:hover:ring-green-900 focus-within:ring-2 focus-within:ring-green-500 transition-all">
                  <div className="flex items-start gap-3 mb-3">
                    <CompanyImage name={co.name} imageUrl={co.image_url} className="w-9 h-9 rounded-xl" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-gray-900 dark:text-white">{co.name}</p>
                      {co.address && <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">{co.address}</p>}
                    </div>
                  </div>
                  <div className="flex flex-col gap-2">
                    {sortCompanyPositions(co.positions).map(pos => (
                      <div key={pos.id} className="flex items-center justify-between gap-3 bg-gray-50 dark:bg-gray-800/60 rounded-xl px-3 py-2">
                        <div className="min-w-0">
                          <p className="text-xs font-semibold text-gray-800 dark:text-gray-200 truncate">{pos.title}</p>
                          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">{pos.slots} listed slot{pos.slots !== 1 ? 's' : ''}</p>
                        </div>
                        <div className="shrink-0 text-right">
                          {pos.match_score != null ? (
                            <>
                              <p className={`text-sm font-bold ${matchColor(pos.match_score)}`}>{pos.match_score}%</p>
                              <p className="text-[10px] text-gray-400 dark:text-gray-500">match</p>
                            </>
                          ) : (
                            <p className="text-[10px] text-gray-400 dark:text-gray-500">No match score</p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                  <button type="button" onClick={() => setCompanySelection({ companyId: co.id })} aria-label={`View partner details for ${co.name}`} aria-haspopup="dialog"
                    className="mt-3 min-h-10 text-xs font-semibold text-green-700 dark:text-green-400 after:absolute after:inset-0 after:rounded-2xl focus-visible:outline-none">View partner details <span aria-hidden="true">→</span></button>
                </article>
              ))}
</DataSection>            </div>
          )}

          {/* Match cards — 2-column grid on large screens */}
          {companyTab === 'recommended' && (
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-3">
            {sorted.length === 0 && !resultsLoading && (
              <div className="col-span-full bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-2xl p-8 text-center">
                <p className="text-sm font-medium text-gray-600 dark:text-gray-400">No eligible partner positions are currently available.</p>
                <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">You can still browse partners.</p>
                <button onClick={() => setCompanyTab('all')} className="mt-3 text-xs font-medium text-green-600 dark:text-green-400 hover:underline">Browse all partners →</button>
              </div>
            )}
            {sorted.map((r, idx) => (
              <article key={r.companyKey}
                className="relative flex flex-col bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-4 sm:p-5 hover:shadow-md hover:border-green-300 dark:hover:border-green-700 hover:ring-2 hover:ring-green-200 dark:hover:ring-green-900 focus-within:ring-2 focus-within:ring-green-500 transition-all">

                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3 flex-1 min-w-0">

                    {/* Rank badge */}
                    <div aria-label={`Partner rank ${idx + 1}`} className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold shrink-0 mt-0.5
                      ${idx === 0 ? 'bg-amber-100 dark:bg-amber-900/50 text-amber-700 dark:text-amber-300' :
                        idx === 1 ? 'bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300' :
                        idx === 2 ? 'bg-violet-100 dark:bg-violet-900 text-violet-700 dark:text-violet-300' :
                        'bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400'}`}>
                      #{idx + 1}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2"><CompanyImage name={r.company} imageUrl={r.company_image_url} className="w-9 h-9 rounded-lg" /><p className="text-sm font-semibold text-gray-900 dark:text-white wrap-anywhere">{r.company}</p></div>
                      <p className="mt-2 text-[10px] font-semibold text-green-700 dark:text-green-400">Top suggested position</p>
                      <p className="text-xs text-gray-600 dark:text-gray-300">{r.position}</p>
                      <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">{r.address}</p>
                    </div>
                  </div>

                  {/* Score column */}
                  <div className="relative z-10 max-w-24 text-right shrink-0">
                    {sortMode === 'combined' ? (
                      <>
                        <p className={`text-lg font-bold ${matchColor(r.combined)}`}>{r.combined}%</p>
                        <p className="text-xs text-gray-500 dark:text-gray-400"><ScoreLabel label="Best position match" /></p>
                      </>
                    ) : sortMode === 'distance' && r.distKm != null ? (
                      <>
                        <p className="text-lg font-bold text-blue-600 dark:text-blue-400">{r.distKm.toFixed(1)} km</p>
                        <p className="text-xs text-gray-400 dark:text-gray-500">straight-line</p>
                      </>
                    ) : (
                      <>
                        <p className={`text-lg font-bold ${matchColor(r.match)}`}>{r.match}%</p>
                        <p className="text-xs text-gray-500 dark:text-gray-400"><ScoreLabel label="Best position match" /></p>
                      </>
                    )}
                  </div>
                </div>

                {/* A small skills preview; full requirements live in company details. */}
                <div className="flex items-center gap-1.5 mt-4 flex-wrap">
                  {r.tags.slice(0, 3).map(tag => (
                    <span key={tag} className="max-w-full text-xs px-2.5 py-1 rounded-lg wrap-anywhere bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300">
                      {tag}
                    </span>
                  ))}
                  {r.tags.length > 3 && <span className="text-xs text-gray-500 dark:text-gray-400">+{r.tags.length - 3} more</span>}
                </div>

                <div className="flex items-center gap-2 mt-4 flex-wrap">
                  <span className="text-xs text-gray-500 dark:text-gray-400">{r.suggestedPositionCount} suggested position{r.suggestedPositionCount !== 1 ? 's' : ''}</span>
                  {r.distKm != null && sortMode !== 'distance' && (
                    <span className={`text-xs px-2.5 py-1 rounded-full font-medium flex items-center gap-1 ${distBadgeColor(r.distKm)}`}>
                      <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
                      {r.distKm.toFixed(1)} km straight-line
                    </span>
                  )}

                  <span className="ml-auto text-xs text-gray-400 dark:text-gray-500 shrink-0">
                    Top role: {r.slots} slot{r.slots !== 1 ? 's' : ''}
                  </span>
                </div>

                {/* Score bar */}
                <div className="mt-3 h-1.5 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
                  {(() => {
                    const pct = sortMode === 'combined' ? r.combined
                              : sortMode === 'distance' && r.distKm != null ? r.proximityPct
                              : r.match
                    const col = sortMode === 'distance' ? 'bg-blue-500'
                              : pct >= 80 ? 'bg-green-500' : pct >= 60 ? 'bg-amber-500' : 'bg-gray-400'
                    return <div className={`h-full rounded-full transition-all duration-700 ease-out ${col}`}
                      style={{ width: animated ? `${pct}%` : '0%' }} />
                  })()}
                </div>

                {/* Sub-scores if combined */}
                {sortMode === 'combined' && (
                  <div className="relative z-10 mt-2 flex flex-wrap items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                    <span className="text-green-600 dark:text-green-400 font-medium"><ScoreLabel label="Category fit" /> {Math.round(r.category_score_component ?? 0)}%</span>
                    <span>· <ScoreLabel label="NLP fit" /> {Math.round(r.nlp_score_component ?? 0)}%</span>
                    <span>· <ScoreLabel label="Location fit" /> {Math.round(r.location_score_component ?? 0)}%</span>
                    {r.distKm != null && <span>· {r.distKm.toFixed(1)} km straight-line</span>}
                    <span className="text-gray-400">· {r.model_used || 'fallback'} model</span>
                  </div>
                )}
                <div className="mt-auto pt-3">
                  <button type="button" onClick={() => setCompanySelection(r.company_id != null ? { companyId: r.company_id } : { positionId: r.position_id })} aria-label={`View partner details for ${r.company}, ${r.position}`} aria-haspopup="dialog"
                    className="min-h-10 text-xs font-semibold text-green-700 dark:text-green-400 after:absolute after:inset-0 after:rounded-2xl focus-visible:outline-none">View partner details <span aria-hidden="true">→</span></button>
                </div>
              </article>
            ))}
          </div>
          )}
        </div>

      </section>

      {companySelection && <StudentCompanyDetails {...companySelection} onClose={() => setCompanySelection(null)} />}

    </div>
  )
}
