import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import PlacementsPage from '../placements/PlacementsPage'
import AdminScopeNavigator from '../../components/admin/AdminScopeNavigator'
import RecommendationMaintenanceDialog from '../../components/admin/RecommendationMaintenanceDialog'
import { organizationButton } from '../../components/admin/organizationUi'
import { RefreshIcon } from '../../components/Icons'

export default function AdminPlacements() {
  const [params] = useSearchParams()
  const [maintenance, setMaintenance] = useState(null)
  const [result, setResult] = useState(null)
  const action = <div className="space-y-2">
    <button type="button" className={organizationButton} onClick={() => setMaintenance(params.get('institute') || '')}>
      <RefreshIcon size={16} />Recommendation maintenance
    </button>
    {result && <p role="status" className="max-w-sm text-xs leading-5 text-gray-600 dark:text-gray-300">
      <strong className="block">{result.name}</strong>{result.message}
    </p>}
  </div>
  return <>
    <AdminScopeNavigator title="OJT Placement Management" action={action}>
      {scope => <PlacementsPage role="admin" organizationScope={scope} />}
    </AdminScopeNavigator>
    {maintenance !== null && <RecommendationMaintenanceDialog initialInstitute={maintenance}
      onClose={() => setMaintenance(null)} onFinished={outcome => { setResult(outcome); setMaintenance(null) }} />}
  </>
}
