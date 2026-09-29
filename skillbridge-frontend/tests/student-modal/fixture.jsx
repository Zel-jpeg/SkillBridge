import { useState } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { SessionProvider, useSession } from '../../src/context/SessionContext'
import StudentModal from '../../src/components/instructor/StudentModal'
import UserDetailModal from '../../src/components/admin/UserDetailModal'
import AssessmentStudentDetail from '../../src/components/AssessmentStudentDetail'
import { syntheticStudent } from './data.mjs'
import '../../src/index.css'

export default function Fixture() {
  const { triggerSessionExpired } = useSession()
  const params = new URLSearchParams(window.location.search)
  const mode = params.get('mode') || 'instructor'
  const [student, setStudent] = useState(() => syntheticStudent(params.get('scenario') || 'complete'))
  const [open, setOpen] = useState(false)
  const [action, setAction] = useState('')
  const instructor = { id: 9002, name: 'QA Instructor', email: 'qa.instructor@example.invalid', instructorId: 'QA-IN-001', department: 'QA Computing', courses: 'BSIT / BSIS' }
  function retake(studentId, assessmentId) {
    setAction(`retake:${studentId}:${assessmentId}`)
    setStudent(previous => ({ ...previous, assessment_results: previous.assessment_results.map(result => result.id === assessmentId ? { ...result, retake_allowed: !result.retake_allowed } : result) }))
  }
  return <main className="min-h-[150dvh] bg-gray-50 p-4 text-gray-900 dark:bg-gray-950 dark:text-gray-100">
    <div className="fixed left-0 top-0 z-[90] h-12 w-full bg-gray-200 dark:bg-gray-800" aria-hidden="true" />
    <div className="relative pt-16"><h1>Student modal synthetic QA</h1><button type="button" id="open-detail" className="rounded-lg border p-3" onClick={() => setOpen(true)}>Open details</button><button type="button" id="expire-session" onClick={triggerSessionExpired}>Simulate session expiry</button><output className="block">{action}</output></div>
    {mode === 'inline' && <section className="mt-4 max-w-xl"><AssessmentStudentDetail student={student} onToggleRetake={retake} /></section>}
    {open && (mode === 'admin' || mode === 'admin-instructor' ? <UserDetailModal user={mode === 'admin' ? student : instructor} type={mode === 'admin' ? 'student' : 'instructor'} onClose={() => setOpen(false)} onToggleRetake={retake} onUpdate={draft => { setAction(`saved:${draft.name}`); setOpen(false) }} onRemove={() => { setAction('remove'); setOpen(false) }} /> : <StudentModal student={student} readOnly={mode === 'dashboard'} isArchived={student.archived} onClose={() => setOpen(false)} onToggleRetake={retake} />)}
  </main>
}
createRoot(document.getElementById('root')).render(<BrowserRouter><SessionProvider><Fixture /></SessionProvider></BrowserRouter>)
