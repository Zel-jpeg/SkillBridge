import test from 'node:test'
import assert from 'node:assert/strict'
import { attemptStorageKey } from './attemptStorage.js'

test('same exam has independent answer and integrity storage for each student', () => {
  assert.notEqual(attemptStorageKey('answers', 1, 10), attemptStorageKey('answers', 2, 10))
  assert.notEqual(attemptStorageKey('integrity_active', 1, 10), attemptStorageKey('integrity_active', 2, 10))
  assert.notEqual(attemptStorageKey('answers', 1, 10), 'sb_answers_10')
})
