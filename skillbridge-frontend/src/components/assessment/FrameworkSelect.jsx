import { useState } from 'react'
import { useApi } from '../../hooks/useApi'
import DataSection from '../DataSection'
import Pagination from '../Pagination'
import { organizationField as field } from '../admin/organizationUi'

export default function FrameworkSelect({ programId, value, onChange, disabled = false,
  help = 'Saving binds this version to the assessment and, when assigned, its batch. Later definition revisions require a new version and batch.' }) {
  const [page, setPage] = useState(1)
  const url = programId ? `/api/management/programs/${programId}/frameworks/?status=active&page=${page}&page_size=8` : null
  const { data } = useApi(url)
  if (!programId) return null
  return <DataSection url={url} layout="control"><div className="space-y-3 text-xs">
    <label className="block space-y-2 font-semibold">Competency framework<select aria-label="Competency framework" className={field} value={value || ''} disabled={disabled} onChange={event => onChange(event.target.value ? Number(event.target.value) : null)}>
      <option value="">Choose a reviewed version</option>
      {data?.results.map(row => <option key={row.id} value={row.id} disabled={row.category_count === 0}>{row.name} · v{row.version} · {row.category_count} categories</option>)}
      {value && !data?.results.some(row => row.id === value) && <option value={value}>Selected framework #{value}</option>}
    </select></label>
    {data && <Pagination total={data.count} page={data.page} pageSize={data.page_size} onPage={setPage} />}
    {data?.count === 0 && <p>Add and review skills for this program in Skill taxonomy first.</p>}
    {help && <p className="text-gray-500">{help}</p>}
  </div></DataSection>
}
