// Shared GET state. The store accepts the request function so its race and
// account-isolation behavior can be tested without mounting React.
export function createCacheStore(getRequest, storage = globalThis.sessionStorage, identity = () => '') {
  const cache = new Map()
  const inflight = new Map()
  const versions = new Map()
  const listeners = new Map()
  const prefix = 'sb_api_'
  const ownerKey = 'sb_api_owner'
  let owner = null
  let epoch = 0

  function clearEntries() {
    epoch += 1
    cache.clear()
    inflight.clear()
    versions.clear()
    try {
      Object.keys(storage).filter(key => key.startsWith(prefix)).forEach(key => storage.removeItem(key))
    } catch { /* Storage can be unavailable. */ }
  }

  function ensureOwner() {
    const next = identity()
    if (owner !== null && owner !== next) {
      clearEntries()
    }
    owner = next
    try {
      if (storage.getItem(ownerKey) !== next) {
        clearEntries()
        storage.setItem(ownerKey, next)
      }
    } catch { /* In-memory caching still works. */ }
  }

  function read(url) {
    ensureOwner()
    if (cache.has(url)) return cache.get(url)
    try {
      const raw = storage.getItem(prefix + url)
      if (raw) {
        const entry = JSON.parse(raw)
        cache.set(url, entry)
        return entry
      }
    } catch { /* Treat invalid or unavailable storage as a miss. */ }
    return null
  }

  function publish(url, data) {
    ensureOwner()
    versions.set(url, (versions.get(url) ?? 0) + 1)
    inflight.delete(url)
    const entry = { data, fetchedAt: Date.now() }
    cache.set(url, entry)
    try { storage.setItem(prefix + url, JSON.stringify(entry)) } catch { /* Quota or private mode. */ }
    listeners.get(url)?.forEach(callback => callback(data))
    return entry
  }

  function invalidate(url) {
    ensureOwner()
    versions.set(url, (versions.get(url) ?? 0) + 1)
    inflight.delete(url)
    const entry = read(url)
    if (entry) {
      const stale = { ...entry, fetchedAt: 0 }
      cache.set(url, stale)
      try { storage.setItem(prefix + url, JSON.stringify(stale)) } catch { /* Storage can be unavailable. */ }
    }
  }

  function clear() {
    clearEntries()
    owner = null
  }

  function subscribe(url, callback) {
    const set = listeners.get(url) ?? new Set()
    set.add(callback)
    listeners.set(url, set)
    return () => {
      set.delete(callback)
      if (!set.size) listeners.delete(url)
    }
  }

  function hasSubscribers(url) {
    return !!listeners.get(url)?.size
  }

  function fetch(url) {
    ensureOwner()
    if (inflight.has(url)) return inflight.get(url)
    const version = versions.get(url) ?? 0
    const currentEpoch = epoch
    const currentOwner = owner
    const fetchUrl = url.includes('?') ? `${url}&_t=${Date.now()}` : `${url}?_t=${Date.now()}`
    const promise = getRequest(fetchUrl).then(response => {
      ensureOwner()
      if (owner === currentOwner && epoch === currentEpoch && (versions.get(url) ?? 0) === version) {
        publish(url, response.data)
      }
      return response
    }).finally(() => {
      if (inflight.get(url) === promise) inflight.delete(url)
    })
    inflight.set(url, promise)
    return promise
  }

  return { read, publish, invalidate, clear, subscribe, hasSubscribers, fetch }
}
