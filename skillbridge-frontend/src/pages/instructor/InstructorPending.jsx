import { useLocation, useNavigate } from 'react-router-dom'

export default function InstructorPending() {
  const navigate = useNavigate()
  const location = useLocation()
  const type = location.state?.type  // 'student_waiting' | 'not_enrolled' | undefined (instructor)

  const isNotEnrolled     = type === 'not_enrolled'
  const isStudentWaiting  = type === 'student_waiting'

  // ── Content variants ────────────────────────────────────────────
  const icon = isNotEnrolled ? (
    /* Person with X — "not enrolled" */
    <svg className="text-red-400" width="40" height="40" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="8" r="4"/>
      <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/>
      <line x1="17" y1="3" x2="21" y2="7"/>
      <line x1="21" y1="3" x2="17" y2="7"/>
    </svg>
  ) : (
    /* Hourglass — waiting */
    <svg className="text-amber-500 animate-pulse" width="40" height="40" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 22h14"/>
      <path d="M5 2h14"/>
      <path d="M17 22v-4.172a2 2 0 0 0-.586-1.414L12 12l-4.414 4.414A2 2 0 0 0 7 17.828V22"/>
      <path d="M7 2v4.172a2 2 0 0 0 .586 1.414L12 12l4.414-4.414A2 2 0 0 0 17 6.172V2"/>
    </svg>
  )

  const iconBg = isNotEnrolled
    ? 'bg-red-50 dark:bg-red-900/30 border-red-100 dark:border-red-900/50'
    : 'bg-amber-50 dark:bg-amber-900/30 border-amber-100 dark:border-amber-900/50'

  const title = isNotEnrolled
    ? 'Not Yet Enrolled'
    : isStudentWaiting
    ? 'Student Account Pending Enrollment'
    : 'Account Pending Verification'

  const description = isNotEnrolled
    ? 'Your DNSC Google account is valid, but you have not been enrolled in SkillBridge yet. Please approach your OJT instructor or coordinator to have your account enrolled before you can log in.'
    : isStudentWaiting
    ? 'Your DNSC account is recognized as a Student, but you are not enrolled in a batch yet. Please wait for your instructor to enroll you first before you can access SkillBridge.'
    : 'Your request to access SkillBridge as an Instructor has been received and is waiting for administrator approval.'

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex flex-col items-center justify-center px-4 relative overflow-hidden">
      
      {/* Background decorations */}
      <div className={`absolute top-1/4 left-0 w-64 h-64 rounded-full blur-3xl pointer-events-none ${isNotEnrolled ? 'bg-red-500/10' : 'bg-amber-500/10'}`} />
      <div className="absolute bottom-1/4 right-0 w-80 h-80 bg-green-500/5 rounded-full blur-3xl pointer-events-none" />
      
      <div className="w-full max-w-md bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-3xl shadow-xl p-8 relative z-10 text-center">
        
        {/* Icon */}
        <div className={`w-20 h-20 rounded-2xl mx-auto flex items-center justify-center mb-6 shadow-sm border ${iconBg}`}>
          {icon}
        </div>

        <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">{title}</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-8 leading-relaxed">
          {description}
        </p>

        {/* Extra info card for not-enrolled users */}
        {isNotEnrolled && (
          <div className="mb-6 bg-green-50 dark:bg-green-950/40 border border-green-200 dark:border-green-800 rounded-2xl px-4 py-4 text-left">
            <p className="text-xs font-semibold text-green-800 dark:text-green-200 mb-1">What to do next</p>
            <ul className="text-xs text-green-700 dark:text-green-300 space-y-1 list-disc list-inside leading-relaxed">
              <li>Visit your OJT instructor or coordinator in person</li>
              <li>Ask them to enroll your DNSC email in the system</li>
              <li>Once enrolled, you can log in with this same Google account</li>
            </ul>
          </div>
        )}

        <div className="space-y-3">
          {!isNotEnrolled && (
            <button 
              onClick={() => window.location.reload()}
              className="w-full py-3 rounded-xl bg-gray-900 dark:bg-white text-white dark:text-gray-900 font-semibold text-sm hover:bg-gray-800 dark:hover:bg-gray-100 transition-all shadow-md active:scale-[0.98]"
            >
              Check Status Again
            </button>
          )}
          
          <button 
            onClick={() => navigate('/login')}
            className="w-full py-3 rounded-xl bg-gray-50 dark:bg-gray-800 text-gray-600 dark:text-gray-300 font-semibold text-sm border border-gray-200 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-700 transition-all active:scale-[0.98]"
          >
            {isNotEnrolled ? 'Back to Login' : 'Cancel & Sign Out'}
          </button>
        </div>

        <p className="text-xs text-gray-400 dark:text-gray-500 mt-8">
          SkillBridge · Davao del Norte State College
        </p>
      </div>

    </div>
  )
}
