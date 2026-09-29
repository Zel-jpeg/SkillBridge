import DialogShell from '../DialogShell'
import { TrashIcon } from '../Icons'

/** The same confirmation flow, in the native top layer above its parent dialog. */
export default function ConfirmModal({ title, message, confirmLabel = 'Delete', onConfirm, onCancel, tone = 'danger' }) {
  const danger = tone === 'danger'
  return <DialogShell size="confirm" title={title} description={message} onClose={onCancel} closeLabel="Close confirmation"
    avatar={danger ? <span aria-hidden="true" className="mt-2 text-rose-700 dark:text-rose-300"><TrashIcon size={20} /></span> : undefined}
    footer={<div className="flex gap-3">
      <button type="button" onClick={onCancel} className="min-h-11 flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium dark:border-gray-600">Cancel</button>
      <button type="button" onClick={onConfirm} className={`min-h-11 flex-1 rounded-lg px-3 py-2 text-sm font-medium text-white ${danger ? 'bg-rose-700 hover:bg-rose-800' : 'bg-green-700 hover:bg-green-800'}`}>{confirmLabel}</button>
    </div>} />
}
