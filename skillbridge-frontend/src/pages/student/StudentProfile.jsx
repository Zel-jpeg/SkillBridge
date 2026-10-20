import { useToast } from '../../context/ToastContext'
import { loadLeaflet, geocodeAddress } from '../../utils/externalServices'
import MapStatus from '../../components/MapStatus'
import DataSection from '../../components/DataSection'
// src/pages/student/StudentProfile.jsx
//
// Students can update: phone number, staying-at preference,
// home address, boarding address, travel preference, location pin (map),
// Notification emails are unavailable; no preference is collected.
//
// Read-only (set by system / Google OAuth):
//   name, student ID, course, profile photo (pulled from DNSC Google account)
//
// Pins come from the authenticated profile; historical unowned browser pins
// are ignored to preserve account isolation.

import { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import AddressDropdowns from '../../components/AddressDropdowns'
import Avatar from '../../components/Avatar'
import { useApi, invalidateCache, updateCachedData } from '../../hooks/useApi'
import api from '../../api/axios'
import { validPin } from '../../utils/recommendationResults'
import { requestErrorMessage } from '../../api/requestErrors'

function getCachedUser() {
  try { return JSON.parse(localStorage.getItem('sb-user')) } catch { return null }
}

// ================================================================
const TRAVEL_OPTIONS = [
  { value: 'panabo',       label: 'Within Panabo City only' },
  { value: 'davao-norte',  label: 'Anywhere in Davao del Norte' },
  { value: 'davao-region', label: 'Anywhere in Davao Region (incl. Davao City)' },
  { value: 'anywhere',     label: 'Open to anywhere in Mindanao' },
]

// Address saved data comes from GET /api/students/me/ via useApi (Week 4)
// Editable saves go to PATCH /api/students/me/profile/ (Week 5)
// ================================================================

// ────────────────────────────────────────────────────────────────
// Leaflet — loaded once from CDN (singleton)
// ────────────────────────────────────────────────────────────────


// ── Nominatim geocoder (free, no key) ────────────────────────────


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

  const latest = useRef({ center, pinned, onPin })
  useEffect(() => { latest.current = { center, pinned, onPin } }, [center, pinned, onPin])

  const [mapStatus, setMapStatus] = useState('loading')
  const [mapAttempt, setMapAttempt] = useState(0)
  function retryMap() { setMapStatus('loading'); setMapAttempt(value => value + 1) }

  useEffect(() => {
    let alive = true
    loadLeaflet().then(L => {
      if (!alive || !elRef.current || mapRef.current) return

      const { center, pinned } = latest.current
      const map = L.map(elRef.current).setView(
        center ? [center.lat, center.lng] : [7.3072, 125.6839],
        center?.zoom ?? 14
      )
      mapRef.current = map
      const tiles = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© <a href="https://openstreetmap.org">OpenStreetMap</a>',
        maxZoom: 19,
      }).addTo(map)
      tiles.on?.('tileerror', () => { if (alive) setMapStatus('tiles') })
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
            latest.current.onPin({ lat: p.lat, lng: p.lng })
          })
        }
        latest.current.onPin({ lat, lng })
      }

      // Pre-place existing pin if one is saved
      if (pinned) placeMk(pinned.lat, pinned.lng)
      map.on('click', ev => placeMk(ev.latlng.lat, ev.latlng.lng))
      mapRef.current = map
      setMapStatus('ready')
    }).catch(() => {
      if (alive) {
        mapRef.current?.remove()
        mapRef.current = null
        setMapStatus('error')
      }
    })
    return () => {
      alive = false
      mapRef.current?.remove()
      mapRef.current = null
      mkRef.current  = null
    }
  }, [mapAttempt]) // intentional — only mount/unmount

  // Re-center when geocoding resolves (address toggle or initial load)
  useEffect(() => {
    if (mapRef.current && center) {
      mapRef.current.setView([center.lat, center.lng], center.zoom ?? 15, { animate: true })
    }
  }, [center?.lat, center?.lng, center?.zoom]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="relative rounded-xl overflow-hidden border border-gray-200 dark:border-gray-700" style={{ height: 264, isolation: 'isolate', zIndex: 0 }}>
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
  const { showToast } = useToast()
  const navigate = useNavigate()

  // ── Real API call ───────────────────────────────────────────────
  const { data: apiStudent, loading: apiLoading } = useApi('/api/students/me/', { initialData: getCachedUser() })
  const formSeeded = useRef(false)

  // Derive read-only display values from real API data
  const displayName   = apiStudent?.name      ?? ''
  const displayId     = apiStudent?.school_id ?? ''
  const displayCourse = apiStudent?.course    ?? ''
  const photoUrl      = apiStudent?.photo_url ?? ''

  // Editable state — seeded from API once loaded
  const [editName,           setEditName]           = useState('')
  const [editStudentId,      setEditStudentId]      = useState('')
  const [editCourse,         setEditCourse]         = useState('')
  const [phone,              setPhone]              = useState('')
  const [travelWilling,      setTravelWilling]      = useState('panabo')

  // Address state — editable; seeded from API address JSONField when available
  const [stayingAt,    setStayingAt]    = useState('home')
  const [homeAddr,     setHomeAddr]     = useState({ province: '', city: '', barangay: '' })
  const [boardingAddr, setBoardingAddr] = useState({ province: '', city: '', barangay: '' })

  // Seed editable fields once API data arrives
  useEffect(() => {
    if (!apiStudent || formSeeded.current) return
    formSeeded.current = true
    setEditName(apiStudent.name ?? '')
    setEditStudentId(apiStudent.school_id ?? '')
    setEditCourse(apiStudent.course ?? '')
    setPhone(apiStudent.phone ?? '')
    setPinnedLoc(validPin(apiStudent.address?.pinLat, apiStudent.address?.pinLng))
    setTravelWilling(apiStudent.address?.travelWilling ?? 'panabo')
    setStayingAt(apiStudent.address?.stayingAt ?? 'home')
    setHomeAddr({
      province: apiStudent.address?.home?.province ?? '',
      city:     apiStudent.address?.home?.city     ?? '',
      barangay: apiStudent.address?.home?.barangay ?? '',
    })
    setBoardingAddr({
      province: apiStudent.address?.boarding?.province ?? '',
      city:     apiStudent.address?.boarding?.city     ?? '',
      barangay: apiStudent.address?.boarding?.barangay ?? '',
    })
  }, [apiStudent])

  // Pin map state
  const [pinnedLoc, setPinnedLoc] = useState(() => validPin(getCachedUser()?.address?.pinLat, getCachedUser()?.address?.pinLng))
  const [mapCenter,   setMapCenter]   = useState(null)
  const geocodeRequest = useRef(null)
  useEffect(() => () => geocodeRequest.current?.abort(), [])
  const [geocoding,   setGeocoding]   = useState(false)
  const [pinAddrType, setPinAddrType] = useState('primary')

  const [errors,   setErrors]   = useState({})
  const [saved,    setSaved]    = useState(false)
  const [saving,   setSaving]   = useState(false)
  const [saveError, setSaveError] = useState('')
  const savingRef = useRef(false)

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
  const geocodeForType = useCallback((type) => {
    const useBoarding = hasBoardingAddr && type === 'primary'
    const addr = useBoarding
      ? { barangay: boardingAddr.barangay, city: boardingAddr.city,   province: boardingAddr.province }
      : { barangay: homeAddr.barangay,     city: homeAddr.city,        province: homeAddr.province    }
    geocodeRequest.current?.abort()
    const controller = new AbortController()
    geocodeRequest.current = controller
    setGeocoding(true)
    geocodeAddress(addr, { signal: controller.signal }).then(coords => {
      if (controller.signal.aborted) return
      setMapCenter(coords); setGeocoding(false)
    })
  }, [hasBoardingAddr, homeAddr.province, homeAddr.city, homeAddr.barangay,
    boardingAddr.province, boardingAddr.city, boardingAddr.barangay])

  // Recenter only the view when the selected address changes; preserve the pin.
  useEffect(() => {
    geocodeForType(pinAddrType)
  }, [pinAddrType, geocodeForType])

  // ── Save ─────────────────────────────────────────────────────
  async function handleSave() {
    if (savingRef.current) return
    const e = {}
    if (!editName.trim())       e.editName      = 'Full name is required'
    if (!editStudentId.trim())  e.editStudentId = 'Student ID is required'
    if (!editCourse.trim())     e.editCourse    = 'Course is required'
    const phonePattern = /^09\d{9}$/
    if (!phone)                         e.phone = 'Phone number is required'
    else if (!phonePattern.test(phone)) e.phone = 'Must be 11 digits starting with 09'
    if (!travelWilling)  e.travelWilling = 'Please select your travel preference'
    if (!stayingAt)      e.stayingAt     = 'Please select where you will be staying'
    if (!homeAddr.province || !homeAddr.city || !homeAddr.barangay)
      e.homeAddress = 'Please complete your home address'
    if (stayingAt === 'boarding' && (!boardingAddr.province || !boardingAddr.city || !boardingAddr.barangay))
      e.boardingAddress = 'Please complete your boarding house address'
    setErrors(e)
    if (Object.keys(e).length > 0) return

    savingRef.current = true
    setSaving(true)
    setSaved(false)
    setSaveError('')

    try {
      const res = await api.patch('/api/students/me/profile/', {
        name:             editName.trim(),
        studentId:        editStudentId.trim(),
        course:           editCourse.trim(),
        phone,
        stayingAt,
        travelWilling,
        homeProvince:     homeAddr.province,
        homeCity:         homeAddr.city,
        homeBarangay:     homeAddr.barangay,
        boardingProvince: boardingAddr.province,
        boardingCity:     boardingAddr.city,
        boardingBarangay: boardingAddr.barangay,
        pinLat: pinnedLoc?.lat ?? null,
        pinLng: pinnedLoc?.lng ?? null,
      })

      // Update caches so the rest of the app sees fresh data instantly
      localStorage.setItem('sb-user', JSON.stringify(res.data))
      updateCachedData('/api/students/me/', res.data)
      invalidateCache('/api/student/results/')

      setSaved(true)
      showToast('Profile saved successfully.')
    } catch (err) {
      const msg = requestErrorMessage(err, { mutation: true })
      const field = { name: 'editName', studentId: 'editStudentId', course: 'editCourse',
        phone: 'phone', stayingAt: 'stayingAt', travelWilling: 'travelWilling' }[err.response?.data?.field]
      if (field) setErrors(previous => ({ ...previous, [field]: msg }))
      setSaveError(msg)
      showToast(msg, 'error')
    } finally {
      savingRef.current = false
      setSaving(false)
    }
  }

  // Formatted address strings (from live state)
  const homeAddressStr = [homeAddr.barangay, homeAddr.city, homeAddr.province]
    .filter(Boolean).join(', ') || '—'

  const boardingAddressStr = [boardingAddr.barangay, boardingAddr.city, boardingAddr.province]
    .filter(Boolean).join(', ') || '—'



  return (
    <div className="min-w-0">



      <DataSection url="/api/students/me/" layout="profile"><section className="max-w-lg mx-auto px-4 sm:px-6 py-6 sm:py-8 flex flex-col gap-5 sm:gap-6">

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
            <Avatar name={displayName} photoUrl={photoUrl} tone="neutral" className="w-16 h-16 sm:w-20 sm:h-20 rounded-full text-xl sm:text-2xl" />
          </div>

          <div className="flex flex-col gap-1 min-w-0">
            <p className="text-sm font-semibold text-gray-900 dark:text-white truncate">
              {apiLoading ? <span className="inline-block h-4 w-32 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" /> : displayName}
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400">{displayCourse} · {displayId}</p>
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
              <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">You can update your name, ID, and course here.</p>
            </div>
          </div>

          {/* Full name */}
          <div>
            <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
              Full name <span className="text-green-600 dark:text-green-400 text-[10px] font-semibold ml-1">Editable</span>
            </label>
            <input
              type="text"
              value={editName}
              onChange={e => { setEditName(e.target.value); setErrors(prev => ({ ...prev, editName: '' })); setSaved(false) }}
              placeholder="e.g. Juan Dela Cruz"
              className={`w-full px-4 py-3 rounded-xl border text-sm outline-none transition-colors bg-white dark:bg-gray-800 text-gray-900 dark:text-white
                ${errors.editName ? 'border-red-400' : 'border-gray-200 dark:border-gray-700 focus:border-green-500'}`}
            />
            {errors.editName && <p className="text-xs text-red-500 mt-1.5">{errors.editName}</p>}
          </div>

          {/* Student ID */}
          <div>
            <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
              Student ID <span className="text-green-600 dark:text-green-400 text-[10px] font-semibold ml-1">Editable</span>
            </label>
            <input
              type="text"
              value={editStudentId}
              onChange={e => { setEditStudentId(e.target.value); setErrors(prev => ({ ...prev, editStudentId: '' })); setSaved(false) }}
              placeholder="e.g. 2023-12345"
              className={`w-full px-4 py-3 rounded-xl border text-sm outline-none transition-colors bg-white dark:bg-gray-800 text-gray-900 dark:text-white
                ${errors.editStudentId ? 'border-red-400' : 'border-gray-200 dark:border-gray-700 focus:border-green-500'}`}
            />
            {errors.editStudentId && <p className="text-xs text-red-500 mt-1.5">{errors.editStudentId}</p>}
          </div>

          {/* Course */}
          <div>
            <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
              Course <span className="text-green-600 dark:text-green-400 text-[10px] font-semibold ml-1">Editable</span>
            </label>
            <input
              type="text"
              value={editCourse}
              onChange={e => { setEditCourse(e.target.value); setErrors(prev => ({ ...prev, editCourse: '' })); setSaved(false) }}
              placeholder="e.g. BSIT"
              className={`w-full px-4 py-3 rounded-xl border text-sm outline-none transition-colors bg-white dark:bg-gray-800 text-gray-900 dark:text-white
                ${errors.editCourse ? 'border-red-400' : 'border-gray-200 dark:border-gray-700 focus:border-green-500'}`}
            />
            {errors.editCourse && <p className="text-xs text-red-500 mt-1.5">{errors.editCourse}</p>}
          </div>

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
                prioritizeDavao
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
              prioritizeDavao
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
                  View boarding house
                </button>
                <button
                  onClick={() => setPinAddrType('home')}
                  className={`flex-1 py-2 px-3 rounded-lg text-xs font-medium transition-colors
                    ${pinAddrType === 'home'
                      ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm'
                      : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'}`}
                >
                  View home address
                </button>
              </div>
            )}

            {/* Geocode status */}
            <div className="flex items-center gap-2 mb-2.5 min-h-5">
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#2563eb" strokeWidth="2.5" strokeLinecap="round">
                <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/>
              </svg>
              <span className="text-xs text-blue-600 dark:text-blue-400 font-medium">
                {geocoding ? `Locating ${pinAddrLabel}…` : mapCenter?.approximate ? 'Address lookup unavailable; showing default Panabo view. Your pin is unchanged.' : `Centered on ${pinAddrLabel}`}
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
                  ? 'Both addresses are saved, but only one map pin is saved. These buttons only move the map view. Pin where you will stay during OJT to calculate company distances. Tapping elsewhere moves the same pin.'
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
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Result notifications</p>
          </div>

          <p className="text-sm text-gray-600 dark:text-gray-300">
            Result notification emails are not available. View your latest results on the Results page.
          </p>
        </div>

        {/* ── Save ── */}
        <div className="flex flex-col gap-2 pb-8">
          <button
            onClick={handleSave}
            disabled={saving}
            className="w-full py-3.5 rounded-xl bg-green-600 text-white text-sm font-semibold hover:bg-green-700 active:bg-green-800 disabled:opacity-60 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
          >
            {saving ? (
              <>
                <svg className="animate-spin" width="16" height="16" viewBox="0 0 24 24" fill="none">
                  <circle cx="12" cy="12" r="9" stroke="white" strokeWidth="2" strokeDasharray="42" strokeDashoffset="12"/>
                </svg>
                Saving…
              </>
            ) : 'Save changes'}
          </button>

          {saveError && (
            <div className="flex items-center gap-2 bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 rounded-xl px-4 py-3">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2" strokeLinecap="round" className="shrink-0">
                <circle cx="12" cy="12" r="10"/><path d="M12 8v4M12 16h.01"/>
              </svg>
              <p className="text-xs text-red-600 dark:text-red-400">{saveError}</p>
            </div>
          )}

          {!saveError && saved && (
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

      </section></DataSection>
    </div>
  )
}
