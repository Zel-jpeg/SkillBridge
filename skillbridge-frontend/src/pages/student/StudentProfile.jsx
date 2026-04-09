// src/pages/student/StudentProfile.jsx
//
// Lets students edit their profile: photo, student ID, course, phone, address, travel preference
// Photo is stored as base64 in localStorage for now
//
// TODO Week 3: replace localStorage reads/writes with API calls
//   GET  /api/students/me/profile/
//   PATCH /api/students/me/profile/   (multipart/form-data for photo)

import { useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import NavBar from '../../components/NavBar'
import AddressDropdowns from '../../components/AddressDropdowns'

// ================================================================
const COURSES = ['BSIT', 'BSIS']

const TRAVEL_OPTIONS = [
  { value: 'panabo',       label: 'Within Panabo City only' },
  { value: 'davao-norte',  label: 'Anywhere in Davao del Norte' },
  { value: 'davao-region', label: 'Anywhere in Davao Region (incl. Davao City)' },
  { value: 'anywhere',     label: 'Open to anywhere in Mindanao' },
]

// DUMMY — replace with API response in Week 3
const INITIAL_DATA = {
  name:            'David Rey Bali-os',
  initials:        'DR',
  studentId:       '2023-01031',
  course:          'BSIT',
  phone:           '09123456789',
  travelWilling:   'panabo',
  homeProvince:    'Davao del Norte',
  homeCity:        'PANABO CITY',
  homeBarangay:    'Sto. Niño',
  stayingAt:       'home',
  boardingProvince:'',
  boardingCity:    '',
  boardingBarangay:'',
  photoUrl:        localStorage.getItem('sb_photo') ?? '',
  emailNotifications: true, // Dummy preference
}
// ================================================================

export default function StudentProfile() {
  const navigate  = useNavigate()
  const fileRef   = useRef(null)

  const [form,    setForm]    = useState(INITIAL_DATA)
  const [errors,  setErrors]  = useState({})
  const [saved,   setSaved]   = useState(false)
  const [preview, setPreview] = useState(INITIAL_DATA.photoUrl)

  const student = {
    name:      form.name,
    initials:  form.initials,
    studentId: form.studentId,
    course:    form.course,
    photoUrl:  preview,
  }

  function update(field, value) {
    setForm(prev => ({ ...prev, [field]: value }))
    setErrors(prev => ({ ...prev, [field]: '' }))
    setSaved(false)
  }

  // ── Photo upload ─────────────────────────────────────────────
  function handlePhotoChange(e) {
    const file = e.target.files[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = ev => {
      const dataUrl = ev.target.result
      setPreview(dataUrl)
      setForm(prev => ({ ...prev, photoUrl: dataUrl }))
      localStorage.setItem('sb_photo', dataUrl)   // TODO Week 3: upload to API instead
      setSaved(false)
    }
    reader.readAsDataURL(file)
  }

  function removePhoto() {
    setPreview('')
    setForm(prev => ({ ...prev, photoUrl: '' }))
    localStorage.removeItem('sb_photo')
    setSaved(false)
  }

  // ── Validation ───────────────────────────────────────────────
  function validate() {
    const e = {}

    const idPattern = /^\d{4}-\d{5}$/
    if (!form.studentId)                      e.studentId = 'Student ID is required'
    else if (!idPattern.test(form.studentId)) e.studentId = 'Format must be YYYY-NNNNN'

    if (!form.course) e.course = 'Please select your course'

    const phonePattern = /^09\d{9}$/
    if (!form.phone)                          e.phone = 'Phone number is required'
    else if (!phonePattern.test(form.phone))  e.phone = 'Must be 11 digits starting with 09'

    if (!form.homeProvince || !form.homeCity || !form.homeBarangay)
      e.homeAddress = 'Please complete your home address'

    if (form.stayingAt === 'boarding' &&
        (!form.boardingProvince || !form.boardingCity || !form.boardingBarangay))
      e.boardingAddress = 'Please complete your boarding house address'

    if (!form.travelWilling) e.travelWilling = 'Please select your travel preference'

    setErrors(e)
    return Object.keys(e).length === 0
  }

  function handleSave() {
    if (!validate()) return
    // TODO Week 3: PATCH /api/students/me/profile/ with form data
    console.log('Saving profile:', form)
    setSaved(true)
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">

      <NavBar student={student} />

      <main className="max-w-lg mx-auto px-4 sm:px-6 py-6 sm:py-8 flex flex-col gap-5 sm:gap-6">

        {/* Back navigation */}
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
          <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 mt-0.5">Update your OJT profile information.</p>
        </div>

        {/* Photo upload */}
        <div className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-2xl p-4 sm:p-6 flex items-center gap-4 sm:gap-5">
          {/* Avatar */}
          <div className="relative shrink-0">
            <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-green-100 dark:bg-green-900 flex items-center justify-center overflow-hidden">
              {preview
                ? <img src={preview} alt="Profile" className="w-full h-full object-cover" />
                : <span className="text-xl sm:text-2xl font-bold text-green-700 dark:text-green-300">
                    {form.name.split(' ').map(n => n[0]).slice(0, 2).join('')}
                  </span>
              }
            </div>
          </div>

          <div className="flex flex-col gap-1.5 sm:gap-2 min-w-0">
            <p className="text-sm font-semibold text-gray-900 dark:text-white truncate">{form.name}</p>
            <p className="text-xs text-gray-500 dark:text-gray-400">{form.course} · {form.studentId}</p>
            <div className="flex gap-2 mt-0.5">
              <button
                onClick={() => fileRef.current?.click()}
                className="text-xs font-medium text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-950 px-3 py-1.5 rounded-lg hover:bg-green-100 dark:hover:bg-green-900 transition-colors"
              >
                {preview ? 'Change' : 'Upload'}
              </button>
              {preview && (
                <button
                  onClick={removePhoto}
                  className="text-xs font-medium text-red-500 dark:text-red-400 bg-red-50 dark:bg-red-950 px-3 py-1.5 rounded-lg hover:bg-red-100 dark:hover:bg-red-900 transition-colors"
                >
                  Remove
                </button>
              )}
            </div>
            <p className="text-xs text-gray-400 dark:text-gray-600">JPG or PNG, max 2MB</p>
            <input
              ref={fileRef}
              type="file"
              accept="image/jpeg,image/png"
              className="hidden"
              onChange={handlePhotoChange}
            />
          </div>
        </div>

        {/* Student details */}
        <div className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-2xl p-4 sm:p-6 flex flex-col gap-4 sm:gap-5">
          <p className="text-sm font-semibold text-gray-900 dark:text-white">Student details</p>

          {/* Student ID */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Student ID</label>
            <input
              type="text"
              value={form.studentId}
              maxLength={10}
              onChange={e => update('studentId', e.target.value)}
              placeholder="e.g. 2023-01031"
              className={`w-full px-4 py-3 rounded-xl border text-sm outline-none transition-colors bg-white dark:bg-gray-800 text-gray-900 dark:text-white
                ${errors.studentId ? 'border-red-400' : 'border-gray-200 dark:border-gray-700 focus:border-green-500'}`}
            />
            {errors.studentId && <p className="text-xs text-red-500 mt-1.5">{errors.studentId}</p>}
          </div>

          {/* Course */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Course</label>
            <div className="flex gap-3">
              {COURSES.map(c => (
                <button key={c} onClick={() => update('course', c)}
                  className={`flex-1 py-3 rounded-xl border text-sm font-medium transition-colors
                    ${form.course === c
                      ? 'bg-green-600 border-green-600 text-white'
                      : 'border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:border-green-300'}`}>
                  {c}
                </button>
              ))}
            </div>
            {errors.course && <p className="text-xs text-red-500 mt-1.5">{errors.course}</p>}
          </div>

          {/* Phone */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Phone number</label>
            <input
              type="tel"
              value={form.phone}
              maxLength={11}
              onChange={e => update('phone', e.target.value)}
              placeholder="e.g. 09123456789"
              inputMode="numeric"
              className={`w-full px-4 py-3 rounded-xl border text-sm outline-none transition-colors bg-white dark:bg-gray-800 text-gray-900 dark:text-white
                ${errors.phone ? 'border-red-400' : 'border-gray-200 dark:border-gray-700 focus:border-green-500'}`}
            />
            {errors.phone && <p className="text-xs text-red-500 mt-1.5">{errors.phone}</p>}
          </div>
        </div>

        {/* Location */}
        <div className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-2xl p-4 sm:p-6 flex flex-col gap-4 sm:gap-5">
          <p className="text-sm font-semibold text-gray-900 dark:text-white">Location</p>

          {/* Staying at */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
              During OJT, where will you be staying?
            </label>
            <div className="flex flex-col gap-2">
              {[
                { value: 'boarding', label: 'Boarding house / rented room near school' },
                { value: 'home',     label: 'My family home (I will commute)' },
                { value: 'open',     label: 'Open to anywhere, no preference' },
              ].map(opt => (
                <button key={opt.value} onClick={() => update('stayingAt', opt.value)}
                  className={`w-full text-left px-4 py-3 rounded-xl border text-sm transition-colors
                    ${form.stayingAt === opt.value
                      ? 'bg-green-50 dark:bg-green-950 border-green-500 text-green-800 dark:text-green-200 font-medium'
                      : 'border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:border-green-300'}`}>
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Boarding address */}
          {form.stayingAt === 'boarding' && (
            <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700">
              <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">Boarding house address</p>
              <AddressDropdowns
                onChange={a => setForm(prev => ({ ...prev, boardingProvince: a.province, boardingCity: a.city, boardingBarangay: a.barangay }))}
                error={errors.boardingAddress}
              />
            </div>
          )}

          {/* Home address */}
          <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700">
            <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">Permanent home address</p>
            <AddressDropdowns
              onChange={a => setForm(prev => ({ ...prev, homeProvince: a.province, homeCity: a.city, homeBarangay: a.barangay }))}
              error={errors.homeAddress}
            />
          </div>

          {/* Travel preference */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
              How far are you willing to travel for OJT?
            </label>
            <div className="flex flex-col gap-2">
              {TRAVEL_OPTIONS.map(opt => (
                <button key={opt.value} onClick={() => update('travelWilling', opt.value)}
                  className={`w-full text-left px-4 py-3 rounded-xl border text-sm transition-colors
                    ${form.travelWilling === opt.value
                      ? 'bg-green-50 dark:bg-green-950 border-green-500 text-green-800 dark:text-green-200 font-medium'
                      : 'border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:border-green-300'}`}>
                  {opt.label}
                </button>
              ))}
            </div>
            {errors.travelWilling && <p className="text-xs text-red-500 mt-1.5">{errors.travelWilling}</p>}
          </div>
        </div>

        {/* Notifications */}
        <div className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-2xl p-4 sm:p-6 flex flex-col gap-4">
          <div>
            <p className="text-sm font-semibold text-gray-900 dark:text-white">Notification preferences</p>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Control what emails you receive from SkillBridge.</p>
          </div>
          
          <label className="flex items-start gap-3 cursor-pointer group">
            <div className="mt-0.5 relative flex items-center justify-center">
              <input type="checkbox" className="sr-only" checked={form.emailNotifications} onChange={e => update('emailNotifications', e.target.checked)} />
              <div className={`w-5 h-5 rounded border flex items-center justify-center transition-colors ${form.emailNotifications ? 'bg-green-600 border-green-600' : 'bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 group-hover:border-green-400'}`}>
                {form.emailNotifications && <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>}
              </div>
            </div>
            <div>
              <p className="text-sm font-medium text-gray-800 dark:text-gray-200">Email me when results are ready</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">Receive an email when your OJT match profile is completed.</p>
            </div>
          </label>
        </div>

        {/* Save button */}
        <div className="flex flex-col gap-2 pb-8">
          <button
            onClick={handleSave}
            className="w-full py-3.5 rounded-xl bg-green-600 text-white text-sm font-semibold hover:bg-green-700 active:bg-green-800 transition-colors"
          >
            Save changes
          </button>

          {saved && (
            <p className="text-center text-xs text-green-600 dark:text-green-400 font-medium">
              Profile saved successfully
            </p>
          )}
        </div>

      </main>
    </div>
  )
}