const PREFIX = 'sb-notifications-read:v1:'
const MAX_READ = 500
const RETENTION = 90 * 86_400_000
const severities = ['success', 'info', 'warning', 'danger']
export const NOTIFICATION_LABELS = { danger: 'Needs attention', warning: 'Reminder', success: 'Success', info: 'Update' }

export function notificationSeverity(entry) {
  return severities.includes(entry.severity) ? entry.severity : entry.urgent ? 'danger' : 'info'
}

export function unreadSeverity(entries) {
  return entries.reduce((tone, entry) => severities.indexOf(notificationSeverity(entry)) > severities.indexOf(tone) ? notificationSeverity(entry) : tone, 'success')
}

// Store only opaque presentation fingerprints, never notification text or records.
export function notificationFingerprint(entry) {
  const text = JSON.stringify([entry.id, entry.title, entry.description, entry.count ?? null, entry.to,
    notificationSeverity(entry), entry.revision ?? null])
  let a = 2166136261, b = 5381
  for (let i = 0; i < text.length; i++) {
    a = Math.imul(a ^ text.charCodeAt(i), 16777619)
    b = Math.imul(b, 33) ^ text.charCodeAt(i)
  }
  return `${(a >>> 0).toString(16).padStart(8, '0')}${(b >>> 0).toString(16).padStart(8, '0')}`
}

export function notificationOwner(storage) {
  try {
    const user = JSON.parse(storage.getItem('sb-user'))
    if (!['student', 'instructor', 'admin'].includes(user?.role) || !/^\d+$/.test(String(user.id))) return null
    return `${PREFIX}${user.role}:${user.id}`
  } catch { return null }
}

export function parseNotificationReads(raw, now = Date.now()) {
  try {
    const rows = JSON.parse(raw)
    if (!Array.isArray(rows)) return []
    return rows.filter(row => Array.isArray(row) && /^[0-9a-f]{16}$/.test(row[0]) &&
      Number.isFinite(row[1]) && row[1] > now - RETENTION && row[1] <= now)
      .sort((a, b) => b[1] - a[1]).slice(0, MAX_READ).map(([fingerprint, time]) => [fingerprint, time])
  } catch { return [] }
}

export function createNotificationReadStore(getStorage, clock = Date.now) {
  const cache = new Map(), listeners = new Set()
  function storage() { try { return getStorage() } catch { return null } }
  function getSnapshot() {
    const source = storage(), owner = notificationOwner(source)
    if (!cache.has(owner)) {
      let raw
      try { raw = owner && source.getItem(owner) } catch { /* In-memory read state still works. */ }
      cache.set(owner, { owner, reads: parseNotificationReads(raw, clock()) })
    }
    return cache.get(owner)
  }
  function emit() { listeners.forEach(listener => listener()) }
  return {
    getSnapshot,
    subscribe(listener) { listeners.add(listener); return () => listeners.delete(listener) },
    invalidate(key) {
      if (key === null || key === 'sb-user' || key === 'sb-role') cache.clear()
      else if (key.startsWith(PREFIX)) cache.delete(key)
      else return
      emit()
    },
    markRead(entries, owner) {
      const current = getSnapshot()
      // A stale click from a retired account cannot mark the next account's items.
      if (owner !== current.owner || !entries.length) return
      let latest = []
      try { latest = parseNotificationReads(storage()?.getItem(owner), clock()) } catch { /* Blocked storage. */ }
      const reads = new Map([...current.reads, ...latest])
      for (const entry of entries) reads.set(notificationFingerprint(entry), clock())
      const next = parseNotificationReads(JSON.stringify([...reads]), clock())
      cache.set(owner, { owner, reads: next })
      try { if (owner) storage()?.setItem(owner, JSON.stringify(next)) } catch { /* Keep the live in-memory state. */ }
      emit()
    },
  }
}
