import { useId, useRef, useState } from 'react'
import DialogShell from '../DialogShell'
import api from '../../api/axios'
import { requestErrorMessage } from '../../api/requestErrors'
import { invalidateCache } from '../../hooks/useApi'
import { manilaDateTime } from '../../utils/assessmentDates'
import { useToast } from '../../context/ToastContext'

const control = 'min-h-10 rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs focus-visible:outline-2 focus-visible:outline-green-600 disabled:opacity-50 dark:border-gray-700 dark:bg-gray-900'

export default function GrantExtraTime({ studentId, assessment }) {
  const [open, setOpen] = useState(false)
  const [minutes, setMinutes] = useState('10')
  const [reason, setReason] = useState('')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const pending = useRef(false)
  const nonce = useRef(null)
  const id = useId()
  const { showToast } = useToast()
  function start() { setOpen(true); setReason(''); setError(''); setMinutes('10'); nonce.current = crypto.randomUUID() }
  async function submit(event) {
    event.preventDefault()
    if (pending.current) return
    pending.current = true; setSaving(true); setError('')
    try {
      await api.post(`/api/instructor/assessments/${assessment.id}/students/${studentId}/extra-time/`, {
        minutes: Number(minutes), reason: reason.trim(), request_id: nonce.current,
        attempt_started_at: assessment.attempt_started_at,
      })
      const urls = ['/api/instructor/assessments/', '/api/admin/management-actions/']
      if (assessment.batch_id) urls.push(`/api/instructor/batches/${assessment.batch_id}/students/`)
      urls.forEach(invalidateCache)
      window.dispatchEvent(new CustomEvent('sse:data_changed', { detail: { urls } }))
      showToast('Extra time granted to this attempt. The student countdown will synchronize with the server.')
      setOpen(false)
    } catch (err) { setError(requestErrorMessage(err, { mutation: true })) }
    finally { pending.current = false; setSaving(false) }
  }
  return <div className="mt-3 space-y-2">
    <p className="text-xs text-gray-500 dark:text-gray-400">Attempt cutoff: {manilaDateTime(assessment.attempt_timing.deadline_at)} · Manila</p>
    <button type="button" className={control} onClick={start}>Grant extra time</button>
    {open && <DialogShell size="confirm" title="Grant extra time to this attempt" description={`Extend the current attempt for ${assessment.title}. This does not change the standard duration for other students.`} onClose={() => { if (!pending.current) setOpen(false) }} footer={<div className="flex gap-2"><button className={control} disabled={saving} onClick={() => setOpen(false)}>Cancel</button><button className={`${control} bg-green-700 font-semibold text-white dark:bg-green-700`} type="submit" form={id} disabled={saving || !reason.trim() || !Number.isInteger(Number(minutes)) || Number(minutes) < 1 || Number(minutes) > 180}>{saving ? 'Granting…' : 'Confirm extra time'}</button></div>}>
      <form id={id} onSubmit={submit} className="space-y-4 p-4">
        <label className="block text-xs font-semibold">Extra minutes<input type="number" min="1" max="180" step="1" required disabled={saving} className={`${control} mt-1 w-full`} value={minutes} onChange={event => { setMinutes(event.target.value); nonce.current = crypto.randomUUID() }} /></label>
        <label className="block text-xs font-semibold">Reason<textarea required maxLength={500} disabled={saving} className={`${control} mt-1 min-h-24 w-full`} value={reason} onChange={event => { setReason(event.target.value); nonce.current = crypto.randomUUID() }} /></label>
        <p className="text-xs leading-5 text-gray-500 dark:text-gray-400">The actor, reason and new cutoff are recorded. Extra time cannot pass the assessment deadline; extend that deadline first if needed. Expired or finalized attempts require the reviewed retake workflow.</p>
        {error && <p role="alert" className="text-xs text-rose-700 dark:text-rose-300">{error}</p>}
      </form>
    </DialogShell>}
  </div>
}
