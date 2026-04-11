// src/components/StatCard.jsx
//
// Colored stat card with icon + big number + label.
// Used in: AdminDashboard, InstructorDashboard
//
// Props:
//   icon     — React node (SVG icon)
//   label    — string
//   value    — string | number
//   sub      — optional subtitle below value
//   color    — 'blue' | 'violet' | 'amber' | 'green' | 'rose' | 'gray'
//   bold     — optional: make value a specific color ('green' | 'amber' | 'default')

const COLOR_MAP = {
  blue:   'bg-blue-50   dark:bg-blue-950   text-blue-700   dark:text-blue-300   border-blue-100   dark:border-blue-900',
  violet: 'bg-violet-50 dark:bg-violet-950 text-violet-700 dark:text-violet-300 border-violet-100 dark:border-violet-900',
  amber:  'bg-amber-50  dark:bg-amber-950  text-amber-700  dark:text-amber-300  border-amber-100  dark:border-amber-900',
  green:  'bg-green-50  dark:bg-green-950  text-green-700  dark:text-green-300  border-green-100  dark:border-green-900',
  rose:   'bg-rose-50   dark:bg-rose-950   text-rose-700   dark:text-rose-300   border-rose-100   dark:border-rose-900',
  gray:   'bg-white     dark:bg-gray-900   text-gray-700   dark:text-gray-300   border-gray-100   dark:border-gray-800',
}

const VALUE_COLOR = {
  green:   'text-green-600 dark:text-green-400',
  amber:   'text-amber-500 dark:text-amber-400',
  rose:    'text-rose-500  dark:text-rose-400',
  default: 'text-gray-900  dark:text-white',
}

export default function StatCard({ icon, label, value, sub, color = 'gray', valueColor = 'default' }) {
  const cardCls  = COLOR_MAP[color]  ?? COLOR_MAP.gray
  const valueCls = VALUE_COLOR[valueColor] ?? VALUE_COLOR.default

  return (
    <div className={`border rounded-2xl p-4 sm:p-5 flex flex-col gap-2 ${cardCls}`}>
      {icon && <div className="opacity-70">{icon}</div>}
      <p className={`text-2xl sm:text-3xl font-bold ${valueCls}`}>{value}</p>
      <p className="text-xs font-medium opacity-80">{label}</p>
      {sub && <p className="text-xs opacity-60">{sub}</p>}
    </div>
  )
}
