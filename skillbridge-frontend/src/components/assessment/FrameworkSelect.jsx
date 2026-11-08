import { useEffect, useState } from 'react'
import { useApi } from '../../hooks/useApi'
import DataSection from '../DataSection'
import Pagination from '../Pagination'
import { organizationField as field } from '../admin/organizationUi'

export default function FrameworkSelect({ programId, value, onChange, onAutoSelect = onChange, disabled = false,
  help = disabled ? 'This batch keeps the skills already used for its assessments and results.'
    : 'Use current program skills for new work. Changing the selection clears draft category assignments.',
  earlierHelp }) {
  const [page, setPage] = useState(1)
  const base = programId ? `/api/management/programs/${programId}/frameworks/` : null
  const url = base ? `${base}?status=active&page=${page}&page_size=8` : null
  const { data } = useApi(url)
  const { data: firstPage } = useApi(base && page > 1 ? `${base}?status=active&page=1&page_size=8` : null)
  const currentId = (page === 1 ? data : firstPage)?.results[0]?.id
  const listed = data?.results.some(row => row.id === value)
  const { data: saved } = useApi(base && value && data && !listed ? `${base}${value}/` : null)
  const { data: versions } = useApi(base && !value && !disabled ? `${base}?status=all&page_size=1` : null)
  const candidate = versions?.count === 1 ? versions.results[0] : null
  const automaticId = !value && !disabled && candidate?.is_active && candidate.category_count > 0 ? candidate.id : null
  useEffect(() => {
    if (automaticId) onAutoSelect(automaticId)
  }, [automaticId, onAutoSelect])
  if (!programId) return null
  return <DataSection url={url} layout="control"><div className="space-y-3 text-xs">
    <label className="block space-y-2 font-semibold">Program skill set<select aria-label="Program skill set" className={field} value={value || ''} disabled={disabled} onChange={event => onChange(event.target.value ? Number(event.target.value) : null)}>
      <option value="">Choose a skill set</option>
      {data?.results.map(row => <option key={row.id} value={row.id} disabled={row.category_count === 0}>
        {row.id === currentId ? 'Current program skills' : 'Earlier program skills'} · {row.name} · v{row.version}
      </option>)}
      {value && !listed && <option value={value}>{saved?.id === value
        ? `${value === currentId ? 'Current' : 'Saved'} program skills · ${saved.name} · v${saved.version}`
        : `Saved program skills #${value}`}</option>}
    </select></label>
    {data && <Pagination total={data.count} page={data.page} pageSize={data.page_size} onPage={setPage} />}
    {data?.count === 0 && !value && <p>Add and review skills for this program in Skill taxonomy first.</p>}
    {help && <p className="text-gray-500">{help}</p>}
    {earlierHelp && value && currentId && value !== currentId && <p className="text-amber-800 dark:text-amber-300">{earlierHelp}</p>}
  </div></DataSection>
}
