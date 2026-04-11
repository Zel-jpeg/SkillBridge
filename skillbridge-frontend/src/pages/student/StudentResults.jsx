// src/pages/student/StudentResults.jsx
//
// Shows skill profile + answer review + company matches.
// Answer Review section reads router state passed by StudentAssessment on submit:
//   location.state.reviewData = { questions, answers }
// If state is absent (e.g. student navigated directly), the section is hidden.
//
// If student has pinned their location (sb_pin_location in localStorage),
// also shows:
//   - A map with the student marker (blue) + all company markers (green)
//   - Distance in km on each company card
//   - Sort modes: Best Match | Nearest | Combined (70% skill + 30% proximity)
//
// TODO Week 5: replace DUMMY_* with real API data
//   GET /api/students/me/results/
//   returns { skill_scores, recommendations (with lat/lng) }

import { useState, useEffect, useRef } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import NavBar from '../../components/NavBar'
import { useApi } from '../../hooks/useApi'

function getCachedUser() {
  try { return JSON.parse(localStorage.getItem('sb-user')) } catch { return null }
}

// ================================================================
// DUMMY DATA — replace with API in Week 5
// ================================================================

const SKILL_SCORES = [
  { category: 'Web Development', score: 82, color: 'bg-green-500',  text: 'text-green-600 dark:text-green-400'  },
  { category: 'Database',        score: 70, color: 'bg-blue-500',   text: 'text-blue-600 dark:text-blue-400'   },
  { category: 'Design',          score: 60, color: 'bg-violet-500', text: 'text-violet-600 dark:text-violet-400'},
  { category: 'Networking',      score: 55, color: 'bg-amber-500',  text: 'text-amber-600 dark:text-amber-400' },
  { category: 'Backend',         score: 48, color: 'bg-rose-500',   text: 'text-rose-600 dark:text-rose-400'   },
]

// lat/lng added so distance can be computed from student's pinned location
const RECOMMENDATIONS = [
  { id: 1, company: 'DNSC ICT Office',       position: 'Web Developer Intern',     match: 91, slots: 3, address: 'Panabo City, Davao del Norte',  tags: ['Web Development', 'Database'],    lat: 7.3167, lng: 125.6847 },
  { id: 2, company: 'Globe Telecom Panabo',  position: 'Network Trainee',          match: 78, slots: 2, address: 'Panabo City, Davao del Norte',  tags: ['Networking', 'Backend'],           lat: 7.3100, lng: 125.6860 },
  { id: 3, company: 'LGU Panabo City',       position: 'IT Support Intern',        match: 72, slots: 1, address: 'Panabo City, Davao del Norte',  tags: ['Web Development', 'Networking'],   lat: 7.3072, lng: 125.6839 },
  { id: 4, company: 'DepEd Division Office', position: 'Systems Assistant',        match: 65, slots: 2, address: 'Tagum City, Davao del Norte',   tags: ['Database', 'Backend'],             lat: 7.4482, lng: 125.8147 },
  { id: 5, company: 'BDO Unibank Panabo',    position: 'IT Operations Trainee',    match: 58, slots: 1, address: 'Panabo City, Davao del Norte',  tags: ['Networking', 'Database'],          lat: 7.3055, lng: 125.6825 },
]
// ================================================================

// ── Haversine distance ────────────────────────────────────────────
function haversineKm(lat1, lng1, lat2, lng2) {
  const R    = 6371
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLng = (lng2 - lng1) * Math.PI / 180
  const a    = Math.sin(dLat / 2) ** 2
    + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

// Proximity score: 0–100 where 0km = 100, ≥200km = 0
function proximityScore(distKm) { return Math.max(0, Math.round(100 - (distKm / 200) * 100)) }

// Combined: 70% skill match + 30% proximity
function combinedScore(skillMatch, distKm) {
  return Math.round(skillMatch * 0.7 + proximityScore(distKm) * 0.3)
}

// ────────────────────────────────────────────────────────────────
// Leaflet singleton
// ────────────────────────────────────────────────────────────────
let _leafletPromise = null
function loadLeaflet() {
  if (_leafletPromise) return _leafletPromise
  _leafletPromise = new Promise(resolve => {
    if (window.L) { resolve(window.L); return }
    const link = document.createElement('link')
    link.rel  = 'stylesheet'
    link.href = 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.css'
    document.head.appendChild(link)
    const script = document.createElement('script')
    script.src   = 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.js'
    script.onload = () => resolve(window.L)
    document.head.appendChild(script)
  })
  return _leafletPromise
}

function makeCompanyIcon(L, name, isTopMatch = false) {
  const pinFill   = isTopMatch ? '#f59e0b' : '#16a34a'
  const labelBg   = isTopMatch ? '#f59e0b' : '#111827'
  const zClass    = isTopMatch ? 'z-[9999]' : 'z-[100]'

  return L.divIcon({
    className: '', iconSize: [28, 36], iconAnchor: [14, 36], popupAnchor: [0, -42],
    html: `
      <div class="group relative flex flex-col justify-end items-center cursor-pointer select-none ${zClass}" style="position:relative;z-index:${isTopMatch ? 9999 : 100}">
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
        <div style="transition:transform .18s" class="group-hover:scale-125">
          <svg xmlns="http://www.w3.org/2000/svg" width="${isTopMatch ? 32 : 26}" height="${isTopMatch ? 40 : 34}" viewBox="0 0 28 36" style="filter:drop-shadow(0 3px 5px rgba(0,0,0,0.4));display:block">
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
      <text x="16" y="18" text-anchor="middle" fill="#2563eb" font-size="9" font-weight="700" font-family="sans-serif">YOU</text>
    </svg>`,
  })
}

// ════════════════════════════════════════════════════════════════
// ResultsMap — student (blue) + company pins (green) on one map
// ════════════════════════════════════════════════════════════════
function ResultsMap({ companies, studentPin }) {
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
      setTimeout(() => map.invalidateSize(), 300)

      const allMarkers = []

      // Company pins — add in reverse so top match renders last (on top)
      const companiesWithIdx = companies.map((co, idx) => ({ co, idx }))
      ;[...companiesWithIdx].reverse().forEach(({ co, idx }) => {
        if (co.lat == null) return
        const isTopMatch = idx === 0
        const dist    = studentPin ? haversineKm(studentPin.lat, studentPin.lng, co.lat, co.lng) : null
        const distTxt = dist != null ? `<span style="color:#2563eb;font-weight:600">${dist.toFixed(1)} km away</span>` : ''
        const mk = L.marker([co.lat, co.lng], {
          icon: makeCompanyIcon(L, co.company, isTopMatch),
          zIndexOffset: isTopMatch ? 1000 : idx * -10,
        })
          .addTo(map)
          .bindPopup(`
            <div style="min-width:160px;font-family:system-ui,sans-serif;line-height:1.4">
              <p style="font-weight:700;font-size:13px;margin:0 0 2px;color:#111827">${isTopMatch ? '⭐ ' : ''}${co.company}</p>
              <p style="font-size:11px;color:#6b7280;margin:0 0 3px">${co.position}</p>
              <p style="font-size:11px;margin:0"><span style="color:#16a34a;font-weight:600">${co.match}% skill match</span>${dist != null ? ' · ' + distTxt : ''}</p>
            </div>`)
        allMarkers.push(mk)
      })

      // Student pin
      if (studentPin) {
        const mk = L.marker([studentPin.lat, studentPin.lng], { icon: makeStudentIcon(L) })
          .addTo(map)
          .bindPopup(`<div style="font-family:system-ui,sans-serif;font-size:12px;font-weight:600;color:#2563eb">Your location</div>`)
        allMarkers.push(mk)
      }

      // Fit all markers
      if (allMarkers.length > 1) {
        map.fitBounds(L.featureGroup(allMarkers).getBounds().pad(0.22))
      } else if (allMarkers.length === 1) {
        map.setView(allMarkers[0].getLatLng(), 13)
      }

      mapRef.current = map

      // ── Resize observer: force Leaflet to recalculate when container changes ──
      if (typeof ResizeObserver !== 'undefined') {
        const ro = new ResizeObserver(() => map.invalidateSize())
        ro.observe(elRef.current)
        mapRef.current._resizeObserver = ro
      }
    })
    return () => {
      alive = false
      mapRef.current?._resizeObserver?.disconnect()
      mapRef.current?.remove()
      mapRef.current = null
    }
  }, []) // intentional

  return (
    <div className="w-full relative" style={{ paddingBottom: 'clamp(280px, 45vw, 460px)', minHeight: 280 }}>
      <div ref={elRef} className="absolute inset-0 rounded-2xl overflow-hidden" />
    </div>
  )
}

// ── Helpers ───────────────────────────────────────────────────────
function matchColor(pct) {
  if (pct >= 80) return 'text-green-600 dark:text-green-400'
  if (pct >= 60) return 'text-amber-600 dark:text-amber-400'
  return 'text-gray-400 dark:text-gray-500'
}
function matchBadge(pct) {
  if (pct >= 80) return 'bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300'
  if (pct >= 60) return 'bg-amber-100 dark:bg-amber-900 text-amber-700 dark:text-amber-300'
  return 'bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400'
}
function distBadgeColor(km) {
  if (km < 5)  return 'bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300'
  if (km < 20) return 'bg-sky-100 dark:bg-sky-900 text-sky-700 dark:text-sky-300'
  return 'bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400'
}

const ChevronDown = ({ open }) => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"
    className={`transition-transform duration-200 ${open ? 'rotate-180' : ''}`}>
    <path d="M6 9l6 6 6-6"/>
  </svg>
)

// ════════════════════════════════════════════════════════════════
// AnswerReview — collapsible accordion with pagination + filters.
// Scales to 100+ questions: 10 per page, category filter, result filter.
// Persisted via localStorage so student can return after navigating away.
// ════════════════════════════════════════════════════════════════
const REVIEW_PAGE_SIZE = 10

function AnswerReview({ questions, answers }) {
  const [open,         setOpen]         = useState(false)
  const [page,         setPage]         = useState(1)
  const [catFilter,    setCatFilter]    = useState('all')
  const [resultFilter, setResultFilter] = useState('all') // 'all' | 'wrong' | 'skipped'

  // Compute result per question
  const results = questions.map(q => {
    const chosen      = answers[q.id]
    const isCorrect   = chosen === q.correct
    const chosenText  = q.choices.find(c => c.id === chosen)?.text ?? null
    const correctText = q.choices.find(c => c.id === q.correct)?.text ?? ''
    return { ...q, chosen, isCorrect, chosenText, correctText }
  })

  const totalCorrect = results.filter(r => r.isCorrect).length
  const wrongCount   = results.filter(r => r.chosen != null && !r.isCorrect).length
  const skippedCount = results.filter(r => r.chosen == null).length
  const totalItems   = results.length
  const pct          = Math.round((totalCorrect / totalItems) * 100)

  const scoreColor = pct >= 80 ? 'text-green-600 dark:text-green-400'
                   : pct >= 60 ? 'text-amber-600 dark:text-amber-400'
                   : 'text-rose-600 dark:text-rose-400'
  const scoreBg    = pct >= 80 ? 'bg-green-50 dark:bg-green-950 border-green-200 dark:border-green-900'
                   : pct >= 60 ? 'bg-amber-50 dark:bg-amber-950 border-amber-200 dark:border-amber-900'
                   : 'bg-rose-50 dark:bg-rose-950 border-rose-200 dark:border-rose-900'

  const categories = [...new Set(results.map(r => r.skill_category))]

  // Apply filters
  const filtered = results.filter(r => {
    if (catFilter !== 'all' && r.skill_category !== catFilter) return false
    if (resultFilter === 'wrong')   return r.chosen != null && !r.isCorrect
    if (resultFilter === 'skipped') return r.chosen == null
    return true
  })

  const totalPages = Math.max(1, Math.ceil(filtered.length / REVIEW_PAGE_SIZE))
  const safePage   = Math.min(page, totalPages)
  const pageItems  = filtered.slice((safePage - 1) * REVIEW_PAGE_SIZE, safePage * REVIEW_PAGE_SIZE)

  // Reset page when filters change
  useEffect(() => { setPage(1) }, [catFilter, resultFilter])
  // Reset everything when accordion closes
  useEffect(() => { if (!open) { setPage(1); setCatFilter('all'); setResultFilter('all') } }, [open])

  return (
    <div className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-2xl shadow-sm overflow-hidden mb-8">

      {/* ── Accordion header ── */}
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between gap-4 px-5 py-4 hover:bg-gray-50 dark:hover:bg-gray-800/60 transition-colors text-left"
      >
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-8 h-8 bg-gray-100 dark:bg-gray-800 rounded-xl flex items-center justify-center shrink-0">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-gray-600 dark:text-gray-300">
              <path d="M9 11l3 3L22 4"/>
              <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>
            </svg>
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-gray-900 dark:text-white">Answer Review</p>
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
              {open
                ? `Showing ${filtered.length} of ${totalItems} question${totalItems !== 1 ? 's' : ''}`
                : 'Tap to review your answers'}
            </p>
          </div>
        </div>

        {/* Score pill + chevron */}
        <div className="flex items-center gap-2.5 shrink-0">
          <div className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border text-xs font-bold ${scoreBg} ${scoreColor}`}>
            <span>{totalCorrect}/{totalItems} correct</span>
            <span className="text-gray-300 dark:text-gray-700">·</span>
            <span>{pct}%</span>
          </div>
          <ChevronDown open={open} />
        </div>
      </button>

      {/* ── Accordion body ── */}
      {open && (
        <div className="border-t border-gray-100 dark:border-gray-800 px-5 py-4 flex flex-col gap-4">

          {/* Overall score banner */}
          <div className={`flex items-center justify-between gap-3 px-4 py-3 rounded-xl border ${scoreBg}`}>
            <div>
              <p className={`text-lg font-bold ${scoreColor}`}>{pct}%</p>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                {totalCorrect} correct · {wrongCount} wrong · {skippedCount} skipped · {totalItems} total
              </p>
            </div>
            <div className="flex-1 max-w-140px h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
              <div className={`h-full rounded-full transition-all duration-700 ease-out
                ${pct >= 80 ? 'bg-green-500' : pct >= 60 ? 'bg-amber-500' : 'bg-rose-500'}`}
                style={{ width: `${pct}%` }} />
            </div>
          </div>

          {/* ── Filters row ── */}
          <div className="flex flex-col sm:flex-row gap-2">

            {/* Category dropdown */}
            <select
              value={catFilter}
              onChange={e => setCatFilter(e.target.value)}
              className="flex-1 px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-xs text-gray-700 dark:text-gray-300 outline-none focus:border-green-500 transition-colors cursor-pointer"
            >
              <option value="all">All categories ({totalItems})</option>
              {categories.map(cat => {
                const count = results.filter(r => r.skill_category === cat).length
                return <option key={cat} value={cat}>{cat} ({count})</option>
              })}
            </select>

            {/* Result filter toggle */}
            <div className="flex gap-1 bg-gray-100 dark:bg-gray-800 p-1 rounded-xl shrink-0">
              {[
                { key: 'all',     label: 'All' },
                { key: 'wrong',   label: `Wrong (${wrongCount})` },
                { key: 'skipped', label: `Skipped (${skippedCount})` },
              ].map(({ key, label }) => (
                <button key={key}
                  onClick={() => setResultFilter(key)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap
                    ${resultFilter === key
                      ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm'
                      : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'}`}>
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* ── Empty state ── */}
          {pageItems.length === 0 && (
            <div className="py-10 text-center">
              <p className="text-2xl mb-2">
                {resultFilter === 'wrong' ? '🎉' : resultFilter === 'skipped' ? '✅' : '🔍'}
              </p>
              <p className="text-sm font-medium text-gray-500 dark:text-gray-400">
                {resultFilter === 'wrong'   ? 'No wrong answers here!' :
                 resultFilter === 'skipped' ? 'No skipped questions!' :
                 'No questions match this filter.'}
              </p>
            </div>
          )}

          {/* ── Question list (paginated) ── */}
          {pageItems.length > 0 && (
            <div className="flex flex-col gap-2.5">
              {pageItems.map(r => {
                const qNum = results.indexOf(r) + 1
                return (
                  <div key={r.id}
                    className={`rounded-xl border px-4 py-3.5
                      ${r.chosen == null
                        ? 'bg-gray-50 dark:bg-gray-800/60 border-gray-200 dark:border-gray-700'
                        : r.isCorrect
                          ? 'bg-green-50 dark:bg-green-950/50 border-green-200 dark:border-green-900'
                          : 'bg-rose-50 dark:bg-rose-950/50 border-rose-200 dark:border-rose-900'
                      }`}>

                    {/* Q number + category badge */}
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-[10px] font-bold text-gray-400 dark:text-gray-500">Q{qNum}</span>
                      <span className="text-[10px] font-medium bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 px-2 py-0.5 rounded-full">
                        {r.skill_category}
                      </span>
                    </div>

                    {/* Question text + status icon */}
                    <div className="flex items-start gap-2.5">
                      <div className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 mt-0.5
                        ${r.chosen == null ? 'bg-gray-200 dark:bg-gray-700'
                          : r.isCorrect    ? 'bg-green-500'
                          :                  'bg-rose-500'}`}>
                        {r.chosen == null ? (
                          <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round"><path d="M12 8v4M12 16h.01"/></svg>
                        ) : r.isCorrect ? (
                          <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12l5 5L20 7"/></svg>
                        ) : (
                          <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round"><path d="M18 6L6 18M6 6l12 12"/></svg>
                        )}
                      </div>
                      <p className="text-sm font-medium text-gray-800 dark:text-gray-200 leading-snug flex-1">{r.text}</p>
                    </div>

                    {/* Answer rows */}
                    <div className="mt-2.5 pl-7 flex flex-col gap-1.5">
                      {r.chosen == null ? (
                        <p className="text-xs text-gray-400 dark:text-gray-500 italic">Not answered</p>
                      ) : (
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-gray-500 dark:text-gray-400 shrink-0 w-68px">Your answer:</span>
                          <span className={`text-xs font-medium
                            ${r.isCorrect ? 'text-green-700 dark:text-green-400' : 'text-rose-700 dark:text-rose-400'}`}>
                            {r.chosenText}
                          </span>
                        </div>
                      )}
                      {!r.isCorrect && (
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-gray-500 dark:text-gray-400 shrink-0 w-68px">Correct:</span>
                          <span className="text-xs font-semibold text-green-700 dark:text-green-400">{r.correctText}</span>
                        </div>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          {/* ── Pagination ── */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between pt-1">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={safePage === 1}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium border border-gray-200 dark:border-gray-700
                  disabled:opacity-40 disabled:cursor-not-allowed
                  hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors text-gray-600 dark:text-gray-400"
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M15 18l-6-6 6-6"/></svg>
                Prev
              </button>

              <span className="text-xs text-gray-400 dark:text-gray-500">
                Page {safePage} of {totalPages} · {filtered.length} item{filtered.length !== 1 ? 's' : ''}
              </span>

              <button
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={safePage === totalPages}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium border border-gray-200 dark:border-gray-700
                  disabled:opacity-40 disabled:cursor-not-allowed
                  hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors text-gray-600 dark:text-gray-400"
              >
                Next
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M9 18l6-6-6-6"/></svg>
              </button>
            </div>
          )}

          {/* Footer note */}
          <p className="text-xs text-gray-400 dark:text-gray-500 text-center pt-1">
            Your skill profile and company matches above are based on these scores.
          </p>
        </div>
      )}
    </div>
  )
}

// ════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ════════════════════════════════════════════════════════════════
export default function StudentResults() {
  const navigate = useNavigate()
  const location = useLocation()

  // Answer review data — persisted to localStorage so it survives navigating away and back.
  // Shape: { questions: [...], answers: { [q_id]: chosen_choice_id } }
  // Priority: router state (fresh from assessment) → localStorage (returning visit)
  const REVIEW_KEY = 'sb_review_data'
  const reviewData = (() => {
    const fromState = location.state?.reviewData ?? null
    if (fromState) {
      // Fresh submission — save so student can return later and still see their review
      try { localStorage.setItem(REVIEW_KEY, JSON.stringify(fromState)) } catch {}
      return fromState
    }
    // Returning from dashboard or direct navigation — read the persisted copy
    try { return JSON.parse(localStorage.getItem(REVIEW_KEY)) } catch { return null }
  })()

  // Read student's pinned location from localStorage
  const studentPin = (() => {
    try { return JSON.parse(localStorage.getItem('sb_pin_location')) } catch { return null }
  })()

  const hasPin = studentPin != null

  // Enrich recommendations with distance + combined score
  const enriched = RECOMMENDATIONS.map(r => {
    if (hasPin) {
      const dist = haversineKm(studentPin.lat, studentPin.lng, r.lat, r.lng)
      return { ...r, distKm: dist, proximityPct: proximityScore(dist), combined: combinedScore(r.match, dist) }
    }
    return { ...r, distKm: null, proximityPct: null, combined: r.match }
  })

  // Sort mode
  const [sortMode, setSortMode] = useState('match')   // 'match' | 'distance' | 'combined'

  const sorted = [...enriched].sort((a, b) => {
    if (sortMode === 'distance') return (a.distKm ?? Infinity) - (b.distKm ?? Infinity)
    if (sortMode === 'combined') return b.combined - a.combined
    return b.match - a.match
  })

  // Animated skill bars
  const [animated, setAnimated] = useState(false)
  useEffect(() => { const t = setTimeout(() => setAnimated(true), 100); return () => clearTimeout(t) }, [])

  // ── Real API call ─────────────────────────────────────────────
  const { data: apiStudent } = useApi('/api/students/me/', { initialData: getCachedUser() })
  const displayName   = apiStudent?.name      ?? 'Student'
  const displayId     = apiStudent?.school_id ?? ''
  const displayCourse = apiStudent?.course    ?? ''
  const navStudent    = {
    name:      displayName,
    initials:  displayName.split(' ').map(n => n[0]).slice(0, 2).join(''),
    studentId: displayId,
    course:    displayCourse,
    photoUrl:  apiStudent?.photo_url ?? null,
  }

  // Mock download report
  function handleDownloadReport() {
    const reportDate = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
    const skillsTable = SKILL_SCORES.map(s => `| **${s.category}** | ${s.score}% |`).join('\n')
    const recommendations = sorted.map((r, i) => {
      const dist = r.distKm != null ? `(~${r.distKm < 10 ? r.distKm.toFixed(1) : Math.round(r.distKm)} km away)` : ''
      return `#### Recommendation ${i + 1}: ${r.company}\n- **Position:** ${r.position}\n- **Algorithm Match:** ${r.match}%\n- **Location:** ${r.address} ${dist}\n- **Available Slots:** ${r.slots}`
    }).join('\n\n')

    const text = `# DNSC SkillBridge
**Official OJT Assessment Report**

---

### Student Information
**Name:** ${displayName}
**Student ID:** ${displayId}
**Course:** ${displayCourse}
**Date of Assessment:** ${reportDate}

---

### 1. Skill Profile Summary

| Skill Category | Score |
|---|---|
${skillsTable}

---

### 2. OJT Placement Recommendations
Based on the skill profile, the system recommends the following OJT Placements in order of highest match:

${recommendations}

---

*This report is automatically generated by the SkillBridge system. Final placement decisions are subject to approval by the OJT Coordinator.*`

    const blob = new Blob([text], { type: 'text/markdown' })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.download = `OJT_Report_${displayId || 'student'}.md`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 pb-12">
      <NavBar student={navStudent} />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-8">

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
            <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white tracking-tight">Your results</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              Based on your assessment · {displayCourse} · {displayId}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button 
              onClick={handleDownloadReport}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors shadow-sm"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
              Download Report
            </button>
            {/* Retake button — only visible when instructor/admin enables retake via API */}
            {false && (
              <button onClick={() => navigate('/student/assessment')} className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-400 hover:bg-blue-200 dark:hover:bg-blue-900/60 transition-colors shadow-sm">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M23 4v6h-6"/><path d="M1 20v-6h6"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg>
                Retake Assessment
              </button>
            )}
          </div>
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
                  <p className="text-[10px] text-gray-500 dark:text-gray-400 mt-0.5">Top match highlighted per sort mode</p>
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
              <ResultsMap key={sortMode} companies={sorted} studentPin={studentPin} />
            </div>
          </div>

          {/* Skill Assessment Profile — ~35% width on desktop, sticky */}
          <div className="w-full lg:w-[35%] shrink-0 bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-2xl p-5 shadow-sm lg:sticky lg:top-6 h-fit">
            <p className="text-sm font-semibold text-gray-900 dark:text-white mb-4">Skill assessment profile</p>
            <div className="flex flex-col gap-3.5">
              {SKILL_SCORES.map(s => (
                <div key={s.category}>
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-xs text-gray-700 dark:text-gray-300 font-medium">{s.category}</span>
                    <span className={`text-xs font-bold ${s.text}`}>{s.score}%</span>
                  </div>
                  <div className="h-2 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
                    <div className={`h-full rounded-full ${s.color} transition-all duration-700 ease-out`}
                      style={{ width: animated ? `${s.score}%` : '0%' }} />
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-5 pt-4 border-t border-gray-100 dark:border-gray-800 flex items-center gap-3">
              <div className="w-8 h-8 bg-green-100 dark:bg-green-900/50 rounded-xl flex items-center justify-center shrink-0">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                  <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"
                    stroke="#16a34a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </div>
              <div>
                <p className="text-[10px] text-gray-500 dark:text-gray-400 font-semibold uppercase tracking-wide">Strongest Area</p>
                <p className="text-sm font-bold text-gray-900 dark:text-white mt-0.5">
                  {SKILL_SCORES.reduce((a, b) => a.score > b.score ? a : b).category}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* ── ANSWER REVIEW — shown after assessment; persists via localStorage so student can return ── */}
        {reviewData && (
          <AnswerReview
            questions={reviewData.questions}
            answers={reviewData.answers}
          />
        )}

        {/* ── COMPANY MATCHES — full width below ── */}
        <div className="flex flex-col gap-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-gray-900 dark:text-white">Company matches</p>
              <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">{sorted.length} positions found</p>
            </div>

            {/* Sort toggle */}
            <div className="flex items-center gap-1 bg-gray-100 dark:bg-gray-800 rounded-xl p-1 self-start sm:self-auto">
              {[
                { key: 'match',    label: 'Skill Match' },
                { key: 'distance', label: 'Nearest',    disabled: !hasPin },
                { key: 'combined', label: 'Combined',   disabled: !hasPin },
              ].map(({ key, label, disabled }) => (
                <button
                  key={key}
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
          </div>

          {/* Sort explanation banners */}
          {sortMode === 'combined' && hasPin && (
            <div className="bg-blue-50 dark:bg-blue-950 border border-blue-100 dark:border-blue-900 rounded-xl px-4 py-2.5 flex items-center gap-2">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#2563eb" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><path d="M12 8v4M12 16h.01"/></svg>
              <p className="text-xs text-blue-700 dark:text-blue-300">Combined score = 70% skill match + 30% proximity</p>
            </div>
          )}

          {!hasPin && sortMode === 'match' && (
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

          {/* Match cards — 2-column grid on large screens */}
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-3">
            {sorted.map((r, idx) => (
              <div key={r.id}
                className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-2xl p-4 sm:p-5 hover:shadow-md transition-shadow">

                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3 flex-1 min-w-0">

                    {/* Rank badge */}
                    <div className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold shrink-0 mt-0.5
                      ${idx === 0 ? 'bg-amber-100 dark:bg-amber-900/50 text-amber-700 dark:text-amber-300' :
                        idx === 1 ? 'bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300' :
                        idx === 2 ? 'bg-violet-100 dark:bg-violet-900 text-violet-700 dark:text-violet-300' :
                        'bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400'}`}>
                      #{idx + 1}
                    </div>

                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-gray-900 dark:text-white truncate">{r.company}</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">{r.position}</p>
                      <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">{r.address}</p>
                    </div>
                  </div>

                  {/* Score column */}
                  <div className="text-right shrink-0">
                    {sortMode === 'combined' && hasPin ? (
                      <>
                        <p className={`text-lg font-bold ${matchColor(r.combined)}`}>{r.combined}%</p>
                        <p className="text-xs text-gray-400 dark:text-gray-500">combined</p>
                      </>
                    ) : sortMode === 'distance' && r.distKm != null ? (
                      <>
                        <p className="text-lg font-bold text-blue-600 dark:text-blue-400">{r.distKm < 10 ? r.distKm.toFixed(1) : Math.round(r.distKm)} km</p>
                        <p className="text-xs text-gray-400 dark:text-gray-500">from you</p>
                      </>
                    ) : (
                      <>
                        <p className={`text-lg font-bold ${matchColor(r.match)}`}>{r.match}%</p>
                        <p className="text-xs text-gray-400 dark:text-gray-500">match</p>
                      </>
                    )}
                  </div>
                </div>

                {/* Tags + distance + slots */}
                <div className="flex items-center gap-2 mt-3 flex-wrap">
                  {r.tags.map(tag => (
                    <span key={tag} className={`text-xs px-2.5 py-1 rounded-full font-medium ${matchBadge(r.match)}`}>
                      {tag}
                    </span>
                  ))}

                  {r.distKm != null && sortMode !== 'distance' && (
                    <span className={`text-xs px-2.5 py-1 rounded-full font-medium flex items-center gap-1 ${distBadgeColor(r.distKm)}`}>
                      <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
                      {r.distKm < 10 ? r.distKm.toFixed(1) : Math.round(r.distKm)} km
                    </span>
                  )}

                  <span className="ml-auto text-xs text-gray-400 dark:text-gray-500 shrink-0">
                    {r.slots} slot{r.slots !== 1 ? 's' : ''}
                  </span>
                </div>

                {/* Score bar */}
                <div className="mt-3 h-1.5 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
                  {(() => {
                    const pct = sortMode === 'combined' && hasPin ? r.combined
                              : sortMode === 'distance' && r.distKm != null ? r.proximityPct
                              : r.match
                    const col = sortMode === 'distance' ? 'bg-blue-500'
                              : pct >= 80 ? 'bg-green-500' : pct >= 60 ? 'bg-amber-500' : 'bg-gray-400'
                    return <div className={`h-full rounded-full transition-all duration-700 ease-out ${col}`}
                      style={{ width: animated ? `${pct}%` : '0%' }} />
                  })()}
                </div>

                {/* Sub-scores if combined */}
                {sortMode === 'combined' && hasPin && (
                  <div className="mt-2 flex items-center gap-3 text-xs text-gray-400 dark:text-gray-600">
                    <span className="text-green-600 dark:text-green-400 font-medium">{r.match}% skill</span>
                    <span className="text-gray-300 dark:text-gray-700">·</span>
                    <span className="text-blue-600 dark:text-blue-400 font-medium">
                      {r.distKm < 10 ? r.distKm.toFixed(1) : Math.round(r.distKm)} km · {r.proximityPct}% proximity
                    </span>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

      </main>
      
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <p className="text-xs text-gray-400 dark:text-gray-600 text-center py-6 mt-8 border-t border-gray-200 dark:border-gray-800">
          Final placement decisions are made by your OJT coordinator. This list is for reference only.
        </p>
      </div>

    </div>
  )
}