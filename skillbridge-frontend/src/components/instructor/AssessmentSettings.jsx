import { lazy, Suspense, useId } from 'react'
import { assessmentLocks } from '../../utils/assessmentPolicy'
import { LockIcon } from '../Icons'
import { AssessmentTimingGuidance } from '../assessment/AssessmentPolicyNotice'

const ScheduleDateTimePicker = lazy(() => import('./ScheduleDateTimePicker'))

const control = 'w-full min-w-0 rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 focus-visible:outline-2 focus-visible:outline-green-600 dark:border-gray-700 dark:bg-gray-800 dark:text-white'

function AssessmentSchedule({ value, field, errors, locks }) {
  return <section aria-label="Assessment schedule" className="space-y-2">
    <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 border-b border-gray-100 pb-2.5 dark:border-gray-800"><h3 className="text-sm font-semibold text-gray-900 dark:text-white">Schedule</h3><p className="text-xs text-gray-500 dark:text-gray-400">Asia/Manila · UTC+08</p></div>
    <div className="grid gap-3 sm:grid-cols-2">
      {[['available_at', 'Available at'], ['due_at', 'Due at']].map(([key, title]) => <Suspense key={key} fallback={<div className="min-w-0 space-y-1.5 text-xs text-gray-500"><span>{title}</span><div role="status" className={`${control} flex h-10 items-center`}>Loading calendar…</div></div>}><ScheduleDateTimePicker disabled={key === 'available_at' ? locks.opening : locks.deadline} label={title} value={value[key]} onChange={next => field(key, next)} error={errors[key] || (key === 'due_at' && value.available_at && value.due_at && value.due_at <= value.available_at ? 'Due date must be after the available date.' : undefined)} /></Suspense>)}
    </div>
    {locks.attempted && <p className="text-xs leading-5 text-gray-500 dark:text-gray-400">{locks.deadline ? 'Opening time is locked. A new deadline cannot be added after an attempt.' : 'Opening time is locked. The deadline can only be extended or removed.'}</p>}
    <AssessmentTimingGuidance />
  </section>
}

export default function AssessmentSettings({ value, onChange, errors = {}, variant = 'default', duration, onDurationChange, assessment = {} }) {
  const id = useId()
  const field = (key, next) => onChange({ ...value, [key]: next })
  const locks = assessmentLocks(assessment)
  if (variant === 'modal') {
    const modalControl = 'h-11 w-full min-w-0 rounded-lg border border-gray-200 bg-white px-3 text-xs font-normal text-gray-900 focus-visible:outline-2 focus-visible:outline-green-600 dark:border-gray-700 dark:bg-gray-800 dark:text-white'
    const label = 'flex min-w-0 flex-col gap-1.5 text-xs font-medium text-gray-600 dark:text-gray-300'
    return <div className="space-y-5">
      <h3 className="border-b border-gray-100 pb-2.5 text-sm font-semibold text-gray-900 dark:border-gray-800 dark:text-white">Assessment settings</h3>
      <div className="grid grid-cols-2 items-start gap-3 sm:grid-cols-[120px_minmax(0,1fr)_minmax(0,1fr)]">
        <label className={`${label} col-span-2 sm:col-span-1`}>Duration
          <span className="relative block w-30 max-w-full"><input aria-label="Duration" aria-invalid={!!errors.duration_minutes} aria-describedby={errors.duration_minutes ? `${id}-duration-error` : undefined} type="number" min="1" disabled={locks.duration} value={duration} onChange={e => onDurationChange(e.target.value)} className={`${modalControl} pr-12 disabled:cursor-not-allowed disabled:bg-gray-50 disabled:text-gray-500 dark:disabled:bg-gray-800/60 dark:disabled:text-gray-400 ${locks.duration ? 'pl-8' : ''}`} />{locks.duration && <span aria-hidden="true" className="pointer-events-none absolute inset-y-0 left-2.5 flex items-center text-gray-400"><LockIcon size={14} /></span>}<span className="pointer-events-none absolute inset-y-0 right-0 flex items-center rounded-r-lg border-l border-gray-200 bg-gray-50 px-2.5 font-normal text-gray-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-400">min</span></span>
          {errors.duration_minutes && <span id={`${id}-duration-error`} className="text-red-600 dark:text-red-400">{errors.duration_minutes}</span>}
        </label>
        <label className={label}>Publication state
          <select aria-label="Publication state" disabled={locks.publication} className={`${modalControl} disabled:cursor-not-allowed disabled:bg-gray-50 disabled:text-gray-500 dark:disabled:bg-gray-800/60 dark:disabled:text-gray-400`} value={value.publication_status} onChange={e => field('publication_status', e.target.value)}><option value="draft" disabled={locks.attempted}>Draft</option><option value="published">Published</option><option value="closed">Closed</option></select>
          {errors.publication_status && <span className="text-red-600">{errors.publication_status}</span>}
        </label>
        <label className={label}>Student display order
          <input aria-label="Student display order" className={modalControl} type="number" min="0" step="1" value={value.display_order} onChange={e => field('display_order', e.target.value)} />
          {errors.display_order && <span className="text-red-600">{errors.display_order}</span>}
        </label>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-green-100 bg-green-50/30 p-3 text-xs dark:border-green-900/60 dark:bg-green-950/15">
          <input type="checkbox" className="mt-0.5 h-4 w-4 shrink-0 accent-green-600 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-green-600" checked={value.is_required} onChange={e => field('is_required', e.target.checked)} />
          <span><span className="font-semibold text-gray-800 dark:text-gray-100">Required assessment</span><span className="mt-1 block leading-5 text-gray-500 dark:text-gray-400">Required, published assessments included in scoring must be completed before final recommendations unlock.</span></span>
        </label>
        <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-green-100 bg-green-50/30 p-3 text-xs dark:border-green-900/60 dark:bg-green-950/15">
          <input type="checkbox" className="mt-0.5 h-4 w-4 shrink-0 accent-green-600 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-green-600" checked={value.include_in_competency} onChange={e => field('include_in_competency', e.target.checked)} />
          <span><span className="font-semibold text-gray-800 dark:text-gray-100">Include in competency profile</span><span className="mt-1 block leading-5 text-gray-500 dark:text-gray-400">Completed results contribute to the combined profile. Excluded results remain visible.</span></span>
        </label>
      </div>
      <AssessmentSchedule value={value} field={field} errors={errors} locks={locks} />
    </div>
  }
  return <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
    <label className="text-xs font-semibold text-gray-700 dark:text-gray-300">Publication state
      <select disabled={locks.publication} className={`${control} mt-1`} value={value.publication_status} onChange={e => field('publication_status', e.target.value)}>
        <option value="draft" disabled={locks.attempted}>Draft</option><option value="published">Published</option><option value="closed">Closed</option>
      </select>
      {errors.publication_status && <span className="text-red-600">{errors.publication_status}</span>}
    </label>
    <label className="text-xs font-semibold text-gray-700 dark:text-gray-300">Student display order
      <input className={`${control} mt-1`} type="number" min="0" step="1" value={value.display_order} onChange={e => field('display_order', e.target.value)} />
      {errors.display_order && <span className="text-red-600">{errors.display_order}</span>}
    </label>
    <label className="flex items-start gap-2 text-xs text-gray-700 dark:text-gray-300">
      <input type="checkbox" className="mt-0.5 accent-green-600" checked={value.is_required} onChange={e => field('is_required', e.target.checked)} />
      <span><strong>Required</strong><br />Published required assessments included in competency scoring block final recommendations.</span>
    </label>
    <label className="flex items-start gap-2 text-xs text-gray-700 dark:text-gray-300">
      <input type="checkbox" className="mt-0.5 accent-green-600" checked={value.include_in_competency} onChange={e => field('include_in_competency', e.target.checked)} />
      <span><strong>Include in competency profile</strong><br />Completed optional assessments can improve the combined profile. Excluded results remain visible.</span>
    </label>
    <div className="sm:col-span-2"><AssessmentSchedule value={value} field={field} errors={errors} locks={locks} /></div>
  </div>
}
