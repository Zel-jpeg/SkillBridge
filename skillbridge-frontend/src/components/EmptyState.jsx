// src/components/EmptyState.jsx
//
// "No results" card shown when a filtered list is empty.
// Used in: AdminDashboard, InstructorDashboard, AdminUsers, EnrolledStudents
//
// Props:
//   message  — string (e.g. 'No students match your search.')
//   onClear  — optional callback for "Clear filters" button
//   icon     — optional React node; defaults to search icon

export default function EmptyState({ message, onClear, icon }) {
  return (
    <div className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-2xl py-14 flex flex-col items-center gap-3">
      <div className="w-12 h-12 rounded-2xl bg-gray-100 dark:bg-gray-800 flex items-center justify-center text-gray-400 dark:text-gray-600">
        {icon ?? (
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
            <circle cx="11" cy="11" r="8"/>
            <path d="M21 21l-4.35-4.35"/>
          </svg>
        )}
      </div>
      <p className="text-sm text-gray-400 dark:text-gray-600 text-center px-4">{message}</p>
      {onClear && (
        <button
          onClick={onClear}
          className="text-xs text-green-600 dark:text-green-400 hover:underline font-medium"
        >
          Clear filters
        </button>
      )}
    </div>
  )
}
