// src/components/admin/ConfirmModal.jsx
//
// Generic delete/confirm dialog. Used anywhere a destructive action
// requires user confirmation before proceeding.
//
// Props:
//   title        — heading text
//   message      — body text explaining consequence
//   confirmLabel — label for destructive button (default: "Delete")
//   onConfirm    — called when user clicks the destructive button
//   onCancel     — called when user cancels

import { TrashIcon } from '../Icons'

export default function ConfirmModal({
  title,
  message,
  confirmLabel = 'Delete',
  onConfirm,
  onCancel,
}) {
  return (
    <div className="fixed inset-0 z-60 flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-sm px-4 pb-4 sm:pb-0">
      <div className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-2xl shadow-xl w-full max-w-sm p-6 space-y-4">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-rose-50 dark:bg-rose-950 flex items-center justify-center shrink-0 text-rose-500">
            <TrashIcon size={18} />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white">{title}</h3>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 leading-relaxed">{message}</p>
          </div>
        </div>
        <div className="flex gap-2">
          <button
            onClick={onCancel}
            className="flex-1 py-2.5 rounded-xl text-sm font-medium bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="flex-1 py-2.5 rounded-xl text-sm font-medium bg-rose-600 hover:bg-rose-700 text-white transition-colors"
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
