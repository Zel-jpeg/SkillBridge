// Shared GET state. The store accepts the request function so its race and
// account-isolation behavior can be tested without mounting React.
export function createCacheStore(getRequest, storage = globalThis.sessionStorage, identity = () => '', validate = () => {}) {
  const cache = new Map()
  const inflight = new Map()
  const versions = new Map()
  const listeners = new Map()
  const controllers = new Map()
  const errors = new Map()
  const observers = new Set()
  let revision = 0
  const prefix = 'sb_api_'
  const ownerKey = 'sb_api_owner'
  let owner = null
  let epoch = 0

  function changed() {
    revision += 1
    // Owner reconciliation can happen during a cache read in render. Notify
    // outside that render, as required by useSyncExternalStore consumers.
    queueMicrotask(() => observers.forEach(callback => callback()))
  }

  function clearEntries() {
    epoch += 1
    controllers.forEach((_url, controller) => controller.abort())
    controllers.clear()
    cache.clear()
    inflight.clear()
    versions.clear()
    errors.clear()
    try {
      Object.keys(storage).filter(key => key.startsWith(prefix)).forEach(key => storage.removeItem(key))
    } catch { /* Storage can be unavailable. */ }
    const clearedEpoch = epoch
    queueMicrotask(() => {
      if (epoch === clearedEpoch) listeners.forEach((callbacks, url) => {
        if (!cache.has(url)) callbacks.forEach(callback => callback(null))
      })
    })
    changed()
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
        if (!entry || !Number.isFinite(entry.fetchedAt)) throw new Error('Invalid stored query entry')
        validate(url, entry.data)
        cache.set(url, entry)
        return entry
      }
    } catch { /* Treat invalid or unavailable storage as a miss. */ }
    return null
  }

  function publish(url, data) {
    ensureOwner()
    validate(url, data)
    versions.set(url, (versions.get(url) ?? 0) + 1)
    inflight.delete(url)
    const entry = { data, fetchedAt: Date.now() }
    errors.delete(url)
    cache.set(url, entry)
    try { storage.setItem(prefix + url, JSON.stringify(entry)) } catch { /* Quota or private mode. */ }
    listeners.get(url)?.forEach(callback => callback(data))
    changed()
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
    changed()
  }

  function clear() {
    clearEntries()
    owner = null
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
    changed()
    return () => {
      set.delete(callback)
      if (!set.size) listeners.delete(url)
      changed()
    }
  }

  function hasSubscribers(url) {
    return !!listeners.get(url)?.size
  }

  function fetch(url, options = {}) {
    ensureOwner()
    if (inflight.has(url)) return inflight.get(url)
    const version = versions.get(url) ?? 0
    const currentEpoch = epoch
    const currentOwner = owner
    const controller = new AbortController()
    // Keep superseded transports too: optimistic publication can replace the
    // in-flight slot before an older request has actually finished.
    controllers.set(controller, url)
    errors.delete(url)
    const fetchUrl = url.includes('?') ? `${url}&_t=${Date.now()}` : `${url}?_t=${Date.now()}`
    const { canContinue, ...requestOptions } = options
    const promise = getRequest(fetchUrl, { ...requestOptions, signal: controller.signal }).then(response => {
      ensureOwner()
      if (owner === currentOwner && epoch === currentEpoch && (versions.get(url) ?? 0) === version) {
        publish(url, response.data)
      } else if (owner === currentOwner && epoch === currentEpoch && inflight.get(url) === promise) {
        // An event arrived during this GET. Discard its result and serialize
        // one follow-up GET; every caller continues to share the same promise.
        inflight.delete(url)
        // An unmounted speculative request must not start another GET in a
        // hidden tab. Its entry stays stale for the next mounted consumer.
        if (canContinue && !canContinue() && !hasSubscribers(url)) return response
        return fetch(url, options)
      }
      return response
    }).catch(error => {
      ensureOwner()
      if ((owner !== currentOwner || epoch !== currentEpoch) && error && typeof error === 'object') {
        error.staleIdentity = true
      }
      if (owner === currentOwner && epoch === currentEpoch && inflight.get(url) === promise) {
        if ((versions.get(url) ?? 0) !== version && ![401, 403, 404].includes(error.response?.status)
          && (!canContinue || canContinue() || hasSubscribers(url))) {
          inflight.delete(url)
          return fetch(url, options)
        }
        if (!controller.signal.aborted) errors.set(url, error)
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
      controllers.delete(controller)
      changed()
    })
    inflight.set(url, promise)
    changed()
    return promise
  }

  function abortUnobserved(url) {
    if (hasSubscribers(url)) return false
    versions.set(url, (versions.get(url) ?? 0) + 1)
    inflight.delete(url)
    controllers.forEach((requestUrl, controller) => {
      if (requestUrl !== url) return
      controller.abort()
      controllers.delete(controller)
    })
    changed()
    return true
  }

  return {
    read, publish, invalidate, clear, subscribe, hasSubscribers, fetch, urls,
    abortUnobserved,
    error: url => errors.get(url),
    pending: url => inflight.has(url),
    foregroundReady: (optionalUrls = []) => {
      const optional = new Set(optionalUrls)
      return [...inflight.keys()].every(url => optional.has(url) && !hasSubscribers(url)) &&
        [...listeners.keys()].every(url => !inflight.has(url) && (read(url) !== null || errors.has(url)))
    },
    observe: callback => { observers.add(callback); return () => observers.delete(callback) },
    revision: () => revision,
  }
}
