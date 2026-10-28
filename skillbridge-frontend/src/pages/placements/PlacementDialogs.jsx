import { useRef, useState } from 'react'
import Avatar from '../../components/Avatar'
import DialogShell from '../../components/DialogShell'

const inputClass = 'w-full rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-950 px-3 py-2.5 text-xs text-gray-900 dark:text-white focus-visible:outline-2 focus-visible:outline-green-600'
function ModalShell({ children, onClose }) {
  return <DialogShell title="Placement decision" description="Review the target student and position before confirming." size="placement" onClose={onClose} closeLabel="Close placement decision"><div className="min-h-0 overflow-y-auto">{children}</div></DialogShell>
}

export function ActionModal({ action, busy, onClose, onSubmit }) {
  const [remarks, setRemarks] = useState('')
  const [error, setError] = useState('')
  const pending = useRef(false)
  if (!action) return null
  const labels = {
    approve: ['Approve placement?', 'Confirm this student for the position. One slot will become approved.', 'Approve student', 'pl-primary'],
    remove: ['Remove approved placement?', 'This releases the approved slot and keeps the decision in history.', 'Remove placement', 'pl-danger-solid'],
    reject: ['Decline this suggestion?', 'Only this student-position suggestion is declined. Other alternatives remain available.', 'Decline suggestion', 'pl-danger-solid'],
  }
  const [title, description, button, buttonClass] = labels[action.type]
  async function submit(event) {
    event.preventDefault()
    if (pending.current) return
    if (action.type !== 'approve' && !remarks.trim()) { setError('Enter a reason for this decision.'); return }
    pending.current = true; setError('')
    try {
      const result = await onSubmit(action, remarks.trim())
      if (result?.ok) onClose()
      else setError(result?.message || 'The action was not saved. Check the current placement before retrying.')
    } catch { setError('The action could not be confirmed. Refresh the placement before trying again.') }
    finally { pending.current = false }
  }
  return (
    <ModalShell onClose={onClose}>
      <form onSubmit={submit} className="p-6">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white pr-10">{title}</h2>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{description}</p>
        <div className="mt-4 rounded-xl bg-gray-50 dark:bg-gray-800 p-3">
          <div className="flex items-center gap-2"><Avatar name={action.suggestion.student.name} photoUrl={action.suggestion.student.photo_url} /><p className="text-sm font-semibold text-gray-900 dark:text-white">{action.suggestion.student.name}</p></div>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{action.position.title} at {action.company.name}</p>
          <p className="text-xs text-gray-400 mt-1">{action.position.remaining_slots} of {action.position.slots_available} slots remaining</p>
        </div>
        <label htmlFor="placement-decision-remarks" className="block text-xs font-semibold text-gray-600 dark:text-gray-300 mt-4 mb-1.5">{action.type === 'approve' ? 'Remarks (optional)' : 'Reason (required)'}</label>
        <textarea id="placement-decision-remarks" required={action.type !== 'approve'} value={remarks} onChange={event => setRemarks(event.target.value)} rows={3} autoFocus placeholder="Add context for placement history…" className={inputClass} />
        {error && <p role="alert" className="mt-3 text-sm text-rose-700 dark:text-rose-300">{error}</p>}
        <div className="flex gap-2 mt-5">
          <button type="button" onClick={onClose} disabled={busy} className="pl-button flex-1">Cancel</button>
          <button type="submit" disabled={busy} className={`pl-button flex-1 ${buttonClass}`}>{busy ? 'Saving…' : button}</button>
        </div>
      </form>
    </ModalShell>
  )
}

export function ManualAssignmentModal({ students, positions, approvedByStudent, initialPositionId, busy, onClose, onSubmit }) {
  const pending = useRef(false)
  const [error, setError] = useState('')
  const [studentId, setStudentId] = useState('')
  const [positionId, setPositionId] = useState(initialPositionId ? String(initialPositionId) : '')
  const [studentSearch, setStudentSearch] = useState('')
  const [positionSearch, setPositionSearch] = useState('')
  const [remarks, setRemarks] = useState('')
  const filteredStudents = students.filter(student => { const term = studentSearch.trim().toLowerCase(); return !term || [student.name, student.student_id, student.course, student.batch?.name].filter(Boolean).some(value => String(value).toLowerCase().includes(term)) })
  const filteredPositions = positions.filter(position => { const term = positionSearch.trim().toLowerCase(); return !term || [position.company_name, position.title].some(value => value.toLowerCase().includes(term)) })
  const selectedStudent = students.find(student => String(student.id) === studentId)
  const selectedPosition = positions.find(position => String(position.id) === positionId)
  const existingPlacement = selectedStudent ? approvedByStudent.get(selectedStudent.id) : null
  const full = selectedPosition?.remaining_slots <= 0
  const blocked = !selectedStudent || !selectedPosition || Boolean(existingPlacement) || full
  async function submit(event) {
    event.preventDefault()
    if (blocked || pending.current) return
    pending.current = true; setError('')
    try {
      const result = await onSubmit(selectedStudent.id, selectedPosition.id, remarks.trim())
      if (result?.ok) onClose()
      else setError(result?.message || 'Assignment was not saved. Review the current capacity and try again.')
    } catch { setError('The assignment could not be confirmed. Refresh before retrying.') }
    finally { pending.current = false }
  }

  return (
    <ModalShell onClose={onClose}>
      <form onSubmit={submit} className="p-6">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white pr-10">Manual placement assignment</h2>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Choose a student and position. This action approves a placement directly; existing approvals and shared suggested slots still apply.</p>
        <div className="grid md:grid-cols-2 gap-4 mt-5">
          <div>
            <label htmlFor="placement-student-search" className="block text-xs font-semibold text-gray-600 dark:text-gray-300 mb-1.5">Find student</label>
            <input id="placement-student-search" value={studentSearch} onChange={event => setStudentSearch(event.target.value)} placeholder="Name, school ID, course, or batch" className={inputClass} />
            <div className="mt-2 max-h-52 overflow-y-auto rounded-xl border border-gray-100 dark:border-gray-800 divide-y divide-gray-100 dark:divide-gray-800">
              {filteredStudents.map(student => { const approved = approvedByStudent.get(student.id); return <button key={student.id} type="button" aria-pressed={studentId === String(student.id)} onClick={() => setStudentId(String(student.id))} className={`pl-option w-full text-left px-3 py-2.5 transition-colors ${studentId === String(student.id) ? 'bg-green-50 dark:bg-green-950/30' : 'hover:bg-gray-50 dark:hover:bg-gray-800'}`}><div className="flex items-center gap-2"><Avatar name={student.name} photoUrl={student.photo_url} className="w-8 h-8 rounded-lg text-xs" /><p className="text-sm font-medium text-gray-900 dark:text-white">{student.name}</p></div><p className="text-[11px] text-gray-500 dark:text-gray-400">{student.student_id || 'No school ID'} · {student.course || 'No course'} · {student.batch?.name || 'No batch'}</p>{approved && <p className="text-[11px] text-violet-600 dark:text-violet-400 mt-0.5">Already placed at {approved.company.name}</p>}</button> })}
              {!filteredStudents.length && <p className="p-4 text-xs text-center text-gray-400">No students found.</p>}
            </div>
          </div>
          {initialPositionId ? <div className="rounded-xl bg-gray-50 dark:bg-gray-800 p-4"><p className="text-xs text-gray-500">Position to approve</p><h3 className="text-sm font-semibold mt-2">{selectedPosition?.title}</h3><p className="text-xs mt-1">{selectedPosition?.company_name}</p><p className="text-xs text-gray-500 mt-2">{selectedPosition?.remaining_slots} of {selectedPosition?.slots_available} slots not yet approved</p></div> : <div>
            <label htmlFor="placement-position-search" className="block text-xs font-semibold text-gray-600 dark:text-gray-300 mb-1.5">Find partner position</label>
            <input id="placement-position-search" value={positionSearch} onChange={event => setPositionSearch(event.target.value)} placeholder="Partner or position title" className={inputClass} />
            <div className="mt-2 max-h-52 overflow-y-auto rounded-xl border border-gray-100 dark:border-gray-800 divide-y divide-gray-100 dark:divide-gray-800">
              {filteredPositions.map(position => <button key={position.id} type="button" aria-pressed={positionId === String(position.id)} onClick={() => setPositionId(String(position.id))} className={`pl-option w-full text-left px-3 py-2.5 transition-colors ${positionId === String(position.id) ? 'bg-green-50 dark:bg-green-950/30' : 'hover:bg-gray-50 dark:hover:bg-gray-800'}`}><p className="text-sm font-medium text-gray-900 dark:text-white">{position.title}</p><p className="text-[11px] text-gray-500 dark:text-gray-400">{position.company_name} · {position.remaining_slots} of {position.slots_available} slots left</p>{position.remaining_slots <= 0 && <p className="text-[11px] text-rose-600 dark:text-rose-400 mt-0.5">Position is full</p>}</button>)}
              {!filteredPositions.length && <p className="p-4 text-xs text-center text-gray-400">No positions found.</p>}
            </div>
          </div>}
        </div>
        {existingPlacement && <div className="mt-4 rounded-xl bg-violet-50 dark:bg-violet-950/40 px-4 py-3 text-sm text-violet-700 dark:text-violet-300">{selectedStudent.name} already has an approved placement as {existingPlacement.position.title} at {existingPlacement.company.name}. Remove that placement before assigning another.</div>}
        {full && <div className="mt-4 rounded-xl bg-rose-50 dark:bg-rose-950/40 px-4 py-3 text-sm text-rose-700 dark:text-rose-300">{selectedPosition.title} is full. Increase capacity in Partners or remove an approved placement first.</div>}
        <label className="block mt-4"><span className="block text-xs font-semibold text-gray-600 dark:text-gray-300 mb-1.5">Remarks (optional)</span><textarea value={remarks} onChange={event => setRemarks(event.target.value)} rows={3} placeholder="Why is this student being assigned manually?" className={inputClass} /></label>
        {error && <p role="alert" className="mt-3 text-xs text-rose-700 dark:text-rose-300">{error}</p>}
        <div className="flex gap-2 mt-5"><button type="button" onClick={onClose} disabled={busy} className="pl-button flex-1">Cancel</button><button type="submit" disabled={busy || blocked} className="pl-button pl-primary flex-1">{busy ? 'Assigning…' : 'Assign student'}</button></div>
      </form>
    </ModalShell>
  )
}

