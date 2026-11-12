import { requestErrorMessage } from './requestErrors.js'

export const NLP_COMPARISON_TIMEOUT_MS = 240000

export function nlpComparisonErrorMessage(error) {
  if (!error?.response && ['ECONNABORTED', 'ETIMEDOUT'].includes(error?.code)) {
    return 'Comparison timed out after four minutes. The backend may still be evaluating models. Check the server logs before trying again.'
  }
  if (!error?.response) {
    return 'Cannot reach the backend. Make sure the Django server is running and try again.'
  }
  return requestErrorMessage(error)
}
