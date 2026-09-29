import { useState } from 'react'
import AssessmentStudentDetail from '../AssessmentStudentDetail'

export default function UserDetailModal({ user, type, onClose, onUpdate, onRemove, onToggleRetake }) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState({ ...user, roleType: type })
  const student = type === 'student'
  return <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 sm:items-center sm:p-4" onClick={event => event.target === event.currentTarget && onClose()}>
    <div role="dialog" aria-modal="true" aria-label={`${user.name} details`} className="flex max-h-[95dvh] w-full flex-col overflow-hidden rounded-t-2xl border border-gray-200 bg-white shadow-2xl sm:max-w-3xl sm:rounded-2xl dark:border-gray-700 dark:bg-gray-900">
      <header className="flex items-start justify-between gap-3 border-b border-gray-100 p-4 dark:border-gray-800"><div className="min-w-0"><h2 className="wrap-break-word font-bold text-gray-900 dark:text-white">{user.name}</h2><p className="break-all text-xs text-gray-500 dark:text-gray-400">{user.email} · {student ? user.studentId : user.instructorId}</p></div><button aria-label="Close details" onClick={onClose} className="text-sm text-gray-600 focus-visible:outline-2 focus-visible:outline-green-600 dark:text-gray-300">Close</button></header>
      <div className="overflow-y-auto px-4 sm:px-6">
        {student ? <AssessmentStudentDetail student={user} onToggleRetake={onToggleRetake} /> : <div className="space-y-3 py-4 text-sm text-gray-700 dark:text-gray-300">
          {editing ? <>
            {['name', 'email', 'department', 'courses', 'instructorId'].map(field => <label key={field} className="block text-xs font-semibold capitalize">{field}<input value={draft[field] || ''} onChange={e => setDraft({ ...draft, [field]: e.target.value })} className="mt-1 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 dark:border-gray-700 dark:bg-gray-800 dark:text-white" /></label>)}
            <button className="rounded-lg bg-green-600 px-3 py-2 text-white" onClick={() => { onUpdate(draft, type, draft.roleType); setEditing(false) }}>Save changes</button>
            <button className="ml-2 rounded-lg border border-gray-300 px-3 py-2" onClick={() => setEditing(false)}>Cancel</button>
          </> : <><p>Department: {user.department}</p><p>Courses: {user.courses}</p><button className="rounded-lg border border-gray-300 px-3 py-2" onClick={() => setEditing(true)}>Edit instructor</button></>}
        </div>}
        <div className="border-t border-gray-100 py-3 dark:border-gray-800"><button className="rounded-lg px-3 py-2 text-xs font-semibold text-rose-700 dark:text-rose-400" onClick={() => onRemove(user)}>Remove {student ? 'student' : 'instructor'}</button></div>
      </div>
    </div>
  </div>
}
