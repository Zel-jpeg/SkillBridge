import Avatar from './Avatar'
import DialogShell from './DialogShell'
import AssessmentStudentDetail from './AssessmentStudentDetail'
import { studentDetailState } from '../utils/studentDetail'

export default function StudentDetailModal({ student, instructorName, isArchived = false, readOnly = false, onClose, onToggleRetake, footer }) {
  const state = studentDetailState(student)
  const archived = isArchived || student.archived
  return <DialogShell title={student.name || 'Student details'} description="Student enrollment, assessment results, combined competency, recommendations and archived attempt history."
    onClose={onClose} closeLabel="Close student details" footer={footer}
    avatar={<Avatar name={student.name} photoUrl={student.photoUrl} tone="neutral" className="h-11 w-11 rounded-lg text-sm sm:h-12 sm:w-12" />}
    headerDetails={<>
      <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-gray-600 dark:text-gray-300">
        <span>{student.studentId || student.school_id || 'No student ID'}</span><span>{student.course || 'Course not provided'}</span>
      </div>
      <p className="mt-1 text-xs text-gray-600 dark:text-gray-300">{student.email || 'Email not provided'}</p>
      <div className="mt-2 flex flex-wrap gap-2 text-xs">
        <span className="text-gray-600 dark:text-gray-300">{student.batch?.name || 'No active batch'}</span>
        <span className="sb-detail-status">{state.completionLabel}</span>
        {archived && <span className="sb-detail-status">Archived</span>}
        {readOnly && <span className="sb-detail-status">Read-only</span>}
      </div>
    </>}>
    <AssessmentStudentDetail student={student} instructorName={instructorName} variant="modal" isArchived={archived} onToggleRetake={readOnly ? undefined : onToggleRetake} />
  </DialogShell>
}
