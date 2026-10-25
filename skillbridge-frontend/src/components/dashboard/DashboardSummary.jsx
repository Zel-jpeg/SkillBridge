import { Link } from 'react-router-dom'
import { BriefcaseIcon, CheckCircleIcon, ChevronRightIcon, UserIcon, WarnIcon } from '../Icons'
import './dashboardSummary.css'

const tones = {
  neutral: 'text-gray-900 dark:text-white',
  success: 'text-green-600 dark:text-green-400',
  warning: 'text-amber-600 dark:text-amber-400',
  attention: 'text-rose-600 dark:text-rose-400',
}

const summaryIcons = { enrolled: UserIcon, complete: CheckCircleIcon, followup: WarnIcon, placement: BriefcaseIcon }

function InstructorSummary({ cards }) {
  return <dl aria-label="Dashboard summary" className="instructor-summary">
    {cards.map(({ label, value, description, tone = 'neutral', to, kind, supportingValue, progress }) => {
      const Icon = summaryIcons[kind]
      const percentage = Number.isFinite(progress) ? Math.max(0, Math.min(100, progress)) : null
      return <div key={kind} className={`instructor-summary-card instructor-summary-card--${kind}`}>
        <dt><Link to={to}>{label}</Link></dt>
        <dd className="instructor-summary-metric"><strong className={`dashboard-summary-value ${tones[tone]}`}>{value ?? '—'}</strong>{supportingValue && <span>{supportingValue}</span>}</dd>
        <dd className="instructor-summary-description">{description}</dd>
        {percentage != null && <dd className="instructor-summary-progress"><div role="progressbar" aria-label={`${label} percentage`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={percentage}><span style={{ width: `${percentage}%` }} /></div></dd>}
        <dd className="instructor-summary-icon" aria-hidden="true"><Icon size={21} /></dd>
        <dd className="instructor-summary-arrow" aria-hidden="true"><ChevronRightIcon size={15} /></dd>
      </div>
    })}
  </dl>
}

export default function DashboardSummary({ cards, variant }) {
  if (variant === 'instructor') return <InstructorSummary cards={cards} />
  return <dl aria-label="Dashboard summary" className={`grid grid-cols-2 gap-3 sm:gap-4 ${cards.length === 5 ? 'xl:grid-cols-5' : 'lg:grid-cols-4'}`}>
    {cards.map(({ label, value, description, tone = 'neutral', to }) => <div key={label} className={`relative min-w-0 rounded-2xl border border-gray-100 bg-white p-4 sm:p-5 dark:border-gray-800 dark:bg-gray-900 ${to ? 'hover:shadow-md hover:border-green-300 dark:hover:border-green-700 hover:ring-2 hover:ring-green-200 dark:hover:ring-green-900 transition-all' : ''}`}>
      <dt className="mb-3 text-xs font-medium text-gray-500 dark:text-gray-400">{to ? <Link to={to} className="before:absolute before:inset-0 before:rounded-2xl focus-visible:outline-none focus-visible:before:ring-2 focus-visible:before:ring-green-600">{label}</Link> : label}</dt>
      <dd className={`mb-1 text-2xl font-bold tabular-nums ${tones[tone]}`}>{value ?? '—'}</dd>
      <dd className="text-xs leading-relaxed text-gray-500 dark:text-gray-400">{description}</dd>
    </div>)}
  </dl>
}

