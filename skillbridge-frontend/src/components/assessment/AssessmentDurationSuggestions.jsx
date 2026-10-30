import { assessmentSecondaryAction } from './assessmentActionStyles'

const suggestions = [[30, '30 min'], [60, '60 min (1 hour)'], [120, '120 min (2 hours)']]

export default function AssessmentDurationSuggestions({ value, onChange, disabled = false }) {
  return <div role="group" aria-label="Suggested time limits" className="flex flex-wrap gap-2">
    {suggestions.map(([minutes, label]) => <button key={minutes} type="button"
      className={assessmentSecondaryAction} disabled={disabled}
      aria-pressed={String(value) === String(minutes)} onClick={() => onChange(String(minutes))}>{label}</button>)}
  </div>
}
