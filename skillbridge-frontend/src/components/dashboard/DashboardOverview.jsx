import { Link } from 'react-router-dom'
import { useApi } from '../../hooks/useApi'
import DataSection from '../DataSection'
import DashboardSummary from './DashboardSummary'
import { ANALYTICS_URL, analyticsCards } from '../../utils/analytics'

export default function DashboardOverview({ role }) {
  const { data } = useApi(ANALYTICS_URL)
  const reasons = new Map()
  for (const row of data?.students ?? []) for (const reason of row.reasons) reasons.set(reason, (reasons.get(reason) ?? 0) + 1)
  return <DataSection url={ANALYTICS_URL} layout="stats" count={role === 'admin' ? 5 : 4} label="Loading dashboard overview">
    {data && <div className="space-y-4"><DashboardSummary cards={analyticsCards(data, role)} />
      {(reasons.size > 0 || data.summary.pending_instructors > 0) && <section aria-label="Needs attention" className="rounded-2xl border border-amber-200 bg-white p-4 dark:border-amber-900 dark:bg-gray-900">
        <h2 className="text-sm font-semibold text-gray-900 dark:text-white">Needs attention</h2>
        <div className="mt-3 flex flex-wrap gap-2">
          {[...reasons].map(([reason, count]) => <Link key={reason} to={`/${role}/reports?${new URLSearchParams({ tab: 'assessments', group: `reason:${reason}` })}`} className="rounded-lg bg-amber-50 px-3 py-2 text-xs font-medium text-amber-900 hover:bg-amber-100 focus-visible:outline-2 focus-visible:outline-green-600 dark:bg-amber-950 dark:text-amber-200">{reason} <strong>{count}</strong></Link>)}
          {role === 'admin' && data.summary.pending_instructors > 0 && <Link to="/admin/users?tab=pending" className="rounded-lg bg-amber-50 px-3 py-2 text-xs font-medium text-amber-900 focus-visible:outline-2 focus-visible:outline-green-600 dark:bg-amber-950 dark:text-amber-200">Instructor approvals <strong>{data.summary.pending_instructors}</strong></Link>}
        </div><p className="mt-2 text-xs text-gray-500 dark:text-gray-400">Student counts can overlap between reasons. Open a reason to see who needs follow-up.</p>
      </section>}
    </div>}
  </DataSection>
}
