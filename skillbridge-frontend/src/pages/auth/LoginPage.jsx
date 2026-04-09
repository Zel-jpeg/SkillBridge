// Add this import at the very top
import { useNavigate } from 'react-router-dom'

// ================================================================
const SYSTEM_NAME = "SkillBridge"
const SCHOOL_NAME = "Davao del Norte State College"
const SCHOOL_LOCATION = "Panabo City, Davao del Norte · Institute of Computing"
const GOOGLE_BUTTON_TEXT = "Continue with DNSC Google Account"
const SUBTITLE = "Sign in with your DNSC-provided Google account to continue."
const ACCESS_NOTE = "Access is limited to enrolled OJT students and DNSC faculty only."
// ================================================================

export default function LoginPage() {
  // useNavigate lets you redirect to another page programmatically
  const navigate = useNavigate()

  function handleGoogleLogin() {
    // TODO Week 3: Replace this with real Google OAuth
    // After OAuth, backend returns role (student/instructor/admin)
    // and the app routes accordingly. For now, go to student setup.
    navigate('/student/setup')
  }

  return (
    <div className="min-h-screen bg-green-50 flex items-center justify-center p-6">
      <div className="w-full max-w-md bg-white rounded-2xl border border-gray-100 p-10">

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

        <span className="inline-flex items-center gap-1.5 bg-green-100 text-green-700 text-xs font-semibold px-3 py-1 rounded-full mb-6">
          <span className="w-1.5 h-1.5 rounded-full bg-green-500 inline-block"></span>
          OJT Placement System
        </span>

        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900 mb-1.5">Welcome back</h1>
          <p className="text-sm text-gray-500 leading-relaxed">{SUBTITLE}</p>
        </div>

        <button
          onClick={handleGoogleLogin}
          className="w-full flex items-center justify-center gap-3 px-4 py-3.5
            border border-gray-200 rounded-xl bg-white text-gray-800 text-sm font-medium
            hover:bg-gray-50 transition-colors duration-150 cursor-pointer"
        >
          <svg width="20" height="20" viewBox="0 0 48 48">
            <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
            <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
            <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
            <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.18 1.48-4.97 2.36-8.16 2.36-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
          </svg>
          {GOOGLE_BUTTON_TEXT}
        </button>

        <p className="text-center text-xs text-gray-400 mt-5">{ACCESS_NOTE}</p>

        {/* ── Admin login link — mirrors DNSC LMS pattern ── */}
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