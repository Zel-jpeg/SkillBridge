import AssessmentStudentDetail from '../AssessmentStudentDetail'

export default function StudentModal({ student, isArchived, onClose, onToggleRetake }) {
  return <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 sm:items-center sm:p-4" onClick={event => event.target === event.currentTarget && onClose()}>
    <div role="dialog" aria-modal="true" aria-label={`${student.name} assessment details`} className="flex max-h-[95dvh] w-full flex-col overflow-hidden rounded-t-2xl border border-gray-200 bg-white shadow-2xl sm:max-w-3xl sm:rounded-2xl dark:border-gray-700 dark:bg-gray-900">
      <div className="flex items-start justify-between gap-3 border-b border-gray-100 px-4 py-4 dark:border-gray-800 sm:px-6">
        <div className="min-w-0"><h2 className="break-words text-base font-bold text-gray-900 dark:text-white">{student.name}</h2><p className="text-xs text-gray-500 dark:text-gray-400">{student.studentId} · {student.course} · {student.email}</p></div>
        <button aria-label="Close student details" onClick={onClose} className="rounded-lg px-2 py-1 text-gray-500 focus-visible:outline-2 focus-visible:outline-green-600 dark:text-gray-300">Close</button>
      </div>
      <div className="overflow-y-auto px-4 sm:px-6"><AssessmentStudentDetail student={student} isArchived={isArchived} onToggleRetake={onToggleRetake} /></div>
    </div>
  </div>
}
