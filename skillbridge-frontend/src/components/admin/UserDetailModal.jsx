import { useState } from 'react'
import Avatar from '../Avatar'
import DialogShell from '../DialogShell'
import StudentDetailModal from '../StudentDetailModal'

export default function UserDetailModal({ user, type, onClose, onUpdate, onRemove, onToggleRetake }) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState({ ...user, roleType: type })
  const student = type === 'student'
  const footer = onRemove && !user.archived ? <button type="button" className="min-h-11 rounded-lg px-3 py-2 text-xs font-semibold text-rose-800 dark:text-rose-300" onClick={() => onRemove(user)}>Remove {student ? 'student' : 'instructor'}</button> : null
  if (student) return <StudentDetailModal student={user} onClose={onClose} onToggleRetake={onToggleRetake} footer={footer} />
  return <DialogShell title={user.name || 'Instructor details'} description="Instructor enrollment and account details." onClose={onClose} footer={footer}
    avatar={<Avatar name={user.name} photoUrl={user.photoUrl} tone="neutral" className="h-11 w-11 rounded-lg text-sm" />}
    headerDetails={<><p className="mt-1 text-xs text-gray-600 dark:text-gray-300">{user.email || 'Email not provided'}</p><p className="mt-1 text-xs text-gray-600 dark:text-gray-300">{user.instructorId || 'No instructor ID'}{user.archived ? ' · Archived' : ''}</p></>}>
    <div className="min-h-0 flex-1 overflow-y-auto px-4 py-5 text-sm sm:px-6">
      {editing ? <div className="max-w-xl space-y-3">
        {['name', 'email', 'department', 'courses', 'instructorId'].map(field => <label key={field} className="block text-xs font-semibold capitalize">{field === 'instructorId' ? 'Instructor ID' : field}<input value={draft[field] || ''} onChange={e => setDraft({ ...draft, [field]: e.target.value })} className="mt-1 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 dark:border-gray-700 dark:bg-gray-800 dark:text-white" /></label>)}
        <div className="flex flex-wrap gap-2"><button type="button" className="min-h-11 rounded-lg bg-green-700 px-3 py-2 text-white" onClick={() => { onUpdate(draft, type, draft.roleType); setEditing(false) }}>Save changes</button><button type="button" className="min-h-11 rounded-lg border border-gray-300 px-3 py-2 dark:border-gray-600" onClick={() => { setDraft({ ...user, roleType: type }); setEditing(false) }}>Cancel</button></div>
      </div> : <div className="max-w-xl space-y-4"><dl className="sb-detail-facts"><dt>Department</dt><dd>{user.department || 'Not provided'}</dd><dt>Courses</dt><dd>{user.courses || 'Not provided'}</dd></dl><button type="button" className="min-h-11 rounded-lg border border-gray-300 px-3 py-2 dark:border-gray-600" onClick={() => setEditing(true)}>Edit instructor</button></div>}
    </div>
  </DialogShell>
}
