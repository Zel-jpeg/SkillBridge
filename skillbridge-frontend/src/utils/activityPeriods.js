export const ACTIVITY_PERIODS = [
  ['daily', 'Daily (today)'], ['weekly', 'Weekly (this week)'],
  ['monthly', 'Monthly (this month)'], ['yearly', 'Yearly (this year)'],
  ['all_time', 'All time'], ['custom', 'Custom dates'],
]

export function activityPeriodLabel(period) {
  return ACTIVITY_PERIODS.find(([value]) => value === period)?.[1] || 'Custom dates'
}

export function activityDateLabel(value, interval = 'day') {
  return new Intl.DateTimeFormat('en-PH', {
    timeZone: 'Asia/Manila', year: 'numeric',
    ...(interval !== 'year' && { month: 'short' }),
    ...(interval === 'day' && { day: 'numeric' }),
  }).format(new Date(`${value}T00:00:00+08:00`))
}
