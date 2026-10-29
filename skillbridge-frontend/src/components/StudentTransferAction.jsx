import { useRef, useState } from 'react'
import DialogShell from './DialogShell'
import { useApi, invalidateCache } from '../hooks/useApi'

const button = 'min-h-11 rounded-xl border border-gray-300 px-3 py-2 text-xs font-semibold text-green-800 hover:bg-green-50 disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-green-600 dark:border-gray-700 dark:text-green-300 dark:hover:bg-green-950'

export default function StudentTransferAction({ batchId, batchName, isOpen, onClose, showTrigger = true }) {
  const [localOpen, setLocalOpen] = useState(false)
  const open = isOpen ?? localOpen
  function setOpen(value) { setLocalOpen(value); if (!value) onClose?.() }
  const [schoolId, setSchoolId] = useState('')
  const [review, setReview] = useState(null)
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)
  const pending = useRef(false)
  const { request, loading } = useApi()
  async function submit(e) {
    e.preventDefault()
    if (pending.current) return
    pending.current = true; setError('')
    try {
      const result = await request('post', `/api/instructor/batches/${batchId}/transfer/`, review ? { review_token: review.review_token } : { school_id: schoolId.trim() }, { silentError: true })
      if (!result.ok) { setError(result.message || 'Review the current memberships before retrying.'); setReview(null); return }
      if (result.data.transferred) { setReview(null); setDone(true); invalidateCache('/api/instructor/batches/'); invalidateCache('/api/students/me/'); invalidateCache('/api/admin/users/') }
      else setReview(result.data)
    } finally { pending.current = false }
  }
  return <>{showTrigger && <button className={button} onClick={() => { setOpen(true); setReview(null); setDone(false); setError('') }}>Transfer student</button>}
    {open && <DialogShell title="Transfer an existing student" description={`Move a student from another active batch into ${batchName}.`} onClose={() => { if (!pending.current) setOpen(false) }}>
      <form className="space-y-4 p-5 text-xs" onSubmit={submit}>
        <p className="leading-6 text-gray-600 dark:text-gray-300">Use this for a change of active batch. Students returning from an archived batch can use Enroll students. Transfers between instructors require an administrator.</p>
        {done ? <p role="status" className="leading-6 text-green-800 dark:text-green-300">Transfer saved. Previous results and placement history remain recorded. The student will review their profile before starting this batch's assessments. Enrollment email controls are available separately.</p> : <>
          <label className="block">Student school ID<input className="mt-2 block min-h-11 w-full rounded-xl border border-gray-300 bg-transparent px-3 dark:border-gray-700" value={schoolId} onChange={e => { setSchoolId(e.target.value); setReview(null) }} placeholder="YYYY-NNNNN" maxLength={20} required disabled={loading} /></label>
          {review && <div className="rounded-xl bg-gray-50 p-4 leading-6 dark:bg-gray-800"><p><strong>{review.student.name}</strong> · {review.student.school_id}</p><p>From {review.source} → {review.target}</p><p className="mt-2">This removes only their previous active membership. Recorded assessments, retakes and decisions stay in history. Approvals tied to the source batch stop reserving slots when that membership is removed.</p></div>}
          {error && <p role="alert" className="text-rose-700 dark:text-rose-300">{error}</p>}
          <button className={button} disabled={loading} type="submit">{loading ? 'Checking…' : review ? 'Confirm transfer' : 'Review transfer'}</button>
        </>}
      </form>
    </DialogShell>}
  </>
}
