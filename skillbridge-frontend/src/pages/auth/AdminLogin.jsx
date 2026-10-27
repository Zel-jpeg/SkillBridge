import AuthBackground from '../../components/auth/AuthBackground'
import { useLoginPreparation } from '../../hooks/useLoginPreparation'
import { useToast } from '../../context/ToastContext'
// src/pages/auth/AdminLogin.jsx
//
// Admin-only login page.
// Same visual style as LoginPage.jsx but uses username + password
// instead of Google OAuth.
//
// Route: /admin/login

import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../../api/axios'
import { authDestination } from '../../api/authDestination'
import { resetSessionData } from '../../api/logout'
import { useSession } from '../../context/SessionContext'

// ================================================================
const SYSTEM_NAME     = "SkillBridge"
const SCHOOL_NAME     = "Davao del Norte State College"
const SCHOOL_FOOTER   = "DNSC · Institute of Computing · 2026"
// ================================================================

export default function AdminLogin() {
  const { showToast } = useToast()
  const navigate = useNavigate()
  const { establishSession } = useSession()
  const { beginPreparation, completePreparation, isCurrentPreparation } = useLoginPreparation()
  const [preparing, setPreparing] = useState(false)

  const [username,   setUsername]   = useState('')
  const [password,   setPassword]   = useState('')
  const [showPass,   setShowPass]   = useState(false)
  const [loading,    setLoading]    = useState(false)
  const [error,      setError]      = useState('')
  const [recoveryHelp, setRecoveryHelp] = useState(false)

  // ── Login handler ─────────────────────────────────────────────
  async function handleLogin(e) {
    e.preventDefault()
    setError('')

    if (!username.trim()) { setError('Username is required.'); return }
    if (!password)        { setError('Password is required.'); return }

    setLoading(true)
    setPreparing(false)
    const preparation = beginPreparation()
    // Retire the prior identity before the exchange, as Google sign-in does.
    // A late old-session 401 must not expire the new sign-in attempt.
    resetSessionData()
    localStorage.removeItem('sb-token')
    localStorage.removeItem('sb-refresh')

    try {
      const res = await api.post('/api/auth/login/', { email: username, password })
      if (preparation.signal.aborted) return
      const user = establishSession(res.data)
      setPreparing(authDestination(user).endsWith('/dashboard'))
      const destination = await completePreparation(user, preparation)
      if (!destination) return
      showToast('Signed in successfully.')

      navigate(destination, { replace: true, state: user.role === 'student' && user.is_approved === false ? { type: 'student_waiting' } : undefined })
    } catch (err) {
      if (preparation.signal.aborted) return
      const msg = err.response?.data?.error

      if (msg === 'pending') {
        navigate('/instructor/pending')
      } else if (msg === 'google_required') {
        setError('Students and instructors sign in with their DNSC Google account from the main sign-in page.')
      } else {
        setError(msg || (err.response?.status === 401 ? 'Invalid username or password.' : 'Sign-in is unavailable. Please try again.'))
      }
    } finally {
      if (isCurrentPreparation(preparation)) {
        setLoading(false)
        setPreparing(false)
      }
    }
  }

  // ── Administrator-assisted recovery ───────────────────────────
  function handleForgotPassword() {
    setRecoveryHelp(true)
    setError('')
  }

  return (
    <AuthBackground>
      <div className="sb-auth-card sb-login-card w-full bg-white rounded-2xl border border-gray-100 p-6 sm:p-7">

        {/* Logo + school name */}
        <div className="flex flex-col items-center gap-2 mb-5 text-center">
          <div className="w-12 h-12 shrink-0">
            <img 
              src="/SB-logov1.png" 
              alt="SkillBridge Logo" 
              className="w-full h-full rounded-xl object-cover shadow-sm"
            />
          </div>
          <div>
            <p className="text-xl font-bold text-gray-900 leading-tight">{SYSTEM_NAME}</p>
            <p className="text-xs text-gray-500 mt-1.5">{SCHOOL_NAME}</p>
          </div>
        </div>

        {/* Heading */}
        <div className="mb-5 text-center">
          <h1 className="text-xl sm:text-2xl font-semibold text-gray-900 mb-1.5">Admin sign in</h1>
          <p className="text-sm text-gray-500 leading-relaxed">
            Sign in with your administrator account.
          </p>
        </div>

        {recoveryHelp && (
          <div role="status" className="mb-5 bg-green-50 border border-green-200 rounded-xl px-4 py-3">
            <p className="text-xs text-green-700 leading-relaxed">
              Contact your designated SkillBridge administrator or authorized server operator through your college’s existing support channel. After verifying your identity, they can reset your individual admin password. This page does not send a reset email.
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

          {/* Email */}
          <div>
            <label htmlFor="admin-email" className="block text-sm font-medium text-gray-700 mb-1.5">
              Email Address
            </label>
            <input
              id="admin-email"
              type="text"
              inputMode="email"
              autoCapitalize="none"
              spellCheck={false}
              value={username}
              onChange={e => { setUsername(e.target.value); setError('') }}
              placeholder="Enter your admin email (e.g. admin@dnsc.edu.ph)"
              autoComplete="username"
              className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-white text-gray-900 text-sm outline-none focus:border-green-500 transition-colors placeholder:text-gray-400"
            />
          </div>

          {/* Password */}
          <div>
            <label htmlFor="admin-password" className="block text-sm font-medium text-gray-700 mb-1.5">
              Password
            </label>
            <div className="relative">
              <input
                id="admin-password"
                type={showPass ? 'text' : 'password'}
                value={password}
                onChange={e => { setPassword(e.target.value); setError('') }}
                placeholder="Enter your password"
                autoComplete="current-password"
                className="w-full px-4 py-3 pr-14 rounded-xl border border-gray-200 bg-white text-gray-900 text-sm outline-none focus:border-green-500 transition-colors placeholder:text-gray-400"
              />
              {/* Show / hide toggle */}
              <button
                type="button"
                onClick={() => setShowPass(p => !p)}
                className="absolute right-1 top-1/2 -translate-y-1/2 min-h-11 min-w-11 flex items-center justify-center rounded-lg text-gray-500 hover:text-gray-700 transition-colors focus-visible:outline-2 focus-visible:outline-green-600"
                aria-label={showPass ? 'Hide password' : 'Show password'}
                aria-pressed={showPass}
              >
                {showPass ? (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"
                      stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    <line x1="1" y1="1" x2="23" y2="23" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                  </svg>
                ) : (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"
                      stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="2"/>
                  </svg>
                )}
              </button>
            </div>

            {/* Forgot password */}
            <div className="flex justify-end">
              <button
                type="button"
                onClick={handleForgotPassword}
                className="min-h-11 text-xs text-green-700 hover:text-green-800 hover:underline transition-colors focus-visible:outline-2 focus-visible:outline-green-600"
              >
                Forgot password?
              </button>
            </div>
          </div>

          {/* Submit */}
          <button
            type="submit"
            disabled={loading}
            className="w-full min-h-12 py-3 rounded-xl bg-green-600 hover:bg-green-700 disabled:opacity-60 disabled:cursor-not-allowed text-white text-sm font-semibold transition-colors flex items-center justify-center gap-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-green-600"
          >
            {loading ? (
              <>
                <svg className="animate-spin" width="16" height="16" viewBox="0 0 24 24" fill="none">
                  <circle cx="12" cy="12" r="9" stroke="white" strokeWidth="2" strokeDasharray="42" strokeDashoffset="12"/>
                </svg>
                <span role="status">{preparing ? 'Preparing your dashboard…' : 'Signing in…'}</span>
              </>
            ) : 'Sign in'}
          </button>

        </form>

        {/* Back to main login */}
        <p className="border-t border-gray-100 mt-4 pt-2 text-center">
          <button
            type="button"
            onClick={() => navigate('/login')}
            className="min-h-11 text-xs text-green-700 hover:text-green-800 hover:underline transition-colors focus-visible:outline-2 focus-visible:outline-green-600"
          >
            ← Back to student / instructor login
          </button>
        </p>

      </div>
      <p className="sb-login-footer">{SCHOOL_FOOTER}</p>
    </AuthBackground>
  )
}
