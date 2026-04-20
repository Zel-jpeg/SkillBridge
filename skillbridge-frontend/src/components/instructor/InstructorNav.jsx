// src/components/instructor/InstructorNav.jsx
//
// Shared top navigation bar for all instructor pages.
// Reads logged-in instructor info from localStorage('sb-user') internally.
//
// Props:
//   activePath — string matching one of the nav link paths,
//                used to highlight the active link.
//                e.g. activePath="/instructor/dashboard"

import { useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { MenuIcon, XIcon, SkillBridgeLogo } from '../Icons'

export default function InstructorNav({ activePath }) {
  const navigate = useNavigate()
  const location = useLocation()
  const active   = activePath ?? location.pathname

  // ── User info — read from localStorage (set at login) ────────────
  const cachedUser = (() => { try { return JSON.parse(localStorage.getItem('sb-user')) } catch { return null } })()
  const instructor = {
    name:     cachedUser?.name    ?? 'Instructor',
    initials: (cachedUser?.name ?? 'IN').split(' ').map(n => n[0]).slice(0, 2).join(''),
    subject:  cachedUser?.course  ?? 'OJT Coordinator',
  }

  // ── UI state ────────────────────────────────────────────────────
  const [profileOpen, setProfileOpen] = useState(false)
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
    { label: 'Dashboard',      path: '/instructor/dashboard'          },
    { label: 'Students',       path: '/instructor/students'           },
    { label: 'New assessment', path: '/instructor/assessment/create'  },
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
    <>
      <nav className="bg-white dark:bg-gray-900 border-b border-gray-100 dark:border-gray-800 px-4 sm:px-6 h-14 flex items-center justify-between sticky top-0 z-10">

        {/* Logo */}
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 bg-green-600 rounded-lg flex items-center justify-center shrink-0">
            <SkillBridgeLogo />
          </div>
          <span className="text-sm font-semibold text-gray-900 dark:text-white">SkillBridge</span>
          <span className="hidden sm:inline text-gray-300 dark:text-gray-700">/</span>
          <span className="hidden sm:inline text-sm text-gray-500 dark:text-gray-400">Instructor</span>
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
          <div className="relative">
            <button
              onClick={() => setProfileOpen(p => !p)}
              className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center text-xs font-semibold text-blue-700 dark:text-blue-300 hover:ring-2 hover:ring-blue-400 transition-all"
            >
              {instructor.initials}
            </button>
            {profileOpen && (
              <div className="absolute right-0 mt-2 w-56 bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-2xl shadow-lg overflow-hidden z-20">
                <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-800">
                  <p className="text-sm font-semibold text-gray-900 dark:text-white truncate">{instructor.name}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">{instructor.subject}</p>
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
        <div className="md:hidden bg-white dark:bg-gray-900 border-b border-gray-100 dark:border-gray-800 px-4 py-3 flex flex-col gap-1 sticky top-14 z-10 shadow-sm">
          {links.map(l => (
            <button key={l.label} onClick={() => go(l.path)} className={mobileLinkClass(l.path)}>
              {l.label}
            </button>
          ))}
        </div>
      )}
    </>
  )
}
