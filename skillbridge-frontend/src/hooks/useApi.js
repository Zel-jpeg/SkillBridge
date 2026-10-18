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
//   • Mounted queries refresh every 30 seconds while visible and on tab return.
//     SSE events also invalidate specific keys immediately.
//   • Call invalidateCache(url) after mutations so the next GET is fresh.
//
// ── SSE integration ──────────────────────────────────────────────────────────
//   • useSSE.js applies coalesced topic/path invalidation to the shared store.
//   • Mounted parameter variants refetch; unmounted entries become stale.
//   • Cache subscribers update without duplicate per-hook event requests.
//   • Legacy local mutation URL events remain supported below.
//
// Usage — one-time fetch on mount:
//   const { data, loading, error } = useApi('/api/students/me/')
//
// Usage — manual trigger (forms, mutations):
//   const { request, loading } = useApi()
//   await request('patch', '/api/students/me/profile/', { phone: '...' })

import { useState, useEffect, useCallback } from 'react'
import api from '../api/axios'
import { queryStore as cache, CACHE_TTL } from '../api/queryStore.js'
import { startVisibleRefresh } from '../api/queryRefresh'
import { invalidateQueries } from '../api/queryInvalidation'
import { useToast } from '../context/ToastContext'
import { useSession } from '../context/SessionContext'
import { friendlyStatus, requestErrorMessage } from '../api/requestErrors'

// ── Cache constants ───────────────────────────────────────────────────────────

/** Publish a mutation response to mounted consumers without another request. */
export function updateCachedData(url, data) {
  cache.publish(url, data)
}

export function getCachedData(url) {
  return cache.read(url)?.data ?? null
}

// ── Public cache utilities ────────────────────────────────────────────────────

/** Call after mutations to force the next GET to bypass the cache. */
export function invalidateCache(url) {
  // URL paths invalidate all parameter variants, including persisted entries.
  cache.invalidate(url)
  invalidateQueries(cache, { urls: [url] }, document.visibilityState === 'visible')
}

/** Apply one coalesced server invalidation to mounted and persisted queries. */
export function applyDataChange(change) {
  const urls = invalidateQueries(cache, change, document.visibilityState === 'visible', error => {
    if (!error.staleIdentity && error.response?.status === 401) window.dispatchEvent(new Event('auth:expired'))
  })
  window.dispatchEvent(new CustomEvent('sse:data_changed', { detail: { ...change, urls, handled: true } }))
}

/** Wipe the entire cache — call on logout. */
export function clearAllCache() {
  cache.clear()
}

/**
 * Write a value directly into the cache (used by the prefetch service).
 * Skips the write if the URL already has a fresh entry so a fast component
 * useEffect response doesn't get overwritten by a slow prefetch.
 */
export function _setCache(url, data) {
  const existing = cache.read(url)
  if (existing && (Date.now() - existing.fetchedAt < CACHE_TTL)) return
  updateCachedData(url, data)
}

/**
 * Deduplicated fetch — if the same URL is already in-flight, return the
 * existing Promise so we don't fire duplicate requests.
 */
export function fetchWithDedup(url) {
  return cache.fetch(url)
}

// ── Friendly error messages ───────────────────────────────────────────────────
function friendlyError(status) {
  return friendlyStatus(status)
}

// ── Main hook ─────────────────────────────────────────────────────────────────
export function useApi(url, { skip = false, initialData = null } = {}) {
  const { showToast }             = useToast()
  const { triggerSessionExpired, expired } = useSession()

  // ── Seed state from cache (in-memory → sessionStorage → null) ────────────
  const seed = url && !skip ? cache.read(url) : null

  const [result, setResult] = useState({ url, data: seed?.data ?? initialData })
  const data = result.url === url ? result.data : seed?.data ?? initialData
  const setData = useCallback(value => setResult(previous => ({
    url,
    data: typeof value === 'function' ? value(previous.url === url ? previous.data : null) : value,
  })), [url])
  const [loading, setLoading] = useState(!!url && !skip && !seed && !initialData)
  const [error,   setError]   = useState(null)
  const [errorStatus, setErrorStatus] = useState(null)

  useEffect(() => {
    if (!url || skip || expired) return
    return cache.subscribe(url, (value, err) => {
      setResult({ url, data: value })
      setError(err ? friendlyError(err.response?.status) : null)
      setErrorStatus(err?.response?.status ?? null)
    })
  }, [url, skip, expired])

  // ── Auto-fetch on mount ──────────────────────────────────────────────────
  useEffect(() => {
    if (!url || skip || expired) return
    let cancelled = false

    const entry = cache.read(url)
    const isFresh = entry && (Date.now() - entry.fetchedAt < CACHE_TTL)

    // Fresh cache → nothing to do
    if (isFresh) {
      // Ensure state is populated even if the component mounted after a refresh
      // Preserve synchronous cache seeding for existing hook consumers.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (entry) setData(entry.data)
      setLoading(false)
      return
    }

    const priorError = cache.error(url)
    if (!entry && priorError) {
      // Reuse a completed route/preparation failure instead of immediately
      // issuing the same failed read again as the page mounts. Route intent,
      // explicit retry and live reconciliation can initiate another request.
      setError(priorError.response?.data?.error || priorError.response?.data?.detail || friendlyError(priorError.response?.status))
      setErrorStatus(priorError.response?.status ?? null)
      setLoading(false)
      return
    }

    if (entry || initialData) {
      // Stale data exists or initialData provided → show it + refresh quietly in background
      setData(entry?.data ?? initialData)
      setLoading(false)
    } else {
      // No cache and no initialData → show spinner
      setLoading(true)
    }
    if (!entry && !initialData) setError(null)

    fetchWithDedup(url)
      .then(res => {
        if (cancelled) return
        if (cache.read(url)?.data === res.data) setData(res.data)
        setLoading(false)
        setError(null)
      })
      .catch(err => {
        if (cancelled || err.staleIdentity || err.code === 'ERR_CANCELED') return
        setLoading(false)
        const status = err.response?.status
        setErrorStatus(status ?? null)

        if (status === 401) {
          triggerSessionExpired()
          return
        }

        const msg = requestErrorMessage(err)
        if (!cache.read(url) && !initialData) setError(msg)
        // 409 = intentional "conflict" state (e.g. already submitted assessment)
        // The consuming component handles this with its own UI — skip the generic toast.
        if (!entry && status !== 409) showToast(msg, 'error')
      })

    return () => { cancelled = true }
  }, [url, skip, expired]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── SSE-triggered re-fetch ───────────────────────────────────────────────
  // useSSE.js dispatches 'sse:data_changed' when the server reports a change.
  // If this hook's URL is in the invalidated list → silent background re-fetch.
  useEffect(() => {
    if (!url || skip || expired) return

    const handler = (event) => {
      const urls = event.detail?.urls
      if (event.detail?.handled || !Array.isArray(urls) || !urls.includes(url)) return

      // Cache was already invalidated by useSSE — just re-fetch silently
      fetchWithDedup(url)
        .catch(err => { if (!err.staleIdentity && err.response?.status === 401) triggerSessionExpired() })
    }

    window.addEventListener('sse:data_changed', handler)
    return () => window.removeEventListener('sse:data_changed', handler)
  }, [url, skip, expired, triggerSessionExpired])

  // Mounted queries alone refresh. Hidden tabs neither poll nor start return
  // requests until visible again; the store deduplicates all other triggers.
  useEffect(() => {
    if (!url || skip || expired) return
    return startVisibleRefresh(url, {
      documentTarget: document,
      windowTarget: window,
      read: key => cache.read(key),
      revalidate: key => {
        if ([403, 404].includes(cache.error(key)?.response?.status)) return
        fetchWithDedup(key).catch(err => { if (!err.staleIdentity && err.response?.status === 401) triggerSessionExpired() })
      },
      intervalMs: CACHE_TTL,
    })
  }, [url, skip, expired, triggerSessionExpired])

  // ── Manual trigger (POST, PATCH, DELETE) ─────────────────────────────────
  const request = useCallback(async (method, endpoint, payload, { silentError = false } = {}) => {
    const requestToken = localStorage.getItem('sb-token')
    if (!url || !cache.read(url)) setLoading(true)
    setError(null)
    try {
      const res = await api[method](endpoint, payload)
      setLoading(false)
      return { ok: true, data: res.data }
    } catch (err) {
      setLoading(false)
      const status = err.response?.status

      if (status === 401) {
        if (requestToken === localStorage.getItem('sb-token')) triggerSessionExpired()
        return { ok: false, status }
      }

      const msg = requestErrorMessage(err, { mutation: !['get', 'head', 'options'].includes(method.toLowerCase()) })
      setError(msg)
      if (!silentError) showToast(msg, 'error')
      return { ok: false, status, message: msg, raw: err.response?.data }
    }
  }, [showToast, triggerSessionExpired, url])

  return { data, loading, error, errorStatus, request, setData }
}
