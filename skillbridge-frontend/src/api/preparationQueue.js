// Optional GETs only. Foreground queries bypass the queue and share the store.
export function createPreparationQueue({ identity, visible, ready, read, fetch, abort, prepare, allowed = () => true,
  schedule = callback => setTimeout(callback, 0), cancel = clearTimeout, concurrency = 1,
  now = Date.now, ttl = 30_000 }) {
  let owner = null, enabled = false, timer = null, generation = 0
  const queued = new Map(), active = new Set(), attempted = new Set()

  function reset() {
    generation += 1
    enabled = false
    queued.clear()
    attempted.clear()
    active.forEach(abort)
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
    if (!visible() || !ready()) return
    while (active.size < concurrency && queued.size) {
      const url = queued.keys().next().value
      queued.delete(url)
      if (!allowed(url)) { attempted.add(url); continue }
      const entry = read(url)
      const fresh = entry && now() - entry.fetchedAt < ttl
      const code = prepare?.(url)
      if (fresh && !code) continue
      attempted.add(url)
      active.add(url)
      const epoch = generation
      const requestOwner = owner
      // Deadline applies only to speculative list GETs, not operations or SSE.
      Promise.allSettled([
        fresh ? Promise.resolve() : fetch(url, { timeout: 15_000, canContinue: () => visible() && identity() === requestOwner }),
        code,
      ]).catch(() => {}).finally(() => {
        if (epoch !== generation) return
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
      active.forEach(url => { if (abort(url)) active.delete(url) })
      enqueue(urls)
    },
    enqueue, wake, reset,
    pause({ abortActive = false } = {}) {
      enabled = false
      if (abortActive) {
        active.forEach(abort)
        active.clear()
        generation += 1
      }
      if (timer !== null) cancel(timer)
      timer = null
    },
  }
}
