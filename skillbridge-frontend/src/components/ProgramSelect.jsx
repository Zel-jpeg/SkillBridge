import { useState } from 'react'
import { useApi } from '../hooks/useApi'
import DataSection from './DataSection'
import Pagination from './Pagination'

export default function ProgramSelect({ value, onChange, disabled = false }) {
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const url = `/api/management/programs/?status=active&page=${page}&page_size=8&search=${encodeURIComponent(search)}`
  const { data } = useApi(url)
  const { data: selected } = useApi(value ? `/api/management/programs/${value}/` : null)
  const pages = Math.max(1, Math.ceil((data?.count || 0) / 8))
  const visiblePage = data?.page || Math.min(page, pages)
  const rows = data?.results || []
  return <fieldset disabled={disabled} className="min-w-0 space-y-2 text-xs">
    <legend className="mb-2 font-semibold">Program</legend>
    <input aria-label="Search assigned programs" type="search" value={search} onChange={event => { setSearch(event.target.value); setPage(1) }} placeholder="Search program or institute" className="min-h-11 w-full rounded-xl border border-gray-200 bg-transparent px-3 dark:border-gray-700" />
    {value && selected && <p className="break-words text-green-800 dark:text-green-300">Selected: {selected.institute_code} · {selected.code} — {selected.name}</p>}
    <DataSection url={url} layout="control" count={1}>
      <div role="radiogroup" aria-label="Batch program" className="max-h-44 space-y-1 overflow-y-auto">
        {rows.map(program => <label key={program.id} className="flex min-h-11 cursor-pointer items-center gap-3 rounded-lg border border-gray-200 px-3 py-2 focus-within:ring-2 focus-within:ring-green-600 dark:border-gray-700">
          <input type="radio" name="batch-program" value={program.id} checked={String(value) === String(program.id)} onChange={() => onChange(String(program.id))} />
          <span className="min-w-0 break-words">{program.institute_code} · {program.code} — {program.name}</span>
        </label>)}
      </div>
      {!rows.length && <p>No available programs. An administrator can assign an instructor to an active program.</p>}
      {data?.count > 8 && <Pagination page={visiblePage} total={data.count} pageSize={8} onPage={setPage} />}
    </DataSection>
  </fieldset>
}
