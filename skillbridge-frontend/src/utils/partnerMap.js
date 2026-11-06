import { scopedPartners } from './organizationScope.js'
import { validPin } from './recommendationResults.js'

const colors = ['#047857', '#1d4ed8', '#7e22ce', '#be123c', '#b45309', '#0e7490', '#4338ca', '#a21caf', '#4d7c0f', '#c2410c', '#0f766e', '#6d28d9']
export const SHARED_MAP_COLOR = '#475569'
export const UNASSIGNED_MAP_COLOR = '#64748b'

export function instituteMapColor(id, options) {
  const index = (options?.institutes || []).map(row => Number(row.id)).sort((a, b) => a - b).indexOf(Number(id))
  return index < 0 ? UNASSIGNED_MAP_COLOR : colors[index % colors.length]
}

export function partnerMembership(company, options) {
  const programs = new Map((options.programs || []).map(row => [Number(row.id), row]))
  const programIds = new Set()
  if (company.management_program_id) programIds.add(Number(company.management_program_id))
  const instituteIds = new Set()
  const shared = options.institutes?.find(row => row.id === options.shared_skill_institute_id)
    || options.institutes?.find(row => row.code === 'IC' || row.name.toLowerCase() === 'institute of computing')
  let icShared = false
  for (const position of company.positions || []) {
    if (position.archived_at) continue
    if (position.management_program_id) programIds.add(Number(position.management_program_id))
    for (const program of position.eligible_programs || []) {
      programs.set(Number(program.id), programs.get(Number(program.id)) || program)
      programIds.add(Number(program.id))
    }
    if (!position.eligibility_configured && !position.management_program_id && !position.eligible_programs?.length && shared) {
      instituteIds.add(shared.id); icShared = true
    }
  }
  const relatedPrograms = [...programIds].map(id => programs.get(id)).filter(Boolean)
  relatedPrograms.forEach(row => instituteIds.add(row.institute_id))
  return { programs: relatedPrograms, institutes: (options.institutes || []).filter(row => instituteIds.has(row.id)), icShared }
}

export function partnerMapData(companies, options, scope, status = 'active') {
  const institutes = options?.institutes || []
  const institute = institutes.find(row => String(row.id) === scope.institute)
  const program = options?.programs?.find(row => String(row.id) === scope.program && row.institute_id === institute?.id)
  const invalid = Boolean(scope.institute && !institute || scope.program && !program)
  if (!options || invalid) return { rows: [], mapped: [], missing: 0, legend: [], invalid }
  const active = companies.filter(row => status === 'all' || (status === 'archived' ? Boolean(row.archived_at) : !row.archived_at))
    .map(row => ({ ...row, positions: (row.positions || []).filter(position => !position.archived_at) }))
  const rows = scopedPartners(active, scope, options).map(row => {
    const original = active.find(company => company.id === row.id)
    const membership = partnerMembership(original, options)
    const relevant = institute ? [institute] : membership.institutes
    const label = relevant.length > 1 ? 'Shared' : relevant[0]?.code || 'Unassigned'
    const color = relevant.length > 1 ? SHARED_MAP_COLOR : instituteMapColor(relevant[0]?.id, options)
    const countsKnown = row.positions.every(position => Number.isFinite(position.remaining_slots))
    return { ...row, ...membership, pin: validPin(row.lat, row.lng), markerLabel: label, color,
      remaining: countsKnown ? row.positions.reduce((total, position) => total + position.remaining_slots, 0) : null }
  })
  const mapped = rows.filter(row => row.pin)
  const legendIds = new Set(mapped.flatMap(row => row.institutes.map(item => item.id)))
  const legend = institutes.filter(row => (!institute || row.id === institute.id) && legendIds.has(row.id))
    .map(row => ({ ...row, color: instituteMapColor(row.id, options) }))
  return { rows, mapped, missing: rows.length - mapped.length, legend, invalid }
}

export function mapAddress(value) {
  return typeof value === 'string' ? value : [value?.street, value?.barangay, value?.city || value?.municipality, value?.province].filter(Boolean).join(', ')
}

// One marker for each saved coordinate; overlapping partners remain individually
// named in the popup rather than hiding each other or inventing new coordinates.
export function groupPartnerPins(rows) {
  const groups = new Map()
  for (const row of rows) {
    const key = `${row.pin.lat}:${row.pin.lng}`
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key).push(row)
  }
  return [...groups.values()]
}
