// src/context/ToastContext.jsx
//
// Global toast notification system.
// Wrap the app with <ToastProvider> and call useToast() anywhere.
//
// Usage:
//   const { showToast } = useToast()
//   showToast('Saved!', 'success')
//   showToast('Network error', 'error')
//   showToast('Loading...', 'info')
//   showToast('Watch out!', 'warning')

import { createContext, useContext, useState, useCallback, useRef } from 'react'

const ToastContext = createContext(null)

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([])
  const idRef = useRef(0)

  const showToast = useCallback((message, type = 'info', duration = 4000) => {
    const id = ++idRef.current
    setToasts(prev => [...prev, { id, message, type }])
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id))
    }, duration)
  }, [])

  const dismiss = useCallback((id) => {
    setToasts(prev => prev.filter(t => t.id !== id))
  }, [])

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <ToastStack toasts={toasts} onDismiss={dismiss} />
    </ToastContext.Provider>
  )
}

export function useToast() {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast must be used inside <ToastProvider>')
  return ctx
}

// ── Toast stack UI ────────────────────────────────────────────────
const TOAST_STYLES = {
  success: {
    bg:   'bg-gray-900 dark:bg-gray-50',
    text: 'text-white dark:text-gray-900',
    icon: (
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M20 6L9 17l-5-5"/>
      </svg>
    ),
  },
  error: {
    bg:   'bg-rose-700 dark:bg-rose-600',
    text: 'text-white',
    icon: (
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10"/><path d="M15 9l-6 6M9 9l6 6"/>
      </svg>
    ),
  },
  warning: {
    bg:   'bg-amber-500',
    text: 'text-white',
    icon: (
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/>
        <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
      </svg>
    ),
  },
  info: {
    bg:   'bg-gray-900 dark:bg-gray-50',
    text: 'text-white dark:text-gray-900',
    icon: (
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#60a5fa" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
      </svg>
    ),
  },
}

function ToastStack({ toasts, onDismiss }) {
  if (!toasts.length) return null
  return (
    <>
      <style>{`
        @keyframes toastIn {
          from { transform: translateX(-50%) translateY(20px); opacity: 0; }
          to   { transform: translateX(-50%) translateY(0);    opacity: 1; }
        }
      `}</style>
      <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-9999 flex flex-col gap-2 items-center pointer-events-none">
        {toasts.map(toast => {
          const style = TOAST_STYLES[toast.type] ?? TOAST_STYLES.info
          return (
            <div
              key={toast.id}
              className={`flex items-center gap-2.5 px-5 py-3 rounded-2xl shadow-2xl text-sm font-medium pointer-events-auto cursor-pointer
                ${style.bg} ${style.text}`}
              style={{ animation: 'toastIn 0.25s cubic-bezier(0.34,1.1,0.64,1) both' }}
              onClick={() => onDismiss(toast.id)}
            >
              {style.icon}
              {toast.message}
            </div>
          )
        })}
      </div>
    </>
  )
}
