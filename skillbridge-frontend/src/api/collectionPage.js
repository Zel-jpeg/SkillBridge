// A clamped response belongs to both the requested key and the returned page.
// Seed the latter before navigating so an older cached page cannot replace it.
export function adoptCollectionPage(cache, url, data, now = Date.now(), ttl = 30_000) {
  if (!url || !data?.pagination) return null
  const params = new URLSearchParams(url.split('?')[1])
  const requested = Number(params.get('page'))
  const returned = data.pagination.page
  if (!Number.isSafeInteger(returned) || returned < 1 || returned >= requested) return null
  const source = cache.read(url)
  if (source?.data !== data || source.fetchedAt <= 0 || now - source.fetchedAt >= ttl || cache.error(url) || cache.pending(url)) return null
  params.set('page', String(returned))
  const targetUrl = `${url.split('?')[0]}?${params}`
  const target = cache.read(targetUrl)
  if (target && target.fetchedAt > source.fetchedAt) {
    // A later page read may reflect a collection that grew again. Recheck the
    // requested page rather than promoting its older clamp to a fresh entry.
    cache.invalidate(url)
    void cache.fetch(url).catch(() => {})
    return null
  }
  cache.publish(targetUrl, data)
  return returned
}
