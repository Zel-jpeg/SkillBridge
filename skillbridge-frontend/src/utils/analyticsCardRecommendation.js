import { recommendationDisplay, summaryRecommendation } from './recommendationResults.js'

// A saved suggested allocation can differ from the student's highest alternative.
// Keep its partner, position and value together in the card just as in the table.
export function analyticsCardRecommendation(row, suggested = false) {
  const label = suggested ? 'Suggested allocation' : 'Top recommendation'
  const recommendation = suggested ? row.suggested_recommendation : summaryRecommendation(row)
  const display = recommendationDisplay(recommendation)
  const available = !row.recommendations_locked && (suggested
    ? recommendation != null && display !== 'Not available'
    : row.top_match != null)
  return {
    label, available, display,
    company: (suggested ? row.company : row.top_company) || 'Partner not provided',
    position: (suggested ? row.position : row.top_position) || 'Position not provided',
    state: row.recommendations_locked ? 'Locked / unavailable' : 'Unavailable',
  }
}
