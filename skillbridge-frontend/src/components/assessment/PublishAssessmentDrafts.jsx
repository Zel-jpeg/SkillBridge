import { useRef, useState } from 'react'
import api from '../../api/axios'
import { applyDataChange } from '../../hooks/useApi'
import { useToast } from '../../context/ToastContext'
import DialogShell from '../DialogShell'
import { assessmentPrimaryAction, assessmentSecondaryAction } from './assessmentActionStyles'

const control = assessmentSecondaryAction
const isDraft = item => item.publication_status === 'draft' && !item.is_archived && item.batch_id != null

export default function PublishAssessmentDrafts({ assessments }) {
  const [open, setOpen] = useState(false)
  return <>
    <button type="button" className={control} disabled={!assessments.some(isDraft)} onClick={() => setOpen(true)}>Publish drafts together</button>
    {open && <PublishDialog assessments={assessments} onClose={() => setOpen(false)} />}
  </>
}

function PublishDialog({ assessments, onClose }) {
  // Review a fixed selection; the server checks current scope and content again.
  const [drafts] = useState(() => assessments.filter(isDraft))
  const batches = [...new Map(drafts.map(item => [String(item.batch_id), item.batch_name || `Batch ${item.batch_id}`])).entries()]
  const initialBatch = batches.length === 1 ? batches[0][0] : ''
  const [batch, setBatch] = useState(initialBatch)
  const [ids, setIds] = useState(() => drafts.filter(item => String(item.batch_id) === initialBatch).map(item => item.id))
  const [reviewing, setReviewing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const pending = useRef(false)
  const { showToast } = useToast()
  const available = drafts.filter(item => String(item.batch_id) === batch)
  const selected = available.filter(item => ids.includes(item.id))
  function close() { if (!pending.current) onClose() }
  function chooseBatch(value) {
    setBatch(value)
    setIds(drafts.filter(item => String(item.batch_id) === value).map(item => item.id))
    setError('')
  }
  async function publish() {
    if (pending.current || !selected.length) return
    pending.current = true
    setSaving(true)
    setError('')
    try {
      await api.post(`/api/instructor/batches/${batch}/publish-assessments/`, { assessment_ids: selected.map(item => item.id) })
      applyDataChange({ topics: ['assessments', 'batches', 'students', 'results', 'analytics'], batch_ids: [Number(batch)] })
      showToast(`${selected.length} assessment${selected.length === 1 ? '' : 's'} published.`)
      onClose()
    } catch (failure) {
      const message = failure.response?.data?.error
      setError(typeof message === 'string' ? message : 'Publication could not be confirmed. Your selection is kept. You can retry safely.')
    } finally {
      pending.current = false
      setSaving(false)
    }
  }
  return <DialogShell title={reviewing ? 'Review assessment publication' : 'Publish drafts together'}
    description="Choose drafts in one batch and publish them together after review."
    onClose={close} closeDisabled={saving} closeLabel="Close draft publication"
    footer={<div className="flex flex-wrap justify-end gap-2">
      <button type="button" className={control} disabled={saving} onClick={reviewing ? () => { setReviewing(false); setError('') } : close}>{reviewing ? 'Back' : 'Cancel'}</button>
      <button type="button" className={assessmentPrimaryAction} disabled={saving || !selected.length}
        onClick={reviewing ? publish : () => setReviewing(true)}>{saving ? 'Publishing…' : reviewing ? `Publish ${selected.length} assessment${selected.length === 1 ? '' : 's'}` : 'Review publication'}</button>
    </div>}>
    <div className="min-h-0 space-y-4 overflow-y-auto p-5 text-xs text-gray-700 dark:text-gray-200">
      {error && <p role="alert" className="rounded-lg bg-rose-50 p-3 text-rose-800 dark:bg-rose-950 dark:text-rose-200">{error}</p>}
      <p className="leading-5">Release the initial set together so students can receive a shuffled order across the full set. Existing student assessment numbers stay the same; later releases receive new numbers.</p>
      {!reviewing ? <>
        <label className="block font-semibold">Batch<select className={`${control} mt-1 w-full`} value={batch} onChange={event => chooseBatch(event.target.value)}>
          <option value="">Choose a batch</option>{batches.map(([id, name]) => <option key={id} value={id}>{name}</option>)}
        </select></label>
        {batch && <fieldset className="space-y-2"><legend className="mb-2 font-semibold">Draft assessments ({available.length})</legend>
          <div className="flex gap-2"><button type="button" className={control} onClick={() => setIds(available.map(item => item.id))}>Select all drafts</button><button type="button" className={control} onClick={() => setIds([])}>Clear selection</button></div>
          {available.map(item => <label key={item.id} className="flex min-h-11 cursor-pointer items-start gap-3 rounded-lg border border-gray-200 p-3 dark:border-gray-700">
            <input type="checkbox" className="mt-0.5 accent-green-700" checked={ids.includes(item.id)} onChange={event => setIds(previous => event.target.checked ? [...previous, item.id] : previous.filter(id => id !== item.id))} />
            <span className="min-w-0 break-words"><strong className="block font-semibold">{item.title}</strong><span className="mt-1 block text-gray-500 dark:text-gray-400">{item.question_count} questions · {item.duration_minutes} minutes · {item.is_required ? 'Required' : 'Optional'} · {item.include_in_competency ? 'Included in competency' : 'Excluded from competency'}</span></span>
          </label>)}
        </fieldset>}
      </> : <>
        <p className="font-semibold">Batch: {batches.find(([id]) => id === batch)?.[1]}</p>
        <ul className="list-disc space-y-2 pl-5">{selected.map(item => <li key={item.id} className="break-words">{item.title}</li>)}</ul>
        <p className="rounded-lg bg-amber-50 p-3 leading-5 text-amber-900 dark:bg-amber-950 dark:text-amber-200">These assessments will become visible to enrolled students together. Each keeps its configured opening time, deadline, duration, required status and competency inclusion. Publishing required work can lock final results until that work is completed.</p>
      </>}
    </div>
  </DialogShell>
}
