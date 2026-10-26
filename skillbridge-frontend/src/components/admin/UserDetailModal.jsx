import { useState, useRef, useId } from 'react'
import Avatar from '../Avatar'
import DialogShell from '../DialogShell'
import StudentDetailModal from '../StudentDetailModal'
import { ArchiveIcon, CompanyIcon, SkillIcon, UserIcon } from '../Icons'
import './instructorDetail.css'

const instructorFields = ['name', 'instructorId', 'email', 'department', 'courses']

export default function UserDetailModal({ user, type, onClose, onUpdate, onRemove, onRestore, onToggleRetake }) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState({ ...user, roleType: type })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const pending = useRef(false)
  const formId = useId()
  const editButton = useRef(null)
  async function save(action) {
    if (pending.current) return
    pending.current = true; setSaving(true); setError('')
    try {
      const result = await action()
      if (result?.ok === false) setError(result.message || 'Changes were not saved.')
    } catch { setError('The save could not be confirmed. Refresh the current records before trying again.') }
    finally { pending.current = false; setSaving(false) }
  }
  const student = type === 'student'
  const accountAction = user.archived && onRestore
    ? <button type="button" disabled={saving} className="sb-detail-action min-h-11 rounded-lg px-3 py-2 text-xs font-semibold text-green-700" onClick={() => save(() => onRestore(user))}>Restore account</button>
    : onRemove && <button type="button" disabled={saving} className="sb-detail-action sb-detail-action--danger min-h-11 rounded-lg px-3 py-2 text-xs font-semibold text-rose-800 dark:text-rose-300" onClick={() => onRemove(user)}>Remove {student ? 'student' : 'instructor'}</button>
  function cancelEdit() {
    setDraft({ ...user, roleType: type }); setEditing(false); setError('')
    requestAnimationFrame(() => editButton.current?.focus())
  }
  const footer = <div className={student ? undefined : 'instructor-detail-footer'}>
    {error && <p role="alert" className={`${student ? 'text-sm' : 'text-xs'} text-rose-700 dark:text-rose-300`}>{error}</p>}
    {student ? accountAction : <div className="instructor-detail-actions"><div>{accountAction}</div><div className="instructor-detail-edit-actions">{editing ? <>
      <button type="button" disabled={saving} className="instructor-detail-button" onClick={cancelEdit}>Cancel</button>
      <button type="submit" form={formId} disabled={saving} className="instructor-detail-button instructor-detail-button--primary">{saving ? 'Saving…' : 'Save changes'}</button>
    </> : <button type="button" ref={editButton} className="instructor-detail-button instructor-detail-button--primary" onClick={() => setEditing(true)}>Edit instructor</button>}</div></div>}
  </div>
  if (student) return <StudentDetailModal student={user} onClose={onClose} onToggleRetake={onToggleRetake} footer={footer} />
  return <DialogShell size="instructor" eyebrow="Instructor profile" title={user.name || 'Instructor details'} description="Instructor enrollment and account details." onClose={() => { if (!pending.current) onClose() }} footer={footer}
    avatar={<Avatar name={user.name} photoUrl={user.photoUrl} tone="neutral" className="instructor-detail-avatar h-12 w-12 rounded-full text-lg sm:h-16 sm:w-16 sm:text-xl" />}
    headerDetails={<><p className="instructor-detail-id">{user.instructorId || 'No instructor ID'}</p><p className="instructor-detail-email">{user.email || 'Email not provided'}</p><div className="instructor-detail-badges"><span className="sb-detail-status"><UserIcon size={14} />Instructor</span><span className={`sb-detail-status ${user.archived ? '' : 'sb-detail-status--success'}`}>{user.archived ? <ArchiveIcon size={14} /> : <span aria-hidden="true" className="instructor-detail-status-dot" />}{user.archived ? 'Archived' : 'Active account'}</span></div></>}>
    <div className="instructor-detail-body">
      <div className="instructor-detail-heading"><h3>{editing ? 'Edit instructor information' : 'Teaching information'}</h3><p>{editing ? 'Update the account details, then save your changes.' : 'Department and courses recorded for this instructor.'}</p></div>
      {editing ? <form id={formId} noValidate aria-label="Edit instructor information" aria-busy={saving} onSubmit={event => { event.preventDefault(); save(() => onUpdate(draft, type, draft.roleType)) }}>
        <fieldset disabled={saving} className="instructor-detail-form">
          {instructorFields.map(field => <label key={field} className={field === 'email' ? 'instructor-detail-field instructor-detail-field--wide' : 'instructor-detail-field'}>{field === 'instructorId' ? 'Instructor ID' : field}<input autoFocus={field === 'name'} autoComplete={field === 'name' ? 'name' : field === 'email' ? 'email' : 'off'} value={draft[field] || ''} onChange={event => setDraft(previous => ({ ...previous, [field]: event.target.value }))} /></label>)}
        </fieldset>
      </form> : <div className="instructor-detail-cards">
        <section className="instructor-detail-card" aria-label="Instructor department"><span className="instructor-detail-icon" aria-hidden="true"><CompanyIcon size={19} /></span><h4>Department</h4><p>{user.department || 'Not provided'}</p></section>
        <section className="instructor-detail-card" aria-label="Instructor courses"><span className="instructor-detail-icon" aria-hidden="true"><SkillIcon size={19} /></span><h4>Courses</h4><p>{user.courses || 'Not provided'}</p></section>
      </div>}
    </div>
  </DialogShell>
}
