import { externalJson } from './externalServices.js'
import { validPin } from './recommendationResults.js'

export const ROUTING_ORIGIN = 'https://router.project-osrm.org'
let nextStart = 0
let starts = Promise.resolve()

function wait(ms, signal) {
  return new Promise((resolve, reject) => {
    let timer
    const aborted = () => { clearTimeout(timer); signal?.removeEventListener('abort', aborted); reject(new Error('Route cancelled')) }
    if (signal?.aborted) { aborted(); return }
    signal?.addEventListener('abort', aborted, { once: true })
    timer = setTimeout(() => { signal?.removeEventListener('abort', aborted); resolve() }, Math.max(0, ms))
  })
}

export function roadRouteUrl(from, to) {
  if (!validPin(from?.lat, from?.lng) || !validPin(to?.lat, to?.lng)) throw new Error('Valid saved pins are required')
  return `${ROUTING_ORIGIN}/route/v1/driving/${Number(from.lng)},${Number(from.lat)};${Number(to.lng)},${Number(to.lat)}?overview=full&geometries=geojson&steps=false&alternatives=false&generate_hints=false&radiuses=1500;1500`
}

export function parseRoadRoute(data) {
  const route = data?.routes?.[0]
  const points = route?.geometry?.coordinates
  if (data?.code !== 'Ok' || route?.geometry?.type !== 'LineString' || !Array.isArray(points) ||
    points.length < 2 || points.length > 50_000 || !Number.isFinite(route.distance) || route.distance < 0 ||
    !Number.isFinite(route.duration) || route.duration < 0 ||
    points.some(point => !Array.isArray(point) || point.length !== 2 || point.some(value => typeof value !== 'number') || !validPin(point[1], point[0]))) {
    throw new Error('A driving route is not available')
  }
  return { points: points.map(([lng, lat]) => [lat, lng]), distanceKm: route.distance / 1000, minutes: Math.max(1, Math.round(route.duration / 60)) }
}

export async function requestRoadRoute(from, to, { signal, timeoutMs = 8000 } = {}) {
  const url = roadRouteUrl(from, to)
  // The public demo permits one request per second. Queue starts, not whole reads.
  const turn = starts.then(async () => {
    await wait(nextStart - performance.now(), signal)
    if (signal?.aborted) throw new Error('Route cancelled')
    nextStart = performance.now() + 1100
  })
  starts = turn.catch(() => {})
  await turn
  return parseRoadRoute(await externalJson(url, { signal, timeoutMs, credentials: 'omit', referrerPolicy: 'no-referrer', redirect: 'error' }))
}
