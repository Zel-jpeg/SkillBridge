// src/pages/admin/AdminStudents.jsx
//
// Shows:
//   1. Searchable + filterable table of ALL students (across all instructors/courses)
//   2. Filter by course, status, instructor
//   3. Per-student row: name, student ID, course, instructor, assessment status, match score, top recommendation
//   4. View profile button (navigates to student detail — placeholder for now)
//   5. Grid / List view toggle (desktop); always grid on mobile
//
// TODO Week 5: replace DUMMY_* with real API data
//   GET /api/admin/students/    → paginated list with filters

import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'

const PAGE_SIZE = 10

// ── Icons ─────────────────────────────────────────────────────────
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
const MenuIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
    <path d="M3 12h18M3 6h18M3 18h18"/>
  </svg>
)
const GridIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/>
    <rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>
  </svg>
)
const ListIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
    <path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/>
  </svg>
)
const RefreshIcon = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M23 4v6h-6"/><path d="M1 20v-6h6"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>
  </svg>
)
const PencilIcon = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
  </svg>
)

// Extract name from DNSC email: lastname.firstname@dnsc.edu.ph → "Firstname Lastname"
function nameFromEmail(email) {
  const local = email.split('@')[0]           // e.g. "villanueva.azel"
  const parts = local.split('.')              // ["villanueva", "azel"]
  const cap   = s => s.charAt(0).toUpperCase() + s.slice(1).toLowerCase()
  if (parts.length >= 2) return `${cap(parts[1])} ${cap(parts[0])}`  // "Azel Villanueva"
  return cap(parts[0])                        // fallback: just capitalise what we have
}

// ── Confirm Modal ─────────────────────────────────────────────────
function ConfirmModal({ title, message, confirmLabel = 'Remove', onConfirm, onCancel }) {
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

// ── Pagination ────────────────────────────────────────────────────
function Pagination({ total, page, onPage }) {
  const pages = Math.ceil(total / PAGE_SIZE)
  if (pages <= 1) return null
  const from = (page - 1) * PAGE_SIZE + 1
  const to   = Math.min(page * PAGE_SIZE, total)
  const nums = Array.from({length: pages}, (_, i) => i+1)
    .filter(p => p===1 || p===pages || Math.abs(p-page)<=1)
  return (
    <div className="flex flex-col sm:flex-row items-center justify-between gap-2 px-1 py-1">
      <p className="text-xs text-gray-400 dark:text-gray-500 order-2 sm:order-1">Showing {from}–{to} of {total}</p>
      <div className="flex items-center gap-1 order-1 sm:order-2">
        <button onClick={() => onPage(page-1)} disabled={page===1}
          className="px-3 py-1.5 rounded-lg text-xs font-medium bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 disabled:opacity-40 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors disabled:cursor-not-allowed">← Prev</button>
        {nums.reduce((acc, p, idx, arr) => {
          if (idx > 0 && p - arr[idx-1] > 1) acc.push('…')
          acc.push(p); return acc
        }, []).map((p, i) => p === '…'
          ? <span key={i} className="text-xs text-gray-300 dark:text-gray-700 px-1">…</span>
          : <button key={p} onClick={() => onPage(p)}
              className={`w-8 h-8 rounded-lg text-xs font-medium transition-colors ${p===page?'bg-gray-900 dark:bg-white text-white dark:text-gray-900':'text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'}`}>{p}</button>
        )}
        <button onClick={() => onPage(page+1)} disabled={page===pages}
          className="px-3 py-1.5 rounded-lg text-xs font-medium bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 disabled:opacity-40 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors disabled:cursor-not-allowed">Next →</button>
      </div>
    </div>
  )
}

// ================================================================
// DUMMY DATA — replace with API in Week 5
// ================================================================
const ADMIN = { name: 'System Administrator', initials: 'SA' }

const STUDENTS = [
  { id: 1,  name: 'David Rey Bali-os',          studentId: '2023-01031', email: 'drbali-os@dnsc.edu.ph',     course: 'BSIT', instructor: 'Ma. Lourdes Reyes', status: 'completed', retakeAllowed: false, match: 79,   position: 'Web Developer Intern',     company: 'Azeus Systems'        },
  { id: 2,  name: 'Lemuel Brion',               studentId: '2023-01045', email: 'lpbrion@dnsc.edu.ph',       course: 'BSIT', instructor: 'Ma. Lourdes Reyes', status: 'completed', retakeAllowed: false, match: 83,   position: 'Database Analyst Intern',  company: 'LGU-Panabo MIS'       },
  { id: 3,  name: 'Azel Villanueva',            studentId: '2023-01058', email: 'amvillanueva@dnsc.edu.ph',  course: 'BSIT', instructor: 'Ma. Lourdes Reyes', status: 'completed', retakeAllowed: false, match: 94,   position: 'Frontend Developer',       company: 'Azeus Systems'        },
  { id: 4,  name: 'Kristine Mae Delos Santos',  studentId: '2023-01062', email: 'kmdelossantos@dnsc.edu.ph', course: 'BSIS', instructor: 'Ma. Lourdes Reyes', status: 'completed', retakeAllowed: false, match: 88,   position: 'IT Support Specialist',    company: 'LGU-Panabo MIS'       },
  { id: 5,  name: 'Reymark Tabang',             studentId: '2023-01075', email: 'rjtabang@dnsc.edu.ph',      course: 'BSIT', instructor: 'Ma. Lourdes Reyes', status: 'completed', retakeAllowed: false, match: 91,   position: 'Network Technician',       company: 'DNSC ICT Office'      },
  { id: 6,  name: 'Jonalyn Caballero',          studentId: '2023-01089', email: 'jcaballero@dnsc.edu.ph',    course: 'BSIS', instructor: 'Ma. Lourdes Reyes', status: 'completed', retakeAllowed: false, match: 72,   position: 'UI/UX Intern',             company: 'Azeus Systems'        },
  { id: 7,  name: 'Elmar Patalinghug',          studentId: '2023-01094', email: 'epatalinghug@dnsc.edu.ph',  course: 'BSIT', instructor: 'Ma. Lourdes Reyes', status: 'pending',   retakeAllowed: false, match: null, position: null,                       company: null                   },
  { id: 8,  name: 'Mary Grace Oabel',           studentId: '2023-01101', email: 'mgoabel@dnsc.edu.ph',       course: 'BSIS', instructor: 'Ma. Lourdes Reyes', status: 'pending',   retakeAllowed: false, match: null, position: null,                       company: null                   },
  { id: 9,  name: 'Justin Marc Rosario',        studentId: '2023-01115', email: 'jmrosario@dnsc.edu.ph',     course: 'BSIT', instructor: 'Ma. Lourdes Reyes', status: 'completed', retakeAllowed: false, match: 86,   position: 'Backend Intern',           company: 'Accenture CDO'        },
  { id: 10, name: 'Sheila Abella',              studentId: '2023-01122', email: 'sabella@dnsc.edu.ph',       course: 'BSIS', instructor: 'Ma. Lourdes Reyes', status: 'pending',   retakeAllowed: false, match: null, position: null,                       company: null                   },
  { id: 11, name: 'Renaldo Magpantay',          studentId: '2022-00881', email: 'rmagpantay@dnsc.edu.ph',    course: 'BSIT', instructor: 'Roberto G. Cruz',   status: 'completed', retakeAllowed: false, match: 65,   position: 'Network Technician',       company: 'DNSC ICT Office'      },
  { id: 12, name: 'Patricia Lim',               studentId: '2022-00892', email: 'pglim@dnsc.edu.ph',         course: 'BSIS', instructor: 'Roberto G. Cruz',   status: 'completed', retakeAllowed: false, match: 77,   position: 'IT Support Specialist',    company: 'LGU-Panabo MIS'       },
  { id: 13, name: 'Franz Aldrin Umali',         studentId: '2022-00905', email: 'faumali@dnsc.edu.ph',       course: 'BSIT', instructor: 'Roberto G. Cruz',   status: 'pending',   retakeAllowed: false, match: null, position: null,                       company: null                   },
  { id: 14, name: 'Hannah Buenaventura',        studentId: '2022-00918', email: 'hbuenaventura@dnsc.edu.ph', course: 'BSIS', instructor: 'Roberto G. Cruz',   status: 'completed', retakeAllowed: false, match: 58,   position: 'Database Encoder Intern',  company: 'LGU-Panabo MIS'       },
  { id: 15, name: 'Gerald Esguerra',            studentId: '2022-00933', email: 'gesguerra@dnsc.edu.ph',     course: 'BSIT', instructor: 'Roberto G. Cruz',   status: 'completed', retakeAllowed: false, match: 80,   position: 'Backend Intern',           company: 'Accenture CDO'        },
]

const INITIAL_INSTRUCTORS = [
  { id: 1, name: 'Ma. Lourdes T. Reyes', instructorId: '2018-00042', email: 'mtreyes@dnsc.edu.ph',    department: 'Institute of Computing', courses: 'BSIT / BSIS' },
  { id: 2, name: 'Roberto G. Cruz',      instructorId: '2015-00019', email: 'rgcruz@dnsc.edu.ph',     department: 'Institute of Computing', courses: 'BSIT' },
]

let _nextInstructorId = 10
// ================================================================

function matchColor(pct) {
  if (pct === null) return 'text-gray-300 dark:text-gray-700'
  if (pct >= 80) return 'text-green-600 dark:text-green-400'
  if (pct >= 60) return 'text-amber-600 dark:text-amber-400'
  return 'text-rose-500 dark:text-rose-400'
}
function matchBg(pct) {
  if (pct === null) return ''
  if (pct >= 80) return 'bg-green-50 dark:bg-green-950'
  if (pct >= 60) return 'bg-amber-50 dark:bg-amber-950'
  return 'bg-rose-50 dark:bg-rose-950'
}
function matchBarColor(pct) {
  if (!pct) return 'bg-gray-200 dark:bg-gray-700'
  if (pct >= 80) return 'bg-green-500'
  if (pct >= 60) return 'bg-amber-500'
  return 'bg-rose-500'
}
function ini(name) { return name.split(' ').map(n => n[0]).slice(0, 2).join('') }

// ── Admin Nav ────────────────────────────────────────────────────
function AdminNav({ admin }) {
  const navigate = useNavigate()
  const [open,   setOpen]   = useState(false)
  const [mobile, setMobile] = useState(false)
  const [dark,   setDark]   = useState(() => localStorage.getItem('sb-theme') === 'dark')

  function toggleDark() {
    const next = !dark; setDark(next)
    document.documentElement.classList.toggle('dark', next)
    localStorage.setItem('sb-theme', next ? 'dark' : 'light')
  }

  const links = [
    { label: 'Dashboard', path: '/admin/dashboard' },
    { label: 'Companies', path: '/admin/companies'  },
    { label: 'Students',  path: '/admin/students',  active: true },
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
          <button onClick={() => setMobile(p => !p)} className="md:hidden p-2 rounded-lg text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
            {mobile ? <XIcon size={20}/> : <MenuIcon/>}
          </button>
          <div className="relative">
            <button onClick={() => setOpen(p => !p)} className="w-8 h-8 rounded-full bg-rose-100 dark:bg-rose-900 flex items-center justify-center text-xs font-semibold text-rose-700 dark:text-rose-300 hover:ring-2 hover:ring-rose-400 transition-all">
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

const INSTRUCTORS_LIST = [...new Set(STUDENTS.map(s => s.instructor))]
const COURSES          = [...new Set(STUDENTS.map(s => s.course))]

// ── Add Instructor Modal ─────────────────────────────────────────
function AddInstructorModal({ existingInstructors, onClose, onAdd }) {
  const [email,        setEmail]        = useState('')
  const [nameEdit,     setNameEdit]     = useState('')
  const [instructorId, setInstructorId] = useState('')
  const [department,   setDepartment]   = useState('Institute of Computing')
  const [courses,      setCourses]      = useState('BSIT / BSIS')
  const [errors,       setErrors]       = useState({})

  const isEmailValid = email.trim().toLowerCase().endsWith('@dnsc.edu.ph')
  const derivedName  = isEmailValid ? nameFromEmail(email.trim().toLowerCase()) : ''
  const finalName    = nameEdit.trim() || derivedName

  function handleSubmit() {
    const errs = {}
    if (!email.trim()) errs.email = 'Email is required'
    else if (!isEmailValid) errs.email = 'Must be a valid @dnsc.edu.ph email'

    if (!finalName) errs.name = 'Name is required'

    const idPattern = /^\d{4}-\d{5}$/
    if (!instructorId.trim()) errs.instructorId = 'Instructor ID is required'
    else if (!idPattern.test(instructorId.trim())) errs.instructorId = 'Format must be YYYY-NNNNN'

    const dupId    = existingInstructors.find(i => i.instructorId === instructorId.trim())
    const dupEmail = existingInstructors.find(i => i.email === email.trim().toLowerCase())
    if (dupId)    errs.instructorId = 'This Instructor ID already exists'
    if (dupEmail) errs.email        = 'This email already exists'

    if (Object.keys(errs).length) { setErrors(errs); return }

    onAdd({
      id:           ++_nextInstructorId,
      name:         finalName,
      instructorId: instructorId.trim(),
      email:        email.trim().toLowerCase(),
      department:   department.trim() || 'Institute of Computing',
      courses:      courses.trim(),
    })
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm px-4">
      <div className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-2xl shadow-xl w-full max-w-md p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base font-semibold text-gray-900 dark:text-white">Add Instructor</h2>
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">They can log in using their DNSC Google account.</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 text-lg leading-none">✕</button>
        </div>

        {/* DNSC Email - Primary Field */}
        <div>
          <label className="text-xs font-medium text-gray-700 dark:text-gray-300 block mb-1">DNSC Email <span className="text-rose-500">*</span></label>
          <input type="email" value={email} onChange={e => { setEmail(e.target.value); setErrors(er => ({...er, email:''})) }}
            placeholder="e.g. mtreyes@dnsc.edu.ph"
            className={`w-full px-3 py-2 text-sm rounded-xl border bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-gray-600 focus:outline-none focus:ring-2 focus:ring-green-500
              ${errors.email ? 'border-red-400' : 'border-gray-200 dark:border-gray-700'}`}/>
          {errors.email && <p className="text-xs text-red-500 mt-1">{errors.email}</p>}
        </div>

        {/* Name Preview / Edit */}
        {isEmailValid && (
          <div className="bg-blue-50 dark:bg-blue-950/40 border border-blue-100 dark:border-blue-900 rounded-xl p-3 flex flex-col gap-2 relative overflow-hidden">
             {/* Name decoration */}
             <div className="absolute -top-6 -right-6 w-16 h-16 bg-blue-100 dark:bg-blue-900 rounded-full opacity-50 blur-xl"></div>
             
             <div>
               <label className="text-xs font-medium text-blue-800 dark:text-blue-300 block mb-1">Generated Name (Confirm or edit) <span className="text-rose-500">*</span></label>
               <input value={nameEdit === '' ? derivedName : nameEdit} onChange={e => { setNameEdit(e.target.value); setErrors(er => ({...er, name:''})) }}
                 className={`w-full px-2.5 py-1.5 text-sm rounded-lg border bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500
                   ${errors.name ? 'border-red-400' : 'border-blue-200 dark:border-blue-800'}`}/>
             </div>
          </div>
        )}

        {/* Instructor ID */}
        <div>
          <label className="text-xs font-medium text-gray-700 dark:text-gray-300 block mb-1">
            Instructor ID <span className="text-rose-500">*</span>
          </label>
          <input value={instructorId} onChange={e => { setInstructorId(e.target.value); setErrors(er => ({...er, instructorId:''})) }}
            placeholder="e.g. 2018-00042"
            className={`w-full px-3 py-2 text-sm rounded-xl border bg-white dark:bg-gray-800 text-gray-900 dark:text-white font-mono placeholder:text-gray-400 dark:placeholder:text-gray-600 focus:outline-none focus:ring-2 focus:ring-green-500
              ${errors.instructorId ? 'border-red-400' : 'border-gray-200 dark:border-gray-700'}`}/>
          {errors.instructorId && <p className="text-xs text-red-500 mt-1">{errors.instructorId}</p>}
        </div>

        {/* Department */}
        <div>
          <label className="text-xs font-medium text-gray-700 dark:text-gray-300 block mb-1">Department</label>
          <input value={department} onChange={e => setDepartment(e.target.value)}
            placeholder="e.g. Institute of Computing"
            className="w-full px-3 py-2 text-sm rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-gray-600 focus:outline-none focus:ring-2 focus:ring-green-500"/>
        </div>

        {/* Courses handled */}
        <div>
          <label className="text-xs font-medium text-gray-700 dark:text-gray-300 block mb-1">Courses Handled</label>
          <div className="flex gap-2">
            {[
              { val: 'BSIT',        label: 'BSIT only' },
              { val: 'BSIS',        label: 'BSIS only' },
              { val: 'BSIT / BSIS', label: 'Both' },
            ].map(opt => (
              <button key={opt.val} onClick={() => setCourses(opt.val)}
                className={`flex-1 py-1.5 rounded-xl text-xs font-semibold border transition-colors
                  ${courses === opt.val
                    ? 'bg-green-600 border-green-600 text-white'
                    : 'border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:border-green-400'}`}>
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex gap-2 pt-2">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-xl text-sm font-medium bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors">
            Cancel
          </button>
          <button onClick={handleSubmit} className="flex-1 py-2.5 rounded-xl text-sm font-medium bg-green-600 hover:bg-green-700 text-white transition-colors">
            Add Instructor
          </button>
        </div>
      </div>
    </div>
  )
}

// ── User Detail Modal (Students & Instructors) ────────────────────
function UserDetailModal({ user, type, onClose, onUpdate, onRemove, onToggleRetake }) {
  const isStudent = type === 'student'
  
  // Edit mode states (for instructor)
  const [editing, setEditing] = useState(false)
  const [editData, setEditData] = useState({ ...user })

  function handleSave() {
    onUpdate({ ...user, ...editData })
    setEditing(false)
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm px-4"
      onClick={e => e.target === e.currentTarget && onClose()}
    >
      <div 
        className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-2xl shadow-2xl w-full max-w-md flex flex-col overflow-hidden"
        style={{ animation: 'modalIn 0.2s ease-out' }}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-900">
           <div className="flex items-center gap-3">
             <div className="w-10 h-10 rounded-xl bg-linear-to-br from-indigo-400 to-violet-600 flex items-center justify-center text-white text-sm font-bold shrink-0 shadow">
               {ini(user.name)}
             </div>
             <div>
               <h2 className="text-sm font-bold text-gray-900 dark:text-white leading-tight">{user.name}</h2>
               <p className="text-xs text-gray-400 dark:text-gray-500 font-mono">
                 {isStudent ? user.studentId : user.instructorId} · {isStudent ? 'Student' : 'Instructor'}
               </p>
             </div>
           </div>
           <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-xl text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800">
             <XIcon size={16} />
           </button>
        </div>

        <div className="px-6 py-5 flex flex-col gap-5">
           
           {/* Profile Data */}
           <div className="bg-gray-50 dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-xl p-4 relative">
             {(!isStudent && !editing) && (
               <button onClick={() => setEditing(true)} className="absolute top-3 right-3 text-gray-400 hover:text-indigo-500">
                 <PencilIcon />
               </button>
             )}
             
             {editing ? (
               <div className="space-y-3">
                 <div>
                   <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1 block">Name</label>
                   <input className="w-full text-sm bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-700 rounded-lg px-3 py-1.5" value={editData.name} onChange={e => setEditData({...editData, name: e.target.value})} />
                 </div>
                 <div>
                   <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1 block">Department</label>
                   <input className="w-full text-sm bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-700 rounded-lg px-3 py-1.5" value={editData.department} onChange={e => setEditData({...editData, department: e.target.value})} />
                 </div>
                 <div>
                   <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1 block">Courses handled</label>
                   <input className="w-full text-sm bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-700 rounded-lg px-3 py-1.5" value={editData.courses} onChange={e => setEditData({...editData, courses: e.target.value})} />
                 </div>
               </div>
             ) : (
               <div className="space-y-3">
                 <div>
                   <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-0.5">Email</p>
                   <p className="text-sm font-medium text-gray-900 dark:text-white break-all">{user.email}</p>
                 </div>
                 {!isStudent && (
                   <>
                     <div>
                       <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-0.5">Department</p>
                       <p className="text-sm font-medium text-gray-900 dark:text-white">{user.department}</p>
                     </div>
                     <div>
                       <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-0.5">Courses Handled</p>
                       <p className="text-sm font-medium text-gray-900 dark:text-white">{user.courses}</p>
                     </div>
                   </>
                 )}
                 {isStudent && (
                   <>
                     <div>
                       <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-0.5">Course & Instructor</p>
                       <p className="text-sm font-medium text-gray-900 dark:text-white">{user.course} · {user.instructor}</p>
                     </div>
                     <div>
                       <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-0.5">Current Match</p>
                       <p className="text-sm font-medium text-gray-900 dark:text-white flex items-center gap-2">
                         {user.position ? (
                           <>
                             <span className={`font-bold ${matchColor(user.match)}`}>{user.match}%</span> 
                             <span className="text-gray-400">·</span> {user.position}
                           </>
                         ) : 'No assessment data'}
                       </p>
                     </div>
                   </>
                 )}
               </div>
             )}
           </div>
           
           {/* Actions */}
           <div className="flex flex-col gap-2 pt-2">
             {editing ? (
               <>
                 <button onClick={handleSave} className="w-full py-2.5 rounded-xl bg-green-600 hover:bg-green-700 text-white text-sm font-semibold transition-colors">Save changes</button>
                 <button onClick={() => { setEditing(false); setEditData({...user}) }} className="w-full py-2.5 rounded-xl bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 text-sm font-semibold transition-colors">Cancel</button>
               </>
             ) : (
               <>
                 {isStudent && user.status === 'completed' && (
                   <button onClick={() => onToggleRetake(user.id)} className={`flex items-center gap-2 justify-center w-full py-2.5 rounded-xl text-sm font-semibold transition-colors ${
                     user.retakeAllowed ? 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300' : 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
                   }`}>
                     <RefreshIcon /> {user.retakeAllowed ? 'Retake has been allowed' : 'Allow Assessment Retake'}
                   </button>
                 )}
                 <button onClick={() => onRemove(user)} className="flex items-center gap-2 justify-center w-full py-2.5 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-600 dark:bg-rose-950 dark:hover:bg-rose-900 dark:text-rose-400 text-sm font-semibold transition-colors">
                   <TrashIcon size={14} /> Remove {isStudent ? ' Student' : ' Instructor'}
                 </button>
               </>
             )}
           </div>

        </div>
      </div>
      <style>{`@keyframes modalIn { from { transform: translateY(10px) scale(0.98); opacity: 0; } to { transform: translateY(0) scale(1); opacity: 1; } }`}</style>
    </div>
  )
}

// ── Main Component ───────────────────────────────────────────────
export default function AdminStudents() {
  const navigate = useNavigate()
  const [activeTab,          setActiveTab]      = useState('students')
  const [studentsList,       setStudentsList]   = useState(STUDENTS)
  const [instructors,        setInstructors]    = useState(INITIAL_INSTRUCTORS)
  const [showAddInstr,       setShowAddInstr]   = useState(false)
  const [confirmRemoveInstr, setConfirmRemoveInstr] = useState(null)
  
  // User detail modal state
  const [selectedUser,       setSelectedUser]   = useState(null)
  const [selectedUserType,   setSelectedUserType] = useState('student') // 'student' | 'instructor'
  
  const [toast,              setToast]          = useState(null)
  const [search,             setSearch]         = useState('')
  const [filterStatus,       setFilterStatus]   = useState('all')
  const [filterCourse,       setFilterCourse]   = useState('all')
  const [filterInstructor,   setFilterInstr]    = useState('all')
  const [sortCol,            setSortCol]        = useState('name')
  const [sortDir,            setSortDir]        = useState('asc')
  const [page,               setPage]           = useState(1)
  // 'grid' = card view (default), 'list' = table view — toggle hidden on mobile (always grid)
  const [view,               setView]           = useState('grid')

  function showToast(msg) { setToast(msg); setTimeout(() => setToast(null), 3000) }

  function handleAddInstructor(instr) { setInstructors(prev => [...prev, instr]); showToast(`"${instr.name}" added as instructor.`) }

  function handleDeleteInstructor(instr) { setConfirmRemoveInstr(instr); setSelectedUser(null) }

  function confirmDeleteInstructor() {
    setInstructors(prev => prev.filter(i => i.id !== confirmRemoveInstr.id))
    showToast('Instructor removed.')
    setConfirmRemoveInstr(null)
  }
  
  function handleToggleRetake(studentId) {
    setStudentsList(prev => prev.map(s => s.id === studentId ? { ...s, retakeAllowed: !s.retakeAllowed } : s))
    setSelectedUser(prev => prev?.id === studentId ? { ...prev, retakeAllowed: !prev.retakeAllowed } : prev)
    const st = studentsList.find(s => s.id === studentId)
    if (st) showToast(st.retakeAllowed ? `Retake revoked for ${st.name}.` : `Retake allowed for ${st.name}.`)
  }

  function handleUpdateUser(updatedUser) {
    if (selectedUserType === 'instructor') {
      setInstructors(prev => prev.map(i => i.id === updatedUser.id ? updatedUser : i))
      showToast(`Instructor ${updatedUser.name} updated.`)
    }
  }

  function handleRemoveUser(user) {
    if (selectedUserType === 'instructor') handleDeleteInstructor(user)
    else {
      setStudentsList(prev => prev.filter(s => s.id !== user.id))
      setSelectedUser(null)
      showToast(`Student ${user.name} removed.`)
    }
  }

  function toggleSort(col) {
    if (sortCol === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortCol(col); setSortDir('asc') }
  }

  const filtered = useMemo(() => {
    let list = studentsList
    if (filterStatus !== 'all')     list = list.filter(s => s.status === filterStatus)
    if (filterCourse !== 'all')     list = list.filter(s => s.course === filterCourse)
    if (filterInstructor !== 'all') list = list.filter(s => s.instructor === filterInstructor)
    if (search.trim()) {
      const q = search.toLowerCase()
      list = list.filter(s =>
        s.name.toLowerCase().includes(q) ||
        s.studentId.toLowerCase().includes(q) ||
        s.email.toLowerCase().includes(q) ||
        (s.company ?? '').toLowerCase().includes(q)
      )
    }
    list = [...list].sort((a, b) => {
      let av, bv
      if (sortCol === 'name')        { av = a.name;        bv = b.name }
      else if (sortCol === 'match')  { av = a.match ?? -1; bv = b.match ?? -1 }
      else if (sortCol === 'course') { av = a.course;      bv = b.course }
      else { av = a.name; bv = b.name }
      if (av < bv) return sortDir === 'asc' ? -1 : 1
      if (av > bv) return sortDir === 'asc' ? 1 : -1
      return 0
    })
    return list
  }, [search, filterStatus, filterCourse, filterInstructor, sortCol, sortDir, studentsList])

  const displayed = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  function SortIcon({ col }) {
    if (sortCol !== col) return <span className="opacity-20 ml-0.5">↕</span>
    return <span className="ml-0.5">{sortDir === 'asc' ? '↑' : '↓'}</span>
  }

  const completedCount = STUDENTS.filter(s => s.status === 'completed').length
  const pendingCount   = STUDENTS.filter(s => s.status === 'pending').length

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      <AdminNav admin={ADMIN} />

      {showAddInstr && <AddInstructorModal existingInstructors={instructors} onClose={() => setShowAddInstr(false)} onAdd={handleAddInstructor} />}
      
      {selectedUser && (
        <UserDetailModal 
          user={selectedUser} 
          type={selectedUserType} 
          onClose={() => setSelectedUser(null)} 
          onUpdate={handleUpdateUser}
          onRemove={handleRemoveUser}
          onToggleRetake={handleToggleRetake}
        />
      )}

      {confirmRemoveInstr && (
        <ConfirmModal
          title="Remove instructor?"
          message={`${confirmRemoveInstr.name} will be removed from the system. Their enrolled students will not be affected.`}
          confirmLabel="Remove"
          onConfirm={confirmDeleteInstructor}
          onCancel={() => setConfirmRemoveInstr(null)}
        />
      )}

      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-gray-900 dark:bg-white text-white dark:text-gray-900 text-sm font-medium px-5 py-3 rounded-2xl shadow-lg flex items-center gap-2">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M20 6L9 17l-5-5" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
          {toast}
        </div>
      )}

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-6">

        {/* Page header */}
        <div className="flex flex-col sm:flex-row sm:items-end gap-3 justify-between">
          <div>
            <h1 className="text-xl font-semibold text-gray-900 dark:text-white">Users</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
              Manage students and instructors registered in the system.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => showToast('Exporting user data to CSV...')}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 text-sm font-medium transition-colors"
              title="Export to CSV"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
              Export
            </button>
            {activeTab === 'instructors' && (
              <button
                onClick={() => setShowAddInstr(true)}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-green-600 hover:bg-green-700 text-white text-sm font-medium transition-colors"
              >
                <span className="text-base leading-none">+</span> Add Instructor
              </button>
            )}
          </div>
        </div>

        {/* Tab switcher */}
        <div className="flex gap-1 bg-gray-100 dark:bg-gray-800 rounded-xl p-1 w-fit">
          {[
            { key: 'students',    label: `Students (${studentsList.length})`       },
            { key: 'instructors', label: `Instructors (${instructors.length})` },
          ].map(t => (
            <button
              key={t.key}
              onClick={() => setActiveTab(t.key)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors
                ${activeTab === t.key
                  ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm'
                  : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'}`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* ── INSTRUCTORS TAB ── */}
        {activeTab === 'instructors' && (
          <div className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-2xl overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 dark:border-gray-800">
                  <th className="text-left px-5 py-3.5 text-xs font-semibold text-gray-500 dark:text-gray-400">Instructor</th>
                  <th className="text-left px-3 py-3.5 text-xs font-semibold text-gray-500 dark:text-gray-400">Instructor ID</th>
                  <th className="text-left px-3 py-3.5 text-xs font-semibold text-gray-500 dark:text-gray-400">DNSC Email</th>
                  <th className="text-left px-3 py-3.5 text-xs font-semibold text-gray-500 dark:text-gray-400">Department</th>
                  <th className="text-left px-3 py-3.5 text-xs font-semibold text-gray-500 dark:text-gray-400">Courses</th>
                  <th className="text-left px-3 py-3.5 text-xs font-semibold text-gray-500 dark:text-gray-400">Students</th>
                  <th className="px-5 py-3.5" />
                </tr>
              </thead>
              <tbody>
                {instructors.map((instr, i) => {
                  const studentCount = studentsList.filter(s => s.instructor === instr.name).length
                  return (
                    <tr key={instr.id}
                      onClick={() => { setSelectedUser(instr); setSelectedUserType('instructor') }}
                      className={`cursor-pointer border-b border-gray-50 dark:border-gray-800 last:border-0 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors
                        ${i % 2 === 0 ? '' : 'bg-gray-50/30 dark:bg-gray-800/20'}`}>
                      {/* Name */}
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-7 h-7 rounded-full bg-violet-100 dark:bg-violet-900 flex items-center justify-center text-xs font-semibold text-violet-700 dark:text-violet-300 shrink-0">
                            {instr.name.split(' ').map(n => n[0]).slice(0, 2).join('')}
                          </div>
                          <p className="text-sm font-medium text-gray-900 dark:text-white">{instr.name}</p>
                        </div>
                      </td>
                      <td className="px-3 py-4 font-mono text-xs text-gray-500 dark:text-gray-400">{instr.instructorId}</td>
                      <td className="px-3 py-4 text-xs text-gray-500 dark:text-gray-400">{instr.email}</td>
                      <td className="px-3 py-4 text-xs text-gray-500 dark:text-gray-400">{instr.department}</td>
                      <td className="px-3 py-4">
                        <span className="text-xs font-medium bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 px-2 py-0.5 rounded-full">
                          {instr.courses}
                        </span>
                      </td>
                      <td className="px-3 py-4 text-xs text-gray-500 dark:text-gray-400">
                        {studentCount} student{studentCount !== 1 ? 's' : ''}
                      </td>
                      <td className="px-5 py-4 text-right">
                        <button
                          onClick={(e) => { e.stopPropagation(); handleDeleteInstructor(instr) }}
                          className="p-1.5 rounded-lg text-gray-300 dark:text-gray-700 hover:text-rose-500 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950 transition-colors"
                          title="Remove instructor"
                        >
                          <TrashIcon size={13}/>
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* ── STUDENTS TAB ── */}
        {activeTab === 'students' && (<>

          {/* Counts */}
          <p className="text-sm text-gray-500 dark:text-gray-400 -mt-3">
            {STUDENTS.length} total ·{' '}
            <span className="text-green-600 dark:text-green-400 font-medium">{completedCount} completed</span>{' '}·{' '}
            <span className="text-amber-600 dark:text-amber-400 font-medium">{pendingCount} pending</span>
          </p>

          {/* ── Controls row ──────────────────────────────────────────── */}
          <div className="flex flex-col sm:flex-row sm:items-center gap-3 justify-between flex-wrap">

            {/* Left: filters */}
            <div className="flex flex-wrap items-center gap-2 flex-1">
              {/* Search */}
              <div className="relative flex-1 sm:flex-none">
                <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z"/>
                </svg>
                <input
                  value={search}
                  onChange={e => { setSearch(e.target.value); setPage(1) }}
                  placeholder="Search name, ID, email…"
                  className="w-full sm:w-52 pl-8 pr-3 py-1.5 text-sm rounded-full bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-gray-600 focus:outline-none focus:ring-2 focus:ring-green-500"
                />
              </div>

              {/* Status pills */}
              <div className="flex items-center gap-1">
                {[
                  { value: 'all',       label: 'All'       },
                  { value: 'completed', label: 'Completed' },
                  { value: 'pending',   label: 'Pending'   },
                ].map(f => (
                  <button
                    key={f.value}
                    onClick={() => { setFilterStatus(f.value); setPage(1) }}
                    className={`text-xs px-3 py-1.5 rounded-full font-medium transition-colors
                      ${filterStatus === f.value
                        ? 'bg-gray-900 dark:bg-white text-white dark:text-gray-900'
                        : 'bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'}`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>

              {/* Course select */}
              <select
                value={filterCourse}
                onChange={e => { setFilterCourse(e.target.value); setPage(1) }}
                className="text-xs px-3 py-1.5 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 border-none focus:outline-none focus:ring-2 focus:ring-green-500 cursor-pointer"
              >
                <option value="all">All Courses</option>
                {COURSES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>

              {/* Instructor select */}
              <select
                value={filterInstructor}
                onChange={e => { setFilterInstr(e.target.value); setPage(1) }}
                className="text-xs px-3 py-1.5 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 border-none focus:outline-none focus:ring-2 focus:ring-green-500 cursor-pointer max-w-50 truncate"
              >
                <option value="all">All Instructors</option>
                {INSTRUCTORS_LIST.map(i => <option key={i} value={i}>{i}</option>)}
              </select>
            </div>

            {/* Right: count + grid/list toggle */}
            <div className="flex items-center gap-3 shrink-0">
              <p className="text-xs text-gray-400 dark:text-gray-500">{filtered.length} students</p>

              {/* Grid / List toggle — desktop only; mobile is always grid */}
              <div className="hidden sm:flex items-center gap-1 bg-gray-100 dark:bg-gray-800 rounded-xl p-1">
                {[{ val: 'grid', Icon: GridIcon }, { val: 'list', Icon: ListIcon }].map(v => (
                  <button
                    key={v.val}
                    onClick={() => setView(v.val)}
                    title={v.val === 'grid' ? 'Card view' : 'List view'}
                    className={`p-1.5 rounded-lg transition-colors
                      ${view === v.val
                        ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm'
                        : 'text-gray-400 dark:text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'}`}
                  >
                    <v.Icon />
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* ── Empty state ────────────────────────────────────────── */}
          {filtered.length === 0 && (
            <div className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-2xl py-14 flex flex-col items-center gap-3">
              <p className="text-sm text-gray-400 dark:text-gray-600">No students match your filters.</p>
              <button
                onClick={() => { setSearch(''); setFilterStatus('all'); setFilterCourse('all'); setFilterInstr('all'); setPage(1) }}
                className="text-xs text-green-600 dark:text-green-400 hover:underline"
              >
                Clear filters
              </button>
            </div>
          )}

          {/* ── GRID / CARD VIEW — always on mobile, toggle on desktop ── */}
          {filtered.length > 0 && (
            <div className={`${view === 'grid' ? 'grid' : 'grid sm:hidden'} grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4`}>
              {displayed.map(s => (
                <div key={s.id} 
                  onClick={() => { setSelectedUser(s); setSelectedUserType('student') }}
                  className="cursor-pointer bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-2xl p-5 flex flex-col gap-3 hover:shadow-sm hover:border-gray-200 dark:hover:border-gray-700 transition-all">

                  {/* Top: avatar + name + status badge */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center text-sm font-bold text-blue-700 dark:text-blue-300 shrink-0">
                        {ini(s.name)}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-gray-900 dark:text-white leading-tight truncate">{s.name}</p>
                        <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">{s.studentId} · {s.course}</p>
                        <p className="text-xs text-gray-400 dark:text-gray-500 truncate">{s.email}</p>
                      </div>
                    </div>
                    {s.status === 'completed'
                      ? <span className="inline-flex items-center gap-1 text-xs font-medium text-green-700 dark:text-green-300 bg-green-100 dark:bg-green-900 px-2 py-0.5 rounded-full shrink-0">
                          <span className="w-1 h-1 rounded-full bg-green-500"/>Done
                        </span>
                      : <span className="inline-flex items-center gap-1 text-xs font-medium text-amber-700 dark:text-amber-300 bg-amber-100 dark:bg-amber-900 px-2 py-0.5 rounded-full shrink-0">
                          <span className="w-1 h-1 rounded-full bg-amber-500"/>Pending
                        </span>
                    }
                  </div>

                  {/* Instructor */}
                  <p className="text-xs text-gray-400 dark:text-gray-500">
                    <span className="text-gray-500 dark:text-gray-400 font-medium">Instructor:</span> {s.instructor}
                  </p>

                  {/* Recommendation + match bar */}
                  {s.position ? (
                    <div className="pt-2 border-t border-gray-50 dark:border-gray-800 space-y-1.5">
                      <div className="flex items-center justify-between gap-2">
                        <div className="min-w-0">
                          <p className="text-xs font-medium text-gray-700 dark:text-gray-300 truncate">{s.position}</p>
                          <p className="text-xs text-gray-400 dark:text-gray-500 truncate">{s.company}</p>
                        </div>
                        <span className={`text-base font-bold shrink-0 ${matchColor(s.match)}`}>{s.match}%</span>
                      </div>
                      <div className="h-1.5 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
                        <div className={`h-full rounded-full transition-all ${matchBarColor(s.match)}`} style={{ width: `${s.match}%` }}/>
                      </div>
                    </div>
                  ) : (
                    <div className="pt-2 border-t border-gray-50 dark:border-gray-800">
                      <p className="text-xs text-gray-300 dark:text-gray-700 italic">No assessment yet</p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* ── LIST / TABLE VIEW — desktop only, shown when view === 'list' ── */}
          {filtered.length > 0 && view === 'list' && (
            <div className="hidden sm:block bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-2xl overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm min-w-640px">
                  <thead>
                    <tr className="border-b border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/50">
                      <th
                        onClick={() => toggleSort('name')}
                        className="text-left px-5 py-3.5 text-xs font-semibold text-gray-500 dark:text-gray-400 cursor-pointer hover:text-gray-900 dark:hover:text-white transition-colors select-none"
                      >
                        Student <SortIcon col="name" />
                      </th>
                      <th
                        onClick={() => toggleSort('course')}
                        className="text-left px-3 py-3.5 text-xs font-semibold text-gray-500 dark:text-gray-400 cursor-pointer hover:text-gray-900 dark:hover:text-white transition-colors select-none"
                      >
                        Course <SortIcon col="course" />
                      </th>
                      <th className="text-left px-3 py-3.5 text-xs font-semibold text-gray-500 dark:text-gray-400">
                        Instructor
                      </th>
                      <th className="text-left px-3 py-3.5 text-xs font-semibold text-gray-500 dark:text-gray-400">
                        Status
                      </th>
                      <th className="text-left px-3 py-3.5 text-xs font-semibold text-gray-500 dark:text-gray-400">
                        Top Recommendation
                      </th>
                      <th
                        onClick={() => toggleSort('match')}
                        className="text-center px-5 py-3.5 text-xs font-semibold text-gray-500 dark:text-gray-400 cursor-pointer hover:text-gray-900 dark:hover:text-white transition-colors select-none"
                      >
                        Match <SortIcon col="match" />
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {displayed.map((s, i) => (
                      <tr
                        key={s.id}
                        onClick={() => { setSelectedUser(s); setSelectedUserType('student') }}
                        className={`cursor-pointer border-b border-gray-50 dark:border-gray-800 last:border-0 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors
                          ${i % 2 === 0 ? '' : 'bg-gray-50/30 dark:bg-gray-800/20'}`}
                      >
                        {/* Name */}
                        <td className="px-5 py-4">
                          <div className="flex items-center gap-3">
                            <div className="w-7 h-7 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center text-xs font-semibold text-blue-700 dark:text-blue-300 shrink-0">
                              {ini(s.name)}
                            </div>
                            <div>
                              <p className="text-sm font-medium text-gray-900 dark:text-white leading-tight">{s.name}</p>
                              <p className="text-xs text-gray-400 dark:text-gray-500">{s.studentId} · {s.email}</p>
                            </div>
                          </div>
                        </td>

                        {/* Course */}
                        <td className="px-3 py-4">
                          <span className="text-xs font-medium bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 px-2 py-0.5 rounded-full">
                            {s.course}
                          </span>
                        </td>

                        {/* Instructor */}
                        <td className="px-3 py-4 text-xs text-gray-500 dark:text-gray-400 max-w-40 truncate">{s.instructor}</td>

                        {/* Status */}
                        <td className="px-3 py-4">
                          {s.status === 'completed' ? (
                            <span className="inline-flex items-center gap-1 text-xs font-medium text-green-700 dark:text-green-300 bg-green-100 dark:bg-green-900 px-2.5 py-1 rounded-full">
                              <span className="w-1 h-1 rounded-full bg-green-500 inline-block" /> Done
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-xs font-medium text-amber-700 dark:text-amber-300 bg-amber-100 dark:bg-amber-900 px-2.5 py-1 rounded-full">
                              <span className="w-1 h-1 rounded-full bg-amber-500 inline-block" /> Pending
                            </span>
                          )}
                        </td>

                        {/* Recommendation */}
                        <td className="px-3 py-4">
                          {s.position ? (
                            <div>
                              <p className="text-xs font-medium text-gray-700 dark:text-gray-300 leading-tight">{s.position}</p>
                              <p className="text-xs text-gray-400 dark:text-gray-500">{s.company}</p>
                            </div>
                          ) : (
                            <span className="text-xs text-gray-300 dark:text-gray-700">—</span>
                          )}
                        </td>

                        {/* Match score */}
                        <td className={`px-5 py-4 text-center ${matchBg(s.match)}`}>
                          <span className={`text-sm font-bold ${matchColor(s.match)}`}>
                            {s.match !== null ? `${s.match}%` : '—'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Legend + Pagination */}
          <div className="flex flex-wrap items-center gap-3 px-1">
            <p className="text-xs text-gray-400 dark:text-gray-600">Match key:</p>
            {[
              { label: '≥ 80% Strong',    cls: 'bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300' },
              { label: '60–79% Fair',     cls: 'bg-amber-100 dark:bg-amber-900 text-amber-700 dark:text-amber-300' },
              { label: '< 60% Low match', cls: 'bg-rose-100 dark:bg-rose-900 text-rose-700 dark:text-rose-300'     },
            ].map(l => (
              <span key={l.label} className={`text-xs font-medium px-2.5 py-1 rounded-full ${l.cls}`}>{l.label}</span>
            ))}
          </div>

          <Pagination total={filtered.length} page={page} onPage={setPage} />

        </>)}

      </main>
    </div>
  )
}