// src/components/admin/AddInstructorModal.jsx
//
// Modal form for adding a new instructor account.
// Admin fills in DNSC email (auto-suggests name), name, instructor ID,
// department, and which courses they handle.
//
// Props:
//   existingInstructors — array of current instructors (for duplicate ID check)
//   onClose             — called when modal should close
//   onAdd(instrObj)     — called with the new instructor data object

import { useState } from 'react'
import { XIcon } from '../Icons'
import { nameFromEmail } from '../../utils/formatters'

export default function AddInstructorModal({ existingInstructors = [], onClose, onAdd }) {
  const [name,         setName]         = useState('')
  const [nameEdited,   setNameEdited]   = useState(false)
  const [email,        setEmail]        = useState('')
  const [instructorId, setInstructorId] = useState('')
  const [department,   setDepartment]   = useState('Institute of Computing')
  const [courses,      setCourses]      = useState('BSIT / BSIS')
  const [errors,       setErrors]       = useState({})

  function validate() {
    const e = {}
    if (!name.trim())         e.name         = 'Full name is required.'
    if (!email.trim())        e.email        = 'Email is required.'
    else if (!email.endsWith('@dnsc.edu.ph')) e.email = 'Must be a @dnsc.edu.ph email.'
    if (!instructorId.trim()) e.instructorId = 'Instructor ID is required.'
    else if (existingInstructors.some(i => i.instructorId === instructorId.trim()))
      e.instructorId = 'ID already in use.'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit() {
    if (!validate()) return
    setSubmitting(true)
    try {
      await onAdd({
        name:         name.trim(),
        email:        email.trim(),
        instructorId: instructorId.trim(),
        department,
        courses,
      })
      onClose()
    } finally {
      setSubmitting(false)
    }
  }

  const inputCls = (field) =>
    `w-full px-3 py-2 text-sm rounded-xl border bg-white dark:bg-gray-800 
     text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-gray-600
     focus:outline-none focus:ring-2 focus:ring-green-500 transition-colors
     ${errors[field] ? 'border-rose-400' : 'border-gray-200 dark:border-gray-700'}`

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-sm px-4 pb-4 sm:pb-0"
      onClick={e => e.target === e.currentTarget && onClose()}
    >
      <div className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-2xl shadow-xl w-full max-w-sm p-6 space-y-4">

        {/* Header */}
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-gray-900 dark:text-white">Add Instructor</h3>
          <button onClick={onClose} className="w-7 h-7 flex items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
            <XIcon />
          </button>
        </div>

        {/* DNSC Email */}
        <div>
          <label className="text-xs font-medium text-gray-700 dark:text-gray-300 block mb-1">DNSC Email</label>
          <input
            value={email}
            onChange={e => {
              const val = e.target.value
              setEmail(val)
              setErrors(err => ({ ...err, email: '' }))
              if (!nameEdited && val.includes('.')) {
                setName(nameFromEmail(val.trim().toLowerCase()))
              }
            }}
            placeholder="e.g. mtreyes@dnsc.edu.ph"
            className={inputCls('email')}
          />
          {errors.email && <p className="text-xs text-rose-500 mt-1">{errors.email}</p>}
        </div>

        {/* Full Name */}
        <div>
          <label className="text-xs font-medium text-gray-700 dark:text-gray-300 block mb-1">Full Name</label>
          <input
            value={name}
            onChange={e => { setName(e.target.value); setNameEdited(true); setErrors(err => ({ ...err, name: '' })) }}
            placeholder="e.g. Ma. Lourdes T. Reyes"
            className={inputCls('name')}
          />
          {errors.name && <p className="text-xs text-rose-500 mt-1">{errors.name}</p>}
        </div>

        {/* Instructor ID */}
        <div>
          <label className="text-xs font-medium text-gray-700 dark:text-gray-300 block mb-1">Instructor ID</label>
          <input
            value={instructorId}
            onChange={e => { setInstructorId(e.target.value); setErrors(err => ({ ...err, instructorId: '' })) }}
            placeholder="e.g. 2018-00042"
            className={inputCls('instructorId') + ' font-mono'}
          />
          {errors.instructorId && <p className="text-xs text-rose-500 mt-1">{errors.instructorId}</p>}
        </div>

        {/* Department */}
        <div>
          <label className="text-xs font-medium text-gray-700 dark:text-gray-300 block mb-1">Department</label>
          <input
            value={department}
            onChange={e => setDepartment(e.target.value)}
            placeholder="e.g. Institute of Computing"
            className={inputCls('department')}
          />
        </div>

        {/* Courses */}
        <div>
          <label className="text-xs font-medium text-gray-700 dark:text-gray-300 block mb-1">Courses Handled</label>
          <div className="flex gap-2">
            {[
              { val: 'BSIT',        label: 'BSIT only' },
              { val: 'BSIS',        label: 'BSIS only' },
              { val: 'BSIT / BSIS', label: 'Both'      },
            ].map(opt => (
              <button
                key={opt.val}
                onClick={() => setCourses(opt.val)}
                className={`flex-1 py-1.5 rounded-xl text-xs font-semibold border transition-colors
                  ${courses === opt.val
                    ? 'bg-green-600 border-green-600 text-white'
                    : 'border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:border-green-400'}`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-2 pt-2">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-xl text-sm font-medium bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors">
            Cancel
          </button>
          <button onClick={handleSubmit} disabled={submitting} className="flex-1 py-2.5 rounded-xl text-sm font-medium bg-green-600 hover:bg-green-700 text-white transition-colors disabled:opacity-60 disabled:cursor-not-allowed">
            {submitting ? 'Adding...' : 'Add Instructor'}
          </button>
        </div>
      </div>
    </div>
  )
}
