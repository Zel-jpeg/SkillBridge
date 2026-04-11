// src/components/StatusBadge.jsx
//
// Pill badge for student/instructor status.
// Used in: AdminDashboard, InstructorDashboard, AdminUsers, EnrolledStudents
//
// Props:
//   status — 'completed' | 'pending' | 'approved' | 'rejected' | string
//   size   — 'sm' (default) | 'md'

const BADGE_CONFIG = {
  completed: {
    text: 'Done',
    cls:  'text-green-700 dark:text-green-300 bg-green-100 dark:bg-green-900',
    dot:  'bg-green-500',
  },
  pending: {
    text: 'Pending',
    cls:  'text-amber-700 dark:text-amber-300 bg-amber-100 dark:bg-amber-900',
    dot:  'bg-amber-500',
  },
  approved: {
    text: 'Approved',
    cls:  'text-green-700 dark:text-green-300 bg-green-100 dark:bg-green-900',
    dot:  'bg-green-500',
  },
  rejected: {
    text: 'Rejected',
    cls:  'text-rose-700 dark:text-rose-300 bg-rose-100 dark:bg-rose-900',
    dot:  'bg-rose-500',
  },
}

export default function StatusBadge({ status, label, size = 'sm' }) {
  const config = BADGE_CONFIG[status] ?? {
    text: label ?? status,
    cls:  'text-gray-600 dark:text-gray-400 bg-gray-100 dark:bg-gray-800',
    dot:  'bg-gray-400',
  }

  const padding = size === 'md' ? 'px-2.5 py-1' : 'px-2 py-0.5'

  return (
    <span className={`inline-flex items-center gap-1 text-xs font-medium rounded-full shrink-0 ${config.cls} ${padding}`}>
      <span className={`w-1 h-1 rounded-full ${config.dot}`} />
      {config.text}
    </span>
  )
}
