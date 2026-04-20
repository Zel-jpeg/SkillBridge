// src/components/admin/UserDetailModal.jsx
//
// Shows full profile for either a student or instructor.
// Instructors can be edited inline. Students show assessment status + match.
//
// Props:
//   user            — the user object (student or instructor shape)
//   type            — 'student' | 'instructor'
//   onClose         — close handler
//   onUpdate(user, oldType, newType) — called after saving edits
//   onRemove(user)  — called when Remove button is clicked
//   onToggleRetake(userId) — toggle retake flag for students

import { useState } from 'react'
import { XIcon, TrashIcon, RefreshIcon, PencilIcon } from '../Icons'
import { getInitials, matchColor } from '../../utils/formatters'

export default function UserDetailModal({ user, type, onClose, onUpdate, onRemove, onToggleRetake }) {
  const isStudent  = type === 'student'
  const [editing,  setEditing]  = useState(false)
  const [editData, setEditData] = useState({ ...user, roleType: type })

  function handleSave() {
    onUpdate({ ...user, ...editData }, type, editData.roleType)
    setEditing(false)
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm px-4"
      onClick={e => e.target === e.currentTarget && onClose()}
    >
      <div
        className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-2xl shadow-2xl w-full max-w-md flex flex-col overflow-hidden"
        style={{ animation: 'modalIn 0.2s ease-out' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-900">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-linear-to-br from-indigo-400 to-violet-600 flex items-center justify-center text-white text-sm font-bold shrink-0 shadow">
              {getInitials(user.name)}
            </div>
            <div>
              <h2 className="text-sm font-bold text-gray-900 dark:text-white leading-tight">{user.name}</h2>
              <p className="text-xs text-gray-400 dark:text-gray-500 font-mono">
                {isStudent ? user.studentId : user.instructorId} · {isStudent ? 'Student' : 'Instructor'}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-xl text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
            <XIcon size={16} />
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-5 flex flex-col gap-5">
          <div className="bg-gray-50 dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-xl p-4 relative">
            {/* Edit button for instructors */}
            {!isStudent && !editing && (
              <button onClick={() => setEditing(true)} className="absolute top-3 right-3 text-gray-400 hover:text-indigo-500 transition-colors">
                <PencilIcon />
              </button>
            )}

            {editing ? (
              <div className="space-y-3">
                <div>
                  <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1 block">Role</label>
                  <select className="w-full text-sm bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-1.5" value={editData.roleType} onChange={e => setEditData({ ...editData, roleType: e.target.value })}>
                    <option value="student">Student</option>
                    <option value="instructor">Instructor</option>
                  </select>
                </div>
                {['name', 'email', 'department', 'courses'].map(field => (
                  <div key={field}>
                    <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1 block capitalize">{field === 'courses' ? 'Courses handled' : field}</label>
                    <input
                      className="w-full text-sm bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-1.5 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-green-500"
                      value={editData[field] || ''}
                      onChange={e => setEditData({ ...editData, [field]: e.target.value })}
                    />
                  </div>
                ))}
                <div>
                  <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1 block">ID</label>
                  <input
                    className="w-full text-sm bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-1.5 text-gray-900 dark:text-white font-mono focus:outline-none focus:ring-2 focus:ring-green-500"
                    value={editData.roleType === 'student' ? (editData.studentId || '') : (editData.instructorId || '')}
                    onChange={e => {
                      if (editData.roleType === 'student') setEditData({ ...editData, studentId: e.target.value })
                      else setEditData({ ...editData, instructorId: e.target.value })
                    }}
                  />
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <div>
                  <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-0.5">Email</p>
                  <p className="text-sm font-medium text-gray-900 dark:text-white break-all">{user.email}</p>
                </div>
                {!isStudent && (
                  <>
                    <div>
                      <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-0.5">Department</p>
                      <p className="text-sm font-medium text-gray-900 dark:text-white">{user.department}</p>
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-0.5">Courses Handled</p>
                      <p className="text-sm font-medium text-gray-900 dark:text-white">{user.courses}</p>
                    </div>
                  </>
                )}
                {isStudent && (
                  <>
                    <div>
                      <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-0.5">Course & Instructor</p>
                      <p className="text-sm font-medium text-gray-900 dark:text-white">{user.course} · {user.instructor}</p>
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-0.5">Assessment Status</p>
                      <p className="text-sm font-medium text-gray-900 dark:text-white capitalize">{user.status}</p>
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-0.5">Current Match</p>
                      <p className="text-sm font-medium text-gray-900 dark:text-white flex items-center gap-2">
                        {user.position ? (
                          <>
                            <span className={`font-bold ${matchColor(user.match)}`}>{user.match}%</span>
                            <span className="text-gray-400">·</span> {user.position}
                          </>
                        ) : 'No assessment data'}
                      </p>
                    </div>
                    {user.company && (
                      <div>
                        <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-0.5">Company</p>
                        <p className="text-sm font-medium text-gray-900 dark:text-white">{user.company}</p>
                      </div>
                    )}
                  </>
                )}
              </div>
            )}
          </div>

          {/* Action buttons */}
          <div className="flex flex-col gap-2">
            {editing ? (
              <>
                <button onClick={handleSave} className="w-full py-2.5 rounded-xl bg-green-600 hover:bg-green-700 text-white text-sm font-semibold transition-colors">Save changes</button>
                <button onClick={() => { setEditing(false); setEditData({ ...user, roleType: type }) }} className="w-full py-2.5 rounded-xl bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 text-sm font-semibold transition-colors">Cancel</button>
              </>
            ) : (
              <>
                {isStudent && user.status === 'completed' && (
                  <button
                    onClick={() => onToggleRetake(user.id)}
                    className={`flex items-center gap-2 justify-center w-full py-2.5 rounded-xl text-sm font-semibold transition-colors ${
                      user.retakeAllowed
                        ? 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300'
                        : 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
                    }`}
                  >
                    <RefreshIcon /> {user.retakeAllowed ? 'Retake has been allowed' : 'Allow Assessment Retake'}
                  </button>
                )}
                <button
                  onClick={() => onRemove(user)}
                  className="flex items-center gap-2 justify-center w-full py-2.5 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-600 dark:bg-rose-950 dark:hover:bg-rose-900 dark:text-rose-400 text-sm font-semibold transition-colors"
                >
                  <TrashIcon size={14} /> Remove {isStudent ? 'Student' : 'Instructor'}
                </button>
              </>
            )}
          </div>
        </div>
      </div>
      <style>{`@keyframes modalIn { from { transform: translateY(10px) scale(0.98); opacity: 0; } to { transform: translateY(0) scale(1); opacity: 1; } }`}</style>
    </div>
  )
}
