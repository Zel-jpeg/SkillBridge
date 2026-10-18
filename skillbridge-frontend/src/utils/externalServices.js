import { validPin } from './recommendationResults.js'

export const EXTERNAL_TIMEOUT_MS = 8000

// Bound even a provider which never completes. Abort on timeout or unmount;
// callers keep their own drafts and last-good data.
export async function externalJson(url, { signal, timeoutMs = EXTERNAL_TIMEOUT_MS, ...options } = {}) {
  const controller = new AbortController()
  let timer, onAbort
  const cancelled = new Promise((_, reject) => {
    onAbort = () => { controller.abort(); reject(new Error('External request cancelled')) }
    if (signal?.aborted) onAbort()
    else signal?.addEventListener('abort', onAbort, { once: true })
    timer = setTimeout(onAbort, timeoutMs)
  })
  try {
    return await Promise.race([
      (async () => {
        const response = await fetch(url, { ...options, signal: controller.signal })
        if (!response.ok) throw new Error('External service unavailable')
        return response.json()
      })(), cancelled,
    ])
  } finally {
    clearTimeout(timer)
    signal?.removeEventListener('abort', onAbort)
  }
}

export async function geocodeAddress({ barangay, city, province }, {
  fallbackView = { lat: 7.3072, lng: 125.6839 }, cityFallback = false, ...options
} = {}) {
  const zoom = barangay ? 17 : city ? 15 : 12
  const query = [barangay, city, province, 'Philippines'].filter(Boolean).join(', ')
  try {
    const data = await externalJson(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=1`, options)
    const hit = Array.isArray(data) && data[0]
    const pin = hit && validPin(hit.lat, hit.lon)
    if (pin) return { ...pin, zoom, approximate: false }
    if (cityFallback && barangay && city && Array.isArray(data) && data.length === 0) {
      return geocodeAddress({ city, province }, { ...options, fallbackView })
    }
  } catch { /* A default view never becomes a saved pin or distance evidence. */ }
  return { ...fallbackView, zoom: 12, approximate: true }
}

let leafletPromise = null
export function loadLeaflet({ timeoutMs = EXTERNAL_TIMEOUT_MS } = {}) {
  if (window.L?.map && window.L?.tileLayer) return Promise.resolve(window.L)
  if (leafletPromise) return leafletPromise
  leafletPromise = new Promise((resolve, reject) => {
    const link = document.createElement('link')
    link.rel = 'stylesheet'
    link.href = 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.css'
    const script = document.createElement('script')
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.js'
    let scriptReady = false, cssReady = false, settled = false
    const finish = error => {
      if (settled) return
      if (!error && (!scriptReady || !cssReady)) return
      settled = true
      clearTimeout(timer)
      script.onload = script.onerror = link.onload = link.onerror = null
      if (error) { if (scriptReady) delete window.L; script.remove(); link.remove(); reject(new Error('Map unavailable')) }
      else resolve(window.L)
    }
    const timer = setTimeout(() => finish(true), timeoutMs)
    script.onload = () => { scriptReady = Boolean(window.L?.map && window.L?.tileLayer); finish(!scriptReady) }
    link.onload = () => { cssReady = true; finish(false) }
    script.onerror = link.onerror = () => finish(true)
    document.head.append(link, script)
  }).catch(error => { leafletPromise = null; throw error })
  return leafletPromise
}
