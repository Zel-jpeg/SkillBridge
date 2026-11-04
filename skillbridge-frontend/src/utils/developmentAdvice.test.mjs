import test from 'node:test'
import assert from 'node:assert/strict'
import { assessmentSummary } from './assessmentSummary.js'
import { developmentAdvice } from './developmentAdvice.js'

const advice = (category, percentage, options) => developmentAdvice(assessmentSummary([{ category, percentage }]).suggestions, options)[0]

test('all low categories receive course-based activities without inferred discipline', () => {
  const scores = [{ category: 'Web Development', percentage: 100 }, { category: 'Networking', percentage: 50 },
    { category: 'Programming', percentage: 50 }, { category: 'Database Management', percentage: 66.67 }]
  const source = assessmentSummary(scores).suggestions
  const before = structuredClone(source)
  const result = developmentAdvice(source)
  assert.deepEqual(result.map(item => [item.category, item.percentage]), [['Networking', 50], ['Programming', 50], ['Database Management', 66.67]])
  for (const item of result) assert.match(item.message, /course materials.*check the expected result/)
  for (const item of result) {
    assert.match(item.message, /Review your incorrect and unanswered questions in this category/)
    assert.match(item.message, /Discuss your result.*instructor/)
  }
  assert.deepEqual(source, before)
})

test('existing competency band boundaries adjust practice support without claiming mastery', () => {
  const boundaries = [[0, /worked example/], [59.99, /worked example/], [60, /step by step/], [69.99, /step by step/],
    [70, /independently/], [79.99, /independently/], [80, /compare approaches with a peer/],
    [89.99, /compare approaches with a peer/], [90, /complex requirement/], [100, /complex requirement/]]
  for (const [score, expected] of boundaries) {
    const result = advice('Programming', score)
    assert.match(result.message, expected)
    assert.doesNotMatch(result.message, /mastered|guaranteed|you failed|you lack/i)
    assert.equal(result.message.includes('incorrect and unanswered'), score < 80)
  }
})

test('unfamiliar categories and inherited object names receive the course-material fallback', () => {
  for (const category of ['Marine Navigation', 'constructor', '__proto__', 'toString']) {
    assert.match(advice(category, 50).message, /Choose one related activity from your course materials/)
    assert.doesNotMatch(advice(category, 50).message, /\[object|function/)
  }
  for (const category of ['Database', 'Web Development', 'Cyber Security']) assert.match(advice(category, 65).message, /course materials/)
})

test('arbitrary programs use the same five score-band support without category-name specialization', () => {
  for (const category of ['Enterprise planning', 'Visitor records', 'Marine ecology', 'Food preparation', 'Database']) {
    const messages = [50, 65, 75, 85, 95].map(score => {
      const result = advice(category, score)
      assert.match(result.message, /course materials.*check the expected result/)
      assert.match(result.message, /Discuss your result.*instructor/)
      assert.equal(result.category, category)
      assert.equal(result.percentage, score)
      return result.message
    })
    assert.equal(new Set(messages).size, 5)
  }
})

test('topics use matching category evidence, allow stored rounding, and stay separate from advice', () => {
  const profile = { supporting_categories: [
    { category: 'Networking', percentage: 50, tags: ['Routing'] },
    { category: ' DATABASE MANAGEMENT ', percentage: 66.7, tags: [' SQL ', 'sql', '', null, {}, 'Related   tables', 'Queries', 'Keys', 'Extra'] },
  ], development_suggestions: [{ message: 'Legacy advice must not replace current selections.' }] }
  const before = structuredClone(profile)
  const result = advice('Database Management', 66.67, { profile })
  assert.deepEqual(result.topics, ['SQL', 'Related tables', 'Queries', 'Keys'])
  assert.doesNotMatch(result.message, /SQL|Routing|Legacy advice/)
  assert.deepEqual(profile, before)
  assert.deepEqual(advice('Programming', 50, { profile }).topics, [])
  assert.deepEqual(advice('Database Management', 70, { profile }).topics, [])
})

test('missing, malformed, and old profile topic data still provides practical advice', () => {
  for (const profile of [null, {}, { supporting_categories: {} }, { supporting_categories: [null] },
    { supporting_categories: [{ category: 'Networking', percentage: 50, tags: 'Routing' }] },
    { supporting_categories: [{ category: 'Networking', tags: ['Routing'] }] }]) {
    assert.deepEqual(advice('Networking', 50, { profile }).topics, [])
    assert.match(advice('Networking', 50, { profile }).message, /course materials/)
  }
  assert.deepEqual(developmentAdvice([null, { percentage: '' }, { percentage: 101 }]), [])
  assert.deepEqual(developmentAdvice(null), [])
})

test('individual, combined and staff advice preserve evidence scope and audience', () => {
  assert.match(advice('Programming', 50).message, /your incorrect.*in this category/)
  assert.match(advice('Programming', 50, { scope: 'combined' }).message, /assessments contributing to this category/)
  const staff = advice('Programming', 50, { audience: 'staff', scope: 'combined' })
  assert.match(staff.message, /contributing assessments with the student/)
  assert.match(staff.message, /Ask the student to explain/)
  assert.doesNotMatch(staff.message, /your incorrect|your instructor/)
})

test('locked, empty and unassessed evidence produces no advice; assessed zero still does', () => {
  const scores = [{ category: 'Programming', percentage: 0 }, { category: 'Missing', percentage: null },
    { category: 'Empty', percentage: 0, max_score: 0 }]
  assert.deepEqual(developmentAdvice(assessmentSummary(scores, { locked: true }).suggestions), [])
  assert.deepEqual(developmentAdvice(assessmentSummary([]).suggestions), [])
  assert.deepEqual(developmentAdvice(assessmentSummary(scores).suggestions).map(item => item.category), ['Programming'])
})
