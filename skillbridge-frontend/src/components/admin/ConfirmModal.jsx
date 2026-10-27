import DialogShell from '../DialogShell'
import { ArchiveIcon, TrashIcon } from '../Icons'
import { useRef, useState } from 'react'

/** The same confirmation flow, in the native top layer above its parent dialog. */
export default function ConfirmModal({ title, message, confirmLabel = 'Delete', onConfirm, onCancel, tone = 'danger', archive = false }) {
  const danger = tone === 'danger'
  const Icon = archive ? ArchiveIcon : TrashIcon
  const pending = useRef(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  async function confirm() {
    if (pending.current) return
    pending.current = true
    setSaving(true)
    setError('')
    try {
      const result = await onConfirm()
      if (result?.ok === false) setError(result.message || 'Changes were not saved. Please try again.')
    } catch {
      setError('The operation could not be confirmed. Refresh the list before retrying.')
    } finally {
      pending.current = false
      setSaving(false)
    }
  }
  return <DialogShell size="confirm" title={title} description={message} onClose={() => { if (!pending.current) onCancel() }} closeLabel="Close confirmation"
    avatar={danger ? <span aria-hidden="true" className="mt-2 text-rose-700 dark:text-rose-300"><Icon size={20} /></span> : undefined}
    footer={<div className="flex gap-3">
      <button type="button" disabled={saving} onClick={onCancel} className="min-h-11 flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium dark:border-gray-600 disabled:opacity-50">Cancel</button>
      <button type="button" disabled={saving} onClick={confirm} className={`min-h-11 flex-1 rounded-lg px-3 py-2 text-sm font-medium text-white disabled:opacity-50 ${danger ? 'bg-rose-700 hover:bg-rose-800' : 'bg-green-700 hover:bg-green-800'}`}>{saving ? 'Saving…' : confirmLabel}</button>
    </div>} >
      {error && <p role="alert" className="text-sm text-rose-700 dark:text-rose-300">{error}</p>}
    </DialogShell>
}
