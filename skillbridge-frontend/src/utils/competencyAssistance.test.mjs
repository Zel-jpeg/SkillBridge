import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mergeSuggestedTags } from './competencyAssistance.js'

test('accepted suggestions preserve manual tag spelling and order without duplicate vocabulary', () => {
  assert.equal(mergeSuggestedTags('Manual First, RECORDS,  Manual First ', ['records', 'New vocabulary']), 'Manual First, RECORDS, New vocabulary')
})

test('suggestions fit the remaining limit without truncating manual entries', () => {
  const manual = Array.from({ length: 29 }, (_, index) => `Manual ${index}`)
  assert.equal(mergeSuggestedTags(manual.join(', '), ['Added', 'Does not fit']), [...manual, 'Added'].join(', '))
  const tooMany = [...manual, 'Manual 30', 'Manual 31'].join(', ')
  assert.equal(mergeSuggestedTags(tooMany, ['Added']), tooMany)
})
