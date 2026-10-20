import { useToast } from '../../context/ToastContext'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useGoogleLogin } from '@react-oauth/google'
import api from '../../api/axios'
import { authDestination } from '../../api/authDestination'
import { resetSessionData } from '../../api/logout'
import { useSession } from '../../context/SessionContext'

const SYSTEM_NAME        = "SkillBridge"
const SCHOOL_NAME        = "Davao del Norte State College"
const SCHOOL_LOCATION    = "Panabo City, Davao del Norte · Institute of Computing"
const GOOGLE_BUTTON_TEXT = "Continue with DNSC Google Account"
const SUBTITLE           = "Sign in with your DNSC-provided Google account to continue."
const ACCESS_NOTE        = "Access is limited to enrolled OJT students and DNSC faculty only."

export default function LoginPage() {
  const { showToast } = useToast()
  const navigate = useNavigate()
  const { establishSession } = useSession()
  const [error,   setError]   = useState('')
  const [loading, setLoading] = useState(false)
  const [showHelp, setShowHelp] = useState(false)

  const googleLogin = useGoogleLogin({
    flow: 'implicit',
    onSuccess: async (tokenResponse) => {
      setError('')
      setLoading(true)

      // Stop work belonging to the previous session before exchanging auth.
      resetSessionData()
      localStorage.removeItem('sb-token')
      localStorage.removeItem('sb-refresh')

      try {
        const res = await api.post(
          '/api/auth/google/',
          { token: tokenResponse.access_token }
        )

        const user = establishSession(res.data)
        showToast('Signed in successfully.')

        navigate(authDestination(user), { replace: true, state: user.role === 'student' && user.is_approved === false ? { type: 'student_waiting' } : undefined })

      } catch (err) {
        const code = err.response?.data?.error

        if (code === 'not_dnsc') {
          setError('Only @dnsc.edu.ph Google accounts are allowed. Please switch accounts and try again.')
        } else if (code === 'admin_password_required') {
          navigate('/admin/login', { replace: true })
        } else if (code === 'email_unverified') {
          setError('Verify your DNSC Google email before signing in.')
        } else if (code === 'account_disabled') {
          setError('This account is inactive. Contact your system administrator.')
        } else if (code === 'pending') {
          navigate('/instructor/pending', { state: { type: 'instructor_waiting' } })
        } else if (code === 'role_selection_required') {
          navigate('/instructor/pending', { state: { type: 'not_enrolled' } })
        } else if (code === 'student_not_enrolled' || code === 'student_pending') {
          navigate('/instructor/pending', {
            state: { type: 'student_waiting' }
          })
        } else if (err.response?.status === 401) {
          setError('Google token was invalid or expired. Please try signing in again.')
        } else if (err.response?.status === 500) {
          setError('Sign-in is temporarily unavailable. Please try again.')
        } else if (!err.response) {
          setError('Cannot reach the server. Check your connection and try again.')
        } else {
          setError(`Login failed. (${code ?? err.message})`)
        }
      } finally {
        setLoading(false)
      }
    },
    onError: () => {
      setError('Google sign-in was cancelled or blocked. Make sure pop-ups are allowed.')
    },
  })

  return (
    <div className="min-h-screen bg-green-50 flex items-center justify-center p-6">
      <div className="w-full max-w-md bg-white rounded-2xl border border-gray-100 p-10">

        <div className="flex items-center gap-3 mb-8">
          <div className="w-12 h-12 shrink-0">
            <img 
              src="/SB-logov1.png" 
              alt="SkillBridge Logo" 
              className="w-full h-full rounded-xl object-cover shadow-sm"
            />
          </div>
          <div>
            <p className="text-lg font-bold text-gray-900 leading-tight">{SYSTEM_NAME}</p>
            <p className="text-xs text-gray-500">{SCHOOL_NAME}</p>
          </div>
        </div>

        <span className="inline-flex items-center gap-1.5 bg-green-100 text-green-700 text-xs font-semibold px-3 py-1 rounded-full mb-6">
          <span className="w-1.5 h-1.5 rounded-full bg-green-500 inline-block"></span>
          OJT Placement System
        </span>

        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900 mb-1.5">Welcome back</h1>
          <p className="text-sm text-gray-500 leading-relaxed">{SUBTITLE}</p>
        </div>

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

        <button
          onClick={() => googleLogin()}
          disabled={loading}
          className="w-full flex items-center justify-center gap-3 px-4 py-3.5
            border border-gray-200 rounded-xl bg-white text-gray-800 text-sm font-medium
            hover:bg-gray-50 disabled:opacity-60 disabled:cursor-not-allowed
            transition-colors duration-150 cursor-pointer"
        >
          {loading ? (
            <>
              <svg className="animate-spin" width="16" height="16" viewBox="0 0 24 24" fill="none">
                <circle cx="12" cy="12" r="9" stroke="#aaa" strokeWidth="2" strokeDasharray="42" strokeDashoffset="12"/>
              </svg>
              Signing in…
            </>
          ) : (
            <>
              <svg width="20" height="20" viewBox="0 0 48 48">
                <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
                <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
                <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
                <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.18 1.48-4.97 2.36-8.16 2.36-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
              </svg>
              {GOOGLE_BUTTON_TEXT}
            </>
          )}
        </button>

        <p className="text-center text-xs text-gray-400 mt-5">{ACCESS_NOTE}</p>

        <button type="button" onClick={() => setShowHelp(value => !value)} aria-expanded={showHelp}
          className="mt-4 w-full text-center text-xs text-green-700 hover:underline focus-visible:outline-2 focus-visible:outline-green-600">
          Need help signing in?
        </button>
        {showHelp && <p role="status" className="mt-3 rounded-xl bg-green-50 px-4 py-3 text-xs leading-relaxed text-green-800">
          For a forgotten DNSC Google password, contact your college IT support through its existing support channel. SkillBridge administrators cannot reset your Google password. If your SkillBridge account is pending or not enrolled, contact your instructor or OJT coordinator for access review.
        </p>}

        <p className="text-center mt-4">
          <button
            onClick={() => navigate('/admin/login')}
            className="text-xs text-green-600 hover:text-green-800 hover:underline transition-colors"
          >
            Login as admin?
          </button>
        </p>

        <div className="border-t border-gray-100 mt-6 pt-6 text-center">
          <p className="text-xs text-gray-400">{SCHOOL_LOCATION}</p>
        </div>
      </div>
    </div>
  )
}
