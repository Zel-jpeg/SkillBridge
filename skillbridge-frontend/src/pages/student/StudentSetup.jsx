// src/pages/student/StudentSetup.jsx
//
// 4-step onboarding:
//   Step 1: Student details (ID, course, phone)
//   Step 2: Location preference + address dropdowns
//   Step 3: Pin exact location on map (home or boarding house)
//   Step 4: Review & confirm
//
// Pinned lat/lng is saved to localStorage ('sb_pin_location')
// and used by StudentResults + StudentDashboard for proximity scoring.
//
// TODO Week 3: POST formData + { pinLat, pinLng } to Django API

import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import AddressDropdowns from '../../components/AddressDropdowns'
import api from '../../api/axios'

// ================================================================
const COURSES = ['BSIT', 'BSIS']

const TRAVEL_OPTIONS = [
  { value: 'panabo',       label: 'Within Panabo City only' },
  { value: 'davao-norte',  label: 'Anywhere in Davao del Norte' },
  { value: 'davao-region', label: 'Anywhere in Davao Region (incl. Davao City)' },
  { value: 'anywhere',     label: 'Open to anywhere in Mindanao' },
]
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
// PinMap — student drops/drags a pin on their home / boarding house
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

  // Re-center when geocoding resolves
  useEffect(() => {
    if (mapRef.current && center) {
      mapRef.current.setView([center.lat, center.lng], center.zoom ?? 15, { animate: true })
    }
  }, [center?.lat, center?.lng, center?.zoom]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="relative rounded-xl overflow-hidden border border-gray-200" style={{ height: 264 }}>
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
// MAIN COMPONENT
// ════════════════════════════════════════════════════════════════
export default function StudentSetup() {
  const navigate    = useNavigate()
  const TOTAL_STEPS = 4
  const [step, setStep] = useState(1)

  const [formData, setFormData] = useState({
    studentId: '', course: '', phone: '', stayingAt: '',
    homeProvince: '', homeCity: '', homeBarangay: '',
    boardingProvince: '', boardingCity: '', boardingBarangay: '',
    travelWilling: '',
    pinLat: null, pinLng: null,
  })

  // Step 3 state
  const [mapCenter, setMapCenter] = useState(null)
  const [geocoding, setGeocoding] = useState(false)
  const [pinnedLoc, setPinnedLoc] = useState(null)   // { lat, lng }
  // Which address to center on in step 3 (only relevant when stayingAt === 'boarding')
  const [pinAddressType, setPinAddressType] = useState('primary') // 'primary' | 'home'

  const [errors, setErrors] = useState({})
  const [submitError,  setSubmitError]  = useState('')   // ← add
  const [submitLoading, setSubmitLoading] = useState(false) // ← add

  function updateForm(field, value) {
    setFormData(prev => ({ ...prev, [field]: value }))
    setErrors(prev => ({ ...prev, [field]: '' }))
  }

  function handleHomeAddressChange(addr) {
    setFormData(prev => ({ ...prev, homeProvince: addr.province, homeCity: addr.city, homeBarangay: addr.barangay }))
    setErrors(prev => ({ ...prev, homeAddress: '' }))
  }

  function handleBoardingAddressChange(addr) {
    setFormData(prev => ({ ...prev, boardingProvince: addr.province, boardingCity: addr.city, boardingBarangay: addr.barangay }))
    setErrors(prev => ({ ...prev, boardingAddress: '' }))
  }

  // Geocode helper — called on step entry AND when toggle changes
  function geocodeForAddressType(type) {
    const useBoarding = formData.stayingAt === 'boarding' && type === 'primary' && formData.boardingCity
    const addr = useBoarding
      ? { barangay: formData.boardingBarangay, city: formData.boardingCity, province: formData.boardingProvince }
      : { barangay: formData.homeBarangay,     city: formData.homeCity,     province: formData.homeProvince }
    if (!addr.city && !addr.province) return
    setGeocoding(true)
    geocodeAddress(addr).then(coords => { setMapCenter(coords); setGeocoding(false) })
  }

  // Auto-geocode when entering Step 3
  useEffect(() => {
    if (step !== 3) return
    setPinAddressType('primary')
    geocodeForAddressType('primary')
  }, [step]) // eslint-disable-line react-hooks/exhaustive-deps

  // Re-geocode when toggle changes
  useEffect(() => {
    if (step !== 3) return
    geocodeForAddressType(pinAddressType)
  }, [pinAddressType]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Validation ────────────────────────────────────────────────
  function validateStep1() {
    const e = {}
    const idPat = /^\d{4}-\d{5}$/
    if (!formData.studentId)                   e.studentId = 'Student ID is required'
    else if (!idPat.test(formData.studentId))  e.studentId = 'Format must be YYYY-NNNNN'
    if (!formData.course)                      e.course    = 'Please select your course'
    const phPat = /^09\d{9}$/
    if (!formData.phone)                       e.phone     = 'Phone number is required'
    else if (!phPat.test(formData.phone))      e.phone     = 'Must be 11 digits starting with 09'
    setErrors(e); return Object.keys(e).length === 0
  }

  function validateStep2() {
    const e = {}
    if (!formData.stayingAt) e.stayingAt = 'Please select where you will be staying'
    if (formData.stayingAt === 'boarding' && (!formData.boardingProvince || !formData.boardingCity || !formData.boardingBarangay))
      e.boardingAddress = 'Please complete your boarding house address'
    if (!formData.homeProvince || !formData.homeCity || !formData.homeBarangay)
      e.homeAddress = 'Please complete your home address'
    if (!formData.travelWilling) e.travelWilling = 'Please select your travel preference'
    setErrors(e); return Object.keys(e).length === 0
  }

  function handleNext() {
    if (step === 1 && !validateStep1()) return
    if (step === 2 && !validateStep2()) return
    if (step === 3 && pinnedLoc) {
      setFormData(prev => ({ ...prev, pinLat: pinnedLoc.lat, pinLng: pinnedLoc.lng }))
      localStorage.setItem('sb_pin_location', JSON.stringify(pinnedLoc))
    }
    setStep(s => s + 1)
  }

  function handleBack() { setErrors({}); setStep(s => s - 1) }

  async function handleSubmit() {
    setSubmitError('')
    setSubmitLoading(true)
  
    if (formData.pinLat) {
      localStorage.setItem('sb_pin_location', JSON.stringify({ lat: formData.pinLat, lng: formData.pinLng }))
    }
  
    console.log('Token being sent:', localStorage.getItem('sb-token'))
    console.log('Form data being sent:', formData)
  
    try {
      const res = await api.patch('/api/students/me/profile/', formData)
      localStorage.setItem('sb-user', JSON.stringify(res.data))
      navigate('/student/dashboard')
    } catch (err) {
      console.log('Setup save error:', err.response?.data)
      const status = err.response?.status
  
      if (status === 401) {
        setSubmitError('Your session expired. Please go back to login and sign in again.')
      } else if (status === 403) {
        setSubmitError('Access denied. Only students can complete this setup.')
      } else if (status === 500) {
        setSubmitError('Server error. Please try again in a moment.')
      } else if (!err.response) {
        setSubmitError('Cannot reach the server. Make sure the backend is running.')
      } else {
        setSubmitError('Failed to save your profile. Please try again.')
      }
    } finally {
      setSubmitLoading(false)
    }
  }

  const stepLabels = ['Details', 'Location', 'Pin', 'Review']

  const pinAddressLabel = (() => {
    if (formData.stayingAt === 'boarding') {
      if (pinAddressType === 'primary') return formData.boardingCity || 'boarding house'
      return formData.homeCity || 'home address'
    }
    return formData.homeCity || 'your address'
  })()

  return (
    <div className="min-h-screen bg-green-50 flex items-start sm:items-center justify-center p-4 sm:p-6">
      <div className="w-full max-w-lg bg-white rounded-2xl border border-gray-100 p-6 sm:p-10 my-4 sm:my-0">

        {/* Header */}
        <div className="flex items-center gap-3 mb-6 sm:mb-8">
          <div className="w-10 h-10 bg-green-600 rounded-xl flex items-center justify-center shrink-0">
            <svg width="22" height="22" viewBox="0 0 26 26" fill="none">
              <path d="M3 18 Q3 10 13 10 Q23 10 23 18" stroke="white" strokeWidth="2.2" strokeLinecap="round"/>
              <path d="M7 18 L7 14M13 18 L13 12M19 18 L19 14" stroke="white" strokeWidth="2.2" strokeLinecap="round"/>
              <circle cx="7" cy="8" r="2.5" fill="white" opacity="0.85"/>
              <circle cx="19" cy="8" r="2.5" fill="white" opacity="0.85"/>
            </svg>
          </div>
          <div>
            <p className="font-bold text-gray-900">Set up your profile</p>
            <p className="text-xs text-gray-500">Step {step} of {TOTAL_STEPS}</p>
          </div>
        </div>

        {/* Step indicator */}
        <div className="flex items-center mb-7">
          {stepLabels.map((label, i) => {
            const s = i + 1
            return (
              <div key={s} className="flex items-center flex-1 last:flex-none">
                <div className="flex flex-col items-center gap-1">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold shrink-0 transition-all
                    ${step > s ? 'bg-green-600 text-white' : step === s ? 'bg-green-600 text-white ring-4 ring-green-100' : 'bg-gray-100 text-gray-400'}`}>
                    {step > s ? '✓' : s}
                  </div>
                  <span className={`text-xs hidden sm:block ${step === s ? 'text-green-700 font-medium' : 'text-gray-400'}`}>{label}</span>
                </div>
                {i < stepLabels.length - 1 && (
                  <div className={`flex-1 h-0.5 mx-1 sm:mx-2 mb-4 sm:mb-0 transition-colors ${step > s ? 'bg-green-600' : 'bg-gray-100'}`} />
                )}
              </div>
            )
          })}
        </div>

        {/* ══ STEP 1 ══ */}
        {step === 1 && (
          <div>
            <h2 className="text-lg sm:text-xl font-bold text-gray-900 mb-1">Student details</h2>
            <p className="text-sm text-gray-500 mb-5">Basic information for your OJT profile.</p>

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Student ID</label>
              <input type="text" placeholder="e.g. 2023-01031" value={formData.studentId} maxLength={10}
                onChange={e => updateForm('studentId', e.target.value)}
                className={`w-full px-4 py-3 rounded-xl border text-sm outline-none transition-colors ${errors.studentId ? 'border-red-400' : 'border-gray-200 focus:border-green-500'}`} />
              {errors.studentId && <p className="text-xs text-red-500 mt-1.5">{errors.studentId}</p>}
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Course</label>
              <div className="flex gap-3">
                {COURSES.map(c => (
                  <button key={c} onClick={() => updateForm('course', c)}
                    className={`flex-1 py-3 rounded-xl border text-sm font-medium transition-colors ${formData.course === c ? 'bg-green-600 border-green-600 text-white' : 'border-gray-200 text-gray-700 hover:border-green-300'}`}>{c}</button>
                ))}
              </div>
              {errors.course && <p className="text-xs text-red-500 mt-1.5">{errors.course}</p>}
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Phone number</label>
              <input type="tel" placeholder="e.g. 09123456789" value={formData.phone} maxLength={11} inputMode="numeric"
                onChange={e => updateForm('phone', e.target.value)}
                className={`w-full px-4 py-3 rounded-xl border text-sm outline-none transition-colors ${errors.phone ? 'border-red-400' : 'border-gray-200 focus:border-green-500'}`} />
              {errors.phone && <p className="text-xs text-red-500 mt-1.5">{errors.phone}</p>}
            </div>
          </div>
        )}

        {/* ══ STEP 2 ══ */}
        {step === 2 && (
          <div>
            <h2 className="text-lg sm:text-xl font-bold text-gray-900 mb-1">Your location</h2>
            <p className="text-sm text-gray-500 mb-5">Helps us suggest nearby companies.</p>

            <div className="mb-5">
              <label className="block text-sm font-medium text-gray-700 mb-1.5">During OJT, where will you be staying?</label>
              <div className="flex flex-col gap-2">
                {[
                  { value: 'boarding', label: 'Boarding house / rented room near school' },
                  { value: 'home',     label: 'My family home (I will commute)' },
                  { value: 'open',     label: 'Open to anywhere, no preference' },
                ].map(opt => (
                  <button key={opt.value} onClick={() => updateForm('stayingAt', opt.value)}
                    className={`w-full text-left px-4 py-3 rounded-xl border text-sm transition-colors ${formData.stayingAt === opt.value ? 'bg-green-50 border-green-500 text-green-800 font-medium' : 'border-gray-200 text-gray-700 hover:border-green-300'}`}>
                    {opt.label}
                  </button>
                ))}
              </div>
              {errors.stayingAt && <p className="text-xs text-red-500 mt-1.5">{errors.stayingAt}</p>}
            </div>

            {formData.stayingAt === 'boarding' && (
              <div className="mb-5 p-4 bg-gray-50 rounded-xl border border-gray-100">
                <p className="text-sm font-medium text-gray-700 mb-3">Boarding house address</p>
                <AddressDropdowns onChange={handleBoardingAddressChange} error={errors.boardingAddress} />
              </div>
            )}

            <div className="mb-5 p-4 bg-gray-50 rounded-xl border border-gray-100">
              <p className="text-sm font-medium text-gray-700 mb-3">Permanent home address</p>
              <AddressDropdowns onChange={handleHomeAddressChange} error={errors.homeAddress} />
            </div>

            <div className="mb-2">
              <label className="block text-sm font-medium text-gray-700 mb-1.5">How far are you willing to travel for OJT?</label>
              <div className="flex flex-col gap-2">
                {TRAVEL_OPTIONS.map(opt => (
                  <button key={opt.value} onClick={() => updateForm('travelWilling', opt.value)}
                    className={`w-full text-left px-4 py-3 rounded-xl border text-sm transition-colors ${formData.travelWilling === opt.value ? 'bg-green-50 border-green-500 text-green-800 font-medium' : 'border-gray-200 text-gray-700 hover:border-green-300'}`}>
                    {opt.label}
                  </button>
                ))}
              </div>
              {errors.travelWilling && <p className="text-xs text-red-500 mt-1.5">{errors.travelWilling}</p>}
            </div>
          </div>
        )}

        {/* ══ STEP 3 — Pin Location ══ */}
        {step === 3 && (
          <div>
            <h2 className="text-lg sm:text-xl font-bold text-gray-900 mb-1">Pin your location</h2>
            <p className="text-sm text-gray-500 mb-3">
              Drop a pin on your exact location so we can show how far each company is from you.
            </p>

            {/* Address toggle — only shown when stayingAt is 'boarding' */}
            {formData.stayingAt === 'boarding' && (
              <div className="flex gap-2 mb-3 p-1 bg-gray-100 rounded-xl">
                <button
                  onClick={() => setPinAddressType('primary')}
                  className={`flex-1 py-2 px-3 rounded-lg text-xs font-medium transition-colors
                    ${pinAddressType === 'primary'
                      ? 'bg-white text-gray-900 shadow-sm'
                      : 'text-gray-500 hover:text-gray-700'}`}
                >
                  📍 Boarding house
                </button>
                <button
                  onClick={() => setPinAddressType('home')}
                  className={`flex-1 py-2 px-3 rounded-lg text-xs font-medium transition-colors
                    ${pinAddressType === 'home'
                      ? 'bg-white text-gray-900 shadow-sm'
                      : 'text-gray-500 hover:text-gray-700'}`}
                >
                  🏠 Home address
                </button>
              </div>
            )}

            {/* Geocoding status */}
            <div className="flex items-center gap-2 mb-3 h-5">
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#2563eb" strokeWidth="2.5" strokeLinecap="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
              <span className="text-xs text-blue-600 font-medium">
                {geocoding ? `Locating ${pinAddressLabel}…` : `Centered on ${pinAddressLabel}`}
              </span>
              {geocoding && <span className="w-3 h-3 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />}
            </div>

            {/* Map */}
            <PinMap
              center={mapCenter}
              pinned={pinnedLoc}
              onPin={loc => {
                setPinnedLoc(loc)
                setFormData(prev => ({ ...prev, pinLat: loc.lat, pinLng: loc.lng }))
              }}
            />

            {/* Pin status */}
            <div className="mt-2.5 h-7 flex items-center justify-center">
              {pinnedLoc ? (
                <div className="flex items-center gap-1.5 text-xs text-blue-600 font-medium">
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
                  Pinned · {pinnedLoc.lat.toFixed(5)}, {pinnedLoc.lng.toFixed(5)}
                  <button
                    onClick={() => { setPinnedLoc(null); setFormData(prev => ({ ...prev, pinLat: null, pinLng: null })) }}
                    className="ml-1 text-gray-400 hover:text-red-500 transition-colors leading-none"
                  >✕</button>
                </div>
              ) : (
                <p className="text-xs text-gray-400">No pin — tap the map above. You can skip this step.</p>
              )}
            </div>

            {/* Info box */}
            <div className="mt-3 bg-blue-50 border border-blue-100 rounded-xl px-4 py-3 flex gap-2.5">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#2563eb" strokeWidth="2" strokeLinecap="round" className="shrink-0 mt-0.5"><circle cx="12" cy="12" r="10"/><path d="M12 8v4M12 16h.01"/></svg>
              <p className="text-xs text-blue-700 leading-relaxed">
                {formData.stayingAt === 'boarding'
                  ? 'Use the toggle above to navigate to either address, then tap the map to place your pin on your actual OJT location.'
                  : 'This pin is used in your Results page to calculate how far each company is from you — so you can find nearby internships.'}
              </p>
            </div>
          </div>
        )}

        {/* ══ STEP 4 — Review ══ */}
        {step === 4 && (
          <div>
            <h2 className="text-lg sm:text-xl font-bold text-gray-900 mb-1">Looks good?</h2>
            <p className="text-sm text-gray-500 mb-5">Review your info before finishing.</p>

            <div className="bg-gray-50 rounded-xl border border-gray-100 p-4 sm:p-5 mb-5 divide-y divide-gray-100">
              {[
                { label: 'Student ID',  value: formData.studentId },
                { label: 'Course',      value: formData.course },
                { label: 'Phone',       value: formData.phone },
                { label: 'Staying at',  value: formData.stayingAt === 'boarding' ? 'Boarding house' : formData.stayingAt === 'home' ? 'Family home' : 'Open' },
                ...(formData.boardingProvince ? [{ label: 'Boarding address', value: [formData.boardingBarangay, formData.boardingCity, formData.boardingProvince].filter(Boolean).join(', ') }] : []),
                { label: 'Home address', value: [formData.homeBarangay, formData.homeCity, formData.homeProvince].filter(Boolean).join(', ') },
                { label: 'Travel range', value: TRAVEL_OPTIONS.find(o => o.value === formData.travelWilling)?.label || '—' },
              ].map(row => (
                <div key={row.label} className="flex justify-between gap-4 py-2.5">
                  <span className="text-sm text-gray-500 shrink-0">{row.label}</span>
                  <span className="text-sm font-medium text-gray-900 text-right wrap-break-words max-w-[60%]">{row.value}</span>
                </div>
              ))}
              <div className="flex justify-between gap-4 py-2.5">
                <span className="text-sm text-gray-500 shrink-0">Location pin</span>
                {formData.pinLat ? (
                  <span className="text-sm font-medium text-blue-600 flex items-center gap-1">
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
                    Set ✓
                  </span>
                ) : (
                  <span className="text-sm text-gray-400">Not set — you can add it from your profile later</span>
                )}
              </div>
            </div>
            <p className="text-xs text-gray-400 mb-5">You can update your profile anytime from the dashboard.</p>
          </div>
        )}

        {/* Nav buttons */}
        <div className="flex flex-col gap-3 mt-2">

        {/* Error banner — only shown on step 4 after failed submit */}
        {step === 4 && submitError && (
          <div className="flex items-start gap-2.5 bg-red-50 border border-red-200 rounded-xl px-4 py-3">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" className="mt-0.5 shrink-0 text-red-500">
              <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2"/>
              <path d="M12 8v4M12 16h.01" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
            </svg>
            <p className="text-xs text-red-600 leading-relaxed">{submitError}</p>
          </div>
        )}

        <div className="flex gap-3">
          {step > 1 && (
            <button onClick={handleBack}
              className="flex-1 py-3.5 rounded-xl border border-gray-200 text-gray-700 text-sm font-medium hover:bg-gray-50 transition-colors">
              Back
            </button>
          )}
          <button
            onClick={step === 4 ? handleSubmit : handleNext}
            disabled={submitLoading}
            className="flex-1 py-3.5 rounded-xl bg-green-600 text-white text-sm font-semibold hover:bg-green-700 active:bg-green-800 disabled:opacity-60 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
          >
            {submitLoading ? (
              <>
                <svg className="animate-spin" width="16" height="16" viewBox="0 0 24 24" fill="none">
                  <circle cx="12" cy="12" r="9" stroke="white" strokeWidth="2" strokeDasharray="42" strokeDashoffset="12"/>
                </svg>
                Saving…
              </>
            ) : (
              step === 4 ? 'Finish & go to dashboard →'
              : step === 3 ? (pinnedLoc ? 'Continue →' : 'Skip for now →')
              : 'Next'
            )}
          </button>
        </div>
        </div>

      </div>
    </div>
  )
}