import { loadLeaflet, geocodeAddress as lookupAddress } from '../../utils/externalServices'
import { validPin } from '../../utils/recommendationResults'
import MapStatus from '../../components/MapStatus'
import { escapeHtml } from '../../utils/escapeHtml'
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
//   4. PositionModal (add + edit mode) — title, slots, searchable skill requirements
//   5. Edit buttons on every company card and position row
//   6. Delete confirmations with optimistic local state
//   7. Loading spinners on all submit buttons
//   8. Real-time updates via SSE (handled in hook)

import { useState, useEffect, useReducer, useRef } from 'react'
import AddressDropdowns from '../../components/AddressDropdowns'
import ConfirmModal    from '../../components/admin/ConfirmModal'
import { useAdminCompanies } from '../../hooks/admin/useAdminCompanies'
import api from '../../api/axios'
import { invalidateCache, fetchWithDedup } from '../../hooks/useApi'
import Pagination from '../../components/Pagination'
import CompanyCollectionCard, { CompanyCollectionSkeleton } from '../../components/admin/CompanyCollectionCard'
import { companyDisclosures } from '../../utils/companyCollection'
import CompanyImageInput from '../../components/CompanyImageInput'
import CompanyEditDialog from '../../components/CompanyEditDialog'
import PositionModal from '../../components/admin/PositionDialog'
import { BriefcaseIcon, ChevronRightIcon, PinIcon as LocationIcon } from '../../components/Icons'

// ────────────────────────────────────────────────────────────────────────────
// Leaflet — loaded once from CDN, singleton promise prevents duplicate injection
// ────────────────────────────────────────────────────────────────────────────


// ── Nominatim geocoder (free, no key) ────────────────────────────────────────
function geocodeAddress(address, options) {
  return lookupAddress(address, { ...options, fallbackView: { lat: 7.1907, lng: 125.4553 }, cityFallback: true })
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
          ${escapeHtml(name)}
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

  const latest = useRef({ center, pinned, onPin })
  useEffect(() => { latest.current = { center, pinned, onPin } }, [center, pinned, onPin])
  const [mapStatus, setMapStatus] = useState('loading')
  const [mapAttempt, setMapAttempt] = useState(0)
  function retryMap() { setMapStatus('loading'); setMapAttempt(value => value + 1) }

  useEffect(() => {
    let alive = true
    let resizeTimer
    loadLeaflet().then(L => {
      if (!alive || !elRef.current || mapRef.current) return

      const { center, pinned } = latest.current
      const map = L.map(elRef.current).setView(
        center ? [center.lat, center.lng] : [7.1907, 125.4553],
        center?.zoom ?? 13
      )
      mapRef.current = map
      const tiles = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© <a href="https://openstreetmap.org">OpenStreetMap</a>',
        maxZoom: 19,
      }).addTo(map)
      tiles.on?.('tileerror', () => { if (alive) setMapStatus('tiles') })
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
            latest.current.onPin({ lat: p.lat, lng: p.lng })
          })
        }
        latest.current.onPin({ lat, lng })
      }

      if (pinned) placeMk(pinned.lat, pinned.lng)
      map.on('click', ev => placeMk(ev.latlng.lat, ev.latlng.lng))
      mapRef.current = map
      setMapStatus('ready')
    }).catch(() => {
      if (alive) { mapRef.current?.remove(); mapRef.current = null; setMapStatus('error') }
    })
    return () => {
      alive = false
      clearTimeout(resizeTimer)
      mapRef.current?.remove()
      mapRef.current = null
      mkRef.current  = null
    }
  }, [mapAttempt])

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
      <MapStatus status={mapStatus} onRetry={retryMap} />
      {!pinned && mapStatus === 'ready' && (
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
    const geo = list.filter(c => validPin(c.lat, c.lng))
    const markers = geo.map(co =>
      L.marker([co.lat, co.lng], { icon: makeCompanyIcon(L, co.name) })
        .addTo(map)
        .bindPopup(`
          <div style="min-width:160px;font-family:system-ui,sans-serif;line-height:1.4">
            <p style="font-weight:700;font-size:13px;margin:0 0 2px;color:#111827">${escapeHtml(co.name)}</p>
            <p style="font-size:11px;color:#6b7280;margin:0">${escapeHtml(co.address)}</p>
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

  const [mapStatus, setMapStatus] = useState('loading')
  const [mapAttempt, setMapAttempt] = useState(0)
  function retryMap() { setMapStatus('loading'); setMapAttempt(value => value + 1) }

  useEffect(() => {
    let alive = true
    let resizeObserver
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
      setMapStatus('ready')
    }).catch(() => {
      if (alive) { mapRef.current?.remove(); mapRef.current = null; setMapStatus('error') }
    })
    return () => {
      alive = false
      resizeObserver?.disconnect()
      mapRef.current?.remove()
      mapRef.current = null
    }
  }, [mapAttempt])

  useEffect(() => {
    companiesRef.current = companies
    if (!mapRef.current || !window.L) return
    if (!elRef.current?.clientWidth) { markersStale.current = true; return }
    buildMarkers(window.L, mapRef.current, companies)
  }, [companies])

  return (
    <div className="relative" style={{ isolation: 'isolate' }}>
      <div ref={elRef} className="h-64 w-full overflow-hidden rounded-xl sm:h-80"
      style={{ isolation: 'isolate' }} />
      <MapStatus status={mapStatus} onRetry={retryMap} />
    </div>
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
  const geocodePending = useRef(null)
  useEffect(() => () => geocodePending.current?.abort(), [])

  async function handleAddressChange(addr) {
    geocodePending.current?.abort()
    const controller = new AbortController()
    geocodePending.current = controller
    setGeocoding(false)
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
      }, { signal: controller.signal })
      if (controller.signal.aborted) return
      setMapCenter(coords)
      setGeocoding(false)
      setGeocodingLabel('')
    }
  }

  function validateDetails() {
    if (!name.trim()) { setNameErr('Organization name is required.'); return false }
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
    else setSaveError(result?.message || 'Could not save partner. Your input is preserved; please retry.')
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
        <label htmlFor="company-edit-name" className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">Organization name <span className="text-rose-500">*</span></label>
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
            <span className="mt-0.5 block text-xs text-gray-500 dark:text-gray-400">View roles associated with this partner</span></span>
          <ChevronRightIcon size={18} />
        </summary>
        <div className="company-edit-positions-content space-y-2">
          {initialData.positions.map(position => <div key={position.id} className="flex items-start justify-between gap-3 rounded-lg bg-gray-50 px-3 py-2 text-xs dark:bg-gray-800">
            <span className="min-w-0 break-words font-medium">{position.title}</span><span className="shrink-0 text-gray-500 dark:text-gray-400">{position.slots} slots</span>
          </div>)}
          <p className="text-xs leading-5 text-gray-500 dark:text-gray-400">Add or edit positions from the partner card.</p>
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
        {!geocoding && mapCenter?.approximate && <p role="status" className="mt-2 text-xs text-amber-700 dark:text-amber-300">Address lookup unavailable. Showing the default Davao view; your pin is unchanged.</p>}
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
              {isEdit ? 'Edit Partner' : 'Add Partner'}
            </h2>
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
              {step === 1 ? 'Fill in the partner details and address.' : 'Pin the exact location on the map.'}
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
          {['Partner Details', 'Pin Location'].map((label, idx) => {
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
                Organization name <span className="text-rose-500">*</span>
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
              {!geocoding && mapCenter?.approximate && <p role="status" className="mt-2 text-xs text-amber-700 dark:text-amber-300">Address lookup unavailable. Showing the default Davao view; your pin is unchanged.</p>}
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
                    : pinned ? 'Add Partner' : 'Add Without Pin'}
              </button>
            </div>
          </div>
        )}
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

  } = useAdminCompanies()

  const [search,        setSearch]        = useState('')
  const [catalogStatus, setCatalogStatus] = useState('active')
  const [catalogPage, setCatalogPage] = useState(1)
  const [archiveTarget, setArchiveTarget] = useState(null)
  const [lifecycleNote, setLifecycleNote] = useState('')
  async function archiveCatalog() {
    const target = archiveTarget
    try {
      await api.post(`/api/admin/${target.kind === 'partner' ? 'partners' : 'positions'}/${target.item.id}/archive/`, { restore: Boolean(target.item.archived_at) })
      setArchiveTarget(null); setLifecycleNote(`${target.item.name || target.item.title} ${target.item.archived_at ? 'restored' : 'archived'}. Recorded history is preserved.`)
      invalidateCache('/api/admin/companies/'); await fetchWithDedup('/api/admin/companies/')
      return { ok: true }
    } catch (error) { return { ok: false, message: error.response?.data?.error || 'Could not confirm this change. Refresh the catalog before retrying.' } }
  }
  const [showMap, setShowMap] = useState(true)
  const [expandedPositions, setExpandedPositions] = useReducer(companyDisclosures, new Set())
  useEffect(() => { setExpandedPositions({ type: 'reconcile', companies }) }, [companies])

  const searched = search.trim()
    ? companies.filter(co =>
        co.name.toLowerCase().includes(search.toLowerCase()) ||
        co.address.toLowerCase().includes(search.toLowerCase()))
    : companies
  const filtered = searched.filter(co => catalogStatus === 'all' || (catalogStatus === 'archived' ? Boolean(co.archived_at) : !co.archived_at))
  const visiblePage = Math.min(catalogPage, Math.max(1, Math.ceil(filtered.length / 10)))
  const displayed = filtered.slice((visiblePage - 1) * 10, visiblePage * 10)

  const activeCompanies = companies.filter(co => !co.archived_at)
  const totalSlots = activeCompanies.reduce((sum, co) => sum + co.positions.filter(p => !p.archived_at).reduce((s, p) => s + p.slots, 0), 0)
  const pinnedCount = activeCompanies.filter(c => c.lat != null && c.lng != null).length

  return (
    <div className="min-w-0">


      {/* ── Modals ───────────────────────────────────────────────────── */}
      {archiveTarget && <ConfirmModal archive title={`${archiveTarget.item.archived_at ? 'Restore' : 'Archive'} this ${archiveTarget.kind}?`} message={`${archiveTarget.item.name || archiveTarget.item.title}: ${archiveTarget.item.archived_at ? 'Restore availability after reviewing its openings and slots. Previously archived positions stay archived.' : 'Stop new matching and assignments. Current approved decisions must be reviewed first; historical batch records stay preserved. Previous records and other partners remain available.'}`} confirmLabel={archiveTarget.item.archived_at ? 'Restore' : 'Archive'} onConfirm={archiveCatalog} onCancel={() => setArchiveTarget(null)} tone={archiveTarget.item.archived_at ? 'confirm' : 'danger'} children={<a href="/admin/placements" className="inline-flex min-h-11 items-center text-xs font-semibold text-green-800 underline dark:text-green-300">Review current decisions</a>} />}

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
        <PositionModal
          mode="add"
          companyName={addPositionFor.name}
          categories={categories}
          onClose={() => setAddPositionFor(null)}
          onSubmit={pos => handleAddPosition(addPositionFor, pos)}
        />
      )}

      {editPositionFor && (
        <PositionModal
          mode="edit"
          companyName={editPositionFor.company.name}
          initialData={editPositionFor.position}
          categories={categories}
          onClose={() => setEditPositionFor(null)}
          onSubmit={pos => handleSavePosition(editPositionFor.company.id, pos)}
        />
      )}

      {confirmDeleteComp && (
        <ConfirmModal
          title="Delete partner?"
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


      <section className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-6">

        {/* ── Page header ──────────────────────────────────────────── */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 justify-between">
          <div>
            <h1 className="text-xl font-semibold text-gray-900 dark:text-white">OJT Partners & Positions</h1>
            <DataSection pending={initialCompaniesPending} url="/api/admin/companies/" layout="text" count={1}><p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
              {companies.length} partners · {companies.reduce((s, c) => s + c.positions.length, 0)} positions · {totalSlots} active configured slots
            </p></DataSection>
          </div>
          <div className="flex items-center gap-2">
            <div className="relative">
              <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z"/>
              </svg>
              <input aria-label="Search partners" value={search} onChange={e => { setSearch(e.target.value); setCatalogPage(1) }}
                placeholder="Search partners…"
                className="pl-8 pr-3 py-1.5 text-sm rounded-full bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-gray-600 focus:outline-none focus:ring-2 focus:ring-green-500 w-44"/>
            </div>
            <button onClick={() => setShowAddCompany(true)}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-green-600 hover:bg-green-700 text-white text-sm font-medium transition-colors">
              <span className="text-base leading-none">+</span> Add Partner
            </button>
          </div>
        </div>

        <DataSection pending={initialCompaniesPending} url="/api/admin/companies/" layout="cards" skeleton={<CompanyCollectionSkeleton />}>
        <div className="flex flex-wrap items-center gap-4 text-xs"><label>Partner status <select aria-label="Partner status" className="ml-2 min-h-11 rounded-xl border border-gray-300 bg-transparent px-3 dark:border-gray-700" value={catalogStatus} onChange={e => { setCatalogStatus(e.target.value); setCatalogPage(1) }}><option value="active">Active</option><option value="archived">Archived</option><option value="all">All partners</option></select></label><p role="status">{filtered.length} matching partners</p></div>
        <p className="text-xs leading-6 text-gray-500">Reuse partners across OJT cycles. Archive discontinued partners or positions to retain their history; update total slots when the next cycle's capacity is confirmed.</p>
        {lifecycleNote && <p role="status" className="text-xs text-green-800 dark:text-green-300">{lifecycleNote}</p>}
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
                  {pinnedCount} of {activeCompanies.length} active partners pinned
                </p>
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-1.5 text-xs font-medium text-green-800 dark:text-green-300">
              <span>{showMap ? 'Collapse' : 'Expand'}</span><span aria-hidden="true"><ChevronDown open={showMap} /></span>
            </div>
          </button>

          <div id="partner-locations-map" hidden={!showMap} style={{ isolation: 'isolate' }}>
            <div className="px-4 pb-4"><CompaniesMap companies={activeCompanies.map(c => ({ ...c, positions: c.positions.filter(p => !p.archived_at) }))} /><p className="mt-2 text-xs text-gray-500 dark:text-gray-400">Select a partner marker to view its address and position count.</p></div>
          </div>
        </div>

        {/* ── Company cards grid ────────────────────────────────────── */}
        {displayed.length === 0 && (
          <div className="text-center py-20 text-gray-400 dark:text-gray-600 text-sm">
            {companies.length === 0 ? 'No partners yet — click "Add Partner" to get started.' : 'No partners match these filters.'}
          </div>
        )}

        <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-2">
          {displayed.map(company => <CompanyCollectionCard key={company.id} company={company}
            expanded={expandedPositions}
            onTogglePosition={key => setExpandedPositions({ type: 'toggle', key })}
            onEditCompany={setEditCompanyFor} onDeleteCompany={setConfirmDeleteComp}
            onEditPosition={setEditPositionFor} onDeletePosition={setConfirmDeletePos}
            onArchive={setArchiveTarget}
            onAddPosition={setAddPositionFor} />)}
        </div>

        <Pagination total={filtered.length} page={visiblePage} onPage={setCatalogPage} />
</DataSection>
      </section>
    </div>
  )
}
