import { useState } from 'react'
import api from '../../api/axios'
import { rerunRecommendations, RECOMMENDATION_REFRESH_URLS } from '../../api/recommendationRerun'
import { readBrowserSession } from '../../api/sessionRenewal'
import { invalidateCache, useApi } from '../../hooks/useApi'
import { ORGANIZATION_OPTIONS } from '../../utils/organizationScope'
import DialogShell from '../DialogShell'
import ConfirmModal from './ConfirmModal'
import { organizationButton as button, organizationField as field, organizationPrimary as primary } from './organizationUi'

const BATCHES_URL = '/api/instructor/batches/'

export default function RecommendationMaintenanceDialog({ initialInstitute, onClose, onFinished }) {
  const { data: options, error: optionsError } = useApi(ORGANIZATION_OPTIONS)
  const { data: batches, error: batchesError } = useApi(BATCHES_URL)
  const [instituteId, setInstituteId] = useState(initialInstitute)
  const [programId, setProgramId] = useState('')
  const [confirmation, setConfirmation] = useState(null)
  const error = optionsError || batchesError
  const ready = Boolean(options && batches && !error)
  const institute = options?.institutes.find(row => String(row.id) === instituteId)
  const programs = options?.programs.filter(row => row.institute_id === institute?.id) || []
  const activeBatches = (batches || []).filter(batch => batch.status === 'active' && batch.institute_id === institute?.id)
  const program = programs.find(row => String(row.id) === programId)
  const allPrograms = programId === 'all'
  const batchCount = allPrograms ? activeBatches.length : activeBatches.filter(batch => batch.program_id === program?.id).length
  const canReview = ready && institute && (program || allPrograms) && batchCount > 0

  function review() {
    if (!canReview) return
    const scope = { institute_id: institute.id }
    if (program) scope.program_id = program.id
    setConfirmation({ scope, name: program ? `${institute.code} · ${program.name}` : `${institute.name} · All programs and shared batches`, batchCount })
  }

  async function refresh() {
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

  return <DialogShell size="confirm" title="Recommendation maintenance" description="Choose which active batches to refresh." onClose={onClose}
    footer={<div className="flex flex-wrap justify-end gap-2">
      <button type="button" className={button} onClick={onClose}>Cancel</button>
      <button type="button" className={primary} disabled={!canReview} onClick={review}>Review refresh</button>
    </div>}>
    <div className="min-h-0 space-y-4 overflow-y-auto px-5 pb-5 text-xs">
      {error && <div role="alert" className="space-y-2">
        <p>Could not load refresh scopes.</p>
        <button type="button" className={button} onClick={() => { invalidateCache(ORGANIZATION_OPTIONS); invalidateCache(BATCHES_URL) }}>Retry choices</button>
      </div>}
      {!ready && !error && <p role="status">Loading institutes, programs and active batches…</p>}
      <fieldset disabled={!ready} className="space-y-3">
        <label className="block font-medium">Institute
          <select className={`${field} min-h-11`} value={institute ? instituteId : ''} onChange={event => { setInstituteId(event.target.value); setProgramId('') }}>
            <option value="">Choose an institute</option>
            {options?.institutes.map(row => <option key={row.id} value={row.id}>{row.name}</option>)}
          </select>
        </label>
        <label className="block font-medium">Program
          <select className={`${field} min-h-11`} value={programId} disabled={!institute} onChange={event => setProgramId(event.target.value)}>
            <option value="">Choose a program or institute-wide scope</option>
            <option value="all" disabled={!activeBatches.length}>All programs and shared batches</option>
            {programs.map(row => <option key={row.id} value={row.id} disabled={!activeBatches.some(batch => batch.program_id === row.id)}>{row.name}</option>)}
          </select>
        </label>
      </fieldset>
      <p className="leading-5 text-gray-600 dark:text-gray-300">A program refresh covers its own batches. Select All programs and shared batches to include shared institute batches.</p>
      {ready && institute && !activeBatches.length && <p role="status">This institute has no active batches.</p>}
      {canReview && <p role="status">{batchCount} active {batchCount === 1 ? 'batch' : 'batches'} selected</p>}
    </div>
    {confirmation && <ConfirmModal tone="neutral" title="Refresh recommendations?"
      message={`Refresh recommendations for ${confirmation.name} across ${confirmation.batchCount} active ${confirmation.batchCount === 1 ? 'batch' : 'batches'}?`}
      confirmLabel="Refresh recommendations" onCancel={() => setConfirmation(null)} onConfirm={refresh} />}
  </DialogShell>
}
