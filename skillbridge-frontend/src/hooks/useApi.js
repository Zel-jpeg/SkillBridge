// src/hooks/useApi.js
//
// Wrapper for all authenticated API calls.
// Handles loading states, error toasts, and session expiry (401).
//
// Usage — one-time fetch on mount:
//   const { data, loading, error } = useApi('/api/students/me/')
//
// Usage — manual trigger (forms, mutations):
//   const { request, loading } = useApi()
//   await request('patch', '/api/students/me/profile/', { phone: '...' })

import { useState, useEffect, useCallback } from 'react'
import api from '../api/axios'
import { useToast } from '../context/ToastContext'
import { useSession } from '../context/SessionContext'

// Friendly error messages for common HTTP status codes
function friendlyError(status) {
  switch (status) {
    case 400: return 'Invalid request. Please check your input.'
    case 403: return 'You do not have permission to do that.'
    case 404: return 'The requested data was not found.'
    case 429: return 'Too many requests. Please slow down.'
    case 500: return 'Server error. Please try again in a moment.'
    case 502:
    case 503:
    case 504: return 'Server is unavailable. Check your connection.'
    default:  return 'Something went wrong. Please try again.'
  }
}

export function useApi(url, { skip = false, initialData = null } = {}) {
  const [data,    setData]    = useState(initialData)
  // If we already have initialData, start as NOT loading (renders instantly)
  // The background fetch will still run and update data when it completes.
  const [loading, setLoading] = useState(!!url && !skip && initialData === null)
  const [error,   setError]   = useState(null)


  const { showToast }           = useToast()
  const { triggerSessionExpired } = useSession()

  // ── Auto-fetch on mount (when url is provided) ──────────────────
  useEffect(() => {
    if (!url || skip) return
    let cancelled = false

    setLoading(true)
    setError(null)

    api.get(url)
      .then(res => {
        if (!cancelled) { setData(res.data); setLoading(false) }
      })
      .catch(err => {
        if (cancelled) return
        setLoading(false)
        const status = err.response?.status

        if (status === 401) {
          triggerSessionExpired()
          return
        }

        const msg = err.response?.data?.error || err.response?.data?.detail || friendlyError(status)
        setError(msg)
        showToast(msg, 'error')
      })

    return () => { cancelled = true }
  }, [url, skip]) // eslint-disable-line

  // ── Manual trigger (for mutations: POST, PATCH, DELETE) ─────────
  const request = useCallback(async (method, endpoint, payload, { silentError = false } = {}) => {
    setLoading(true)
    setError(null)
    try {
      const res = await api[method](endpoint, payload)
      setLoading(false)
      return { ok: true, data: res.data }
    } catch (err) {
      setLoading(false)
      const status = err.response?.status

      if (status === 401) {
        triggerSessionExpired()
        return { ok: false, status }
      }

      const msg = err.response?.data?.error || err.response?.data?.detail || friendlyError(status)
      setError(msg)
      if (!silentError) showToast(msg, 'error')
      return { ok: false, status, message: msg, raw: err.response?.data }
    }
  }, [showToast, triggerSessionExpired])

  return { data, loading, error, request, setData }
}
