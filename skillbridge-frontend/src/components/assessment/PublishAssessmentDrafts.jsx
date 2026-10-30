import { useRef, useState } from 'react'
import api from '../../api/axios'
import { applyDataChange } from '../../hooks/useApi'
import { useToast } from '../../context/ToastContext'
import DialogShell from '../DialogShell'
import { CheckCircleIcon, ChevronRightIcon, ReportIcon, UsersIcon, WarnIcon } from '../Icons'
import { assessmentPrimaryAction, assessmentSecondaryAction } from './assessmentActionStyles'
import './publishAssessmentDrafts.css'

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
    size="publication"
    avatar={<span className="publication-heading-icon" aria-hidden="true">{reviewing ? <CheckCircleIcon size={22} /> : <ReportIcon size={22} />}</span>}
    description="Choose drafts in one batch and publish them together after review."
    onClose={close} closeDisabled={saving} closeLabel="Close draft publication"
    footer={<div className="publication-footer">
      <p className="publication-selection-count" role="status">{selected.length} assessment{selected.length === 1 ? '' : 's'} {reviewing ? 'to publish' : 'selected'}</p>
      <div className="publication-footer-actions">
        <button type="button" className={control} disabled={saving} onClick={reviewing ? () => { setReviewing(false); setError('') } : close}>{reviewing ? 'Back' : 'Cancel'}</button>
        <button type="button" className={`${assessmentPrimaryAction} inline-flex items-center justify-center gap-2`} disabled={saving || !selected.length} aria-busy={saving}
          onClick={reviewing ? publish : () => setReviewing(true)}>{saving && <span className="publication-spinner" aria-hidden="true" />}{saving ? 'Publishing…' : reviewing ? `Publish ${selected.length} assessment${selected.length === 1 ? '' : 's'}` : 'Review publication'}{!reviewing && <span aria-hidden="true"><ChevronRightIcon size={14} /></span>}</button>
      </div>
    </div>}>
    <ol className="publication-steps" aria-label="Publication progress">
      <li aria-current={!reviewing ? 'step' : undefined} className="publication-step publication-step--active"><span className="publication-step-number" aria-hidden="true">{reviewing ? <CheckCircleIcon size={16} /> : '1'}</span>Select drafts</li>
      <li aria-current={reviewing ? 'step' : undefined} className={`publication-step${reviewing ? ' publication-step--active' : ''}`}><span className="publication-step-number" aria-hidden="true">2</span>Review &amp; publish</li>
    </ol>
    <div className="publication-body">
      {error && <p role="alert" className="rounded-lg bg-rose-50 p-3 text-rose-800 dark:bg-rose-950 dark:text-rose-200">{error}</p>}
      <p className="publication-intro">Release the initial set together so students can receive a shuffled order across the full set. Existing student assessment numbers stay the same; later releases receive new numbers.</p>
      {!reviewing ? <>
        <label className="block font-semibold text-gray-900 dark:text-white">Batch<select className={`${control} mt-2 w-full`} value={batch} onChange={event => chooseBatch(event.target.value)}>
          <option value="">Choose a batch</option>{batches.map(([id, name]) => <option key={id} value={id}>{name}</option>)}
        </select></label>
        {batch && <fieldset className="min-w-0"><legend className="mb-3 font-semibold text-gray-900 dark:text-white">Draft assessments ({available.length})</legend>
          <div className="publication-selection-toolbar"><span className="publication-selected-badge">{selected.length} selected</span><div className="flex flex-wrap gap-2"><button type="button" className={control} onClick={() => setIds(available.map(item => item.id))}>Select all drafts</button><button type="button" className={control} onClick={() => setIds([])}>Clear selection</button></div></div>
          <div className="publication-drafts">{available.map(item => <label key={item.id} className={`publication-draft${ids.includes(item.id) ? ' publication-draft--selected' : ''}`}>
            <input type="checkbox" checked={ids.includes(item.id)} onChange={event => setIds(previous => event.target.checked ? [...previous, item.id] : previous.filter(id => id !== item.id))} />
            <span className="min-w-0 break-words"><strong className="block font-semibold text-gray-900 dark:text-gray-100">{item.title}</strong><span className="publication-draft-meta"><span>{item.question_count} questions · {item.duration_minutes} minutes</span><span className="publication-requirement">{item.is_required ? 'Required' : 'Optional'}</span><span>{item.include_in_competency ? 'Included in competency' : 'Excluded from competency'}</span></span></span>
          </label>)}</div>
        </fieldset>}
      </> : <>
        <div className="publication-batch-summary"><span className="publication-heading-icon" aria-hidden="true"><UsersIcon size={20} /></span><div className="min-w-0 break-words"><p className="font-semibold text-gray-900 dark:text-white">Batch: {batches.find(([id]) => id === batch)?.[1]}</p><p className="mt-1 text-gray-500 dark:text-gray-400">{selected.length} assessment{selected.length === 1 ? '' : 's'} ready to publish</p></div></div>
        <section aria-label="Assessments to publish"><h3 className="mb-3 font-semibold text-gray-900 dark:text-white">Assessments to publish</h3><ul className="publication-review-list">{selected.map(item => <li key={item.id}><span className="shrink-0 text-green-700 dark:text-green-400" aria-hidden="true"><CheckCircleIcon size={17} /></span><span className="min-w-0 break-words">{item.title}</span></li>)}</ul></section>
        <div className="publication-notice"><span aria-hidden="true"><ReportIcon size={18} /></span><p>These assessments will become visible to enrolled students together. Each keeps its configured opening time, deadline, duration, required status and competency inclusion.</p></div>
        <div className="publication-notice publication-notice--warning"><span aria-hidden="true"><WarnIcon size={18} /></span><p>Publishing required work can lock final results until that work is completed.</p></div>
      </>}
    </div>
  </DialogShell>
}
