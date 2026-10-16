import test from 'node:test'
import assert from 'node:assert/strict'
import { companyImageError, companyRequest, MAX_COMPANY_IMAGE_BYTES } from './companyImages.js'

test('optional images and unchanged/remove preserve JSON callers', () => {
  const details = { name: 'Synthetic company', address: { city: 'Synthetic City' }, lat: null, positions: [{ id: 1, slots: 3 }] }
  assert.deepEqual(companyRequest(details), { ...details, image_action: 'unchanged' })
  assert.deepEqual(companyRequest(details, { action: 'remove' }), { ...details, image_action: 'remove' })
})

test('replace uses a JSON envelope and exactly one file without persisting preview state', async () => {
  const file = new File(['synthetic image'], 'synthetic.png', { type: 'image/png' })
  const details = { name: 'Synthetic', address: { street: 'Test', city: 'City' }, lat: null, lng: 125.6, positions: [{ id: 1, tags: ['Python'] }] }
  const payload = companyRequest(details, { action: 'replace', file, error: '', preview: 'blob:temporary' })
  assert.deepEqual([...payload.keys()], ['payload', 'image'])
  assert.deepEqual(JSON.parse(payload.get('payload')), { ...details, image_action: 'replace' })
  assert.equal(await payload.get('image').text(), 'synthetic image')
  assert.equal(payload.get('payload').includes('blob:'), false)
})

test('browser checks reject size/type mistakes while Django remains authoritative', () => {
  assert.equal(companyImageError(null), '')
  for (const type of ['image/jpeg', 'image/png', 'image/webp']) assert.equal(companyImageError({ type, size: MAX_COMPANY_IMAGE_BYTES }), '')
  assert.match(companyImageError({ type: 'image/png', size: MAX_COMPANY_IMAGE_BYTES + 1 }), /5 MiB/)
  assert.match(companyImageError({ type: 'image/svg+xml', size: 10 }), /static JPEG/)
})
