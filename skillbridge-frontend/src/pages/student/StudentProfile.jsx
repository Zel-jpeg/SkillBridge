import { useToast } from '../../context/ToastContext'
import { loadLeaflet, geocodeAddress } from '../../utils/externalServices'
import MapStatus from '../../components/MapStatus'
// src/pages/student/StudentProfile.jsx
//
// Students can update: name, student ID, course, phone number, staying-at preference,
// home address, boarding address, travel preference, location pin (map),
// Notification emails are unavailable; no preference is collected.
//
// Profile photo stays read-only (pulled from the DNSC Google account).
//
// Pins come from the authenticated profile; historical unowned browser pins
// are ignored to preserve account isolation.

import { useState, useEffect, useRef, useCallback } from 'react'
import StudentProfileForm from '../../components/student/StudentProfileForm'
import StudentCycleNotice from '../../components/student/StudentCycleNotice'
import { useApi, invalidateCache, updateCachedData, getCachedData } from '../../hooks/useApi'
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

  // Clearing the form's pin must also clear its visible marker.
  useEffect(() => {
    if (!pinned && mkRef.current) {
      mkRef.current.remove()
      mkRef.current = null
    }
  }, [pinned])

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

// ════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ════════════════════════════════════════════════════════════════
export default function StudentProfile() {
  const { showToast } = useToast()

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
      // Profile PATCH returns identity fields, while the dashboard GET also
      // carries batch/attempt/placement state used by the confirmation step.
      const current = getCachedData('/api/students/me/')
      updateCachedData('/api/students/me/', current?.id === res.data.id ? { ...current, ...res.data } : res.data)
      invalidateCache('/api/students/me/')
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



  const fields = [
    { key: 'editName', label: 'Full name', value: editName, placeholder: 'e.g. Juan Dela Cruz', set: setEditName },
    { key: 'editStudentId', label: 'Student ID', value: editStudentId, placeholder: 'e.g. 2023-00123', set: setEditStudentId },
    { key: 'editCourse', label: 'Course', value: editCourse, placeholder: 'e.g. BSIT', set: setEditCourse },
    { key: 'phone', label: 'Phone number', value: phone, placeholder: 'e.g. 09123456789', type: 'tel', inputMode: 'numeric', maxLength: 11, set: setPhone },
  ].map(field => ({ ...field, onChange: value => {
    field.set(value); setErrors(previous => ({ ...previous, [field.key]: '' })); setSaved(false)
  } }))

  return <><div className="mx-auto max-w-6xl px-4 sm:px-6"><StudentCycleNotice review historyMode="none" /></div><StudentProfileForm
    student={{ name: displayName, schoolId: displayId, course: displayCourse, photoUrl, loading: apiLoading }}
    fields={fields} errors={errors} travelOptions={TRAVEL_OPTIONS} travelWilling={travelWilling}
    onTravelChange={value => { setTravelWilling(value); setErrors(previous => ({ ...previous, travelWilling: '' })); setSaved(false) }}
    stayingAt={stayingAt} onStayingChange={value => { setStayingAt(value); setErrors(previous => ({ ...previous, stayingAt: '' })); setSaved(false) }}
    homeAddress={homeAddressStr} boardingAddress={boardingAddressStr}
    onHomeChange={address => { setHomeAddr(address); setErrors(previous => ({ ...previous, homeAddress: '' })); setSaved(false) }}
    onBoardingChange={address => { setBoardingAddr(address); setErrors(previous => ({ ...previous, boardingAddress: '' })); setSaved(false) }}
    hasBoardingAddress={Boolean(hasBoardingAddr)} mapView={pinAddrType} onMapViewChange={setPinAddrType}
    mapLabel={pinAddrLabel} mapCenter={mapCenter} geocoding={geocoding} pinned={pinnedLoc}
    onRemovePin={() => { setPinnedLoc(null); setSaved(false) }}
    map={<PinMap center={mapCenter} pinned={pinnedLoc} onPin={loc => { setPinnedLoc(loc); setSaved(false) }} />}
    saving={saving} saved={saved} saveError={saveError} onSave={handleSave} stickySave={!apiStudent?.has_previous_batches}
  /><div className="mx-auto max-w-[1160px] px-4 pb-8 sm:px-6"><StudentCycleNotice showNotices={false} /></div></>
}
