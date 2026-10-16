// A topic describes changed saved data, never a command to recalculate it.
const paths = {
  users: [/^\/api\/admin\/(users|stats)\/$/, /^\/api\/auth\/me\/$/],
  students: [/^\/api\/admin\/(users|stats|reports|students\/recommendations)\/$/, /^\/api\/instructor\/(students\/recommendations|batches\/\d+\/students|companies)\/$/, /^\/api\/students\/me\/$/, /^\/api\/nlp\/students\/\d+\/text\/$/],
  batches: [/^\/api\/instructor\/batches\/(?:\d+\/students\/)?$/, /^\/api\/admin\/(stats|reports|users)\/$/, /^\/api\/students\/me\/$/],
  assessments: [/^\/api\/assessments\/(?:active\/)?$/, /^\/api\/instructor\/assessments\/(?:\d+\/questions\/)?$/, /^\/api\/admin\/(stats|reports)\/$/],
  results: [/^\/api\/student\/(results\/(?:combined\/|review\/)?|companies\/)$/, /^\/api\/admin\/(reports|students\/recommendations|stats)\/$/, /^\/api\/instructor\/(students\/recommendations|companies)\/$/, /^\/api\/nlp\/students\/\d+\/text\/$/],
  catalog: [/^\/api\/(?:admin|instructor|student)\/companies\/$/, /^\/api\/nlp\/positions\/\d+\/text\/$/, /^\/api\/admin\/(stats|reports)\/$/],
  taxonomy: [/^\/api\/(categories|admin\/skills)\/$/, /^\/api\/nlp\/(students|positions)\/\d+\/text\/$/],
  placements: [/^\/api\/placements\/(?:suggestions\/)?$/, /^\/api\/admin\/(placement-analytics|reports|stats|users)\/$/, /^\/api\/students\/me\/$/],
  capacity: [/^\/api\/placements\/suggestions\/$/, /^\/api\/admin\/placement-analytics\/$/],
  configuration: [/^\/api\/admin\/nlp-configuration\/$/],
}

export function queryAffected(url, change) {
  const parsed = new URL(url, 'http://skillbridge.local')
  const path = parsed.pathname
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
