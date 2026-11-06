import test from 'node:test'
import assert from 'node:assert/strict'
import { skillTagValues } from './skillTagEditor.js'

test('saving includes the pending tag and keeps existing spelling, order and Unicode', () => {
  assert.deepEqual(skillTagValues('SQL, Guest relations', 'sql; Filipino terminology\nCase notes'),
    ['SQL', 'Guest relations', 'Filipino terminology', 'Case notes'])
})
test('tag limits reject the draft without silently truncating saved vocabulary', () => {
  const tags = Array.from({ length: 30 }, (_, index) => `Tag ${index}`).join(', ')
  assert.equal(skillTagValues(tags).length, 30)
  assert.throws(() => skillTagValues(tags, 'One more'), /at most 30/)
  assert.throws(() => skillTagValues('SQL', 'a'.repeat(81)), /80 characters/)
})
