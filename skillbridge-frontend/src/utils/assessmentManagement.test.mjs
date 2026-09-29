import test from 'node:test'
import assert from 'node:assert/strict'
import { filterAssessments, assessmentRetakeCandidate } from './assessmentManagement.js'

const assessments = [
  { id: 1, title: 'Database', batch_id: 2, batch_name: 'Blue', instructor_name: 'Ana', publication_status: 'published', is_required: true, include_in_competency: true, categories: ['Database'], availability_status: 'available', completion_rate: 50 },
  { id: 2, title: 'Networking', batch_id: 2, batch_name: 'Blue', instructor_name: 'Ana', publication_status: 'draft', is_required: false, include_in_competency: false, categories: ['Networking'], availability_status: 'draft', completion_rate: 0 },
  { id: 3, title: 'Database advanced', batch_id: 3, batch_name: 'Green', instructor_name: 'Ben', publication_status: 'published', is_required: false, include_in_competency: true, categories: ['Database', 'Networking'], availability_status: 'overdue', completion_rate: 100 },
]

test('instructor and admin assessment filters retain backend order', () => {
  assert.deepEqual(filterAssessments(assessments, { category: 'Database' }).map(a => a.id), [1, 3])
  assert.deepEqual(filterAssessments(assessments, { batch: 2, state: 'published', required: 'required' }).map(a => a.id), [1])
  assert.deepEqual(filterAssessments(assessments, { instructor: 'Ben', completion: 'complete' }).map(a => a.id), [3])
  assert.deepEqual(filterAssessments(assessments, { included: 'excluded', availability: 'draft' }).map(a => a.id), [2])
})

test('retake approval resolves only an exact finalized assessment attempt', () => {
  const student = { assessmentResults: [
    { id: 1, attempt_status: 'in_progress' },
    { id: 2, attempt_status: 'stopped', retake_allowed: false },
    { id: 3, attempt_status: 'submitted', retake_allowed: false },
  ] }
  assert.equal(assessmentRetakeCandidate(student, 1), null)
  assert.equal(assessmentRetakeCandidate(student, 4), null)
  assert.equal(assessmentRetakeCandidate(student, 2).id, 2)
  assert.equal(assessmentRetakeCandidate(student, 3).id, 3)
})
