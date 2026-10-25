import { CalendarDateTime, parseDateTime } from '@internationalized/date'

export function parseScheduleValue(value) {
  if (!value) return null
  try { return parseDateTime(value) } catch { return null }
}

// Keep Manila wall-clock values in the existing minute-precision API form contract.
export function scheduleValue(date, time) {
  if (!date || !time) return ''
  return new CalendarDateTime(date.year, date.month, date.day, time.hour, time.minute).toString().slice(0, 16)
}

export function scheduleLabel(value) {
  const date = parseScheduleValue(value)
  return date ? new Intl.DateTimeFormat('en-PH', { timeZone: 'Asia/Manila', dateStyle: 'medium', timeStyle: 'short', hour12: true }).format(date.toDate('Asia/Manila')) : 'Select date and time'
}
