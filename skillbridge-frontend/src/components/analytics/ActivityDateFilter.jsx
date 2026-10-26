import { lazy, Suspense, useId, useState } from 'react'
import { toManilaInput } from '../../utils/assessmentDates'
import { ACTIVITY_PERIODS, activityDateLabel, activityPeriodLabel } from '../../utils/activityPeriods'

const ScheduleDateTimePicker = lazy(() => import('../instructor/ScheduleDateTimePicker'))

export default function ActivityDateFilter({ scope, onApply, updating = false, error: reportError, onRetry }) {
  const errorId = useId()
  const [from, setFrom] = useState(scope.date_from)
  const [to, setTo] = useState(scope.date_to)
  const [error, setError] = useState('')
  const [period, setPeriod] = useState(scope.activity_period || 'custom')
  const scopeKey = `${scope.activity_period}:${scope.date_from}:${scope.date_to}`
  const [appliedKey, setAppliedKey] = useState(scopeKey)
  // Preserve the form and focused trigger when applied values change. Refreshes
  // with unchanged dates must not discard a user's unsubmitted calendar draft.
  if (appliedKey !== scopeKey) {
    setAppliedKey(scopeKey)
    setFrom(scope.date_from)
    setTo(scope.date_to)
    setPeriod(scope.activity_period || 'custom')
    setError('')
  }
  const today = toManilaInput(new Date()).slice(0, 10)
  function choosePeriod(next) {
    setPeriod(next)
    setError('')
    if (next === 'custom') return
    if (next === scope.activity_period) { setFrom(scope.date_from); setTo(scope.date_to) }
    onApply({ activity_period: next, date_from: '', date_to: '' })
  }
  function submit(event) {
    event.preventDefault()
    if (period !== 'custom') {
      onApply({ activity_period: period, date_from: '', date_to: '' })
      return
    }
    let message = ''
    if (!from || !to) message = 'Choose both a start date and an end date.'
    else if (from > to) message = 'The start date must be on or before the end date.'
    else if (to > today) message = 'The end date cannot be in the future.'
    else if ((Date.parse(to) - Date.parse(from)) / 86400000 > 365) message = 'Choose a range of 366 days or less.'
    setError(message)
    if (!message) onApply({ activity_period: 'custom', date_from: from, date_to: to })
  }
  return <form noValidate onSubmit={submit} className="space-y-3" aria-label="Submission activity dates">
    <div className="flex flex-wrap items-end gap-4">
      <label className="flex min-w-0 flex-1 basis-48 flex-col gap-1.5 text-xs font-medium text-gray-600 dark:text-gray-300">Activity period<select aria-label="Activity period" value={period} onChange={event => choosePeriod(event.target.value)} className="min-h-11 w-full min-w-0 rounded-lg border border-gray-200 bg-white px-3 text-xs dark:border-gray-700 dark:bg-gray-800 dark:text-white">{ACTIVITY_PERIODS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
      {[['Activity from', from, setFrom], ['Activity through', to, setTo]].map(([label, value, setter]) => <div key={label} className="min-w-0 flex-1 basis-48"><Suspense fallback={<p className="text-xs text-gray-500">Loading date selector…</p>}><ScheduleDateTimePicker dateOnly label={label} value={value} invalid={!!error} describedBy={error ? errorId : undefined} onChange={next => { setter(next); setPeriod('custom'); setError('') }} /></Suspense></div>)}
      <button type="submit" className="min-h-10 rounded-lg bg-green-700 px-4 py-2 text-xs font-semibold text-white hover:bg-green-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-green-600">Apply dates</button>
    </div>
    {error && <p id={errorId} role="alert" className="text-xs text-rose-700 dark:text-rose-300">{error}</p>}
    <div className="min-h-6 text-xs leading-5" role="status" aria-live="polite">{reportError ? <span className="text-amber-800 dark:text-amber-300">Activity could not refresh. Showing the last loaded results. <button type="button" className="rounded font-semibold underline" onClick={onRetry}>Retry activity</button></span> : updating ? <span className="inline-flex items-center gap-2 text-green-800 dark:text-green-300"><span aria-hidden="true" className="h-3 w-3 rounded-full border-2 border-green-300 border-t-green-700 motion-safe:animate-spin" />Updating submission activity… Previous results stay visible.</span> : <span className="text-gray-500 dark:text-gray-400">Dates and periods filter loaded submissions instantly.</span>}</div>
    <p className="text-xs leading-5 text-gray-500 dark:text-gray-400">Showing <strong className="font-medium">{activityPeriodLabel(scope.activity_period)}</strong> · {activityDateLabel(scope.date_from)} to {activityDateLabel(scope.date_to)} · Asia/Manila. {scope.activity_interval === 'month' ? 'Counts are grouped by month. ' : scope.activity_interval === 'year' ? 'Counts are grouped by year. ' : 'Counts are grouped by day. '}Weekly starts Monday. These controls affect submission activity only.</p>
  </form>
}
