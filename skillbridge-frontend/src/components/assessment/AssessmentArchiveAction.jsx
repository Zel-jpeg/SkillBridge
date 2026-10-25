import { useRef, useState } from 'react'
import ConfirmModal from '../admin/ConfirmModal'
import { ArchiveIcon } from '../Icons'
import api from '../../api/axios'
import { requestErrorMessage } from '../../api/requestErrors'
import { getCachedData, invalidateCache, updateCachedData } from '../../hooks/useApi'
import { useToast } from '../../context/ToastContext'
import { ASSESSMENTS_URL } from '../../utils/adminAssessmentState'

export default function AssessmentArchiveAction({ assessment, disabled = false, onSuccess, variant = 'default' }) {
  const [confirm, setConfirm] = useState(false)
  const pending = useRef(false)
  const { showToast } = useToast()
  const restoring = Boolean(assessment.is_archived)
  const reason = disabled ? 'Save or discard your edits before archiving.' : !restoring && assessment.publication_status === 'published'
    ? 'Close this assessment before archiving. Closing can affect completion and recommendations.'
    : !restoring && assessment.unfinished_attempt_count > 0 ? 'Resolve unfinished student attempts before archiving.' : ''

  async function submit() {
    if (pending.current) return
    pending.current = true
    try {
      const { data } = await api.post(`${ASSESSMENTS_URL}${assessment.id}/${restoring ? 'restore' : 'archive'}/`)
      updateCachedData(ASSESSMENTS_URL, (getCachedData(ASSESSMENTS_URL) || []).map(item => item.id === assessment.id ? { ...item, ...data } : item))
      const urls = [ASSESSMENTS_URL, '/api/admin/management-actions/', '/api/management/analytics/']
      urls.forEach(invalidateCache)
      window.dispatchEvent(new CustomEvent('sse:data_changed', { detail: { urls } }))
      showToast(restoring ? 'Assessment restored. Publication is unchanged.' : 'Assessment archived. Results and evidence are preserved.')
      setConfirm(false)
      onSuccess?.()
    } catch (error) {
      const message = requestErrorMessage(error, { mutation: true })
      showToast(message, 'error')
      return { ok: false, message }
    } finally { pending.current = false }
  }

  return <div className={variant === 'inline' ? 'flex min-w-0 flex-1 flex-wrap items-center gap-x-4 gap-y-2' : 'space-y-1.5'}>
    <button type="button" disabled={!!reason} title={reason || undefined} onClick={() => setConfirm(true)} className="inline-flex min-h-10 shrink-0 cursor-pointer items-center gap-2 rounded-lg border border-gray-200 px-3 py-2 text-xs font-medium text-gray-700 enabled:hover:bg-gray-50 focus-visible:outline-2 focus-visible:outline-green-600 disabled:cursor-not-allowed disabled:opacity-50 dark:border-gray-700 dark:text-gray-200 dark:enabled:hover:bg-gray-800"><ArchiveIcon size={14} />{restoring ? 'Restore assessment' : 'Archive assessment'}</button>
    {reason && <p className={variant === 'inline' ? 'min-w-0 flex-1 basis-48 text-xs leading-5 text-gray-500 dark:text-gray-400' : 'max-w-md text-xs leading-5 text-gray-500 dark:text-gray-400'}>{reason}</p>}
    {confirm && <ConfirmModal tone="confirm" title={restoring ? 'Restore assessment?' : 'Archive assessment?'} confirmLabel={restoring ? 'Restore assessment' : 'Archive assessment'}
      message={restoring ? `“${assessment.title}” will return to Assessments as ${assessment.publication_status}. It will remain unavailable to students until explicitly published.` : `“${assessment.title}” will move to Assessment archives and become read-only. Questions, student results, reports and competency evidence are preserved. Publication and completion rules stay unchanged.`}
      onCancel={() => setConfirm(false)} onConfirm={submit} />}
  </div>
}
