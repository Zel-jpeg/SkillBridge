// Pilot selection and lifecycle are independent from React and the provider SDK.
// A transport switch always closes the old connection before opening another.
const TOPICS = new Set(['scope', 'competencies', 'organization', 'assignments', 'email',
  'users', 'management', 'students', 'batches', 'assessments', 'results', 'catalog',
  'taxonomy', 'placements', 'capacity', 'configuration'])

function validTicket(ticket, now) {
  if (ticket?.transport !== 'supabase_broadcast' || ticket.event !== 'refresh' ||
      typeof ticket.token !== 'string' || ticket.token.length > 8192 ||
      !/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(ticket.token) ||
      !/^sb_publishable_[A-Za-z0-9_-]+$/.test(ticket.publishable_key) ||
      !/^sb-pilot:[A-Za-z0-9_-]{20,128}$/.test(ticket.topic) ||
      !Number.isSafeInteger(ticket.expires_at) || ticket.expires_at * 1000 <= now + 5000 ||
      ticket.expires_at * 1000 > now + 65_000) return false
  try {
    const url = new URL(ticket.url)
    return url.protocol === 'https:' && /^[a-z0-9]{10,64}\.supabase\.co$/.test(url.hostname) &&
      !url.username && !url.password && !url.port && !url.search && !url.hash && url.pathname === '/realtime/v1'
  } catch { return false }
}

function validHint(hint) {
  return hint?.type === 'data_changed' && typeof hint.event_id === 'string' &&
    /^[A-Za-z0-9_-]{1,128}$/.test(hint.event_id) && Array.isArray(hint.topics) &&
    hint.topics.length > 0 && hint.topics.length <= TOPICS.size && hint.topics.every(topic => TOPICS.has(topic))
}

export function createRealtimeStream({ identity, session, load, sse, changed,
  unauthorized = () => {}, visible = () => true, enabled = false, timers = globalThis, now = Date.now }) {
  let running = false, current = null, generation = 0, connection = null, controller = null
  let renew = null, expiry = null, join = null, flush = null, selecting = false, fallback = false
  let closing = null, scopePending = false
  const seen = new Set()

  function cancel() {
    generation++
    controller?.abort()
    controller = null
    const previous = connection
    connection = null
    const close = previous?.close()
    if (close) {
      closing = close
      close.then(() => { if (closing === close) closing = null })
    }
    sse.stop()
    for (const timer of [renew, expiry, join, flush]) timers.clearTimeout(timer)
    renew = expiry = join = flush = null
    selecting = fallback = false
    scopePending = false
  }
  function stop() {
    running = false
    current = null
    seen.clear()
    cancel()
  }
  function active(version, user) {
    return running && visible() && version === generation && identity()?.key === user.key
  }
  function resync(version, user, scopeChanged = false) {
    if (!active(version, user)) return
    scopePending ||= scopeChanged && user.role === 'instructor'
    if (flush !== null) return
    flush = timers.setTimeout(() => {
      flush = null
      const change = scopePending ? { resync: true, topics: ['scope'] } : { resync: true }
      scopePending = false
      if (active(version, user)) changed(change)
    }, 150)
  }
  function fallbackToSse(version, user) {
    if (!active(version, user)) return
    cancel()
    fallback = true
    const fallbackVersion = generation
    const startFallback = () => { if (active(fallbackVersion, user)) sse.start() }
    if (closing) closing.then(startFallback)
    else startFallback()
  }

  async function connect(user) {
    cancel()
    if (!running || !visible() || identity()?.key !== user.key) return
    const version = generation
    selecting = true
    controller = new AbortController()
    try {
      const ticket = await session(user, { signal: controller.signal })
      if (!active(version, user)) return
      if (ticket?.transport === 'sse' || !validTicket(ticket, now())) {
        fallbackToSse(version, user)
        return
      }
      // This timer also guards slow module loading and a hanging subscription.
      expiry = timers.setTimeout(() => fallbackToSse(version, user), ticket.expires_at * 1000 - now())
      const open = await load()
      if (closing) await closing
      if (!active(version, user)) return
      let subscribed = false
      const next = open(ticket, {
        message(hint) {
          if (!active(version, user) || !validHint(hint) || seen.has(hint.event_id)) return
          seen.add(hint.event_id)
          if (seen.size > 100) seen.delete(seen.values().next().value)
          resync(version, user, hint.topics.includes('scope'))
        },
        status(status) {
          if (!active(version, user)) return
          if (status === 'SUBSCRIBED') {
            subscribed = true
            timers.clearTimeout(join)
            join = null
            resync(version, user, true)
          } else if (['CHANNEL_ERROR', 'TIMED_OUT', 'CLOSED'].includes(status)) fallbackToSse(version, user)
        },
      })
      if (!active(version, user)) { next?.close(); return }
      connection = next
      if (!subscribed) join = timers.setTimeout(() => fallbackToSse(version, user), 8000)
      // Rechecking Django eligibility before rejoining bounds a cached channel's access.
      renew = timers.setTimeout(() => {
        if (active(version, user)) connect(user)
      }, Math.max(1000, ticket.expires_at * 1000 - now() - 10_000))
    } catch (error) {
      if (!active(version, user)) return
      if (error.response?.status === 401) {
        stop()
        unauthorized()
      } else fallbackToSse(version, user)
    } finally {
      if (version === generation) selecting = false
    }
  }

  function start() {
    if (!enabled) { sse.start(); return }
    const user = identity()
    if (!user?.token || !user?.key || !['admin', 'instructor', 'student'].includes(user.role)) { stop(); return }
    if (running && current === user.key && (selecting || connection || fallback)) return
    if (current !== user.key) seen.clear()
    current = user.key
    running = true
    connect(user)
  }
  function visibilityChanged() {
    if (!enabled) { sse.visibilityChanged(); return }
    if (!running) return
    if (!visible()) cancel()
    else start()
  }
  return { start, stop, visibilityChanged }
}
