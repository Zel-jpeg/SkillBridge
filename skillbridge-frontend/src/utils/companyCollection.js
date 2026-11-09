export const positionDisclosureKey = (companyId, positionId) => `${companyId}:${positionId}`

export function positionRequirementRows(position) {
  if (position.category_requirements?.length) return position.category_requirements
  return Object.entries(position.requirements || {}).map(([name, percentage]) => ({ name, percentage }))
}

export function coordinatorPositionRequest(values, initial, reuse = false) {
  const result = { title: values.title, description: values.description, slots: values.slots, tags: values.tags }
  if (initial?.can_edit_requirements !== false) {
    if (initial?.shared_institute && !initial.eligibility_configured) result.requirements = values.requirements || {}
    else result.category_requirements = values.category_requirements || []
  }
  if (!initial && reuse) result.reuse_existing = true
  return result
}

export function coordinatorCompanyCard(row) {
  const addressParts = row.address && typeof row.address === 'object' ? row.address : null
  return { ...row, addressParts,
    address: addressParts ? ['street', 'barangay', 'city', 'province'].map(key => addressParts[key]).filter(Boolean).join(', ') : row.address,
  }
}

export function companyDisclosures(state, action) {
  if (action.type === 'toggle') {
    const next = new Set(state)
    if (next.has(action.key)) next.delete(action.key)
    else next.add(action.key)
    return next
  }
  if (action.type === 'reconcile') {
    const existing = new Set(action.companies.flatMap(company => company.positions.map(position => positionDisclosureKey(company.id, position.id))))
    const next = new Set([...state].filter(key => existing.has(key)))
    return next.size === state.size ? state : next
  }
  return state
}

export function companyLocation(company) {
  const location = [company.addressParts?.city, company.addressParts?.province].filter(Boolean).join(' · ')
  return location || (company.address && company.address !== 'No address set' ? 'View address' : 'No address set')
}
