// Only a matching server snapshot from this session allows a quiet instructor reconnect.
// Missing snapshots keep the conservative behavior during a staggered deployment.
export function createLiveScope() {
  let previous = null
  return {
    requiresEviction(user, revision) {
      if (user.role !== 'instructor') return false
      const key = user.scopeKey ?? user.key
      const valid = typeof revision === 'string' && /^[a-f0-9]{64}$/.test(revision)
      const unchanged = valid && previous?.key === key && previous.revision === revision
      previous = valid ? { key, revision } : null
      return !unchanged
    },
    clear() { previous = null },
  }
}
