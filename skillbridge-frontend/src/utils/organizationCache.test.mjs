import test from 'node:test'
import assert from 'node:assert/strict'
import { createCacheStore } from '../api/cacheStore.js'
import { publishOrganizationRecord } from './organizationCache.js'
import { ORGANIZATION_OPTIONS } from './organizationScope.js'

const institute = { id: 2, name: 'Original institute', code: 'ORI', is_active: true, banner_color: 1 }
const program = { id: 7, name: 'Original program', code: 'PROG', institute_id: 2,
  institute_name: institute.name, institute_code: institute.code, is_active: true }
const read = (cache, url) => cache.read(url)?.data
function fixture(request = async () => ({ data: {} })) {
  const cache = createCacheStore(request)
  cache.publish(ORGANIZATION_OPTIONS, { institutes: [institute], programs: [program], shared_skill_institute_id: 2 })
  return cache
}

test('confirmed organization edits update existing filtered pages and child labels without changing pagination', () => {
  const cache = fixture()
  const url = '/api/admin/institutes/?search=Original&status=active&page=2&page_size=8'
  const page = { count: 12, page: 2, page_size: 8, results: [institute] }
  cache.publish(url, page)
  const saved = { ...institute, name: 'Reviewed institute', code: 'REV', banner_color: 5 }
  publishOrganizationRecord(cache, '/api/admin/institutes/2/', saved)
  assert.deepEqual(read(cache, url), { ...page, results: [saved] })
  const options = read(cache, ORGANIZATION_OPTIONS)
  assert.equal(options.shared_skill_institute_id, 2)
  assert.deepEqual(options.institutes, [saved])
  assert.deepEqual(options.programs, [{ ...program, institute_name: saved.name, institute_code: saved.code }])
  assert.deepEqual(read(cache, '/api/admin/institutes/2/'), saved)
})

test('program edits preserve display metadata and never insert into unrelated pages', () => {
  const cache = fixture()
  const url = '/api/admin/institutes/2/programs/?page=1&page_size=8'
  const page = { count: 1, page: 1, page_size: 8, results: [program] }
  const foreign = '/api/admin/institutes/3/programs/?page=1&page_size=8'
  cache.publish(url, page)
  cache.publish(foreign, { ...page, results: [{ ...program, id: 9, institute_id: 3 }] })
  cache.publish('/api/management/competency-programs/7/', program)
  const saved = { id: 7, name: 'Updated program', code: 'PROG', institute_id: 2, is_active: true, banner_color: 9 }
  publishOrganizationRecord(cache, '/api/admin/institutes/2/programs/7/', saved)
  assert.deepEqual(read(cache, url).results, [{ ...program, ...saved }])
  assert.deepEqual(read(cache, ORGANIZATION_OPTIONS).programs, [{ ...program, ...saved }])
  assert.deepEqual(read(cache, '/api/management/competency-programs/7/'), { ...program, ...saved })
  assert.equal(read(cache, foreign).results[0].id, 9)
  publishOrganizationRecord(cache, '/api/admin/institutes/2/programs/8/', { ...saved, id: 8 })
  assert.equal(read(cache, url).count, 1)
  assert.deepEqual(read(cache, url).results.map(row => row.id), [7])
})

test('a confirmed row publication prevents an older collection GET from replacing it', async () => {
  let finish
  const cache = fixture(() => new Promise(resolve => { finish = resolve }))
  const url = '/api/admin/institutes/?page=1&page_size=8'
  cache.publish(url, { count: 1, page: 1, page_size: 8, results: [institute] })
  const pending = cache.fetch(url)
  const saved = { ...institute, banner_color: 8 }
  publishOrganizationRecord(cache, '/api/admin/institutes/2/', saved)
  finish({ data: { count: 1, page: 1, page_size: 8, results: [institute] } })
  await pending
  assert.deepEqual(read(cache, url).results, [saved])
})
