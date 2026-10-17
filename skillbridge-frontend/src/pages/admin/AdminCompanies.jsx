import DataSection from '../../components/DataSection'
// src/pages/admin/AdminCompanies.jsx
//
// Refactored to use useAdminCompanies hook for all state + API logic.
//
// Features:
//   1. Collapsible partner-locations map (Leaflet / OpenStreetMap)
//   2. Company cards — name, address, pin indicator, positions list
//   3. CompanyModal (add + edit mode):
//        Step 1: company name + PSGC AddressDropdowns + optional street
//        Step 2: pin exact location on interactive map
//   4. PositionModal (add + edit mode) — title, slots, skill sliders
//   5. Edit buttons on every company card and position row
//   6. Delete confirmations with optimistic local state
//   7. Loading spinners on all submit buttons
//   8. Real-time updates via SSE (handled in hook)

import { useState, useEffect, useReducer, useRef } from 'react'
import AddressDropdowns from '../../components/AddressDropdowns'
import ConfirmModal    from '../../components/admin/ConfirmModal'
import { useAdminCompanies } from '../../hooks/admin/useAdminCompanies'
import api from '../../api/axios'
import CompanyCollectionCard, { CompanyCollectionSkeleton } from '../../components/admin/CompanyCollectionCard'
import { companyDisclosures } from '../../utils/companyCollection'
import CompanyImageInput from '../../components/CompanyImageInput'
import CompanyEditDialog from '../../components/CompanyEditDialog'
import { BriefcaseIcon, ChevronRightIcon, PinIcon as LocationIcon } from '../../components/Icons'

// ────────────────────────────────────────────────────────────────────────────
// Leaflet — loaded once from CDN, singleton promise prevents duplicate injection
// ────────────────────────────────────────────────────────────────────────────
let _leafletPromise = null
function loadLeaflet() {
  if (_leafletPromise) return _leafletPromise
  _leafletPromise = new Promise(resolve => {
    if (window.L) { resolve(window.L); return }
    const link = Object.assign(document.createElement('link'), {
      rel:  'stylesheet',
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
  let q    = [barangay, city, province, 'Philippines'].filter(Boolean).join(', ')
  let zoom = barangay ? 17 : city ? 15 : 12
  try {
    let res   = await fetch(
      `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&format=json&limit=1`,
      { headers: { 'User-Agent': 'SkillBridge-Admin/1.0' } }
    )
    let hits = await res.json()
    if (hits && hits.length > 0) {
      return { lat: parseFloat(hits[0].lat), lng: parseFloat(hits[0].lon), zoom }
    }

    // Fallback: If barangay search failed, try searching just the city
    if (barangay && city) {
      q = [city, province, 'Philippines'].filter(Boolean).join(', ')
      zoom = 15
      res = await fetch(
        `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&format=json&limit=1`,
        { headers: { 'User-Agent': 'SkillBridge-Admin/1.0' } }
      )
      hits = await res.json()
      if (hits && hits.length > 0) {
        return { lat: parseFloat(hits[0].lat), lng: parseFloat(hits[0].lon), zoom }
      }
    }
  } catch { /* Use the existing map fallback if geocoding is unavailable. */ }
  return { lat: 7.1907, lng: 125.4553, zoom: 12 }  // fallback: Davao City
}

// ── Map icons ─────────────────────────────────────────────────────────────────
function makeCompanyIcon(L, name) {
  return L.divIcon({
    className:   '',
    iconSize:    [28, 36],
    iconAnchor:  [14, 36],
    popupAnchor: [0, -42],
    html: `
      <div style="position:relative;z-index:100">
        <div style="position:absolute;bottom:40px;white-space:nowrap;background:#111827;color:white;
          font-size:10px;font-weight:700;font-family:system-ui,sans-serif;padding:3px 8px;
          border-radius:6px;box-shadow:0 2px 6px rgba(0,0,0,0.35);pointer-events:none;
          transform:translateX(-50%);left:50%;">
          ${name}
          <div style="position:absolute;bottom:-5px;left:50%;transform:translateX(-50%);
            width:0;height:0;border-left:5px solid transparent;border-right:5px solid transparent;
            border-top:6px solid #111827"></div>
        </div>
        <svg xmlns="http://www.w3.org/2000/svg" width="28" height="36" viewBox="0 0 28 36"
          style="filter:drop-shadow(0 2px 5px rgba(0,0,0,0.4));display:block">
          <path fill="#16a34a" stroke="white" stroke-width="2"
            d="M14 1C7.4 1 2 6.4 2 13c0 9.5 12 23 12 23S26 22.5 26 13C26 6.4 20.6 1 14 1z"/>
          <circle fill="white" cx="14" cy="13" r="5"/>
        </svg>
      </div>`,
  })
}

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

// ════════════════════════════════════════════════════════════════════════════
// PinMap — interactive drop-pin map inside modals
// ════════════════════════════════════════════════════════════════════════════
function PinMap({ center, pinned, onPin, height = 248 }) {
  const elRef  = useRef(null)
  const mapRef = useRef(null)
  const mkRef  = useRef(null)

  useEffect(() => {
    let alive = true
    let resizeTimer
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
      resizeTimer = setTimeout(() => map.invalidateSize(), 150)

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
      clearTimeout(resizeTimer)
      mapRef.current?.remove()
      mapRef.current = null
      mkRef.current  = null
    }
  }, []) // eslint-disable-line

  // Re-center whenever address selection changes
  useEffect(() => {
    if (mapRef.current && center) {
      mapRef.current.setView([center.lat, center.lng], center.zoom ?? 15, { animate: true })
    }
  }, [center?.lat, center?.lng, center?.zoom]) // eslint-disable-line

  useEffect(() => {
    if (!pinned && mkRef.current) {
      mkRef.current.remove()
      mkRef.current = null
    }
  }, [pinned])

  return (
    <div className="relative rounded-xl overflow-hidden border border-gray-200 dark:border-gray-700"
      style={{ height, isolation: 'isolate' }}>
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

// ════════════════════════════════════════════════════════════════════════════
// CompaniesMap — overview map showing all partner locations
// ════════════════════════════════════════════════════════════════════════════
function CompaniesMap({ companies }) {
  const elRef  = useRef(null)
  const mapRef = useRef(null)
  const mksRef = useRef([])
  const companiesRef = useRef(companies)
  const markersStale = useRef(false)

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

  useEffect(() => {
    let alive = true
    let resizeObserver
    loadLeaflet().then(L => {
      if (!alive || !elRef.current || mapRef.current) return
      const map = L.map(elRef.current).setView([7.3072, 125.6839], 10)
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© <a href="https://openstreetmap.org">OpenStreetMap</a>',
        maxZoom: 19,
      }).addTo(map)
      map.zoomControl.setPosition('bottomright')
      if (elRef.current.clientWidth) buildMarkers(L, map, companiesRef.current)
      else markersStale.current = true
      mapRef.current = map
      // Keep the same instance while collapsed. Leaflet must measure again
      // after display:none is removed, and when the responsive width changes.
      resizeObserver = new ResizeObserver(() => {
        if (elRef.current?.clientWidth && elRef.current?.clientHeight) {
          map.invalidateSize({ pan: false })
          if (markersStale.current) {
            buildMarkers(L, map, companiesRef.current)
            markersStale.current = false
          }
        }
      })
      resizeObserver.observe(elRef.current)
    })
    return () => {
      alive = false
      resizeObserver?.disconnect()
      mapRef.current?.remove()
      mapRef.current = null
    }
  }, [])

  useEffect(() => {
    companiesRef.current = companies
    if (!mapRef.current || !window.L) return
    if (!elRef.current?.clientWidth) { markersStale.current = true; return }
    buildMarkers(window.L, mapRef.current, companies)
  }, [companies]) // eslint-disable-line

  return (
    <div ref={elRef} className="h-64 w-full overflow-hidden rounded-xl sm:h-80"
      style={{ isolation: 'isolate' }} />
  )
}

// ── Icons ─────────────────────────────────────────────────────────────────────
const TrashIcon = ({ size = 14 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
    <path d="M10 11v6M14 11v6M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
  </svg>
)
const PencilIcon = ({ size = 14 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
  </svg>
)
const XIcon = ({ size = 14 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
    <path d="M18 6L6 18M6 6l12 12"/>
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
const ArrowRight = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
    <path d="M5 12h14M12 5l7 7-7 7"/>
  </svg>
)
const ArrowLeft = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
    <path d="M19 12H5M12 19l-7-7 7-7"/>
  </svg>
)

// ── Spinner ───────────────────────────────────────────────────────────────────
function Spinner() {
  return (
    <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
    </svg>
  )
}

// ── Skill level presets ───────────────────────────────────────────────────────
const SKILL_LEVELS = [
  { label: 'Not Required', value: 0,  color: 'gray'   },
  { label: 'Beginner',     value: 25, color: 'gray'   },
  { label: 'Competent',    value: 50, color: 'yellow' },
  { label: 'Proficient',   value: 75, color: 'blue'   },
  { label: 'Expert',       value: 90, color: 'green'  },
]
const LEVEL_COLORS = {
  gray:   { btn: 'bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400',   active: 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-200 ring-1 ring-gray-400 dark:ring-gray-500' },
  blue:   { btn: 'bg-blue-50 dark:bg-blue-950 text-blue-500 dark:text-blue-400',    active: 'bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-200 ring-1 ring-blue-400 dark:ring-blue-500' },
  yellow: { btn: 'bg-yellow-50 dark:bg-yellow-950 text-yellow-600 dark:text-yellow-400', active: 'bg-yellow-100 dark:bg-yellow-900 text-yellow-700 dark:text-yellow-200 ring-1 ring-yellow-400 dark:ring-yellow-500' },
  orange: { btn: 'bg-orange-50 dark:bg-orange-950 text-orange-500 dark:text-orange-400', active: 'bg-orange-100 dark:bg-orange-900 text-orange-700 dark:text-orange-200 ring-1 ring-orange-400 dark:ring-orange-500' },
  green:  { btn: 'bg-green-50 dark:bg-green-950 text-green-600 dark:text-green-400', active: 'bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-200 ring-1 ring-green-400 dark:ring-green-500' },
}

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
        {value > 0 && <span className="text-xs font-bold text-green-600 dark:text-green-400">{value}%</span>}
      </div>
      <div className="flex flex-wrap gap-1.5">
        {SKILL_LEVELS.map(level => {
          const isActive = !isCustom && !customMode && value === level.value
          const colors   = LEVEL_COLORS[level.color]
          return (
            <button key={level.label} type="button" onClick={() => selectPreset(level)}
              className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all
                ${isActive ? colors.active : colors.btn} hover:scale-105 active:scale-95`}>
              {level.label}{level.value > 0 ? ` ${level.value}%` : ''}
            </button>
          )
        })}
        {customMode || isCustom ? (
          <div className="flex items-center gap-1 bg-green-50 dark:bg-green-950 border border-green-300 dark:border-green-700 rounded-lg px-2 py-0.5">
            <span className="text-xs text-green-600 dark:text-green-400 font-medium">Custom:</span>
            <input type="number" min={1} max={100} value={customVal} onChange={handleCustomChange} autoFocus
              className="w-12 text-xs font-bold text-green-700 dark:text-green-300 bg-transparent border-none outline-none text-center"
              placeholder="0"/>
            <span className="text-xs text-green-600 dark:text-green-400">%</span>
          </div>
        ) : (
          <button type="button" onClick={() => { setCustomMode(true); setCustomVal(value > 0 ? value : '') }}
            className="px-2.5 py-1 rounded-lg text-xs font-medium bg-gray-50 dark:bg-gray-900 border border-dashed border-gray-300 dark:border-gray-700 text-gray-400 dark:text-gray-600 hover:border-green-400 hover:text-green-600 dark:hover:border-green-600 dark:hover:text-green-400 transition-all">
            Custom %
          </button>
        )}
      </div>
    </div>
  )
}

// ════════════════════════════════════════════════════════════════════════════
// CompanyModal — two-step creation and a spacious single-screen editor
//
// mode='add'  → blank form, "Add Company" submit
// mode='edit' → pre-filled from initialData, "Save Changes" submit
//   • Step 1: name, optional street, PSGC address (edit: show current + "Change" toggle)
//   • Step 2: interactive pin map (edit: pre-centered on existing pin)
// ════════════════════════════════════════════════════════════════════════════
function CompanyModal({ mode = 'add', initialData = null, onClose, onSubmit }) {
  const [image, setImage] = useState({ action: 'unchanged', file: null, error: '' })
  const [saveError, setSaveError] = useState('')
  const isEdit = mode === 'edit'

  const [step,    setStep]    = useState(1)
  const [name,    setName]    = useState(initialData?.name || '')
  const [street,  setStreet]  = useState(initialData?.addressParts?.street || '')

  // addrParts is the "new" address when user selects from dropdowns
  const [addrParts,  setAddrParts]  = useState({ province: '', city: '', barangay: '' })
  // changeAddr: edit-mode toggle — show PSGC dropdowns to change address
  const [changeAddr, setChangeAddr] = useState(false)

  // Pin state — pre-seed from initialData in edit mode
  const [pinned, setPinned] = useState(
    (initialData?.lat != null && initialData?.lng != null)
      ? { lat: initialData.lat, lng: initialData.lng }
      : null
  )
  const [mapCenter, setMapCenter] = useState(
    (initialData?.lat != null && initialData?.lng != null)
      ? { lat: initialData.lat, lng: initialData.lng, zoom: 15 }
      : null
  )

  const [geocoding,     setGeocoding]     = useState(false)
  const [geocodingLabel, setGeocodingLabel] = useState('')
  const [nameErr,       setNameErr]       = useState('')
  const [addrErr,       setAddrErr]       = useState('')
  const [saving,        setSaving]        = useState(false)

  // Geocode whenever PSGC selection changes (add mode or changeAddr edit mode)
  async function handleAddressChange(addr) {
    setAddrParts(addr)
    setAddrErr('')
    if (addr.city) {
      setGeocoding(true)
      setGeocodingLabel(addr.barangay
        ? `Locating ${addr.barangay} on map…`
        : `Locating ${addr.city} on map…`)
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

  function validateDetails() {
    if (!name.trim()) { setNameErr('Company name is required.'); return false }
    // Address validation: required in add mode, or in edit mode when changing address
    if (!isEdit || changeAddr) {
      if (!addrParts.province || !addrParts.city) {
        setAddrErr('Please select at least a province and city.')
        return false
      }
    }
    setNameErr(''); setAddrErr('')
    return true
  }

  function handleNextStep() {
    if (!validateDetails()) return
    setStep(2)
  }

  async function handleSubmit() {
    if (image.error || saving || !validateDetails()) return
    setSaveError('')
    // Build the final addressParts to submit
    const finalAddrParts = (isEdit && !changeAddr)
      ? { ...(initialData?.addressParts || {}), street: street.trim() }
      : { ...addrParts, street: street.trim() }

    setSaving(true)
    const result = await onSubmit({
      ...(initialData || {}),
      name:         name.trim(),
      addressParts: finalAddrParts,
      image,
      lat:          pinned?.lat ?? null,
      lng:          pinned?.lng ?? null,
    })
    setSaving(false)
    if (result?.ok) onClose()
    else setSaveError(result?.message || 'Could not save company. Your input is preserved; please retry.')
  }

  // Address preview string shown in Step 2
  const previewAddress = (isEdit && !changeAddr)
    ? (initialData?.address || '')
    : [street, addrParts.barangay, addrParts.city, addrParts.province].filter(Boolean).join(', ')

  const inputCls = (err) =>
    `w-full px-3 py-2 text-sm rounded-xl border bg-white dark:bg-gray-800 text-gray-900 dark:text-white
     placeholder:text-gray-400 dark:placeholder:text-gray-600 focus:outline-none focus:ring-2 focus:ring-green-500
     ${err ? 'border-rose-400' : 'border-gray-200 dark:border-gray-700'}`

  if (isEdit) return <CompanyEditDialog saving={saving} saveError={saveError} invalid={Boolean(image.error)}
    onSave={handleSubmit} onClose={onClose} saveLabel="Save Changes"
    details={<>
      <div>
        <label htmlFor="company-edit-name" className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">Company name <span className="text-rose-500">*</span></label>
        <input id="company-edit-name" value={name} onChange={e => { setName(e.target.value); setNameErr('') }}
          placeholder="e.g. Azeus Systems Philippines" className={inputCls(nameErr)} aria-invalid={Boolean(nameErr)} />
        {nameErr && <p className="mt-1 text-xs text-rose-600">{nameErr}</p>}
      </div>
      <CompanyImageInput name={name} imageUrl={initialData?.image_url} value={image} onChange={setImage} disabled={saving} />
      <div>
        <label htmlFor="company-edit-street" className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">Street / Building / Unit <span className="ml-1 font-normal text-gray-400">(optional)</span></label>
        <input id="company-edit-street" value={street} onChange={e => setStreet(e.target.value)}
          placeholder="e.g. IT Park, Km 7, 3rd Floor" className={inputCls('')} />
      </div>
      <details className="company-edit-positions">
        <summary>
          <span aria-hidden="true" className="text-slate-500 dark:text-gray-400"><BriefcaseIcon size={23} /></span>
          <span className="min-w-0"><span className="block text-sm font-semibold text-gray-900 dark:text-gray-100">Positions <span className="ml-1 font-normal text-gray-400">({initialData.positions.length})</span></span>
            <span className="mt-0.5 block text-xs text-gray-500 dark:text-gray-400">View roles associated with this company</span></span>
          <ChevronRightIcon size={18} />
        </summary>
        <div className="company-edit-positions-content space-y-2">
          {initialData.positions.map(position => <div key={position.id} className="flex items-start justify-between gap-3 rounded-lg bg-gray-50 px-3 py-2 text-xs dark:bg-gray-800">
            <span className="min-w-0 break-words font-medium">{position.title}</span><span className="shrink-0 text-gray-500 dark:text-gray-400">{position.slots} slots</span>
          </div>)}
          <p className="text-xs leading-5 text-gray-500 dark:text-gray-400">Add or edit positions from the company card.</p>
        </div>
      </details>
    </>}
    location={<>
      <div>
        <div className="mb-2 flex items-center justify-between gap-3">
          <p className="text-sm font-medium text-gray-700 dark:text-gray-300">Address</p>
          <button type="button" onClick={() => { setChangeAddr(!changeAddr); setAddrErr('') }}
            className="min-h-9 rounded-lg border border-blue-100 bg-blue-50 px-3 text-xs font-semibold text-blue-600 hover:bg-blue-100 dark:border-blue-900 dark:bg-blue-950/40 dark:text-blue-300">
            {changeAddr ? 'Keep current address' : 'Change address'}
          </button>
        </div>
        {changeAddr ? <AddressDropdowns onChange={handleAddressChange} error={addrErr} />
          : <div className="rounded-xl border border-gray-200 bg-gray-50/70 px-4 py-3 text-sm leading-6 text-gray-600 dark:border-gray-700 dark:bg-gray-800/40 dark:text-gray-300">{initialData.address || 'No address set'}</div>}
        {geocoding && <p className="mt-2 text-xs text-blue-600 dark:text-blue-400">{geocodingLabel}</p>}
      </div>
      <div>
        <p className="text-sm font-medium text-gray-700 dark:text-gray-300">Map location</p>
        <p className="mb-3 mt-1 text-xs text-gray-500 dark:text-gray-400">Click the map to place a pin. Drag it to adjust the location.</p>
        <PinMap center={mapCenter} pinned={pinned} onPin={setPinned} height={300} />
        <div className="mt-3 flex min-h-9 items-center justify-between gap-3 text-xs">
          <span className="flex min-w-0 items-center gap-2 text-gray-500 dark:text-gray-400"><LocationIcon size={15} />
            {pinned ? `${pinned.lat.toFixed(5)}, ${pinned.lng.toFixed(5)}` : 'No pin set. You can save without one.'}
          </span>
          {pinned && <button type="button" onClick={() => setPinned(null)} className="shrink-0 rounded-lg px-2 py-2 text-gray-500 hover:bg-gray-100 hover:text-rose-600 dark:text-gray-400 dark:hover:bg-gray-800">Clear pin</button>}
        </div>
      </div>
    </>} />

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm px-4">
      <div className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-2xl shadow-xl w-full max-w-lg p-6 space-y-5 max-h-[92vh] overflow-y-auto">

        {/* Header */}
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-gray-900 dark:text-white">
              {isEdit ? 'Edit Company' : 'Add Company / Institution'}
            </h2>
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
              {step === 1 ? 'Fill in the company details and address.' : 'Pin the exact location on the map.'}
            </p>
          </div>
          <button onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-xl text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors shrink-0">
            <XIcon size={16}/>
          </button>
        </div>

        {/* Step indicator */}
        {saveError && <p role="alert" className="text-xs text-rose-600">{saveError}</p>}
        <div className="flex items-center gap-2">
          {['Company Details', 'Pin Location'].map((label, idx) => {
            const s = idx + 1
            return (
              <div key={s} className="flex items-center gap-2">
                <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold transition-colors
                  ${step >= s ? 'bg-green-600 text-white' : 'bg-gray-100 dark:bg-gray-800 text-gray-400 dark:text-gray-600'}`}>
                  {step > s ? '✓' : s}
                </div>
                <span className={`text-xs transition-colors
                  ${step === s ? 'text-gray-700 dark:text-gray-300 font-medium' : 'text-gray-400 dark:text-gray-600'}`}>
                  {label}
                </span>
                {s < 2 && (
                  <div className={`h-0.5 w-6 rounded-full mx-1 transition-colors
                    ${step > s ? 'bg-green-600' : 'bg-gray-100 dark:bg-gray-800'}`} />
                )}
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
              <input value={name} onChange={e => { setName(e.target.value); setNameErr('') }}
                placeholder="e.g. Azeus Systems Philippines"
                className={inputCls(nameErr)} />
              {nameErr && <p className="text-xs text-rose-500 mt-1">{nameErr}</p>}
            </div>

            {/* Street / building */}
            <CompanyImageInput name={name} imageUrl={initialData?.image_url} value={image} onChange={setImage} disabled={saving} />
            <div>
              <label className="text-xs font-medium text-gray-700 dark:text-gray-300 block mb-1">
                Street / Building / Unit
                <span className="text-gray-400 dark:text-gray-600 font-normal ml-1">(optional)</span>
              </label>
              <input value={street} onChange={e => setStreet(e.target.value)}
                placeholder="e.g. IT Park, Km 7, 3rd Floor"
                className={inputCls('')} />
            </div>

            {/* Address — readonly preview in edit mode, with "Change" toggle */}
            <div>
              {isEdit && !changeAddr ? (
                <>
                  <div className="flex items-center justify-between mb-1">
                    <p className="text-xs font-medium text-gray-700 dark:text-gray-300">Address</p>
                    <button type="button" onClick={() => setChangeAddr(true)}
                      className="text-xs font-medium text-green-600 dark:text-green-400 hover:underline">
                      Change
                    </button>
                  </div>
                  <div className="px-3 py-2 bg-gray-50 dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 text-sm text-gray-600 dark:text-gray-300">
                    {initialData?.address || 'No address set'}
                  </div>
                </>
              ) : (
                <>
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-xs font-medium text-gray-700 dark:text-gray-300">
                      Address <span className="text-rose-500">*</span>
                    </p>
                    {isEdit && (
                      <button type="button" onClick={() => { setChangeAddr(false); setAddrErr('') }}
                        className="text-xs text-gray-400 dark:text-gray-600 hover:text-gray-600 dark:hover:text-gray-400 transition-colors">
                        ← Keep current address
                      </button>
                    )}
                  </div>
                  <AddressDropdowns onChange={handleAddressChange} error={addrErr} />
                  {geocoding && (
                    <p className="text-xs text-green-600 dark:text-green-400 mt-1.5 flex items-center gap-1">
                      <span className="inline-block w-3 h-3 border-2 border-green-500 border-t-transparent rounded-full animate-spin"/>
                      {geocodingLabel}
                    </p>
                  )}
                  {addrErr && <p className="text-xs text-rose-500 mt-1">{addrErr}</p>}
                </>
              )}
            </div>

            <div className="flex gap-2 pt-1">
              <button onClick={onClose}
                className="flex-1 py-2 rounded-xl text-sm font-medium bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors">
                Cancel
              </button>
              <button onClick={handleNextStep} disabled={Boolean(image.error)}
                className="flex-1 py-2 rounded-xl text-sm font-medium bg-green-600 hover:bg-green-700 text-white transition-colors flex items-center justify-center gap-1.5">
                Next: Pin Location <ArrowRight />
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
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{previewAddress || 'Address not specified'}</p>
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
                    No pin yet — you can still save without one.
                  </p>
                )}
              </div>
            </div>

            <div className="flex gap-2 pt-1">
              <button onClick={() => setStep(1)}
                className="flex-1 py-2 rounded-xl text-sm font-medium bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors flex items-center justify-center gap-1.5">
                <ArrowLeft /> Back
              </button>
              <button onClick={handleSubmit} disabled={saving || Boolean(image.error)}
                className="flex-1 py-2 rounded-xl text-sm font-medium bg-green-600 hover:bg-green-700 disabled:opacity-60 disabled:cursor-not-allowed text-white transition-colors flex items-center justify-center gap-1.5">
                {saving
                  ? <><Spinner /> Saving…</>
                  : isEdit
                    ? 'Save Changes'
                    : pinned ? 'Add Company' : 'Add Without Pin'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ════════════════════════════════════════════════════════════════════════════
// PositionModal — unified add + edit
//
// mode='add'  → blank form, "Add Position" submit
// mode='edit' → pre-filled from initialData, "Save Changes" submit
//   categories prop comes from hook (already loaded, no internal fetch needed)
// ════════════════════════════════════════════════════════════════════════════
function PositionModal({ mode = 'add', companyName, initialData = null, categories, onClose, onSubmit }) {
  const isEdit = mode === 'edit'

  const [title,  setTitle]  = useState(initialData?.title || '')
  const [slots,  setSlots]  = useState(initialData?.slots ?? 1)
  const [tags,   setTags]   = useState((initialData?.tags || []).join(', '))
  const [suggesting, setSuggesting] = useState(false)
  const [error,  setError]  = useState('')
  const [saving, setSaving] = useState(false)

  // Initialize requirements: all categories at 0, then overlay existing values
  const [reqs, setReqs] = useState(() => {
    const base = Object.fromEntries(categories.map(c => [c, 0]))
    if (initialData?.requirements) {
      Object.entries(initialData.requirements).forEach(([cat, pct]) => {
        base[cat] = pct  // includes cats not in current list (keeps data integrity)
      })
    }
    return base
  })

  // Safely add any new categories loaded after modal opens (without resetting existing values)
  useEffect(() => {
    setReqs(prev => {
      const next = { ...prev }
      categories.forEach(c => { if (!(c in next)) next[c] = 0 })
      return next
    })
  }, [categories]) // eslint-disable-line

  async function handleSubmit() {
    if (!title.trim()) { setError('Position title is required.'); return }
    if (Number(slots) < 1) { setError('Slots must be at least 1.'); return }

    const filteredReqs = Object.fromEntries(
      Object.entries(reqs).filter(([, v]) => v > 0)
    )

    setSaving(true)
    const result = await onSubmit({
      ...(initialData || {}),
      title:        title.trim(),
      slots:        Number(slots),
      requirements: filteredReqs,
      tags: tags.split(',').map(tag => tag.trim()).filter(Boolean),
    })
    setSaving(false)
    if (result?.ok) onClose()
  }

  async function handleSuggestTags() {
    if (!title.trim()) { setError('Enter a position title before suggesting tags.'); return }
    setSuggesting(true)
    try {
      const requirements = Object.fromEntries(Object.entries(reqs).filter(([, value]) => value > 0))
      const res = await api.post('/api/tags/suggest/', { type: 'position', title, requirements })
      setTags((res.data?.suggested_tags || []).join(', '))
    } catch (err) {
      setError(err.response?.data?.error || 'Could not suggest tags.')
    } finally {
      setSuggesting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm px-4">
      <div className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-2xl shadow-xl w-full max-w-lg p-6 space-y-5 max-h-[90vh] overflow-y-auto">

        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base font-semibold text-gray-900 dark:text-white">
              {isEdit ? 'Edit Position' : 'Add Position'}
            </h2>
            <p className="text-xs text-gray-500 dark:text-gray-400">{companyName}</p>
          </div>
          <button onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-xl text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
            <XIcon size={16}/>
          </button>
        </div>

        {error && (
          <p className="text-xs text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950 border border-rose-100 dark:border-rose-900 rounded-lg px-3 py-2">
            {error}
          </p>
        )}

        <div className="space-y-4">
          {/* Title */}
          <div>
            <label className="text-xs font-medium text-gray-700 dark:text-gray-300 block mb-1">
              Position Title <span className="text-rose-500">*</span>
            </label>
            <input value={title} onChange={e => { setTitle(e.target.value); setError('') }}
              placeholder="e.g. Frontend Developer Intern"
              className="w-full px-3 py-2 text-sm rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-gray-600 focus:outline-none focus:ring-2 focus:ring-green-500"/>
          </div>

          {/* Slots */}
          <div>
            <label className="text-xs font-medium text-gray-700 dark:text-gray-300 block mb-1">
              Available Slots <span className="text-rose-500">*</span>
            </label>
            <input type="number" min={1} value={slots}
              onChange={e => { setSlots(e.target.value); setError('') }}
              className="w-28 px-3 py-2 text-sm rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-green-500"/>
          </div>

          {/* Skill level selectors */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <label className="text-xs font-medium text-gray-700 dark:text-gray-300">
                Minimum Skill Requirements
              </label>
              <span className="text-[10px] text-gray-400 dark:text-gray-600">tap a level to set requirement</span>
            </div>

            <div className="space-y-4 bg-gray-50 dark:bg-gray-800/50 rounded-xl p-4">
              {Object.keys(reqs).map(cat => (
                <SkillLevelSelector
                  key={cat}
                  category={cat}
                  value={reqs[cat] ?? 0}
                  onChange={v => setReqs(r => ({ ...r, [cat]: v }))}
                />
              ))}
            </div>

            {/* Summary tags */}
            {Object.values(reqs).some(v => v > 0) && (
              <div className="mt-3 flex flex-wrap gap-1.5">
                {Object.entries(reqs).filter(([, v]) => v > 0).map(([cat, v]) => (
                  <span key={cat}
                    className="text-xs bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300 px-2.5 py-1 rounded-full font-medium">
                    {cat.split(' ')[0]} ≥{v}%
                  </span>
                ))}
              </div>
            )}
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-medium text-gray-700 dark:text-gray-300">Position Tags</label>
              <button type="button" onClick={handleSuggestTags} disabled={suggesting}
                className="text-xs font-semibold text-green-600 dark:text-green-400 hover:underline disabled:opacity-50">
                {suggesting ? 'Suggesting…' : 'Suggest/Refresh Tags'}
              </button>
            </div>
            <textarea value={tags} onChange={e => setTags(e.target.value)} rows={3}
              placeholder="Django, REST API, authentication, PostgreSQL"
              className="w-full px-3 py-2 text-sm rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-green-500" />
            <p className="text-[11px] text-gray-400 mt-1">Optional, comma-separated, and fully editable before saving.</p>
          </div>
        </div>

        <div className="flex gap-2 pt-1">
          <button onClick={onClose}
            className="flex-1 py-2 rounded-xl text-sm font-medium bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors">
            Cancel
          </button>
          <button onClick={handleSubmit} disabled={saving}
            className="flex-1 py-2 rounded-xl text-sm font-medium bg-green-600 hover:bg-green-700 disabled:opacity-60 disabled:cursor-not-allowed text-white transition-colors flex items-center justify-center gap-1.5">
            {saving
              ? <><Spinner /> Saving…</>
              : isEdit ? 'Save Changes' : 'Add Position'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ════════════════════════════════════════════════════════════════════════════
// Main Page
// ════════════════════════════════════════════════════════════════════════════
export default function AdminCompanies() {
  const {
    companies, initialCompaniesPending,
    categories,
    showAddCompany,    setShowAddCompany,
    addPositionFor,    setAddPositionFor,
    editCompanyFor,    setEditCompanyFor,
    editPositionFor,   setEditPositionFor,
    confirmDeleteComp, setConfirmDeleteComp,
    confirmDeletePos,  setConfirmDeletePos,
    handleAddCompany,
    handleSaveCompany,
    confirmDeleteCompany,
    handleAddPosition,
    handleSavePosition,
    confirmDeletePosition,
    toast,
  } = useAdminCompanies()

  const [search,        setSearch]        = useState('')
  const [showMap, setShowMap] = useState(true)
  const [expandedPositions, setExpandedPositions] = useReducer(companyDisclosures, new Set())
  useEffect(() => { setExpandedPositions({ type: 'reconcile', companies }) }, [companies])

  const displayed = search.trim()
    ? companies.filter(co =>
        co.name.toLowerCase().includes(search.toLowerCase()) ||
        co.address.toLowerCase().includes(search.toLowerCase()))
    : companies

  const totalSlots  = companies.reduce((sum, co) => sum + co.positions.reduce((s, p) => s + p.slots, 0), 0)
  const pinnedCount = companies.filter(c => c.lat != null && c.lng != null).length

  return (
    <div className="min-w-0">


      {/* ── Modals ───────────────────────────────────────────────────── */}

      {showAddCompany && (
        <CompanyModal
          mode="add"
          onClose={() => setShowAddCompany(false)}
          onSubmit={handleAddCompany}
        />
      )}

      {editCompanyFor && (
        <CompanyModal
          mode="edit"
          initialData={editCompanyFor}
          onClose={() => setEditCompanyFor(null)}
          onSubmit={handleSaveCompany}
        />
      )}

      {addPositionFor && (
        <DataSection url="/api/categories/" layout="panel" count={1}><PositionModal
          mode="add"
          companyName={addPositionFor.name}
          categories={categories}
          onClose={() => setAddPositionFor(null)}
          onSubmit={pos => handleAddPosition(addPositionFor, pos)}
        /></DataSection>
      )}

      {editPositionFor && (
        <DataSection url="/api/categories/" layout="panel" count={1}><PositionModal
          mode="edit"
          companyName={editPositionFor.company.name}
          initialData={editPositionFor.position}
          categories={categories}
          onClose={() => setEditPositionFor(null)}
          onSubmit={pos => handleSavePosition(editPositionFor.company.id, pos)}
        /></DataSection>
      )}

      {confirmDeleteComp && (
        <ConfirmModal
          title="Delete company?"
          message={`"${confirmDeleteComp.name}" and all its positions will be permanently removed.`}
          confirmLabel="Delete"
          onConfirm={confirmDeleteCompany}
          onCancel={() => setConfirmDeleteComp(null)}
        />
      )}

      {confirmDeletePos && (
        <ConfirmModal
          title="Delete position?"
          message={`"${confirmDeletePos.position.title}" will be permanently removed from ${confirmDeletePos.company.name}.`}
          confirmLabel="Delete"
          onConfirm={confirmDeletePosition}
          onCancel={() => setConfirmDeletePos(null)}
        />
      )}

      {/* ── Toast ────────────────────────────────────────────────────── */}
      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-gray-900 dark:bg-white text-white dark:text-gray-900 text-sm font-medium px-5 py-3 rounded-2xl shadow-lg flex items-center gap-2 pointer-events-none">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
            <path d="M20 6L9 17l-5-5" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          {toast}
        </div>
      )}

      <section className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-6">

        {/* ── Page header ──────────────────────────────────────────── */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 justify-between">
          <div>
            <h1 className="text-xl font-semibold text-gray-900 dark:text-white">Companies & Positions</h1>
            <DataSection pending={initialCompaniesPending} url="/api/admin/companies/" layout="text" count={1}><p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
              {companies.length} companies · {companies.reduce((s, c) => s + c.positions.length, 0)} positions · {totalSlots} total slots
            </p></DataSection>
          </div>
          <div className="flex items-center gap-2">
            <div className="relative">
              <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z"/>
              </svg>
              <input aria-label="Search companies" value={search} onChange={e => setSearch(e.target.value)}
                placeholder="Search companies…"
                className="pl-8 pr-3 py-1.5 text-sm rounded-full bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-gray-600 focus:outline-none focus:ring-2 focus:ring-green-500 w-44"/>
            </div>
            <button onClick={() => setShowAddCompany(true)}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-green-600 hover:bg-green-700 text-white text-sm font-medium transition-colors">
              <span className="text-base leading-none">+</span> Add Company
            </button>
          </div>
        </div>

        <DataSection pending={initialCompaniesPending} url="/api/admin/companies/" layout="cards" skeleton={<CompanyCollectionSkeleton />}>
{/* ── Partner Locations Map ─────────────────────────────────── */}
        <div className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-2xl overflow-hidden">
          <button type="button" onClick={() => setShowMap(value => !value)} aria-expanded={showMap} aria-controls="partner-locations-map"
            className="w-full flex items-center justify-between gap-3 px-5 py-4 hover:bg-green-50 dark:hover:bg-green-950/20 transition-colors motion-reduce:transition-none focus-visible:outline-2 focus-visible:outline-green-600 focus-visible:outline-offset-[-2px]">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-green-50 dark:bg-green-950 flex items-center justify-center text-green-600 dark:text-green-400">
                <MapIcon />
              </div>
              <div className="text-left">
                <p className="text-sm font-semibold text-gray-900 dark:text-white">Partner Locations</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  {pinnedCount} of {companies.length} companies pinned
                </p>
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-1.5 text-xs font-medium text-green-800 dark:text-green-300">
              <span>{showMap ? 'Collapse' : 'Expand'}</span><span aria-hidden="true"><ChevronDown open={showMap} /></span>
            </div>
          </button>

          <div id="partner-locations-map" hidden={!showMap} style={{ isolation: 'isolate' }}>
            <div className="px-4 pb-4"><CompaniesMap companies={companies} /><p className="mt-2 text-xs text-gray-500 dark:text-gray-400">Select a company marker to view its address and position count.</p></div>
          </div>
        </div>

        {/* ── Company cards grid ────────────────────────────────────── */}
        {displayed.length === 0 && (
          <div className="text-center py-20 text-gray-400 dark:text-gray-600 text-sm">
            {companies.length === 0 ? 'No companies yet — click "Add Company" to get started.' : 'No companies match your search.'}
          </div>
        )}

        <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-2">
          {displayed.map(company => <CompanyCollectionCard key={company.id} company={company}
            expanded={expandedPositions}
            onTogglePosition={key => setExpandedPositions({ type: 'toggle', key })}
            onEditCompany={setEditCompanyFor} onDeleteCompany={setConfirmDeleteComp}
            onEditPosition={setEditPositionFor} onDeletePosition={setConfirmDeletePos}
            onAddPosition={setAddPositionFor} />)}
        </div>

</DataSection>
      </section>
    </div>
  )
}
