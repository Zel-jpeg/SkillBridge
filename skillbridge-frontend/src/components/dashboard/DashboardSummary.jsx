const tones = {
  neutral: 'text-gray-900 dark:text-white',
  success: 'text-green-600 dark:text-green-400',
  warning: 'text-amber-600 dark:text-amber-400',
  attention: 'text-rose-600 dark:text-rose-400',
}

export default function DashboardSummary({ cards }) {
  return <dl aria-label="Dashboard summary" className={`grid grid-cols-2 gap-3 sm:gap-4 ${cards.length === 5 ? 'xl:grid-cols-5' : 'lg:grid-cols-4'}`}>
    {cards.map(({ label, value, description, tone = 'neutral', to }) => <div key={label} className={`relative min-w-0 rounded-2xl border border-gray-100 bg-white p-4 sm:p-5 dark:border-gray-800 dark:bg-gray-900 ${to ? 'hover:shadow-md hover:border-green-300 dark:hover:border-green-700 hover:ring-2 hover:ring-green-200 dark:hover:ring-green-900 transition-all' : ''}`}>
      <dt className="mb-3 text-xs font-medium text-gray-500 dark:text-gray-400">{to ? <Link to={to} className="before:absolute before:inset-0 before:rounded-2xl focus-visible:outline-none focus-visible:before:ring-2 focus-visible:before:ring-green-600">{label}</Link> : label}</dt>
      <dd className={`mb-1 text-2xl font-bold tabular-nums ${tones[tone]}`}>{value ?? '—'}</dd>
      <dd className="text-xs leading-relaxed text-gray-500 dark:text-gray-400">{description}</dd>
    </div>)}
  </dl>
}
import { Link } from 'react-router-dom'

