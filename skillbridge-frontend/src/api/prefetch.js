import { queryStore as cache } from './queryStore.js'
import { createPreparationQueue } from './preparationQueue.js'
import { preloadPage } from '../router/preloadPage.js'

// Safe list/reference GETs only; no operations, reviews, rosters or reports.
export const DESTINATION_QUERIES = {
  '/student/dashboard': ['/api/students/me/', '/api/assessments/', '/api/student/results/combined/'],
  '/student/assessments': ['/api/assessments/'],
  '/student/results': ['/api/student/results/combined/'],
  '/student/profile': ['/api/students/me/'],
  '/instructor/students': ['/api/instructor/batches/'],
  '/instructor/assessments': ['/api/instructor/assessments/', '/api/instructor/batches/'],
  '/instructor/companies': ['/api/instructor/companies/'],
  '/admin/assessments': ['/api/instructor/assessments/'],
  '/admin/batches': ['/api/instructor/batches/'],
  '/admin/skills': ['/api/admin/skills/'],
  '/admin/companies': ['/api/admin/companies/'],
}
const LIKELY = {
  student: ['/student/assessments', '/student/results', '/student/profile'],
  instructor: ['/instructor/students', '/instructor/assessments', '/instructor/companies'],
  admin: ['/admin/assessments', '/admin/skills', '/admin/companies'],
}
const PLACEMENT_QUERIES = ['/api/placements/suggestions/?include_history=true&include_placed=true', '/api/placements/?limit=500']
const PAGE_QUERIES = {
  ...DESTINATION_QUERIES,
  '/student/results': ['/api/student/results/combined/', '/api/students/me/'],
  '/instructor/dashboard': ['/api/instructor/students/recommendations/', '/api/instructor/assessments/'],
  '/instructor/assessment/create': ['/api/instructor/batches/', '/api/instructor/assessments/', '/api/categories/'],
  '/admin/assessment/create': ['/api/instructor/batches/', '/api/instructor/assessments/', '/api/categories/'],
  '/admin/batches': ['/api/instructor/batches/', '/api/admin/batch-instructors/'],
  '/instructor/placements': PLACEMENT_QUERIES,
  '/admin/dashboard': ['/api/admin/stats/', '/api/admin/students/recommendations/'],
  '/admin/users': ['/api/admin/users/'],
  '/admin/placements': PLACEMENT_QUERIES,
  '/admin/reports': ['/api/admin/reports/', '/api/admin/placement-analytics/', '/api/admin/nlp-configuration/'],
}

function identity() {
  const token = localStorage.getItem('sb-token'), role = localStorage.getItem('sb-role')
  let user
  try { user = JSON.parse(localStorage.getItem('sb-user')) } catch { return null }
  if (!token || !user?.id || user.role !== role || !LIKELY[role]) return null
  if ((role !== 'admin' && !user.is_approved) || (role === 'student' && !user.phone)) return null
  return `${role}:${user.id}:${token}`
}

// Start only this destination's safe essential GETs while its code loads.
// Mounted hooks share these requests. Setup, consent/attempt actions and review
// keys are deliberately excluded; the server still authorizes every request.
export function loadDestination(pathname) {
  if (!identity()) return
  const role = localStorage.getItem('sb-role')
  if (!pathname.startsWith(`/${role}/`)) return
  const result = role === 'student' && pathname.match(/^\/student\/assessments\/(\d+)\/results$/)
  const urls = result ? [`/api/student/results/?assessment_id=${result[1]}`] : PAGE_QUERIES[pathname] ?? []
  urls.forEach(url => {
    const entry = cache.read(url)
    if (!entry || Date.now() - entry.fetchedAt >= 30_000) {
      if (![403, 404].includes(cache.error(url)?.response?.status)) cache.fetch(url).catch(() => {})
    }
  })
}

const queue = createPreparationQueue({
  identity,
  visible: () => document.visibilityState === 'visible',
  ready: cache.foregroundReady,
  read: cache.read,
  allowed: url => ![403, 404].includes(cache.error(url)?.response?.status),
  fetch: cache.fetch,
  prepare: url => {
    const role = localStorage.getItem('sb-role')
    const destination = LIKELY[role]?.find(path => DESTINATION_QUERIES[path]?.includes(url))
    // Prepare one likely page's code alongside its GET, after current content.
    // A mounted consumer still receives the GET as soon as it finishes.
    return preloadPage(destination)
  },
  abort: cache.abortUnobserved,
  // Let React commit completed sections before optional requests start.
  schedule: callback => {
    const handle = {}
    handle.first = requestAnimationFrame(() => { handle.second = requestAnimationFrame(callback) })
    return handle
  },
  cancel: handle => { cancelAnimationFrame(handle.first); cancelAnimationFrame(handle.second) },
})
let detach = null

export function prepareNavigation(role, pathname) {
  if (!identity() || !pathname.startsWith(`/${role}/`)) return () => {}
  const changedIdentity = () => queue.reset()
  const unsubscribe = cache.observe(queue.wake)
  document.addEventListener('visibilitychange', queue.wake)
  window.addEventListener('storage', changedIdentity)
  detach = () => {
    unsubscribe()
    document.removeEventListener('visibilitychange', queue.wake)
    window.removeEventListener('storage', changedIdentity)
    const nextPath = window.location.pathname
    queue.pause({ abortActive: !nextPath.startsWith(`/${role}/`) || /\/(take|setup|pending)$/.test(nextPath) })
    detach = null
  }
  queue.start((LIKELY[role] ?? []).flatMap(path => DESTINATION_QUERIES[path] ?? []))
  queue.enqueue(DESTINATION_QUERIES[pathname] ?? [], true)
  return detach
}

export function promoteDestination(pathname) {
  queue.enqueue(DESTINATION_QUERIES[pathname] ?? [], true)
}

export function resetPrefetch() {
  detach?.()
  queue.reset()
}
