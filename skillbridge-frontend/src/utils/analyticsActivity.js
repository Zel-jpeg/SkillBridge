import { analyticsUrl } from './analytics.js'

const DAY = 86400000
const stamp = value => Date.parse(`${value}T00:00:00Z`)
const dateString = value => new Date(value).toISOString().slice(0, 10)

// One authorized snapshot per report scope. Date/period changes never refetch it.
export function analyticsSourceUrl(params) {
  const scope = new URLSearchParams(params)
  scope.delete('date_from')
  scope.delete('date_to')
  scope.delete('activity_period')
  return analyticsUrl(scope)
}

export function activityRange(params, today) {
  const hasDates = params.get('date_from') || params.get('date_to')
  const period = params.get('activity_period') || (hasDates ? 'custom' : 'monthly')
  if (!['daily', 'weekly', 'monthly', 'yearly', 'all_time', 'custom'].includes(period)) return { error: 'Choose a valid activity period.' }
  if (hasDates && period !== 'custom') return { error: 'Choose Custom dates when applying a date range.' }
  let end = today
  let start = today
  if (period === 'custom') {
    end = params.get('date_to') || today
    start = params.get('date_from') || `${end.slice(0, 7)}-01`
    if (![start, end].every(value => /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(stamp(value)) && dateString(stamp(value)) === value)) return { error: 'Activity dates must use YYYY-MM-DD.' }
    if (start > end || end > today || stamp(end) - stamp(start) > 365 * DAY) return { error: 'Activity range must be ordered, no more than 366 days, and not in the future.' }
  } else if (period === 'weekly') {
    start = dateString(stamp(today) - ((new Date(stamp(today)).getUTCDay() + 6) % 7) * DAY)
  } else if (period === 'monthly') start = `${today.slice(0, 7)}-01`
  else if (period === 'yearly') start = `${today.slice(0, 4)}-01-01`
  return { period, start, end }
}

export function activityReport(source, params) {
  if (!source) return { data: null, error: null }
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Manila', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(source.generated_at))
  const range = activityRange(params, today)
  if (range.error) return { data: source, error: range.error }
  let { start } = range
  const { end, period } = range
  // Older cached responses remain honest until their normal revalidation supplies
  // the complete series; never claim a filtered partial series is all-time data.
  if (!Array.isArray(source.activity_days)) return { data: source, error: 'Reload the report to load submission history for local date filtering.' }
  const days = source.activity_days.filter(row => row.date <= end && (period === 'all_time' || row.date >= start))
  if (period === 'all_time') start = days.reduce((first, row) => row.date < first ? row.date : first, end)
  const span = (stamp(end) - stamp(start)) / DAY
  const interval = span > 366 * 30 ? 'year' : period === 'yearly' || span > 365 ? 'month' : 'day'
  const bucket = value => interval === 'year' ? `${value.slice(0, 4)}-01-01` : interval === 'month' ? `${value.slice(0, 7)}-01` : value
  const counts = new Map()
  for (const row of days) counts.set(bucket(row.date), (counts.get(bucket(row.date)) || 0) + row.submissions)
  const activity = []
  const last = bucket(end)
  for (let cursor = bucket(start); cursor <= last;) {
    activity.push({ date: cursor, submissions: counts.get(cursor) || 0 })
    if (cursor === last) break
    if (interval === 'day') cursor = dateString(stamp(cursor) + DAY)
    else if (interval === 'year') cursor = `${String(Number(cursor.slice(0, 4)) + 1).padStart(4, '0')}-01-01`
    else {
      const year = Number(cursor.slice(0, 4)), month = Number(cursor.slice(5, 7))
      cursor = `${String(year + (month === 12 ? 1 : 0)).padStart(4, '0')}-${String(month % 12 + 1).padStart(2, '0')}-01`
    }
  }
  return { data: { ...source, activity, scope: { ...source.scope, date_from: start, date_to: end, activity_period: period, activity_interval: interval } }, error: null }
}
