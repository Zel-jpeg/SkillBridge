// src/hooks/student/useStudentProfile.js
//
// Manages all state and logic for StudentProfile.jsx:
//   - Loads student data from GET /api/students/me/ (instant via cached sb-user)
//   - Validates editable fields (phone, address, travelWilling, stayingAt)
//   - PATCHes /api/students/me/profile/ on save
//   - Syncs pinnedLoc ↔ localStorage('sb_pin_location') after each save
//   - Seeds pinnedLoc from address.pinLat / address.pinLng (set during onboarding)
//
// Usage:
//   const {
//     apiStudent, apiLoading,
//     phone, setPhone,
//     stayingAt, setStayingAt,
//     homeAddr, setHomeAddr,
//     boardingAddr, setBoardingAddr,
//     travelWilling, setTravelWilling,
//     emailNotifications, setEmailNotifications,
//     pinnedLoc, setPinnedLoc,
//     errors, saving, saved, saveError,
//     handleSave,
//   } = useStudentProfile()

import { useState, useEffect } from 'react'
import { useApi, invalidateCache } from '../useApi'
import api from '../../api/axios'

function getCachedUser() {
  try { return JSON.parse(localStorage.getItem('sb-user')) } catch { return null }
}

export function useStudentProfile() {
  // ── Fetch student data ──────────────────────────────────────────────────
  const { data: apiStudent, loading: apiLoading } = useApi(
    '/api/students/me/',
    { initialData: getCachedUser() }
  )

  // ── Editable fields — seeded from API on first load ─────────────────────
  const [phone,              setPhone]              = useState('')
  const [travelWilling,      setTravelWilling]      = useState('panabo')
  const [emailNotifications, setEmailNotifications] = useState(true)
  const [stayingAt,          setStayingAt]          = useState('home')
  const [homeAddr,           setHomeAddr]           = useState({ province: '', city: '', barangay: '' })
  const [boardingAddr,       setBoardingAddr]       = useState({ province: '', city: '', barangay: '' })

  // ── Pin state — seeds from API address, falls back to localStorage ───────
  const [pinnedLoc, setPinnedLoc] = useState(() => {
    // First try the user's saved address from API (in cached user)
    try {
      const user = getCachedUser()
      const pl = user?.address?.pinLat
      const pg = user?.address?.pinLng
      if (pl != null && pg != null) return { lat: pl, lng: pg }
    } catch {}
    // Fallback to localStorage (set by StudentSetup or previous profile save)
    try { return JSON.parse(localStorage.getItem('sb_pin_location')) } catch { return null }
  })

  // Seed editable fields once API data is available
  useEffect(() => {
    if (!apiStudent) return
    setPhone(apiStudent.phone ?? '')
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
    // Re-seed pin from API (handles case where user saved setup on another device)
    const pl = apiStudent.address?.pinLat
    const pg = apiStudent.address?.pinLng
    if (pl != null && pg != null) {
      setPinnedLoc({ lat: pl, lng: pg })
    }
  }, [apiStudent])

  // ── Form errors, save state ─────────────────────────────────────────────
  const [errors,    setErrors]    = useState({})
  const [saving,    setSaving]    = useState(false)
  const [saved,     setSaved]     = useState(false)
  const [saveError, setSaveError] = useState('')

  // ── Validation ──────────────────────────────────────────────────────────
  function validate() {
    const e = {}
    const phonePattern = /^09\d{9}$/
    if (!phone)                         e.phone = 'Phone number is required'
    else if (!phonePattern.test(phone)) e.phone = 'Must be 11 digits starting with 09'
    if (!travelWilling)                 e.travelWilling = 'Please select your travel preference'
    if (!stayingAt)                     e.stayingAt     = 'Please select where you will be staying'
    if (!homeAddr.province || !homeAddr.city || !homeAddr.barangay)
      e.homeAddress = 'Please complete your home address'
    if (stayingAt === 'boarding' && (!boardingAddr.province || !boardingAddr.city || !boardingAddr.barangay))
      e.boardingAddress = 'Please complete your boarding house address'
    return e
  }

  // ── Save handler ────────────────────────────────────────────────────────
  async function handleSave() {
    const e = validate()
    setErrors(e)
    if (Object.keys(e).length > 0) return

    setSaving(true)
    setSaved(false)
    setSaveError('')

    const payload = {
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
    }

    try {
      const res = await api.patch('/api/students/me/profile/', payload)

      // Update caches so the rest of the app sees fresh data instantly
      localStorage.setItem('sb-user', JSON.stringify(res.data))
      if (pinnedLoc) {
        localStorage.setItem('sb_pin_location', JSON.stringify(pinnedLoc))
      } else {
        localStorage.removeItem('sb_pin_location')
      }
      invalidateCache('/api/students/me/')
      invalidateCache('/api/student/results/')

      setSaved(true)
    } catch (err) {
      const msg = err.response?.data?.error
        || err.response?.data?.detail
        || 'Failed to save. Please try again.'
      setSaveError(msg)
    } finally {
      setSaving(false)
    }
  }

  return {
    // API data
    apiStudent,
    apiLoading,
    // Editable fields
    phone,              setPhone,
    stayingAt,          setStayingAt,
    homeAddr,           setHomeAddr,
    boardingAddr,       setBoardingAddr,
    travelWilling,      setTravelWilling,
    emailNotifications, setEmailNotifications,
    // Pin
    pinnedLoc,          setPinnedLoc,
    // Form state
    errors,             setErrors,
    saving,
    saved,
    saveError,
    handleSave,
  }
}
