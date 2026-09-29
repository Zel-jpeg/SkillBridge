import test from 'node:test'
import assert from 'node:assert/strict'
import { ROLE_NAVIGATION, ROLE_METADATA, SIDEBAR_STORAGE_KEY, activeNavigationPath, parseSidebarPreference, readSidebarPreference, persistSidebarPreference, readCachedUser, profileIdentity } from './navigation.js'

const expected = {
  student: ['dashboard', 'assessments', 'results'],
  instructor: ['dashboard', 'students', 'assessments', 'assessment/create', 'companies', 'placements'],
  admin: ['dashboard', 'skills', 'companies', 'placements', 'users', 'assessments', 'reports'],
}

for (const [role, destinations] of Object.entries(expected)) {
  test(`${role} has exactly its required links and icons, with no cross-role links`, () => {
    const links = ROLE_NAVIGATION[role]
    assert.deepEqual(links.map(item => item.path), destinations.map(path => `/${role}/${path}`))
    assert.equal(new Set(links.map(item => item.path)).size, links.length)
    for (const item of links) {
      assert.ok(item.label && item.icon)
      assert.equal(activeNavigationPath(role, item.path), item.path)
      for (const other of Object.keys(expected).filter(key => key !== role)) assert.equal(activeNavigationPath(other, item.path), null)
    }
  })
}

test('assessment results activate Assessments, while final matches and profile remain separate', () => {
  assert.equal(activeNavigationPath('student', '/student/assessments/42/results'), '/student/assessments')
  assert.equal(activeNavigationPath('student', '/student/results'), '/student/results')
  for (const path of ['/student/profile', '/student/setup', '/student/assessment', '/student/assessments-other', '/login']) assert.equal(activeNavigationPath('student', path), null)
  assert.equal(activeNavigationPath('instructor', '/instructor/assessment/create'), '/instructor/assessment/create')
  assert.equal(activeNavigationPath('unknown', '/student/dashboard'), null)
})

test('sidebar preference only accepts a stored true string', () => {
  assert.equal(parseSidebarPreference('true'), true)
  for (const value of [null, undefined, '', 'false', '1', 'TRUE', '{}', 'null', true]) assert.equal(parseSidebarPreference(value), false)
})

test('collapse and expand persist under the shared key and survive reload', () => {
  const values = new Map()
  const storage = { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value) }
  assert.equal(readSidebarPreference(storage), false)
  persistSidebarPreference(storage, true)
  assert.equal(values.get(SIDEBAR_STORAGE_KEY), 'true')
  assert.equal(readSidebarPreference(storage), true)
  persistSidebarPreference(storage, false)
  assert.equal(readSidebarPreference(storage), false)
  values.set(SIDEBAR_STORAGE_KEY, 'corrupt')
  assert.equal(readSidebarPreference(storage), false)
})

test('unavailable storage safely defaults to expanded and never prevents navigation', () => {
  const storage = { getItem() { throw new Error('blocked') }, setItem() { throw new Error('blocked') } }
  assert.equal(readSidebarPreference(storage), false)
  assert.doesNotThrow(() => persistSidebarPreference(storage, true))
  assert.deepEqual(readCachedUser(storage), {})
})

test('role metadata keeps login destinations, profile access, labels and avatar tones', () => {
  assert.equal(ROLE_METADATA.admin.loginPath, '/admin/login')
  assert.equal(ROLE_METADATA.instructor.loginPath, '/login')
  assert.equal(ROLE_METADATA.student.loginPath, '/login')
  assert.equal(ROLE_METADATA.student.profilePath, '/student/profile')
  assert.equal(ROLE_METADATA.admin.profilePath, null)
  assert.equal(ROLE_METADATA.instructor.profilePath, null)
  assert.deepEqual(Object.values(ROLE_METADATA).map(item => item.label), ['Student', 'Instructor', 'Administrator'])
  for (const item of Object.values(ROLE_METADATA)) assert.ok(item.avatarClass.includes('dark:'))
})

test('identity preserves student fields, initials, photo and staff-specific details', () => {
  const user = { name: '  Alex   Student ', school_id: 'QA-001', course: 'BSIT', photo_url: '/qa-photo.png' }
  assert.deepEqual(profileIdentity('student', user), { name: 'Alex   Student', initials: 'AS', detail: 'BSIT / QA-001', photoUrl: '/qa-photo.png' })
  assert.equal(profileIdentity('instructor', { name: 'Alex Instructor', course: 'BSIT' }).detail, 'BSIT')
  assert.equal(profileIdentity('admin', { course: 'BSIT' }).detail, 'Administrator')
  assert.equal(profileIdentity('student', { name: {}, course: [], school_id: {}, photo_url: 8 }).name, 'Student')
})

test('cached login fallback rejects malformed values and arrays', () => {
  for (const value of ['invalid', 'null', '[]', '"name"', '1']) assert.deepEqual(readCachedUser({ getItem: () => value }), {})
  assert.deepEqual(readCachedUser({ getItem: () => '{"name":"QA Student"}' }), { name: 'QA Student' })
})
