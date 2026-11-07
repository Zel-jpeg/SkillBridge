// One store for mounted consumers, live invalidation and optional preparation.
import api from './axios'
import { createCacheStore } from './cacheStore.js'
import { validateApiResponse } from './responseContract.js'
import { ANALYTICS_URL } from '../utils/analytics.js'

export const CACHE_TTL = 30_000
export const queryStore = createCacheStore(
  async (url, options) => {
    try {
      return await api.get(url, options)
    } catch (error) {
      // During a staggered release, older APIs reject the new view parameter.
      // Preserve the same scope and let the store validate the full response.
      const [path, query] = url.split('?')
      const params = new URLSearchParams(query)
      if (path !== ANALYTICS_URL || params.get('view') !== 'overview' || options.signal?.aborted ||
          error.response?.status !== 400 || error.response.data?.error !== 'Unsupported or repeated analytics filter.') throw error
      params.delete('view')
      return api.get(`${path}?${params}`, options)
    }
  },
  globalThis.sessionStorage,
  () => {
    let id = ''
    try { id = JSON.parse(localStorage.getItem('sb-user'))?.id ?? '' } catch { /* Invalid identity. */ }
    return `${localStorage.getItem('sb-role') ?? ''}:${id}`
  },
  (url, data) => validateApiResponse({ data, status: 200, config: { url, method: 'get' } }),
)
