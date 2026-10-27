import Avatar from './Avatar'
import DialogShell from './DialogShell'
import AssessmentStudentDetail from './AssessmentStudentDetail'
import { LockIcon, UserIcon } from './Icons'
import DataSection from './DataSection'

export default function StudentDetailModal({ student, instructorName, isArchived = false, readOnly = false, onClose, onToggleRetake, footer, restoreFocusRef, contextControls, historyUrl }) {
  const archived = isArchived || student.archived
  const viewOnly = readOnly || archived
  return <DialogShell title={student.name || 'Student details'} description="Student enrollment, assessment results, combined competency, recommendations and archived attempt history."
    size="student" eyebrow="Student profile" headerBadge={viewOnly && <span className="sb-detail-status"><LockIcon size={14} /> Read-only</span>}
    onClose={onClose} closeLabel="Close student details" footer={footer || (viewOnly && <p className="sb-detail-readonly"><LockIcon size={15} /> This profile is read-only.</p>)} restoreFocusRef={restoreFocusRef}
    avatar={<Avatar name={student.name} photoUrl={student.photoUrl} tone="neutral" className="sb-detail-avatar h-12 w-12 rounded-full text-lg sm:h-16 sm:w-16 sm:text-xl" />}
    headerDetails={<>
      <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-gray-600 dark:text-gray-300">
        <span>{student.studentId || student.school_id || 'No student ID'}</span><span>{student.course || 'Course not provided'}</span>
      </div>
      <p className="mt-1 text-xs text-gray-600 dark:text-gray-300">{student.email || 'Email not provided'}</p>
      <div className="mt-2 flex flex-wrap gap-2 text-xs">
        <span className="sb-detail-status"><UserIcon size={14} />{student.batch?.name || student.batchLabel || 'No active batch'}</span>
        {viewOnly && <span className="sb-detail-status sb-detail-mobile-badge"><LockIcon size={14} />Read-only</span>}
        {archived && <span className="sb-detail-status">Archived</span>}
      </div>
    </>}>
    {contextControls}
    {historyUrl ? <DataSection url={historyUrl} layout="assessment-dialog"><AssessmentStudentDetail key={student.batch?.id ?? 'detached'} student={student} instructorName={instructorName} variant="modal" isArchived onToggleRetake={undefined} /></DataSection> : <AssessmentStudentDetail student={student} instructorName={instructorName} variant="modal" isArchived={archived} onToggleRetake={readOnly ? undefined : onToggleRetake} />}
  </DialogShell>
}
