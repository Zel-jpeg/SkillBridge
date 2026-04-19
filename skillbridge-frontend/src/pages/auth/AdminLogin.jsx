// src/pages/auth/AdminLogin.jsx
//
// Admin-only login page.
// Same visual style as LoginPage.jsx but uses username + password
// instead of Google OAuth.
//
// Route: /admin/login
//
// TODO Week 3: Replace handleLogin with real API call
//   POST /api/auth/admin/login/  { username, password }
//   → returns JWT token + role confirmation

import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../../api/axios'
import { prefetchForRole } from '../../api/prefetch'

// ================================================================
const SYSTEM_NAME    = "SkillBridge"
const SCHOOL_NAME    = "Davao del Norte State College"
const SCHOOL_LOCATION = "Panabo City, Davao del Norte · Institute of Computing"
// ================================================================

export default function AdminLogin() {
  const navigate = useNavigate()

  const [username,    setUsername]    = useState('')
  const [password,    setPassword]    = useState('')
  const [showPass,    setShowPass]    = useState(false)
  const [loading,     setLoading]     = useState(false)
  const [error,       setError]       = useState('')
  const [forgotSent,  setForgotSent]  = useState(false)  // for the forgot-password flow

  // ── Login handler ────────────────────────────────────────────
  
  function handleLogin(e) {
    e.preventDefault()
    setError('')

    if (!username.trim()) { setError('Username is required.'); return }
    if (!password)        { setError('Password is required.'); return }

    setLoading(true)

    api.post('/api/auth/login/', { email: username, password })
      .then(res => {
        const { access, refresh, user } = res.data
        localStorage.setItem('sb-token',   access)
        localStorage.setItem('sb-refresh', refresh)
        localStorage.setItem('sb-role',    user.role)
        localStorage.setItem('sb-user',    JSON.stringify(user))

        prefetchForRole(user.role)

        if (user.role === 'admin')       navigate('/admin/dashboard')
        else if (user.role === 'instructor') {
          if (!user.is_approved) navigate('/instructor/pending')
          else                   navigate('/instructor/dashboard')
        }
      })
      .catch(err => {
        const msg = err.response?.data?.error
      // =========================================================================
      // ⚠️ TEMPORARY DEMO LOGIN (DELETE BEFORE FINAL DEFENSE)
      // =========================================================================
      if (
        username === 'instructor@dnsc.edu.ph' &&
        password === 'instructor123'
      ) {
        localStorage.setItem('sb-token', 'demo-instructor-token')
        localStorage.setItem('sb-role',  'instructor')
        navigate('/instructor/dashboard')
        return
      }
      //------------------
        
        if (msg === 'pending') navigate('/instructor/pending')
        else setError('Invalid username or password.')
      })
      .finally(() => setLoading(false))
  }
  
 /*
  function handleLogin(e) {
    e.preventDefault()
    setError('')

    if (!username.trim()) { setError('Username is required.'); return }
    if (!password)        { setError('Password is required.'); return }

    setLoading(true)

    // TODO Week 3: POST /api/auth/admin/login/
    // Simulated delay — remove when real API is wired
    setTimeout(() => {
      setLoading(false)
      
      // =========================================================================
      // [ADJUSTED PART START]: Added dummy data validation and conditional routing
      // =========================================================================
      if (username === 'admin' && password === 'admin01031') {
        // Fake success for admin → go to admin dashboard
        localStorage.setItem('sb-token', 'admin-placeholder-token')
        localStorage.setItem('sb-role',  'admin')
        navigate('/admin/dashboard')
      } 
      else if (username === 'instructor' && password === 'instructor01031') {
        // Fake success for instructor → go to instructor dashboard
        localStorage.setItem('sb-token', 'instructor-placeholder-token')
        localStorage.setItem('sb-role',  'instructor')
        navigate('/instructor/dashboard')
      } 
      else {
        // Invalid credentials fallback
        setError('Invalid username or password.')
      }
      // =========================================================================
      // [ADJUSTED PART END]
      // =========================================================================

    }, 800)
  }
  */

  // ── Forgot password ──────────────────────────────────────────
  function handleForgotPassword() {
    if (!username.trim()) {
      setError('Enter your username above first, then click Forgot password.')
      return
    }
    // TODO Week 3: POST /api/auth/admin/reset-password/  { username }
    setForgotSent(true)
    setError('')
  }

  return (
    <div className="min-h-screen bg-green-50 flex items-center justify-center p-6">
      <div className="w-full max-w-md bg-white rounded-2xl border border-gray-100 p-10">

        {/* Logo + school name */}
        <div className="flex items-center gap-3 mb-8">
          <div className="w-12 h-12 bg-green-600 rounded-xl flex items-center justify-center shrink-0">
            <svg width="26" height="26" viewBox="0 0 26 26" fill="none">
              <path d="M3 18 Q3 10 13 10 Q23 10 23 18" stroke="white" strokeWidth="2.2" strokeLinecap="round"/>
              <path d="M7 18 L7 14" stroke="white" strokeWidth="2.2" strokeLinecap="round"/>
              <path d="M13 18 L13 12" stroke="white" strokeWidth="2.2" strokeLinecap="round"/>
              <path d="M19 18 L19 14" stroke="white" strokeWidth="2.2" strokeLinecap="round"/>
              <circle cx="7" cy="8" r="2.5" fill="white" opacity="0.85"/>
              <circle cx="19" cy="8" r="2.5" fill="white" opacity="0.85"/>
            </svg>
          </div>
          <div>
            <p className="text-lg font-bold text-gray-900 leading-tight">{SYSTEM_NAME}</p>
            <p className="text-xs text-gray-500">{SCHOOL_NAME}</p>
          </div>
        </div>

        {/* Badge */}
        <span className="inline-flex items-center gap-1.5 bg-amber-100 text-amber-700 text-xs font-semibold px-3 py-1 rounded-full mb-6">
          <span className="w-1.5 h-1.5 rounded-full bg-amber-500 inline-block"></span>
          Admin Access
        </span>

        {/* Heading */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900 mb-1.5">Admin sign in</h1>
          <p className="text-sm text-gray-500 leading-relaxed">
            Enter your administrator credentials to continue.
          </p>
        </div>

        {/* Forgot-password confirmation banner */}
        {forgotSent && (
          <div className="mb-5 flex items-start gap-2.5 bg-green-50 border border-green-200 rounded-xl px-4 py-3">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" className="mt-0.5 shrink-0 text-green-600">
              <path d="M20 6L9 17l-5-5" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            <p className="text-xs text-green-700 leading-relaxed">
              If that username exists, a password-reset link has been sent to the associated email. Check your inbox.
            </p>
          </div>
        )}

        {/* Error banner */}
        {error && (
          <div className="mb-5 flex items-start gap-2.5 bg-red-50 border border-red-200 rounded-xl px-4 py-3">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" className="mt-0.5 shrink-0 text-red-500">
              <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2"/>
              <path d="M12 8v4M12 16h.01" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
            </svg>
            <p className="text-xs text-red-600 leading-relaxed">{error}</p>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleLogin} className="flex flex-col gap-4">

          {/* Username */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Username
            </label>
            <input
              type="text"
              value={username}
              onChange={e => { setUsername(e.target.value); setError('') }}
              placeholder="Enter your admin username"
              autoComplete="username"
              className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-white text-gray-900 text-sm outline-none focus:border-green-500 transition-colors placeholder:text-gray-400"
            />
          </div>

          {/* Password */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Password
            </label>
            <div className="relative">
              <input
                type={showPass ? 'text' : 'password'}
                value={password}
                onChange={e => { setPassword(e.target.value); setError('') }}
                placeholder="Enter your password"
                autoComplete="current-password"
                className="w-full px-4 py-3 pr-11 rounded-xl border border-gray-200 bg-white text-gray-900 text-sm outline-none focus:border-green-500 transition-colors placeholder:text-gray-400"
              />
              {/* Show / hide toggle */}
              <button
                type="button"
                onClick={() => setShowPass(p => !p)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                tabIndex={-1}
              >
                {showPass ? (
                  /* Eye-off icon */
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"
                      stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    <line x1="1" y1="1" x2="23" y2="23" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                  </svg>
                ) : (
                  /* Eye icon */
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"
                      stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="2"/>
                  </svg>
                )}
              </button>
            </div>

            {/* Forgot password */}
            <div className="flex justify-end mt-1.5">
              <button
                type="button"
                onClick={handleForgotPassword}
                className="text-xs text-green-600 hover:text-green-800 hover:underline transition-colors"
              >
                Forgot password?
              </button>
            </div>
          </div>

          {/* Submit */}
          <button
            type="submit"
            disabled={loading}
            className="w-full py-3.5 rounded-xl bg-green-600 hover:bg-green-700 disabled:opacity-60 disabled:cursor-not-allowed text-white text-sm font-semibold transition-colors mt-1 flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <svg className="animate-spin" width="16" height="16" viewBox="0 0 24 24" fill="none">
                  <circle cx="12" cy="12" r="9" stroke="white" strokeWidth="2" strokeDasharray="42" strokeDashoffset="12"/>
                </svg>
                Signing in…
              </>
            ) : 'Sign in'}
          </button>

        </form>

        {/* Back to main login */}
        <p className="text-center mt-5">
          <button
            onClick={() => navigate('/login')}
            className="text-xs text-gray-400 hover:text-gray-600 hover:underline transition-colors"
          >
            ← Back to student / instructor login
          </button>
        </p>

        <div className="border-t border-gray-100 mt-6 pt-6 text-center">
          <p className="text-xs text-gray-400">{SCHOOL_LOCATION}</p>
        </div>

      </div>
    </div>
  )
}
