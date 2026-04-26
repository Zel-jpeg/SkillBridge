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
import { MenuIcon, XIcon, BellIcon, SkillBridgeLogo } from '../Icons'

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
  const [notifOpen,   setNotifOpen]   = useState(false)
  const [mobileOpen,  setMobileOpen]  = useState(false)
  const [dark,        setDark]        = useState(() => localStorage.getItem('sb-theme') === 'dark')

  function toggleDark() {
    const next = !dark; setDark(next)
    document.documentElement.classList.toggle('dark', next)
    localStorage.setItem('sb-theme', next ? 'dark' : 'light')
  }

  function handleLogout() {
    localStorage.removeItem('sb-token')
    localStorage.removeItem('sb-refresh')
    localStorage.removeItem('sb-role')
    localStorage.removeItem('sb-user')
    navigate('/login', { replace: true })
  }

  function go(path) {
    navigate(path)
    setMobileOpen(false)
    setProfileOpen(false)
  }

  const links = [
    { label: 'Dashboard', path: '/admin/dashboard' },
    { label: 'Companies', path: '/admin/companies'  },
    { label: 'Users',     path: '/admin/users'      },
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
          <div className="w-7 h-7 bg-green-600 rounded-lg flex items-center justify-center shrink-0">
            <SkillBridgeLogo />
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

          {/* Notification bell */}
          <div className="relative hidden sm:block">
            <button
              onClick={() => { setNotifOpen(p => !p); setProfileOpen(false) }}
              className="relative p-1.5 rounded-full text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
            >
              <BellIcon />
              <span className="absolute top-1 right-1.5 w-2 h-2 bg-rose-500 rounded-full border-2 border-white dark:border-gray-900 pointer-events-none" />
            </button>
            {notifOpen && (
              <div className="absolute right-0 mt-2 w-72 bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-2xl shadow-xl overflow-hidden z-40">
                <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-800 flex justify-between items-center">
                  <p className="text-sm font-bold text-gray-900 dark:text-white">Notifications</p>
                  <span className="text-[10px] uppercase font-bold text-gray-400">3 New</span>
                </div>
                <div className="max-h-64 overflow-y-auto">
                  <div onClick={() => { go('/admin/users?tab=pending') }} className="px-4 py-3 border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/50 cursor-pointer flex gap-3 transition-colors bg-blue-50/30 dark:bg-blue-900/10">
                    <div className="mt-0.5 w-2 h-2 bg-blue-500 rounded-full shrink-0" />
                    <div>
                      <p className="text-sm font-semibold text-gray-900 dark:text-white leading-snug">New Instructor Request</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">A user has requested instructor access.</p>
                      <p className="text-[10px] text-gray-400 mt-1">Just now</p>
                    </div>
                  </div>
                  <div className="px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-800/50 cursor-pointer flex gap-3 transition-colors">
                    <div className="mt-0.5 w-2 h-2 bg-gray-200 dark:bg-gray-700 rounded-full shrink-0" />
                    <div>
                      <p className="text-sm font-semibold text-gray-900 dark:text-white leading-snug">Assessment matching engine updated to v2.0.</p>
                      <p className="text-[10px] text-gray-400 mt-1">1 day ago</p>
                    </div>
                  </div>
                </div>
                <div className="px-4 py-2 bg-gray-50 dark:bg-gray-800/50 text-center border-t border-gray-100 dark:border-gray-800">
                  <button onClick={() => { go('/admin/notifications') }} className="text-xs font-semibold text-blue-600 hover:text-blue-700 dark:text-blue-400">
                    View all activity
                  </button>
                </div>
              </div>
            )}
          </div>

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
              onClick={() => { setProfileOpen(p => !p); setNotifOpen(false) }}
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
                <button onClick={handleLogout} className="w-full text-left px-4 py-3 text-sm text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950 transition-colors">
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
    </div>
  )
}
