// src/components/admin/AdminNav.jsx
//
// Shared top navigation bar for all admin pages.
// Reads logged-in admin info from localStorage('sb-user') internally.
//
// Props:
//   activePath — string matching one of the nav link paths,
//                used to highlight the active link.
//                e.g. activePath="/admin/dashboard"

import { useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { MenuIcon, XIcon } from '../Icons'
import { clearAllCache } from '../../hooks/useApi'
import { resetPrefetch } from '../../api/prefetch'
import { closeSSE } from '../../hooks/useSSE'

export default function AdminNav({ activePath }) {
  const navigate  = useNavigate()
  const location  = useLocation()
  const active    = activePath ?? location.pathname

  // ── User info — read from localStorage (set at login) ────────────
  const cachedUser = (() => { try { return JSON.parse(localStorage.getItem('sb-user')) } catch { return null } })()
  const admin = {
    name:     cachedUser?.name     ?? 'Administrator',
    initials: (cachedUser?.name ?? 'AD').split(' ').map(n => n[0]).slice(0, 2).join(''),
    photoUrl: cachedUser?.photo_url ?? null,
  }

  // ── UI state ────────────────────────────────────────────────────
  const [profileOpen, setProfileOpen] = useState(false)
  const [mobileOpen,  setMobileOpen]  = useState(false)
  const [dark,        setDark]        = useState(() => localStorage.getItem('sb-theme') === 'dark')
  const [showLogoutModal, setShowLogoutModal] = useState(false)

  function toggleDark() {
    const next = !dark; setDark(next)
    document.documentElement.classList.toggle('dark', next)
    localStorage.setItem('sb-theme', next ? 'dark' : 'light')
  }

  function handleLogoutClick() {
    setProfileOpen(false)
    setShowLogoutModal(true)
  }

  function confirmLogout() {
    localStorage.removeItem('sb-token')
    localStorage.removeItem('sb-refresh')
    localStorage.removeItem('sb-role')
    localStorage.removeItem('sb-user')
    clearAllCache()
    resetPrefetch()
    closeSSE()
    navigate('/login', { replace: true })
  }

  function go(path) {
    navigate(path)
    setMobileOpen(false)
    setProfileOpen(false)
  }

  const links = [
    { label: 'Dashboard',   path: '/admin/dashboard'   },
    { label: 'Skills',      path: '/admin/skills'      },
    { label: 'Companies',   path: '/admin/companies'   },
    { label: 'Users',       path: '/admin/users'       },
    { label: 'Assessments', path: '/admin/assessments' },
    { label: 'Reports',     path: '/admin/reports'     },
  ]

  const linkClass = (path) =>
    `px-3 py-1.5 rounded-lg text-sm transition-colors ${
      active === path
        ? 'bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-white font-medium'
        : 'text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-50 dark:hover:bg-gray-800'
    }`

  const mobileLinkClass = (path) =>
    `w-full text-left px-3 py-2.5 rounded-xl text-sm transition-colors ${
      active === path
        ? 'bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-white font-medium'
        : 'text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-50 dark:hover:bg-gray-800'
    }`

  return (
    <div className="sticky top-0 z-30">
      <nav className="bg-white dark:bg-gray-900 border-b border-gray-100 dark:border-gray-800 px-4 sm:px-6 h-14 flex items-center justify-between">

        {/* Logo */}
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 shrink-0">
            <img 
              src="/SB-logov1.png" 
              alt="SkillBridge Logo" 
              className="w-full h-full rounded-md object-cover shadow-sm"
            />
          </div>
          <span className="text-sm font-semibold text-gray-900 dark:text-white">SkillBridge</span>
          <span className="hidden sm:inline text-gray-300 dark:text-gray-700">/</span>
          <span className="hidden sm:inline text-sm text-gray-500 dark:text-gray-400">Admin</span>
        </div>

        {/* Desktop nav links */}
        <div className="hidden md:flex items-center gap-1">
          {links.map(l => (
            <button key={l.label} onClick={() => go(l.path)} className={linkClass(l.path)}>
              {l.label}
            </button>
          ))}
        </div>

        {/* Right side */}
        <div className="flex items-center gap-2">

          {/* Hamburger (mobile) */}
          <button
            onClick={() => setMobileOpen(p => !p)}
            className="md:hidden p-2 rounded-lg text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          >
            {mobileOpen ? <XIcon size={20} /> : <MenuIcon />}
          </button>

          {/* Avatar dropdown */}
          <div className="relative ml-1">
            <button
              onClick={() => { setProfileOpen(p => !p) }}
              className="w-8 h-8 rounded-full bg-rose-100 dark:bg-rose-900 flex items-center justify-center text-xs font-semibold text-rose-700 dark:text-rose-300 hover:ring-2 hover:ring-rose-400 transition-all overflow-hidden"
            >
              {admin.photoUrl
                ? <img
                    src={admin.photoUrl}
                    alt="avatar"
                    className="w-full h-full object-cover"
                    referrerPolicy="no-referrer"
                    onError={e => { e.currentTarget.style.display = 'none' }}
                  />
                : admin.initials
              }
            </button>
            {profileOpen && (
              <div className="absolute right-0 mt-2 w-56 bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-2xl shadow-xl overflow-hidden z-40">
                <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-800">
                  <p className="text-sm font-semibold text-gray-900 dark:text-white truncate">{admin.name}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">Administrator</p>
                </div>
                <div className="px-4 py-3 flex items-center justify-between border-b border-gray-100 dark:border-gray-800">
                  <span className="text-sm text-gray-700 dark:text-gray-300">{dark ? 'Dark mode' : 'Light mode'}</span>
                  <button onClick={toggleDark} className={`relative w-9 h-5 rounded-full transition-colors ${dark ? 'bg-green-600' : 'bg-gray-200'}`}>
                    <span className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${dark ? 'translate-x-4' : 'translate-x-0'}`} />
                  </button>
                </div>
                <button onClick={handleLogoutClick} className="w-full text-left px-4 py-3 text-sm text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950 transition-colors">
                  Sign out
                </button>
              </div>
            )}
          </div>
        </div>
      </nav>

      {/* Mobile slide-down menu */}
      {mobileOpen && (
        <div className="md:hidden bg-white dark:bg-gray-900 border-b border-gray-100 dark:border-gray-800 shadow-sm">
          <div className="px-4 py-3 flex flex-col gap-1">
            {links.map(l => (
              <button key={l.label} onClick={() => go(l.path)} className={mobileLinkClass(l.path)}>
                {l.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ── LOGOUT MODAL ── */}
      {showLogoutModal && (
        <div className="fixed inset-0 bg-black/40 dark:bg-black/60 flex items-end sm:items-center justify-center z-50 p-4 sm:px-6">
          <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 p-6 sm:p-8 w-full max-w-sm relative shadow-2xl">
            <div className="w-12 h-12 bg-red-50 dark:bg-red-950/50 rounded-xl flex items-center justify-center mb-4">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#dc2626" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                <polyline points="16 17 21 12 16 7" />
                <line x1="21" y1="12" x2="9" y2="12" />
              </svg>
            </div>
            
            <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">Log out of SkillBridge?</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-6 leading-relaxed">
              You can always log back in using your account.
            </p>
            
            <div className="flex gap-3">
              <button
                onClick={() => setShowLogoutModal(false)}
                className="flex-1 py-3 rounded-xl border border-gray-200 dark:border-gray-700 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={confirmLogout}
                className="flex-1 py-3 rounded-xl bg-red-600 text-white text-sm font-semibold hover:bg-red-700 active:bg-red-800 transition-colors"
              >
                Log out
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
