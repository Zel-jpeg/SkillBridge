// src/hooks/useApi.js
//
// Wrapper for all authenticated API calls.
// Handles loading states, error toasts, and session expiry (401).
//
// ── Caching strategy: stale-while-revalidate + sessionStorage persistence ───
//   • A module-level Map stores { data, fetchedAt } keyed by URL (fast, in-memory).
//   • sessionStorage is the persistence layer — survives page refreshes, cleared
//     automatically when the browser tab is closed.
//   • On mount: in-memory cache → sessionStorage → fetch (in that priority order).
//   • Cache TTL is 5 minutes. SSE events invalidate specific keys instantly so
//     the long TTL doesn't cause stale data — the server pushes changes.
//   • Call invalidateCache(url) after mutations so the next GET is fresh.
//
// ── SSE integration ──────────────────────────────────────────────────────────
//   • useSSE.js dispatches 'sse:data_changed' CustomEvents on the window.
//   • Every useApi instance listens for its own URL in that event.
//   • On match → background re-fetch → setData() → component re-renders.
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

// ── Cache constants ───────────────────────────────────────────────────────────
const CACHE_TTL       = 300_000          // 5 minutes (SSE handles real-time updates)
const STORAGE_PREFIX  = 'sb_api_'       // sessionStorage key prefix

// ── In-memory cache (fast path) ───────────────────────────────────────────────
const _cache    = new Map()  // url → { data, fetchedAt }
const _inflight = new Map()  // url → Promise (deduplicates simultaneous requests)

// ── sessionStorage helpers (persistence layer) ────────────────────────────────

function _saveToStorage(url, data) {
  try {
    sessionStorage.setItem(
      STORAGE_PREFIX + url,
      JSON.stringify({ data, fetchedAt: Date.now() })
    )
  } catch {
    // QuotaExceededError or private browsing — silently ignore
  }
}

function _loadFromStorage(url) {
  try {
    const raw = sessionStorage.getItem(STORAGE_PREFIX + url)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

function _removeFromStorage(url) {
  try { sessionStorage.removeItem(STORAGE_PREFIX + url) } catch {}
}

function _clearAllStorage() {
  try {
    Object.keys(sessionStorage)
      .filter(k => k.startsWith(STORAGE_PREFIX))
      .forEach(k => sessionStorage.removeItem(k))
  } catch {}
}

// ── Public cache utilities ────────────────────────────────────────────────────

/** Call after mutations to force the next GET to bypass the cache. */
export function invalidateCache(url) {
  _cache.delete(url)
  _removeFromStorage(url)
}

/** Wipe the entire cache — call on logout. */
export function clearAllCache() {
  _cache.clear()
  _inflight.clear()
  _clearAllStorage()
}

/**
 * Write a value directly into the cache (used by the prefetch service).
 * Skips the write if the URL already has a fresh entry so a fast component
 * useEffect response doesn't get overwritten by a slow prefetch.
 */
export function _setCache(url, data) {
  const existing = _cache.get(url)
  if (existing && (Date.now() - existing.fetchedAt < CACHE_TTL)) return
  _cache.set(url, { data, fetchedAt: Date.now() })
  _saveToStorage(url, data)
}

/**
 * Deduplicated fetch — if the same URL is already in-flight, return the
 * existing Promise so we don't fire duplicate requests.
 */
export function fetchWithDedup(url) {
  if (_inflight.has(url)) return _inflight.get(url)
  const promise = api.get(url)
    .then(res => {
      const entry = { data: res.data, fetchedAt: Date.now() }
      _cache.set(url, entry)
      _saveToStorage(url, res.data)   // persist to sessionStorage
      _inflight.delete(url)
      return res
    })
    .catch(err => {
      _inflight.delete(url)
      throw err
    })
  _inflight.set(url, promise)
  return promise
}

// ── Friendly error messages ───────────────────────────────────────────────────
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

// ── Main hook ─────────────────────────────────────────────────────────────────
export function useApi(url, { skip = false, initialData = null } = {}) {
  const { showToast }             = useToast()
  const { triggerSessionExpired } = useSession()

  // ── Seed state from cache (in-memory → sessionStorage → null) ────────────
  const getCached = () => {
    if (!url || skip) return null
    // 1. In-memory (fastest)
    const mem = _cache.get(url)
    if (mem) return mem
    // 2. sessionStorage (survives page refresh)
    const stored = _loadFromStorage(url)
    if (stored) {
      _cache.set(url, stored)   // warm in-memory cache from storage
      return stored
    }
    return null
  }

  const seed = getCached()

  const [data,    setData]    = useState(seed?.data ?? initialData)
  const [loading, setLoading] = useState(!!url && !skip && !seed)
  const [error,   setError]   = useState(null)

  // Tracks whether the current fetch is a silent background revalidation
  const isBg = useRef(false)

  // ── Auto-fetch on mount ──────────────────────────────────────────────────
  useEffect(() => {
    if (!url || skip) return
    let cancelled = false

    const entry = _cache.get(url) ?? _loadFromStorage(url)
    const fresh  = entry && (Date.now() - entry.fetchedAt < CACHE_TTL)

    // Fresh cache → nothing to do
    if (fresh) {
      // Ensure state is populated even if the component mounted after a refresh
      if (entry && data === null) setData(entry.data)
      return
    }

    if (entry) {
      // Stale data exists → show it + refresh quietly in background
      isBg.current = true
    } else {
      // No cache → show spinner
      setLoading(true)
    }
    setError(null)

    fetchWithDedup(url)
      .then(res => {
        if (cancelled) return
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
        if (!entry) showToast(msg, 'error')
      })

    return () => { cancelled = true }
  }, [url, skip]) // eslint-disable-line

  // ── SSE-triggered re-fetch ───────────────────────────────────────────────
  // useSSE.js dispatches 'sse:data_changed' when the server reports a change.
  // If this hook's URL is in the invalidated list → silent background re-fetch.
  useEffect(() => {
    if (!url || skip) return

    const handler = (event) => {
      const urls = event.detail?.urls
      if (!Array.isArray(urls) || !urls.includes(url)) return

      // Cache was already invalidated by useSSE — just re-fetch silently
      fetchWithDedup(url)
        .then(res => setData(res.data))
        .catch(() => {})   // component already shows last-good data; ignore errors
    }

    window.addEventListener('sse:data_changed', handler)
    return () => window.removeEventListener('sse:data_changed', handler)
  }, [url, skip]) // eslint-disable-line

  // ── Manual trigger (POST, PATCH, DELETE) ─────────────────────────────────
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