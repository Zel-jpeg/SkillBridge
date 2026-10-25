import { useApi } from '../../hooks/useApi'
import DataSection from '../DataSection'
import DashboardSummary from './DashboardSummary'
import { ANALYTICS_URL, analyticsCards } from '../../utils/analytics'

export default function DashboardOverview({ role }) {
  const { data } = useApi(ANALYTICS_URL)
  return <DataSection url={ANALYTICS_URL} layout="stats" count={role === 'admin' ? 5 : 4} label="Loading dashboard overview">
    {data && <DashboardSummary cards={analyticsCards(data, role)} variant={role === 'instructor' ? 'instructor' : undefined} />}
  </DataSection>
}
