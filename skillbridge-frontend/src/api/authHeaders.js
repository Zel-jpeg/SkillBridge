export function isAuthenticationRequest(url) {
  return /\/api\/auth\/(login|google|refresh)\/?(?:\?|$)/.test(url || '')
}
