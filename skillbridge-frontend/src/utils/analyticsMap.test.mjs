import test from 'node:test'
import assert from 'node:assert/strict'
import { selectAnalyticsStudents, analyticsSelectionLabel, analyticsUrl, analyticsTable } from './analytics.js'

const rows = [
  { id: 1, batch_id: 1, required_complete: true, placement_status: 'approved', partner_city_id: 'city1', partner_province_id: 'province1', partner_pin_status: 'mapped' },
  { id: 2, batch_id: 1, required_complete: false, placement_status: 'approved', partner_city_id: '', partner_province_id: 'province1', partner_pin_status: 'missing' },
  { id: 3, batch_id: 2, required_complete: true, placement_status: 'approved_other_batch', partner_city_id: 'city1', partner_province_id: 'province1' },
]
const data = { students: rows, placement_students: rows, placement_map: { areas: { city: [{ id: 'city1', name: 'City One' }] } } }
test('map drilldowns qualify approval and exact canonical identity', () => {
  assert.deepEqual(selectAnalyticsStudents(data, 'placements', 'map:city:city1').map(row => row.id), [1])
  assert.deepEqual(selectAnalyticsStudents(data, 'placements', 'map:city:unknown').map(row => row.id), [2])
  assert.deepEqual(selectAnalyticsStudents(data, 'placements', 'map:pins:missing').map(row => row.id), [2])
  assert.equal(analyticsSelectionLabel(data, 'map:city:city1'), 'Approved placements · City One')
})
test('batch segments preserve both batch and completion condition', () => {
  assert.deepEqual(selectAnalyticsStudents(data, 'assessments', 'batch-score:1:complete').map(row => row.id), [1])
  assert.deepEqual(selectAnalyticsStudents(data, 'assessments', 'batch-score:1:incomplete').map(row => row.id), [2])
})
test('presentation state stays out of API requests; explicit matching scope is retained', () => {
  const url = analyticsUrl(new URLSearchParams('map_style=boundaries&area_level=province&group=map:city:city1&batch_scope=matching'))
  assert.equal(url, '/api/management/analytics/?batch_scope=matching')
})

test('saved suggestion drilldowns and exports use the allocated partner, separately from approvals', () => {
  const suggestedRow = { ...rows[1], placement_status: 'suggested', partner_city_id: 'city1', partner_pin_status: 'missing', name: 'Example', school_id: 'S1', course: 'BSIT', batch: 'Batch', instructor: 'Owner', required_completed: 1, required_total: 1, recommendations_locked: false, company: 'Chosen partner', position: 'Chosen position', suggested_recommendation: { ranking_policy: 'legacy-hybrid', match_score: 30 }, scores: {}, reasons: [] }
  const report = { ...data, skills: [], suggested_students: [suggestedRow], suggested_placement_map: { areas: { city: [{ id: 'city1', name: 'City One' }] } } }
  assert.deepEqual(selectAnalyticsStudents(report, 'placements', 'map-suggested:city:city1'), [suggestedRow])
  assert.deepEqual(selectAnalyticsStudents(report, 'placements', 'map-suggested:pins:missing'), [suggestedRow])
  assert.equal(analyticsSelectionLabel(report, 'map-suggested:city:city1'), 'Suggested placements · City One')
  const table = analyticsTable(report, 'placements', 'map-suggested:city:city1', [suggestedRow])
  assert.equal(table.columns[8], 'Suggested partner')
  assert.equal(table.rows[0][10], '30%')
})
