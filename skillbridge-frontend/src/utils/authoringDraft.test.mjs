import test from 'node:test'
import assert from 'node:assert/strict'
import { authoringDraftKey, readAuthoringDraft, authoringDraftSignature, isRecoverableAuthoringDraft, questionHasContent, writeAuthoringDraft } from './authoringDraft.js'

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

const blankQuestion = { id: 1, text: '', type: 'mcq', choices: ['', '', '', ''], correct: null, identAnswer: '', categoryId: null }
const shared = [{ id: 1, name: 'Programming' }]
const blank = { title: '', categories: shared, questions: [blankQuestion] }

test('legacy automatic categories and batch/order defaults are not unfinished work', () => {
  assert.equal(isRecoverableAuthoringDraft({ ...blank, selectedBatchId: 4, displayOrder: '3' }, shared), false)
  assert.equal(isRecoverableAuthoringDraft({ ...blank, categories: [] }, shared), false)
  assert.equal(questionHasContent(blankQuestion), false)
  assert.equal(questionHasContent({ ...blankQuestion, type: 'truefalse', choices: ['True', 'False', '', ''] }), false)
})

test('incomplete legacy edits and custom categories remain recoverable', () => {
  for (const edits of [{ title: 'Partial' }, { duration: '25' }, { isRequired: false },
    { categories: [{ id: 2, name: 'Custom' }] }, { questions: [] },
    ...[{ choices: ['Answer', '', '', ''] }, { correct: 0 }, { identAnswer: 'Partial answer' },
      { categoryId: 1 }, { type: 'identification' }].map(q => ({ questions: [{ ...blankQuestion, ...q }] }))]) {
    assert.equal(isRecoverableAuthoringDraft({ ...blank, ...edits }, shared), true, JSON.stringify(edits))
  }
})

test('draft comparison excludes generated IDs and expansion but retains authored settings and answers', () => {
  const signature = authoringDraftSignature(blank)
  assert.equal(authoringDraftSignature({ ...blank, questions: [{ ...blankQuestion, id: 99, expanded: false }] }), signature)
  assert.equal(authoringDraftSignature({ ...blank, displayOrder: '0', isRequired: true }), signature)
  for (const edits of [{ title: 'Title' }, { selectedBatchId: 2 }, { displayOrder: '2' },
    { categories: [] }, { questions: [{ ...blankQuestion, correct: 0 }] }]) {
    assert.notEqual(authoringDraftSignature({ ...blank, ...edits }), signature)
  }
})

test('writes report storage failure and reject another account; new settings-only edits recover', () => {
  const entries = new Map([['sb-user', JSON.stringify({ id: 1, role: 'admin' })]])
  const storage = { getItem: key => entries.get(key) ?? null, setItem: (key, value) => entries.set(key, value) }
  const key = authoringDraftKey(storage)
  assert.ok(writeAuthoringDraft(key, { ...blank, selectedBatchId: 2 }, storage))
  const draft = readAuthoringDraft(key, storage)
  assert.equal(draft.version, 2)
  assert.equal(isRecoverableAuthoringDraft(draft, shared), true)
  assert.equal(writeAuthoringDraft('sb_assessment_draft:admin:2', blank, storage), null)
  assert.equal(writeAuthoringDraft(key, blank, { ...storage, setItem: () => { throw new Error('Quota') } }), null)
})

test('corrupt or structurally invalid saved drafts cannot crash the restore UI', () => {
  for (const raw of ['invalid', '[]', '{}', JSON.stringify({ categories: [], questions: [{ id: 1, text: [] }] })]) {
    assert.equal(readAuthoringDraft('owned', { getItem: () => raw }), null)
  }
})
