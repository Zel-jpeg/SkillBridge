export function filterAdminUsers({ tab, students, instructors, pending, filters, sortCol = 'name', sortDir = 'asc' }) {
  let list
  if (tab === 'students') {
    list = students.filter(user => !user.archived &&
      (filters.filterStatus === 'all' || user.status === filters.filterStatus) &&
      (filters.filterCourse === 'all' || user.course === filters.filterCourse) &&
      (filters.filterInstructor === 'all' || user.instructor === filters.filterInstructor))
  } else if (tab === 'instructors') list = instructors.filter(user => !user.archived)
  else if (tab === 'pending') return pending
  else list = [...students.map(user => ({ ...user, role: 'student' })), ...instructors.map(user => ({ ...user, role: 'instructor' }))]
    .filter(user => tab === 'archived' ? user.archived : !user.archived)
  const query = filters.search.trim().toLowerCase()
  if (query) list = list.filter(user => [user.name, user.email, user.studentId, user.instructorId].some(value => value?.toLowerCase().includes(query)))
  return [...list].sort((a, b) => {
    const av = sortCol === 'match' ? a.match ?? -1 : sortCol === 'course' ? a.course : a.name
    const bv = sortCol === 'match' ? b.match ?? -1 : sortCol === 'course' ? b.course : b.name
    return av < bv ? (sortDir === 'asc' ? -1 : 1) : av > bv ? (sortDir === 'asc' ? 1 : -1) : 0
  })
}
