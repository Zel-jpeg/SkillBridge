// src/context/SessionContext.jsx
//
// Controls the "Session Expired" modal.
// When any API call returns 401, call triggerSessionExpired().
// The modal appears on top of everything and forces the user to re-login.
//
// On logout / re-login:
//   - Clears auth tokens from localStorage
//   - Wipes the API cache (useApi)
//   - Resets prefetch state
//   - Closes the SSE connection (useSSE) so it doesn't reconnect after logout

import { createContext, useContext, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { clearAllCache } from '../hooks/useApi'
import { resetPrefetch } from '../api/prefetch'
import { closeSSE } from '../hooks/useSSE'    // ← close SSE on logout

const SessionContext = createContext(null)

export function SessionProvider({ children }) {
  const [expired, setExpired] = useState(false)
  const navigate = useNavigate()

  const triggerSessionExpired = useCallback(() => {
    setExpired(true)
  }, [])

  function handleReLogin() {
    setExpired(false)
    // Clear all auth tokens
    localStorage.removeItem('sb-token')
    localStorage.removeItem('sb-refresh')
    localStorage.removeItem('sb-role')
    localStorage.removeItem('sb-user')
    // Clear API cache and prefetch state so next login re-fetches fresh data
    clearAllCache()
    resetPrefetch()
    // Close SSE so the singleton doesn't try to reconnect after logout
    closeSSE()
    // Replace history so back button can't go back to the protected page
    navigate('/login', { replace: true })
  }

  return (
    <SessionContext.Provider value={{ triggerSessionExpired }}>
      {children}
      {expired && <SessionExpiredModal onReLogin={handleReLogin} />}
    </SessionContext.Provider>
  )
}

export function useSession() {
  const ctx = useContext(SessionContext)
  if (!ctx) throw new Error('useSession must be used inside <SessionProvider>')
  return ctx
}

// ── Session Expired Modal ─────────────────────────────────────────
function SessionExpiredModal({ onReLogin }) {
  return (
    <>
      <style>{`
        @keyframes sessionModalIn {
          from { transform: scale(0.95) translateY(10px); opacity: 0; }
          to   { transform: scale(1)    translateY(0);    opacity: 1; }
        }
      `}</style>

      {/* Backdrop */}
      <div className="fixed inset-0 z-10000 flex items-center justify-center bg-black/60 backdrop-blur-sm px-4">
        {/* Card */}
        <div
          className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-3xl shadow-2xl w-full max-w-sm p-8 flex flex-col items-center gap-5 text-center"
          style={{ animation: 'sessionModalIn 0.3s cubic-bezier(0.34,1.1,0.64,1) both' }}
        >
          {/* Icon */}
          <div className="w-16 h-16 rounded-2xl bg-amber-50 dark:bg-amber-950/50 flex items-center justify-center">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
              <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
              <line x1="12" y1="15" x2="12" y2="17"/>
            </svg>
          </div>

          {/* Text */}
          <div>
            <h2 className="text-base font-bold text-gray-900 dark:text-white">Session Expired</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1.5 leading-relaxed">
              Your session has expired for security reasons. Please sign in again to continue.
            </p>
          </div>

          {/* Action */}
          <button
            onClick={onReLogin}
            className="w-full bg-green-600 hover:bg-green-700 active:bg-green-800 text-white font-semibold text-sm py-3 rounded-xl transition-colors"
          >
            Sign in again
          </button>
        </div>
      </div>
    </>
  )
}