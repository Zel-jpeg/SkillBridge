export function startVisibleRefresh(url, {
  documentTarget, windowTarget, read, revalidate, now = Date.now,
  intervalMs = 30_000, minimumMs = 5_000,
}) {
  const refresh = () => {
    if (documentTarget.visibilityState !== 'visible') return
    const entry = read(url)
    if (!entry || now() - entry.fetchedAt >= minimumMs) revalidate(url)
  }
  const timer = windowTarget.setInterval(refresh, intervalMs)
  documentTarget.addEventListener('visibilitychange', refresh)
  windowTarget.addEventListener('focus', refresh)
  return () => {
    windowTarget.clearInterval(timer)
    documentTarget.removeEventListener('visibilitychange', refresh)
    windowTarget.removeEventListener('focus', refresh)
  }
}
