// src/pages/instructor/InstructorCompanies.jsx
//
// Fully responsive company view for instructors.
// Cards → click → detail modal (bottom-sheet on mobile, centered on desktop).
// Edit modal: AddressDropdowns + drop-pin map (no manual lat/lng typing).

import { useState, useEffect, useRef } from 'react'
import InstructorNav              from '../../components/instructor/InstructorNav'
import AddressDropdowns           from '../../components/AddressDropdowns'
import { useInstructorCompanies } from '../../hooks/instructor/useInstructorCompanies'
import { getInitials }            from '../../utils/formatters'

// ── Leaflet CDN singleton ─────────────────────────────────────────────────────
let _leafletPromise = null
function loadLeaflet() {
  if (_leafletPromise) return _leafletPromise
  _leafletPromise = new Promise(resolve => {
    if (window.L) { resolve(window.L); return }
    const link = Object.assign(document.createElement('link'), {
      rel: 'stylesheet',
      href: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.css',
    })
    document.head.appendChild(link)
    const script = Object.assign(document.createElement('script'), {
      src:    'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.js',
      onload: () => resolve(window.L),
    })
    document.head.appendChild(script)
  })
  return _leafletPromise
}

// ── Nominatim geocoder (free, no key) ────────────────────────────────────────
async function geocodeAddress({ barangay, city, province }) {
  const q    = [barangay, city, province, 'Philippines'].filter(Boolean).join(', ')
  const zoom = barangay ? 17 : city ? 15 : 12
  try {
    const res  = await fetch(
      `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&format=json&limit=1`,
      { headers: { 'User-Agent': 'SkillBridge/1.0' } }
    )
    const [hit] = await res.json()
    if (hit) return { lat: parseFloat(hit.lat), lng: parseFloat(hit.lon), zoom }
  } catch {}
  return { lat: 7.1907, lng: 125.4553, zoom } // fallback: Davao City
}

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
        ${name}
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

function makePinIcon(L) {
  return L.divIcon({
    className: '',
    iconSize:    [28, 36],
    iconAnchor:  [14, 36],
    html: `<svg xmlns="http://www.w3.org/2000/svg" width="28" height="36" viewBox="0 0 28 36"
      style="filter:drop-shadow(0 2px 5px rgba(0,0,0,.4));display:block">
      <path fill="#3b82f6" stroke="white" stroke-width="2"
        d="M14 1C7.4 1 2 6.4 2 13c0 9.5 12 23 12 23S26 22.5 26 13C26 6.4 20.6 1 14 1z"/>
      <circle fill="white" cx="14" cy="13" r="5"/>
    </svg>`,
  })
}

// ── View-only map (detail modal) ──────────────────────────────────────────────
function ViewMap({ company }) {
  const elRef  = useRef(null)
  const mapRef = useRef(null)

  useEffect(() => {
    if (!company?.lat || !company?.lng) return
    let alive = true
    loadLeaflet().then(L => {
      if (!alive || !elRef.current || mapRef.current) return
      const map = L.map(elRef.current, { zoomControl: false })
        .setView([company.lat, company.lng], 15)
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© <a href="https://openstreetmap.org">OpenStreetMap</a>',
        maxZoom: 19,
      }).addTo(map)
      L.control.zoom({ position: 'bottomright' }).addTo(map)
      L.marker([company.lat, company.lng], { icon: makeViewIcon(L, company.name) }).addTo(map)
      setTimeout(() => map.invalidateSize(), 150)
      mapRef.current = map
    })
    return () => { alive = false; mapRef.current?.remove(); mapRef.current = null }
  }, [company?.id]) // eslint-disable-line

  if (!company?.lat || !company?.lng) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 bg-gray-50 dark:bg-gray-800 rounded-2xl border border-dashed border-gray-200 dark:border-gray-700" style={{ height: 180 }}>
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-gray-300 dark:text-gray-600">
          <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/>
        </svg>
        <p className="text-xs text-gray-400 dark:text-gray-600 text-center px-6">No location pinned for this company</p>
      </div>
    )
  }
  return (
    <div className="rounded-2xl overflow-hidden border border-gray-100 dark:border-gray-800" style={{ height: 200, isolation: 'isolate' }}>
      <div ref={elRef} className="w-full h-full" />
    </div>
  )
}

// ── Drop-pin map (edit modal) ─────────────────────────────────────────────────
function PinMap({ center, pinned, onPin }) {
  const elRef  = useRef(null)
  const mapRef = useRef(null)
  const mkRef  = useRef(null)

  useEffect(() => {
    let alive = true
    loadLeaflet().then(L => {
      if (!alive || !elRef.current || mapRef.current) return
      const map = L.map(elRef.current, { zoomControl: false })
        .setView(center ? [center.lat, center.lng] : [7.1907, 125.4553], center?.zoom ?? 13)
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© <a href="https://openstreetmap.org">OpenStreetMap</a>',
        maxZoom: 19,
      }).addTo(map)
      L.control.zoom({ position: 'bottomright' }).addTo(map)
      setTimeout(() => map.invalidateSize(), 150)

      function placeMk(lat, lng) {
        if (mkRef.current) {
          mkRef.current.setLatLng([lat, lng])
        } else {
          mkRef.current = L.marker([lat, lng], { icon: makePinIcon(L), draggable: true }).addTo(map)
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
    return () => { alive = false; mapRef.current?.remove(); mapRef.current = null; mkRef.current = null }
  }, []) // eslint-disable-line

  // Re-center when address changes
  useEffect(() => {
    if (mapRef.current && center) {
      mapRef.current.setView([center.lat, center.lng], center.zoom ?? 15, { animate: true })
    }
  }, [center?.lat, center?.lng, center?.zoom]) // eslint-disable-line

  return (
    <div className="relative rounded-2xl overflow-hidden border border-gray-200 dark:border-gray-700" style={{ height: 220, isolation: 'isolate' }}>
      <div ref={elRef} className="absolute inset-0" />
      {!pinned && (
        <div className="absolute bottom-2 left-1/2 -translate-x-1/2 z-1000 pointer-events-none bg-black/60 text-white text-xs font-medium px-3 py-1.5 rounded-full whitespace-nowrap">
          Tap anywhere to drop a pin
        </div>
      )}
    </div>
  )
}

// ── Match helpers ─────────────────────────────────────────────────────────────
const matchColor = p => p >= 80 ? 'text-green-600 dark:text-green-400' : p >= 60 ? 'text-amber-600 dark:text-amber-400' : 'text-rose-500 dark:text-rose-400'
const matchBg    = p => p >= 80 ? 'bg-green-500' : p >= 60 ? 'bg-amber-500' : 'bg-rose-500'

// ── Icons ─────────────────────────────────────────────────────────────────────
const XIcon      = () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M18 6L6 18M6 6l12 12"/></svg>
const EditIcon   = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
const SearchIcon = () => <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="11" cy="11" r="7"/><path d="M16.5 16.5L21 21"/></svg>
const PinIcon    = () => <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
const BriefIcon  = () => <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2"/></svg>
const HomeIcon   = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
const UserIcon   = () => <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>

// ─────────────────────────────────────────────────────────────────────────────
// Edit Modal — self-contained state. Calls onSave(payload) on submit.
// ─────────────────────────────────────────────────────────────────────────────
function EditModal({ company, saving, saveError, onSave, onClose }) {
  // Basic fields
  const [name,      setName]      = useState(company.name)
  const [nameErr,   setNameErr]   = useState('')

  // Address — show current; "Change" button reveals AddressDropdowns
  const currentAddr = company.address
    ? [company.address.barangay, company.address.city, company.address.province].filter(Boolean).join(', ')
    : ''
  const [changingAddr, setChangingAddr] = useState(false)
  const [newAddr,      setNewAddr]      = useState({ province: '', city: '', barangay: '' })
  const [addrErr,      setAddrErr]      = useState('')

  // Map / pin
  const [pinned,    setPinned]    = useState(
    company.lat && company.lng ? { lat: company.lat, lng: company.lng } : null
  )
  const [mapCenter, setMapCenter] = useState(
    company.lat && company.lng ? { lat: company.lat, lng: company.lng, zoom: 15 } : null
  )
  const [geocoding, setGeocoding] = useState(false)

  // Positions edits
  const [positions, setPositions] = useState(
    (company.positions ?? []).map(p => ({ id: p.id, title: p.title, slots: p.slots }))
  )
  function setPosField(idx, key, val) {
    setPositions(ps => ps.map((p, i) => i === idx ? { ...p, [key]: val } : p))
  }

  // Auto-geocode when address selection changes
  async function handleAddressChange(addr) {
    setNewAddr(addr)
    setAddrErr('')
    if (addr.city) {
      setGeocoding(true)
      const coords = await geocodeAddress(addr)
      setMapCenter(coords)
      setGeocoding(false)
    }
  }

  async function handleSubmit() {
    if (!name.trim()) { setNameErr('Company name is required.'); return }
    if (changingAddr && (!newAddr.province || !newAddr.city)) {
      setAddrErr('Please select at least a province and city.')
      return
    }

    const address = changingAddr
      ? { province: newAddr.province, city: newAddr.city, barangay: newAddr.barangay }
      : (company.address ?? {})

    onSave({
      name:     name.trim(),
      address,
      lat:      pinned?.lat ?? null,
      lng:      pinned?.lng ?? null,
      positions: positions.map(p => ({ id: p.id, title: p.title, slots: parseInt(p.slots) || 0 })),
    })
  }

  // Lock body scroll
  useEffect(() => {
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = '' }
  }, [])

  const inputCls = (err) =>
    `w-full px-3 py-2.5 text-sm rounded-xl border ${err ? 'border-rose-400 dark:border-rose-600' : 'border-gray-200 dark:border-gray-700'} bg-white dark:bg-gray-800 text-gray-900 dark:text-white outline-none focus:border-blue-500 transition-colors`

  return (
    <div className="fixed inset-0 z-60 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm px-0 sm:px-4"
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 w-full sm:max-w-lg rounded-t-3xl sm:rounded-2xl shadow-2xl flex flex-col overflow-hidden"
        style={{ maxHeight: '94vh', animation: 'sheetUp 0.25s cubic-bezier(0.34,1.05,0.64,1) both' }}>

        {/* Drag handle — mobile only */}
        <div className="flex justify-center pt-3 pb-1 sm:hidden shrink-0">
          <div className="w-10 h-1 rounded-full bg-gray-200 dark:bg-gray-700" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100 dark:border-gray-800 shrink-0">
          <div>
            <h2 className="text-sm font-bold text-gray-900 dark:text-white">Edit Company</h2>
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5 truncate max-w-[220px]">{company.name}</p>
          </div>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-xl text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors shrink-0">
            <XIcon />
          </button>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto">
          <div className="p-5 flex flex-col gap-5">

            {/* ── Company name ── */}
            <div>
              <label className="text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider mb-2 block">Company Name</label>
              <input value={name} onChange={e => { setName(e.target.value); setNameErr('') }}
                className={inputCls(nameErr)} placeholder="e.g. Azeus Systems Philippines" />
              {nameErr && <p className="text-xs text-rose-500 mt-1">{nameErr}</p>}
            </div>

            {/* ── Address ── */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider">Address</label>
                {changingAddr
                  ? <button onClick={() => { setChangingAddr(false); setAddrErr('') }}
                      className="text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors">
                      ← Keep current
                    </button>
                  : <button onClick={() => setChangingAddr(true)}
                      className="text-xs font-medium text-blue-600 dark:text-blue-400 hover:underline">
                      Change
                    </button>
                }
              </div>
              {changingAddr ? (
                <div className="flex flex-col gap-1">
                  <AddressDropdowns onChange={handleAddressChange} error={addrErr} />
                  {geocoding && (
                    <p className="text-xs text-blue-600 dark:text-blue-400 flex items-center gap-1.5 mt-1">
                      <span className="w-3 h-3 border-2 border-blue-500 border-t-transparent rounded-full animate-spin inline-block" />
                      Finding location on map…
                    </p>
                  )}
                </div>
              ) : (
                <div className="px-3 py-2.5 bg-gray-50 dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 text-sm text-gray-600 dark:text-gray-300">
                  {currentAddr || <span className="italic text-gray-400">No address set</span>}
                </div>
              )}
            </div>

            {/* ── Map / pin ── */}
            <div>
              <label className="text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider mb-2 block">
                Pin Exact Location
              </label>
              <PinMap center={mapCenter} pinned={pinned} onPin={setPinned} />
              <p className="text-xs text-center mt-1.5">
                {pinned
                  ? <span className="text-blue-600 dark:text-blue-400 font-mono">📍 {pinned.lat.toFixed(5)}, {pinned.lng.toFixed(5)}</span>
                  : <span className="text-gray-400 dark:text-gray-600">Tap the map to place a pin — drag to adjust</span>
                }
              </p>
              {pinned && (
                <button onClick={() => setPinned(null)}
                  className="mt-1 block mx-auto text-xs text-rose-500 dark:text-rose-400 hover:underline">
                  Remove pin
                </button>
              )}
            </div>

            {/* ── Positions ── */}
            {positions.length > 0 && (
              <div>
                <label className="text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider mb-3 block">Positions</label>
                <div className="flex flex-col gap-3">
                  {positions.map((pos, idx) => (
                    <div key={pos.id} className="bg-gray-50 dark:bg-gray-800 rounded-xl p-4 flex flex-col gap-3">
                      <div>
                        <label className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5 block">Title</label>
                        <input value={pos.title} onChange={e => setPosField(idx, 'title', e.target.value)}
                          className={inputCls('')} />
                      </div>
                      <div>
                        <label className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5 block">Slots Available</label>
                        <input type="number" min="0" value={pos.slots} onChange={e => setPosField(idx, 'slots', e.target.value)}
                          className="w-24 px-3 py-2 text-sm rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-white outline-none focus:border-blue-500 transition-colors" />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {saveError && (
              <div className="bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 rounded-xl px-4 py-3">
                <p className="text-xs font-medium text-rose-600 dark:text-rose-400">{saveError}</p>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="shrink-0 border-t border-gray-100 dark:border-gray-800 px-5 py-4 flex gap-3">
          <button onClick={onClose}
            className="flex-1 py-2.5 text-sm font-medium text-gray-600 dark:text-gray-400 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-xl transition-colors">
            Cancel
          </button>
          <button onClick={handleSubmit} disabled={saving}
            className="flex-1 py-2.5 text-sm font-bold bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white rounded-xl transition-colors">
            {saving ? 'Saving…' : 'Save changes'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Company detail modal (view)
// ─────────────────────────────────────────────────────────────────────────────
function CompanyDetailModal({ company, onClose, onEdit }) {
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
          <div className="w-9 h-9 rounded-xl bg-blue-100 dark:bg-blue-900 flex items-center justify-center text-blue-600 dark:text-blue-400 shrink-0">
            <HomeIcon />
          </div>
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
            <button onClick={onEdit}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-800 hover:bg-blue-50 dark:hover:bg-blue-950/40 rounded-xl transition-colors">
              <EditIcon /> Edit
            </button>
            <button onClick={onClose}
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
                            <p className="text-xs text-gray-400">{pos.slots} slot{pos.slots !== 1 ? 's' : ''}</p>
                          </div>
                          <span className={`text-xs font-semibold px-2.5 py-0.5 rounded-full shrink-0 ${
                            pos.matched_count > 0
                              ? 'bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300'
                              : 'bg-gray-100 dark:bg-gray-700 text-gray-400'
                          }`}>{pos.matched_count > 0 ? `${pos.matched_count} matched` : 'None'}</span>
                        </div>
                        {pos.matched_students.length > 0 && (
                          <div className="border-t border-gray-100 dark:border-gray-700 divide-y divide-gray-100 dark:divide-gray-700">
                            {pos.matched_students.map((stu, si) => (
                              <div key={stu.id} className={`flex items-center gap-3 px-4 py-2.5 ${si === 0 ? 'bg-green-50/60 dark:bg-green-950/20' : ''}`}>
                                <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 ${si === 0 ? 'bg-green-600 text-white' : 'bg-gray-200 dark:bg-gray-700 text-gray-500 dark:text-gray-400'}`}>{si + 1}</span>
                                <div className="w-7 h-7 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center text-xs font-semibold text-blue-700 dark:text-blue-300 shrink-0">
                                  {getInitials(stu.name)}
                                </div>
                                <div className="flex-1 min-w-0">
                                  <p className="text-xs font-semibold text-gray-900 dark:text-white truncate">{stu.name}</p>
                                  <p className="text-xs text-gray-400 dark:text-gray-500 truncate">{stu.school_id} · {stu.course}</p>
                                </div>
                                <div className="shrink-0 text-right">
                                  <p className={`text-sm font-bold leading-none ${matchColor(stu.match_score)}`}>{stu.match_score}%</p>
                                  <div className="w-12 h-1 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden mt-1">
                                    <div className={`h-full rounded-full ${matchBg(stu.match_score)}`} style={{ width: `${stu.match_score}%` }} />
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
    .sort((a, b) => b.match_score - a.match_score)[0]

  return (
    <button onClick={onClick}
      className="group w-full text-left bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-2xl p-4 flex flex-col gap-3 active:scale-[0.98] hover:border-blue-200 dark:hover:border-blue-800 hover:shadow-md transition-all duration-200 cursor-pointer">
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-xl bg-blue-100 dark:bg-blue-900 flex items-center justify-center text-blue-600 dark:text-blue-400 shrink-0">
          <HomeIcon />
        </div>
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
          <div className="w-6 h-6 rounded-full bg-green-200 dark:bg-green-800 flex items-center justify-center text-[10px] font-bold text-green-700 dark:text-green-300 shrink-0">
            {getInitials(topEntry.name)}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold text-gray-700 dark:text-gray-300 truncate">{topEntry.name.split(' ')[0]}</p>
            <p className="text-xs text-gray-400 dark:text-gray-500 truncate">{topEntry.posTitle}</p>
          </div>
          <span className="text-xs font-bold text-green-600 dark:text-green-400 shrink-0">{topEntry.match_score}%</span>
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
    companies, allCount, loading,
    search, setSearch,
    editing, openEdit, closeEdit,
    saving, saveError, handleSave,
    toast,
  } = useInstructorCompanies()

  const [selected, setSelected] = useState(null)

  // Keep selected fresh after data changes
  useEffect(() => {
    if (!selected) return
    const fresh = companies.find(c => c.id === selected.id)
    if (fresh) setSelected(fresh)
  }, [companies]) // eslint-disable-line

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      <InstructorNav activePath="/instructor/companies" />

      {/* Toast */}
      {toast && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-70 bg-green-600 text-white text-sm font-medium px-5 py-3 rounded-2xl shadow-lg flex items-center gap-2 whitespace-nowrap pointer-events-none">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M20 6L9 17l-5-5" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
          {toast}
        </div>
      )}

      {/* Detail modal */}
      {selected && !editing && (
        <CompanyDetailModal
          company={selected}
          onClose={() => setSelected(null)}
          onEdit={() => openEdit(selected)}
        />
      )}

      {/* Edit modal */}
      {editing && (
        <EditModal
          company={editing}
          saving={saving}
          saveError={saveError}
          onSave={handleSave}
          onClose={closeEdit}
        />
      )}

      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-6 sm:py-8 flex flex-col gap-5">

        {/* Header */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-lg sm:text-xl font-bold text-gray-900 dark:text-white">Partner Companies</h1>
            <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 mt-0.5">
              {allCount} {allCount === 1 ? 'company' : 'companies'} · tap a card to view details
            </p>
          </div>
          <div className="relative w-full sm:w-60">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"><SearchIcon /></span>
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search…"
              className="w-full pl-9 pr-4 py-2.5 text-sm rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white outline-none focus:border-blue-500 transition-colors" />
          </div>
        </div>

        {/* Loading skeletons */}
        {loading && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
            {[1,2,3,4,5,6].map(i => (
              <div key={i} className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-2xl p-4 animate-pulse flex flex-col gap-3">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-xl bg-gray-200 dark:bg-gray-700 shrink-0" />
                  <div className="flex-1 flex flex-col gap-2 mt-1">
                    <div className="h-3.5 bg-gray-200 dark:bg-gray-700 rounded w-3/4" />
                    <div className="h-3 bg-gray-100 dark:bg-gray-800 rounded w-1/2" />
                  </div>
                </div>
                <div className="flex gap-2">
                  <div className="h-6 bg-gray-100 dark:bg-gray-800 rounded-full w-24" />
                  <div className="h-6 bg-gray-100 dark:bg-gray-800 rounded-full w-20" />
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Empty */}
        {!loading && companies.length === 0 && (
          <div className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-2xl py-16 flex flex-col items-center gap-3">
            <div className="w-14 h-14 rounded-2xl bg-gray-100 dark:bg-gray-800 flex items-center justify-center text-gray-300 dark:text-gray-700"><HomeIcon /></div>
            <p className="text-sm font-medium text-gray-400 dark:text-gray-600">No companies found</p>
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
      </main>

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
