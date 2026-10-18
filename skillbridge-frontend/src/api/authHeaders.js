export function isAuthenticationRequest(url) {
  return /\/api\/auth\/(login|google|refresh|register-role)\/?(?:\?|$)/.test(url || '')
}
