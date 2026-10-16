import axios from 'axios'
import { isAuthenticationRequest } from './authHeaders'

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL ?? 'http://127.0.0.1:8000',
})

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
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

api.interceptors.response.use(response => response, error => {
  if (error.response?.status === 401 && error.config?._sbToken === localStorage.getItem('sb-token') && !isAuthenticationRequest(error.config?.url)) {
    window.dispatchEvent(new Event('auth:expired'))
  }
  return Promise.reject(error)
})



export default api
