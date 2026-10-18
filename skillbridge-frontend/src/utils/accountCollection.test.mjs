import test from 'node:test'
import assert from 'node:assert/strict'
import { reconcileAccountCollection } from './accountCollection.js'

test('confirmed writes reconcile a collection even when its follow-up read fails', () => {
  const original = { students: [{ id: 1, name: 'Synthetic', course: 'BSIT' }], instructors: [], pending_instructors: [] }
  const archived = reconcileAccountCollection(original, { id: 1, is_active: false }, 'student')
  assert.equal(archived.students.length, 0)
  assert.equal(archived.archived_students[0].course, 'BSIT')
  assert.equal(original.students.length, 1)
  const restored = reconcileAccountCollection(archived, { id: 1, is_active: true }, 'student')
  assert.equal(restored.students.length, 1)
  assert.equal(restored.archived_students.length, 0)
  const pending = reconcileAccountCollection(restored, { id: 2, is_active: true, is_approved: false }, 'instructor')
  assert.equal(pending.pending_instructors[0].id, 2)
})
