// src/components/Pagination.jsx
//
// Reusable pagination bar used in:
//   AdminDashboard, InstructorDashboard, AdminUsers, EnrolledStudents
//
// Props:
//   total   — total number of items
//   page    — current page (1-indexed)
//   onPage  — callback(newPage)
//   pageSize — items per page (default 10)

export default function Pagination({ total, page, onPage, pageSize = 10 }) {
  const pages = Math.ceil(total / pageSize)
  if (pages <= 1) return null

  const from = (page - 1) * pageSize + 1
  const to   = Math.min(page * pageSize, total)

  // Build page number list with ellipsis gaps
  const nums = Array.from({ length: pages }, (_, i) => i + 1)
    .filter(p => p === 1 || p === pages || Math.abs(p - page) <= 1)

  const btnBase = 'transition-colors text-xs font-medium rounded-lg'

  return (
    <div className="flex flex-col sm:flex-row items-center justify-between gap-2 px-1 py-1">
      <p className="text-xs text-gray-400 dark:text-gray-500 order-2 sm:order-1">
        Showing {from}–{to} of {total}
      </p>
      <div className="flex items-center gap-1 order-1 sm:order-2">
        <button
          onClick={() => onPage(page - 1)}
          disabled={page === 1}
          className={`${btnBase} px-3 py-1.5 bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400
            disabled:opacity-40 hover:bg-gray-200 dark:hover:bg-gray-700 disabled:cursor-not-allowed`}
        >
          ← Prev
        </button>

        {nums.reduce((acc, p, idx, arr) => {
          if (idx > 0 && p - arr[idx - 1] > 1) acc.push('…')
          acc.push(p)
          return acc
        }, []).map((p, i) =>
          p === '…'
            ? <span key={`ellipsis-${i}`} className="text-xs text-gray-300 dark:text-gray-700 px-1">…</span>
            : <button
                key={p}
                onClick={() => onPage(p)}
                className={`${btnBase} w-8 h-8
                  ${p === page
                    ? 'bg-gray-900 dark:bg-white text-white dark:text-gray-900'
                    : 'text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'}`}
              >
                {p}
              </button>
        )}

        <button
          onClick={() => onPage(page + 1)}
          disabled={page === pages}
          className={`${btnBase} px-3 py-1.5 bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400
            disabled:opacity-40 hover:bg-gray-200 dark:hover:bg-gray-700 disabled:cursor-not-allowed`}
        >
          Next →
        </button>
      </div>
    </div>
  )
}
