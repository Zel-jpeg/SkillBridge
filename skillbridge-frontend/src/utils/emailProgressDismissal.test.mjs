import test from 'node:test'
import assert from 'node:assert/strict'
import { dismissedEmailGroups, emailProgressDismissalKey, rememberDismissedEmailGroup } from './emailProgressDismissal.js'

function storageFor(user) {
  const values = new Map([['sb-user', JSON.stringify(user)]])
  return { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value) }
}

test('delivered email dismissals are per account and role, and persist without storing personal records', () => {
  const storage = storageFor({ id: 21, role: 'instructor' })
  const key = emailProgressDismissalKey(storage)
  rememberDismissedEmailGroup(storage, key, 'opaque-group-id')
  assert.deepEqual(dismissedEmailGroups(storage, key), ['opaque-group-id'])
  for (const user of [{ id: 22, role: 'instructor' }, { id: 21, role: 'admin' }]) {
    storage.setItem('sb-user', JSON.stringify(user))
    assert.deepEqual(dismissedEmailGroups(storage, emailProgressDismissalKey(storage)), [])
  }
  assert.equal(storage.getItem(key), '["opaque-group-id"]')
  assert.equal(emailProgressDismissalKey(storageFor({ role: 'student', id: 21 })), null)
  assert.equal(emailProgressDismissalKey(storageFor({ role: 'admin' })), null)
})

test('dismissed groups remain bounded and new requests do not inherit old dismissal', () => {
  const storage = storageFor({ id: 21, role: 'instructor' })
  const key = emailProgressDismissalKey(storage)
  for (let i = 0; i < 110; i++) rememberDismissedEmailGroup(storage, key, `group-${i}`)
  const groups = dismissedEmailGroups(storage, key)
  assert.equal(groups.length, 100)
  assert.equal(groups[0], 'group-10')
  assert.equal(groups.at(-1), 'group-109')
  assert.equal(groups.includes('new-group'), false)
  rememberDismissedEmailGroup(storage, key, 'group-10')
  assert.equal(dismissedEmailGroups(storage, key).at(-1), 'group-10')
  assert.equal(dismissedEmailGroups(storage, key).length, 100)
})

test('invalid or blocked browser storage never breaks email progress', () => {
  const storage = storageFor({ id: 21, role: 'instructor' })
  const key = emailProgressDismissalKey(storage)
  for (const bad of ['broken', '{}', 'null', '[null,5,"","safe-id","safe-id"]']) {
    storage.setItem(key, bad)
    assert.deepEqual(dismissedEmailGroups(storage, key), bad.includes('safe-id') ? ['safe-id'] : [])
  }
  const blocked = { getItem() { throw new Error('Storage unavailable') }, setItem() { throw new Error('Storage unavailable') } }
  assert.equal(emailProgressDismissalKey(blocked), null)
  assert.deepEqual(dismissedEmailGroups(blocked, key), [])
  assert.doesNotThrow(() => rememberDismissedEmailGroup(blocked, key, 'opaque-group-id'))
  assert.doesNotThrow(() => rememberDismissedEmailGroup(null, null, 'opaque-group-id'))
})
