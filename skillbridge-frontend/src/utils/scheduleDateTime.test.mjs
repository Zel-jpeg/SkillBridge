import test from 'node:test'
import assert from 'node:assert/strict'
import { Time, toCalendarDate } from '@internationalized/date'
import { parseScheduleValue, scheduleLabel, scheduleValue } from './scheduleDateTime.js'
import { manilaApiDate } from './assessmentDates.js'

test('calendar and time selection preserve exact Manila minutes in API values', () => {
  const date = toCalendarDate(parseScheduleValue('2026-11-01T08:17'))
  const value = scheduleValue(date, new Time(17, 42))
  assert.equal(value, '2026-11-01T17:42')
  assert.equal(manilaApiDate(value), '2026-11-01T17:42:00+08:00')
  assert.equal(parseScheduleValue(value).toDate('Asia/Manila').toISOString(), '2026-11-01T09:42:00.000Z')
})

test('cleared, partial and malformed schedules remain unset', () => {
  assert.equal(parseScheduleValue(''), null)
  assert.equal(parseScheduleValue('invalid'), null)
  assert.equal(scheduleValue(null, new Time(9)), '')
  assert.equal(scheduleValue(toCalendarDate(parseScheduleValue('2026-11-01T08:17')), null), '')
  assert.equal(manilaApiDate(''), null)
  assert.equal(scheduleLabel(''), 'Select date and time')
})

test('display uses Manila wall-clock time, including midnight and noon', () => {
  assert.match(scheduleLabel('2026-11-01T00:05'), /12:05\s*am/i)
  assert.match(scheduleLabel('2026-11-01T12:05'), /12:05\s*pm/i)
  assert.match(scheduleLabel('2026-11-01T23:59'), /11:59\s*pm/i)
})
