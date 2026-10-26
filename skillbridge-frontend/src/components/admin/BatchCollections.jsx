import Avatar from '../Avatar'
import Pagination from '../Pagination'
import { ChevronRightIcon, UsersIcon } from '../Icons'
import './batchCollections.css'

export function BatchStatus({ status }) {
  return <span className={`batch-status ${status === 'active' ? 'is-active' : ''}`}><span aria-hidden="true">•</span>{status === 'active' ? 'Active' : 'Archived'}</span>
}

// Keep the native name button as the keyboard target, with the rest of the row
// offering the same action. Independent row controls never trigger navigation.
function openRow(event, record, onOpen) {
  if (event.target.closest('button, a, input, select, textarea, [role="button"]') || window.getSelection()?.toString()) return
  const opener = event.currentTarget.querySelector('[data-row-open]')
  opener?.focus()
  onOpen(record, opener)
}

export function CollectionRange({ total, page, onPage, noun }) {
  if (!total) return null
  return <div className="batch-range">{total > 10 ? <Pagination total={total} page={page} onPage={onPage} /> : <p>Showing 1–{total} of {total} {noun}</p>}</div>
}

export function BatchCollection({ records, view, onOpen }) {
  return <>
    <div className={`batch-grid ${view === 'list' ? 'batch-mobile-cards' : ''}`}>{records.map(batch => <button key={batch.id} type="button" data-batch-id={batch.id} className="batch-card" onClick={event => onOpen(batch, event.currentTarget)}>
      <div className="batch-card-title"><span className="batch-symbol" aria-hidden="true"><UsersIcon size={20} /></span><h2>{batch.name}</h2><BatchStatus status={batch.status} /></div>
      <div className="batch-instructor"><Avatar name={batch.instructor_name} photoUrl={batch.instructor_photo_url} tone="neutral" className="h-9 w-9 rounded-full text-xs" /><div><strong>{batch.instructor_name || 'Instructor not assigned'}</strong><span>Responsible instructor</span></div></div>
      <p className="batch-student-count"><UsersIcon size={18} /><strong>{batch.student_count ?? 0} students</strong></p>
      {!batch.created_by_id && <p className="batch-creator">Creator not recorded</p>}
      <span className="batch-card-link">View students<ChevronRightIcon size={17} /></span>
    </button>)}</div>
    {view === 'list' && <div className="batch-table-wrap batch-desktop-table" role="region" aria-label="Batch list" tabIndex={0}><table className="batch-table"><caption className="sr-only">Batches, responsible instructors and enrollment counts</caption><thead><tr><th scope="col">Batch</th><th scope="col">Responsible instructor</th><th scope="col">Status</th><th scope="col">Students</th><th scope="col"><span className="sr-only">Open batch</span></th></tr></thead><tbody>{records.map(batch => <tr key={batch.id} onClick={event => openRow(event, batch, onOpen)}>
      <td><button type="button" data-row-open data-batch-id={batch.id} onClick={event => onOpen(batch, event.currentTarget)}>{batch.name}</button>{!batch.created_by_id && <p className="batch-creator">Creator not recorded</p>}</td><td><div className="batch-instructor"><Avatar name={batch.instructor_name} photoUrl={batch.instructor_photo_url} tone="neutral" className="h-8 w-8 rounded-full text-xs" /><strong>{batch.instructor_name || 'Instructor not assigned'}</strong></div></td><td><BatchStatus status={batch.status} /></td><td>{batch.student_count ?? 0}</td><td aria-hidden="true"><ChevronRightIcon size={16} /></td>
    </tr>)}</tbody></table></div>}
  </>
}

function progress(student) {
  const total = student.totalRequiredCount
  const complete = student.completedRequiredCount
  const started = complete > 0 || student.assessmentResults.some(result => ['in_progress', 'submitted'].includes(result.attempt_status))
  const status = student.status === 'stopped' ? 'Stopped / flagged' : total === 0 ? 'Not assigned' : student.status === 'completed' ? 'Complete' : started ? 'In progress' : 'Pending'
  return { total, complete, status, percentage: total > 0 ? Math.max(0, Math.min(100, complete / total * 100)) : 0 }
}

function RequiredProgress({ student }) {
  const result = progress(student)
  return <div className="batch-required"><div role="progressbar" aria-label={`${student.name} required assessments`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={result.percentage}><span style={{ width: `${result.percentage}%` }} /></div><span>{result.total ? `${result.complete}/${result.total}` : 'None assigned'}</span></div>
}

function StudentStatus({ student }) {
  const { status } = progress(student)
  return <span className={`batch-student-status ${status === 'Complete' ? 'is-complete' : status === 'In progress' ? 'is-progress' : status === 'Stopped / flagged' ? 'is-flagged' : ''}`}><span aria-hidden="true">•</span>{status}</span>
}

export function BatchStudentCollection({ students, view, busy, onOpen, onUnenroll }) {
  const action = student => <button type="button" className="batch-unenroll" disabled={busy} aria-label={`Unenroll ${student.name} from batch`} onClick={() => onUnenroll(student)}>Unenroll<span className="sr-only"> from batch</span></button>
  return <>
    <div className={`batch-roster-grid ${view === 'list' ? 'batch-mobile-cards' : ''}`}>{students.map(student => <article className="batch-roster-card" key={student.id}>
      <div className="batch-student-identity"><Avatar name={student.name} photoUrl={student.photoUrl} className="h-10 w-10 rounded-full text-xs" /><div><h3><button type="button" aria-haspopup="dialog" className="batch-card-open" aria-label={`View student ${student.name}`} onClick={event => onOpen(student, event.currentTarget)}>{student.name}</button></h3><p>{student.studentId || 'No student ID'} · {student.course || 'Course not provided'}</p></div></div>
      <StudentStatus student={student} /><div className="mt-4"><p className="mb-2 text-xs text-gray-500 dark:text-gray-400">Required assessments</p><RequiredProgress student={student} /></div>
      <div className="batch-roster-card-footer"><span>View student<ChevronRightIcon size={14} /></span>{action(student)}</div>
    </article>)}</div>
    {view === 'list' && <div className="batch-table-wrap batch-desktop-table" role="region" aria-label="Batch student list" tabIndex={0}><table className="batch-table batch-student-table"><caption className="sr-only">Students and required assessment progress in the selected batch</caption><thead><tr><th scope="col">Student</th><th scope="col">Course</th><th scope="col">Required assessments</th><th scope="col">Status</th><th scope="col">Actions</th><th scope="col"><span className="sr-only">Open student</span></th></tr></thead><tbody>{students.map(student => <tr key={student.id} onClick={event => openRow(event, student, onOpen)}>
      <td><div className="batch-student-identity"><Avatar name={student.name} photoUrl={student.photoUrl} className="h-8 w-8 rounded-full text-[11px]" /><div><button type="button" data-row-open aria-haspopup="dialog" onClick={event => onOpen(student, event.currentTarget)}>{student.name}</button><p>{student.studentId || 'No student ID'}</p></div></div></td><td>{student.course || '—'}</td><td><RequiredProgress student={student} /></td><td><StudentStatus student={student} /></td><td>{action(student)}</td><td aria-hidden="true"><ChevronRightIcon size={16} /></td>
    </tr>)}</tbody></table></div>}
  </>
}
