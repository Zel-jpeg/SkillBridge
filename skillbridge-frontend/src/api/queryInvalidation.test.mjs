import test from 'node:test'
import assert from 'node:assert/strict'

test('competency invalidation stays within the affected program and never triggers legacy ranking reads', () => {
  const urls = ['/api/management/programs/3/frameworks/?page=2', '/api/management/programs/3/frameworks/7/', '/api/management/programs/3/frameworks/7/categories/?search=Any', '/api/management/competency-programs/3/']
  for (const url of urls) {
    assert.equal(queryAffected(url, { topics: ['competencies'], program_ids: [3] }), true, url)
    assert.equal(queryAffected(url, { topics: ['competencies'], program_ids: [4] }), false, url)
    assert.equal(queryAffected(url, { topics: ['assignments'] }), true, url)
    assert.equal(queryAffected(url, { topics: ['users'] }), true, url)
    assert.equal(queryAffected(url, { resync: true }), true, url)
  }
  for (const url of ['/api/categories/', '/api/student/results/combined/', '/api/placements/draft/']) {
    assert.equal(queryAffected(url, { topics: ['competencies'], program_ids: [3] }), false, url)
  }
})

test('program revocation revalidates private staff batches and derived access without rerunning snapshots', () => {
  for (const path of ['/api/instructor/batches/', '/api/instructor/batches/2/students/?page=2',
    '/api/instructor/batches/2/emails/', '/api/instructor/assessments/', '/api/instructor/students/recommendations/',
    '/api/retake-requests/', '/api/placements/draft/', '/api/admin/batch-instructors/?program_id=5']) {
    assert.equal(queryAffected(path, { topics: ['assignments'] }), true, path)
  }
  assert.equal(queryAffected('/api/instructor/batches/2/closeout/?version=1', { topics: ['assignments'] }), false)
})

test('program assignment changes refresh grants/options without exposing unrelated student results', () => {
  for (const path of ['/api/management/programs/', '/api/management/programs/5/', '/api/admin/institutes/2/programs/5/instructors/?page=2', '/api/admin/institutes/2/programs/5/instructor-options/?search=Name']) {
    assert.equal(queryAffected(path, { topics: ['assignments'] }), true)
    assert.equal(queryAffected(path, { topics: ['organization'] }), true)
    assert.equal(queryAffected(path, { topics: ['users'] }), true)
    assert.equal(queryAffected(path, { resync: true }), true)
  }
  assert.equal(queryAffected('/api/student/results/combined/', { topics: ['assignments'] }), false)
})

test('organization changes refresh catalog variants without invalidating private results', () => {
  for (const url of ['/api/admin/institutes/?search=Example&page=2', '/api/admin/institutes/3/', '/api/admin/institutes/3/programs/?status=active', '/api/admin/institutes/3/programs/5/']) {
    assert.equal(queryAffected(url, { topics: ['organization'] }), true)
    assert.equal(queryAffected(url, { resync: true }), true)
  }
  assert.equal(queryAffected('/api/student/results/combined/', { topics: ['organization'] }), false)
})

test('shared analytics refreshes for capacity consumption in another batch and remains read-only', () => {
  assert.equal(queryAffected('/api/management/analytics/?batch_id=4', { topics: ['placements'], batch_ids: [5] }), true)
  assert.equal(queryAffected('/api/management/analytics/?course=BSIT', { topics: ['configuration'] }), true)
  assert.equal(queryAffected('/api/management/analytics/', { resync: true }), true)
  assert.equal(queryAffected('/api/management/analytics/', { topics: ['unknown'] }), false)
})
import { queryAffected, invalidateQueries } from './queryInvalidation.js'

test('cycle previews and own history refresh while issued closeout versions remain deliberate snapshots', () => {
  assert.equal(queryAffected('/api/students/me/history/', { topics: ['batches'] }), true)
  assert.equal(queryAffected('/api/instructor/batches/4/closeout/', { topics: ['capacity'], batch_ids: [9] }), true)
  assert.equal(queryAffected('/api/instructor/batches/4/closeout/?version=1', { topics: ['catalog'] }), false)
  assert.equal(queryAffected('/api/instructor/batches/4/closeout/?version=1', { resync: true }), false)
})

test('email jobs refresh only their batch and reconcile lifecycle or ownership changes', () => {
  const url = '/api/instructor/batches/4/emails/'
  assert.equal(queryAffected(url, { topics: ['email'], batch_ids: [4] }), true)
  assert.equal(queryAffected(url, { topics: ['email'], batch_ids: [5] }), false)
  for (const topic of ['users', 'students', 'batches']) assert.equal(queryAffected(url, { topics: [topic], batch_ids: [4] }), true)
  assert.equal(queryAffected(url, { resync: true }), true)
  const progress = '/api/instructor/batches/4/email-progress/'
  assert.equal(queryAffected(progress, { topics: ['email'], batch_ids: [4] }), true)
  assert.equal(queryAffected(progress, { topics: ['email'], batch_ids: [5] }), false)
  assert.equal(queryAffected(progress, { topics: ['batches'], batch_ids: [4] }), true)
})

test('student recovery reads observe lifecycle changes and respect batch pruning', () => {
  const previous = '/api/instructor/batches/4/unenrolled/'
  assert.equal(queryAffected(previous, { topics: ['students'], batch_ids: [4] }), true)
  assert.equal(queryAffected(previous, { topics: ['students'], batch_ids: [5] }), false)
  assert.equal(queryAffected(previous, { topics: ['batches'], batch_ids: [4] }), true)
  assert.equal(queryAffected(previous, { resync: true }), true)
  assert.equal(queryAffected('/api/admin/users/3/history/', { topics: ['results'] }), true)
  assert.equal(queryAffected('/api/admin/users/3/history/', { resync: true }), true)
})
import { createCacheStore } from './cacheStore.js'

test('shared draft observes all cohort inputs and shared capacity without regenerating it', () => {
  for (const topic of ['placements', 'capacity', 'students', 'batches', 'assessments', 'results', 'catalog', 'taxonomy', 'configuration']) {
    assert.equal(queryAffected('/api/placements/draft/', { topics: [topic], batch_ids: [999] }), true, topic)
  }
  assert.equal(queryAffected('/api/placements/draft/', { resync: true }), true)
  assert.equal(queryAffected('/api/placements/draft/', { topics: ['unknown'] }), false)
})

test('batch ownership changes refresh rosters, authoring and selected audit pages; account changes refresh owner choices', () => {
  const change = { topics: ['batches', 'students', 'assessments', 'management'], batch_ids: [3] }
  for (const url of ['/api/instructor/batches/', '/api/instructor/batches/3/students/', '/api/instructor/assessments/',
    '/api/admin/management-actions/?batch_id=3&offset=50']) assert.equal(queryAffected(url, change), true)
  assert.equal(queryAffected('/api/admin/management-actions/?batch_id=4', change), false)
  assert.equal(queryAffected('/api/instructor/batches/4/students/', change), false)
  assert.equal(queryAffected('/api/admin/batch-instructors/', { topics: ['users'] }), true)
})

test('company branding and Google identity changes reuse current cache topics', () => {
  const catalog = { topics: ['catalog', 'results', 'students', 'placements'] }
  const identity = { topics: ['users', 'students', 'batches', 'placements'], student_ids: [7], batch_ids: [4] }
  for (const url of ['/api/admin/companies/', '/api/instructor/companies/', '/api/student/companies/',
    '/api/student/results/combined/', '/api/students/me/', '/api/placements/?limit=500', '/api/placements/suggestions/?include_history=true']) {
    assert.equal(queryAffected(url, catalog), true, url)
  }
  for (const url of ['/api/admin/users/', '/api/admin/students/recommendations/', '/api/instructor/companies/',
    '/api/instructor/batches/4/students/', '/api/students/me/', '/api/placements/?limit=500', '/api/placements/suggestions/']) {
    assert.equal(queryAffected(url, identity), true, url)
  }
  assert.equal(queryAffected('/api/instructor/batches/5/students/', identity), false)
  assert.equal(queryAffected('/api/management/assessment-reports/', catalog), false)
})

test('all query variants and dynamic URLs match their dependencies', () => {
  const change = { topics: ['students', 'assessments', 'results', 'placements'], batch_ids: [4], student_ids: [7], assessment_ids: [32] }
  for (const url of [
    '/api/instructor/batches/4/students/?course=BSIT&page=2',
    '/api/student/results/?assessment_id=32',
    '/api/student/results/review/?assessment_id=33',
    '/api/placements/?limit=500&status=approved',
    '/api/placements/suggestions/?include_placed=true&include_history=true',
    '/api/nlp/students/7/text/?assessment_id=32',
    '/api/instructor/assessments/32/questions/',
  ]) assert.equal(queryAffected(url, change), true, url)
  for (const url of ['/api/instructor/batches/5/students/', '/api/nlp/students/8/text/',
    '/api/admin/nlp-configuration/', '/api/categories/', '/api/assessments/32/start/',
    '/api/management/assessment-reports/', '/api/instructor/assessments/33/questions/']) assert.equal(queryAffected(url, change), false, url)
  assert.equal(queryAffected('/api/placements/?offset=5&limit=10', { urls: ['/api/placements/'] }), true)
})

test('mounted variants refetch once; persisted unmounted variants remain stale', async () => {
  const values = {}
  const storage = Object.defineProperties(values, {
    getItem: { value: key => values[key] ?? null },
    setItem: { value: (key, value) => { values[key] = value } },
    removeItem: { value: key => delete values[key] },
  })
  const mounted = '/api/placements/?limit=20'
  const unmounted = '/api/placements/?limit=500'
  const unrelated = '/api/admin/nlp-configuration/'
  const original = createCacheStore(() => {}, storage, () => 'admin:1')
  for (const url of [mounted, unmounted, unrelated]) original.publish(url, ['last good'])
  let calls = 0
  const cache = createCacheStore(async () => { calls++; return { data: ['fresh'] } }, storage, () => 'admin:1')
  cache.subscribe(mounted, () => {})
  invalidateQueries(cache, { topics: ['placements'] }, true)
  await cache.fetch(mounted)
  assert.equal(calls, 1)
  assert.deepEqual(cache.read(mounted).data, ['fresh'])
  assert.equal(cache.read(unmounted).fetchedAt, 0)
  assert.ok(cache.read(unrelated).fetchedAt > 0)
  invalidateQueries(cache, { resync: true }, false)
  assert.equal(calls, 1)
  assert.equal(cache.read(mounted).fetchedAt, 0)
})
