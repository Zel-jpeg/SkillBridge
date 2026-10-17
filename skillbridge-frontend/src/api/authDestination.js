// Shared by both authentication methods; server still enforces access.
export function authDestination(user) {
  if (user.role === 'admin') return '/admin/dashboard'
  if (user.role === 'instructor') return user.is_approved ? '/instructor/dashboard' : '/instructor/pending'
  if (user.role === 'student') {
    if (user.is_approved === false) return '/instructor/pending'
    return user.phone ? '/student/dashboard' : '/student/setup'
  }
  return '/login'
}
