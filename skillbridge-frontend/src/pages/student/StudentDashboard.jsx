// src/pages/student/StudentDashboard.jsx
//
// BENTO GRID — wired to GET /api/students/me/ (Week 4)
//   - Replaces mock STUDENT constant with real API data
//   - hasTakenAssessment now comes from API has_submitted field
//   - retakeAllowed now comes from API retake_allowed field
//   - Shows a loading skeleton while the API call is in flight
//   - studentPin still read from localStorage (set during profile setup)

import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import NavBar from '../../components/NavBar'
import { useApi } from '../../hooks/useApi'

// Read the user object saved by the login response
// This lets pages render instantly without a skeleton on every navigation.
function getCachedUser() {
  try { return JSON.parse(localStorage.getItem('sb-user')) } catch { return null }
}

// ================================================================
// Week 5: these will come from GET /api/students/me/results/
// Until assessment is built, hasTakenAssessment is false so the
// locked state renders instead. These are left as empty [] so
// the hasTakenAssessment===true branch doesn't crash if triggered.
// ================================================================
const SKILL_SCORES  = []   // [{ label, pct }]
const ALL_COMPANIES = []   // [{ id, name, position, match, address, lat, lng }]
const TOP_MATCHES   = []   // top 3 by match score
const BAR_COLORS    = ['bg-green-500', 'bg-blue-500', 'bg-violet-500', 'bg-amber-500', 'bg-rose-500']
// ================================================================


// ── Haversine distance ────────────────────────────────────────────
function haversineKm(lat1, lng1, lat2, lng2) {
  const R = 6371, dLat = (lat2 - lat1) * Math.PI / 180, dLng = (lng2 - lng1) * Math.PI / 180
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

// ── Leaflet singleton ─────────────────────────────────────────────
let _leafletPromise = null
function loadLeaflet() {
  if (_leafletPromise) return _leafletPromise
  _leafletPromise = new Promise(resolve => {
    if (window.L) { resolve(window.L); return }
    const link = document.createElement('link')
    link.rel = 'stylesheet'
    link.href = 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.css'
    document.head.appendChild(link)
    const script = document.createElement('script')
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.js'
    script.onload = () => resolve(window.L)
    document.head.appendChild(script)
  })
  return _leafletPromise
}

function makeCompanyIcon(L, name, isTopMatch = false) {
  const pinFill = isTopMatch ? '#f59e0b' : '#16a34a'
  const labelBg = isTopMatch ? '#f59e0b' : '#111827'

  return L.divIcon({
    className: '', iconSize: [28, 36], iconAnchor: [14, 36], popupAnchor: [0, -42],
    html: `
      <div class="group relative flex flex-col justify-end items-center cursor-pointer select-none"
           style="position:relative;z-index:${isTopMatch ? 9999 : 100}">
        <div style="
          position:absolute;bottom:40px;white-space:nowrap;
          background:${labelBg};color:white;
          font-size:10px;font-weight:700;font-family:system-ui,sans-serif;
          padding:3px 8px;border-radius:6px;box-shadow:0 2px 6px rgba(0,0,0,0.35);
          pointer-events:none;transition:all .18s;
          transform:translateX(-50%);left:50%;
        ">
          ${isTopMatch ? '⭐ ' : ''}${name}
          <div style="position:absolute;bottom:-5px;left:50%;transform:translateX(-50%);
            width:0;height:0;border-left:5px solid transparent;border-right:5px solid transparent;
            border-top:6px solid ${labelBg}"></div>
        </div>
        <div style="transition:transform .18s" class="group-hover:scale-110">
          <svg xmlns="http://www.w3.org/2000/svg" width="${isTopMatch ? 32 : 26}" height="${isTopMatch ? 40 : 34}" viewBox="0 0 28 36" style="filter:drop-shadow(0 2px 4px rgba(0,0,0,0.4));display:block">
            <path fill="${pinFill}" stroke="white" stroke-width="2" d="M14 1C7.4 1 2 6.4 2 13c0 9.5 12 23 12 23S26 22.5 26 13C26 6.4 20.6 1 14 1z"/>
            <circle fill="white" cx="14" cy="13" r="5"/>
          </svg>
        </div>
      </div>`,
  })
}

function makeStudentIcon(L) {
  return L.divIcon({
    className: '', iconSize: [32, 40], iconAnchor: [16, 40], popupAnchor: [0, -44],
    html: `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="40" viewBox="0 0 32 40">
      <path fill="#2563eb" stroke="white" stroke-width="2.5"
        d="M16 1C8.8 1 3 6.8 3 14c0 10.5 13 26 13 26S29 24.5 29 14C29 6.8 23.2 1 16 1z"/>
      <circle fill="white" cx="16" cy="14" r="7"/>
      <text x="16" y="18" text-anchor="middle" fill="#2563eb" font-size="8" font-weight="700" font-family="sans-serif">YOU</text>
    </svg>`,
  })
}

// ════════════════════════════════════════════════════════════════
// NearbyMap — fills its container height, no fixed px height
// ════════════════════════════════════════════════════════════════
function NearbyMap({ companies, studentPin }) {
  const elRef  = useRef(null)
  const mapRef = useRef(null)

  useEffect(() => {
    let alive = true
    loadLeaflet().then(L => {
      if (!alive || !elRef.current || mapRef.current) return

      const map = L.map(elRef.current).setView([7.3072, 125.6839], 11)
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© <a href="https://openstreetmap.org">OpenStreetMap</a>',
        maxZoom: 19,
      }).addTo(map)
      map.zoomControl.setPosition('bottomright')
      setTimeout(() => map.invalidateSize(), 150)

      const allMarkers = []

      // Company pins — add in reverse so top match (highest rank) renders last = on top
      const companiesWithIdx = companies.map((co, idx) => ({ co, idx }))
      ;[...companiesWithIdx].reverse().forEach(({ co, idx }) => {
        if (co.lat == null) return
        const isTopMatch = idx === 0
        const distTxt = studentPin
          ? `<span style="color:#2563eb;font-weight:600">${haversineKm(studentPin.lat, studentPin.lng, co.lat, co.lng).toFixed(1)} km away</span>`
          : ''
        const mk = L.marker([co.lat, co.lng], {
          icon: makeCompanyIcon(L, co.name, isTopMatch),
          zIndexOffset: isTopMatch ? 1000 : idx * -10,
        })
          .addTo(map)
          .bindPopup(`
            <div style="min-width:150px;font-family:system-ui,sans-serif;line-height:1.4">
              <p style="font-weight:700;font-size:13px;margin:0 0 2px;color:#111827">${co.name}</p>
              <p style="font-size:11px;color:#6b7280;margin:0 0 3px">${co.position}</p>
              <div style="display:flex;gap:8px;font-size:11px;margin:0">
                <span style="color:#16a34a;font-weight:600">${co.match}% match</span>
                ${distTxt ? '· ' + distTxt : ''}
              </div>
            </div>`)
        allMarkers.push(mk)
      })

      if (studentPin) {
        const mk = L.marker([studentPin.lat, studentPin.lng], { icon: makeStudentIcon(L) })
          .addTo(map)
          .bindPopup(`<div style="font-family:system-ui,sans-serif;font-size:12px;font-weight:600;color:#2563eb">Your location</div>`)
        allMarkers.push(mk)
      }

      if (allMarkers.length > 1) {
        map.fitBounds(L.featureGroup(allMarkers).getBounds().pad(0.22))
      } else if (allMarkers.length === 1) {
        map.setView(allMarkers[0].getLatLng(), 13)
      }

      mapRef.current = map
    })
    return () => {
      alive = false
      mapRef.current?.remove()
      mapRef.current = null
    }
  }, []) // intentional

  // Fill 100% of parent — parent must have an explicit height or use flex-1
  return <div ref={elRef} className="w-full h-full rounded-xl overflow-hidden" style={{ isolation: 'isolate' }} />
}

// ════════════════════════════════════════════════════════════════
// LOADING SKELETON — shown while GET /api/students/me/ is in flight
// ════════════════════════════════════════════════════════════════
function DashboardSkeleton() {
  const tile = 'bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-2xl animate-pulse'
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      <div className="h-14 bg-white dark:bg-gray-900 border-b border-gray-100 dark:border-gray-800" />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className={`${tile} px-5 py-4 sm:col-span-2 h-16`} />
          <div className={`${tile} p-5 h-36`} />
          <div className={`${tile} p-5 h-36`} />
          <div className={`${tile} p-5 sm:col-span-2 h-48`} />
          <div className={`${tile} sm:col-span-2 h-72`} />
        </div>
      </main>
    </div>
  )
}

// ════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ════════════════════════════════════════════════════════════════
export default function StudentDashboard() {
  const navigate = useNavigate()

  // ── Real API call (instant via cached sb-user) ────────────────
  // initialData = user object saved at login → renders with no skeleton
  // API refreshes in background to get has_submitted + retake_allowed
  const { data: student } = useApi('/api/students/me/', { initialData: getCachedUser() })


  // ── Derived display values (safe fallbacks if API is slow/offline) ──
  const firstName       = student?.name?.split(' ')[0] ?? 'Student'
  const displayName     = student?.name     ?? 'Student'
  const displayCourse   = student?.course   ?? ''
  const displayId       = student?.school_id ?? ''
  const photoUrl        = student?.photo_url ?? null
  const hasTakenAssessment = student?.has_submitted ?? false
  const retakeAllowed   = student?.retake_allowed  ?? false

  // ── NavBar student prop (matches NavBar expected shape) ────────
  const navStudent = {
    name:      displayName,
    initials:  displayName.split(' ').map(n => n[0]).slice(0, 2).join(''),
    studentId: displayId,
    course:    displayCourse,
    photoUrl:  photoUrl,
  }

  // ── Student pin (still from localStorage) ─────────────────────
  const studentPin = (() => {
    try { return JSON.parse(localStorage.getItem('sb_pin_location')) } catch { return null }
  })()

  const enrichedCompanies = studentPin
    ? ALL_COMPANIES
        .map(c => ({ ...c, distKm: haversineKm(studentPin.lat, studentPin.lng, c.lat, c.lng) }))
        .sort((a, b) => a.distKm - b.distKm)
    : ALL_COMPANIES

  const nearestThree = enrichedCompanies.slice(0, 3)

  const hour = new Date().getHours()
  const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening'

  // ── Bento tile base style ─────────────────────────────────────
  const tile = 'bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-2xl'


  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">

      {/*
        ── Bento grid CSS ───────────────────────────────────────
        Named areas only kick in at lg (1024px+).
        Below that, sm uses col-span utilities; mobile stacks.

        Desktop layout:
          "greeting  greeting  status "
          "skills    matches   map    "
          "skills    nearest   map    "

        The map tile spans rows 2–3 on desktop, making it tall
        enough to show the Leaflet map without scrolling.
      */}
      <style>{`
        @media (min-width: 1024px) {
          .sb-bento {
            grid-template-columns: 1fr 1fr 1.6fr;
            grid-template-rows: auto 1fr 1fr;
            grid-template-areas:
              "greeting greeting status "
              "matches  skills   map    "
              "nearest  skills   map    ";
          }
          .sb-greeting { grid-area: greeting; }
          .sb-status   { grid-area: status;   }
          .sb-skills   { grid-area: skills;   }
          .sb-matches  { grid-area: matches;  }
          .sb-map      { grid-area: map;      }
          .sb-nearest  { grid-area: nearest;  }
        }
      `}</style>

      <NavBar student={navStudent} />

      {/* ── Retake Available Banner ── */}
      {retakeAllowed && hasTakenAssessment && (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 pt-5">
          <div className="bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800 rounded-2xl px-5 py-4 flex items-center justify-between gap-4 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center shrink-0 shadow">
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M23 4v6h-6"/><path d="M1 20v-6h6"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>
                </svg>
              </div>
              <div>
                <p className="text-sm font-semibold text-blue-900 dark:text-blue-100">Retake Assessment Available</p>
                <p className="text-xs text-blue-700 dark:text-blue-300 mt-0.5">Your instructor has allowed you to retake the assessment. Your previous answers will be cleared.</p>
              </div>
            </div>
            <button
              onClick={() => navigate('/student/assessment')}
              className="shrink-0 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white text-xs font-semibold px-4 py-2.5 rounded-xl transition-colors whitespace-nowrap"
            >
              Retake now
            </button>
          </div>
        </div>
      )}

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
        {/*
          HTML order optimised for mobile reading:
            greeting → status → matches → skills → map → nearest
          On desktop, named grid-areas reposition everything correctly.
        */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sb-bento">

          {/* ── GREETING ─────────────────────────────────────── */}
          <div className={`sb-greeting ${tile} px-5 py-4 sm:col-span-2 flex items-center justify-between gap-4`}>
            <div>
              <h1 className="text-lg sm:text-xl font-bold text-gray-900 dark:text-white">
                {greeting}, {firstName} 👋
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
                Assessment done
              </span>
            )}
          </div>

          {/* ── STATUS ───────────────────────────────────────── */}
          <div className="sb-status">
            {!hasTakenAssessment ? (
              <div className="h-full bg-green-600 rounded-2xl p-5 flex flex-col justify-between gap-4 min-h-140px">
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-green-300 animate-pulse inline-block" />
                    <span className="text-xs text-green-200 font-medium">Assessment open</span>
                  </div>
                  <p className="text-white font-semibold text-sm">Take your skills assessment</p>
                  <p className="text-green-200 text-xs mt-1 leading-relaxed">
                    Unlock your skill profile and company matches.
                  </p>
                </div>
                <button
                  onClick={() => navigate('/student/assessment')}
                  className="bg-white text-green-700 font-semibold text-sm px-4 py-2.5 rounded-xl hover:bg-green-50 active:bg-green-100 transition-colors text-center"
                >
                  Start now →
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
                    <p className="text-sm font-semibold text-green-800 dark:text-green-200">Assessment completed</p>
                    <p className="text-xs text-green-600 dark:text-green-400 mt-0.5">Skill profile and matches are ready.</p>
                  </div>
                </div>
                <button
                  onClick={() => navigate('/student/results')}
                  className="bg-green-600 text-white font-semibold text-sm px-4 py-2.5 rounded-xl hover:bg-green-700 active:bg-green-800 transition-colors text-center"
                >
                  View full results →
                </button>
              </div>
            )}
          </div>

          {/* ── TOP MATCHES ──────────────────────────────────── */}
          <div className={`sb-matches ${tile} p-5`}>
            <p className="text-sm font-semibold text-gray-900 dark:text-white mb-3">Top matches</p>
            {hasTakenAssessment ? (
              <div className="flex flex-col gap-2">
                {TOP_MATCHES.map(m => (
                  <div key={m.id} className="flex items-center justify-between bg-gray-50 dark:bg-gray-800 rounded-xl px-3 py-2.5">
                    <div className="min-w-0 mr-2">
                      <p className="text-xs font-medium text-gray-900 dark:text-white truncate">{m.name}</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{m.position}</p>
                    </div>
                    <span className={`text-xs font-semibold shrink-0 ${
                      m.match >= 80 ? 'text-green-600 dark:text-green-400'
                      : m.match >= 60 ? 'text-amber-600 dark:text-amber-400'
                      : 'text-gray-500'}`}>
                      {m.match}%
                    </span>
                  </div>
                ))}
                <button
                  onClick={() => navigate('/student/results')}
                  className="mt-1 text-xs text-green-600 dark:text-green-400 hover:underline text-center"
                >
                  See all matches →
                </button>
              </div>
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
                <p className="text-xs text-gray-400 dark:text-gray-600 text-center mt-1">Unlocks after assessment</p>
              </div>
            )}
          </div>

          {/* ── SKILL PROFILE ────────────────────────────────── */}
          {/* Spans 2 rows on desktop via grid-area "skills" */}
          <div className={`sb-skills ${tile} p-5 sm:col-span-2`}>
            <div className="flex items-center justify-between mb-4">
              <p className="text-sm font-semibold text-gray-900 dark:text-white">Skill profile</p>
              {hasTakenAssessment && (
                <span className="text-xs text-gray-400 dark:text-gray-500">Assessment result</span>
              )}
            </div>
            {hasTakenAssessment ? (
              <>
                {/* Summary score badge */}
                <div className="flex items-center gap-3 mb-4 p-3 bg-green-50 dark:bg-green-950 rounded-xl border border-green-100 dark:border-green-900">
                  <div className="w-9 h-9 rounded-full bg-green-600 flex items-center justify-center shrink-0">
                    <span className="text-xs font-bold text-white">
                      {Math.round(SKILL_SCORES.reduce((a, s) => a + s.pct, 0) / SKILL_SCORES.length)}
                    </span>
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-green-800 dark:text-green-200">Overall skill score</p>
                    <p className="text-xs text-green-600 dark:text-green-400">Top skill: {SKILL_SCORES[0].label}</p>
                  </div>
                </div>
                {/* 2-column bar grid on desktop */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-x-5 gap-y-3">
                  {SKILL_SCORES.map((s, i) => (
                    <div key={s.label}>
                      <div className="flex justify-between mb-1">
                        <span className="text-xs text-gray-600 dark:text-gray-400">{s.label}</span>
                        <span className="text-xs font-medium text-gray-900 dark:text-white">{s.pct}%</span>
                      </div>
                      <div className="h-1.5 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full ${BAR_COLORS[i % BAR_COLORS.length]}`}
                          style={{ width: `${s.pct}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <div className="flex flex-col gap-3">
                {['Web Dev', 'Networking', 'Database', 'Design'].map(label => (
                  <div key={label}>
                    <div className="flex justify-between mb-1">
                      <span className="text-xs text-gray-300 dark:text-gray-700">{label}</span>
                      <span className="text-xs text-gray-300 dark:text-gray-700">--%</span>
                    </div>
                    <div className="h-1.5 bg-gray-100 dark:bg-gray-800 rounded-full" />
                  </div>
                ))}
                <p className="text-xs text-gray-400 dark:text-gray-600 text-center mt-2">Unlocks after assessment</p>
              </div>
            )}
          </div>

          {/* ── MAP ──────────────────────────────────────────── */}
          {/*
            Spans rows 2–3 on desktop (grid-area "map") — this is the
            tall bento tile. On tablet/mobile it's full-width with a
            fixed height so the map renders correctly.
          */}
          <div className={`sb-map ${tile} overflow-hidden flex flex-col sm:col-span-2`}>
            {/* Tile header */}
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-gray-100 dark:border-gray-800 shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-lg bg-blue-50 dark:bg-blue-950 flex items-center justify-center shrink-0">
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#2563eb" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polygon points="3 6 9 3 15 6 21 3 21 18 15 21 9 18 3 21"/>
                    <line x1="9" y1="3" x2="9" y2="18"/><line x1="15" y1="6" x2="15" y2="21"/>
                  </svg>
                </div>
                <div>
                  <p className="text-sm font-semibold text-gray-900 dark:text-white leading-tight">Nearby Companies</p>
                  {hasTakenAssessment && studentPin && (
                    <p className="text-xs text-gray-400 dark:text-gray-500 leading-tight">
                      Closest: {enrichedCompanies[0].name} · {enrichedCompanies[0].distKm.toFixed(1)} km
                    </p>
                  )}
                </div>
              </div>
              {studentPin && hasTakenAssessment && (
                <span className="text-xs font-medium text-blue-600 dark:text-blue-400">sorted by distance</span>
              )}
            </div>

            {hasTakenAssessment ? (
              /* ── Active map state ── */
              <div className="flex-1 flex flex-col p-3 gap-2.5 min-h-0">

                {/* No-pin prompt */}
                {!studentPin && (
                  <div className="flex items-center justify-between gap-3 bg-amber-50 dark:bg-amber-950 border border-amber-100 dark:border-amber-900 rounded-xl px-4 py-2.5 shrink-0">
                    <p className="text-xs text-amber-700 dark:text-amber-300">
                      Pin your location to see distances to each company.
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
                      Partner companies
                    </div>
                  </div>
                )}

                {/*
                  Map container: on desktop the tile stretches via grid,
                  so flex-1 + min-h-0 lets the map fill the remaining height.
                  On mobile/tablet it falls back to a fixed min-height.
                */}
                <div className="flex-1 min-h-0" style={{ minHeight: 320 }}>
                  <NearbyMap companies={enrichedCompanies} studentPin={studentPin} />
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
                  Complete your assessment to unlock the nearby companies map.
                </p>
              </div>
            )}
          </div>

          {/* ── NEAREST / QUICK ACTIONS ──────────────────────── */}
          <div className={`sb-nearest ${tile} p-5 sm:col-span-2`}>
            {hasTakenAssessment && studentPin ? (
              /* Nearest 3 companies */
              <>
                <p className="text-sm font-semibold text-gray-900 dark:text-white mb-3">Nearest to you</p>
                <div className="flex flex-col gap-1.5">
                  {nearestThree.map(c => (
                    <div key={c.id} className="flex items-center justify-between bg-gray-50 dark:bg-gray-800 rounded-xl px-3 py-2">
                      <div className="min-w-0 mr-2">
                        <p className="text-xs font-medium text-gray-900 dark:text-white truncate">{c.name}</p>
                        <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{c.position}</p>
                      </div>
                      <div className="flex items-center gap-2.5 shrink-0">
                        <span className="text-xs text-blue-600 dark:text-blue-400 font-medium">
                          {c.distKm.toFixed(1)} km
                        </span>
                        <span className={`text-xs font-semibold ${
                          c.match >= 80 ? 'text-green-600 dark:text-green-400' : 'text-amber-600 dark:text-amber-400'}`}>
                          {c.match}%
                        </span>
                      </div>
                    </div>
                  ))}
                  <button
                    onClick={() => navigate('/student/results')}
                    className="mt-1 text-xs text-green-600 dark:text-green-400 hover:underline text-center"
                  >
                    See full results with combined scoring →
                  </button>
                </div>
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
                      <p className="text-xs text-gray-500 dark:text-gray-400">See distances to partner companies</p>
                    </div>
                  </button>
                  <button
                    onClick={() => navigate('/student/results')}
                    className="flex items-center gap-3 bg-gray-50 dark:bg-gray-800 rounded-xl px-3 py-2.5 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors text-left w-full"
                  >
                    <span className="text-base">📊</span>
                    <div>
                      <p className="text-xs font-medium text-gray-900 dark:text-white">View all matches</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">Full results with combined scoring</p>
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
                      num: '1', label: 'Take assessment',
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
                      sub: 'See top companies matched to you',
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
          </div>

        </div>
      </main>
    </div>
  )
}