// A topic describes changed saved data, never a command to recalculate it.
const paths = {
  email: [/^\/api\/instructor\/batches\/\d+\/(?:emails|email-progress)\/$/],
  users: [/^\/api\/admin\/(users|stats|batch-instructors)\/$/, /^\/api\/auth\/me\/$/],
  management: [/^\/api\/admin\/management-actions\/$/, /^\/api\/retake-requests\/$/, /^\/api\/assessments\/\d+\/retake-request\/$/],
  students: [/^\/api\/admin\/(users|stats|reports|students\/recommendations)\/$/, /^\/api\/instructor\/(students\/recommendations|batches\/\d+\/(?:students|unenrolled)|companies)\/$/, /^\/api\/students\/me\/$/, /^\/api\/nlp\/students\/\d+\/text\/$/],
  batches: [/^\/api\/instructor\/batches\/(?:\d+\/(?:students|unenrolled)\/)?$/, /^\/api\/admin\/(stats|reports|users)\/$/, /^\/api\/students\/me\/$/],
  assessments: [/^\/api\/assessments\/(?:active\/)?$/, /^\/api\/instructor\/assessments\/(?:\d+\/questions\/)?$/, /^\/api\/admin\/(stats|reports)\/$/],
  results: [/^\/api\/student\/(results\/(?:combined\/|review\/)?|companies\/)$/, /^\/api\/admin\/(reports|students\/recommendations|stats)\/$/, /^\/api\/instructor\/(students\/recommendations|companies)\/$/, /^\/api\/nlp\/students\/\d+\/text\/$/],
  catalog: [/^\/api\/(?:admin|instructor|student)\/companies\/$/, /^\/api\/nlp\/positions\/\d+\/text\/$/, /^\/api\/admin\/(stats|reports)\/$/],
  taxonomy: [/^\/api\/(categories|admin\/skills)\/$/, /^\/api\/nlp\/(students|positions)\/\d+\/text\/$/],
  placements: [/^\/api\/placements\/(?:(?:suggestions|draft)\/)?$/, /^\/api\/admin\/(placement-analytics|reports|stats|users)\/$/, /^\/api\/students\/me\/$/],
  capacity: [/^\/api\/placements\/(?:suggestions|draft)\/$/, /^\/api\/admin\/placement-analytics\/$/],
  configuration: [/^\/api\/admin\/nlp-configuration\/$/],
}

// Account/enrollment/ownership changes can revoke or alter email management too.
for (const topic of ['users', 'students', 'batches']) paths[topic].push(paths.email[0])

export function queryAffected(url, change) {
  const parsed = new URL(url, 'http://skillbridge.local')
  const path = parsed.pathname
  if (/^\/api\/admin\/users\/\d+\/history\/$/.test(path) && (change.resync || change.topics?.some(topic => ['users', 'students', 'batches', 'assessments', 'results', 'placements'].includes(topic)))) return true
  if (path === '/api/placements/draft/' && change.topics?.some(topic => ['students', 'batches', 'assessments', 'results', 'catalog', 'taxonomy', 'configuration'].includes(topic))) return true
  // Analytics includes shared capacity as well as scoped cohort data. A foreign
  // placement may consume a visible slot, so do not prune it by cohort IDs.
  if (path === '/api/management/analytics/') return Boolean(change.resync || change.urls?.some(url => new URL(url, parsed.origin).pathname === path) || change.topics?.some(topic => Object.hasOwn(paths, topic)))
  // Never subscribe attempt POSTs or generated snapshots to background GETs.
  if (change.resync) return Object.values(paths).flat().some(pattern => pattern.test(path))
  if (change.urls?.some(key => new URL(key, parsed.origin).pathname === path)) return true
  if (!change.topics?.some(topic => paths[topic]?.some(pattern => pattern.test(path)))) return false
  const batch = path.match(/\/batches\/(\d+)\//)?.[1] || parsed.searchParams.get('batch_id')
  const student = path.match(/\/nlp\/students\/(\d+)\//)?.[1] || parsed.searchParams.get('student_id')
  const assessment = path.match(/\/instructor\/assessments\/(\d+)\/questions\//)?.[1]
  if (batch && change.batch_ids?.length && !change.batch_ids.map(String).includes(batch)) return false
  if (student && change.student_ids?.length && !change.student_ids.map(String).includes(student)) return false
  if (assessment && change.assessment_ids?.length && !change.assessment_ids.map(String).includes(assessment)) return false
  return true
}

export function invalidateQueries(cache, change, visible, onError = () => {}) {
  const affected = cache.urls().filter(url => queryAffected(url, change))
  affected.forEach(url => cache.invalidate(url))
  if (visible) affected.filter(url => cache.hasSubscribers(url))
    .forEach(url => cache.fetch(url).catch(onError))
  return affected
}
