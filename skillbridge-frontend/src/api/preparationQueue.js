// Optional GETs only. Foreground queries bypass the queue and share the store.
export function createPreparationQueue({ identity, visible, ready, read, fetch, abort, prepare, allowed = () => true,
  schedule = callback => setTimeout(callback, 0), cancel = clearTimeout, concurrency = 1,
  now = Date.now, ttl = 30_000 }) {
  let owner = null, enabled = false, timer = null, generation = 0
  const queued = new Map(), active = new Map(), attempted = new Set()

  function reset() {
    generation += 1
    enabled = false
    queued.clear()
    attempted.clear()
    for (const url of active.keys()) abort(url)
    active.clear()
    if (timer !== null) cancel(timer)
    timer = null
    owner = null
  }

  function wake() {
    if (!enabled || timer !== null) return
    timer = schedule(() => { timer = null; pump() })
  }

  function pump() {
    if (!enabled) return
    if (!owner || identity() !== owner) { reset(); return }
    if (!visible() || !ready(active.keys())) return
    while (active.size < concurrency && queued.size) {
      const url = queued.keys().next().value
      queued.delete(url)
      if (!allowed(url)) { attempted.add(url); continue }
      const entry = read(url)
      const fresh = entry && now() - entry.fetchedAt < ttl
      const code = prepare?.(url)
      if (fresh && !code) continue
      attempted.add(url)
      const job = {}
      active.set(url, job)
      const epoch = generation
      const requestOwner = owner
      // Deadline applies only to speculative list GETs, not operations or SSE.
      Promise.allSettled([
        fresh ? Promise.resolve() : fetch(url, { timeout: 15_000, canContinue: () => visible() && identity() === requestOwner }),
        code,
      ]).catch(() => {}).finally(() => {
        if (epoch !== generation || active.get(url) !== job) return
        active.delete(url)
        wake()
      })
    }
  }

  function enqueue(urls, promote = false) {
    if (!enabled || identity() !== owner) { if (enabled) reset(); return }
    const additions = urls.filter(url => !active.has(url) && !attempted.has(url))
    if (promote) {
      const rest = [...queued.keys()].filter(url => !additions.includes(url))
      queued.clear()
      additions.concat(rest).forEach(url => queued.set(url, true))
    } else additions.forEach(url => queued.set(url, true))
    wake()
  }

  return {
    start(urls) {
      const next = identity()
      if (!next) { reset(); return }
      if (owner !== next) reset()
      owner = next
      enabled = true
      // A new page has mounted its subscriptions. Keep adopted requests and
      // abort obsolete speculative traffic before scheduling more work.
      for (const url of active.keys()) {
        if (abort(url)) { active.delete(url); attempted.delete(url); queued.set(url, true) }
      }
      enqueue(urls)
    },
    enqueue, wake, reset,
    prioritize(urls) {
      const needed = new Set(urls)
      for (const url of active.keys()) {
        // A mounted/adopted request is protected by abortUnobserved.
        if (!needed.has(url) && abort(url)) {
          active.delete(url)
          attempted.delete(url)
          queued.set(url, true)
        }
      }
      const keys = [...queued.keys()]
      queued.clear()
      keys.filter(url => needed.has(url)).concat(keys.filter(url => !needed.has(url)))
        .forEach(url => queued.set(url, true))
    },
    pause({ abortActive = false } = {}) {
      enabled = false
      if (abortActive) {
        for (const url of active.keys()) abort(url)
        active.clear()
        generation += 1
      }
      if (timer !== null) cancel(timer)
      timer = null
    },
  }
}
