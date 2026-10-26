import test from 'node:test'
import assert from 'node:assert/strict'
import { activityRange, activityReport, analyticsSourceUrl } from './analyticsActivity.js'

const source = {
  generated_at: '2026-10-25T23:30:00Z', summary: { students: 3 }, students: [{ id: 1 }],
  scope: { batch_ids: [1], activity_period: 'all_time', date_from: '2024-02-29', date_to: '2026-10-26' },
  activity_days: [{ date: '2024-02-29', submissions: 2 }, { date: '2026-09-30', submissions: 3 },
    { date: '2026-10-01', submissions: 1 }, { date: '2026-10-25', submissions: 4 }, { date: '2026-10-26', submissions: 2 }],
}
const report = query => activityReport(source, new URLSearchParams(query)).data

test('activity dates and groups share one server scope key; authoritative scope changes remain separate', () => {
  assert.equal(analyticsSourceUrl(new URLSearchParams('batch_id=1&date_from=2026-01-01&date_to=2026-01-31&group=activity&activity_period=custom')),
    analyticsSourceUrl(new URLSearchParams('batch_id=1&activity_period=daily')))
  assert.notEqual(analyticsSourceUrl(new URLSearchParams('course=BSIT')), analyticsSourceUrl(new URLSearchParams('course=BSIS')))
})

test('loaded daily counts filter exactly in Manila without mutating current report summaries or scope', () => {
  const monthly = report('')
  assert.equal(monthly.scope.date_from, '2026-10-01')
  assert.equal(monthly.scope.date_to, '2026-10-26')
  assert.equal(monthly.activity.reduce((sum, row) => sum + row.submissions, 0), 7)
  assert.equal(monthly.summary, source.summary)
  assert.equal(monthly.students, source.students)
  assert.equal(source.scope.activity_period, 'all_time')
  assert.deepEqual(report('activity_period=daily').activity, [{ date: '2026-10-26', submissions: 2 }])
  assert.equal(report('activity_period=weekly').scope.date_from, '2026-10-26')
})

test('local yearly/all-time/custom totals use exact buckets and sortable dates', () => {
  const yearly = report('activity_period=yearly')
  assert.equal(yearly.scope.activity_interval, 'month')
  assert.equal(yearly.activity.length, 10)
  assert.equal(yearly.activity[8].submissions, 3)
  assert.equal(yearly.activity[9].submissions, 7)
  assert.equal(report('activity_period=all_time').activity.reduce((sum, row) => sum + row.submissions, 0), 12)
  assert.deepEqual(report('date_from=2024-02-29&date_to=2024-02-29').activity, [{ date: '2024-02-29', submissions: 2 }])
  const old = activityReport({ ...source, activity_days: [{ date: '1900-01-01', submissions: 1 }] }, new URLSearchParams('activity_period=all_time')).data
  assert.equal(old.scope.activity_interval, 'year')
  assert.equal(old.activity.length, 127)
})

test('invalid/future/oversized URLs fail visibly and old snapshots cannot pretend to contain all history', () => {
  for (const query of ['activity_period=bad', 'activity_period=monthly&date_from=2026-10-01',
    'date_from=2026-02-30', 'date_from=2026-10-27', 'date_to=2026-10-27', 'date_from=2020-01-01']) {
    assert.ok(activityRange(new URLSearchParams(query), '2026-10-26').error, query)
  }
  assert.ok(activityReport({ ...source, activity_days: undefined }, new URLSearchParams()).error)
  assert.equal(activityReport(null, new URLSearchParams()).data, null)
})
