// src/components/SearchBar.jsx
//
// Search input with magnifying glass icon.
// Used in: AdminDashboard, InstructorDashboard, AdminUsers, EnrolledStudents
//
// Props:
//   value       — controlled value
//   onChange    — callback(newValue: string)
//   placeholder — string (default: 'Search…')
//   className   — optional extra classes for the wrapper div

export default function SearchBar({ value, onChange, placeholder = 'Search…', className = '' }) {
  return (
    <div className={`relative ${className}`}>
      <svg
        className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none"
        fill="none" stroke="currentColor" viewBox="0 0 24 24"
      >
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
          d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z"/>
      </svg>
      <input
        type="text"
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full pl-8 pr-3 py-2 text-sm rounded-xl border border-gray-200 dark:border-gray-700
          bg-white dark:bg-gray-800 text-gray-900 dark:text-white
          placeholder:text-gray-400 dark:placeholder:text-gray-600
          focus:outline-none focus:ring-2 focus:ring-green-500 transition-colors"
      />
    </div>
  )
}
