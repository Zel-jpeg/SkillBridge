import { useState } from 'react'
import api from '../../api/axios'
import { rerunRecommendations, RECOMMENDATION_REFRESH_URLS } from '../../api/recommendationRerun'
import { readBrowserSession } from '../../api/sessionRenewal'
import { invalidateCache, useApi } from '../../hooks/useApi'
import { ORGANIZATION_OPTIONS } from '../../utils/organizationScope'
import DialogShell from '../DialogShell'
import ConfirmModal from './ConfirmModal'
import './recommendationTools.css'

const BATCHES_URL = '/api/instructor/batches/'

export default function RecommendationMaintenanceDialog({ initialInstitute = '', onClose, onFinished }) {
  const { data: options, error: optionsError } = useApi(ORGANIZATION_OPTIONS)
  const { data: batches, error: batchesError } = useApi(BATCHES_URL)
  const [scopeType, setScopeType] = useState('batch')
  const [instituteId, setInstituteId] = useState(String(initialInstitute))
  const [programId, setProgramId] = useState('')
  const [batchId, setBatchId] = useState('')
  const [confirmation, setConfirmation] = useState(null)
  const error = optionsError || batchesError
  const ready = Boolean(options && batches && !error)
  const institute = options?.institutes.find(row => String(row.id) === instituteId)
  const programs = options?.programs.filter(row => row.institute_id === institute?.id) || []
  const activeBatches = (batches || []).filter(batch => batch.status === 'active')
  const instituteBatches = activeBatches.filter(batch => batch.institute_id === institute?.id)
  const visibleBatches = instituteBatches.filter(batch => programId === 'shared' ? !batch.program_id : programId && (String(batch.program_id) === programId || !batch.program_id))
  const selectedBatch = visibleBatches.find(batch => String(batch.id) === batchId)
  const canReview = ready && (scopeType === 'system' ? activeBatches.length > 0 : Boolean(institute && programId && selectedBatch))

  function review() {
    if (!canReview) return
    if (scopeType === 'system') {
      setConfirmation({ scope: {}, name: 'Whole system · All institutes and programs', batchCount: activeBatches.length })
    } else if (selectedBatch) {
      setConfirmation({ scope: { batch_id: selectedBatch.id }, name: `${institute.code} · ${selectedBatch.program?.name || 'Shared across institute programs'} · ${selectedBatch.name}`, batchCount: 1 })
    }
  }

  async function refresh() {
    if (!confirmation) return { ok: false, message: 'Choose and review a refresh scope first.' }
    const sessionId = readBrowserSession().id
    const outcome = await rerunRecommendations(api, sessionId, confirmation.scope)
    if (readBrowserSession().id !== sessionId || outcome.state === 'cancelled') {
      onClose()
      return
    }
    if (outcome.state === 'rejected' || outcome.state === 'busy') return { ok: false, message: outcome.message }
    if (outcome.refresh) RECOMMENDATION_REFRESH_URLS.forEach(invalidateCache)
    onFinished({ name: confirmation.name, message: outcome.message })
  }

  return <DialogShell size="recommendation-tools" title="Refresh saved recommendations" description="Choose which active batches to refresh." onClose={onClose}
    footer={<div className="flex flex-wrap items-center justify-between gap-3"><p className="text-xs text-gray-600 dark:text-gray-300" role="status">{canReview ? scopeType === 'system' ? `${activeBatches.length} active batches across the whole system` : '1 active batch selected' : 'Select a batch to continue.'}</p><div className="flex gap-2"><button type="button" className="rt-button" onClick={onClose}>Cancel</button><button type="button" className="rt-button rt-button--primary" disabled={!canReview} onClick={review}>Review refresh</button></div></div>}>
    <div className="rt-scroll text-xs leading-relaxed">
      <p className="rt-note mb-4">Choose which active batches to refresh. Review the affected scope before starting.</p>
      {error && <div role="alert" className="rt-message rt-message--error mb-4"><p>Could not load refresh scopes.</p><button type="button" className="rt-button mt-2" onClick={() => { invalidateCache(ORGANIZATION_OPTIONS); invalidateCache(BATCHES_URL) }}>Retry choices</button></div>}
      {!ready && !error && <p role="status" className="rt-note mb-4">Loading institutes, programs and active batches…</p>}
      <fieldset disabled={!ready} className="space-y-4"><legend className="sr-only">Recommendation refresh scope</legend>
        <div className="rt-scope"><label className="rt-scope-label"><input type="radio" name="recommendation-refresh-scope" value="batch" checked={scopeType === 'batch'} onChange={() => setScopeType('batch')} /><span><strong className="rt-subheading block">Selected batch</strong><span className="rt-note block mt-1">Refresh recommendations for one active batch.</span></span></label>
          <fieldset disabled={scopeType !== 'batch'} className="rt-scope-fields"><legend className="sr-only">Choose a batch</legend>
            <label className="font-medium">Institute<select className="rt-field" value={institute ? instituteId : ''} onChange={event => { setInstituteId(event.target.value); setProgramId(''); setBatchId('') }}><option value="">Choose institute</option>{options?.institutes.map(row => <option key={row.id} value={row.id}>{row.name}</option>)}</select></label>
            <label className="font-medium">Program<select className="rt-field" value={programId} disabled={!institute} onChange={event => { setProgramId(event.target.value); setBatchId('') }}><option value="">Choose program</option>{programs.map(row => <option key={row.id} value={row.id}>{row.name}</option>)}{instituteBatches.some(batch => !batch.program_id) && <option value="shared">Shared across institute programs</option>}</select></label>
            <label className="font-medium">Batch<select className="rt-field" value={selectedBatch ? batchId : ''} disabled={!institute || !programId} onChange={event => setBatchId(event.target.value)}><option value="">Choose batch</option>{visibleBatches.map(batch => <option key={batch.id} value={batch.id}>{batch.name}{!batch.program_id ? ' · Shared across institute programs' : ''}</option>)}</select></label>
          </fieldset>
          {ready && institute && !instituteBatches.length && <p role="status" className="rt-note mt-3">This institute has no active batches.</p>}
          {scopeType === 'batch' && institute && programId && !visibleBatches.length && <p role="status" className="rt-note mt-3">No active batches are available in this program.</p>}
          {selectedBatch && !selectedBatch.program_id && <p className="rt-note mt-3">This shared batch includes its full enrolled roster across institute programs.</p>}
        </div>
        <label className="rt-scope"><span className="rt-scope-label"><input type="radio" name="recommendation-refresh-scope" value="system" checked={scopeType === 'system'} onChange={() => setScopeType('system')} /><span><strong className="rt-subheading block">Whole system</strong><span className="rt-note block mt-1">Refresh all active batches across every institute and program.</span></span></span></label>
      </fieldset>
      {ready && !activeBatches.length && <p role="status" className="rt-note mt-4">There are no active batches to refresh.</p>}
      <p className="rt-note mt-5">Assessment scores and approved placement decisions are preserved. Opening this chooser does not refresh anything.</p>
    </div>
    {confirmation && <ConfirmModal tone="neutral" title="Refresh recommendations?" message={`Refresh recommendations for ${confirmation.name} across ${confirmation.batchCount} active ${confirmation.batchCount === 1 ? 'batch' : 'batches'}?`} confirmLabel="Refresh recommendations" onCancel={() => setConfirmation(null)} onConfirm={refresh} />}
  </DialogShell>
}
