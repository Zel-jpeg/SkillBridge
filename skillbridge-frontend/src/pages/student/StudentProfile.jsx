// src/pages/student/StudentProfile.jsx
//
// Students can update: phone number, staying-at preference,
// home address, boarding address, travel preference, location pin (map),
// and notification preferences.
//
// Read-only (set by system / Google OAuth):
//   name, student ID, course, profile photo (pulled from DNSC Google account)
//
// Pin location is saved to localStorage ('sb_pin_location') and is read
// by StudentResults for proximity scoring.
//
// TODO Week 3: replace localStorage reads/writes with API calls
//   GET  /api/students/me/profile/
//   PATCH /api/students/me/profile/

import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import NavBar from '../../components/NavBar'
import AddressDropdowns from '../../components/AddressDropdowns'

// ================================================================
const TRAVEL_OPTIONS = [
  { value: 'panabo',       label: 'Within Panabo City only' },
  { value: 'davao-norte',  label: 'Anywhere in Davao del Norte' },
  { value: 'davao-region', label: 'Anywhere in Davao Region (incl. Davao City)' },
  { value: 'anywhere',     label: 'Open to anywhere in Mindanao' },
]

// DUMMY — replace with GET /api/students/me/profile/ in Week 3
// These are the read-only fields set by the instructor during enrollment.
const PROFILE = {
  name:             'David Rey Bali-os',
  initials:         'DR',
  studentId:        '2023-01031',
  course:           'BSIT',
  photoUrl:         '',   // TODO Week 3: comes from Google OAuth → stored as user.photo_url in DB
  stayingAt:        'home',          // 'home' | 'boarding' | 'open'
  homeProvince:     'Davao del Norte',
  homeCity:         'PANABO CITY',
  homeBarangay:     'Sto. Niño',
  boardingProvince: '',
  boardingCity:     '',
  boardingBarangay: '',
}
// ================================================================

// ────────────────────────────────────────────────────────────────
// Leaflet — loaded once from CDN (singleton)
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
async function geocodeAddress({ barangay, city, province }) {
  const q    = [barangay, city, province, 'Philippines'].filter(Boolean).join(', ')
  const zoom = barangay ? 17 : city ? 15 : 12
  try {
    const res   = await fetch(
      `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&format=json&limit=1`,
      { headers: { 'User-Agent': 'SkillBridge-Student/1.0' } }
    )
    const [hit] = await res.json()
    if (hit) return { lat: parseFloat(hit.lat), lng: parseFloat(hit.lon), zoom }
  } catch {}
  return { lat: 7.3072, lng: 125.6839, zoom }   // fallback: Panabo City
}

// ── Blue pin icon for student location ──────────────────────────
function makeStudentIcon(L) {
  return L.divIcon({
    className:   '',
    iconSize:    [28, 36],
    iconAnchor:  [14, 36],
    popupAnchor: [0, -40],
    html: `<svg xmlns="http://www.w3.org/2000/svg" width="28" height="36" viewBox="0 0 28 36">
      <path fill="#2563eb" stroke="white" stroke-width="2"
        d="M14 1C7.4 1 2 6.4 2 13c0 9.5 12 23 12 23S26 22.5 26 13C26 6.4 20.6 1 14 1z"/>
      <circle fill="white" cx="14" cy="13" r="5"/>
      <circle fill="#2563eb" cx="14" cy="13" r="2.5"/>
    </svg>`,
  })
}

// ════════════════════════════════════════════════════════════════
// PinMap — student drops/drags a pin on their location
// ════════════════════════════════════════════════════════════════
function PinMap({ center, pinned, onPin }) {
  const elRef  = useRef(null)
  const mapRef = useRef(null)
  const mkRef  = useRef(null)

  useEffect(() => {
    let alive = true
    loadLeaflet().then(L => {
      if (!alive || !elRef.current || mapRef.current) return

      const map = L.map(elRef.current).setView(
        center ? [center.lat, center.lng] : [7.3072, 125.6839],
        center?.zoom ?? 14
      )
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© <a href="https://openstreetmap.org">OpenStreetMap</a>',
        maxZoom: 19,
      }).addTo(map)
      map.zoomControl.setPosition('bottomright')
      setTimeout(() => map.invalidateSize(), 150)

      function placeMk(lat, lng) {
        if (mkRef.current) {
          mkRef.current.setLatLng([lat, lng])
        } else {
          mkRef.current = L.marker([lat, lng], {
            icon: makeStudentIcon(L), draggable: true,
          }).addTo(map)
          mkRef.current.on('dragend', ev => {
            const p = ev.target.getLatLng()
            onPin({ lat: p.lat, lng: p.lng })
          })
        }
        onPin({ lat, lng })
      }

      // Pre-place existing pin if one is saved
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

  // Re-center when geocoding resolves (address toggle or initial load)
  useEffect(() => {
    if (mapRef.current && center) {
      mapRef.current.setView([center.lat, center.lng], center.zoom ?? 15, { animate: true })
    }
  }, [center?.lat, center?.lng, center?.zoom]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="relative rounded-xl overflow-hidden border border-gray-200 dark:border-gray-700" style={{ height: 264 }}>
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

// ── Small helper: read-only field row ────────────────────────────
function ReadOnlyField({ label, value }) {
  return (
    <div>
      <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">{label}</p>
      <p className="text-sm font-medium text-gray-800 dark:text-gray-200 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-3">
        {value || <span className="text-gray-400 dark:text-gray-600 italic">—</span>}
      </p>
    </div>
  )
}

// ════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ════════════════════════════════════════════════════════════════
export default function StudentProfile() {
  const navigate = useNavigate()

  // Editable state
  const [phone,              setPhone]              = useState('09123456789')  // TODO Week 3: from API
  const [travelWilling,      setTravelWilling]      = useState('panabo')       // TODO Week 3: from API
  const [emailNotifications, setEmailNotifications] = useState(true)          // TODO Week 3: from API

  // Photo comes from Google OAuth — not editable
  // TODO Week 3: read from GET /api/students/me/profile/ → user.photo_url
  const photoUrl = PROFILE.photoUrl ?? ''

  // Address state — editable, initialised from PROFILE (API values in Week 3)
  const [stayingAt,    setStayingAt]    = useState(PROFILE.stayingAt)
  const [homeAddr,     setHomeAddr]     = useState({
    province: PROFILE.homeProvince,
    city:     PROFILE.homeCity,
    barangay: PROFILE.homeBarangay,
  })
  const [boardingAddr, setBoardingAddr] = useState({
    province: PROFILE.boardingProvince,
    city:     PROFILE.boardingCity,
    barangay: PROFILE.boardingBarangay,
  })

  // Pin map state
  const [pinnedLoc,     setPinnedLoc]     = useState(() => {
    try { return JSON.parse(localStorage.getItem('sb_pin_location')) } catch { return null }
  })
  const [mapCenter,     setMapCenter]     = useState(null)
  const [geocoding,     setGeocoding]     = useState(false)
  const [pinAddrType,   setPinAddrType]   = useState('primary') // 'primary' | 'home' (boarding toggle)

  const [errors, setErrors] = useState({})
  const [saved,  setSaved]  = useState(false)

  const hasBoardingAddr = stayingAt === 'boarding' && boardingAddr.city

  // Address label for the geocode status bar
  const pinAddrLabel = (() => {
    if (hasBoardingAddr) {
      return pinAddrType === 'primary'
        ? (boardingAddr.city || 'boarding house')
        : (homeAddr.city    || 'home address')
    }
    return homeAddr.city || 'your address'
  })()

  // Geocode the selected address so the map centers correctly
  function geocodeForType(type) {
    const useBoarding = hasBoardingAddr && type === 'primary'
    const addr = useBoarding
      ? { barangay: boardingAddr.barangay, city: boardingAddr.city,   province: boardingAddr.province }
      : { barangay: homeAddr.barangay,     city: homeAddr.city,        province: homeAddr.province    }
    if (!addr.city && !addr.province) return
    setGeocoding(true)
    geocodeAddress(addr).then(coords => { setMapCenter(coords); setGeocoding(false) })
  }

  // Geocode on mount to center map on student's address
  useEffect(() => {
    geocodeForType('primary')
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Re-geocode when boarding/home toggle changes
  useEffect(() => {
    geocodeForType(pinAddrType)
  }, [pinAddrType]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Save ─────────────────────────────────────────────────────
  function handleSave() {
    const e = {}
    const phonePattern = /^09\d{9}$/
    if (!phone)                        e.phone = 'Phone number is required'
    else if (!phonePattern.test(phone)) e.phone = 'Must be 11 digits starting with 09'
    if (!travelWilling)                e.travelWilling = 'Please select your travel preference'
    if (!stayingAt)                    e.stayingAt     = 'Please select where you will be staying'
    if (!homeAddr.province || !homeAddr.city || !homeAddr.barangay)
      e.homeAddress = 'Please complete your home address'
    if (stayingAt === 'boarding' && (!boardingAddr.province || !boardingAddr.city || !boardingAddr.barangay))
      e.boardingAddress = 'Please complete your boarding house address'
    setErrors(e)
    if (Object.keys(e).length > 0) return

    // Save pin to localStorage (used by StudentResults for proximity)
    if (pinnedLoc) {
      localStorage.setItem('sb_pin_location', JSON.stringify(pinnedLoc))
    } else {
      localStorage.removeItem('sb_pin_location')
    }

    // TODO Week 3: PATCH /api/students/me/profile/ with full payload
    console.log('Saving profile:', { phone, stayingAt, homeAddr, boardingAddr, travelWilling, emailNotifications, pinnedLoc })
    setSaved(true)
  }

  // Formatted address strings (from live state)
  const homeAddressStr = [homeAddr.barangay, homeAddr.city, homeAddr.province]
    .filter(Boolean).join(', ') || '—'

  const boardingAddressStr = [boardingAddr.barangay, boardingAddr.city, boardingAddr.province]
    .filter(Boolean).join(', ') || '—'

  const stayingAtLabel = {
    boarding: 'Boarding house / rented room near school',
    home:     'My family home (I will commute)',
    open:     'Open to anywhere, no preference',
  }[stayingAt] ?? '—'

  const navStudent = {
    name:      PROFILE.name,
    initials:  PROFILE.initials,
    studentId: PROFILE.studentId,
    course:    PROFILE.course,
    photoUrl,
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">

      <NavBar student={navStudent} />

      <main className="max-w-lg mx-auto px-4 sm:px-6 py-6 sm:py-8 flex flex-col gap-5 sm:gap-6">

        {/* Back */}
        <button
          onClick={() => navigate('/student/dashboard')}
          className="inline-flex items-center gap-1.5 text-sm text-gray-400 dark:text-gray-500 hover:text-gray-700 dark:hover:text-gray-200 transition-colors group w-fit -mb-1"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" className="transition-transform group-hover:-translate-x-0.5">
            <path d="M19 12H5M12 5l-7 7 7 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          Dashboard
        </button>

        {/* Header */}
        <div>
          <h1 className="text-lg sm:text-xl font-bold text-gray-900 dark:text-white">My profile</h1>
          <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 mt-0.5">
            Update your contact info, address, and location pin.
          </p>
        </div>

        {/* ── Photo — read-only, sourced from DNSC Google account ── */}
        <div className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-2xl p-4 sm:p-6 flex items-center gap-4 sm:gap-5">
          <div className="shrink-0">
            <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-green-100 dark:bg-green-900 flex items-center justify-center overflow-hidden">
              {photoUrl
                ? <img src={photoUrl} alt="Profile" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                : <span className="text-xl sm:text-2xl font-bold text-green-700 dark:text-green-300">
                    {PROFILE.name.split(' ').map(n => n[0]).slice(0, 2).join('')}
                  </span>
              }
            </div>
          </div>

          <div className="flex flex-col gap-1 min-w-0">
            <p className="text-sm font-semibold text-gray-900 dark:text-white truncate">{PROFILE.name}</p>
            <p className="text-xs text-gray-500 dark:text-gray-400">{PROFILE.course} · {PROFILE.studentId}</p>
            <div className="flex items-center gap-1.5 mt-1.5">
              <svg width="13" height="13" viewBox="0 0 48 48" className="shrink-0">
                <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
                <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
                <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
                <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.18 1.48-4.97 2.36-8.16 2.36-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
              </svg>
              <p className="text-xs text-gray-400 dark:text-gray-500">Photo from your DNSC Google account</p>
            </div>
          </div>
        </div>

        {/* ── Student details (read-only from enrollment) ── */}
        <div className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-2xl p-4 sm:p-6 flex flex-col gap-4">

          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="text-sm font-semibold text-gray-900 dark:text-white">Student details</p>
              <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">Managed by your OJT coordinator.</p>
            </div>
            {/* Lock badge */}
            <span className="flex items-center gap-1 text-[10px] font-medium text-gray-400 dark:text-gray-500 bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded-full shrink-0 mt-0.5">
              <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
              Read-only
            </span>
          </div>

          <ReadOnlyField label="Full name"   value={PROFILE.name} />
          <ReadOnlyField label="Student ID"  value={PROFILE.studentId} />
          <ReadOnlyField label="Course"      value={PROFILE.course} />

          {/* Phone — editable */}
          <div>
            <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
              Phone number <span className="text-green-600 dark:text-green-400 text-[10px] font-semibold ml-1">Editable</span>
            </label>
            <input
              type="tel"
              value={phone}
              maxLength={11}
              inputMode="numeric"
              onChange={e => { setPhone(e.target.value); setErrors(prev => ({ ...prev, phone: '' })); setSaved(false) }}
              placeholder="e.g. 09123456789"
              className={`w-full px-4 py-3 rounded-xl border text-sm outline-none transition-colors bg-white dark:bg-gray-800 text-gray-900 dark:text-white
                ${errors.phone ? 'border-red-400' : 'border-gray-200 dark:border-gray-700 focus:border-green-500'}`}
            />
            {errors.phone && <p className="text-xs text-red-500 mt-1.5">{errors.phone}</p>}
          </div>
        </div>

        {/* ── Address + Pin map ── */}
        <div className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-2xl p-4 sm:p-6 flex flex-col gap-5">

          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="text-sm font-semibold text-gray-900 dark:text-white">Location</p>
              <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">Update your address and drop a pin for distance matching.</p>
            </div>
          </div>

          {/* ── Staying at (editable) ── */}
          <div>
            <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1.5">
              During OJT, staying at <span className="text-green-600 dark:text-green-400 text-[10px] font-semibold ml-1">Editable</span>
            </label>
            <div className="flex flex-col gap-2">
              {[
                { value: 'boarding', label: 'Boarding house / rented room near school' },
                { value: 'home',     label: 'My family home (I will commute)' },
                { value: 'open',     label: 'Open to anywhere, no preference' },
              ].map(opt => (
                <button key={opt.value}
                  onClick={() => { setStayingAt(opt.value); setErrors(prev => ({ ...prev, stayingAt: '' })); setSaved(false) }}
                  className={`w-full text-left px-4 py-3 rounded-xl border text-sm transition-colors
                    ${stayingAt === opt.value
                      ? 'bg-green-50 dark:bg-green-950 border-green-500 text-green-800 dark:text-green-200 font-medium'
                      : 'border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:border-green-300 dark:hover:border-green-700'}`}>
                  {opt.label}
                </button>
              ))}
            </div>
            {errors.stayingAt && <p className="text-xs text-red-500 mt-1.5">{errors.stayingAt}</p>}
          </div>

          {/* ── Boarding address — only when boarding ── */}
          {stayingAt === 'boarding' && (
            <div className="p-4 bg-gray-50 dark:bg-gray-800/60 rounded-xl border border-gray-100 dark:border-gray-700 flex flex-col gap-3">
              <div>
                <p className="text-xs font-medium text-gray-700 dark:text-gray-300">
                  Boarding house address <span className="text-green-600 dark:text-green-400 text-[10px] font-semibold ml-1">Editable</span>
                </p>
                {boardingAddressStr !== '—' && (
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    Current: <span className="font-medium text-gray-700 dark:text-gray-300">{boardingAddressStr}</span>
                  </p>
                )}
              </div>
              <AddressDropdowns
                onChange={addr => { setBoardingAddr(addr); setErrors(prev => ({ ...prev, boardingAddress: '' })); setSaved(false) }}
                error={errors.boardingAddress}
              />
            </div>
          )}

          {/* ── Home address ── */}
          <div className="p-4 bg-gray-50 dark:bg-gray-800/60 rounded-xl border border-gray-100 dark:border-gray-700 flex flex-col gap-3">
            <div>
              <p className="text-xs font-medium text-gray-700 dark:text-gray-300">
                Permanent home address <span className="text-green-600 dark:text-green-400 text-[10px] font-semibold ml-1">Editable</span>
              </p>
              {homeAddressStr !== '—' && (
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  Current: <span className="font-medium text-gray-700 dark:text-gray-300">{homeAddressStr}</span>
                </p>
              )}
            </div>
            <AddressDropdowns
              onChange={addr => { setHomeAddr(addr); setErrors(prev => ({ ...prev, homeAddress: '' })); setSaved(false) }}
              error={errors.homeAddress}
            />
          </div>

          {/* ── Pin map ── */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <p className="text-xs font-medium text-gray-700 dark:text-gray-300">
                Exact location pin
                <span className="text-green-600 dark:text-green-400 text-[10px] font-semibold ml-1.5">Editable</span>
              </p>
              {pinnedLoc && (
                <button
                  onClick={() => { setPinnedLoc(null); setSaved(false) }}
                  className="text-xs text-gray-400 dark:text-gray-500 hover:text-red-500 dark:hover:text-red-400 transition-colors"
                >
                  Remove pin
                </button>
              )}
            </div>

            {/* Boarding toggle — only when student has boarding address */}
            {hasBoardingAddr && (
              <div className="flex gap-2 mb-3 p-1 bg-gray-100 dark:bg-gray-800 rounded-xl">
                <button
                  onClick={() => setPinAddrType('primary')}
                  className={`flex-1 py-2 px-3 rounded-lg text-xs font-medium transition-colors
                    ${pinAddrType === 'primary'
                      ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm'
                      : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'}`}
                >
                  📍 Boarding house
                </button>
                <button
                  onClick={() => setPinAddrType('home')}
                  className={`flex-1 py-2 px-3 rounded-lg text-xs font-medium transition-colors
                    ${pinAddrType === 'home'
                      ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm'
                      : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'}`}
                >
                  🏠 Home address
                </button>
              </div>
            )}

            {/* Geocode status */}
            <div className="flex items-center gap-2 mb-2.5 h-5">
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#2563eb" strokeWidth="2.5" strokeLinecap="round">
                <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/>
              </svg>
              <span className="text-xs text-blue-600 dark:text-blue-400 font-medium">
                {geocoding ? `Locating ${pinAddrLabel}…` : `Centered on ${pinAddrLabel}`}
              </span>
              {geocoding && <span className="w-3 h-3 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />}
            </div>

            {/* Map */}
            <PinMap
              center={mapCenter}
              pinned={pinnedLoc}
              onPin={loc => { setPinnedLoc(loc); setSaved(false) }}
            />

            {/* Pin status bar */}
            <div className="mt-2.5 h-7 flex items-center justify-center">
              {pinnedLoc ? (
                <div className="flex items-center gap-1.5 text-xs text-blue-600 dark:text-blue-400 font-medium">
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                    <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/>
                  </svg>
                  Pinned · {pinnedLoc.lat.toFixed(5)}, {pinnedLoc.lng.toFixed(5)}
                </div>
              ) : (
                <p className="text-xs text-gray-400 dark:text-gray-500">No pin set — tap the map above to place one.</p>
              )}
            </div>

            {/* Info box */}
            <div className="mt-2 bg-blue-50 dark:bg-blue-950 border border-blue-100 dark:border-blue-900 rounded-xl px-4 py-3 flex gap-2.5">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#2563eb" strokeWidth="2" strokeLinecap="round" className="shrink-0 mt-0.5">
                <circle cx="12" cy="12" r="10"/><path d="M12 8v4M12 16h.01"/>
              </svg>
              <p className="text-xs text-blue-700 dark:text-blue-300 leading-relaxed">
                {hasBoardingAddr
                  ? 'Use the toggle above to navigate to either address, then tap the map to place your pin. This is used in your Results page to show how far each company is from you.'
                  : 'This pin is used in your Results page to calculate how far each company is from you — so you can find nearby internships.'}
              </p>
            </div>
          </div>
        </div>

        {/* ── Travel preference (editable) ── */}
        <div className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-2xl p-4 sm:p-6 flex flex-col gap-4">
          <p className="text-sm font-semibold text-gray-900 dark:text-white">Travel preference</p>
          <div className="flex flex-col gap-2">
            {TRAVEL_OPTIONS.map(opt => (
              <button key={opt.value}
                onClick={() => { setTravelWilling(opt.value); setErrors(prev => ({ ...prev, travelWilling: '' })); setSaved(false) }}
                className={`w-full text-left px-4 py-3 rounded-xl border text-sm transition-colors
                  ${travelWilling === opt.value
                    ? 'bg-green-50 dark:bg-green-950 border-green-500 text-green-800 dark:text-green-200 font-medium'
                    : 'border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:border-green-300 dark:hover:border-green-700'}`}>
                {opt.label}
              </button>
            ))}
          </div>
          {errors.travelWilling && <p className="text-xs text-red-500 mt-1.5">{errors.travelWilling}</p>}
        </div>

        {/* ── Notification preferences ── */}
        <div className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-2xl p-4 sm:p-6 flex flex-col gap-4">
          <div>
            <p className="text-sm font-semibold text-gray-900 dark:text-white">Notification preferences</p>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Control what emails you receive from SkillBridge.</p>
          </div>

          <label className="flex items-start gap-3 cursor-pointer group">
            <div className="mt-0.5 relative flex items-center justify-center">
              <input
                type="checkbox"
                className="sr-only"
                checked={emailNotifications}
                onChange={e => { setEmailNotifications(e.target.checked); setSaved(false) }}
              />
              <div className={`w-5 h-5 rounded border flex items-center justify-center transition-colors
                ${emailNotifications
                  ? 'bg-green-600 border-green-600'
                  : 'bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 group-hover:border-green-400'}`}>
                {emailNotifications && (
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12"/>
                  </svg>
                )}
              </div>
            </div>
            <div>
              <p className="text-sm font-medium text-gray-800 dark:text-gray-200">Email me when results are ready</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">Receive an email when your OJT match profile is completed.</p>
            </div>
          </label>
        </div>

        {/* ── Save ── */}
        <div className="flex flex-col gap-2 pb-8">
          <button
            onClick={handleSave}
            className="w-full py-3.5 rounded-xl bg-green-600 text-white text-sm font-semibold hover:bg-green-700 active:bg-green-800 transition-colors"
          >
            Save changes
          </button>

          {saved && (
            <div className="flex items-center justify-center gap-1.5">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
                <polyline points="22 4 12 14.01 9 11.01"/>
              </svg>
              <p className="text-center text-xs text-green-600 dark:text-green-400 font-medium">
                Profile saved successfully
              </p>
            </div>
          )}
        </div>

      </main>
    </div>
  )
}