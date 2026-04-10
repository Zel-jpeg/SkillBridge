import { useNavigate } from 'react-router-dom'

export default function InstructorPending() {
  const navigate = useNavigate()

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex flex-col items-center justify-center px-4 relative overflow-hidden">
      
      {/* Background decorations */}
      <div className="absolute top-1/4 left-0 w-64 h-64 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 right-0 w-80 h-80 bg-green-500/5 rounded-full blur-3xl pointer-events-none" />
      
      <div className="w-full max-w-md bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-3xl shadow-xl p-8 relative z-10 text-center">
        
        {/* Animated Hourglass Icon */}
        <div className="w-20 h-20 bg-amber-50 dark:bg-amber-900/30 rounded-2xl mx-auto flex items-center justify-center mb-6 shadow-sm border border-amber-100 dark:border-amber-900/50">
          <svg className="text-amber-500 animate-pulse" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M5 22h14" />
            <path d="M5 2h14" />
            <path d="M17 22v-4.172a2 2 0 0 0-.586-1.414L12 12l-4.414 4.414A2 2 0 0 0 7 17.828V22" />
            <path d="M7 2v4.172a2 2 0 0 0 .586 1.414L12 12l4.414-4.414A2 2 0 0 0 17 6.172V2" />
          </svg>
        </div>

        <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Account Pending Verification</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-8 leading-relaxed">
          Your request to access SkillBridge as an <strong className="text-gray-700 dark:text-gray-300">Instructor</strong> has been received and is waiting for administrator approval. This usually takes between 1-24 hours.
        </p>

        <div className="space-y-3">
          <button 
            onClick={() => window.location.reload()}
            className="w-full py-3 rounded-xl bg-gray-900 dark:bg-white text-white dark:text-gray-900 font-semibold text-sm hover:bg-gray-800 dark:hover:bg-gray-100 transition-all shadow-md active:scale-[0.98]"
          >
            Check Status Again
          </button>
          
          <button 
            onClick={() => navigate('/login')}
            className="w-full py-3 rounded-xl bg-gray-50 dark:bg-gray-800 text-gray-600 dark:text-gray-300 font-semibold text-sm border border-gray-200 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-700 transition-all active:scale-[0.98]"
          >
            Cancel & Sign Out
          </button>
        </div>

        <p className="text-xs text-gray-400 dark:text-gray-500 mt-8">
          Logged in as <b>faculty@dnsc.edu.ph</b>
        </p>
      </div>

    </div>
  )
}
