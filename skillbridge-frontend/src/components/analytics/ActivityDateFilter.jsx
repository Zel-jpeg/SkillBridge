import { useState } from 'react'
import { toManilaInput } from '../../utils/assessmentDates'

export default function ActivityDateFilter({ scope, onApply, fieldClass }) {
  const [from, setFrom] = useState(scope.date_from)
  const [to, setTo] = useState(scope.date_to)
  const [error, setError] = useState('')
  const today = toManilaInput(new Date()).slice(0, 10)
  function submit(event) {
    event.preventDefault()
    let message = ''
    if (!from || !to) message = 'Choose both a start date and an end date.'
    else if (from > to) message = 'The start date must be on or before the end date.'
    else if (to > today) message = 'The end date cannot be in the future.'
    else if ((Date.parse(to) - Date.parse(from)) / 86400000 > 365) message = 'Choose a range of 366 days or less.'
    setError(message)
    if (!message) onApply({ date_from: from, date_to: to })
  }
  return <form noValidate onSubmit={submit} className="space-y-3" aria-label="Submission activity dates">
    <div className="flex flex-wrap items-end gap-4">
      {[['Activity from', from, setFrom], ['Activity through', to, setTo]].map(([label, value, setter]) => <label key={label} className="min-w-0 flex-1 basis-40 text-xs font-medium text-gray-700 dark:text-gray-300">{label}<input className={`${fieldClass} mt-2`} type="date" value={value} max={today} aria-invalid={!!error} aria-describedby={error ? 'activity-date-error' : undefined} onChange={event => { setter(event.target.value); setError('') }} /></label>)}
      <button type="submit" className="min-h-12 rounded-xl bg-green-700 px-4 py-2 text-xs font-semibold text-white hover:bg-green-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-green-600">Apply dates</button>
    </div>
    {error && <p id="activity-date-error" role="alert" className="text-xs text-rose-700 dark:text-rose-300">{error}</p>}
    <p className="text-xs leading-5 text-gray-500 dark:text-gray-400">Dates affect submission activity only. Showing {scope.date_from} to {scope.date_to}.</p>
  </form>
}
