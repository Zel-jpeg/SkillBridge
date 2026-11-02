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
  return { ...row, lat: pin?.lat ?? null, lng: pin?.lng ?? null, match: recommendationValue(row),
    combined: recommendationValue(row), distKm: distance, proximityPct: row.location_score_component ?? null }
}

export function recommendationDetails(row) { return row?.assessment_details ?? row?.recommendation_details ?? {} }
export function isAssessmentLed(row) { return row?.ranking_policy === 'assessment-led-option3' || recommendationDetails(row).policy === 'assessment-led-option3' }
export function recommendationRank(row) {
  const rank = row?.recommendation_rank ?? row?.assessment_rank
  return Number.isInteger(rank) && rank > 0 ? rank : null
}
export function recommendationValue(row) {
  const value = isAssessmentLed(row) ? row.requirement_coverage ?? recommendationDetails(row).coverage : row?.match_score
  return Number.isFinite(value) ? value : null
}
export function recommendationDisplay(row) {
  const rank = recommendationRank(row)
  return isAssessmentLed(row) && rank != null ? `#${rank}` : Number.isFinite(row?.match_score) ? `${row.match_score}%` : 'Not available'
}
export function coverageDisplay(row) {
  const value = recommendationValue(row)
  if (value == null) return 'Unavailable'
  if (isAssessmentLed(row) && value < 100 && value.toFixed(1) === '100.0') return '<100%'
  return `${value.toFixed(1)}%`
}
// A decision's evidence is frozen at approval. Never substitute today's ranking.
export function placementRecommendation(placement) {
  const saved = placement?.recommendation_evidence
  return { ...saved,
    match_score: placement?.match_score_at_assignment,
    category_score_component: placement?.category_score_component_at_assignment,
    nlp_score_component: placement?.nlp_score_component_at_assignment,
    location_score_component: placement?.location_score_component_at_assignment,
  }
}
export function summaryRecommendation(row) {
  return { ranking_policy: row?.top_ranking_policy, assessment_rank: row?.top_recommendation_rank,
    assessment_details: row?.top_recommendation_details, requirement_coverage: row?.top_requirement_coverage,
    match_score: row?.top_match ?? row?.top_match_score }
}
export function componentPercent(value) {
  return Number.isFinite(value) ? `${value.toFixed(1)}%` : 'Unavailable'
}
export function recommendationMetrics(row) {
  return isAssessmentLed(row) ? [
    ['Recommendation order', recommendationDisplay(row)],
    ['Requirement coverage', coverageDisplay(row)],
    ['NLP text similarity', componentPercent(row.nlp_score_component)],
    ['Location score', componentPercent(row.location_score_component)],
  ] : [
    ['Legacy hybrid reference', componentPercent(row?.match_score)],
    ['Category fit', componentPercent(row?.category_score_component)],
    ['NLP fit', componentPercent(row?.nlp_score_component)],
    ['Location fit', componentPercent(row?.location_score_component)],
  ]
}
export function compareRecommendations(left, right) {
  const a = recommendationRank(left)
  const b = recommendationRank(right)
  if (a != null && b != null && a !== b) return a - b
  if ((a != null) !== (b != null)) return a != null ? -1 : 1
  return (right.match_score ?? -Infinity) - (left.match_score ?? -Infinity) || (left.position_id ?? left.id) - (right.position_id ?? right.id)
}
// Position candidate order compares actual assessed requirements across students.
// Personal recommendation ranks/demand ratios cannot be compared across people.
export function comparePositionCandidates(left, right) {
  const a = recommendationDetails(left)
  const b = recommendationDetails(right)
  if (isAssessmentLed(left) || isAssessmentLed(right)) {
    return Number(Boolean(b.all_targets_met)) - Number(Boolean(a.all_targets_met)) ||
      (b.required_mean ?? -Infinity) - (a.required_mean ?? -Infinity) ||
      (b.support ?? -Infinity) - (a.support ?? -Infinity) ||
      (left.student_id ?? left.student?.id ?? left.id) - (right.student_id ?? right.student?.id ?? right.id)
  }
  return (right.match_score ?? -Infinity) - (left.match_score ?? -Infinity) || left.id - right.id
}

export function sortRecommendations(rows, mode = 'match') {
  return [...rows].sort((left, right) => {
    const distanceOrder = (left.distKm ?? Infinity) - (right.distKm ?? Infinity)
    if (mode === 'distance' && distanceOrder && !Number.isNaN(distanceOrder)) return distanceOrder
    return compareRecommendations(left, right)
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
      (leftScored && rightScored ? compareRecommendations(left, right) : 0) || left.id - right.id
  })
}
