import Avatar from '../Avatar'

export default function ProgramInstructorCard({ instructor, status, available, action }) {
  return <li className="flex min-w-0 flex-col gap-3 rounded-2xl border border-gray-200 bg-white p-4 transition-[border-color,box-shadow] hover:border-green-300 hover:shadow-md focus-within:border-green-500 dark:border-gray-800 dark:bg-gray-900 dark:hover:border-green-700">
    <div className="flex items-start justify-between gap-2">
      <div className="flex min-w-0 items-center gap-3">
        <Avatar name={instructor.name || instructor.email} photoUrl={instructor.photo_url} className="h-9 w-9 rounded-xl text-xs" />
        <div className="min-w-0"><h3 className="break-words text-sm font-semibold text-gray-900 dark:text-white">{instructor.name || instructor.email}</h3>
          {instructor.school_id && <p className="mt-1 break-all font-mono text-xs text-gray-500 dark:text-gray-400">{instructor.school_id}</p>}</div>
      </div>
      <span className="shrink-0 rounded-full bg-violet-100 px-2 py-0.5 text-xs font-semibold text-violet-700 dark:bg-violet-900 dark:text-violet-300">Instructor</span>
    </div>
    <p className="break-all text-xs leading-5 text-gray-500 dark:text-gray-400">{instructor.email}</p>
    <div className="mt-auto flex flex-wrap items-center justify-between gap-2 border-t border-gray-100 pt-3 dark:border-gray-800">
      {status && <p className={`text-xs ${available ? 'text-green-800 dark:text-green-300' : 'text-gray-500 dark:text-gray-400'}`}>{status}</p>}
      <div className="ml-auto">{action}</div>
    </div>
  </li>
}
