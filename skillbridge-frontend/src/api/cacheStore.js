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
    listeners.forEach(callbacks => callbacks.forEach(callback => callback(null)))
  }

  function urls() {
    ensureOwner()
    const keys = new Set([...cache.keys(), ...listeners.keys(), ...inflight.keys()])
    try {
      Object.keys(storage).filter(key => key.startsWith(prefix) && key !== ownerKey)
        .forEach(key => keys.add(key.slice(prefix.length)))
    } catch { /* In-memory entries remain available. */ }
    return [...keys]
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
      } else if (owner === currentOwner && epoch === currentEpoch && inflight.get(url) === promise) {
        // An event arrived during this GET. Discard its result and serialize
        // one follow-up GET; every caller continues to share the same promise.
        inflight.delete(url)
        return fetch(url)
      }
      return response
    }).catch(error => {
      ensureOwner()
      if ((owner !== currentOwner || epoch !== currentEpoch) && error && typeof error === 'object') {
        error.staleIdentity = true
      }
      if (owner === currentOwner && epoch === currentEpoch && inflight.get(url) === promise) {
        if ((versions.get(url) ?? 0) !== version) {
          inflight.delete(url)
          return fetch(url)
        }
        if ([403, 404].includes(error.response?.status)) {
          // Access loss/deletion is definitive, unlike a transient failure.
          cache.delete(url)
          try { storage.removeItem(prefix + url) } catch { /* Storage unavailable. */ }
          listeners.get(url)?.forEach(callback => callback(null, error))
        }
      }
      throw error
    }).finally(() => {
      if (inflight.get(url) === promise) inflight.delete(url)
    })
    inflight.set(url, promise)
    return promise
  }

  return { read, publish, invalidate, clear, subscribe, hasSubscribers, fetch, urls }
}
