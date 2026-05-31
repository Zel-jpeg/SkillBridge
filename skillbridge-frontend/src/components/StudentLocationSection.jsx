// src/components/StudentLocationSection.jsx
//
// Shared component — renders a student's setup preferences + a Leaflet map.
// Used inside StudentModal (instructor) and UserDetailModal (admin).
//
// Props:
//   address           — student.address object  { stayingAt, travelWilling,
//                         home: {province,city,barangay},
//                         boarding: {province,city,barangay},
//                         pinLat, pinLng }
//   top_recommendations — array of { company, position, match_score, lat, lng }
//
// The map shows:
//   • Blue pin  — student's pinned location (pinLat/pinLng)
//   • Numbered orange pins — top recommended companies (lat/lng)
//
// Map is loaded lazily from CDN (same singleton pattern as StudentSetup).

import { useEffect, useRef } from 'react'

// ── Leaflet singleton loader (CDN, no build dep) ─────────────────────────────
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

// ── SVG icon factories ───────────────────────────────────────────────────────
function makeStudentIcon(L) {
  return L.divIcon({
    className: '',
    iconSize:  [28, 36], iconAnchor: [14, 36], popupAnchor: [0, -40],
    html: `<svg xmlns="http://www.w3.org/2000/svg" width="28" height="36" viewBox="0 0 28 36">
      <path fill="#2563eb" stroke="white" stroke-width="2"
        d="M14 1C7.4 1 2 6.4 2 13c0 9.5 12 23 12 23S26 22.5 26 13C26 6.4 20.6 1 14 1z"/>
      <circle fill="white" cx="14" cy="13" r="5"/>
      <circle fill="#2563eb" cx="14" cy="13" r="2.5"/>
    </svg>`,
  })
}

function makeCompanyIcon(L, rank) {
  const colors = ['#f97316', '#a855f7', '#10b981']
  const bg = colors[rank] ?? '#6b7280'
  return L.divIcon({
    className: '',
    iconSize:  [28, 36], iconAnchor: [14, 36], popupAnchor: [0, -40],
    html: `<svg xmlns="http://www.w3.org/2000/svg" width="28" height="36" viewBox="0 0 28 36">
      <path fill="${bg}" stroke="white" stroke-width="2"
        d="M14 1C7.4 1 2 6.4 2 13c0 9.5 12 23 12 23S26 22.5 26 13C26 6.4 20.6 1 14 1z"/>
      <circle fill="rgba(0,0,0,0.2)" cx="14" cy="13" r="7"/>
      <text x="14" y="17" font-size="9" font-weight="bold" fill="white"
        text-anchor="middle" font-family="sans-serif">${rank + 1}</text>
    </svg>`,
  })
}

// ── Map sub-component ─────────────────────────────────────────────────────────
function PreviewMap({ pinLat, pinLng, companies }) {
  const elRef  = useRef(null)
  const mapRef = useRef(null)

  useEffect(() => {
    let alive = true
    loadLeaflet().then(L => {
      if (!alive || !elRef.current || mapRef.current) return

      // Default center: Panabo City
      const center = (pinLat && pinLng) ? [pinLat, pinLng] : [7.3072, 125.6839]
      const map = L.map(elRef.current, { zoomControl: false }).setView(center, 13)

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© <a href="https://openstreetmap.org">OpenStreetMap</a>',
        maxZoom: 19,
      }).addTo(map)
      L.control.zoom({ position: 'bottomright' }).addTo(map)

      // Collect all coords for fitBounds
      const allCoords = []

      // Student pin
      if (pinLat && pinLng) {
        allCoords.push([pinLat, pinLng])
        L.marker([pinLat, pinLng], { icon: makeStudentIcon(L) })
          .addTo(map)
          .bindPopup('<b>📍 Student location</b>')
      }

      // Company pins
      companies.forEach((c, i) => {
        if (!c.lat || !c.lng) return
        allCoords.push([c.lat, c.lng])
        L.marker([c.lat, c.lng], { icon: makeCompanyIcon(L, i) })
          .addTo(map)
          .bindPopup(`<b>#${i + 1} ${c.company}</b><br/>${c.position}<br/><b>${c.match_score}% match</b>`)
      })

      if (allCoords.length > 1) {
        map.fitBounds(allCoords, { padding: [30, 30], maxZoom: 14 })
      }

      setTimeout(() => map.invalidateSize(), 100)
      mapRef.current = map
    })
    return () => {
      alive = false
      mapRef.current?.remove()
      mapRef.current = null
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="relative rounded-xl overflow-hidden border border-gray-200 dark:border-gray-700 bg-gray-100 dark:bg-gray-800"
      style={{ height: 200 }}>
      <div ref={elRef} className="absolute inset-0" />
      {/* Legend */}
      <div className="absolute bottom-2 left-2 z-1000 flex flex-col gap-1 pointer-events-none">
        {[
          { color: 'bg-blue-600', label: 'Student' },
          { color: 'bg-orange-500', label: '#1 Match' },
          { color: 'bg-purple-500', label: '#2 Match' },
          { color: 'bg-emerald-500', label: '#3 Match' },
        ].map(item => (
          <div key={item.label} className="flex items-center gap-1 bg-white/80 dark:bg-black/60 rounded px-1.5 py-0.5">
            <span className={`w-2 h-2 rounded-full shrink-0 ${item.color}`} />
            <span className="text-[9px] font-medium text-gray-700 dark:text-gray-200">{item.label}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Label helpers ────────────────────────────────────────────────────────────
const STAYING_LABELS = {
  boarding: 'Boarding house / rented room',
  home:     'Family home (commuting)',
  open:     'Open to anywhere',
}
const TRAVEL_LABELS = {
  panabo:       'Within Panabo City only',
  'davao-norte':  'Anywhere in Davao del Norte',
  'davao-region': 'Anywhere in Davao Region (incl. Davao City)',
  anywhere:     'Open to anywhere in Mindanao',
}

function formatAddress(addr) {
  if (!addr) return null
  const parts = [addr.barangay, addr.city, addr.province].filter(Boolean)
  return parts.length ? parts.join(', ') : null
}

// ── Main export ──────────────────────────────────────────────────────────────
export default function StudentLocationSection({ address, top_recommendations }) {
  const addr   = address || {}
  const recs   = top_recommendations || []

  const stayingLabel = STAYING_LABELS[addr.stayingAt] || null
  const travelLabel  = TRAVEL_LABELS[addr.travelWilling] || null
  const homeAddr     = formatAddress(addr.home)
  const boardingAddr = addr.stayingAt === 'boarding' ? formatAddress(addr.boarding) : null
  const hasPin       = addr.pinLat && addr.pinLng
  const companyPins  = recs.filter(r => r.lat && r.lng)

  // Nothing to show at all — student hasn't completed setup
  const hasAnyData = stayingLabel || travelLabel || homeAddr || hasPin

  if (!hasAnyData) {
    return (
      <div className="bg-gray-50 dark:bg-gray-800 border border-dashed border-gray-200 dark:border-gray-700 rounded-xl px-4 py-3">
        <p className="text-xs text-gray-400 dark:text-gray-500 italic text-center">
          Student hasn't completed location setup yet.
        </p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-3">

      {/* Map — shown only when student pinned their location */}
      {hasPin && (
        <PreviewMap
          pinLat={addr.pinLat}
          pinLng={addr.pinLng}
          companies={companyPins}
        />
      )}

      {/* Preference pills grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">

        {stayingLabel && (
          <div className="flex items-start gap-2 bg-blue-50 dark:bg-blue-950/30 border border-blue-100 dark:border-blue-900 rounded-xl px-3 py-2.5">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#2563eb" strokeWidth="2" strokeLinecap="round" className="shrink-0 mt-0.5">
              <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/>
            </svg>
            <div className="min-w-0">
              <p className="text-[10px] font-semibold text-blue-600 dark:text-blue-400 uppercase tracking-wider mb-0.5">Staying at</p>
              <p className="text-xs font-medium text-gray-800 dark:text-gray-200 leading-snug">{stayingLabel}</p>
            </div>
          </div>
        )}

        {travelLabel && (
          <div className="flex items-start gap-2 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-100 dark:border-emerald-900 rounded-xl px-3 py-2.5">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2" strokeLinecap="round" className="shrink-0 mt-0.5">
              <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
            </svg>
            <div className="min-w-0">
              <p className="text-[10px] font-semibold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider mb-0.5">Travel range</p>
              <p className="text-xs font-medium text-gray-800 dark:text-gray-200 leading-snug">{travelLabel}</p>
            </div>
          </div>
        )}

        {homeAddr && (
          <div className="flex items-start gap-2 bg-gray-50 dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-xl px-3 py-2.5">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#6b7280" strokeWidth="2" strokeLinecap="round" className="shrink-0 mt-0.5">
              <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/>
            </svg>
            <div className="min-w-0">
              <p className="text-[10px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-0.5">Home address</p>
              <p className="text-xs font-medium text-gray-800 dark:text-gray-200 leading-snug wrap-break-word">{homeAddr}</p>
            </div>
          </div>
        )}

        {boardingAddr && (
          <div className="flex items-start gap-2 bg-violet-50 dark:bg-violet-950/30 border border-violet-100 dark:border-violet-900 rounded-xl px-3 py-2.5">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#7c3aed" strokeWidth="2" strokeLinecap="round" className="shrink-0 mt-0.5">
              <rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/>
            </svg>
            <div className="min-w-0">
              <p className="text-[10px] font-semibold text-violet-600 dark:text-violet-400 uppercase tracking-wider mb-0.5">Boarding address</p>
              <p className="text-xs font-medium text-gray-800 dark:text-gray-200 leading-snug wrap-break-word">{boardingAddr}</p>
            </div>
          </div>
        )}

        {hasPin && (
          <div className="flex items-start gap-2 bg-blue-50 dark:bg-blue-950/30 border border-blue-100 dark:border-blue-900 rounded-xl px-3 py-2.5">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#2563eb" strokeWidth="2" strokeLinecap="round" className="shrink-0 mt-0.5">
              <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/>
            </svg>
            <div className="min-w-0">
              <p className="text-[10px] font-semibold text-blue-600 dark:text-blue-400 uppercase tracking-wider mb-0.5">Pinned location</p>
              <p className="text-xs font-medium text-gray-800 dark:text-gray-200 font-mono">
                {Number(addr.pinLat).toFixed(5)}, {Number(addr.pinLng).toFixed(5)}
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
