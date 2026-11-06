import PlacementsPage from '../placements/PlacementsPage'
import AdminScopeNavigator from '../../components/admin/AdminScopeNavigator'

export default function AdminPlacements() {
  return <AdminScopeNavigator title="OJT Placement Management">{scope => <PlacementsPage role="admin" organizationScope={scope} />}</AdminScopeNavigator>
}
