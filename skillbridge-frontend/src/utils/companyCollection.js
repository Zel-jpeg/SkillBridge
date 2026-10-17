export const positionDisclosureKey = (companyId, positionId) => `${companyId}:${positionId}`

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
