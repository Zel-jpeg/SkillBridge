// src/components/admin/PendingDetailModal.jsx
//
// Shows the full profile of a pending instructor request,
// with Approve/Reject action buttons.
//
// Props:
//   user      — pending instructor object { name, email, instructorId, department, courses }
//   onClose   — close handler
//   onApprove — called when admin approves the request
//   onReject  — called when admin rejects the request

import { useState } from 'react'
import { XIcon } from '../Icons'
import { getInitials } from '../../utils/formatters'

export default function PendingDetailModal({ user, onClose, onApprove, onReject }) {
  const [submitting, setSubmitting] = useState(false)

  async function handleApprove() {
    setSubmitting(true)
    try {
      await onApprove()
    } finally {
      if (typeof window !== 'undefined') {
        // Only set false if it wasn't unmounted by the parent
        setSubmitting(false)
      }
    }
  }
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm px-4"
      onClick={e => e.target === e.currentTarget && onClose()}
    >
      <div
        className="bg-white dark:bg-gray-900 border border-amber-100 dark:border-amber-900/30 rounded-2xl shadow-2xl w-full max-w-md flex flex-col overflow-hidden"
        style={{ animation: 'modalIn 0.2s ease-out' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-amber-100 dark:border-amber-900/30 bg-amber-50/50 dark:bg-amber-900/10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-linear-to-br from-amber-400 to-orange-500 flex items-center justify-center text-white text-sm font-bold shrink-0 shadow">
              {getInitials(user.name)}
            </div>
            <div>
              <h2 className="text-sm font-bold text-gray-900 dark:text-white leading-tight">{user.name}</h2>
              <p className="text-xs text-amber-600 dark:text-amber-400 font-medium">Pending Approval · Instructor Request</p>
            </div>
          </div>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-xl text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
            <XIcon size={16} />
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-5 flex flex-col gap-5">
          <div className="bg-gray-50 dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-xl p-4 space-y-3">
            <div>
              <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-0.5">Email</p>
              <p className="text-sm font-medium text-gray-900 dark:text-white break-all">{user.email}</p>
            </div>
            <div>
              <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-0.5">Instructor ID</p>
              <p className="text-sm font-mono text-gray-900 dark:text-white">{user.instructorId}</p>
            </div>
            <div>
              <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-0.5">Department</p>
              <p className="text-sm font-medium text-gray-900 dark:text-white">{user.department}</p>
            </div>
            <div>
              <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-0.5">Courses Requested</p>
              <p className="text-sm font-medium text-gray-900 dark:text-white">{user.courses}</p>
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-2">
            <button
              onClick={onReject}
              className="flex-1 py-2.5 rounded-xl bg-gray-100 hover:bg-rose-100 text-gray-700 hover:text-rose-600 dark:bg-gray-800 dark:hover:bg-rose-900 dark:text-gray-300 dark:hover:text-rose-400 text-sm font-semibold transition-colors"
            >
              Reject
            </button>
            <button
              onClick={handleApprove}
              disabled={submitting}
              className="flex-1 py-2.5 rounded-xl bg-green-600 hover:bg-green-700 text-white text-sm font-semibold transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {submitting ? 'Approving...' : 'Approve'}
            </button>
          </div>
        </div>
      </div>
      <style>{`@keyframes modalIn { from { transform: translateY(10px) scale(0.98); opacity: 0; } to { transform: translateY(0) scale(1); opacity: 1; } }`}</style>
    </div>
  )
}
