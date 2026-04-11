// src/pages/admin/AdminUsers.jsx
//
// Shows:
//   1. Searchable + filterable table of ALL students (across all instructors/courses)
//   2. Filter by course, status, instructor
//   3. Per-student row: name, student ID, course, instructor, assessment status, match score, top recommendation
//   4. View profile button (navigates to student detail — placeholder for now)
//   5. Grid / List view toggle (desktop); always grid on mobile — applied to ALL tabs
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
const BellIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path>
    <path d="M13.73 21a2 2 0 0 1-3.46 0"></path>
  </svg>
)
const ChevronRightIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M9 18l6-6-6-6"/>
  </svg>
)

// Extract name from DNSC email: lastname.firstname@dnsc.edu.ph → "Firstname Lastname"
function nameFromEmail(email) {
  const local = email.split('@')[0]
  const parts = local.split('.')
  const cap   = s => s.charAt(0).toUpperCase() + s.slice(1).toLowerCase()
  if (parts.length >= 2) return `${cap(parts[1])} ${cap(parts[0])}`
  return cap(parts[0])
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

// ── View Toggle ────────────────────────────────────────────────────
function ViewToggle({ view, setView }) {
  return (
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

const COURSES       = ['BSIT', 'BSIS']
const INSTRUCTORS_LIST = [...new Set(STUDENTS.map(s => s.instructor))]

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
  const [open,      setOpen]      = useState(false)
  const [notifOpen, setNotifOpen] = useState(false)
  const [mobile,    setMobile]    = useState(false)
  const [dark,      setDark]      = useState(() => localStorage.getItem('sb-theme') === 'dark')

  function toggleDark() {
    const next = !dark; setDark(next)
    document.documentElement.classList.toggle('dark', next)
    localStorage.setItem('sb-theme', next ? 'dark' : 'light')
  }

  function go(path) {
    navigate(path)
    setMobile(false)
    setOpen(false)
  }

  const links = [
    { label: 'Dashboard', path: '/admin/dashboard' },
    { label: 'Companies', path: '/admin/companies' },
    { label: 'Users',     path: '/admin/users',     active: true },
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

        {/* Desktop nav links */}
        <div className="hidden md:flex items-center gap-1">
          {links.map(l => (
            <button key={l.label} onClick={() => go(l.path)}
              className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${l.active ? 'bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-white font-medium' : 'text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-50 dark:hover:bg-gray-800'}`}
            >{l.label}</button>
          ))}
        </div>

        {/* Right side */}
        <div className="flex items-center gap-2">

          {/* Notification bell */}
          <div className="relative hidden sm:block">
            <button onClick={() => { setNotifOpen(p => !p); setOpen(false) }} className="relative p-1.5 rounded-full text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
              <BellIcon />
              <span className="absolute top-1 right-1.5 w-2 h-2 bg-rose-500 rounded-full border-2 border-white dark:border-gray-900 pointer-events-none"></span>
            </button>
            {notifOpen && (
              <div className="absolute right-0 mt-2 w-72 bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-2xl shadow-lg overflow-hidden z-20">
                <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-800 flex justify-between items-center">
                  <p className="text-sm font-bold text-gray-900 dark:text-white">Notifications</p>
                  <span className="text-[10px] uppercase font-bold text-gray-400">3 New</span>
                </div>
                <div className="max-h-64 overflow-y-auto">
                  <div onClick={() => { go('/admin/users?tab=pending'); setNotifOpen(false) }} className="px-4 py-3 border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/50 cursor-pointer flex gap-3 transition-colors bg-blue-50/30 dark:bg-blue-900/10">
                    <div className="mt-0.5 w-2 h-2 bg-blue-500 rounded-full shrink-0"></div>
                    <div>
                      <p className="text-sm font-semibold text-gray-900 dark:text-white leading-snug">New Instructor Request</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Alice Walker has requested instructor access.</p>
                      <p className="text-[10px] text-gray-400 mt-1">2 mins ago</p>
                    </div>
                  </div>
                  <div onClick={() => { go('/admin/companies'); setNotifOpen(false) }} className="px-4 py-3 border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/50 cursor-pointer flex gap-3 transition-colors">
                    <div className="mt-0.5 w-2 h-2 bg-gray-200 dark:bg-gray-700 rounded-full shrink-0"></div>
                    <div>
                      <p className="text-sm font-semibold text-gray-900 dark:text-white leading-snug">Azeus Systems Registered</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">A new company profile was created.</p>
                      <p className="text-[10px] text-gray-400 mt-1">1 hour ago</p>
                    </div>
                  </div>
                  <div className="px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-800/50 cursor-pointer flex gap-3 transition-colors">
                    <div className="mt-0.5 w-2 h-2 bg-gray-200 dark:bg-gray-700 rounded-full shrink-0"></div>
                    <div>
                      <p className="text-sm font-semibold text-gray-900 dark:text-white leading-snug">System Update</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Assessment matching engine updated to v2.0.</p>
                      <p className="text-[10px] text-gray-400 mt-1">1 day ago</p>
                    </div>
                  </div>
                </div>
                <div className="px-4 py-2 bg-gray-50 dark:bg-gray-800/50 text-center border-t border-gray-100 dark:border-gray-800">
                  <button onClick={() => { go('/admin/notifications'); setNotifOpen(false) }} className="text-xs font-semibold text-blue-600 hover:text-blue-700 dark:text-blue-400">View All activity</button>
                </div>
              </div>
            )}
          </div>

          {/* Hamburger — mobile only */}
          <button
            onClick={() => setMobile(p => !p)}
            className="md:hidden p-2 rounded-lg text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 active:bg-gray-200 dark:active:bg-gray-700 transition-colors"
            aria-label="Toggle menu"
          >
            {mobile ? <XIcon size={20} /> : <MenuIcon />}
          </button>

          {/* Avatar dropdown */}
          <div className="relative ml-1">
            <button
              onClick={() => { setOpen(p => !p); setNotifOpen(false) }}
              className="w-8 h-8 rounded-full bg-rose-100 dark:bg-rose-900 flex items-center justify-center text-xs font-semibold text-rose-700 dark:text-rose-300 hover:ring-2 hover:ring-rose-400 transition-all"
            >
              {admin.initials}
            </button>
            {open && (
              <div className="absolute right-0 mt-2 w-56 bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-2xl shadow-xl overflow-hidden z-40">
                <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-800">
                  <p className="text-sm font-semibold text-gray-900 dark:text-white truncate">{admin.name}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">Administrator</p>
                </div>
                <div className="px-4 py-3 flex items-center justify-between border-b border-gray-100 dark:border-gray-800">
                  <span className="text-sm text-gray-700 dark:text-gray-300">{dark ? 'Dark mode' : 'Light mode'}</span>
                  <button onClick={toggleDark}
                    className={`relative w-9 h-5 rounded-full transition-colors ${dark ? 'bg-green-600' : 'bg-gray-200'}`}>
                    <span className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${dark ? 'translate-x-4' : 'translate-x-0'}`} />
                  </button>
                </div>
                <button onClick={() => go('/login')}
                  className="w-full text-left px-4 py-3 text-sm text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950 transition-colors">
                  Sign out
                </button>
              </div>
            )}
          </div>
        </div>
      </nav>

      {/* Mobile slide-down menu */}
      {mobile && (
        <div className="md:hidden bg-white dark:bg-gray-900 border-b border-gray-100 dark:border-gray-800 shadow-sm">
          <div className="px-4 py-3 flex flex-col gap-1">
            {links.map(l => (
              <button key={l.label} onClick={() => go(l.path)}
                className={`w-full text-left px-3 py-2.5 rounded-xl text-sm transition-colors
                  ${l.active
                    ? 'bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-white font-medium'
                    : 'text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-50 dark:hover:bg-gray-800'}`}>
                {l.label}
              </button>
            ))}
          </div>
        </div>
      )}
    </>
  )
}

// ── Add Instructor Modal ──────────────────────────────────────────
function AddInstructorModal({ existingInstructors, onClose, onAdd }) {
  const [name,         setName]         = useState('')
  const [nameEdited,   setNameEdited]   = useState(false)
  const [email,        setEmail]        = useState('')
  const [instructorId, setInstructorId] = useState('')
  const [department,   setDepartment]   = useState('Institute of Computing')
  const [courses,      setCourses]      = useState('BSIT / BSIS')
  const [errors,       setErrors]       = useState({})

  function validate() {
    const e = {}
    if (!name.trim())         e.name         = 'Full name is required.'
    if (!email.trim())        e.email        = 'Email is required.'
    else if (!email.endsWith('@dnsc.edu.ph')) e.email = 'Must be a DNSC email.'
    if (!instructorId.trim()) e.instructorId = 'Instructor ID is required.'
    else if (existingInstructors.some(i => i.instructorId === instructorId.trim())) e.instructorId = 'ID already in use.'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  function handleSubmit() {
    if (!validate()) return
    onAdd({ id: _nextInstructorId++, name: name.trim(), email: email.trim(), instructorId: instructorId.trim(), department, courses })
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-sm px-4 pb-4 sm:pb-0"
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-2xl shadow-xl w-full max-w-sm p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-gray-900 dark:text-white">Add Instructor</h3>
          <button onClick={onClose} className="w-7 h-7 flex items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800"><XIcon /></button>
        </div>
        <div>
          <label className="text-xs font-medium text-gray-700 dark:text-gray-300 block mb-1">DNSC Email</label>
          <input value={email} onChange={e => {
              const val = e.target.value
              setEmail(val)
              setErrors(err => ({ ...err, email: '' }))
              if (!nameEdited && val.includes('.')) {
                setName(nameFromEmail(val.trim().toLowerCase()))
              }
            }}
            placeholder="e.g. mtreyes@dnsc.edu.ph"
            className={`w-full px-3 py-2 text-sm rounded-xl border bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-gray-600 focus:outline-none focus:ring-2 focus:ring-green-500
              ${errors.email ? 'border-red-400' : 'border-gray-200 dark:border-gray-700'}`}/>
          {errors.email && <p className="text-xs text-red-500 mt-1">{errors.email}</p>}
        </div>
        <div>
          <label className="text-xs font-medium text-gray-700 dark:text-gray-300 block mb-1">Full Name</label>
          <input value={name} onChange={e => { setName(e.target.value); setNameEdited(true); setErrors(err => ({ ...err, name: '' })) }}
            placeholder="e.g. Ma. Lourdes T. Reyes"
            className={`w-full px-3 py-2 text-sm rounded-xl border bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-gray-600 focus:outline-none focus:ring-2 focus:ring-green-500
              ${errors.name ? 'border-red-400' : 'border-gray-200 dark:border-gray-700'}`}/>
          {errors.name && <p className="text-xs text-red-500 mt-1">{errors.name}</p>}
        </div>
        <div>
          <label className="text-xs font-medium text-gray-700 dark:text-gray-300 block mb-1">Instructor ID</label>
          <input value={instructorId} onChange={e => setInstructorId(e.target.value)}
            placeholder="e.g. 2018-00042"
            className={`w-full px-3 py-2 text-sm rounded-xl border bg-white dark:bg-gray-800 text-gray-900 dark:text-white font-mono placeholder:text-gray-400 dark:placeholder:text-gray-600 focus:outline-none focus:ring-2 focus:ring-green-500
              ${errors.instructorId ? 'border-red-400' : 'border-gray-200 dark:border-gray-700'}`}/>
          {errors.instructorId && <p className="text-xs text-red-500 mt-1">{errors.instructorId}</p>}
        </div>
        <div>
          <label className="text-xs font-medium text-gray-700 dark:text-gray-300 block mb-1">Department</label>
          <input value={department} onChange={e => setDepartment(e.target.value)}
            placeholder="e.g. Institute of Computing"
            className="w-full px-3 py-2 text-sm rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-gray-600 focus:outline-none focus:ring-2 focus:ring-green-500"/>
        </div>
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
  const [editing, setEditing] = useState(false)
  const [editData, setEditData] = useState({ ...user, roleType: type })

  function handleSave() {
    onUpdate({ ...user, ...editData }, type, editData.roleType)
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
           <div className="bg-gray-50 dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-xl p-4 relative">
             {(!isStudent && !editing) && (
               <button onClick={() => setEditing(true)} className="absolute top-3 right-3 text-gray-400 hover:text-indigo-500">
                 <PencilIcon />
               </button>
             )}
             {editing ? (
               <div className="space-y-3">
                 <div>
                   <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1 block">Role</label>
                   <select className="w-full text-sm bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-1.5" value={editData.roleType} onChange={e => setEditData({...editData, roleType: e.target.value})}>
                     <option value="student">Student</option>
                     <option value="instructor">Instructor</option>
                   </select>
                 </div>
                 <div>
                   <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1 block">Name</label>
                   <input className="w-full text-sm bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-1.5" value={editData.name} onChange={e => setEditData({...editData, name: e.target.value})} />
                 </div>
                 <div>
                   <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1 block">Email</label>
                   <input className="w-full text-sm bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-1.5" value={editData.email} onChange={e => setEditData({...editData, email: e.target.value})} />
                 </div>
                 <div>
                   <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1 block">ID</label>
                   <input className="w-full text-sm bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-1.5" value={editData.roleType === 'student' ? (editData.studentId || '') : (editData.instructorId || '')} onChange={e => {
                     if (editData.roleType === 'student') setEditData({...editData, studentId: e.target.value})
                     else setEditData({...editData, instructorId: e.target.value})
                   }} />
                 </div>
                 <div>
                   <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1 block">Department</label>
                   <input className="w-full text-sm bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-1.5" value={editData.department || ''} onChange={e => setEditData({...editData, department: e.target.value})} />
                 </div>
                 <div>
                   <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1 block">Courses handled</label>
                   <input className="w-full text-sm bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-1.5" value={editData.courses || ''} onChange={e => setEditData({...editData, courses: e.target.value})} />
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
                       <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-0.5">Assessment Status</p>
                       <p className="text-sm font-medium text-gray-900 dark:text-white capitalize">{user.status}</p>
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
                     {user.company && (
                       <div>
                         <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-0.5">Company</p>
                         <p className="text-sm font-medium text-gray-900 dark:text-white">{user.company}</p>
                       </div>
                     )}
                   </>
                 )}
               </div>
             )}
           </div>

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
                   <TrashIcon size={14} /> Remove {isStudent ? 'Student' : 'Instructor'}
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

// ── Pending Detail Modal ──────────────────────────────────────────
function PendingDetailModal({ user, onClose, onApprove, onReject }) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm px-4"
      onClick={e => e.target === e.currentTarget && onClose()}
    >
      <div
        className="bg-white dark:bg-gray-900 border border-amber-100 dark:border-amber-900/30 rounded-2xl shadow-2xl w-full max-w-md flex flex-col overflow-hidden"
        style={{ animation: 'modalIn 0.2s ease-out' }}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-amber-100 dark:border-amber-900/30 bg-amber-50/50 dark:bg-amber-900/10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-linear-to-br from-amber-400 to-orange-500 flex items-center justify-center text-white text-sm font-bold shrink-0 shadow">
              {ini(user.name)}
            </div>
            <div>
              <h2 className="text-sm font-bold text-gray-900 dark:text-white leading-tight">{user.name}</h2>
              <p className="text-xs text-amber-600 dark:text-amber-400 font-medium">Pending Approval · Instructor Request</p>
            </div>
          </div>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-xl text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800">
            <XIcon size={16} />
          </button>
        </div>
        <div className="px-6 py-5 flex flex-col gap-5">
          <div className="bg-gray-50 dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-xl p-4 space-y-3">
            <div>
              <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-0.5">Email</p>
              <p className="text-sm font-medium text-gray-900 dark:text-white break-all">{user.email}</p>
            </div>
            <div>
              <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-0.5">Instructor ID</p>
              <p className="text-sm font-mono text-gray-900 dark:text-white">{user.instructorId}</p>
            </div>
            <div>
              <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-0.5">Department</p>
              <p className="text-sm font-medium text-gray-900 dark:text-white">{user.department}</p>
            </div>
            <div>
              <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-0.5">Courses Requested</p>
              <p className="text-sm font-medium text-gray-900 dark:text-white">{user.courses}</p>
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={onReject} className="flex-1 py-2.5 rounded-xl bg-gray-100 hover:bg-rose-100 text-gray-700 hover:text-rose-600 dark:bg-gray-800 dark:hover:bg-rose-900 dark:text-gray-300 dark:hover:text-rose-400 text-sm font-semibold transition-colors">Reject</button>
            <button onClick={onApprove} className="flex-1 py-2.5 rounded-xl bg-green-600 hover:bg-green-700 text-white text-sm font-semibold transition-colors">Approve</button>
          </div>
        </div>
      </div>
      <style>{`@keyframes modalIn { from { transform: translateY(10px) scale(0.98); opacity: 0; } to { transform: translateY(0) scale(1); opacity: 1; } }`}</style>
    </div>
  )
}

// ── Main Component ───────────────────────────────────────────────
export default function AdminUsers() {
  const navigate = useNavigate()
  const [activeTab,          setActiveTab]      = useState('students')
  const [studentsList,       setStudentsList]   = useState(STUDENTS)
  const [instructors,        setInstructors]    = useState(INITIAL_INSTRUCTORS)
  const [showAddInstr,       setShowAddInstr]   = useState(false)
  const [confirmRemoveInstr, setConfirmRemoveInstr] = useState(null)

  const [pendingInstructors, setPendingInstructors] = useState([
    { id: 102, name: 'Alice Walker', instructorId: '2024-00001', email: 'awalker@dnsc.edu.ph', department: 'Institute of Computing', courses: 'BSIT' }
  ])

  // User detail modal state
  const [selectedUser,     setSelectedUser]     = useState(null)
  const [selectedUserType, setSelectedUserType] = useState('student')
  const [selectedPending,  setSelectedPending]  = useState(null)

  const [toast,            setToast]            = useState(null)
  const [search,           setSearch]           = useState('')
  const [filterStatus,     setFilterStatus]     = useState('all')
  const [filterCourse,     setFilterCourse]     = useState('all')
  const [filterInstructor, setFilterInstr]      = useState('all')
  const [sortCol,          setSortCol]          = useState('name')
  const [sortDir,          setSortDir]          = useState('asc')
  const [page,             setPage]             = useState(1)
  // Shared view state — 'grid' = card view (default), 'list' = table view
  const [view,             setView]             = useState('grid')

  function showToast(msg) { setToast(msg); setTimeout(() => setToast(null), 3000) }

  function handleAddInstructor(instr) { setInstructors(prev => [...prev, instr]); showToast(`"${instr.name}" added as instructor.`) }

  function handleDeleteInstructor(instr) { setConfirmRemoveInstr(instr); setSelectedUser(null) }

  function confirmDeleteInstructor() {
    setInstructors(prev => prev.map(i => i.id === confirmRemoveInstr.id ? { ...i, archived: true } : i))
    showToast('Instructor archived.')
    setConfirmRemoveInstr(null)
  }

  function handleToggleRetake(studentId) {
    setStudentsList(prev => prev.map(s => s.id === studentId ? { ...s, retakeAllowed: !s.retakeAllowed } : s))
    setSelectedUser(prev => prev?.id === studentId ? { ...prev, retakeAllowed: !prev.retakeAllowed } : prev)
    const st = studentsList.find(s => s.id === studentId)
    if (st) showToast(st.retakeAllowed ? `Retake revoked for ${st.name}.` : `Retake allowed for ${st.name}.`)
  }

  function handleUpdateUser(updatedUser, oldType, newType) {
    if (oldType === newType) {
      if (oldType === 'instructor') setInstructors(prev => prev.map(i => i.id === updatedUser.id ? updatedUser : i))
      else setStudentsList(prev => prev.map(s => s.id === updatedUser.id ? updatedUser : s))
    } else {
      if (oldType === 'student' && newType === 'instructor') {
        setStudentsList(p => p.filter(s => s.id !== updatedUser.id))
        setInstructors(p => [...p, updatedUser])
      } else {
        setInstructors(p => p.filter(i => i.id !== updatedUser.id))
        setStudentsList(p => [...p, updatedUser])
      }
    }
    showToast(`User ${updatedUser.name} updated.`)
  }

  function handleRemoveUser(user) {
    if (selectedUserType === 'instructor') handleDeleteInstructor(user)
    else {
      setStudentsList(prev => prev.map(s => s.id === user.id ? { ...s, archived: true } : s))
      setSelectedUser(null)
      showToast(`Student ${user.name} archived.`)
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

    if (activeTab === 'all' || activeTab === 'archived') {
      const combined = [
        ...studentsList.map(s => ({ ...s, role: 'student' })),
        ...instructors.map(i => ({ ...i, role: 'instructor' })),
      ]
      list = activeTab === 'archived' ? combined.filter(u => u.archived) : combined.filter(u => !u.archived)

      if (search.trim()) {
        const q = search.toLowerCase()
        list = list.filter(u =>
          u.name.toLowerCase().includes(q) ||
          (u.email ?? '').toLowerCase().includes(q) ||
          (u.studentId ?? '').toLowerCase().includes(q) ||
          (u.instructorId ?? '').toLowerCase().includes(q)
        )
      }
    } else {
      list = list.filter(s => !s.archived)
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
  }, [search, filterStatus, filterCourse, filterInstructor, sortCol, sortDir, studentsList, instructors, activeTab])

  const displayed = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  function SortIcon({ col }) {
    if (sortCol !== col) return <span className="opacity-20 ml-0.5">↕</span>
    return <span className="ml-0.5">{sortDir === 'asc' ? '↑' : '↓'}</span>
  }

  const completedCount = studentsList.filter(s => s.status === 'completed').length
  const pendingCount   = studentsList.filter(s => s.status === 'pending').length

  // Filtered instructors (non-archived)
  const activeInstructors = instructors.filter(i => !i.archived)

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

      {selectedPending && (
        <PendingDetailModal
          user={selectedPending}
          onClose={() => setSelectedPending(null)}
          onApprove={() => {
            setPendingInstructors(p => p.filter(x => x.id !== selectedPending.id))
            setInstructors(p => [...p, { ...selectedPending, archived: false, status: 'active' }])
            showToast(`${selectedPending.name} approved.`)
            setSelectedPending(null)
          }}
          onReject={() => {
            setPendingInstructors(p => p.filter(x => x.id !== selectedPending.id))
            showToast(`${selectedPending.name} rejected.`)
            setSelectedPending(null)
          }}
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
        <div className="flex gap-1 bg-gray-100 dark:bg-gray-800 rounded-xl p-1 w-full sm:w-fit overflow-x-auto whitespace-nowrap scrollbar-hide">
          {[
            { key: 'all',         label: `All Users (${[...studentsList, ...instructors].filter(u => !u.archived).length})` },
            { key: 'students',    label: `Students (${studentsList.filter(s => !s.archived).length})` },
            { key: 'instructors', label: `Instructors (${instructors.filter(i => !i.archived).length})` },
            { key: 'pending',     label: `Pending (${pendingInstructors.length})` },
            { key: 'archived',    label: `Archived (${[...studentsList, ...instructors].filter(u => u.archived).length})` },
          ].map(t => (
            <button
              key={t.key}
              onClick={() => { setActiveTab(t.key); setPage(1) }}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors shrink-0
                ${activeTab === t.key
                  ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm'
                  : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'}`}
            >
              {t.label}
              {t.key === 'pending' && pendingInstructors.length > 0 && (
                <span className="ml-2 inline-flex items-center justify-center w-5 h-5 rounded-full bg-rose-500 text-white text-[10px] font-bold">
                  {pendingInstructors.length}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* ── ALL USERS & ARCHIVED TABS ── */}
        {(activeTab === 'all' || activeTab === 'archived') && (
          <>
            {/* Controls row */}
            <div className="flex items-center justify-between gap-3">
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
              <div className="flex items-center gap-3">
                <p className="text-xs text-gray-400 dark:text-gray-500 hidden sm:block">{filtered.length} users</p>
                <ViewToggle view={view} setView={setView} />
              </div>
            </div>

            {/* GRID view */}
            {view === 'grid' && (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {displayed.map(user => (
                  <div key={user.id + user.role}
                    onClick={() => { setSelectedUser(user); setSelectedUserType(user.role) }}
                    className="cursor-pointer bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-2xl p-5 flex flex-col gap-3 hover:shadow-sm hover:border-gray-200 dark:hover:border-gray-700 transition-all">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold text-white shrink-0 ${user.role === 'student' ? 'bg-blue-500' : 'bg-indigo-500'}`}>
                          {ini(user.name)}
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-gray-900 dark:text-white leading-tight truncate">{user.name}</p>
                          <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5 truncate">{user.email}</p>
                        </div>
                      </div>
                      <span className={`text-[10px] uppercase tracking-wider font-bold px-2 py-0.5 rounded-full shrink-0 ${user.role === 'student' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300' : 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900 dark:text-indigo-300'}`}>
                        {user.role}
                      </span>
                    </div>
                    <div className="flex items-center justify-between border-t border-gray-50 dark:border-gray-800 pt-3">
                      <p className="text-xs font-mono text-gray-400 dark:text-gray-500">{user.studentId || user.instructorId || '—'}</p>
                      <span className={`text-xs font-medium capitalize ${user.status === 'completed' ? 'text-green-600 dark:text-green-400' : user.status === 'pending' ? 'text-amber-500' : 'text-gray-400'}`}>
                        {user.status || 'Active'}
                      </span>
                    </div>
                  </div>
                ))}
                {displayed.length === 0 && (
                  <div className="col-span-3 py-12 text-center text-sm text-gray-400 dark:text-gray-600">No users found.</div>
                )}
              </div>
            )}

            {/* LIST view */}
            {view === 'list' && (
              <div className="hidden sm:block bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-2xl overflow-hidden shadow-sm">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-900">
                        <th className="text-left px-5 py-3.5 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">User</th>
                        <th className="text-left px-4 py-3.5 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">ID</th>
                        <th className="text-left px-4 py-3.5 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Role</th>
                        <th className="text-left px-4 py-3.5 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Status</th>
                        <th className="px-5 py-3.5" />
                      </tr>
                    </thead>
                    <tbody>
                      {displayed.map((user, i) => (
                        <tr key={user.id + user.role}
                          onClick={() => { setSelectedUser(user); setSelectedUserType(user.role) }}
                          className={`cursor-pointer border-b border-gray-50 dark:border-gray-800 last:border-0 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors ${i % 2 !== 0 ? 'bg-gray-50/30 dark:bg-gray-800/20' : ''}`}>
                          <td className="px-5 py-4">
                            <div className="flex items-center gap-3">
                              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0 ${user.role === 'student' ? 'bg-blue-500' : 'bg-indigo-500'}`}>
                                {ini(user.name)}
                              </div>
                              <div>
                                <p className="text-sm font-semibold text-gray-900 dark:text-white">{user.name}</p>
                                <p className="text-xs text-gray-500 dark:text-gray-400">{user.email}</p>
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-4 font-mono text-xs text-gray-500">{user.studentId || user.instructorId || '—'}</td>
                          <td className="px-4 py-4">
                            <span className={`text-[10px] uppercase tracking-wider font-bold px-2 py-0.5 rounded-full ${user.role === 'student' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300' : 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900 dark:text-indigo-300'}`}>
                              {user.role}
                            </span>
                          </td>
                          <td className="px-4 py-4">
                            <span className={`text-xs capitalize font-medium ${user.status === 'completed' ? 'text-green-600 dark:text-green-500' : user.status === 'pending' ? 'text-amber-500' : 'text-gray-500'}`}>
                              {user.status || 'Active'}
                            </span>
                          </td>
                          <td className="px-5 py-4 text-right">
                            <button onClick={e => { e.stopPropagation(); handleRemoveUser(user) }} className="text-gray-400 hover:text-rose-500 transition-colors">
                              <TrashIcon size={14} />
                            </button>
                          </td>
                        </tr>
                      ))}
                      {displayed.length === 0 && (
                        <tr><td colSpan="5" className="px-5 py-8 text-center text-gray-500 text-sm">No users found.</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Mobile: always show grid cards even if list is selected on desktop */}
            {view === 'list' && (
              <div className="sm:hidden grid grid-cols-1 gap-4">
                {displayed.map(user => (
                  <div key={user.id + user.role}
                    onClick={() => { setSelectedUser(user); setSelectedUserType(user.role) }}
                    className="cursor-pointer bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-2xl p-5 flex flex-col gap-3 hover:shadow-sm transition-all">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold text-white shrink-0 ${user.role === 'student' ? 'bg-blue-500' : 'bg-indigo-500'}`}>
                          {ini(user.name)}
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-gray-900 dark:text-white leading-tight truncate">{user.name}</p>
                          <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5 truncate">{user.email}</p>
                        </div>
                      </div>
                      <span className={`text-[10px] uppercase tracking-wider font-bold px-2 py-0.5 rounded-full shrink-0 ${user.role === 'student' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300' : 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900 dark:text-indigo-300'}`}>
                        {user.role}
                      </span>
                    </div>
                    <div className="flex items-center justify-between border-t border-gray-50 dark:border-gray-800 pt-3">
                      <p className="text-xs font-mono text-gray-400 dark:text-gray-500">{user.studentId || user.instructorId || '—'}</p>
                      <span className={`text-xs font-medium capitalize ${user.status === 'completed' ? 'text-green-600 dark:text-green-400' : user.status === 'pending' ? 'text-amber-500' : 'text-gray-400'}`}>
                        {user.status || 'Active'}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <Pagination total={filtered.length} page={page} onPage={setPage} />
          </>
        )}

        {/* ── INSTRUCTORS TAB ── */}
        {activeTab === 'instructors' && (
          <>
            {/* Controls row */}
            <div className="flex items-center justify-between gap-3">
              <div className="relative flex-1 sm:flex-none">
                <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z"/>
                </svg>
                <input
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="Search instructors…"
                  className="w-full sm:w-52 pl-8 pr-3 py-1.5 text-sm rounded-full bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-gray-600 focus:outline-none focus:ring-2 focus:ring-green-500"
                />
              </div>
              <div className="flex items-center gap-3">
                <p className="text-xs text-gray-400 dark:text-gray-500 hidden sm:block">{activeInstructors.length} instructors</p>
                <ViewToggle view={view} setView={setView} />
              </div>
            </div>

            {/* GRID view */}
            {view === 'grid' && (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {activeInstructors
                  .filter(instr => !search.trim() || instr.name.toLowerCase().includes(search.toLowerCase()) || instr.email.toLowerCase().includes(search.toLowerCase()))
                  .map(instr => {
                    const studentCount = studentsList.filter(s => s.instructor === instr.name).length
                    return (
                      <div key={instr.id}
                        onClick={() => { setSelectedUser(instr); setSelectedUserType('instructor') }}
                        className="cursor-pointer bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-2xl p-5 flex flex-col gap-3 hover:shadow-sm hover:border-gray-200 dark:hover:border-gray-700 transition-all">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="w-10 h-10 rounded-full bg-violet-100 dark:bg-violet-900 flex items-center justify-center text-sm font-bold text-violet-700 dark:text-violet-300 shrink-0">
                              {ini(instr.name)}
                            </div>
                            <div className="min-w-0">
                              <p className="text-sm font-semibold text-gray-900 dark:text-white leading-tight truncate">{instr.name}</p>
                              <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5 truncate">{instr.email}</p>
                            </div>
                          </div>
                          <button
                            onClick={e => { e.stopPropagation(); handleDeleteInstructor(instr) }}
                            className="p-1.5 rounded-lg text-gray-300 dark:text-gray-700 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950 transition-colors shrink-0"
                          >
                            <TrashIcon size={13}/>
                          </button>
                        </div>
                        <div className="space-y-1.5 border-t border-gray-50 dark:border-gray-800 pt-3">
                          <div className="flex items-center justify-between">
                            <p className="text-xs text-gray-400 dark:text-gray-500 truncate">{instr.department}</p>
                            <span className="text-xs font-medium bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 px-2 py-0.5 rounded-full shrink-0 ml-2">{instr.courses}</span>
                          </div>
                          <div className="flex items-center justify-between">
                            <p className="text-xs font-mono text-gray-400 dark:text-gray-500">{instr.instructorId}</p>
                            <p className="text-xs text-gray-500 dark:text-gray-400">{studentCount} student{studentCount !== 1 ? 's' : ''}</p>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                {activeInstructors.length === 0 && (
                  <div className="col-span-3 py-12 text-center text-sm text-gray-400">No instructors found.</div>
                )}
              </div>
            )}

            {/* LIST view */}
            {view === 'list' && (
              <div className="hidden sm:block bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-2xl overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-900">
                        <th className="text-left px-5 py-3.5 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Instructor</th>
                        <th className="text-left px-3 py-3.5 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">ID</th>
                        <th className="text-left px-3 py-3.5 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Email</th>
                        <th className="text-left px-3 py-3.5 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Department</th>
                        <th className="text-left px-3 py-3.5 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Courses</th>
                        <th className="text-left px-3 py-3.5 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Students</th>
                        <th className="px-5 py-3.5" />
                      </tr>
                    </thead>
                    <tbody>
                      {activeInstructors
                        .filter(instr => !search.trim() || instr.name.toLowerCase().includes(search.toLowerCase()) || instr.email.toLowerCase().includes(search.toLowerCase()))
                        .map((instr, i) => {
                          const studentCount = studentsList.filter(s => s.instructor === instr.name).length
                          return (
                            <tr key={instr.id}
                              onClick={() => { setSelectedUser(instr); setSelectedUserType('instructor') }}
                              className={`cursor-pointer border-b border-gray-50 dark:border-gray-800 last:border-0 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors ${i % 2 !== 0 ? 'bg-gray-50/30 dark:bg-gray-800/20' : ''}`}>
                              <td className="px-5 py-4">
                                <div className="flex items-center gap-3">
                                  <div className="w-7 h-7 rounded-full bg-violet-100 dark:bg-violet-900 flex items-center justify-center text-xs font-semibold text-violet-700 dark:text-violet-300 shrink-0">
                                    {ini(instr.name)}
                                  </div>
                                  <p className="text-sm font-medium text-gray-900 dark:text-white">{instr.name}</p>
                                </div>
                              </td>
                              <td className="px-3 py-4 font-mono text-xs text-gray-500 dark:text-gray-400">{instr.instructorId}</td>
                              <td className="px-3 py-4 text-xs text-gray-500 dark:text-gray-400">{instr.email}</td>
                              <td className="px-3 py-4 text-xs text-gray-500 dark:text-gray-400">{instr.department}</td>
                              <td className="px-3 py-4">
                                <span className="text-xs font-medium bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 px-2 py-0.5 rounded-full">{instr.courses}</span>
                              </td>
                              <td className="px-3 py-4 text-xs text-gray-500 dark:text-gray-400">{studentCount} student{studentCount !== 1 ? 's' : ''}</td>
                              <td className="px-5 py-4 text-right">
                                <button
                                  onClick={e => { e.stopPropagation(); handleDeleteInstructor(instr) }}
                                  className="p-1.5 rounded-lg text-gray-300 dark:text-gray-700 hover:text-rose-500 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950 transition-colors"
                                >
                                  <TrashIcon size={13}/>
                                </button>
                              </td>
                            </tr>
                          )
                        })}
                      {activeInstructors.length === 0 && (
                        <tr><td colSpan="7" className="px-5 py-8 text-center text-gray-500 text-sm">No instructors.</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Mobile: always cards */}
            {view === 'list' && (
              <div className="sm:hidden grid grid-cols-1 gap-4">
                {activeInstructors
                  .filter(instr => !search.trim() || instr.name.toLowerCase().includes(search.toLowerCase()))
                  .map(instr => {
                    const studentCount = studentsList.filter(s => s.instructor === instr.name).length
                    return (
                      <div key={instr.id}
                        onClick={() => { setSelectedUser(instr); setSelectedUserType('instructor') }}
                        className="cursor-pointer bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-2xl p-5 flex flex-col gap-3 hover:shadow-sm transition-all">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-violet-100 dark:bg-violet-900 flex items-center justify-center text-sm font-bold text-violet-700 dark:text-violet-300 shrink-0">
                            {ini(instr.name)}
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-semibold text-gray-900 dark:text-white truncate">{instr.name}</p>
                            <p className="text-xs text-gray-400 dark:text-gray-500 truncate">{instr.email}</p>
                          </div>
                        </div>
                        <div className="flex items-center justify-between border-t border-gray-50 dark:border-gray-800 pt-3">
                          <span className="text-xs font-medium bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 px-2 py-0.5 rounded-full">{instr.courses}</span>
                          <p className="text-xs text-gray-500 dark:text-gray-400">{studentCount} student{studentCount !== 1 ? 's' : ''}</p>
                        </div>
                      </div>
                    )
                  })}
              </div>
            )}
          </>
        )}

        {/* ── PENDING APPROVALS TAB ── */}
        {activeTab === 'pending' && (
          <>
            {/* Controls row */}
            <div className="flex items-center justify-between gap-3">
              <div className="p-4 bg-amber-50 dark:bg-amber-900/10 border border-amber-100 dark:border-amber-900/30 rounded-2xl flex items-center gap-3 flex-1">
                <div className="w-8 h-8 rounded-full bg-amber-100 dark:bg-amber-900/50 flex items-center justify-center text-amber-600 dark:text-amber-400 shrink-0"><BellIcon /></div>
                <div>
                  <p className="text-sm font-semibold text-gray-900 dark:text-white">Instructor Registration Requests</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">Tap a request to review details before approving or rejecting.</p>
                </div>
              </div>
              <ViewToggle view={view} setView={setView} />
            </div>

            {/* GRID view */}
            {view === 'grid' && (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {pendingInstructors.map(instr => (
                  <div key={instr.id}
                    onClick={() => setSelectedPending(instr)}
                    className="cursor-pointer bg-white dark:bg-gray-900 border border-amber-100 dark:border-amber-900/30 rounded-2xl p-5 flex flex-col gap-3 hover:shadow-sm hover:border-amber-200 dark:hover:border-amber-800 transition-all">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-10 h-10 rounded-full bg-amber-100 dark:bg-amber-900/50 flex items-center justify-center text-sm font-bold text-amber-700 dark:text-amber-300 shrink-0">
                          {ini(instr.name)}
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-gray-900 dark:text-white leading-tight truncate">{instr.name}</p>
                          <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5 truncate">{instr.email}</p>
                        </div>
                      </div>
                      <span className="text-[10px] uppercase tracking-wider font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-400 shrink-0">Pending</span>
                    </div>
                    <div className="space-y-1 border-t border-amber-50 dark:border-amber-900/20 pt-3">
                      <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{instr.department}</p>
                      <p className="text-xs font-medium text-gray-700 dark:text-gray-300">{instr.courses}</p>
                    </div>
                    <div className="flex gap-2 mt-1">
                      <button onClick={e => { e.stopPropagation(); setPendingInstructors(p => p.filter(x => x.id !== instr.id)); showToast(`${instr.name} rejected.`) }}
                        className="flex-1 py-2 rounded-xl text-xs font-semibold bg-gray-100 hover:bg-rose-100 text-gray-600 hover:text-rose-600 dark:bg-gray-800 dark:hover:bg-rose-900 dark:text-gray-400 dark:hover:text-rose-400 transition-colors">
                        Reject
                      </button>
                      <button onClick={e => { e.stopPropagation(); setPendingInstructors(p => p.filter(x => x.id !== instr.id)); setInstructors(p => [...p, { ...instr, archived: false, status: 'active' }]); showToast(`${instr.name} approved.`) }}
                        className="flex-1 py-2 rounded-xl text-xs font-semibold bg-green-600 hover:bg-green-700 text-white transition-colors">
                        Approve
                      </button>
                    </div>
                  </div>
                ))}
                {pendingInstructors.length === 0 && (
                  <div className="col-span-3 py-12 text-center text-sm text-gray-400 dark:text-gray-600">No pending requests.</div>
                )}
              </div>
            )}

            {/* LIST view */}
            {view === 'list' && (
              <div className="hidden sm:block bg-white dark:bg-gray-900 border border-amber-100 dark:border-amber-900/30 rounded-2xl overflow-hidden shadow-sm">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-amber-100 dark:border-amber-900/30 bg-amber-50/50 dark:bg-amber-900/10">
                      <th className="text-left px-5 py-3.5 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Applicant</th>
                      <th className="text-left px-4 py-3.5 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Department</th>
                      <th className="text-left px-4 py-3.5 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Courses</th>
                      <th className="px-5 py-3.5 text-right text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pendingInstructors.map((instr) => (
                      <tr key={instr.id}
                        onClick={() => setSelectedPending(instr)}
                        className="cursor-pointer border-b border-gray-100 dark:border-gray-800 last:border-0 hover:bg-amber-50/40 dark:hover:bg-amber-900/10 transition-colors">
                        <td className="px-5 py-4">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-amber-100 dark:bg-amber-900/50 flex items-center justify-center text-xs font-bold text-amber-700 dark:text-amber-300 shrink-0">
                              {ini(instr.name)}
                            </div>
                            <div>
                              <p className="text-sm font-semibold text-gray-900 dark:text-white">{instr.name}</p>
                              <p className="text-xs text-gray-500 dark:text-gray-400">{instr.email}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-4 text-xs text-gray-500 dark:text-gray-400">{instr.department}</td>
                        <td className="px-4 py-4">
                          <span className="text-xs font-medium bg-amber-100 dark:bg-amber-900/50 text-amber-700 dark:text-amber-300 px-2 py-0.5 rounded-full">{instr.courses}</span>
                        </td>
                        <td className="px-5 py-4 text-right">
                          <div className="flex justify-end gap-2">
                            <button onClick={e => { e.stopPropagation(); setPendingInstructors(p => p.filter(x => x.id !== instr.id)); showToast(`${instr.name} rejected.`) }}
                              className="px-3 py-1.5 bg-gray-100 hover:bg-rose-100 text-gray-700 hover:text-rose-600 rounded-lg text-xs font-semibold transition-colors">Reject</button>
                            <button onClick={e => { e.stopPropagation(); setPendingInstructors(p => p.filter(x => x.id !== instr.id)); setInstructors(p => [...p, { ...instr, archived: false, status: 'active' }]); showToast(`${instr.name} approved.`) }}
                              className="px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white rounded-lg text-xs font-semibold transition-colors">Approve</button>
                          </div>
                        </td>
                      </tr>
                    ))}
                    {pendingInstructors.length === 0 && (
                      <tr><td colSpan="4" className="px-5 py-8 text-center text-gray-500 text-sm">No pending requests.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}

            {/* Mobile: always cards */}
            {view === 'list' && (
              <div className="sm:hidden grid grid-cols-1 gap-4">
                {pendingInstructors.map(instr => (
                  <div key={instr.id}
                    onClick={() => setSelectedPending(instr)}
                    className="cursor-pointer bg-white dark:bg-gray-900 border border-amber-100 dark:border-amber-900/30 rounded-2xl p-5 flex flex-col gap-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-amber-100 dark:bg-amber-900/50 flex items-center justify-center text-sm font-bold text-amber-700 dark:text-amber-300 shrink-0">
                        {ini(instr.name)}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-gray-900 dark:text-white truncate">{instr.name}</p>
                        <p className="text-xs text-gray-400 dark:text-gray-500 truncate">{instr.email}</p>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button onClick={e => { e.stopPropagation(); setPendingInstructors(p => p.filter(x => x.id !== instr.id)); showToast(`${instr.name} rejected.`) }}
                        className="flex-1 py-2 rounded-xl text-xs font-semibold bg-gray-100 text-gray-700 transition-colors">Reject</button>
                      <button onClick={e => { e.stopPropagation(); setPendingInstructors(p => p.filter(x => x.id !== instr.id)); setInstructors(p => [...p, { ...instr, archived: false, status: 'active' }]); showToast(`${instr.name} approved.`) }}
                        className="flex-1 py-2 rounded-xl text-xs font-semibold bg-green-600 text-white transition-colors">Approve</button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {/* ── STUDENTS TAB ── */}
        {activeTab === 'students' && (<>

          {/* Counts */}
          <p className="text-sm text-gray-500 dark:text-gray-400 -mt-3">
            {studentsList.length} total ·{' '}
            <span className="text-green-600 dark:text-green-400 font-medium">{completedCount} completed</span>{' '}·{' '}
            <span className="text-amber-600 dark:text-amber-400 font-medium">{pendingCount} pending</span>
          </p>

          {/* ── Controls row ── */}
          <div className="flex flex-col sm:flex-row sm:items-center gap-3 justify-between flex-wrap">
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
                className="text-xs px-3 py-1.5 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 border-none focus:outline-none focus:ring-2 focus:ring-green-500 cursor-pointer max-w-48 truncate"
              >
                <option value="all">All Instructors</option>
                {INSTRUCTORS_LIST.map(i => <option key={i} value={i}>{i}</option>)}
              </select>
            </div>

            {/* Right: count + grid/list toggle */}
            <div className="flex items-center gap-3 shrink-0">
              <p className="text-xs text-gray-400 dark:text-gray-500">{filtered.length} students</p>
              <ViewToggle view={view} setView={setView} />
            </div>
          </div>

          {/* Empty state */}
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

          {/* ── LIST / TABLE VIEW — desktop only ── */}
          {filtered.length > 0 && view === 'list' && (
            <div className="hidden sm:block bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-2xl overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/50">
                      <th onClick={() => toggleSort('name')} className="text-left px-5 py-3.5 text-xs font-semibold text-gray-500 dark:text-gray-400 cursor-pointer hover:text-gray-900 dark:hover:text-white transition-colors select-none">
                        Student <SortIcon col="name" />
                      </th>
                      <th onClick={() => toggleSort('course')} className="text-left px-3 py-3.5 text-xs font-semibold text-gray-500 dark:text-gray-400 cursor-pointer hover:text-gray-900 dark:hover:text-white transition-colors select-none">
                        Course <SortIcon col="course" />
                      </th>
                      <th className="text-left px-3 py-3.5 text-xs font-semibold text-gray-500 dark:text-gray-400">Instructor</th>
                      <th className="text-left px-3 py-3.5 text-xs font-semibold text-gray-500 dark:text-gray-400">Status</th>
                      <th className="text-left px-3 py-3.5 text-xs font-semibold text-gray-500 dark:text-gray-400">Top Recommendation</th>
                      <th onClick={() => toggleSort('match')} className="text-center px-5 py-3.5 text-xs font-semibold text-gray-500 dark:text-gray-400 cursor-pointer hover:text-gray-900 dark:hover:text-white transition-colors select-none">
                        Match <SortIcon col="match" />
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {displayed.map((s, i) => (
                      <tr
                        key={s.id}
                        onClick={() => { setSelectedUser(s); setSelectedUserType('student') }}
                        className={`cursor-pointer border-b border-gray-50 dark:border-gray-800 last:border-0 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors ${i % 2 !== 0 ? 'bg-gray-50/30 dark:bg-gray-800/20' : ''}`}
                      >
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
                        <td className="px-3 py-4">
                          <span className="text-xs font-medium bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 px-2 py-0.5 rounded-full">{s.course}</span>
                        </td>
                        <td className="px-3 py-4 text-xs text-gray-500 dark:text-gray-400 max-w-40 truncate">{s.instructor}</td>
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