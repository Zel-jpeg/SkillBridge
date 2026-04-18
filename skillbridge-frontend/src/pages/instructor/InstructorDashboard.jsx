// src/pages/instructor/InstructorDashboard.jsx
// Wired to real API (Week 4):
//   GET /api/instructor/students/recommendations/ → students + scores + top recommendation

import { useState, useMemo, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import Pagination  from '../../components/Pagination'
import StatusBadge from '../../components/StatusBadge'
import SearchBar   from '../../components/SearchBar'
import EmptyState  from '../../components/EmptyState'
import { useApi }  from '../../hooks/useApi'

const INSTRUCTOR = {
  name:     'Instructor',
  initials: 'IN',
  subject:  'OJT Coordinator',
}

const CATEGORIES = ['Web Development', 'Database', 'Design', 'Networking', 'Backend']

const PAGE_SIZE = 6

// ── Helpers ──────────────────────────────────────────────────────

function average(scores) {
  const vals = Object.values(scores)
  if (!vals.length) return null
  return Math.round(vals.reduce((a, b) => a + b, 0) / vals.length)
}

function scoreColor(pct) {
  if (pct === null) return 'text-gray-300 dark:text-gray-700'
  if (pct >= 80) return 'text-green-600 dark:text-green-400'
  if (pct >= 60) return 'text-amber-600 dark:text-amber-400'
  return 'text-rose-500 dark:text-rose-400'
}

function scoreBg(pct) {
  if (pct === null) return ''
  if (pct >= 80) return 'bg-green-50 dark:bg-green-950'
  if (pct >= 60) return 'bg-amber-50 dark:bg-amber-950'
  return 'bg-rose-50 dark:bg-rose-950'
}

function scoreBgBar(pct) {
  if (pct >= 80) return 'bg-green-600'
  if (pct >= 60) return 'bg-amber-500'
  return 'bg-rose-500'
}

function ini(name) {
  return name.split(' ').map(n => n[0]).slice(0, 2).join('')
}
function topSkill(scores) {
  const e = Object.entries(scores); if (!e.length) return null
  return e.reduce((a, b) => b[1] > a[1] ? b : a)
}
function bottomSkill(scores) {
  const e = Object.entries(scores); if (!e.length) return null
  return e.reduce((a, b) => b[1] < a[1] ? b : a)
}
function tierLabel(p) {
  if (p >= 80) return { text: 'Strong',     cls: 'text-green-700 dark:text-green-300 bg-green-100 dark:bg-green-900' }
  if (p >= 60) return { text: 'Fair',       cls: 'text-amber-700 dark:text-amber-300 bg-amber-100 dark:bg-amber-900' }
  return         { text: 'Needs Work', cls: 'text-rose-700 dark:text-rose-300 bg-rose-100 dark:bg-rose-900' }
}
const SUGGESTIONS = {
  'Web Development': 'Review HTML, CSS, and JavaScript fundamentals. Practice building simple responsive layouts.',
  'Database':        'Reinforce SQL query writing — focus on JOINs, GROUP BY, and subqueries. Try SQLZoo or W3Schools SQL.',
  'Design':          'Study UI/UX design principles: color theory, typography, spacing, and component hierarchy.',
  'Networking':      'Review the OSI model, IP addressing, subnetting, and common network protocols (TCP/IP, DNS, HTTP).',
  'Backend':         'Strengthen server-side programming concepts: REST APIs, request/response cycles, and authentication.',
}
function getSuggestion(cat) {
  return SUGGESTIONS[cat] || `Focus on strengthening ${cat} skills through practice exercises and review materials.`
}

const CAT_COLORS = {
  'Web Development': { pill: 'bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300',     bar: 'bg-blue-500'   },
  'Database':        { pill: 'bg-violet-100 dark:bg-violet-900 text-violet-700 dark:text-violet-300', bar: 'bg-violet-500' },
  'Design':          { pill: 'bg-pink-100 dark:bg-pink-900 text-pink-700 dark:text-pink-300',      bar: 'bg-pink-500'   },
  'Networking':      { pill: 'bg-amber-100 dark:bg-amber-900 text-amber-700 dark:text-amber-300',  bar: 'bg-amber-500'  },
  'Backend':         { pill: 'bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300',  bar: 'bg-green-500'  },
}

// ── Shared icons ─────────────────────────────────────────────────

const MenuIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
    <path d="M3 12h18M3 6h18M3 18h18"/>
  </svg>
)

const XIcon = ({ size = 20 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
    <path d="M18 6L6 18M6 6l12 12"/>
  </svg>
)

const GridIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
    <rect x="3" y="3" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="2"/>
    <rect x="14" y="3" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="2"/>
    <rect x="3" y="14" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="2"/>
    <rect x="14" y="14" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="2"/>
  </svg>
)

const ListIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
    <path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
  </svg>
)

// ── Score status icons ─────────────────────────────────────────
const CheckCircleIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10"/><path d="M8 12l3 3 5-5"/>
  </svg>
)
const WarnIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#d97706" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
  </svg>
)
const CrossCircleIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#e11d48" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10"/><path d="M15 9l-6 6M9 9l6 6"/>
  </svg>
)
const StarIcon = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
  </svg>
)
const AlertTriangleIcon = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#e11d48" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
  </svg>
)
const LightbulbIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M9 18h6M10 22h4M12 2a7 7 0 0 1 4 12.74V17a1 1 0 0 1-1 1H9a1 1 0 0 1-1-1v-2.26A7 7 0 0 1 12 2z"/>
  </svg>
)
const SparkleIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 3v3M12 18v3M4.22 4.22l2.12 2.12M17.66 17.66l2.12 2.12M3 12h3M18 12h3M4.22 19.78l2.12-2.12M17.66 6.34l2.12-2.12"/>
  </svg>
)
const ClockIcon = () => (
  <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>
  </svg>
)

// ── Student Detail Modal ──────────────────────────────────────
function StudentModal({ student, onClose }) {
  const overall = average(student.scores)
  const top     = topSkill(student.scores)
  const bottom  = bottomSkill(student.scores)
  const gaps    = Object.entries(student.scores).filter(([, v]) => v < 60)
  const tier    = overall !== null ? tierLabel(overall) : null

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm px-0 sm:px-4"
      onClick={e => e.target === e.currentTarget && onClose()}
    >
      <div
        className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-t-3xl sm:rounded-2xl shadow-2xl w-full sm:max-w-2xl flex flex-col max-h-[92vh] overflow-hidden"
        style={{ animation: 'modalIn 0.26s cubic-bezier(0.34,1.1,0.64,1) both' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-gray-800 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-linear-to-br from-green-400 to-emerald-600 flex items-center justify-center text-white text-sm font-bold shrink-0 shadow">
              {ini(student.name)}
            </div>
            <div>
              <h2 className="text-sm font-bold text-gray-900 dark:text-white leading-tight">{student.name}</h2>
              <p className="text-xs text-gray-400 dark:text-gray-500 font-mono">{student.studentId} · {student.course}</p>
            </div>
          </div>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-xl text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
            <XIcon size={16} />
          </button>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto">
          <div className="px-6 py-4 border-b border-gray-50 dark:border-gray-800 flex flex-wrap items-center gap-2">
            <p className="text-xs text-gray-400 dark:text-gray-500 truncate flex-1">{student.email}</p>
            <div className="flex items-center gap-2 shrink-0">
              <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300">{student.course}</span>
              {student.status === 'completed'
                ? <span className="inline-flex items-center gap-1 text-xs font-medium text-green-700 dark:text-green-300 bg-green-100 dark:bg-green-900 px-2.5 py-0.5 rounded-full"><span className="w-1.5 h-1.5 rounded-full bg-green-500"/>Assessment Done</span>
                : <span className="inline-flex items-center gap-1 text-xs font-medium text-amber-700 dark:text-amber-300 bg-amber-100 dark:bg-amber-900 px-2.5 py-0.5 rounded-full"><span className="w-1.5 h-1.5 rounded-full bg-amber-500"/>Pending</span>
              }
            </div>
          </div>

          {student.status === 'completed' ? (
            <div className="p-6 flex flex-col gap-6">
              <div className="grid grid-cols-1 sm:grid-cols-5 gap-4">
                <div className="sm:col-span-2 bg-gray-50 dark:bg-gray-800 rounded-2xl p-5 flex flex-col justify-between">
                  <div className="flex items-center justify-between mb-4">
                    <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Overall</p>
                    {tier && <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${tier.cls}`}>{tier.text}</span>}
                  </div>
                  <div>
                    <div className="flex items-end gap-1 mb-3">
                      <span className={`text-6xl font-black leading-none ${scoreColor(overall)}`}>{overall}</span>
                      <span className="text-2xl font-bold text-gray-300 dark:text-gray-600 mb-1">%</span>
                    </div>
                    <div className="h-2.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                      <div className={`h-full rounded-full ${scoreBgBar(overall)}`} style={{ width: `${overall}%` }} />
                    </div>
                  </div>
                </div>
                <div className="sm:col-span-3 flex flex-col gap-2.5">
                  <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Skill Breakdown</p>
                  {CATEGORIES.map(cat => {
                    const sc = student.scores[cat] ?? null
                    const StatusIcon = sc >= 80 ? CheckCircleIcon : sc >= 60 ? WarnIcon : CrossCircleIcon
                    return (
                      <div key={cat} className={`px-3 py-2.5 rounded-xl border ${
                        sc < 60  ? 'border-rose-200 dark:border-rose-900 bg-rose-50 dark:bg-rose-950/30'
                        : sc < 80 ? 'border-amber-100 dark:border-amber-900 bg-amber-50/50 dark:bg-amber-950/20'
                        : 'border-green-100 dark:border-green-900 bg-green-50/50 dark:bg-green-950/20'
                      }`}>
                        <div className="flex items-center gap-2 mb-1.5">
                          <StatusIcon />
                          <span className="text-xs font-medium text-gray-700 dark:text-gray-300 flex-1">{cat}</span>
                          {sc < 60 && <span className="text-xs font-semibold text-rose-600 dark:text-rose-400 bg-rose-100 dark:bg-rose-900 px-2 py-0.5 rounded-full">Needs improvement</span>}
                          <span className={`text-xs font-bold ${scoreColor(sc)}`}>{sc}%</span>
                        </div>
                        <div className="h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                          <div className={`h-full rounded-full ${scoreBgBar(sc)}`} style={{ width: `${sc}%` }} />
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                {top && (
                  <div className="bg-green-50 dark:bg-green-950/40 border border-green-100 dark:border-green-900 rounded-xl p-4">
                    <div className="flex items-center gap-1.5 mb-2"><StarIcon /><p className="text-xs font-semibold text-green-700 dark:text-green-400">Strongest skill</p></div>
                    <p className="text-sm font-bold text-gray-900 dark:text-white">{top[0]}</p>
                    <p className={`text-xl font-black mt-0.5 ${scoreColor(top[1])}`}>{top[1]}%</p>
                  </div>
                )}
                {bottom && (
                  <div className="bg-rose-50 dark:bg-rose-950/40 border border-rose-100 dark:border-rose-900 rounded-xl p-4">
                    <div className="flex items-center gap-1.5 mb-2"><AlertTriangleIcon /><p className="text-xs font-semibold text-rose-700 dark:text-rose-400">Weakest skill</p></div>
                    <p className="text-sm font-bold text-gray-900 dark:text-white">{bottom[0]}</p>
                    <p className={`text-xl font-black mt-0.5 ${scoreColor(bottom[1])}`}>{bottom[1]}%</p>
                  </div>
                )}
              </div>

              {gaps.length > 0 ? (
                <div>
                  <div className="flex items-center gap-2 mb-3"><LightbulbIcon /><p className="text-xs font-semibold text-amber-700 dark:text-amber-400 uppercase tracking-wider">Instructor Suggestions</p></div>
                  <div className="flex flex-col gap-2">
                    {gaps.map(([cat, sc]) => (
                      <div key={cat} className="bg-amber-50 dark:bg-amber-950/30 border border-amber-100 dark:border-amber-900 rounded-xl px-4 py-3">
                        <p className="text-xs font-bold text-amber-800 dark:text-amber-300 mb-1">{cat} <span className="font-normal text-amber-600 dark:text-amber-500">({sc}%)</span></p>
                        <p className="text-xs text-gray-600 dark:text-gray-400 leading-relaxed">{getSuggestion(cat)}</p>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="bg-green-50 dark:bg-green-950/40 border border-green-100 dark:border-green-900 rounded-2xl px-5 py-4 flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-green-100 dark:bg-green-900 flex items-center justify-center shrink-0"><SparkleIcon /></div>
                  <div>
                    <p className="text-sm font-bold text-green-800 dark:text-green-300">No weak areas!</p>
                    <p className="text-xs text-green-700 dark:text-green-400 mt-0.5">This student passed all categories above 60%. Great performance overall.</p>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="flex flex-col items-center gap-4 py-14 px-6">
              <div className="w-20 h-20 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border-2 border-dashed border-amber-200 dark:border-amber-800 flex items-center justify-center text-amber-400 dark:text-amber-600">
                <ClockIcon />
              </div>
              <div className="text-center">
                <p className="text-sm font-semibold text-gray-700 dark:text-gray-300">No assessment data yet</p>
                <p className="text-xs text-gray-400 dark:text-gray-500 mt-1 max-w-xs leading-relaxed">This student hasn't completed the assessment. Results and skill breakdown will appear here once submitted.</p>
              </div>
              <div className="w-full flex flex-col gap-2 mt-2 opacity-40">
                {CATEGORIES.map(cat => (
                  <div key={cat} className="flex items-center gap-2">
                    <span className="text-xs text-gray-400 dark:text-gray-600 w-28 truncate shrink-0">{cat}</span>
                    <div className="flex-1 h-2 bg-gray-100 dark:bg-gray-800 rounded-full" />
                    <span className="text-xs text-gray-300 dark:text-gray-700 w-8 text-right">--%</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
      <style>{`
        @keyframes modalIn {
          from { transform: translateY(32px) scale(0.97); opacity: 0; }
          to   { transform: translateY(0) scale(1); opacity: 1; }
        }
        @media (max-width: 639px) {
          @keyframes modalIn {
            from { transform: translateY(100%); opacity: 0.8; }
            to   { transform: translateY(0); opacity: 1; }
          }
        }
      `}</style>
    </div>
  )
}

// Pagination is now imported from src/components/Pagination.jsx

// ── Inline NavBar for instructor ─────────────────────────────────
function InstructorNav({ instructor }) {
  const navigate = useNavigate()
  const [open,   setOpen]   = useState(false)
  const [mobile, setMobile] = useState(false)
  const [dark,   setDark]   = useState(() => localStorage.getItem('sb-theme') === 'dark')

  function toggleDark() {
    const next = !dark
    setDark(next)
    document.documentElement.classList.toggle('dark', next)
    localStorage.setItem('sb-theme', next ? 'dark' : 'light')
  }

  const links = [
    { label: 'Dashboard',      path: '/instructor/dashboard',         active: true },
    { label: 'Students',       path: '/instructor/students'           },
    { label: 'New assessment', path: '/instructor/assessment/create'  },
  ]

  return (
    <>
      <nav className="bg-white dark:bg-gray-900 border-b border-gray-100 dark:border-gray-800 px-4 sm:px-6 h-14 flex items-center justify-between sticky top-0 z-10">
        {/* Logo */}
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 bg-green-600 rounded-lg flex items-center justify-center shrink-0">
            <svg width="16" height="16" viewBox="0 0 26 26" fill="none">
              <path d="M3 18 Q3 10 13 10 Q23 10 23 18" stroke="white" strokeWidth="2.2" strokeLinecap="round"/>
              <path d="M7 18 L7 14" stroke="white" strokeWidth="2.2" strokeLinecap="round"/>
              <path d="M13 18 L13 12" stroke="white" strokeWidth="2.2" strokeLinecap="round"/>
              <path d="M19 18 L19 14" stroke="white" strokeWidth="2.2" strokeLinecap="round"/>
              <circle cx="7" cy="8" r="2.5" fill="white" opacity="0.85"/>
              <circle cx="19" cy="8" r="2.5" fill="white" opacity="0.85"/>
            </svg>
          </div>
          <span className="text-sm font-semibold text-gray-900 dark:text-white">SkillBridge</span>
          <span className="hidden sm:inline text-gray-300 dark:text-gray-700 text-sm">/</span>
          <span className="hidden sm:inline text-sm text-gray-500 dark:text-gray-400">Instructor</span>
        </div>

        {/* Desktop nav links */}
        <div className="hidden md:flex items-center gap-1">
          {links.map(link => (
            <button
              key={link.label}
              onClick={() => navigate(link.path)}
              className={`px-3 py-1.5 rounded-lg text-sm transition-colors
                ${link.active
                  ? 'bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-white font-medium'
                  : 'text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-50 dark:hover:bg-gray-800'}`}
            >
              {link.label}
            </button>
          ))}
        </div>

        {/* Right side */}
        <div className="flex items-center gap-2">
          {/* Mobile menu toggle */}
          <button
            onClick={() => setMobile(p => !p)}
            className="md:hidden p-2 rounded-lg text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          >
            {mobile ? <XIcon /> : <MenuIcon />}
          </button>

          {/* Avatar dropdown */}
          <div className="relative">
            <button
              onClick={() => setOpen(p => !p)}
              className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center text-xs font-semibold text-blue-700 dark:text-blue-300 hover:ring-2 hover:ring-blue-400 transition-all"
            >
              {instructor.initials}
            </button>
            {open && (
              <div className="absolute right-0 mt-2 w-56 bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-2xl shadow-lg overflow-hidden z-20">
                <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-800">
                  <p className="text-sm font-semibold text-gray-900 dark:text-white truncate">{instructor.name}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">{instructor.subject}</p>
                </div>
                <div className="px-4 py-3 flex items-center justify-between border-b border-gray-100 dark:border-gray-800">
                  <span className="text-sm text-gray-700 dark:text-gray-300">{dark ? 'Dark mode' : 'Light mode'}</span>
                  <button
                    onClick={toggleDark}
                    className={`relative w-9 h-5 rounded-full transition-colors duration-200 ${dark ? 'bg-green-600' : 'bg-gray-200'}`}
                  >
                    <span className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform duration-200 ${dark ? 'translate-x-4' : 'translate-x-0'}`}/>
                  </button>
                </div>
                <button
                  onClick={() => {
                    localStorage.removeItem('sb-token')
                    localStorage.removeItem('sb-refresh')
                    localStorage.removeItem('sb-role')
                    localStorage.removeItem('sb-user')
                    navigate('/login', { replace: true })
                  }}
                  className="w-full flex items-center gap-2.5 px-4 py-3 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950 transition-colors"
                >
                  Log out
                </button>
              </div>
            )}
          </div>
        </div>
      </nav>

      {/* Mobile drawer */}
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

// ── Main component ───────────────────────────────────────────────
export default function InstructorDashboard() {
  const navigate = useNavigate()

  // ── Load real data from API ──────────────────────────────────
  const { data: apiData, loading: apiLoading } = useApi('/api/instructor/students/recommendations/')

  // Read cached instructor info for NavBar
  const cachedUser = (() => { try { return JSON.parse(localStorage.getItem('sb-user')) } catch { return null } })()
  const instructor = {
    name:     cachedUser?.name    || 'Instructor',
    initials: (cachedUser?.name || 'IN').split(' ').map(n => n[0]).slice(0, 2).join(''),
    subject:  cachedUser?.subject || 'OJT Coordinator',
  }

  // Normalize API response to the shape the rest of the component expects
  const studentsList = useMemo(() => {
    if (!apiData || !Array.isArray(apiData)) return []
    return apiData.map(s => ({
      id:        s.id,
      name:      s.student_name || s.name,
      studentId: s.school_id    || s.student_id || '',
      email:     s.email        || '',
      course:    s.course       || '',
      status:    s.has_submitted ? 'completed' : 'pending',
      scores:    s.skill_scores  || {},
      retakeAllowed: s.retake_allowed ?? false,
    }))
  }, [apiData])

  const [search,          setSearch]          = useState('')
  const [filterStatus,    setFilter]          = useState('all')
  const [sortBy,          setSortBy]          = useState('name')
  const [sortDir,         setSortDir]         = useState('asc')
  const [view,            setView]            = useState('list')  // 'grid' | 'list'
  const [page,            setPage]            = useState(1)
  const [selectedStudent, setSelectedStudent] = useState(null)
  const [toast,           setToast]           = useState(null)

  function showToast(msg) { setToast(msg); setTimeout(() => setToast(null), 3000) }

  useEffect(() => {
    function onKey(e) { if (e.key === 'Escape') setSelectedStudent(null) }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  // ── Derived stats ─────────────────────────────────────────────
  const completed = studentsList.filter(s => s.status === 'completed')
  const pending   = studentsList.filter(s => s.status === 'pending')

  const avgOverall = Math.round(
    completed.reduce((sum, s) => sum + (average(s.scores) ?? 0), 0) / (completed.length || 1)
  )

  // ── Skill leaders — top scorer per category ───────────────────
  const leaders = CATEGORIES.map(cat => {
    const top = completed.reduce((best, s) => {
      const score = s.scores[cat] ?? 0
      return score > (best?.scores[cat] ?? -1) ? s : best
    }, null)
    return { category: cat, student: top, score: top?.scores[cat] ?? 0 }
  })

  // ── Filtered + sorted students ────────────────────────────────
  const displayed = useMemo(() => {
    let list = [...studentsList]

    if (filterStatus !== 'all') list = list.filter(s => s.status === filterStatus)

    if (search.trim()) {
      const q = search.toLowerCase()
      list = list.filter(s =>
        s.name.toLowerCase().includes(q) ||
        s.studentId.toLowerCase().includes(q) ||
        s.course.toLowerCase().includes(q)
      )
    }

    list.sort((a, b) => {
      let av, bv
      if (sortBy === 'name') {
        av = a.name; bv = b.name
        return sortDir === 'asc' ? av.localeCompare(bv) : bv.localeCompare(av)
      }
      if (sortBy === 'overall') {
        av = average(a.scores) ?? -1
        bv = average(b.scores) ?? -1
      } else {
        av = a.scores[sortBy] ?? -1
        bv = b.scores[sortBy] ?? -1
      }
      return sortDir === 'asc' ? av - bv : bv - av
    })

    return list
  }, [search, filterStatus, sortBy, sortDir])

  // ── Paginated slice ───────────────────────────────────────────
  const paginated = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE
    return displayed.slice(start, start + PAGE_SIZE)
  }, [displayed, page])

  function handleFilterChange(val) {
    setFilter(val)
    setPage(1)
  }

  function handleSearch(val) {
    setSearch(val)
    setPage(1)
  }

  function toggleSort(col) {
    if (sortBy === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortBy(col); setSortDir('desc') }
  }

  function handleToggleRetake(studentId) {
    setStudentsList(prev => prev.map(s => s.id === studentId ? { ...s, retakeAllowed: !s.retakeAllowed } : s))
    setSelectedStudent(prev => prev?.id === studentId ? { ...prev, retakeAllowed: !prev.retakeAllowed } : prev)
    const st = studentsList.find(s => s.id === studentId)
    if (st) showToast(st.retakeAllowed ? `Retake revoked for ${st.name}.` : `Retake allowed for ${st.name}.`)
  }

  function SortIcon({ col }) {
    if (sortBy !== col) return <span className="text-gray-300 dark:text-gray-700 ml-1">↕</span>
    return <span className="text-green-600 dark:text-green-400 ml-1">{sortDir === 'asc' ? '↑' : '↓'}</span>
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      
      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-gray-900 dark:bg-white text-white dark:text-gray-900 text-sm font-medium px-5 py-3 rounded-2xl shadow-lg flex items-center gap-2">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M20 6L9 17l-5-5" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
          {toast}
        </div>
      )}

      {selectedStudent && <StudentModal student={selectedStudent} onClose={() => setSelectedStudent(null)} onToggleRetake={handleToggleRetake} />}

      <InstructorNav instructor={instructor} />

      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-6 sm:py-8 flex flex-col gap-6 sm:gap-8">

        {/* Page header */}
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-xl font-bold text-gray-900 dark:text-white">Student performance</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
              {instructor.subject} · OJT Assessment 2025–2026
            </p>
          </div>
          <button
            onClick={() => navigate('/instructor/assessment/create')}
            className="shrink-0 flex items-center gap-2 bg-green-600 hover:bg-green-700 active:bg-green-800 text-white text-sm font-semibold px-4 py-2.5 rounded-xl transition-colors"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
              <path d="M12 5v14M5 12h14" stroke="white" strokeWidth="2.5" strokeLinecap="round"/>
            </svg>
            New assessment
          </button>
        </div>

        {/* ── STAT CARDS ────────────────────────────────────────── */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
          {[
            { label: 'Enrolled',  value: studentsList.length,    icon: '👤', sub: 'total students' },
            { label: 'Completed', value: completed.length,   icon: '✓',  sub: 'took the assessment', green: true },
            { label: 'Pending',   value: pending.length,     icon: '…',  sub: 'have not started',    amber: pending.length > 0 },
            { label: 'Avg score', value: `${avgOverall}%`,   icon: '★',  sub: 'across all skills' },
          ].map(card => (
            <div key={card.label} className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-2xl p-4 sm:p-5">
              <p className="text-xs text-gray-400 dark:text-gray-500 mb-3">{card.label}</p>
              <p className={`text-2xl font-bold mb-1
                ${card.green ? 'text-green-600 dark:text-green-400' :
                  card.amber ? 'text-amber-500 dark:text-amber-400' :
                  'text-gray-900 dark:text-white'}`}>
                {card.value}
              </p>
              <p className="text-xs text-gray-400 dark:text-gray-600">{card.sub}</p>
            </div>
          ))}
        </div>

        {/* ── SKILL LEADERS ─────────────────────────────────────── */}
        <div>
          <p className="text-sm font-semibold text-gray-900 dark:text-white mb-3">Top performers by skill</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
            {leaders.map(({ category, student, score }) => (
              <div key={category} className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-2xl p-4">
                <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${CAT_COLORS[category].pill}`}>
                  {category.split(' ')[0]}
                </span>
                <div className="mt-3">
                  <p className="text-xs font-semibold text-gray-900 dark:text-white leading-tight mt-2">
                    {student ? student.name.split(' ').slice(0, 2).join(' ') : '—'}
                  </p>
                  <p className={`text-lg font-bold mt-0.5 ${scoreColor(score)}`}>{score}%</p>
                </div>
                <div className="mt-2 h-1 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full ${CAT_COLORS[category].bar}`}
                    style={{ width: `${score}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ── STUDENT TABLE ──────────────────────────────────────── */}
        <div className="flex flex-col gap-4">

          {/* Table controls */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 flex-wrap">
            <p className="text-sm font-semibold text-gray-900 dark:text-white shrink-0">All students</p>

            {/* Search */}
            <div className="relative flex-1 min-w-0 sm:min-w-48">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none">
                <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="2"/>
                <path d="M16.5 16.5L21 21" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
              </svg>
              <input
                type="text"
                value={search}
                onChange={e => handleSearch(e.target.value)}
                placeholder="Search by name or ID…"
                className="w-full pl-9 pr-4 py-2.5 text-sm rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white outline-none focus:border-green-500 transition-colors"
              />
            </div>

            {/* Filter pills */}
            <div className="flex items-center gap-1.5 flex-wrap">
              {[
                { value: 'all',       label: 'All'       },
                { value: 'completed', label: 'Completed' },
                { value: 'pending',   label: 'Pending'   },
              ].map(f => (
                <button
                  key={f.value}
                  onClick={() => handleFilterChange(f.value)}
                  className={`text-xs px-3 py-1.5 rounded-full font-medium transition-colors
                    ${filterStatus === f.value
                      ? 'bg-gray-900 dark:bg-white text-white dark:text-gray-900'
                      : 'bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'}`}
                >
                  {f.label}
                </button>
              ))}
            </div>

            {/* Export and View toggle */}
            <div className="flex items-center gap-2 ml-auto">
              <button 
                onClick={() => showToast('Exporting scores to CSV...')}
                className="hidden sm:flex items-center gap-1.5 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors"
                title="Download CSV"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                Export
              </button>
              
              <div className="hidden sm:flex items-center gap-1 bg-gray-100 dark:bg-gray-800 rounded-xl p-1">
                {[
                  { v: 'grid', ic: <GridIcon /> },
                  { v: 'list', ic: <ListIcon /> },
                ].map(vw => (
                  <button key={vw.v} onClick={() => setView(vw.v)}
                    className={`p-1.5 rounded-lg transition-colors ${view === vw.v ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm' : 'text-gray-400 dark:text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'}`}
                  >{vw.ic}</button>
                ))}
              </div>
            </div>

            <p className="text-xs text-gray-400 dark:text-gray-500 shrink-0">{displayed.length} students</p>
          </div>

          {/* Empty state */}
          {displayed.length === 0 ? (
            <EmptyState
              message="No students match your search."
              onClear={() => { handleSearch(''); handleFilterChange('all') }}
            />
          ) : (
            <>
              {/* ── GRID VIEW (always on mobile, toggleable on desktop) ── */}
              <div className={`${view === 'grid' ? 'grid' : 'grid sm:hidden'} grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4`}>
                {paginated.map(s => {
                  const overall = average(s.scores)
                  const topEntry = Object.entries(s.scores).reduce((a, b) => b[1] > a[1] ? b : a, ['', -1])
                  const top = topEntry[1] >= 0 ? topEntry : null
                  return (
                    <div key={s.id} onClick={() => setSelectedStudent(s)} className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-2xl p-5 flex flex-col gap-4 hover:shadow-md hover:border-green-300 dark:hover:border-green-700 hover:ring-2 hover:ring-green-200 dark:hover:ring-green-900 transition-all cursor-pointer">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-10 h-10 rounded-full bg-green-100 dark:bg-green-900 flex items-center justify-center text-sm font-bold text-green-700 dark:text-green-300 shrink-0">{ini(s.name)}</div>
                          <div className="min-w-0">
                            <p className="text-sm font-semibold text-gray-900 dark:text-white leading-tight truncate">{s.name}</p>
                            <p className="text-xs text-gray-400 dark:text-gray-500">{s.studentId} · {s.course}</p>
                          </div>
                        </div>
                        <div className="shrink-0">
                          <StatusBadge status={s.status} />
                        </div>
                      </div>

                      {s.status === 'completed' ? (
                        <div className="flex flex-col gap-2">
                          <div>
                            <div className="flex justify-between mb-1">
                              <span className="text-xs text-gray-500 dark:text-gray-400">Overall</span>
                              <span className={`text-sm font-bold ${scoreColor(overall)}`}>{overall}%</span>
                            </div>
                            <div className="h-2 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
                              <div className={`h-full rounded-full ${scoreBgBar(overall)}`} style={{ width: `${overall}%` }}/>
                            </div>
                          </div>
                          {CATEGORIES.map(cat => {
                            const sc = s.scores[cat]
                            return (
                              <div key={cat} className="flex items-center gap-2">
                                <span className="text-xs text-gray-400 dark:text-gray-500 w-24 truncate shrink-0">{cat}</span>
                                <div className="flex-1 h-1 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
                                  <div className={`h-full rounded-full ${scoreBgBar(sc)}`} style={{ width: `${sc}%` }}/>
                                </div>
                                <span className={`text-xs font-medium w-9 text-right ${scoreColor(sc)}`}>{sc}%</span>
                              </div>
                            )
                          })}
                          {top && top[0] && (
                            <div className="flex items-center gap-2 bg-gray-50 dark:bg-gray-800 rounded-xl px-3 py-2 mt-1">
                              <svg width="12" height="12" viewBox="0 0 24 24" fill="none"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" stroke="#16a34a" strokeWidth="2" strokeLinecap="round"/></svg>
                              <span className="text-xs text-gray-500 dark:text-gray-400">Best in</span>
                              <span className="text-xs font-semibold text-gray-900 dark:text-white">{top[0]}</span>
                              <span className="ml-auto text-xs font-bold text-green-600 dark:text-green-400">{top[1]}%</span>
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="flex flex-col gap-2">
                          {CATEGORIES.map(c => (
                            <div key={c} className="flex items-center gap-2">
                              <span className="text-xs text-gray-300 dark:text-gray-700 w-24 truncate shrink-0">{c}</span>
                              <div className="flex-1 h-1 bg-gray-100 dark:bg-gray-800 rounded-full"/>
                              <span className="text-xs text-gray-300 dark:text-gray-700 w-9 text-right">--%</span>
                            </div>
                          ))}
                          <p className="text-xs text-gray-400 dark:text-gray-600 text-center mt-1">Waiting for assessment</p>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>

              {/* ── LIST VIEW (desktop only) ── */}
              {view === 'list' && (
                <div className="hidden sm:block bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-2xl overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/50">
                          <th
                            onClick={() => toggleSort('name')}
                            className="text-left px-5 py-3.5 text-xs font-semibold text-gray-500 dark:text-gray-400 cursor-pointer hover:text-gray-900 dark:hover:text-white transition-colors select-none"
                          >
                            Student <SortIcon col="name" />
                          </th>
                          <th className="text-left px-3 py-3.5 text-xs font-semibold text-gray-500 dark:text-gray-400">
                            Status
                          </th>
                          {CATEGORIES.map(cat => (
                            <th
                              key={cat}
                              onClick={() => toggleSort(cat)}
                              className="text-center px-3 py-3.5 text-xs font-semibold text-gray-500 dark:text-gray-400 cursor-pointer hover:text-gray-900 dark:hover:text-white transition-colors select-none whitespace-nowrap"
                            >
                              {cat.split(' ')[0]} <SortIcon col={cat} />
                            </th>
                          ))}
                          <th
                            onClick={() => toggleSort('overall')}
                            className="text-center px-5 py-3.5 text-xs font-semibold text-gray-500 dark:text-gray-400 cursor-pointer hover:text-gray-900 dark:hover:text-white transition-colors select-none"
                          >
                            Overall <SortIcon col="overall" />
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {paginated.length === 0 && (
                          <tr>
                            <td colSpan={CATEGORIES.length + 3} className="text-center py-12 text-sm text-gray-400 dark:text-gray-600">
                              No students match your search.
                            </td>
                          </tr>
                        )}
                        {paginated.map((s, i) => {
                          const overall = average(s.scores)
                          return (
                            <tr
                              key={s.id}
                              onClick={() => setSelectedStudent(s)}
                              className={`border-b border-gray-50 dark:border-gray-800 last:border-0 hover:bg-green-50 dark:hover:bg-green-950/20 cursor-pointer transition-colors
                                ${i % 2 === 0 ? '' : 'bg-gray-50/30 dark:bg-gray-800/20'}`}
                            >
                              <td className="px-5 py-4">
                                <div className="flex items-center gap-3">
                                  <div className="w-7 h-7 rounded-full bg-green-100 dark:bg-green-900 flex items-center justify-center text-xs font-semibold text-green-700 dark:text-green-300 shrink-0">
                                    {ini(s.name)}
                                  </div>
                                  <div>
                                    <p className="text-sm font-medium text-gray-900 dark:text-white leading-tight">{s.name}</p>
                                    <p className="text-xs text-gray-400 dark:text-gray-500">{s.studentId} · {s.course}</p>
                                  </div>
                                </div>
                              </td>
                              <td className="px-3 py-4">
                                {s.status === 'completed' ? (
                                  <span className="inline-flex items-center gap-1 text-xs font-medium text-green-700 dark:text-green-300 bg-green-100 dark:bg-green-900 px-2.5 py-1 rounded-full">
                                    <span className="w-1 h-1 rounded-full bg-green-500 inline-block" />Done
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-1 text-xs font-medium text-amber-700 dark:text-amber-300 bg-amber-100 dark:bg-amber-900 px-2.5 py-1 rounded-full">
                                    <span className="w-1 h-1 rounded-full bg-amber-500 inline-block" />Pending
                                  </span>
                                )}
                              </td>
                              {CATEGORIES.map(cat => {
                                const score = s.scores[cat] ?? null
                                return (
                                  <td key={cat} className={`px-3 py-4 text-center ${score !== null ? scoreBg(score) : ''}`}>
                                    <span className={`text-sm font-semibold ${scoreColor(score)}`}>
                                      {score !== null ? `${score}%` : '—'}
                                    </span>
                                  </td>
                                )
                              })}
                              <td className={`px-5 py-4 text-center ${overall !== null ? scoreBg(overall) : ''}`}>
                                <span className={`text-sm font-bold ${scoreColor(overall)}`}>
                                  {overall !== null ? `${overall}%` : '—'}
                                </span>
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Pagination */}
              <Pagination total={displayed.length} page={page} onPage={setPage} pageSize={PAGE_SIZE} />
            </>
          )}

          {/* Score legend */}
          <div className="flex flex-wrap items-center gap-3 px-1 pb-4">
            <p className="text-xs text-gray-400 dark:text-gray-600 mr-1">Score key:</p>
            {[
              { label: '≥ 80% Strong',     cls: 'bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300' },
              { label: '60–79% Fair',       cls: 'bg-amber-100 dark:bg-amber-900 text-amber-700 dark:text-amber-300' },
              { label: '< 60% Needs work',  cls: 'bg-rose-100 dark:bg-rose-900 text-rose-700 dark:text-rose-300' },
            ].map(l => (
              <span key={l.label} className={`text-xs font-medium px-2.5 py-1 rounded-full ${l.cls}`}>{l.label}</span>
            ))}
          </div>
        </div>

      </main>
    </div>
  )
}