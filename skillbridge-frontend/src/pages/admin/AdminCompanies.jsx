// src/pages/admin/AdminCompanies.jsx
//
// Shows:
//   1. Collapsible partner-locations overview map (Leaflet / OpenStreetMap, free)
//   2. Company cards — name, address, slot count, positions list
//   3. "Add company" → 2-step modal:
//        Step 1: company name + PSGC AddressDropdowns + street/building field
//        Step 2: pin exact location on interactive map (tap to place, drag to adjust)
//   4. Per-company "Add position" modal (skill sliders)
//   5. Delete company / delete position
//
// PERFORMANCE NOTES (production):
//   - CompaniesMap is lazy-mounted: Leaflet JS + CSS (~150 KB) is only fetched
//     the first time the user clicks "Partner Locations". Subsequent open/close
//     cycles reuse the already-loaded script — no re-download.
//   - The overview map panel is closed by default so the page loads instantly.
//   - PinMap (inside Add Company modal) shares the same loadLeaflet() singleton,
//     so if the user opened the overview map first, the modal map is free.
//
// TODO Week 4: replace local state with real API calls
//   GET    /api/admin/companies/               → list + positions
//   POST   /api/admin/companies/               → create (send lat/lng too)
//   DELETE /api/admin/companies/:id/
//   POST   /api/admin/companies/:id/positions/
//   DELETE /api/admin/positions/:id/

import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import AddressDropdowns from '../../components/AddressDropdowns'

// ────────────────────────────────────────────────────────────────
// Leaflet — loaded once from CDN, no npm package needed.
// The singleton promise guarantees the script is injected only
// once even if loadLeaflet() is called multiple times.
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

// ── Nominatim geocoder (free, no key) ────────────────────────────
// Nominatim usage policy: 1 req/sec max, valid User-Agent required.
// For higher traffic consider a backend proxy or a paid geocoder.
//
// Geocodes the most specific address available:
//   barangay → zoom 17 (street level — ideal for pinning)
//   city only → zoom 15 (neighbourhood level)
//   province only → zoom 12 (city overview)
async function geocodeAddress({ barangay, city, province }) {
  // Build query from most specific to least specific
  const q = [barangay, city, province, 'Philippines'].filter(Boolean).join(', ')
  const zoom = barangay ? 17 : city ? 15 : 12

  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&format=json&limit=1`,
      { headers: { 'User-Agent': 'SkillBridge-Admin/1.0' } }
    )
    const [hit] = await res.json()
    if (hit) return { lat: parseFloat(hit.lat), lng: parseFloat(hit.lon), zoom }
  } catch {}
  return { lat: 7.1907, lng: 125.4553, zoom } // fallback: Davao City
}

// ── Company pin icon with hoverable name label ───────────────────
function makeCompanyIcon(L, name) {
  return L.divIcon({
    className:   '',
    iconSize:    [28, 36],
    iconAnchor:  [14, 36],
    popupAnchor: [0, -42],
    html: `
      <div class="group relative flex flex-col justify-end items-center cursor-pointer select-none"
           style="position:relative;z-index:100">
        <div style="
          position:absolute;bottom:40px;white-space:nowrap;
          background:#111827;color:white;
          font-size:10px;font-weight:700;font-family:system-ui,sans-serif;
          padding:3px 8px;border-radius:6px;box-shadow:0 2px 6px rgba(0,0,0,0.35);
          pointer-events:none;transition:all .18s;
          transform:translateX(-50%);left:50%;
        ">
          ${name}
          <div style="position:absolute;bottom:-5px;left:50%;transform:translateX(-50%);
            width:0;height:0;border-left:5px solid transparent;border-right:5px solid transparent;
            border-top:6px solid #111827"></div>
        </div>
        <div style="transition:transform .18s" class="group-hover:scale-110">
          <svg xmlns="http://www.w3.org/2000/svg" width="28" height="36" viewBox="0 0 28 36" style="filter:drop-shadow(0 2px 5px rgba(0,0,0,0.4));display:block">
            <path fill="#16a34a" stroke="white" stroke-width="2" d="M14 1C7.4 1 2 6.4 2 13c0 9.5 12 23 12 23S26 22.5 26 13C26 6.4 20.6 1 14 1z"/>
            <circle fill="white" cx="14" cy="13" r="5"/>
          </svg>
        </div>
      </div>`,
  })
}

// ── Simple pin icon (for PinMap placement marker only) ────────────
function makePinIcon(L) {
  return L.divIcon({
    className:   '',
    iconSize:    [28, 36],
    iconAnchor:  [14, 36],
    popupAnchor: [0, -40],
    html: `<svg xmlns="http://www.w3.org/2000/svg" width="28" height="36" viewBox="0 0 28 36">
      <path fill="#16a34a" stroke="white" stroke-width="2"
        d="M14 1C7.4 1 2 6.4 2 13c0 9.5 12 23 12 23S26 22.5 26 13C26 6.4 20.6 1 14 1z"/>
      <circle fill="white" cx="14" cy="13" r="5"/>
    </svg>`,
  })
}

// ════════════════════════════════════════════════════════════════
// PinMap — interactive drop-pin map inside the Add Company modal
//
// `center` → { lat, lng, zoom } from geocodeAddress.
//   Zoom levels: 17 = barangay, 15 = city, 12 = province.
//   The map re-centers at exactly this zoom whenever center changes,
//   so the user lands precisely where they need to drop the pin.
// ════════════════════════════════════════════════════════════════
function PinMap({ center, pinned, onPin }) {
  const elRef  = useRef(null)
  const mapRef = useRef(null)
  const mkRef  = useRef(null)

  // Initialise Leaflet once on mount
  useEffect(() => {
    let alive = true
    loadLeaflet().then(L => {
      if (!alive || !elRef.current || mapRef.current) return

      const map = L.map(elRef.current).setView(
        center ? [center.lat, center.lng] : [7.1907, 125.4553],
        center?.zoom ?? 13
      )
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© <a href="https://openstreetmap.org">OpenStreetMap</a>',
        maxZoom: 19,
      }).addTo(map)
      map.zoomControl.setPosition('bottomright')

      // Give the DOM a moment to settle, then fix tile gaps
      setTimeout(() => map.invalidateSize(), 150)

      function placeMk(lat, lng) {
        if (mkRef.current) {
          mkRef.current.setLatLng([lat, lng])
        } else {
          mkRef.current = L.marker([lat, lng], {
            icon: makePinIcon(L), draggable: true,
          }).addTo(map)
          mkRef.current.on('dragend', ev => {
            const p = ev.target.getLatLng()
            onPin({ lat: p.lat, lng: p.lng })
          })
        }
        onPin({ lat, lng })
      }

      if (pinned) placeMk(pinned.lat, pinned.lng)
      map.on('click', ev => placeMk(ev.latlng.lat, ev.latlng.lng))
      mapRef.current = map
    })
    return () => {
      alive = false
      mapRef.current?.remove()
      mapRef.current = null
      mkRef.current  = null
    }
  }, []) // intentional — only mount/unmount

  // Re-center + re-zoom whenever address selection changes.
  // zoom comes from geocodeAddress so it matches the specificity:
  //   selected barangay → 17, city → 15, province → 12.
  useEffect(() => {
    if (mapRef.current && center) {
      mapRef.current.setView(
        [center.lat, center.lng],
        center.zoom ?? 15,
        { animate: true }
      )
    }
  }, [center?.lat, center?.lng, center?.zoom]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="relative rounded-xl overflow-hidden border border-gray-200 dark:border-gray-700" style={{ height: 248, isolation: 'isolate' }}>
      <div ref={elRef} className="absolute inset-0" />
      {!pinned && (
        <div className="absolute bottom-2 left-1/2 -translate-x-1/2 z-1000 pointer-events-none
          bg-black/60 text-white text-xs font-medium px-3 py-1.5 rounded-full whitespace-nowrap">
          Tap anywhere to drop a pin
        </div>
      )}
    </div>
  )
}

// ════════════════════════════════════════════════════════════════
// CompaniesMap — overview map showing all partner locations
// ════════════════════════════════════════════════════════════════
function CompaniesMap({ companies }) {
  const elRef  = useRef(null)
  const mapRef = useRef(null)
  const mksRef = useRef([])

  function buildMarkers(L, map, list) {
    mksRef.current.forEach(m => m.remove())
    mksRef.current = []
    const geo = list.filter(c => c.lat != null && c.lng != null)
    const markers = geo.map(co =>
      L.marker([co.lat, co.lng], { icon: makeCompanyIcon(L, co.name) })
        .addTo(map)
        .bindPopup(`
          <div style="min-width:160px;font-family:system-ui,sans-serif;line-height:1.4">
            <p style="font-weight:700;font-size:13px;margin:0 0 2px;color:#111827">${co.name}</p>
            <p style="font-size:11px;color:#6b7280;margin:0">${co.address}</p>
            <p style="font-size:11px;font-weight:600;color:#16a34a;margin:5px 0 0">
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

  // Init map once — only runs when this component is first mounted.
  // Because of the lazy-mount pattern in the parent, this only happens
  // when the user first opens the "Partner Locations" panel.
  useEffect(() => {
    let alive = true
    loadLeaflet().then(L => {
      if (!alive || !elRef.current || mapRef.current) return
      const map = L.map(elRef.current).setView([7.3072, 125.6839], 10)
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© <a href="https://openstreetmap.org">OpenStreetMap</a>',
        maxZoom: 19,
      }).addTo(map)
      map.zoomControl.setPosition('bottomright')
      buildMarkers(L, map, companies)
      mapRef.current = map
    })
    return () => {
      alive = false
      mapRef.current?.remove()
      mapRef.current = null
    }
  }, []) // intentional

  // Rebuild markers whenever companies list changes (add / delete)
  useEffect(() => {
    if (!mapRef.current || !window.L) return
    buildMarkers(window.L, mapRef.current, companies)
  }, [companies]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div ref={elRef} className="w-full rounded-2xl overflow-hidden" style={{ height: 340, isolation: 'isolate' }} />
  )
}

// ── Icons ────────────────────────────────────────────────────────
const TrashIcon = ({ size = 14 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
    <path d="M10 11v6M14 11v6M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
  </svg>
)
const XIcon = ({ size = 14 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
    <path d="M18 6L6 18M6 6l12 12"/>
  </svg>
)
const BellIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path>
    <path d="M13.73 21a2 2 0 0 1-3.46 0"></path>
  </svg>
)
const MenuIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
    <path d="M3 12h18M3 6h18M3 18h18"/>
  </svg>
)
const MapIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polygon points="3 6 9 3 15 6 21 3 21 18 15 21 9 18 3 21"/>
    <line x1="9" y1="3" x2="9" y2="18"/><line x1="15" y1="6" x2="15" y2="21"/>
  </svg>
)
const PinIcon = () => (
  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/>
  </svg>
)
const ChevronDown = ({ open }) => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"
    className={`transition-transform duration-200 ${open ? 'rotate-180' : ''}`}>
    <path d="M6 9l6 6 6-6"/>
  </svg>
)

// ── Confirm Modal ─────────────────────────────────────────────────
function ConfirmModal({ title, message, confirmLabel = 'Delete', onConfirm, onCancel }) {
  return (
    <div className="fixed inset-0 z-60 flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-sm px-4 pb-4 sm:pb-0">
      <div className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-2xl shadow-xl w-full max-w-sm p-6 space-y-4">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-rose-50 dark:bg-rose-950 flex items-center justify-center shrink-0 text-rose-500">
            <TrashIcon size={18}/>
          </div>
          <div>
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white">{title}</h3>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 leading-relaxed">{message}</p>
          </div>
        </div>
        <div className="flex gap-2">
          <button onClick={onCancel} className="flex-1 py-2.5 rounded-xl text-sm font-medium bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors">Cancel</button>
          <button onClick={onConfirm} className="flex-1 py-2.5 rounded-xl text-sm font-medium bg-rose-600 hover:bg-rose-700 text-white transition-colors">{confirmLabel}</button>
        </div>
      </div>
    </div>
  )
}

// ════════════════════════════════════════════════════════════════
// DUMMY DATA — replace with API in Week 4
// ════════════════════════════════════════════════════════════════
const ADMIN = { name: 'System Administrator', initials: 'SA' }

// Skill categories are loaded from /api/categories/ — this is the fallback
const SKILL_CATEGORIES_FALLBACK = ['Web Development', 'Database', 'Design', 'Networking', 'Backend']

// ── Skill Level Presets ───────────────────────────────────────────
const SKILL_LEVELS = [
  { label: 'Not Required', value: 0,  color: 'gray'   },
  { label: 'Basic',        value: 25, color: 'blue'   },
  { label: 'Mid',          value: 50, color: 'yellow' },
  { label: 'Advanced',     value: 75, color: 'orange' },
  { label: 'Expert',       value: 90, color: 'green'  },
]

const LEVEL_COLORS = {
  gray:   { btn: 'bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400',   active: 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-200 ring-1 ring-gray-400 dark:ring-gray-500' },
  blue:   { btn: 'bg-blue-50 dark:bg-blue-950 text-blue-500 dark:text-blue-400',    active: 'bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-200 ring-1 ring-blue-400 dark:ring-blue-500' },
  yellow: { btn: 'bg-yellow-50 dark:bg-yellow-950 text-yellow-600 dark:text-yellow-400', active: 'bg-yellow-100 dark:bg-yellow-900 text-yellow-700 dark:text-yellow-200 ring-1 ring-yellow-400 dark:ring-yellow-500' },
  orange: { btn: 'bg-orange-50 dark:bg-orange-950 text-orange-500 dark:text-orange-400', active: 'bg-orange-100 dark:bg-orange-900 text-orange-700 dark:text-orange-200 ring-1 ring-orange-400 dark:ring-orange-500' },
  green:  { btn: 'bg-green-50 dark:bg-green-950 text-green-600 dark:text-green-400', active: 'bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-200 ring-1 ring-green-400 dark:ring-green-500' },
}

// ── Level Selector Row (per skill category) ───────────────────────
function SkillLevelSelector({ category, value, onChange }) {
  const [customMode, setCustomMode] = useState(false)
  const [customVal,  setCustomVal]  = useState(value || '')

  const presetMatch = SKILL_LEVELS.find(l => l.value === value)
  const isCustom    = value > 0 && !presetMatch

  function selectPreset(level) {
    setCustomMode(false)
    onChange(level.value)
  }

  function handleCustomChange(e) {
    const v = Math.min(100, Math.max(0, parseInt(e.target.value) || 0))
    setCustomVal(v)
    onChange(v)
  }

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-gray-700 dark:text-gray-300">{category}</span>
        {value > 0 && (
          <span className="text-xs font-bold text-green-600 dark:text-green-400">{value}%</span>
        )}
      </div>
      <div className="flex flex-wrap gap-1.5">
        {SKILL_LEVELS.map(level => {
          const isActive = !isCustom && !customMode && value === level.value
          const colors   = LEVEL_COLORS[level.color]
          return (
            <button
              key={level.label}
              type="button"
              onClick={() => selectPreset(level)}
              className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all ${isActive ? colors.active : colors.btn} hover:scale-105 active:scale-95`}
            >
              {level.label}{level.value > 0 ? ` ${level.value}%` : ''}
            </button>
          )
        })}
        {/* Custom chip */}
        {customMode || isCustom ? (
          <div className="flex items-center gap-1 bg-green-50 dark:bg-green-950 border border-green-300 dark:border-green-700 rounded-lg px-2 py-0.5">
            <span className="text-xs text-green-600 dark:text-green-400 font-medium">Custom:</span>
            <input
              type="number"
              min={1} max={100}
              value={customVal}
              onChange={handleCustomChange}
              autoFocus
              className="w-12 text-xs font-bold text-green-700 dark:text-green-300 bg-transparent border-none outline-none text-center"
              placeholder="0"
            />
            <span className="text-xs text-green-600 dark:text-green-400">%</span>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => { setCustomMode(true); setCustomVal(value > 0 ? value : '') }}
            className="px-2.5 py-1 rounded-lg text-xs font-medium bg-gray-50 dark:bg-gray-900 border border-dashed border-gray-300 dark:border-gray-700 text-gray-400 dark:text-gray-600 hover:border-green-400 hover:text-green-600 dark:hover:border-green-600 dark:hover:text-green-400 transition-all"
          >
            Custom %
          </button>
        )}
      </div>
    </div>
  )
}

const INITIAL_COMPANIES = [
  {
    id: 1,
    name: 'Azeus Systems Philippines',
    address: 'IT Park, Lanang, Davao City, Davao del Sur',
    lat: 7.0933,
    lng: 125.6341,
    positions: [
      { id: 101, title: 'Frontend Developer Intern',  slots: 3, requirements: { 'Web Development': 70, 'Design': 60, 'Backend': 40 } },
      { id: 102, title: 'Backend Developer Intern',   slots: 2, requirements: { 'Backend': 70, 'Database': 65, 'Web Development': 50 } },
    ],
  },
  {
    id: 2,
    name: 'LGU-Panabo City MIS Office',
    address: 'Panabo City, Davao del Norte',
    lat: 7.3072,
    lng: 125.6839,
    positions: [
      { id: 201, title: 'IT Support Specialist',    slots: 2, requirements: { 'Networking': 65, 'Database': 60 } },
      { id: 202, title: 'Database Encoder Intern',  slots: 1, requirements: { 'Database': 75, 'Web Development': 40 } },
    ],
  },
  {
    id: 3,
    name: 'DNSC ICT Office',
    address: 'Panabo City, Davao del Norte',
    lat: 7.3167,
    lng: 125.6847,
    positions: [
      { id: 301, title: 'Network Technician Intern', slots: 4, requirements: { 'Networking': 80, 'Backend': 30 } },
    ],
  },
  {
    id: 4,
    name: 'Accenture CDO',
    address: 'Cagayan de Oro City, Misamis Oriental',
    lat: 8.4869,
    lng: 124.6475,
    positions: [
      { id: 401, title: 'Backend Intern',      slots: 5, requirements: { 'Backend': 70, 'Database': 60, 'Web Development': 50 } },
      { id: 402, title: 'UI/UX Design Intern', slots: 2, requirements: { 'Design': 75, 'Web Development': 55 } },
    ],
  },
]
// ════════════════════════════════════════════════════════════════

let nextCompanyId  = 10
let nextPositionId = 1000

// ── Admin Nav ────────────────────────────────────────────────────
function AdminNav({ admin }) {
  const navigate = useNavigate()
  const [open,   setOpen]   = useState(false)
  const [notifOpen, setNotifOpen] = useState(false)
  const [mobile, setMobile] = useState(false)
  const [dark,   setDark]   = useState(() => localStorage.getItem('sb-theme') === 'dark')

  function toggleDark() {
    const next = !dark; setDark(next)
    document.documentElement.classList.toggle('dark', next)
    localStorage.setItem('sb-theme', next ? 'dark' : 'light')
  }

  const links = [
    { label: 'Dashboard', path: '/admin/dashboard' },
    { label: 'Companies', path: '/admin/companies', active: true },
    { label: 'Users',     path: '/admin/users'  },
  ]

  return (
    <>
      <nav className="bg-white dark:bg-gray-900 border-b border-gray-100 dark:border-gray-800 px-4 sm:px-6 h-14 flex items-center justify-between sticky top-0 z-10">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 bg-green-600 rounded-lg flex items-center justify-center shrink-0">
            <svg width="16" height="16" viewBox="0 0 26 26" fill="none">
              <path d="M3 18 Q3 10 13 10 Q23 10 23 18" stroke="white" strokeWidth="2.2" strokeLinecap="round"/>
              <path d="M7 18 L7 14M13 18 L13 12M19 18 L19 14" stroke="white" strokeWidth="2.2" strokeLinecap="round"/>
              <circle cx="7" cy="8" r="2.5" fill="white" opacity="0.85"/><circle cx="19" cy="8" r="2.5" fill="white" opacity="0.85"/>
            </svg>
          </div>
          <span className="text-sm font-semibold text-gray-900 dark:text-white">SkillBridge</span>
          <span className="hidden sm:inline text-gray-300 dark:text-gray-700">/</span>
          <span className="hidden sm:inline text-sm text-gray-500 dark:text-gray-400">Admin</span>
        </div>
        <div className="hidden md:flex items-center gap-1">
          {links.map(l => (
            <button key={l.label} onClick={() => navigate(l.path)}
              className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${l.active ? 'bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-white font-medium' : 'text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-50 dark:hover:bg-gray-800'}`}
            >{l.label}</button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          
          <div className="relative hidden sm:block">
            <button onClick={() => { setNotifOpen(p => !p); setOpen(false) }} className="relative p-1.5 rounded-full text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors delay-100">
              <BellIcon />
              <span className="absolute top-1 right-1.5 w-2 h-2 bg-rose-500 rounded-full border-2 border-white dark:border-gray-900 pointer-events-none"></span>
            </button>
            {notifOpen && (
              <div className="absolute right-0 mt-2 w-72 bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-2xl shadow-lg overflow-hidden z-20">
                <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-800 flex justify-between items-center">
                  <p className="text-sm font-bold text-gray-900 dark:text-white">Notifications</p>
                  <span className="text-[10px] uppercase font-bold text-gray-400">3 New</span>
                </div>
                <div className="max-h-64 overflow-y-auto">
                  <div onClick={() => { navigate('/admin/users?tab=pending'); setNotifOpen(false) }} className="px-4 py-3 border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/50 cursor-pointer flex gap-3 transition-colors bg-blue-50/30 dark:bg-blue-900/10">
                    <div className="mt-0.5 w-2 h-2 bg-blue-500 rounded-full shrink-0"></div>
                    <div>
                      <p className="text-sm font-semibold text-gray-900 dark:text-white leading-snug">New Instructor Request</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Alice Walker has requested instructor access.</p>
                      <p className="text-[10px] text-gray-400 mt-1">2 mins ago</p>
                    </div>
                  </div>
                  <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/50 cursor-pointer flex gap-3 transition-colors">
                    <div className="mt-0.5 w-2 h-2 bg-gray-200 dark:bg-gray-700 rounded-full shrink-0"></div>
                    <div>
                      <p className="text-sm font-semibold text-gray-900 dark:text-white leading-snug">Azeus Systems Registered</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">A new company profile was created.</p>
                      <p className="text-[10px] text-gray-400 mt-1">1 hour ago</p>
                    </div>
                  </div>
                  <div className="px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-800/50 cursor-pointer flex gap-3 transition-colors">
                    <div className="mt-0.5 w-2 h-2 bg-gray-200 dark:bg-gray-700 rounded-full shrink-0"></div>
                    <div>
                      <p className="text-sm font-semibold text-gray-900 dark:text-white leading-snug">System Update</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Assessment matching engine updated to v2.0.</p>
                      <p className="text-[10px] text-gray-400 mt-1">1 day ago</p>
                    </div>
                  </div>
                </div>
                <div className="px-4 py-2 bg-gray-50 dark:bg-gray-800/50 text-center border-t border-gray-100 dark:border-gray-800">
                  <button onClick={() => { navigate('/admin/notifications'); setNotifOpen(false) }} className="text-xs font-semibold text-blue-600 hover:text-blue-700 dark:text-blue-400">View All activity</button>
                </div>
              </div>
            )}
          </div>
          
          <button onClick={() => setMobile(p => !p)} className="md:hidden p-2 rounded-lg text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
            {mobile ? <XIcon size={20}/> : <MenuIcon/>}
          </button>
          <div className="relative ml-1">
            <button onClick={() => { setOpen(p => !p); setNotifOpen(false) }} className="w-8 h-8 rounded-full bg-rose-100 dark:bg-rose-900 flex items-center justify-center text-xs font-semibold text-rose-700 dark:text-rose-300 hover:ring-2 hover:ring-rose-400 transition-all">
              {admin.initials}
            </button>
            {open && (
              <div className="absolute right-0 mt-2 w-56 bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-2xl shadow-lg overflow-hidden z-20">
                <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-800">
                  <p className="text-sm font-semibold text-gray-900 dark:text-white truncate">{admin.name}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">Administrator</p>
                </div>
                <div className="px-4 py-3 flex items-center justify-between border-b border-gray-100 dark:border-gray-800">
                  <span className="text-sm text-gray-700 dark:text-gray-300">{dark ? 'Dark mode' : 'Light mode'}</span>
                  <button onClick={toggleDark} className={`relative w-9 h-5 rounded-full transition-colors ${dark ? 'bg-green-600' : 'bg-gray-200'}`}>
                    <span className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${dark ? 'translate-x-4' : 'translate-x-0'}`}/>
                  </button>
                </div>
                <button onClick={() => navigate('/login')} className="w-full text-left px-4 py-3 text-sm text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950 transition-colors">Sign out</button>
              </div>
            )}
          </div>
        </div>
      </nav>
      {mobile && (
        <div className="md:hidden bg-white dark:bg-gray-900 border-b border-gray-100 dark:border-gray-800 px-4 py-3 flex flex-col gap-1 sticky top-14 z-10 shadow-sm">
          {links.map(l => (
            <button key={l.label} onClick={() => { navigate(l.path); setMobile(false) }}
              className={`w-full text-left px-3 py-2.5 rounded-xl text-sm transition-colors ${l.active ? 'bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-white font-medium' : 'text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-50 dark:hover:bg-gray-800'}`}
            >{l.label}</button>
          ))}
        </div>
      )}
    </>
  )
}

// ════════════════════════════════════════════════════════════════
// AddCompanyModal — 2-step: address dropdowns → pin on map
// ════════════════════════════════════════════════════════════════
function AddCompanyModal({ onClose, onAdd }) {
  const [step,         setStep]         = useState(1)
  const [name,         setName]         = useState('')
  const [street,       setStreet]       = useState('')
  const [addrParts,    setAddrParts]    = useState({ province: '', city: '', barangay: '' })
  const [pinned,       setPinned]       = useState(null)   // { lat, lng }
  const [mapCenter,    setMapCenter]    = useState(null)   // geocoded city center
  const [geocoding,    setGeocoding]    = useState(false)
  const [nameErr,      setNameErr]      = useState('')
  const [addrErr,      setAddrErr]      = useState('')

  const [geocodingLabel, setGeocodingLabel] = useState('')

  async function handleAddressChange(addr) {
    setAddrParts(addr)
    setAddrErr('')

    // Geocode whenever we have at least a city.
    // If barangay is also selected we pass it for a more precise zoom.
    if (addr.city) {
      setGeocoding(true)
      setGeocodingLabel(
        addr.barangay
          ? `Locating ${addr.barangay} on map…`
          : `Locating ${addr.city} on map…`
      )
      const coords = await geocodeAddress({
        barangay: addr.barangay,
        city:     addr.city,
        province: addr.province,
      })
      setMapCenter(coords)
      setGeocoding(false)
      setGeocodingLabel('')
    }
  }

  function handleNextStep() {
    if (!name.trim())                              { setNameErr('Company name is required.'); return }
    if (!addrParts.province || !addrParts.city)   { setAddrErr('Please select at least a province and city.'); return }
    setNameErr(''); setAddrErr('')
    setStep(2)
  }

  function handleSubmit() {
    const parts      = [street, addrParts.barangay, addrParts.city, addrParts.province].filter(Boolean)
    const fullAddress = parts.join(', ')
    onAdd({
      id:       ++nextCompanyId,
      name:     name.trim(),
      address:  fullAddress,
      lat:      pinned?.lat ?? null,
      lng:      pinned?.lng ?? null,
      positions: [],
    })
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm px-4">
      <div className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-2xl shadow-xl w-full max-w-lg p-6 space-y-5 max-h-[92vh] overflow-y-auto">

        {/* Header */}
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-gray-900 dark:text-white">Add Company / Institution</h2>
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
              {step === 1 ? 'Fill in the company details and address.' : 'Pin the exact location on the map.'}
            </p>
          </div>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-xl text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors shrink-0">
            <XIcon size={16}/>
          </button>
        </div>

        {/* Step indicator */}
        <div className="flex items-center gap-2">
          {['Company Details', 'Pin Location'].map((label, idx) => {
            const s = idx + 1
            return (
              <div key={s} className="flex items-center gap-2">
                <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold transition-colors
                  ${step >= s ? 'bg-green-600 text-white' : 'bg-gray-100 dark:bg-gray-800 text-gray-400 dark:text-gray-600'}`}>
                  {step > s ? '✓' : s}
                </div>
                <span className={`text-xs transition-colors ${step === s ? 'text-gray-700 dark:text-gray-300 font-medium' : 'text-gray-400 dark:text-gray-600'}`}>
                  {label}
                </span>
                {s < 2 && <div className={`h-0.5 w-6 rounded-full mx-1 transition-colors ${step > s ? 'bg-green-600' : 'bg-gray-100 dark:bg-gray-800'}`} />}
              </div>
            )
          })}
        </div>

        {/* ── STEP 1 ── */}
        {step === 1 && (
          <div className="space-y-4">

            {/* Company name */}
            <div>
              <label className="text-xs font-medium text-gray-700 dark:text-gray-300 block mb-1">
                Company / Institution Name <span className="text-rose-500">*</span>
              </label>
              <input
                value={name}
                onChange={e => { setName(e.target.value); setNameErr('') }}
                placeholder="e.g. Azeus Systems Philippines"
                className={`w-full px-3 py-2 text-sm rounded-xl border bg-white dark:bg-gray-800 text-gray-900 dark:text-white
                  placeholder:text-gray-400 dark:placeholder:text-gray-600 focus:outline-none focus:ring-2 focus:ring-green-500
                  ${nameErr ? 'border-rose-400' : 'border-gray-200 dark:border-gray-700'}`}
              />
              {nameErr && <p className="text-xs text-rose-500 mt-1">{nameErr}</p>}
            </div>

            {/* Street / building */}
            <div>
              <label className="text-xs font-medium text-gray-700 dark:text-gray-300 block mb-1">
                Street / Building / Unit
                <span className="text-gray-400 dark:text-gray-600 font-normal ml-1">(optional)</span>
              </label>
              <input
                value={street}
                onChange={e => setStreet(e.target.value)}
                placeholder="e.g. IT Park, Km 7, 3rd Floor"
                className="w-full px-3 py-2 text-sm rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800
                  text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-gray-600
                  focus:outline-none focus:ring-2 focus:ring-green-500"
              />
            </div>

            {/* PSGC address dropdowns */}
            <div>
              <p className="text-xs font-medium text-gray-700 dark:text-gray-300 mb-2">
                Address <span className="text-rose-500">*</span>
              </p>
              <AddressDropdowns
                onChange={handleAddressChange}
                error={addrErr}
              />
              {geocoding && (
                <p className="text-xs text-green-600 dark:text-green-400 mt-1.5 flex items-center gap-1">
                  <span className="inline-block w-3 h-3 border-2 border-green-500 border-t-transparent rounded-full animate-spin"/>
                  {geocodingLabel}
                </p>
              )}
            </div>

            <div className="flex gap-2 pt-1">
              <button onClick={onClose}
                className="flex-1 py-2 rounded-xl text-sm font-medium bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors">
                Cancel
              </button>
              <button onClick={handleNextStep}
                className="flex-1 py-2 rounded-xl text-sm font-medium bg-green-600 hover:bg-green-700 text-white transition-colors flex items-center justify-center gap-1.5">
                Next: Pin Location
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
              </button>
            </div>
          </div>
        )}

        {/* ── STEP 2 ── */}
        {step === 2 && (
          <div className="space-y-4">

            {/* Address preview card */}
            <div className="bg-gray-50 dark:bg-gray-800 rounded-xl px-4 py-3 flex items-start gap-3">
              <div className="w-8 h-8 rounded-lg bg-green-100 dark:bg-green-900 flex items-center justify-center shrink-0 text-green-700 dark:text-green-300 mt-0.5">
                <PinIcon />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-gray-900 dark:text-white truncate">{name}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                  {[street, addrParts.barangay, addrParts.city, addrParts.province].filter(Boolean).join(', ')}
                </p>
              </div>
            </div>

            {/* Pin map */}
            <div>
              <p className="text-xs font-medium text-gray-700 dark:text-gray-300 mb-2">
                Exact Location
                <span className="text-gray-400 dark:text-gray-600 font-normal ml-1">— tap to place pin, drag to adjust</span>
              </p>
              <PinMap center={mapCenter} pinned={pinned} onPin={setPinned} />
              <div className="mt-2 min-h-20px">
                {pinned ? (
                  <p className="text-xs text-green-600 dark:text-green-400 text-center flex items-center justify-center gap-1">
                    <PinIcon /> Pinned at {pinned.lat.toFixed(5)}, {pinned.lng.toFixed(5)}
                  </p>
                ) : (
                  <p className="text-xs text-gray-400 dark:text-gray-600 text-center">
                    No pin yet — you can still add the company without one.
                  </p>
                )}
              </div>
            </div>

            <div className="flex gap-2 pt-1">
              <button onClick={() => setStep(1)}
                className="flex-1 py-2 rounded-xl text-sm font-medium bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors flex items-center justify-center gap-1.5">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
                Back
              </button>
              <button onClick={handleSubmit}
                className="flex-1 py-2 rounded-xl text-sm font-medium bg-green-600 hover:bg-green-700 text-white transition-colors">
                {pinned ? 'Add Company' : 'Add Without Pin'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Add Position Modal ────────────────────────────────────────────
function AddPositionModal({ companyName, onClose, onAdd }) {
  const [title,       setTitle]       = useState('')
  const [slots,       setSlots]       = useState(1)
  const [reqs,        setReqs]        = useState({})
  const [categories,  setCategories]  = useState(SKILL_CATEGORIES_FALLBACK)
  const [loadingCats, setLoadingCats] = useState(true)
  const [error,       setError]       = useState('')

  // Load real categories from API on mount; fall back to hardcoded list if API not yet wired
  useEffect(() => {
    const api = { get: (url) => fetch('http://127.0.0.1:8000' + url, {
      headers: { Authorization: `Bearer ${localStorage.getItem('sb-token')}` }
    }).then(r => r.json()) }
    api.get('/api/categories/').then(data => {
      const names = Array.isArray(data) ? data.map(c => c.name) : []
      const cats  = names.length > 0 ? names : SKILL_CATEGORIES_FALLBACK
      setCategories(cats)
      setReqs(Object.fromEntries(cats.map(c => [c, 0])))
    }).catch(() => {
      setReqs(Object.fromEntries(SKILL_CATEGORIES_FALLBACK.map(c => [c, 0])))
    }).finally(() => setLoadingCats(false))
  }, [])

  function handleSubmit() {
    if (!title.trim()) { setError('Position title is required.'); return }
    if (slots < 1)     { setError('Slots must be at least 1.'); return }
    const filteredReqs = Object.fromEntries(Object.entries(reqs).filter(([, v]) => v > 0))
    onAdd({ id: ++nextPositionId, title: title.trim(), slots: Number(slots), requirements: filteredReqs })
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm px-4">
      <div className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-2xl shadow-xl w-full max-w-lg p-6 space-y-5 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base font-semibold text-gray-900 dark:text-white">Add Position</h2>
            <p className="text-xs text-gray-500 dark:text-gray-400">{companyName}</p>
          </div>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-xl text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"><XIcon size={16}/></button>
        </div>

        {error && <p className="text-xs text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950 border border-rose-100 dark:border-rose-900 rounded-lg px-3 py-2">{error}</p>}

        <div className="space-y-4">
          {/* Title */}
          <div>
            <label className="text-xs font-medium text-gray-700 dark:text-gray-300 block mb-1">Position Title <span className="text-rose-500">*</span></label>
            <input value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. Frontend Developer Intern"
              className="w-full px-3 py-2 text-sm rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-gray-600 focus:outline-none focus:ring-2 focus:ring-green-500"/>
          </div>

          {/* Slots */}
          <div>
            <label className="text-xs font-medium text-gray-700 dark:text-gray-300 block mb-1">Available Slots <span className="text-rose-500">*</span></label>
            <input type="number" min={1} value={slots} onChange={e => setSlots(e.target.value)}
              className="w-28 px-3 py-2 text-sm rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-green-500"/>
          </div>

          {/* Skill level selectors */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <label className="text-xs font-medium text-gray-700 dark:text-gray-300">Minimum Skill Requirements</label>
              <span className="text-[10px] text-gray-400 dark:text-gray-600">tap a level to set requirement</span>
            </div>

            {loadingCats ? (
              <div className="flex items-center gap-2 py-3 text-xs text-gray-400">
                <span className="w-3 h-3 border-2 border-green-500 border-t-transparent rounded-full animate-spin inline-block"/>
                Loading skill categories…
              </div>
            ) : (
              <div className="space-y-4 bg-gray-50 dark:bg-gray-800/50 rounded-xl p-4">
                {categories.map(cat => (
                  <SkillLevelSelector
                    key={cat}
                    category={cat}
                    value={reqs[cat] ?? 0}
                    onChange={v => setReqs(r => ({ ...r, [cat]: v }))}
                  />
                ))}
              </div>
            )}

            {/* Summary tags */}
            {Object.values(reqs).some(v => v > 0) && (
              <div className="mt-3 flex flex-wrap gap-1.5">
                {Object.entries(reqs).filter(([, v]) => v > 0).map(([cat, v]) => (
                  <span key={cat} className="text-xs bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300 px-2.5 py-1 rounded-full font-medium">
                    {cat.split(' ')[0]} ≥{v}%
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="flex gap-2 pt-1">
          <button onClick={onClose} className="flex-1 py-2 rounded-xl text-sm font-medium bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors">Cancel</button>
          <button onClick={handleSubmit} className="flex-1 py-2 rounded-xl text-sm font-medium bg-green-600 hover:bg-green-700 text-white transition-colors">Add Position</button>
        </div>
      </div>
    </div>
  )
}



// ════════════════════════════════════════════════════════════════
// Main Page
// ════════════════════════════════════════════════════════════════
export default function AdminCompanies() {
  const [companies,      setCompanies]      = useState(INITIAL_COMPANIES)
  const [showAddCompany, setShowAddCompany] = useState(false)
  const [addPositionFor, setAddPositionFor] = useState(null)
  const [search,         setSearch]         = useState('')
  const [toast,          setToast]          = useState(null)
  const [confirmDelete,  setConfirmDelete]  = useState(null)

  // ── Map lazy-mount state ─────────────────────────────────────────
  // showMap      → controls open/close (CSS animation)
  // mapEverOpened → once true, keeps <CompaniesMap> in the DOM so the
  //                 Leaflet instance isn't destroyed on collapse.
  //                 Leaflet JS is only fetched the very first time.
  const [showMap,       setShowMap]       = useState(false)  // closed by default → faster initial load
  const [mapEverOpened, setMapEverOpened] = useState(false)

  function toggleMap() {
    if (!mapEverOpened) setMapEverOpened(true)
    setShowMap(prev => !prev)
  }

  function showToast(msg) { setToast(msg); setTimeout(() => setToast(null), 3000) }

  function handleAddCompany(company) {
    setCompanies(c => [...c, company])
    showToast(`"${company.name}" added.`)
  }

  function handleDeleteCompany(co) {
    setConfirmDelete({ type: 'company', companyId: co.id, label: co.name })
  }

  function handleDeletePosition(companyId, pos) {
    setConfirmDelete({ type: 'position', companyId, positionId: pos.id, label: pos.title })
  }

  function handleConfirmDelete() {
    if (!confirmDelete) return
    if (confirmDelete.type === 'company') {
      setCompanies(c => c.filter(co => co.id !== confirmDelete.companyId))
      showToast('Company deleted.')
    } else {
      setCompanies(c => c.map(co => co.id === confirmDelete.companyId
        ? { ...co, positions: co.positions.filter(p => p.id !== confirmDelete.positionId) } : co))
      showToast('Position deleted.')
    }
    setConfirmDelete(null)
  }

  function handleAddPosition(companyId, position) {
    setCompanies(c => c.map(co => co.id === companyId ? { ...co, positions: [...co.positions, position] } : co))
    showToast(`"${position.title}" added.`)
  }

  const displayed = search.trim()
    ? companies.filter(co =>
        co.name.toLowerCase().includes(search.toLowerCase()) ||
        co.address.toLowerCase().includes(search.toLowerCase()))
    : companies

  const totalSlots  = companies.reduce((sum, co) => sum + co.positions.reduce((s, p) => s + p.slots, 0), 0)
  const pinnedCount = companies.filter(c => c.lat != null).length

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      <AdminNav admin={ADMIN} />

      {showAddCompany && <AddCompanyModal onClose={() => setShowAddCompany(false)} onAdd={handleAddCompany} />}
      {addPositionFor && (
        <AddPositionModal companyName={addPositionFor.name} onClose={() => setAddPositionFor(null)}
          onAdd={pos => handleAddPosition(addPositionFor.id, pos)} />
      )}
      {confirmDelete && (
        <ConfirmModal
          title={confirmDelete.type === 'company' ? 'Delete company?' : 'Delete position?'}
          message={confirmDelete.type === 'company'
            ? `"${confirmDelete.label}" and all its positions will be permanently removed.`
            : `"${confirmDelete.label}" will be permanently removed.`}
          confirmLabel="Delete"
          onConfirm={handleConfirmDelete}
          onCancel={() => setConfirmDelete(null)}
        />
      )}

      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-gray-900 dark:bg-white text-white dark:text-gray-900 text-sm font-medium px-5 py-3 rounded-2xl shadow-lg flex items-center gap-2">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M20 6L9 17l-5-5" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
          {toast}
        </div>
      )}

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-6">

        {/* ── Page header ──────────────────────────────────────── */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 justify-between">
          <div>
            <h1 className="text-xl font-semibold text-gray-900 dark:text-white">Companies & Positions</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
              {companies.length} companies · {companies.reduce((s, c) => s + c.positions.length, 0)} positions · {totalSlots} total slots
            </p>
          </div>
          <div className="flex items-center gap-2">
            <div className="relative">
              <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z"/>
              </svg>
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search companies…"
                className="pl-8 pr-3 py-1.5 text-sm rounded-full bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-gray-600 focus:outline-none focus:ring-2 focus:ring-green-500 w-44"
              />
            </div>
            <button
              onClick={() => setShowAddCompany(true)}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-green-600 hover:bg-green-700 text-white text-sm font-medium transition-colors"
            >
              <span className="text-base leading-none">+</span> Add Company
            </button>
          </div>
        </div>

        {/* ── Partner Locations Map ─────────────────────────────── */}
        <div className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-2xl overflow-hidden">
          {/* Collapsible header */}
          <button
            onClick={toggleMap}
            className="w-full flex items-center justify-between px-5 py-4 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
          >
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-green-50 dark:bg-green-950 flex items-center justify-center text-green-600 dark:text-green-400">
                <MapIcon />
              </div>
              <div className="text-left">
                <p className="text-sm font-semibold text-gray-900 dark:text-white">Partner Locations</p>
                <p className="text-xs text-gray-400 dark:text-gray-500">
                  {pinnedCount} of {companies.length} companies pinned · click a marker for details
                </p>
              </div>
            </div>
            <div className="text-gray-400 dark:text-gray-500 shrink-0">
              <ChevronDown open={showMap} />
            </div>
          </button>

          {/*
            LAZY MOUNT — <CompaniesMap> only enters the DOM when the user
            first clicks the header. After that it stays mounted so Leaflet
            isn't destroyed on collapse; the CSS max-height handles show/hide.
            This prevents Leaflet from being downloaded on every page load.

            isolation: isolate — creates a new CSS stacking context so that
            Leaflet's internal z-indices (tile pane, marker pane, etc.) are
            fully contained inside this element and never bleed above modals
            on the page, regardless of what z-index the modal uses.
          */}
          {mapEverOpened && (
            <div
              className={`transition-all duration-300 overflow-hidden ${showMap ? 'max-h-380px' : 'max-h-0'}`}
              style={{ isolation: 'isolate' }}
            >
              <div className="px-4 pb-4">
                <CompaniesMap companies={companies} />
              </div>
            </div>
          )}
        </div>

        {/* ── Company cards grid ───────────────────────────────── */}
        {displayed.length === 0 && (
          <div className="text-center py-20 text-gray-400 dark:text-gray-600 text-sm">
            No companies match your search.
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {displayed.map(company => (
            <div key={company.id} className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-2xl overflow-hidden">

              {/* Company header */}
              <div className="px-5 py-4 border-b border-gray-50 dark:border-gray-800 flex items-start justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-9 h-9 rounded-xl bg-violet-100 dark:bg-violet-900 flex items-center justify-center text-sm font-bold text-violet-700 dark:text-violet-300 shrink-0">
                    {company.name[0]}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-gray-900 dark:text-white truncate">{company.name}</p>
                    <p className="text-xs text-gray-400 dark:text-gray-500 flex items-center gap-1 mt-0.5">
                      {company.lat != null && (
                        <span className="text-green-500 shrink-0"><PinIcon /></span>
                      )}
                      <span className="truncate">{company.address}</span>
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => handleDeleteCompany(company)}
                  className="p-1.5 rounded-lg text-gray-300 dark:text-gray-700 hover:text-rose-500 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950 transition-colors shrink-0 mt-0.5"
                  title="Delete company"
                >
                  <TrashIcon size={14}/>
                </button>
              </div>

              {/* Positions list */}
              <div className="px-5 py-3 space-y-2">
                {company.positions.length === 0 && (
                  <p className="text-xs text-gray-400 dark:text-gray-600 py-2 text-center">No positions yet.</p>
                )}
                {company.positions.map(pos => (
                  <div key={pos.id} className="flex items-start justify-between gap-2 rounded-xl bg-gray-50 dark:bg-gray-800 px-3 py-2.5">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-medium text-gray-900 dark:text-white">{pos.title}</p>
                        <span className="text-xs bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 px-2 py-0.5 rounded-full font-medium">
                          {pos.slots} slot{pos.slots !== 1 ? 's' : ''}
                        </span>
                      </div>
                      <div className="flex flex-wrap gap-1 mt-1.5">
                        {Object.entries(pos.requirements).map(([cat, pct]) => (
                          <span key={cat} className="text-xs bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-300 px-2 py-0.5 rounded-full">
                            {cat.split(' ')[0]} ≥{pct}%
                          </span>
                        ))}
                        {Object.keys(pos.requirements).length === 0 && (
                          <span className="text-xs text-gray-300 dark:text-gray-700">No requirements set</span>
                        )}
                      </div>
                    </div>
                    <button
                      onClick={() => handleDeletePosition(company.id, pos)}
                      className="p-1.5 rounded-lg text-gray-300 dark:text-gray-700 hover:text-rose-500 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950 transition-colors shrink-0"
                      title="Delete position"
                    >
                      <XIcon size={13}/>
                    </button>
                  </div>
                ))}
              </div>

              {/* Add position */}
              <div className="px-5 pb-4">
                <button
                  onClick={() => setAddPositionFor(company)}
                  className="w-full py-2 rounded-xl border border-dashed border-gray-200 dark:border-gray-700 text-xs font-medium text-gray-400 dark:text-gray-600 hover:border-green-400 hover:text-green-600 dark:hover:border-green-600 dark:hover:text-green-400 transition-colors"
                >
                  + Add Position
                </button>
              </div>
            </div>
          ))}
        </div>
      </main>
    </div>
  )
}