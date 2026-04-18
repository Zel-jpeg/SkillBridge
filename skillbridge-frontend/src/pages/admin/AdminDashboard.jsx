// src/pages/admin/AdminDashboard.jsx
// Wired to real API (Week 4):
//   GET /api/admin/stats/                    → summary numbers
//   GET /api/admin/students/recommendations/ → student list + top match

import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import Pagination  from '../../components/Pagination'
import StatusBadge from '../../components/StatusBadge'
import PageHeader  from '../../components/PageHeader'
import SearchBar   from '../../components/SearchBar'
import EmptyState  from '../../components/EmptyState'
import { useApi }  from '../../hooks/useApi'

const PAGE_SIZE = 10

// ── Icons ─────────────────────────────────────────────────────────
const MenuIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
    <path d="M3 12h18M3 6h18M3 18h18"/>
  </svg>
)
const XIcon = ({ size = 14 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
    <path d="M18 6L6 18M6 6l12 12"/>
  </svg>
)
const BellIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path>
    <path d="M13.73 21a2 2 0 0 1-3.46 0"></path>
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
const IconStudents = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/>
    <path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
  </svg>
)
const IconCompany = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
    <polyline points="9 22 9 12 15 12 15 22"/>
  </svg>
)
const IconPositions = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2"/>
    <line x1="12" y1="12" x2="12" y2="16"/><line x1="10" y1="14" x2="14" y2="14"/>
  </svg>
)
const IconCheck = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="20 6 9 17 4 12"/>
  </svg>
)
const IconTrophy = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"/><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"/>
    <path d="M4 22h16"/>
    <path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22"/>
    <path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22"/>
    <path d="M18 2H6v7a6 6 0 0 0 12 0V2z"/>
  </svg>
)

// ── Helpers ───────────────────────────────────────────────────────
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

// Pagination is now imported from src/components/Pagination.jsx

// ── Admin Nav ─────────────────────────────────────────────────────
function AdminNav({ admin }) {
  const navigate = useNavigate()
  const [open,   setOpen]   = useState(false)
  const [notifOpen, setNotifOpen] = useState(false)
  const [mobile, setMobile] = useState(false)
  const [dark,   setDark]   = useState(() => localStorage.getItem('sb-theme') === 'dark')

  function toggleDark() {
    const next = !dark
    setDark(next)
    document.documentElement.classList.toggle('dark', next)
    localStorage.setItem('sb-theme', next ? 'dark' : 'light')
  }

  function go(path) {
    navigate(path)
    setMobile(false) // always close mobile menu on navigation
    setOpen(false)
  }

  const links = [
    { label: 'Dashboard', path: '/admin/dashboard', active: true },
    { label: 'Companies', path: '/admin/companies' },
    { label: 'Users',     path: '/admin/users'     },
  ]

  return (
    // Wrap in a div so the sticky mobile dropdown stays attached below the nav
    <div className="sticky top-0 z-30">
      <nav className="bg-white dark:bg-gray-900 border-b border-gray-100 dark:border-gray-800 px-4 sm:px-6 h-14 flex items-center justify-between">

        {/* Logo */}
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 bg-green-600 rounded-lg flex items-center justify-center shrink-0">
            <svg width="16" height="16" viewBox="0 0 26 26" fill="none">
              <path d="M3 18 Q3 10 13 10 Q23 10 23 18" stroke="white" strokeWidth="2.2" strokeLinecap="round"/>
              <path d="M7 18 L7 14M13 18 L13 12M19 18 L19 14" stroke="white" strokeWidth="2.2" strokeLinecap="round"/>
              <circle cx="7" cy="8" r="2.5" fill="white" opacity="0.85"/>
              <circle cx="19" cy="8" r="2.5" fill="white" opacity="0.85"/>
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
              className={`px-3 py-1.5 rounded-lg text-sm transition-colors
                ${l.active
                  ? 'bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-white font-medium'
                  : 'text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-50 dark:hover:bg-gray-800'}`}>
              {l.label}
            </button>
          ))}
        </div>

        {/* Right side */}
        <div className="flex items-center gap-2">
          
          <div className="relative hidden sm:block">
            <button onClick={() => { setNotifOpen(p => !p); setOpen(false) }} className="relative p-1.5 rounded-full text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors delay-100">
              <BellIcon />
              <span className="absolute top-1 right-1.5 w-2 h-2 bg-rose-500 rounded-full border-2 border-white dark:border-gray-900 pointer-events-none"></span>
            </button>
            {notifOpen && (
              <div className="absolute right-0 mt-2 w-72 bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-2xl shadow-xl overflow-hidden z-20">
                <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-800 flex justify-between items-center">
                  <p className="text-sm font-bold text-gray-900 dark:text-white">Notifications</p>
                  <span className="text-[10px] uppercase font-bold text-gray-400">3 New</span>
                </div>
                <div className="max-h-64 overflow-y-auto">
                  <div onClick={() => { navigate('/admin/users?tab=pending'); setNotifOpen(false) }} className="px-4 py-3 border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/50 cursor-pointer flex gap-3 transition-colors bg-blue-50/30 dark:bg-blue-900/10">
                    <div className="mt-0.5 w-2 h-2 bg-blue-500 rounded-full shrink-0"></div>
                    <div>
                      <p className="text-sm font-semibold text-gray-900 dark:text-white leading-snug">New Instructor Request</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Alice Walker has requested instructor access.</p>
                      <p className="text-[10px] text-gray-400 mt-1">2 mins ago</p>
                    </div>
                  </div>
                  <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/50 cursor-pointer flex gap-3 transition-colors">
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
<button onClick={() => { navigate('/admin/notifications'); setNotifOpen(false) }} className="text-xs font-semibold text-blue-600 hover:text-blue-700 dark:text-blue-400">View All activity</button>
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
                <button onClick={() => {
                  localStorage.removeItem('sb-token')
                  localStorage.removeItem('sb-refresh')
                  localStorage.removeItem('sb-role')
                  localStorage.removeItem('sb-user')
                  go('/login')
                }}
                  className="w-full text-left px-4 py-3 text-sm text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950 transition-colors">
                  Sign out
                </button>
              </div>
            )}
          </div>
        </div>
      </nav>

      {/* Mobile slide-down menu — sits directly under nav, same sticky wrapper */}
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
    </div>
  )
}

// ── Main Component ────────────────────────────────────────────────
export default function AdminDashboard() {
  const navigate = useNavigate()

  // ── Load real data ────────────────────────────────────────────────
  const { data: statsData }    = useApi('/api/admin/stats/')
  const { data: studentsData } = useApi('/api/admin/students/recommendations/')

  // Read cached admin info for NavBar
  const cachedUser = (() => { try { return JSON.parse(localStorage.getItem('sb-user')) } catch { return null } })()
  const admin = {
    name:     cachedUser?.name || 'Administrator',
    initials: (cachedUser?.name || 'AD').split(' ').map(n => n[0]).slice(0, 2).join(''),
  }

  // Build stat cards from live data
  const STATS = [
    { label: 'Total Students',       Icon: IconStudents,  color: 'bg-blue-50   dark:bg-blue-950   text-blue-700   dark:text-blue-300   border-blue-100   dark:border-blue-900',   value: statsData?.total_students       ?? '—' },
    { label: 'Companies Listed',     Icon: IconCompany,   color: 'bg-violet-50 dark:bg-violet-950 text-violet-700 dark:text-violet-300 border-violet-100 dark:border-violet-900', value: statsData?.total_companies       ?? '—' },
    { label: 'Open Positions',       Icon: IconPositions, color: 'bg-amber-50  dark:bg-amber-950  text-amber-700  dark:text-amber-300  border-amber-100  dark:border-amber-900',  value: statsData?.open_positions         ?? '—' },
    { label: 'Recommendations Made', Icon: IconCheck,     color: 'bg-green-50  dark:bg-green-950  text-green-700  dark:text-green-300  border-green-100  dark:border-green-900',  value: statsData?.recommendations_made   ?? '—' },
  ]

  // Normalize student list from API
  const STUDENTS = useMemo(() => {
    if (!studentsData || !Array.isArray(studentsData)) return []
    return studentsData.map(s => ({
      id:         s.id,
      name:       s.student_name || s.name,
      studentId:  s.school_id    || s.student_id || '',
      email:      s.email        || '',
      course:     s.course       || '',
      instructor: s.instructor_name || s.instructor || '',
      status:     s.has_submitted ? 'completed' : 'pending',
      match:      s.top_match_score   ?? null,
      position:   s.top_position_name ?? null,
      company:    s.top_company_name  ?? null,
    }))
  }, [studentsData])

  // Top 4 matches derived from student list
  const TOP_MATCHES = useMemo(() =>
    [...STUDENTS]
      .filter(s => s.match !== null)
      .sort((a, b) => (b.match ?? 0) - (a.match ?? 0))
      .slice(0, 4)
      .map(s => ({ student: s.name, studentId: s.studentId, course: s.course, company: s.company, position: s.position, match: s.match }))
  , [STUDENTS])

  const [search,       setSearch]  = useState('')
  const [filterStatus, setFilter]  = useState('all')
  const [page,         setPage]    = useState(1)
  const [view,         setView]    = useState('grid') // 'grid' | 'list'

  const filtered = useMemo(() => {
    let list = STUDENTS
    if (filterStatus !== 'all') list = list.filter(s => s.status === filterStatus)
    if (search.trim()) {
      const q = search.toLowerCase()
      list = list.filter(s =>
        s.name.toLowerCase().includes(q) ||
        s.studentId.toLowerCase().includes(q) ||
        s.course.toLowerCase().includes(q) ||
        s.instructor.toLowerCase().includes(q) ||
        (s.company ?? '').toLowerCase().includes(q)
      )
    }
    return list
  }, [search, filterStatus])

  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      <AdminNav admin={ADMIN} />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-6 sm:space-y-8">

        {/* Page title */}
        <PageHeader
          title="Admin Dashboard"
          subtitle="System-wide overview of students, companies, and recommendations."
          action={
            <>
              <button onClick={() => navigate('/admin/companies')}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 active:bg-gray-200 transition-colors">
                <IconCompany />
                Manage Companies
              </button>
              <button onClick={() => navigate('/admin/users')}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium bg-green-600 hover:bg-green-700 active:bg-green-800 text-white transition-colors">
                <IconStudents />
                Manage Users
              </button>
            </>
          }
        />

        {/* Stat cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          {STATS.map(s => (
            <div key={s.label} className={`border rounded-2xl p-4 sm:p-5 flex flex-col gap-2 ${s.color}`}>
              <div className="opacity-70"><s.Icon /></div>
              <p className="text-2xl sm:text-3xl font-bold">{s.value}</p>
              <p className="text-xs font-medium opacity-80">{s.label}</p>
            </div>
          ))}
        </div>

        {/* Top matches */}
        <div>
          <h2 className="flex items-center gap-1.5 text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
            <IconTrophy /> Top Matches This Cycle
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {TOP_MATCHES.map((m, i) => (
              <div key={i} className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-2xl p-4 flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <div className="w-8 h-8 rounded-full bg-green-100 dark:bg-green-900 flex items-center justify-center text-xs font-semibold text-green-700 dark:text-green-300">
                    {ini(m.student)}
                  </div>
                  <span className={`text-lg font-bold ${matchColor(m.match)}`}>{m.match}%</span>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-900 dark:text-white leading-tight">{m.student}</p>
                  <p className="text-xs text-gray-400 dark:text-gray-500">{m.studentId} · {m.course}</p>
                </div>
                <div className="pt-1 border-t border-gray-50 dark:border-gray-800">
                  <p className="text-xs font-medium text-gray-700 dark:text-gray-300 truncate">{m.position}</p>
                  <p className="text-xs text-gray-400 dark:text-gray-500 truncate">{m.company}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ── All Students ─────────────────────────────────────────── */}
        <div className="space-y-3">

          {/* Controls row */}
          <div className="flex flex-col sm:flex-row sm:items-center gap-3 justify-between flex-wrap">
            <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300">All Students</h2>

            <div className="flex items-center gap-2 flex-wrap flex-1 sm:justify-end">
              {/* Search */}
              <SearchBar
                value={search}
                onChange={v => { setSearch(v); setPage(1) }}
                placeholder="Search students…"
                className="flex-1 sm:w-44 sm:flex-none"
              />

              {/* Status filter pills */}
              <div className="flex items-center gap-1">
                {[{ value: 'all', label: 'All' }, { value: 'completed', label: 'Done' }, { value: 'pending', label: 'Pending' }].map(f => (
                  <button key={f.value} onClick={() => { setFilter(f.value); setPage(1) }}
                    className={`text-xs px-3 py-1.5 rounded-full font-medium transition-colors
                      ${filterStatus === f.value
                        ? 'bg-gray-900 dark:bg-white text-white dark:text-gray-900'
                        : 'bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'}`}>
                    {f.label}
                  </button>
                ))}
              </div>

              {/* Grid / List toggle — hidden on mobile (grid-only) */}
              <div className="hidden sm:flex items-center gap-1 bg-gray-100 dark:bg-gray-800 rounded-xl p-1">
                {[{ val: 'grid', Icon: GridIcon }, { val: 'list', Icon: ListIcon }].map(v => (
                  <button key={v.val} onClick={() => setView(v.val)}
                    className={`p-1.5 rounded-lg transition-colors
                      ${view === v.val
                        ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm'
                        : 'text-gray-400 dark:text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'}`}>
                    <v.Icon />
                  </button>
                ))}
              </div>
            </div>

            <p className="text-xs text-gray-400 dark:text-gray-500 shrink-0">{filtered.length} students</p>
          </div>

          {/* Empty state */}
          {filtered.length === 0 && (
            <EmptyState
              message="No students match your search."
              onClear={() => { setSearch(''); setFilter('all') }}
            />
          )}

          {/* ── GRID VIEW (always on mobile, toggle on desktop) ─── */}
          {filtered.length > 0 && (
            <div className={`${view === 'grid' ? 'grid' : 'grid sm:hidden'} grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4`}>
              {paginated.map(s => (
                <div key={s.id} className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-2xl p-5 flex flex-col gap-3 hover:shadow-sm transition-shadow">
                  {/* Top row */}
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
                    <StatusBadge status={s.status} />
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

          {/* ── LIST VIEW (desktop only) ─────────────────────────── */}
          {filtered.length > 0 && view === 'list' && (
            <div className="hidden sm:block bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-2xl overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm min-w-640px">
                  <thead>
                    <tr className="border-b border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/50">
                      <th className="text-left px-5 py-3.5 text-xs font-semibold text-gray-500 dark:text-gray-400">Student</th>
                      <th className="text-left px-3 py-3.5 text-xs font-semibold text-gray-500 dark:text-gray-400">Instructor</th>
                      <th className="text-left px-3 py-3.5 text-xs font-semibold text-gray-500 dark:text-gray-400">Status</th>
                      <th className="text-left px-3 py-3.5 text-xs font-semibold text-gray-500 dark:text-gray-400">Top Recommendation</th>
                      <th className="text-center px-5 py-3.5 text-xs font-semibold text-gray-500 dark:text-gray-400">Match</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginated.map((s, i) => (
                      <tr key={s.id}
                        className={`border-b border-gray-50 dark:border-gray-800 last:border-0 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors ${i % 2 === 0 ? '' : 'bg-gray-50/30 dark:bg-gray-800/20'}`}>
                        <td className="px-5 py-4">
                          <div className="flex items-center gap-3">
                            <div className="w-7 h-7 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center text-xs font-semibold text-blue-700 dark:text-blue-300 shrink-0">
                              {ini(s.name)}
                            </div>
                            <div>
                              <p className="text-sm font-medium text-gray-900 dark:text-white leading-tight">{s.name}</p>
                              <p className="text-xs text-gray-400 dark:text-gray-500">{s.studentId} · {s.course}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-3 py-4 text-xs text-gray-500 dark:text-gray-400">{s.instructor}</td>
                        <td className="px-3 py-4">
                          <StatusBadge status={s.status} size="md" />
                        </td>
                        <td className="px-3 py-4">
                          {s.position
                            ? <div>
                                <p className="text-xs font-medium text-gray-700 dark:text-gray-300">{s.position}</p>
                                <p className="text-xs text-gray-400 dark:text-gray-500">{s.company}</p>
                              </div>
                            : <span className="text-xs text-gray-300 dark:text-gray-700">—</span>
                          }
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

          {/* Pagination */}
          <Pagination total={filtered.length} page={page} onPage={setPage} pageSize={PAGE_SIZE} />

        </div>

        {/* Match legend */}
        <div className="flex flex-wrap items-center gap-3 px-1 pb-4">
          <p className="text-xs text-gray-400 dark:text-gray-600">Match key:</p>
          {[
            { label: '≥ 80% Strong',    cls: 'bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300' },
            { label: '60–79% Fair',     cls: 'bg-amber-100 dark:bg-amber-900 text-amber-700 dark:text-amber-300' },
            { label: '< 60% Low match', cls: 'bg-rose-100  dark:bg-rose-900  text-rose-700  dark:text-rose-300'  },
          ].map(l => (
            <span key={l.label} className={`text-xs font-medium px-2.5 py-1 rounded-full ${l.cls}`}>{l.label}</span>
          ))}
        </div>

      </main>
    </div>
  )
}