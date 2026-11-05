import { useState } from 'react'
import { useApi } from '../../hooks/useApi'
import DataSection from '../DataSection'
import Pagination from '../Pagination'

export default function PositionPrograms({ programs, onToggle }) {
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const url = `/api/management/programs/?status=active&page=${page}&page_size=8&search=${encodeURIComponent(search)}`
  const { data } = useApi(url)
  return <div className="space-y-2">
    <label className="block position-editor-label">Find an eligible program
      <input className="position-editor-input" type="search" value={search} onChange={event => { setSearch(event.target.value); setPage(1) }} />
    </label>
    <DataSection url={url} layout="control" count={1}>
      <ul className="space-y-1" aria-label="Available programs">
        {data?.results.map(program => <li key={program.id}>
          <label className="flex min-h-11 items-center gap-2 rounded-lg border border-gray-200 px-3 dark:border-gray-700">
            <input type="checkbox" checked={programs.some(item => item.id === program.id)} onChange={() => onToggle(program)} />
            <span className="break-words">{program.institute_code} · {program.name}</span>
          </label>
        </li>)}
      </ul>
      {data?.count === 0 && <p>No active programs match this search.</p>}
      {data && <Pagination page={data.page} total={data.count} pageSize={8} onPage={setPage} />}
    </DataSection>
    <p role="status" className="position-editor-help">{programs.length} selected. An empty selection closes the opening to new placements.</p>
    <ul className="flex flex-wrap gap-2" aria-label="Selected programs">
      {programs.map(program => <li key={program.id}>
        <button className="position-editor-cancel" type="button" onClick={() => onToggle(program)} aria-label={`Remove ${program.institute_code} ${program.name}`}>
          {program.institute_code} · {program.name} ×
        </button>
      </li>)}
    </ul>
  </div>
}
