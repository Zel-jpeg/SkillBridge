import CompanyImage from './CompanyImage'
import DataSection from './DataSection'
import DialogShell from './DialogShell'
import PlacementGuidance from './placements/PlacementGuidance'
import { useApi } from '../hooks/useApi'
import { matchColor } from '../hooks/student/useStudentResults'
import { sortCompanyPositions } from '../utils/recommendationResults'
import './studentCompanyDetails.css'

const COMPANIES_URL = '/api/student/companies/'

// Resolve IDs against the live student catalog, including while this dialog is open.
// This endpoint exposes only student-visible company and position information.
export default function StudentCompanyDetails({ companyId, positionId, onClose }) {
  const { data } = useApi(COMPANIES_URL)
  const company = data?.find(item => companyId != null
    ? item.id === companyId
    : item.positions.some(position => position.id === positionId))
  const positions = sortCompanyPositions(company?.positions || [])
  const topPositionId = Number.isFinite(positions[0]?.match_score) ? positions[0].id : null

  return <DialogShell title={company?.name || 'Partner details'}
    description="Partner location, listed OJT positions, skill requirements and your available match scores."
    size="company" onClose={onClose} closeLabel="Close partner details"
    avatar={company && <CompanyImage name={company.name} imageUrl={company.image_url} className="h-12 w-12 rounded-xl" />}
    headerDetails={company && <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">Partner organization · {positions.length} listed position{positions.length !== 1 ? 's' : ''}</p>}
    footer={<PlacementGuidance compact />}>
    <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-6">
      <DataSection url={COMPANIES_URL} layout="company-detail" count={1} label="Loading partner details">
        {!company ? <p className="py-8 text-center text-sm text-gray-500 dark:text-gray-400">This partner or position is no longer listed. Close this view to see the latest recommendations.</p> : <>
          <section aria-label="Partner location" className="mb-6 rounded-xl bg-gray-50 p-4 dark:bg-gray-800/60">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Location</h3>
            <p className="mt-2 text-sm leading-relaxed wrap-anywhere text-gray-800 dark:text-gray-200">{company.address || 'Address not provided.'}</p>
          </section>
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white">OJT positions</h3>
          <p className="mt-1 mb-4 text-xs leading-relaxed text-gray-500 dark:text-gray-400">Ranked within this partner by hybrid match, highest first. Positions without a current match score appear last.</p>
          {positions.length === 0 && <p className="text-sm text-gray-500 dark:text-gray-400">No positions are currently listed.</p>}
          <div className="space-y-4">
            {positions.map((position, index) => {
              const tags = [...new Set(position.tags || [])]
              return <section key={position.id} aria-label={position.title} className={`rounded-xl border p-4 ${position.id === topPositionId ? 'border-green-200 bg-green-50/40 dark:border-green-800 dark:bg-green-950/20' : 'border-gray-200 dark:border-gray-700'}`}>
                {Number.isFinite(position.match_score) && <p className={`mb-2 text-xs font-semibold ${position.id === topPositionId ? 'text-green-700 dark:text-green-400' : 'text-gray-500 dark:text-gray-400'}`}>
                  #{index + 1} in this partner{position.id === topPositionId ? ' · Top suggested position' : ''}
                </p>}
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <h4 className="text-sm font-semibold wrap-anywhere text-gray-900 dark:text-white">{position.title}</h4>
                    <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">{position.slots} listed slot{position.slots !== 1 ? 's' : ''}</p>
                  </div>
                  {position.match_score != null ? <div className="shrink-0 text-right">
                    <p className={`text-lg font-bold tabular-nums ${matchColor(position.match_score)}`}>{position.match_score}%</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">Hybrid match</p>
                  </div> : <span className="text-xs text-gray-500 dark:text-gray-400">No current match score</span>}
                </div>
                <p className="mt-4 mb-2 text-xs font-medium text-gray-600 dark:text-gray-300">Skills & requirements</p>
                {tags.length ? <ul className="flex flex-wrap gap-1.5">
                  {tags.map(tag => <li key={tag} className="max-w-full rounded-lg bg-gray-100 px-2.5 py-1 text-xs leading-relaxed wrap-anywhere text-gray-600 dark:bg-gray-800 dark:text-gray-300">{tag}</li>)}
                </ul> : <p className="text-xs text-gray-500 dark:text-gray-400">No skill requirements listed.</p>}
              </section>
            })}
          </div>
        </>}
      </DataSection>
    </div>
  </DialogShell>
}
