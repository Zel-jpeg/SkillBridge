import test from 'node:test'
import assert from 'node:assert/strict'

test('shared analytics refreshes for capacity consumption in another batch and remains read-only', () => {
  assert.equal(queryAffected('/api/management/analytics/?batch_id=4', { topics: ['placements'], batch_ids: [5] }), true)
  assert.equal(queryAffected('/api/management/analytics/?course=BSIT', { topics: ['configuration'] }), true)
  assert.equal(queryAffected('/api/management/analytics/', { resync: true }), true)
  assert.equal(queryAffected('/api/management/analytics/', { topics: ['unknown'] }), false)
})
import { queryAffected, invalidateQueries } from './queryInvalidation.js'
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
