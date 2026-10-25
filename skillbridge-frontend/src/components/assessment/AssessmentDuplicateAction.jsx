import { useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import DialogShell from '../DialogShell'
import api from '../../api/axios'
import { requestErrorMessage } from '../../api/requestErrors'
import { useApi, invalidateCache } from '../../hooks/useApi'
import { useToast } from '../../context/ToastContext'

const control = 'min-h-10 rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs text-gray-700 focus-visible:outline-2 focus-visible:outline-green-600 disabled:opacity-50 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200'

export default function AssessmentDuplicateAction({ assessment, role = 'admin', disabled = false, onSuccess }) {
  const [open, setOpen] = useState(false)
  const [title, setTitle] = useState('')
  const [batch, setBatch] = useState('')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const pending = useRef(false)
  const nonce = useRef(null)
  const navigate = useNavigate()
  const { showToast } = useToast()
  const { data: batches, error: batchError } = useApi(open ? '/api/instructor/batches/' : null)
  function start() {
    setTitle(`${assessment.title.slice(0, 248)} (copy)`); setBatch(''); setError('')
    nonce.current = crypto.randomUUID(); setOpen(true)
  }
  async function create(event) {
    event.preventDefault()
    if (pending.current || !title.trim()) return
    pending.current = true; setSaving(true); setError('')
    try {
      const { data } = await api.post(`/api/instructor/assessments/${assessment.id}/duplicate/`, {
        title: title.trim(), batch_id: batch ? Number(batch) : null, request_id: nonce.current,
      })
      invalidateCache('/api/instructor/assessments/')
      showToast(`Draft copy “${data.title}” created. Review it before publishing or including it in competency.`)
      setOpen(false); onSuccess?.()
      navigate(`/${role}/assessments`)
    } catch (err) { setError(requestErrorMessage(err, { mutation: true })) }
    finally { pending.current = false; setSaving(false) }
  }
  return <>
    <button type="button" disabled={disabled} className={`${control} cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800`} onClick={start}>Duplicate as draft</button>
    {open && <DialogShell size="confirm" title="Duplicate assessment as draft" description="Copy questions and answer keys for reuse. The original assessment and student results stay intact." onClose={() => { if (!pending.current) setOpen(false) }} footer={<div className="flex flex-wrap gap-2"><button type="button" disabled={saving} className={control} onClick={() => setOpen(false)}>Cancel</button><button type="submit" form="duplicate-assessment" disabled={saving || !title.trim()} className={`${control} bg-green-700 font-semibold text-white dark:bg-green-700 dark:text-white`}>{saving ? 'Creating…' : 'Create draft copy'}</button></div>}>
      <form id="duplicate-assessment" className="space-y-4 p-4" onSubmit={create}>
        <label className="block text-xs font-medium">Copy title<input required maxLength={255} disabled={saving} className={`${control} mt-1 w-full`} value={title} onChange={event => { setTitle(event.target.value); nonce.current = crypto.randomUUID() }} /></label>
        <label className="block text-xs font-medium">Target batch<select aria-label="Target batch" disabled={saving} className={`${control} mt-1 w-full`} value={batch} onChange={event => { setBatch(event.target.value); nonce.current = crypto.randomUUID() }}><option value="">Choose later · unassigned draft</option>{(Array.isArray(batches) ? batches : []).filter(b => b.status === 'active').map(b => <option key={b.id} value={b.id}>{b.name}{role === 'admin' && b.instructor_name ? ` · ${b.instructor_name}` : ''}</option>)}</select></label>
        {batchError && <p role="alert" className="text-xs text-rose-700">Could not load batches. You can still create an unassigned draft.</p>}
        <p className="text-xs leading-5 text-gray-500 dark:text-gray-400">The copy starts as Draft, Optional and Excluded from competency, with no schedule. No attempts, scores, retake history or placements are copied. Review its settings before publication.</p>
        {error && <p role="alert" className="text-xs text-rose-700 dark:text-rose-300">{error}</p>}
      </form>
    </DialogShell>}
  </>
}
