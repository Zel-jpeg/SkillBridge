import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import PlacementsPage from '../placements/PlacementsPage'
import AdminScopeNavigator from '../../components/admin/AdminScopeNavigator'
import RecommendationMaintenanceDialog from '../../components/admin/RecommendationMaintenanceDialog'
import { organizationButton } from '../../components/admin/organizationUi'
import { RefreshIcon } from '../../components/Icons'

export default function AdminPlacements() {
  const [params, setParams] = useSearchParams()
  const [maintenance, setMaintenance] = useState(null)
  const [result, setResult] = useState(null)
  const linkedRefresh = params.get('refresh') === 'recommendations'
  const isOpen = maintenance !== null || linkedRefresh
  function closeMaintenance() {
    setMaintenance(null)
    if (linkedRefresh) setParams(previous => { const next = new URLSearchParams(previous); next.delete('refresh'); return next }, { replace: true })
  }
  const action = <div className="space-y-2">
    <button type="button" className={organizationButton} onClick={() => setMaintenance(params.get('institute') || '')}>
      <RefreshIcon size={16} />Refresh saved recommendations
    </button>
    {result && <p role="status" className="max-w-sm text-xs leading-5 text-gray-600 dark:text-gray-300">
      <strong className="block">{result.name}</strong>{result.message}
    </p>}
  </div>
  return <>
    <AdminScopeNavigator title="OJT Placement Management" action={action}>
      {scope => <PlacementsPage role="admin" organizationScope={scope} />}
    </AdminScopeNavigator>
    {isOpen && <RecommendationMaintenanceDialog initialInstitute={maintenance ?? params.get('institute') ?? ''}
      onClose={closeMaintenance} onFinished={outcome => { setResult(outcome); closeMaintenance() }} />}
  </>
}
