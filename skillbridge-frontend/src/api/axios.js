import axios from 'axios'
import { isAuthenticationRequest } from './authHeaders'
import { createSessionRenewal, readBrowserSession } from './sessionRenewal'
import { validateApiResponse } from './responseContract'
import { sanitizeApiError } from './requestErrors'

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL ?? 'http://127.0.0.1:8000',
  timeout: 30000,
})
const authClient = axios.create({ baseURL: api.defaults.baseURL, timeout: 15000 })
const renewal = createSessionRenewal({
  read: readBrowserSession,
  exchange: async refresh => (await authClient.post('/api/auth/refresh/', { refresh })).data,
  accept: access => {
    localStorage.setItem('sb-token', access)
    window.dispatchEvent(new Event('auth:renewed'))
  },
  expired: () => window.dispatchEvent(new Event('auth:expired')),
})
export function renewAccessToken() { return renewal.renew(readBrowserSession()) }

// Attach JWT token to every request automatically
api.interceptors.request.use(config => {
  // A stale access token must not block sign-in or token renewal before the
  // credentials in the new request can be checked by Django.
  if (isAuthenticationRequest(config.url)) {
    delete config.headers.Authorization
    return config
  }
  const token = config._sbToken ?? localStorage.getItem('sb-token')
  config._sbToken = token
  config._sbSession ??= { ...readBrowserSession(), token }
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

api.interceptors.response.use(response => {
  if (response.config._sbSession && response.config._sbSession.id !== readBrowserSession().id) {
    throw Object.assign(new Error('Authenticated session changed'), { staleIdentity: true, code: 'ERR_CANCELED' })
  }
  return validateApiResponse(response)
}, async error => {
  sanitizeApiError(error)
  const config = error.config
  if (error.response?.status !== 401 || !config?._sbToken || isAuthenticationRequest(config.url)) throw error
  if (config._sbRetried) {
    if (readBrowserSession().id === config._sbSession?.id && config._sbToken === localStorage.getItem('sb-token')) {
      window.dispatchEvent(new Event('auth:expired'))
    }
    throw error
  }
  // DRF rejects authentication before executing a view. Network/timeouts and
  // server errors never enter this branch and never trigger mutation replay.
  const access = await renewal.renew(config._sbSession)
  config._sbRetried = true
  config._sbToken = access
  config.headers.Authorization = `Bearer ${access}`
  return api.request(config)
})



export default api
