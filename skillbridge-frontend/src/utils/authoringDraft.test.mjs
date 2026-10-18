import test from 'node:test'
import assert from 'node:assert/strict'
import { authoringDraftKey, readAuthoringDraft } from './authoringDraft.js'

test('authoring drafts are owned by role and account; unowned legacy draft is not read', () => {
  const entries = new Map([['sb-user', JSON.stringify({ id: 1, role: 'instructor' })],
    ['sb_assessment_draft', JSON.stringify({ title: 'Another user secret' })]])
  const storage = { getItem: key => entries.get(key) ?? null }
  const first = authoringDraftKey(storage)
  assert.equal(readAuthoringDraft(first, storage), null)
  entries.set(first, JSON.stringify({ title: 'Own draft', categories: [], questions: [] }))
  assert.equal(readAuthoringDraft(first, storage).title, 'Own draft')
  entries.set('sb-user', JSON.stringify({ id: 2, role: 'instructor' }))
  assert.notEqual(authoringDraftKey(storage), first)
  assert.equal(readAuthoringDraft(authoringDraftKey(storage), storage), null)
  entries.set('sb-user', JSON.stringify({ id: 1, role: 'student' }))
  assert.equal(authoringDraftKey(storage), null)
  assert.ok(entries.has('sb_assessment_draft'))
})

test('corrupt or structurally invalid saved drafts cannot crash the restore UI', () => {
  for (const raw of ['invalid', '[]', '{}', JSON.stringify({ categories: [], questions: [{ id: 1, text: [] }] })]) {
    assert.equal(readAuthoringDraft('owned', { getItem: () => raw }), null)
  }
})
