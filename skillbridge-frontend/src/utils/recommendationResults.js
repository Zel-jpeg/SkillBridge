export function validPin(lat, lng) {
  if ([lat, lng].some(value => value == null || typeof value === 'boolean' ||
    !['string', 'number'].includes(typeof value) || String(value).trim() === '')) return null
  lat = Number(lat)
  lng = Number(lng)
  return Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180 ? { lat, lng } : null
}

export function haversineKm(lat1, lng1, lat2, lng2) {
  if (!validPin(lat1, lng1) || !validPin(lat2, lng2)) return null
  const radians = degrees => degrees * Math.PI / 180
  const a = Math.sin(radians(lat2 - lat1) / 2) ** 2 +
    Math.cos(radians(lat1)) * Math.cos(radians(lat2)) * Math.sin(radians(lng2 - lng1) / 2) ** 2
  return 6371 * 2 * Math.asin(Math.sqrt(Math.min(1, Math.max(0, a))))
}

export function enrichRecommendation(row, studentPin) {
  const pin = validPin(row.lat, row.lng)
  const localDistance = studentPin && pin ? haversineKm(studentPin.lat, studentPin.lng, pin.lat, pin.lng) : null
  const distance = typeof row.distance_km === 'number' && Number.isFinite(row.distance_km) && row.distance_km >= 0 ? row.distance_km : localDistance
  return { ...row, lat: pin?.lat ?? null, lng: pin?.lng ?? null, match: row.match_score,
    combined: row.match_score, distKm: distance, proximityPct: row.location_score_component ?? null }
}

export function sortRecommendations(rows, mode = 'match') {
  return [...rows].sort((left, right) => {
    const distanceOrder = (left.distKm ?? Infinity) - (right.distKm ?? Infinity)
    if (mode === 'distance' && distanceOrder && !Number.isNaN(distanceOrder)) return distanceOrder
    return right.match_score - left.match_score || (left.position_id ?? left.id) - (right.position_id ?? right.id)
  })
}

// Each company is represented by its best individual position, never an average.
export function groupRecommendationsByCompany(rows, mode = 'match') {
  const companies = new Map()
  for (const row of sortRecommendations(rows)) {
    // Older cached responses lack company_id. Keep them separate until refresh
    // rather than accidentally combining unrelated companies with the same name.
    const companyKey = row.company_id != null ? `company:${row.company_id}` : `position:${row.position_id ?? row.id}`
    const company = companies.get(companyKey)
    if (company) company.suggestedPositionCount += 1
    else companies.set(companyKey, { ...row, companyKey, suggestedPositionCount: 1 })
  }
  return sortRecommendations([...companies.values()], mode)
}

export function sortCompanyPositions(positions) {
  return [...positions].sort((left, right) => {
    const leftScored = Number.isFinite(left.match_score)
    const rightScored = Number.isFinite(right.match_score)
    return Number(rightScored) - Number(leftScored) ||
      (leftScored && rightScored ? right.match_score - left.match_score : 0) || left.id - right.id
  })
}
