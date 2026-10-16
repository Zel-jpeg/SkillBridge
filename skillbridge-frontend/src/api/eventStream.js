// Browser-independent lifecycle so disconnect/identity races are testable.
export function createEventStream({ identity, preflight, source, changed, unauthorized,
  visible = () => true, timers = globalThis }) {
  let current = null, stream = null, retry = null, watchdog = null, flush = null
  let generation = 0, delay = 1000, running = false, connecting = false, pending = []

  function cancelConnection() {
    generation++
    connecting = false
    stream?.close()
    stream = null
    for (const timer of [retry, watchdog, flush]) timers.clearTimeout(timer)
    retry = watchdog = flush = null
    pending = []
  }
  function stop() {
    running = false
    current = null
    delay = 1000
    cancelConnection()
  }
  function expire() { stop(); unauthorized() }
  function enqueue(change) {
    pending.push(change)
    if (flush !== null) return
    flush = timers.setTimeout(() => {
      flush = null
      const changes = pending
      pending = []
      const merged = { resync: changes.some(item => item.resync) }
      for (const field of ['topics', 'urls', 'batch_ids', 'student_ids', 'assessment_ids']) {
        if (['topics', 'urls'].includes(field) || changes.every(item => field in item)) {
          const values = [...new Set(changes.flatMap(item => item[field] || []))]
          if (['topics', 'urls'].includes(field) || values.length <= 100) merged[field] = values
        }
      }
      changed(merged)
    }, 150)
  }
  function reconnect() {
    cancelConnection()
    if (!running || !visible()) return
    retry = timers.setTimeout(connect, delay)
    delay = Math.min(delay * 2, 30_000)
  }
  function heartbeat() {
    timers.clearTimeout(watchdog)
    watchdog = timers.setTimeout(reconnect, 45_000)
  }
  async function connect() {
    retry = null
    if (!running || !visible()) return
    const next = identity()
    if (!next?.token || !next?.role) { stop(); return }
    current = next.key
    const activeGeneration = ++generation
    connecting = true
    try {
      await preflight(next)
      if (!running || activeGeneration !== generation) return
      if (identity()?.key !== current) { start(); return }
      const connection = source(next)
      stream = connection
      heartbeat()
      connection.onmessage = event => {
        if (activeGeneration !== generation) return
        if (identity()?.key !== current) { start(); return }
        let data
        try { data = JSON.parse(event.data) } catch { return }
        heartbeat()
        if (data.type === 'auth_expired') { expire(); return }
        if (data.type === 'reconnect') { reconnect(); return }
        if (data.type === 'connected') {
          delay = 1000
          enqueue({ resync: true })
        } else if (data.type === 'data_changed') enqueue(data)
      }
      connection.onerror = () => { if (activeGeneration === generation) reconnect() }
    } catch (error) {
      if (activeGeneration !== generation || !running) return
      if (identity()?.key !== current) { start(); return }
      if ([401, 403].includes(error.response?.status)) expire()
      else reconnect()
    } finally {
      if (activeGeneration === generation) connecting = false
    }
  }
  function start() {
    const next = identity()
    if (!next?.token) { stop(); return }
    if (running && current === next.key && (stream || retry !== null || connecting)) return
    cancelConnection()
    running = true
    current = next.key
    delay = 1000
    connect()
  }
  function visibilityChanged() {
    if (!running) return
    if (!visible()) cancelConnection()
    else start()
  }
  return { start, stop, visibilityChanged }
}
