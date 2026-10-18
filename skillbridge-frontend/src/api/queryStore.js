// One store for mounted consumers, live invalidation and optional preparation.
import api from './axios'
import { createCacheStore } from './cacheStore.js'
import { validateApiResponse } from './responseContract.js'

export const CACHE_TTL = 30_000
export const queryStore = createCacheStore(
  (url, options) => api.get(url, options),
  globalThis.sessionStorage,
  () => {
    let id = ''
    try { id = JSON.parse(localStorage.getItem('sb-user'))?.id ?? '' } catch { /* Invalid identity. */ }
    return `${localStorage.getItem('sb-role') ?? ''}:${id}`
  },
  (url, data) => validateApiResponse({ data, status: 200, config: { url, method: 'get' } }),
)
