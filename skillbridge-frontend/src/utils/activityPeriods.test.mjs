import test from 'node:test'
import assert from 'node:assert/strict'
import { activityDateLabel, activityPeriodLabel } from './activityPeriods.js'
import { analyticsTable, analyticsUrl } from './analytics.js'

test('period query reaches the analytics API independently of record selection', () => {
  assert.equal(analyticsUrl(new URLSearchParams('activity_period=all_time&batch_id=2&group=activity')), '/api/management/analytics/?batch_id=2&activity_period=all_time')
  assert.equal(activityPeriodLabel('monthly'), 'Monthly (this month)')
})

test('month/year bucket tables use matching labels and preserve counts', () => {
  const data = { activity: [{ date: '2024-02-01', submissions: 4 }], scope: { activity_interval: 'month' } }
  const monthly = analyticsTable(data, 'assessments', 'activity')
  assert.equal(monthly.columns[0], 'Philippine month')
  assert.equal(monthly.rows[0][0], '2024-02')
  assert.equal(activityDateLabel('2024-02-01', 'year'), '2024')
  assert.equal(monthly.rows[0][1], 4)
  assert.equal(analyticsTable({ ...data, scope: { activity_interval: 'year' } }, 'assessments', 'activity').rows[0][0], '2024')
})
