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
  const token = localStorage.getItem('sb-token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})



export default api
