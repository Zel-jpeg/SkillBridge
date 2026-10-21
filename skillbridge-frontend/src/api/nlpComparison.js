import { requestErrorMessage } from './requestErrors.js'

// Cold local Stanza evaluation can exceed two minutes for the prepared corpus.
export const NLP_COMPARISON_TIMEOUT_MS = 300000

export function nlpComparisonErrorMessage(error) {
  if (!error?.response && ['ECONNABORTED', 'ETIMEDOUT'].includes(error?.code)) {
    return 'Comparison timed out after five minutes. The backend may still be evaluating models. Check the Django terminal before trying again.'
  }
  if (!error?.response) {
    return 'Cannot reach the backend. Make sure the Django server is running and try again.'
  }
  return requestErrorMessage(error)
}
