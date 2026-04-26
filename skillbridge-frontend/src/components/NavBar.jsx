// src/components/NavBar.jsx
//
// Shared nav used across all student, instructor, and admin pages.
// Props:
//   student  — { name, initials, studentId, course, photoUrl? }
//
// NOTE: The old `back` prop has been removed.
// Each page now renders its own back/breadcrumb row inside <main>.
// See StudentResults, StudentProfile for the pattern.

import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'

export default function NavBar({ student }) {
  const navigate = useNavigate()

  // ── Dark mode ────────────────────────────────────────────────
  const [dark, setDark] = useState(() => localStorage.getItem('sb-theme') === 'dark')

  useEffect(() => {
    const root = document.documentElement
    if (dark) { root.classList.add('dark'); localStorage.setItem('sb-theme', 'dark') }
    else       { root.classList.remove('dark'); localStorage.setItem('sb-theme', 'light') }
  }, [dark])

  // ── Dropdown ─────────────────────────────────────────────────
  const [open, setOpen] = useState(false)
  const ref = useRef(null)

  useEffect(() => {
    function handleOutside(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', handleOutside)
    return () => document.removeEventListener('mousedown', handleOutside)
  }, [])

  function handleLogout() {
    localStorage.removeItem('sb-token')
    localStorage.removeItem('sb-refresh')
    localStorage.removeItem('sb-role')
    localStorage.removeItem('sb-user')
    navigate('/login', { replace: true })
  }

  return (
    <nav className="bg-white dark:bg-gray-900 border-b border-gray-100 dark:border-gray-800 px-6 h-14 flex items-center justify-between sticky top-0 z-10">

      {/* Left — logo only */}
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
      </div>

      {/* Right — profile dropdown */}
      <div className="relative" ref={ref}>
        <button
          onClick={() => setOpen(prev => !prev)}
          className="w-8 h-8 rounded-full bg-green-100 dark:bg-green-900 flex items-center justify-center text-xs font-semibold text-green-700 dark:text-green-300 hover:ring-2 hover:ring-green-400 transition-all overflow-hidden"
        >
          {student?.photoUrl
            ? <img
                src={student.photoUrl}
                alt="avatar"
                className="w-full h-full object-cover"
                referrerPolicy="no-referrer"
                onError={e => { e.currentTarget.style.display = 'none' }}
              />
            : student?.initials ?? 'S'
          }
        </button>

        {open && (
          <div className="absolute right-0 mt-2 w-56 bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-2xl shadow-lg overflow-hidden z-20">

            {/* Student info */}
            <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-800">
              <p className="text-sm font-semibold text-gray-900 dark:text-white truncate">{student?.name ?? 'Student'}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">{student?.course} · {student?.studentId}</p>
            </div>

            {/* Profile link */}
            <button
              onClick={() => { setOpen(false); navigate('/student/profile') }}
              className="w-full flex items-center gap-2.5 px-4 py-3 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors border-b border-gray-100 dark:border-gray-800"
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
                <circle cx="12" cy="8" r="4" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                <path d="M4 20c0-4 3.58-7 8-7s8 3 8 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
              </svg>
              My profile
            </button>

            {/* Dark mode toggle */}
            <div className="px-4 py-3 flex items-center justify-between border-b border-gray-100 dark:border-gray-800">
              <div className="flex items-center gap-2.5">
                {dark ? (
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" className="text-gray-500 dark:text-gray-400">
                    <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                ) : (
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" className="text-gray-500">
                    <circle cx="12" cy="12" r="5" stroke="currentColor" strokeWidth="2"/>
                    <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                  </svg>
                )}
                <span className="text-sm text-gray-700 dark:text-gray-300">{dark ? 'Dark mode' : 'Light mode'}</span>
              </div>
              <button
                onClick={() => setDark(prev => !prev)}
                className={`relative w-9 h-5 rounded-full transition-colors duration-200 ${dark ? 'bg-green-600' : 'bg-gray-200'}`}
              >
                <span className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform duration-200 ${dark ? 'translate-x-4' : 'translate-x-0'}`}/>
              </button>
            </div>

            {/* Logout */}
            <button
              onClick={handleLogout}
              className="w-full flex items-center gap-2.5 px-4 py-3 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950 transition-colors"
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                <polyline points="16 17 21 12 16 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                <line x1="21" y1="12" x2="9" y2="12" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
              </svg>
              Log out
            </button>

          </div>
        )}
      </div>
    </nav>
  )
}