import { requestErrorMessage } from './requestErrors.js'

export function waitForComparisonPoll(signal) {
  signal.throwIfAborted()
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      signal.removeEventListener('abort', abort)
      resolve()
    }, 3000)
    function abort() {
      clearTimeout(timer)
      reject(signal.reason)
    }
    signal.addEventListener('abort', abort, { once: true })
  })
}

export function nlpComparisonErrorMessage(error) {
  if (!error?.response && ['ECONNABORTED', 'ETIMEDOUT'].includes(error?.code)) {
    return 'The comparison request timed out. Select Run comparison to reconnect to an active job.'
  }
  if (!error?.response) {
    return 'Could not reach the comparison service. Select Run comparison to try again.'
  }
  return requestErrorMessage(error)
}
