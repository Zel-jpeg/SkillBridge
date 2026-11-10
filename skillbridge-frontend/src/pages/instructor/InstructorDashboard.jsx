import { getCachedData } from '../../hooks/useApi'
import { useRef } from 'react'
// src/pages/instructor/InstructorDashboard.jsx  (SLIMMED — 937 → ~200 lines)
// All data + logic now in useInstructorDashboard.js
// StudentModal now in components/instructor/StudentModal.jsx

import { Link, useNavigate }    from 'react-router-dom'
import { ChevronRightIcon, UsersIcon } from '../../components/Icons'
import StudentModal             from '../../components/instructor/StudentModal'
import DashboardStudentCollection from '../../components/dashboard/DashboardStudentCollection'
import DashboardHighlights from '../../components/dashboard/DashboardHighlights'
import DashboardOverview from '../../components/dashboard/DashboardOverview'
import { useInstructorDashboard } from '../../hooks/instructor/useInstructorDashboard'

export default function InstructorDashboard() {
  const navigate = useNavigate()
  const { studentsList, loading, selectedStudent, setSelectedStudent } = useInstructorDashboard()

  const studentTrigger = useRef(null)
  function selectStudent(student, trigger = document.activeElement) {
    studentTrigger.current = trigger
    setSelectedStudent(student)
  }

  // Instructor from localStorage (read in hook, also readable here for nav)
  const cachedUser = (() => { try { return JSON.parse(localStorage.getItem('sb-user')) } catch { return null } })()
  const instructor = {
    name:     cachedUser?.name    || 'Instructor',
    initials: (cachedUser?.name || 'IN').split(' ').map(n => n[0]).slice(0, 2).join(''),
    subject:  cachedUser?.course  || 'OJT Coordinator',
  }

  return (
    <div className="min-w-0">



      {selectedStudent && (
        <StudentModal
          student={selectedStudent}
          restoreFocusRef={studentTrigger}
          instructorName={cachedUser?.name}
          onClose={() => setSelectedStudent(null)}
          readOnly // Retakes are managed in the batch roster.
        />
      )}

      <section className="max-w-6xl mx-auto px-4 sm:px-6 py-6 sm:py-8 flex flex-col gap-6 sm:gap-8">

        {/* Header */}
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-xl font-bold text-gray-900 dark:text-white">Student performance</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
              {instructor.subject}{loading ? ' · Loading batch…' : studentsList.length > 0 ? ` · ${studentsList[0]?.batch?.name || 'Active batch'}` : ' · No active batch'}
            </p>
          </div>
          <div className="flex max-w-full items-center gap-2 flex-wrap">
            <button onClick={() => navigate('/instructor/students')}
              className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold px-4 py-2.5 rounded-xl transition-colors">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" stroke="white" strokeWidth="2.5" strokeLinecap="round"/><circle cx="9" cy="7" r="4" stroke="white" strokeWidth="2.5"/><line x1="19" y1="8" x2="19" y2="14" stroke="white" strokeWidth="2.5" strokeLinecap="round"/><line x1="22" y1="11" x2="16" y2="11" stroke="white" strokeWidth="2.5" strokeLinecap="round"/></svg>
              Enroll Students
            </button>
            <button onClick={() => navigate('/instructor/assessment/create')}
              className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white text-sm font-semibold px-4 py-2.5 rounded-xl transition-colors">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M12 5v14M5 12h14" stroke="white" strokeWidth="2.5" strokeLinecap="round"/></svg>
              New assessment
            </button>
          </div>
        </div>

        <DashboardOverview role="instructor" />

        {/* First-use guidance stays visible until there are students in scope. */}
        {!loading && getCachedData("/api/instructor/students/recommendations/") != null && studentsList.length === 0 && (
          <section aria-labelledby="instructor-batch-setup-title" className="grid grid-cols-[auto_minmax(0,1fr)] items-start gap-x-3 gap-y-4 rounded-2xl border border-green-200/70 bg-white p-4 sm:gap-x-5 sm:p-6 lg:grid-cols-[auto_minmax(0,1fr)_auto] lg:items-center dark:border-green-900/70 dark:bg-gray-900">
            <div aria-hidden="true" className="flex h-10 w-10 items-center justify-center rounded-xl bg-green-50 text-green-600 sm:h-12 sm:w-12 dark:bg-green-950/50 dark:text-green-400">
              <UsersIcon size={24} />
            </div>
            <div className="min-w-0">
              <h2 id="instructor-batch-setup-title" className="text-base font-semibold text-gray-900 dark:text-white">Set up your first batch</h2>
              <p className="mt-1 text-xs leading-5 text-gray-500 dark:text-gray-400">Create a batch and enroll students to see assessment results and placement recommendations here.</p>
              <ol aria-label="Batch setup steps" className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-gray-600 dark:text-gray-300">
                <li className="flex items-center gap-2">
                  <span aria-hidden="true" className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-green-300 bg-green-50 font-semibold text-green-700 dark:border-green-700 dark:bg-green-950/50 dark:text-green-300">1</span>
                  Create a batch
                  <span aria-hidden="true" className="ml-1 text-gray-400 dark:text-gray-500"><ChevronRightIcon /></span>
                </li>
                <li className="flex items-center gap-2">
                  <span aria-hidden="true" className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-gray-200 bg-gray-50 font-semibold text-gray-600 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300">2</span>
                  Enroll students
                </li>
              </ol>
              <p className="mt-3 text-xs leading-5 text-gray-500 dark:text-gray-400">Archived batches remain available on the Students page.</p>
            </div>
            <Link to="/instructor/students" className="col-span-2 inline-flex min-h-11 w-full items-center justify-center gap-2 whitespace-nowrap rounded-xl bg-green-600 px-4 py-2.5 text-xs font-semibold text-white transition-colors hover:bg-green-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-green-600 lg:col-span-1 lg:w-auto dark:focus-visible:outline-green-400">
              Go to Students
              <span aria-hidden="true"><ChevronRightIcon /></span>
            </Link>
          </section>
        )}

        <DashboardHighlights loadingUrl="/api/instructor/students/recommendations/" students={studentsList} onSelectStudent={selectStudent} />

        <DashboardStudentCollection students={studentsList} loading={loading} loadingUrl="/api/instructor/students/recommendations/" onSelectStudent={selectStudent} />


      </section>
    </div>
  )
}
