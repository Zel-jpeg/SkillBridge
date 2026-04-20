// src/hooks/useSSE.js
//
// Singleton SSE (Server-Sent Events) connection manager.
//
// Why singleton?
//   If each admin hook (useAdminDashboard, useAdminUsers, useAdminCompanies)
//   created its own EventSource, we'd open 3 connections to the same URL.
//   Instead, one module-level connection is shared across all hooks for the
//   entire admin session.
//
// Flow:
//   1. Any admin hook calls useSSE('/api/admin/events/')
//   2. First call opens the EventSource connection (subsequent calls no-op)
//   3. Server sends { type: 'data_changed', invalidate: ['/api/admin/users/', ...] }
//   4. We invalidate those cache keys in useApi's cache
//   5. We dispatch 'sse:data_changed' on window
//   6. Every useApi instance listening for its URL re-fetches silently
//   7. Components re-render with fresh data — no page refresh needed
//
// Reconnect strategy: exponential backoff (1s → 2s → 4s → … → 30s max)
//
// Usage:
//   import { useSSE } from '../useSSE'
//   // inside any admin hook or component:
//   useSSE('/api/admin/events/')

import { useEffect } from 'react'
import { invalidateCache } from './useApi'

const BASE_URL = import.meta.env.VITE_API_URL ?? 'http://127.0.0.1:8000'

// ── Module-level singleton state ──────────────────────────────────────────────
let _es          = null       // EventSource instance
let _ssePath     = null       // path the singleton is connected to
let _retryDelay  = 1_000      // current backoff delay in ms
let _retryTimer  = null       // setTimeout handle for reconnect
let _started     = false      // true once startSSE() has been called


// ── Internal connect function ─────────────────────────────────────────────────

function _connect(path) {
  const token = localStorage.getItem('sb-token')
  if (!token) return   // not logged in — don't connect

  const url = `${BASE_URL}${path}?token=${encodeURIComponent(token)}`
  _es = new EventSource(url)

  _es.onopen = () => {
    _retryDelay = 1_000   // reset backoff on successful connect
  }

  _es.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data)

      if (data.type === 'data_changed' && Array.isArray(data.invalidate)) {
        // 1. Invalidate stale cache keys
        data.invalidate.forEach(u => invalidateCache(u))

        // 2. Notify all useApi instances via CustomEvent
        window.dispatchEvent(
          new CustomEvent('sse:data_changed', {
            detail: { urls: data.invalidate },
          })
        )
      }
      // 'connected' event and heartbeat comments are silently ignored
    } catch {
      // Malformed event — ignore
    }
  }

  _es.onerror = () => {
    // EventSource closed (network error, server restart, token expired, etc.)
    _es?.close()
    _es = null

    if (!_ssePath) return   // closeSSE() was called — don't reconnect

    // Schedule reconnect with exponential backoff
    clearTimeout(_retryTimer)
    _retryTimer = setTimeout(() => {
      _retryDelay = Math.min(_retryDelay * 2, 30_000)
      _connect(_ssePath)
    }, _retryDelay)
  }
}


// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Start the singleton SSE connection.
 * Safe to call multiple times — only opens one connection.
 */
export function startSSE(path) {
  if (_started && _ssePath === path) return
  _started  = true
  _ssePath  = path
  clearTimeout(_retryTimer)
  _connect(path)
}

/**
 * Permanently close the SSE connection and reset state.
 * Call this on logout (SessionContext.jsx already handles this).
 */
export function closeSSE() {
  _ssePath    = null
  _started    = false
  _retryDelay = 1_000
  clearTimeout(_retryTimer)
  _retryTimer = null
  _es?.close()
  _es = null
}

/**
 * React hook — call inside any admin hook or component to ensure
 * the singleton SSE connection is active.
 *
 * Example:
 *   useSSE('/api/admin/events/')
 */
export function useSSE(path) {
  useEffect(() => {
    startSSE(path)
    // Intentionally NOT closing on unmount.
    // The singleton should live for the entire admin session,
    // not die when a single component unmounts during navigation.
  }, [path])
}