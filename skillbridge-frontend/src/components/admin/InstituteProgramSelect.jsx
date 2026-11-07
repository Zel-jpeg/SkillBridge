import { useRef, useState } from 'react'
import { useApi } from '../../hooks/useApi'
import DataSection from '../DataSection'
import Pagination from '../Pagination'
import ProgramSelect, { ProgramIdentity } from '../ProgramSelect'
import { ChevronRightIcon, SearchIcon } from '../Icons'

/** Admin account creation browses existing institutes before their programs. */
export default function InstituteProgramSelect({ value, onChange, disabled = false }) {
  const [institute, setInstitute] = useState(null)
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const picker = useRef(null)
  const list = useRef(null)
  const instituteSearch = useRef(null)
  const back = useRef(null)
  const url = `/api/admin/institutes/?status=active&page=${page}&page_size=8&search=${encodeURIComponent(search)}`
  const { data } = useApi(url, { skip: Boolean(institute) })
  const { data: selected } = useApi(value ? `/api/management/programs/${value}/` : null)
  const rows = data?.results || []
  const currentPage = data?.page || 1
  const selectedProgram = selected && String(selected.id) === String(value) ? selected : null

  function resetScroll() { list.current?.scrollTo({ top: 0 }) }
  function chooseInstitute(row) {
    setInstitute(row)
    requestAnimationFrame(() => back.current?.focus({ preventScroll: true }))
  }
  function showInstitutes() {
    setInstitute(null)
    requestAnimationFrame(() => instituteSearch.current?.focus({ preventScroll: true }))
  }

  return <fieldset ref={picker} disabled={disabled} className="sb-program-select sb-institute-picker">
    <legend className="sr-only">Program assignment</legend>
    {institute ? <>
      <button ref={back} type="button" className="sb-institute-back" onClick={showInstitutes}>← All institutes</button>
      <div className="sb-institute-current">
        <span className="sb-program-code">{institute.code}</span><strong>{institute.name}</strong>
      </div>
      <ProgramSelect key={institute.id} value={value} onChange={onChange} disabled={disabled} hideLegend
        instituteContext={institute} endpoint={`/api/admin/institutes/${institute.id}/programs/`}
        selectedEndpoint="/api/management/programs/" />
    </> : <>
      <div className="sb-program-search">
        <SearchIcon size={16} />
        <input ref={instituteSearch} type="search" aria-label="Search institutes" placeholder="Search institutes" value={search}
          onKeyDown={event => { if (event.key === 'Enter') event.preventDefault() }}
          onChange={event => { setSearch(event.target.value); setPage(1); resetScroll() }} />
      </div>
      {value && selectedProgram && <div className="sb-program-selection" role="status">
        <p>Selected program</p><ProgramIdentity program={selectedProgram} />
      </div>}
      <DataSection url={url} layout="control" count={1} className="sb-program-results" label="Loading institutes">
        <div className="sb-program-count" role="status">
          <span>{data?.count ?? 0} {data?.count === 1 ? 'institute' : 'institutes'}{search.trim() ? ' found' : ''}</span>
          <span className={value ? 'sb-program-count-selected' : ''}>{value ? '1 program selected' : 'Choose an institute'}</span>
        </div>
        {rows.length ? <div ref={list} className="sb-program-options" role="group" aria-label="Institutes">
          {rows.map(row => <button key={row.id} type="button" className="sb-program-option sb-institute-option"
            aria-label={`View programs in ${row.code} — ${row.name}`} onClick={() => chooseInstitute(row)}>
            <span className="sb-program-identity"><span className="sb-program-meta"><span className="sb-program-code">{row.code}</span></span><span className="sb-program-name">{row.name}</span></span>
            <ChevronRightIcon size={18} />
          </button>)}
        </div> : <div className="sb-program-empty">
          <p>{search.trim() ? 'No institutes match your search.' : 'No active institutes available.'}</p>
          {search.trim() && <button type="button" onClick={() => { setSearch(''); setPage(1); instituteSearch.current?.focus() }}>Clear search</button>}
        </div>}
        {data?.count > 8 && <Pagination compact page={currentPage} total={data.count} pageSize={8}
          summary={`Showing ${(currentPage - 1) * 8 + 1}–${Math.min(currentPage * 8, data.count)} of ${data.count}`}
          onPage={next => { setPage(next); resetScroll() }} />}
      </DataSection>
    </>}
    {value && <div className="sb-program-clear"><button type="button" onClick={() => {
      onChange('')
      picker.current?.querySelector('input[type="search"]')?.focus({ preventScroll: true })
    }}>Clear selection</button></div>}
  </fieldset>
}
