import { useEffect, useId, useRef, useState } from 'react'
import DialogShell from '../DialogShell'
import { nameFromEmail } from '../../utils/formatters'

export default function AddInstructorModal({ existingInstructors = [], onClose, onAdd }) {
  const [name, setName] = useState('')
  const [nameEdited, setNameEdited] = useState(false)
  const [email, setEmail] = useState('')
  const [instructorId, setInstructorId] = useState('')
  const [department, setDepartment] = useState('Institute of Computing')
  const [courses, setCourses] = useState('BSIT / BSIS')
  const [errors, setErrors] = useState({})
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState('')
  const pending = useRef(false)
  const emailInput = useRef(null)
  const id = useId()
  const normalizedEmail = email.trim().toLowerCase()

  // The shared child dialog is open before this parent effect runs.
  useEffect(() => { emailInput.current?.focus() }, [])

  function close() { if (!pending.current) onClose() }

  function validate() {
    const next = {}
    if (!name.trim()) next.name = 'Full name is required.'
    if (!normalizedEmail) next.email = 'Email is required.'
    else if (!normalizedEmail.endsWith('@dnsc.edu.ph') || normalizedEmail.split('@').length !== 2 ||
      !normalizedEmail.split('@')[0] || /\s/.test(normalizedEmail)) next.email = 'Must be a @dnsc.edu.ph email.'
    if (!instructorId.trim()) next.instructorId = 'Instructor ID is required.'
    else if (existingInstructors.some(item => item.instructorId === instructorId.trim())) next.instructorId = 'ID already in use.'
    setErrors(next)
    return Object.keys(next).length === 0
  }

  async function handleSubmit(event) {
    event.preventDefault()
    if (pending.current || !validate()) return
    pending.current = true
    setSubmitError(''); setSubmitting(true)
    try {
      const result = await onAdd({ name: name.trim(), email: normalizedEmail,
        instructorId: instructorId.trim(), department, courses })
      if (result?.ok === false) setSubmitError(result.message || 'Instructor was not saved.')
      else onClose()
    } catch {
      setSubmitError('The save could not be confirmed. Refresh the current records before trying again.')
    } finally { pending.current = false; setSubmitting(false) }
  }

  const field = key => ({ id: `${id}-${key}`, 'aria-invalid': Boolean(errors[key]),
    'aria-describedby': [key === 'name' ? `${id}-name-hint` : '', errors[key] ? `${id}-${key}-error` : ''].filter(Boolean).join(' ') || undefined,
    className: `min-h-11 w-full rounded-xl border bg-white px-3 py-2 text-xs text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-green-500 dark:bg-gray-800 dark:text-white dark:placeholder:text-gray-600 ${errors[key] ? 'border-rose-400' : 'border-gray-300 dark:border-gray-600'}` })
  const label = 'mb-1 block text-xs font-medium text-gray-700 dark:text-gray-300'
  const error = key => errors[key] && <p id={`${id}-${key}-error`} className="mt-1 text-xs text-rose-700 dark:text-rose-300">{errors[key]}</p>

  return <DialogShell title="Add Instructor" description="Create approved access with DNSC Google sign-in."
    size="confirm" onClose={close} closeLabel="Close add instructor" closeDisabled={submitting}
    footer={<div className="flex gap-2">
      <button type="button" disabled={submitting} onClick={close} className="min-h-11 flex-1 rounded-xl border border-gray-300 px-3 py-2 text-xs font-medium hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-gray-600 dark:hover:bg-gray-800">Cancel</button>
      <button type="submit" form={`${id}-form`} disabled={submitting} className="min-h-11 flex-1 rounded-xl bg-green-600 px-3 py-2 text-xs font-medium text-white hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-50">{submitting ? 'Adding...' : 'Add Instructor'}</button>
    </div>}>
    <form id={`${id}-form`} onSubmit={handleSubmit} noValidate className="min-h-0 space-y-4 overflow-y-auto p-5 text-xs">
      {submitError && <p role="alert" className="text-rose-700 dark:text-rose-300">{submitError}</p>}
      <fieldset disabled={submitting} className="min-w-0 space-y-4">
        <div><label htmlFor={`${id}-email`} className={label}>DNSC Email</label>
          <input {...field('email')} ref={emailInput} type="email" autoComplete="email" maxLength={254} value={email}
            onChange={event => {
              const value = event.target.value
              setEmail(value); setErrors(current => ({ ...current, email: '' }))
              if (!nameEdited) setName(nameFromEmail(value))
            }} placeholder="e.g. mtreyes@dnsc.edu.ph" />{error('email')}
        </div>
        <div><label htmlFor={`${id}-name`} className={label}>Full Name</label>
          <input {...field('name')} autoComplete="name" maxLength={255} value={name}
            onChange={event => { setName(event.target.value); setNameEdited(true); setErrors(current => ({ ...current, name: '' })) }}
            placeholder="e.g. Ma. Lourdes T. Reyes" />{error('name')}
          <p id={`${id}-name-hint`} className="mt-1 text-xs leading-5 text-gray-500 dark:text-gray-400">Check spelling, spacing and capitalization before saving.</p>
        </div>
        <div><label htmlFor={`${id}-instructorId`} className={label}>Instructor ID</label>
          <input {...field('instructorId')} maxLength={20} value={instructorId}
            onChange={event => { setInstructorId(event.target.value); setErrors(current => ({ ...current, instructorId: '' })) }}
            placeholder="e.g. 2018-00042" />{error('instructorId')}
        </div>
        <div><label htmlFor={`${id}-department`} className={label}>Department</label>
          <input {...field('department')} maxLength={255} value={department} onChange={event => setDepartment(event.target.value)} placeholder="e.g. Institute of Computing" />
        </div>
        <fieldset className="min-w-0"><legend className={label}>Courses Handled</legend>
          <div className="flex gap-2">{[{ value: 'BSIT', label: 'BSIT only' }, { value: 'BSIS', label: 'BSIS only' }, { value: 'BSIT / BSIS', label: 'Both' }].map(option =>
            <button key={option.value} type="button" aria-pressed={courses === option.value} onClick={() => setCourses(option.value)}
              className={`min-h-11 flex-1 rounded-xl border px-2 py-2 text-xs font-medium ${courses === option.value ? 'border-green-600 bg-green-600 text-white' : 'border-gray-300 text-gray-700 hover:border-green-500 dark:border-gray-600 dark:text-gray-200'}`}>{option.label}</button>
          )}</div>
        </fieldset>
      </fieldset>
    </form>
  </DialogShell>
}
