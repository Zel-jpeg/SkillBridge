import test from 'node:test'
import assert from 'node:assert/strict'
import { assessmentPage, assessmentViewReducer, initialAssessmentView, assessmentDraft, assessmentEditorReducer, draftIsDirty, initialEditor, validateAssessmentDraft } from './adminAssessmentState.js'

const records = Array.from({ length: 27 }, (_, i) => ({ id: i + 1, title: `Assessment ${i + 1}`, instructor_name: i % 2 ? 'Alex' : 'Sam', batch_id: 2, batch_name: 'Blue', publication_status: 'published', categories: ['Database'], completion_rate: i % 2 ? 100 : 25, is_required: true, include_in_competency: true, duration_minutes: 30, display_order: i, available_at: null, due_at: null, created_at: '2026-10-01T00:00:00Z' }))

test('a staged multi-filter apply commits together, resets pagination and preserves list view', () => {
  const state = { ...initialAssessmentView, view: 'list', page: 4 }
  const applied = assessmentViewReducer(state, { type: 'filters', value: { search: 'Database', batch: '2', required: 'required' } })
  assert.equal(applied.page, 1)
  assert.equal(applied.view, 'list')
  assert.equal(applied.filters.search, 'Database')
  assert.equal(applied.filters.batch, '2')
  assert.equal(applied.filters.required, 'required')
  assert.equal(applied.filters.state, 'all')
  assert.equal(state.page, 4)
})

test('filtering and immutable tie-break ordering precede slicing in both views', () => {
  const page = assessmentPage(records, { instructor: 'Alex', category: 'Database', completion: 'complete' }, 2)
  assert.equal(page.total, 13)
  assert.deepEqual(page.records.map(a => a.id), [6, 4, 2])
  assert.deepEqual(records.slice(0, 2).map(a => a.id), [1, 2])
  const changed = records.map(a => ({ ...a, completion_rate: 100 }))
  assert.deepEqual(assessmentPage(changed, {}, 1).records.map(a => a.id), assessmentPage(records, {}, 1).records.map(a => a.id))
})

test('views preserve page and filters; every filter/reset returns to page one', () => {
  const state = { ...initialAssessmentView, page: 3 }
  const list = assessmentViewReducer(state, { type: 'view', value: 'list' })
  assert.equal(list.page, 3)
  assert.equal(list.filters, state.filters)
  for (const key of Object.keys(state.filters)) assert.equal(assessmentViewReducer(state, { type: 'filter', key, value: 'anything' }).page, 1)
  const published = assessmentViewReducer(state, { type: 'filter', key: 'state', value: 'published' })
  const draft = assessmentViewReducer(published, { type: 'filter', key: 'state', value: 'draft' })
  assert.equal(draft.filters.state, 'draft')
  assert.equal(assessmentViewReducer(list, { type: 'reset' }).view, 'list')
})

test('page clamps on live removals, empty results and oversized requested pages', () => {
  assert.equal(assessmentPage(records.slice(0, 11), {}, 3).page, 2)
  assert.equal(assessmentPage([], {}, 3).page, 1)
  assert.deepEqual(assessmentPage(records, { search: 'missing' }, 2).records, [])
  assert.equal(assessmentPage(records, {}, 0).page, 1)
  assert.equal(assessmentPage(records, {}, 3).records.length, 7)
})

test('remote changes update pristine settings, but never overwrite a dirty draft', () => {
  const original = records[0]
  const state = initialEditor(original)
  const updated = { ...original, title: 'Remote edit', due_at: '2026-10-20T00:00:00Z' }
  assert.equal(assessmentEditorReducer(state, { type: 'remote', assessment: updated }).draft.title, 'Remote edit')
  const dirty = assessmentEditorReducer(state, { type: 'edit', draft: { ...state.draft, title: 'Unsaved edit' } })
  assert.equal(assessmentEditorReducer(dirty, { type: 'remote', assessment: updated }), dirty)
  assert.equal(draftIsDirty(dirty.draft, dirty.baseline), true)
  for (const type of ['saved', 'reset']) {
    const next = assessmentEditorReducer(dirty, { type, assessment: updated })
    assert.equal(next.draft.title, 'Remote edit')
    assert.equal(draftIsDirty(next.draft, next.baseline), false)
  }
})

test('settings validate title, integer duration/order, Manila schedule and preserve booleans', () => {
  const valid = assessmentDraft(records[0])
  assert.deepEqual(validateAssessmentDraft(valid), {})
  const errors = validateAssessmentDraft({ ...valid, title: ' ', duration_minutes: '0.5', display_order: '', available_at: '2026-10-20T10:00', due_at: '2026-10-20T09:00' })
  assert.deepEqual(Object.keys(errors).sort(), ['display_order', 'due_at', 'duration_minutes', 'title'])
  assert.equal(valid.is_required, true)
  assert.equal(assessmentDraft({ ...records[0], available_at: '2026-10-20T00:00:00Z' }).available_at, '2026-10-20T08:00')
})
