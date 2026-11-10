import { recommendationDisplay, recommendationValue, recommendationLabel, coverageDisplay, isAssessmentMatch, isAssessmentLed, comparePositionCandidates } from '../../utils/recommendationResults'
import { ContentSkeleton } from '../../components/loading/Skeletons'
import { loadLeaflet } from '../../utils/externalServices'
import { validPin } from '../../utils/recommendationResults'
import MapStatus from '../../components/MapStatus'
import { escapeHtml } from '../../utils/escapeHtml'
import DataSection from '../../components/DataSection'
// src/pages/instructor/InstructorCompanies.jsx
//
// Fully responsive company view for instructors.
// Cards → click → detail modal (bottom-sheet on mobile, centered on desktop).

import { useState, useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import { useInstructorCompanies } from '../../hooks/instructor/useInstructorCompanies'
import Avatar                     from '../../components/Avatar'
import NlpTextPreview from '../../components/NlpTextPreview'
import CompanyImage from '../../components/CompanyImage'
import { BriefcaseIcon, ChevronRightIcon, PinIcon as LocationIcon } from '../../components/Icons'

// ── Leaflet CDN singleton ─────────────────────────────────────────────────────


// ── Map icons ─────────────────────────────────────────────────────────────────
function makeViewIcon(L, name) {
  return L.divIcon({
    className: '',
    iconSize:    [28, 36],
    iconAnchor:  [14, 36],
    popupAnchor: [0, -42],
    html: `<div style="position:relative;z-index:100">
      <div style="position:absolute;bottom:40px;white-space:nowrap;background:#1d4ed8;color:white;
        font-size:10px;font-weight:700;font-family:system-ui,sans-serif;padding:3px 8px;
        border-radius:6px;box-shadow:0 2px 6px rgba(0,0,0,0.4);pointer-events:none;
        transform:translateX(-50%);left:50%">
        ${escapeHtml(name)}
        <div style="position:absolute;bottom:-5px;left:50%;transform:translateX(-50%);width:0;height:0;
          border-left:5px solid transparent;border-right:5px solid transparent;border-top:6px solid #1d4ed8"></div>
      </div>
      <svg xmlns="http://www.w3.org/2000/svg" width="28" height="36" viewBox="0 0 28 36"
        style="filter:drop-shadow(0 2px 5px rgba(0,0,0,0.4));display:block">
        <path fill="#3b82f6" stroke="white" stroke-width="2"
          d="M14 1C7.4 1 2 6.4 2 13c0 9.5 12 23 12 23S26 22.5 26 13C26 6.4 20.6 1 14 1z"/>
        <circle fill="white" cx="14" cy="13" r="5"/>
      </svg>
    </div>`,
  })
}

// ── View-only map (detail modal) ──────────────────────────────────────────────
function ViewMap({ company }) {
  const elRef  = useRef(null)
  const mapRef = useRef(null)

  const [mapStatus, setMapStatus] = useState('loading')
  const [mapAttempt, setMapAttempt] = useState(0)
  function retryMap() { setMapStatus('loading'); setMapAttempt(value => value + 1) }

  useEffect(() => {
    if (!validPin(company?.lat, company?.lng)) return
    let alive = true
    let resizeTimer
    loadLeaflet().then(L => {
      if (!alive || !elRef.current || mapRef.current) return
      const map = L.map(elRef.current, { zoomControl: false })
        .setView([company.lat, company.lng], 15)
      mapRef.current = map
      const tiles = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© <a href="https://openstreetmap.org">OpenStreetMap</a>',
        maxZoom: 19,
      }).addTo(map)
      tiles.on?.('tileerror', () => { if (alive) setMapStatus('tiles') })
      L.control.zoom({ position: 'bottomright' }).addTo(map)
      L.marker([company.lat, company.lng], { icon: makeViewIcon(L, company.name) }).addTo(map)
      resizeTimer = setTimeout(() => map.invalidateSize(), 150)
      mapRef.current = map
      setMapStatus('ready')
    }).catch(() => {
      if (alive) { mapRef.current?.remove(); mapRef.current = null; setMapStatus('error') }
    })
    return () => { alive = false; clearTimeout(resizeTimer); mapRef.current?.remove(); mapRef.current = null }
  }, [company?.id, company?.lat, company?.lng, company?.name, mapAttempt])

  if (!validPin(company?.lat, company?.lng)) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 bg-gray-50 dark:bg-gray-800 rounded-2xl border border-dashed border-gray-200 dark:border-gray-700" style={{ height: 180 }}>
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-gray-300 dark:text-gray-600">
          <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/>
        </svg>
        <p className="text-xs text-gray-400 dark:text-gray-600 text-center px-6">No location pinned for this partner</p>
      </div>
    )
  }
  return (
    <div className="relative rounded-2xl overflow-hidden border border-gray-100 dark:border-gray-800" style={{ height: 200, isolation: 'isolate' }}>
      <div ref={elRef} className="w-full h-full" />
      <MapStatus status={mapStatus} onRetry={retryMap} />
    </div>
  )
}

function CompaniesMap({ companies }) {
  const elRef  = useRef(null)
  const mapRef = useRef(null)
  const mksRef = useRef([])

  function buildMarkers(L, map, list) {
    mksRef.current.forEach(m => m.remove())
    mksRef.current = []
    const geo = list.filter(c => validPin(c.lat, c.lng))
    const markers = geo.map(co =>
      L.marker([co.lat, co.lng], { icon: makeViewIcon(L, co.name) })
        .addTo(map)
        .bindPopup(`
          <div style="min-width:160px;font-family:system-ui,sans-serif;line-height:1.4">
            <p style="font-weight:700;font-size:13px;margin:0 0 2px;color:#111827">${escapeHtml(co.name)}</p>
            <p style="font-size:11px;color:#6b7280;margin:0">${escapeHtml(co.address ? [co.address.barangay, co.address.city, co.address.province].filter(Boolean).join(', ') : 'No address set')}</p>
            <p style="font-size:11px;font-weight:600;color:#3b82f6;margin:5px 0 0">
              ${co.positions.length} position${co.positions.length !== 1 ? 's' : ''}
            </p>
          </div>`)
    )
    mksRef.current = markers
    if (markers.length > 1) {
      map.fitBounds(L.featureGroup(markers).getBounds().pad(0.28))
    } else if (markers.length === 1) {
      map.setView(markers[0].getLatLng(), 13)
    }
  }

  const companiesRef = useRef(companies)
  useEffect(() => { companiesRef.current = companies }, [companies])
  const [mapStatus, setMapStatus] = useState('loading')
  const [mapAttempt, setMapAttempt] = useState(0)
  function retryMap() { setMapStatus('loading'); setMapAttempt(value => value + 1) }

  useEffect(() => {
    let alive = true
    loadLeaflet().then(L => {
      if (!alive || !elRef.current || mapRef.current) return
      const map = L.map(elRef.current).setView([7.3072, 125.6839], 10)
      mapRef.current = map
      const tiles = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© <a href="https://openstreetmap.org">OpenStreetMap</a>',
        maxZoom: 19,
      }).addTo(map)
      tiles.on?.('tileerror', () => { if (alive) setMapStatus('tiles') })
      map.zoomControl.setPosition('bottomright')
      buildMarkers(L, map, companiesRef.current)
      mapRef.current = map
      setMapStatus('ready')
    }).catch(() => {
      if (alive) { mapRef.current?.remove(); mapRef.current = null; setMapStatus('error') }
    })
    return () => {
      alive = false
      mapRef.current?.remove()
      mapRef.current = null
    }
  }, [mapAttempt])

  useEffect(() => {
    if (!mapRef.current || !window.L) return
    buildMarkers(window.L, mapRef.current, companies)
  }, [companies])

  return (
    <div className="relative" style={{ isolation: 'isolate' }}>
      <div ref={elRef} className="w-full rounded-2xl overflow-hidden"
      style={{ height: 340, isolation: 'isolate' }} />
      <MapStatus status={mapStatus} onRetry={retryMap} />
    </div>
  )
}

// ── Match helpers ─────────────────────────────────────────────────────────────
const matchColor = p => p >= 80 ? 'text-green-600 dark:text-green-400' : p >= 60 ? 'text-amber-600 dark:text-amber-400' : 'text-rose-500 dark:text-rose-400'
const matchBg    = p => p >= 80 ? 'bg-green-500' : p >= 60 ? 'bg-amber-500' : 'bg-rose-500'

// ── Icons ─────────────────────────────────────────────────────────────────────
const XIcon      = () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M18 6L6 18M6 6l12 12"/></svg>
const SearchIcon = () => <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="11" cy="11" r="7"/><path d="M16.5 16.5L21 21"/></svg>
const PinIcon    = () => <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
const BriefIcon  = () => <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2"/></svg>
const HomeIcon   = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
const UserIcon   = () => <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>

// ─────────────────────────────────────────────────────────────────────────────
function CompanyDetailModal({ company, onClose }) {
  const addr = company.address
    ? [company.address.barangay, company.address.city, company.address.province].filter(Boolean).join(', ')
    : ''
  const totalMatched = company.positions.reduce((s, p) => s + p.matched_count, 0)

  useEffect(() => {
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = '' }
  }, [])

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm px-0 sm:px-4"
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="bg-white dark:bg-gray-900 w-full sm:max-w-lg rounded-t-3xl sm:rounded-2xl border border-gray-100 dark:border-gray-800 shadow-2xl flex flex-col overflow-hidden"
        style={{ maxHeight: '92vh', animation: 'sheetUp 0.28s cubic-bezier(0.34,1.05,0.64,1) both' }}>

        {/* Drag handle */}
        <div className="flex justify-center pt-3 pb-1 sm:hidden shrink-0">
          <div className="w-10 h-1 rounded-full bg-gray-200 dark:bg-gray-700" />
        </div>

        {/* Header */}
        <div className="flex items-center gap-3 px-5 py-3 border-b border-gray-100 dark:border-gray-800 shrink-0">
          <CompanyImage name={company.name} imageUrl={company.image_url} className="w-9 h-9 rounded-xl" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-gray-900 dark:text-white leading-tight truncate">{company.name}</p>
            {addr && (
              <div className="flex items-center gap-1 mt-0.5">
                <span className="text-gray-400 shrink-0"><PinIcon /></span>
                <p className="text-xs text-gray-400 dark:text-gray-500 truncate">{addr}</p>
              </div>
            )}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button onClick={onClose} aria-label="Close partner details"
              className="w-8 h-8 flex items-center justify-center rounded-xl text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
              <XIcon />
            </button>
          </div>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto">
          <div className="p-5 flex flex-col gap-5">

            {/* Stats */}
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-gray-50 dark:bg-gray-800 rounded-2xl p-3 text-center">
                <p className="text-2xl font-bold text-gray-900 dark:text-white">{company.positions.length}</p>
                <p className="text-xs text-gray-400 mt-0.5">Position{company.positions.length !== 1 ? 's' : ''}</p>
              </div>
              <div className={`rounded-2xl p-3 text-center ${totalMatched > 0 ? 'bg-blue-50 dark:bg-blue-950/40' : 'bg-gray-50 dark:bg-gray-800'}`}>
                <p className={`text-2xl font-bold ${totalMatched > 0 ? 'text-blue-600 dark:text-blue-400' : 'text-gray-900 dark:text-white'}`}>{totalMatched}</p>
                <p className="text-xs text-gray-400 mt-0.5">Match{totalMatched !== 1 ? 'es' : ''}</p>
              </div>
            </div>

            {/* Map */}
            <div>
              <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">Location</p>
              <ViewMap company={company} />
            </div>

            {/* Positions */}
            <div>
              <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3">Positions & Matches</p>
              {company.positions.length === 0
                ? <p className="text-xs text-gray-400 italic text-center py-5">No positions listed.</p>
                : (
                  <div className="flex flex-col gap-3">
                    {company.positions.map(pos => (
                      <div key={pos.id} className="bg-gray-50 dark:bg-gray-800 rounded-2xl overflow-hidden border border-gray-100 dark:border-gray-700">
                        <div className="flex items-center gap-3 px-4 py-3">
                          <div className="w-7 h-7 rounded-lg bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 flex items-center justify-center text-gray-400 shrink-0">
                            <BriefIcon />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-semibold text-gray-900 dark:text-white truncate">{pos.title}</p>
                            <NlpTextPreview key={pos.id} positionId={pos.id} />
                            <p className="text-xs text-gray-400">{pos.slots} slot{pos.slots !== 1 ? 's' : ''}</p>
                          </div>
                          <span className={`text-xs font-semibold px-2.5 py-0.5 rounded-full shrink-0 ${
                            pos.matched_count > 0
                              ? 'bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300'
                              : 'bg-gray-100 dark:bg-gray-700 text-gray-400'
                          }`}>{pos.matched_count > 0 ? `${pos.matched_count} matched` : 'None'}</span>
                        </div>
                        {pos.description && <p className="px-4 pb-3 whitespace-pre-wrap break-words text-xs leading-5 text-gray-600 dark:text-gray-300">{pos.description}</p>}
                        {pos.matched_students.length > 0 && (
                          <div className="border-t border-gray-100 dark:border-gray-700 divide-y divide-gray-100 dark:divide-gray-700">
                            {pos.matched_students.map((stu, si) => (
                              <div key={stu.id} className={`flex items-center gap-3 px-4 py-2.5 ${si === 0 ? 'bg-green-50/60 dark:bg-green-950/20' : ''}`}>
                                <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 ${si === 0 ? 'bg-green-600 text-white' : 'bg-gray-200 dark:bg-gray-700 text-gray-500 dark:text-gray-400'}`}>{si + 1}</span>
                                <Avatar name={stu.name} photoUrl={stu.photo_url} className="w-7 h-7 rounded-full text-xs shrink-0" />
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-1.5">
                                    <p className="text-xs font-semibold text-gray-900 dark:text-white truncate">{stu.name}</p>
                                    {stu.batch_name && (
                                      <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider shrink-0 ${stu.batch_status === 'archived' ? 'bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400' : 'bg-green-100 dark:bg-green-900/60 text-green-700 dark:text-green-400'}`}>
                                        {stu.batch_name}
                                      </span>
                                    )}
                                  </div>
                                  <p className="text-xs text-gray-400 dark:text-gray-500 truncate">{stu.school_id} · {stu.course}</p>
                                </div>
                                <div className="max-w-24 shrink-0 break-words text-right">
                                  <p className={`text-sm font-bold leading-none ${matchColor(recommendationValue(stu))}`}>{isAssessmentLed(stu) && !isAssessmentMatch(stu) ? coverageDisplay(stu) : recommendationDisplay(stu)}</p>
                                  <p className="mt-1 text-[10px] text-gray-500 dark:text-gray-400">{isAssessmentMatch(stu) ? recommendationLabel(stu) : isAssessmentLed(stu) ? 'Requirement coverage' : 'Legacy match'}</p>
                                  <div className="w-12 h-1 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden mt-1">
                                    <div className={`h-full rounded-full ${matchBg(recommendationValue(stu))}`} style={{ width: `${recommendationValue(stu) ?? 0}%` }} />
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Company Card
// ─────────────────────────────────────────────────────────────────────────────
function CompanyCard({ company, onClick }) {
  const city = company.address?.city || company.address?.province || null
  const totalMatched = company.positions.reduce((s, p) => s + p.matched_count, 0)
  const hasPin = !!(company.lat && company.lng)

  const topEntry = company.positions
    .flatMap(p => p.matched_students.slice(0, 1).map(s => ({ ...s, posTitle: p.title })))
    .sort(comparePositionCandidates)[0]

  return (
    <button onClick={onClick}
      className="group w-full text-left bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-2xl p-4 flex flex-col gap-3 active:scale-[0.98] hover:border-blue-200 dark:hover:border-blue-800 hover:shadow-md transition-all duration-200 cursor-pointer">
      <div className="flex items-start gap-3">
        <CompanyImage name={company.name} imageUrl={company.image_url} />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-gray-900 dark:text-white leading-tight line-clamp-2 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
            {company.name}
          </p>
          {city && (
            <div className="flex items-center gap-1 mt-1">
              <span className="text-gray-400 shrink-0"><PinIcon /></span>
              <p className="text-xs text-gray-400 dark:text-gray-500 truncate">{city}</p>
            </div>
          )}
        </div>
        <div className={`w-2 h-2 rounded-full mt-1 shrink-0 ${hasPin ? 'bg-green-400' : 'bg-gray-200 dark:bg-gray-700'}`} title={hasPin ? 'Location pinned' : 'No pin'} />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <span className="inline-flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-800 px-2.5 py-1 rounded-full">
          <BriefIcon /> {company.positions.length} position{company.positions.length !== 1 ? 's' : ''}
        </span>
        <span className={`inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-full ${
          totalMatched > 0
            ? 'bg-blue-100 dark:bg-blue-900/60 text-blue-700 dark:text-blue-300'
            : 'bg-gray-100 dark:bg-gray-800 text-gray-400'
        }`}>
          <UserIcon /> {totalMatched} match{totalMatched !== 1 ? 'es' : ''}
        </span>
      </div>

      {topEntry && (
        <div className="flex items-center gap-2 bg-green-50 dark:bg-green-950/30 border border-green-100 dark:border-green-900 rounded-xl px-3 py-2">
          <Avatar name={topEntry.name} photoUrl={topEntry.photo_url} className="w-6 h-6 rounded-full text-[10px] shrink-0" />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5">
              <p className="text-xs font-semibold text-gray-700 dark:text-gray-300 truncate">{topEntry.name.split(' ')[0]}</p>
              {topEntry.batch_name && (
                <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider shrink-0 ${topEntry.batch_status === 'archived' ? 'bg-green-100/50 dark:bg-green-900/30 text-green-800 dark:text-green-500/70' : 'bg-green-200 dark:bg-green-800/80 text-green-800 dark:text-green-300'}`}>
                  {topEntry.batch_name}
                </span>
              )}
            </div>
            <p className="text-xs text-gray-400 dark:text-gray-500 truncate">{topEntry.posTitle}</p>
          </div>
          <span className="text-xs font-bold text-green-600 dark:text-green-400 shrink-0">{isAssessmentLed(topEntry) ? coverageDisplay(topEntry) : recommendationDisplay(topEntry)}</span>
        </div>
      )}
    </button>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Page
// ─────────────────────────────────────────────────────────────────────────────
export default function InstructorCompanies() {
  const {
    companies, allCompanies, allCount, loading,
    search, setSearch,

  } = useInstructorCompanies()

  const [selected, setSelected] = useState(null)

  // Keep selected fresh after data changes
  useEffect(() => {
    if (!selected) return
    const fresh = allCompanies.find(c => c.id === selected.id)
    // Preserve the existing open detail view when company data refreshes.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSelected(fresh ?? null)
  }, [allCompanies]) // eslint-disable-line

  return (
    <div className="min-w-0">



      {/* Detail modal */}
      {selected && (
        <CompanyDetailModal
          company={selected}
          onClose={() => setSelected(null)}
        />
      )}

      <section className="max-w-5xl mx-auto px-4 sm:px-6 py-6 sm:py-8 flex flex-col gap-5">

        {/* Header */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-lg sm:text-xl font-bold text-gray-900 dark:text-white">OJT Partners</h1>
            <Link to="/instructor/companies/manage" className="mt-2 inline-flex min-h-11 items-center rounded-lg bg-green-700 px-4 text-xs font-semibold text-white hover:bg-green-800 focus-visible:outline-2 focus-visible:outline-green-600">Manage partners & positions</Link>
            <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 mt-0.5">
              {allCount} {allCount === 1 ? 'partner' : 'partners'} · tap a card to view details
            </p>
          </div>
          <div className="relative w-full sm:w-60">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"><SearchIcon /></span>
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search…"
              className="w-full pl-9 pr-4 py-2.5 text-sm rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white outline-none focus:border-blue-500 transition-colors" />
          </div>
        </div>

        <DataSection url="/api/instructor/companies/" skeleton={<div className="space-y-5"><ContentSkeleton layout="map" label="Loading partner locations" /><ContentSkeleton layout="company-cards" label="Loading partners" /></div>}>
        {/* Overview Map */}
        {!loading && companies.length > 0 && (
          <div className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-2xl p-1 shadow-sm">
            <CompaniesMap companies={companies} />
          </div>
        )}

        {/* Empty */}
        {!loading && companies.length === 0 && (
          <div className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-2xl py-16 flex flex-col items-center gap-3">
            <div className="w-14 h-14 rounded-2xl bg-gray-100 dark:bg-gray-800 flex items-center justify-center text-gray-300 dark:text-gray-700"><HomeIcon /></div>
            <p className="text-sm font-medium text-gray-400 dark:text-gray-600">No partners found</p>
            {search && <button onClick={() => setSearch('')} className="text-xs text-blue-600 dark:text-blue-400 hover:underline">Clear search</button>}
          </div>
        )}

        {/* Cards */}
        {!loading && companies.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
            {companies.map(co => (
              <CompanyCard key={co.id} company={co} onClick={() => setSelected(co)} />
            ))}
          </div>
        )}
        </DataSection>
      </section>

      <style>{`
        @keyframes sheetUp {
          from { transform:translateY(60px) scale(0.98); opacity:0; }
          to   { transform:translateY(0) scale(1);       opacity:1; }
        }
        @media (max-width:639px) {
          @keyframes sheetUp {
            from { transform:translateY(100%); }
            to   { transform:translateY(0); }
          }
        }
      `}</style>
    </div>
  )
}
