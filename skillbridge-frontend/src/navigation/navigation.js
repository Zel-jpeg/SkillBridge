export const SIDEBAR_STORAGE_KEY = 'sb-sidebar-collapsed'

export const ROLE_METADATA = {
  student: { label: 'Student', loginPath: '/login', profilePath: '/student/profile', detail: 'Student', avatarClass: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' },
  instructor: { label: 'Instructor', loginPath: '/login', profilePath: null, detail: 'OJT Coordinator', avatarClass: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200' },
  admin: { label: 'Administrator', loginPath: '/admin/login', profilePath: null, detail: 'Administrator', avatarClass: 'bg-rose-100 text-rose-800 dark:bg-rose-900 dark:text-rose-200' },
}

function staffNavigation(role) {
  const admin = role === 'admin'
  const link = (label, path, icon, aliases = []) => ({ label, path: `/${role}/${path}`, icon, aliases })
  return [
    { id: 'dashboard', items: [link('Dashboard', 'dashboard', 'dashboard')] },
    admin ? { id: 'people', label: 'People & programs', icon: 'batches', items: [
      link('Institutes & Programs', 'institutes', 'institutes'),
      link('Batches', 'batches', 'batches'),
      link('Users', 'users', 'users'),
    ] } : { id: 'students', items: [link('Students', 'students', 'users')] },
    { id: 'learning', label: 'Learning & assessment', icon: 'assessments', items: [
      link('Skill taxonomy', 'competencies', 'skills', admin ? ['/admin/skills'] : []),
      link('Assessments', 'assessments', 'assessments', [`/${role}/assessment/create`]),
      link('Retake requests', 'retake-requests', 'retakes'),
    ] },
    { id: 'ojt', label: 'OJT', icon: 'placements', items: [
      link('OJT Partners', 'companies', 'companies'),
      link('Placements', 'placements', 'placements'),
    ] },
    { id: 'reports', items: [link('Reports & Analytics', 'reports', 'reports')] },
  ]
}

export const ROLE_NAVIGATION_SECTIONS = {
  student: [{ id: 'student', items: [
    { label: 'Dashboard', path: '/student/dashboard', icon: 'dashboard' },
    { label: 'Assessments', path: '/student/assessments', icon: 'assessments' },
    { label: 'Skill Profile and Matches', path: '/student/results', icon: 'skills' },
  ] }],
  instructor: staffNavigation('instructor'),
  admin: staffNavigation('admin'),
}

export const ROLE_NAVIGATION = Object.fromEntries(Object.entries(ROLE_NAVIGATION_SECTIONS)
  .map(([role, sections]) => [role, sections.flatMap(section => section.items)]))

export function activeNavigationPath(role, pathname) {
  return ROLE_NAVIGATION[role]?.find(item => [item.path, ...(item.aliases || [])]
    .some(path => pathname === path || pathname.startsWith(`${path}/`)))?.path ?? null
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
  const course = user.program?.code || (typeof user.course === 'string' ? user.course : '')
  const teaching = Array.isArray(user.assigned_programs)
    ? user.assigned_programs.filter(program => program.is_active).map(program => program.code).join(' / ')
    : course
  const schoolId = typeof user.school_id === 'string' ? user.school_id : ''
  return {
    name,
    initials: name.split(/\s+/).map(part => part[0]).slice(0, 2).join('').toUpperCase(),
    detail: role === 'student' ? [course, schoolId].filter(Boolean).join(' / ') : role === 'instructor' ? teaching || metadata.detail : metadata.detail,
    photoUrl: typeof user.photo_url === 'string' ? user.photo_url : null,
  }
}
