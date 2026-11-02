import { requestErrorMessage } from './requestErrors.js'

// Both admin entry points wait for the same synchronous operation.
export const RECOMMENDATION_RERUN_TIMEOUT_MS = 120000
export const RECOMMENDATION_REFRESH_URLS = Object.freeze([
  '/api/admin/students/recommendations/', '/api/admin/users/',
  '/api/instructor/students/recommendations/', '/api/admin/reports/',
  '/api/management/analytics/', '/api/placements/suggestions/', '/api/placements/draft/',
])

const uncertain = message => ({ state: 'uncertain', type: 'warning', refresh: true, message })
const count = value => Number.isSafeInteger(value) && value >= 0

export function recommendationRerunError(error) {
  if (error?.staleIdentity) return { state: 'cancelled', refresh: false }
  if (!error?.response && ['ECONNABORTED', 'ETIMEDOUT'].includes(error?.code)) {
    return uncertain('The rerun is taking longer than two minutes. The server may still be working. Check the refreshed results before trying again.')
  }
  if (!error?.response || error.response.status >= 500 || error.response.status === 408) {
    return uncertain('Could not confirm that the rerun completed. Some results may still update. Check the refreshed results before trying again.')
  }
  return { state: 'rejected', type: 'error', refresh: false, message: requestErrorMessage(error, { mutation: true }) }
}

async function perform(client) {
  try {
    const { data } = await client.post('/api/admin/rerun-recommendations/', {}, { timeout: RECOMMENDATION_RERUN_TIMEOUT_MS })
    if (data?.ok !== true || !count(data.students_processed) || !count(data.errors)) {
      return uncertain('Could not confirm the rerun result. Check the refreshed results before trying again.')
    }
    const processed = `${data.students_processed} student${data.students_processed === 1 ? '' : 's'}`
    if (data.errors > 0) return { state: 'partial', type: 'warning', refresh: true,
      message: `Recommendations refreshed for ${processed}; ${data.errors} processing error${data.errors === 1 ? ' was' : 's were'} reported. Review the results before rerunning.` }
    return { state: 'complete', type: 'success', refresh: true, message: `Recommendations refreshed for ${processed}.` }
  } catch (error) {
    return recommendationRerunError(error)
  }
}

// Navigating between admin entry points must not start a second pending POST.
// A different authenticated session never shares the previous user's response.
const pending = new WeakMap()
export function rerunRecommendations(client, sessionKey) {
  const previous = pending.get(client)
  if (previous && previous.sessionKey === sessionKey) return previous.promise
  const promise = perform(client).finally(() => {
    if (pending.get(client)?.promise === promise) pending.delete(client)
  })
  pending.set(client, { sessionKey, promise })
  return promise
}
