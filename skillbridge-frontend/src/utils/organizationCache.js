import { ORGANIZATION_OPTIONS } from './organizationScope.js'

// A successful write supplies the authoritative row. Keep the current page
// while its normal GET reconciles ordering, filter membership and totals.
export function publishOrganizationRecord(cache, detailUrl, saved) {
  const scope = detailUrl.match(/^\/api\/admin\/institutes\/(\d+)\/(?:programs\/(\d+)\/)?$/)
  if (!scope || saved.id !== Number(scope[2] || scope[1])) return
  const program = Boolean(scope[2])
  const listPath = detailUrl.replace(/\d+\/$/, '')
  cache.publish(detailUrl, saved)
  for (const url of cache.urls()) {
    if (new URL(url, 'http://skillbridge.local').pathname !== listPath) continue
    const page = cache.read(url)?.data
    if (page?.results?.some(row => row.id === saved.id)) {
      cache.publish(url, { ...page, results: page.results.map(row => row.id === saved.id ? { ...row, ...saved } : row) })
    }
  }
  const options = cache.read(ORGANIZATION_OPTIONS)?.data
  if (options) cache.publish(ORGANIZATION_OPTIONS, {
    ...options,
    institutes: program ? options.institutes : options.institutes.map(row => row.id === saved.id ? { ...row, ...saved } : row),
    programs: options.programs.map(row => program
      ? row.id === saved.id ? { ...row, ...saved } : row
      : row.institute_id === saved.id ? { ...row, institute_name: saved.name, institute_code: saved.code } : row),
  })
  const programUrl = program ? `/api/management/competency-programs/${saved.id}/` : null
  const currentProgram = programUrl && cache.read(programUrl)?.data
  if (currentProgram) cache.publish(programUrl, { ...currentProgram, ...saved })
}
