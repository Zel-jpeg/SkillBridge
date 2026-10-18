export function friendlyStatus(status) {
  return ({
    400: 'Invalid request. Please check your input.',
    401: 'Your session expired. Please sign in again.',
    403: 'You do not have permission to do that.',
    404: 'The requested data was not found.',
    409: 'This record changed or conflicts with current data. Refresh it before trying again.',
    413: 'This upload is too large. Choose a smaller file.',
    429: 'Too many requests. Please wait a moment and try again.',
    500: 'Server error. Please try again in a moment.',
    502: 'Server is unavailable. Check your connection.',
    503: 'Server is unavailable. Check your connection.',
    504: 'Server is unavailable. Check your connection.',
  })[status] ?? 'Something went wrong. Please try again.'
}

export function requestErrorMessage(error, { mutation = false } = {}) {
  if (typeof error?.userMessage === 'string') return error.userMessage
  if (!error?.response) return mutation
    ? 'The save could not be confirmed. Refresh the current records before trying again.'
    : 'Cannot reach the server. Check your connection and try again.'
  const status = error.response.status
  // Internal server details and object/array payloads must never become React
  // children, log dumps, or user-facing database/provider diagnostics.
  if (status < 500) {
    for (const field of ['error', 'detail']) {
      const value = error.response.data?.[field]
      if (typeof value === 'string' && value.trim() && !/[<>]/.test(value)) return value.slice(0, 500)
    }
  }
  return friendlyStatus(status)
}

export function sanitizeApiError(error) {
  error.userMessage = requestErrorMessage(error, { mutation: !['get', 'head', 'options'].includes(error.config?.method ?? 'get') })
  const data = error.response?.data
  if (data && typeof data === 'object' && !Array.isArray(data) && !(typeof Blob !== 'undefined' && data instanceof Blob)) {
    error.response.data = { ...data, error: error.userMessage, ...('detail' in data ? { detail: error.userMessage } : {}) }
  }
  return error
}
