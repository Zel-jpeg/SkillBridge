const PREFIX = 'sb-email-progress-dismissed:v1:'
const MAX_GROUPS = 100

// Only opaque group IDs are stored, separately for each signed-in staff account.
export function emailProgressDismissalKey(storage) {
  try {
    const user = JSON.parse(storage?.getItem('sb-user'))
    return ['instructor', 'admin'].includes(user?.role) && /^\d+$/.test(String(user.id))
      ? `${PREFIX}${user.role}:${user.id}` : null
  } catch { return null }
}

export function dismissedEmailGroups(storage, key) {
  if (!key) return []
  try {
    const saved = JSON.parse(storage?.getItem(key))
    return Array.isArray(saved)
      ? [...new Set(saved.filter(id => typeof id === 'string' && id.length > 0 && id.length <= 128))].slice(-MAX_GROUPS) : []
  } catch { return [] }
}

export function rememberDismissedEmailGroup(storage, key, groupId) {
  if (!key) return
  const groups = dismissedEmailGroups(storage, key).filter(id => id !== groupId)
  try { storage?.setItem(key, JSON.stringify([...groups, groupId].slice(-MAX_GROUPS))) } catch { /* Dismissal still works in the mounted card. */ }
}
