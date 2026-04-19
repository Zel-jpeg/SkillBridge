// src/hooks/useApi.js
//
// Wrapper for all authenticated API calls.
// Handles loading states, error toasts, and session expiry (401).
//
// ── Caching strategy: stale-while-revalidate ────────────────────────
//   • A module-level Map stores { data, fetchedAt } keyed by URL.
//   • On mount, if cached data exists it is returned immediately
//     (no loading spinner) and a background refresh runs silently.
//   • Cache TTL is 60 seconds. After that the next visit re-fetches
//     with a spinner (only happens if the user was away for > 1 min).
//   • Call invalidateCache(url) after mutations so the next GET is fresh.
//
// Usage — one-time fetch on mount:
//   const { data, loading, error } = useApi('/api/students/me/')
//
// Usage — manual trigger (forms, mutations):
//   const { request, loading } = useApi()
//   await request('patch', '/api/students/me/profile/', { phone: '...' })

import { useState, useEffect, useCallback, useRef } from 'react'
import api from '../api/axios'
import { useToast } from '../context/ToastContext'
import { useSession } from '../context/SessionContext'

// ── Module-level cache (survives page navigation, cleared on sign-out) ──
const _cache    = new Map()  // url → { data, fetchedAt }
const CACHE_TTL = 60_000     // 60 s — stale after this; background-refresh kicks in

/** Call after mutations to force the next GET to bypass the cache. */
export function invalidateCache(url) {
  _cache.delete(url)
}

/** Wipe the entire cache — call on logout. */
export function clearAllCache() {
  _cache.clear()
}

/**
 * Write a value directly into the cache (used by the prefetch service).
 * Skips the write if the URL already has a fresh entry so a fast component
 * useEffect response doesn't get overwritten by a slow prefetch.
 */
export function _setCache(url, data) {
  const existing = _cache.get(url)
  // Don't overwrite fresh entries — whichever resolved first wins
  if (existing && (Date.now() - existing.fetchedAt < CACHE_TTL)) return
  _cache.set(url, { data, fetchedAt: Date.now() })
}


// Friendly error messages for common HTTP status codes
function friendlyError(status) {
  switch (status) {
    case 400: return 'Invalid request. Please check your input.'
    case 403: return 'You do not have permission to do that.'
    case 404: return 'The requested data was not found.'
    case 429: return 'Too many requests. Please wait a moment and try again.'
    case 500: return 'Server error. Please try again in a moment.'
    case 502:
    case 503:
    case 504: return 'Server is unavailable. Check your connection.'
    default:  return 'Something went wrong. Please try again.'
  }
}

export function useApi(url, { skip = false, initialData = null } = {}) {
  const { showToast }             = useToast()
  const { triggerSessionExpired } = useSession()

  // ── Seed state from cache so the component renders instantly ──────
  // (useState initialiser only runs once, so this is safe)
  const getCached = () => (url && !skip ? _cache.get(url) : null)
  const seed      = getCached()

  const [data,    setData]    = useState(seed?.data ?? initialData)
  // Show loading only when there is no cached data to display
  const [loading, setLoading] = useState(!!url && !skip && !seed)
  const [error,   setError]   = useState(null)

  // Tracks whether the current fetch is a silent background revalidation
  const isBg = useRef(false)

  // ── Auto-fetch on mount (when url is provided) ───────────────────
  useEffect(() => {
    if (!url || skip) return
    let cancelled = false

    const entry = _cache.get(url)
    const fresh  = entry && (Date.now() - entry.fetchedAt < CACHE_TTL)

    // Data is fresh → nothing to do, render is already populated from cache
    if (fresh) return

    if (entry) {
      // Stale data exists → show it (already seeded in state) + refresh quietly
      isBg.current = true
    } else {
      // No cache → show spinner until data arrives
      setLoading(true)
    }
    setError(null)

    api.get(url)
      .then(res => {
        if (cancelled) return
        _cache.set(url, { data: res.data, fetchedAt: Date.now() })
        setData(res.data)
        setLoading(false)
        isBg.current = false
      })
      .catch(err => {
        if (cancelled) return
        setLoading(false)
        isBg.current = false
        const status = err.response?.status

        if (status === 401) {
          triggerSessionExpired()
          return
        }

        const msg = err.response?.data?.error || err.response?.data?.detail || friendlyError(status)
        setError(msg)
        // Don't show a toast for background revalidations — stale data is still visible
        if (!entry) showToast(msg, 'error')
      })

    return () => { cancelled = true }
  }, [url, skip]) // eslint-disable-line

  // ── Manual trigger (for mutations: POST, PATCH, DELETE) ──────────
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
