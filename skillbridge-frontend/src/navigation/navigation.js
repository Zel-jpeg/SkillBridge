export const SIDEBAR_STORAGE_KEY = 'sb-sidebar-collapsed'

export const ROLE_METADATA = {
  student: { label: 'Student', loginPath: '/login', profilePath: '/student/profile', detail: 'Student', avatarClass: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' },
  instructor: { label: 'Instructor', loginPath: '/login', profilePath: null, detail: 'OJT Coordinator', avatarClass: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200' },
  admin: { label: 'Administrator', loginPath: '/admin/login', profilePath: null, detail: 'Administrator', avatarClass: 'bg-rose-100 text-rose-800 dark:bg-rose-900 dark:text-rose-200' },
}

export const ROLE_NAVIGATION = {
  student: [
    { label: 'Dashboard', path: '/student/dashboard', icon: 'dashboard' },
    { label: 'Assessments', path: '/student/assessments', icon: 'assessments' },
    { label: 'Skill Profile and Matches', path: '/student/results', icon: 'skills' },
  ],
  instructor: [
    { label: 'Dashboard', path: '/instructor/dashboard', icon: 'dashboard' },
    { label: 'Students', path: '/instructor/students', icon: 'users' },
    { label: 'Assessments', path: '/instructor/assessments', icon: 'assessments' },
    { label: 'New Assessment', path: '/instructor/assessment/create', icon: 'create' },
    { label: 'Companies', path: '/instructor/companies', icon: 'companies' },
    { label: 'Placements', path: '/instructor/placements', icon: 'placements' },
  ],
  admin: [
    { label: 'Dashboard', path: '/admin/dashboard', icon: 'dashboard' },
    { label: 'Skills', path: '/admin/skills', icon: 'skills' },
    { label: 'Companies', path: '/admin/companies', icon: 'companies' },
    { label: 'Placements', path: '/admin/placements', icon: 'placements' },
    { label: 'Users', path: '/admin/users', icon: 'users' },
    { label: 'Assessments', path: '/admin/assessments', icon: 'assessments' },
    { label: 'Reports', path: '/admin/reports', icon: 'reports' },
  ],
}

export function activeNavigationPath(role, pathname) {
  return ROLE_NAVIGATION[role]?.find(item => pathname === item.path || pathname.startsWith(`${item.path}/`))?.path ?? null
}

export function parseSidebarPreference(value) {
  return value === 'true'
}

export function readSidebarPreference(storage) {
  try { return parseSidebarPreference(storage.getItem(SIDEBAR_STORAGE_KEY)) } catch { return false }
}

export function persistSidebarPreference(storage, collapsed) {
  try { storage.setItem(SIDEBAR_STORAGE_KEY, String(collapsed === true)) } catch { /* Storage may be unavailable. */ }
}

export function readCachedUser(storage) {
  try {
    const user = JSON.parse(storage.getItem('sb-user'))
    return user && typeof user === 'object' && !Array.isArray(user) ? user : {}
  } catch { return {} }
}

export function profileIdentity(role, user = {}) {
  const metadata = ROLE_METADATA[role]
  const name = typeof user.name === 'string' && user.name.trim() ? user.name.trim() : metadata.label
  const course = typeof user.course === 'string' ? user.course : ''
  const schoolId = typeof user.school_id === 'string' ? user.school_id : ''
  return {
    name,
    initials: name.split(/\s+/).map(part => part[0]).slice(0, 2).join('').toUpperCase(),
    detail: role === 'student' ? [course, schoolId].filter(Boolean).join(' / ') : role === 'instructor' ? course || metadata.detail : metadata.detail,
    photoUrl: typeof user.photo_url === 'string' ? user.photo_url : null,
  }
}
