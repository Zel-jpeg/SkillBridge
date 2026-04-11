// src/components/ErrorBoundary.jsx
//
// React class-based error boundary.
// Catches any rendering crash anywhere in the tree and shows a
// friendly "Something went wrong" card instead of a blank white screen.
//
// Wrap the whole app in main.jsx:
//   <ErrorBoundary>
//     <App />
//   </ErrorBoundary>

import { Component } from 'react'

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error }
  }

  componentDidCatch(error, info) {
    // In production, send to an error monitoring service (e.g., Sentry)
    console.error('[ErrorBoundary] Rendering crash:', error, info)
  }

  render() {
    if (!this.state.hasError) return this.props.children

    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex items-center justify-center px-4">
        <div className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-3xl shadow-xl p-10 max-w-md w-full text-center flex flex-col items-center gap-5">

          {/* Icon */}
          <div className="w-16 h-16 rounded-2xl bg-rose-50 dark:bg-rose-950/50 flex items-center justify-center">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#e11d48" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/>
              <line x1="12" y1="9" x2="12" y2="13"/>
              <line x1="12" y1="17" x2="12.01" y2="17"/>
            </svg>
          </div>

          {/* Message */}
          <div>
            <h1 className="text-base font-bold text-gray-900 dark:text-white">Something went wrong</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1.5 leading-relaxed">
              An unexpected error occurred. Your data is safe — please reload the page to continue.
            </p>
            {import.meta.env.DEV && this.state.error && (
              <p className="mt-3 text-xs font-mono text-rose-500 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/40 border border-rose-100 dark:border-rose-900 rounded-xl px-4 py-3 text-left wrap-break-word">
                {this.state.error.message}
              </p>
            )}
          </div>

          {/* Actions */}
          <div className="flex gap-3 w-full">
            <button
              onClick={() => window.location.reload()}
              className="flex-1 bg-green-600 hover:bg-green-700 active:bg-green-800 text-white font-semibold text-sm py-3 rounded-xl transition-colors"
            >
              Reload page
            </button>
            <button
              onClick={() => { window.location.href = '/login' }}
              className="flex-1 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 font-semibold text-sm py-3 rounded-xl transition-colors"
            >
              Go to login
            </button>
          </div>
        </div>
      </div>
    )
  }
}
