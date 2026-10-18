export function reconcileAccountCollection(users, account, role) {
  if (!users || Array.isArray(users)) return null
  const buckets = ['students', 'instructors', 'pending_instructors', 'archived_students', 'archived_instructors']
  const existing = buckets.flatMap(key => users[key] ?? []).find(row => row.id === account.id)
  const row = { ...existing, ...account }
  const target = role === 'student' ? (row.is_active === false ? 'archived_students' : 'students')
    : row.is_active === false ? 'archived_instructors' : row.is_approved === false ? 'pending_instructors' : 'instructors'
  const result = { ...users }
  for (const key of buckets) result[key] = (users[key] ?? []).filter(value => value.id !== row.id)
  result[target] = [...result[target], row]
  return result
}
