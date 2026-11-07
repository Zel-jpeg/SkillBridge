import { useId, useRef, useState } from 'react'
import { useApi } from '../hooks/useApi'
import DataSection from './DataSection'
import Pagination from './Pagination'
import { SearchIcon } from './Icons'
import './programSelect.css'

export function ProgramIdentity({ program }) {
  return <span className="sb-program-identity">
    <span className="sb-program-meta"><span className="sb-program-code">{program.code}</span><span className="sb-program-institute">{program.institute_code}</span></span>
    <span className="sb-program-name">{program.name}</span>
    {!program.is_active && <span className="sb-program-archived">Archived program</span>}
  </span>
}

export default function ProgramSelect({ value, onChange, disabled = false, endpoint = '/api/management/programs/', selectedEndpoint = endpoint, instituteContext, status = 'active', hideLegend = false, onClear }) {
  const id = useId()
  const list = useRef(null)
  const searchInput = useRef(null)
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const url = `${endpoint}?status=${status}&page=${page}&page_size=8&search=${encodeURIComponent(search)}`
  const { data } = useApi(url)
  const { data: selected } = useApi(value ? `${selectedEndpoint}${value}/` : null)
  const pages = Math.max(1, Math.ceil((data?.count || 0) / 8))
  const visiblePage = data?.page || Math.min(page, pages)
  const rows = (data?.results || []).map(program => instituteContext ? {
    ...program, institute_code: instituteContext.code, institute_name: instituteContext.name,
  } : program)
  const selectedOnPage = rows.some(program => String(program.id) === String(value))
  const selectedProgram = selected && String(selected.id) === String(value) ? selected : null
  function resetScroll() { list.current?.scrollTo({ top: 0 }) }
  return <fieldset disabled={disabled} className="sb-program-select">
    <legend className={hideLegend ? 'sr-only' : 'sb-program-legend'}>Program</legend>
    <div className="sb-program-search">
      <SearchIcon size={16} />
      <input ref={searchInput} aria-label="Search assigned programs" type="search" value={search}
        onChange={event => { setSearch(event.target.value); setPage(1); resetScroll() }}
        onKeyDown={event => { if (event.key === 'Enter') event.preventDefault() }}
        placeholder={instituteContext ? 'Search programs in this institute' : 'Search program or institute'} />
    </div>
    {value && !selectedOnPage && selectedProgram && <div className="sb-program-selection" role="status">
      <p>Selected program</p><ProgramIdentity program={selectedProgram} />
    </div>}
    <DataSection url={url} layout="control" count={1} className="sb-program-results">
      <div className="sb-program-count" role="status">
        <span>{data?.count ?? 0} {data?.count === 1 ? 'program' : 'programs'}{search.trim() ? ' found' : ''}</span>
        <span className={value ? 'sb-program-count-selected' : ''}>{value ? '1 selected' : 'None selected'}</span>
      </div>
      {rows.length ? <div ref={list} role="radiogroup" aria-label="Program" className="sb-program-options">
        {rows.map(program => {
          const checked = String(value) === String(program.id)
          return <label key={program.id} className="sb-program-option" data-selected={checked}>
            <ProgramIdentity program={program} />
            <span className="sb-program-indicator">
              {checked && <span aria-hidden="true" className="sb-program-selected-label">Selected</span>}
              <input type="radio" name={`${id}-program`} value={program.id} checked={checked}
                aria-label={`${program.institute_code} · ${program.code} — ${program.name}${!program.is_active ? ' (archived)' : ''}`}
                onChange={() => onChange(String(program.id))} />
            </span>
          </label>
        })}
      </div> : <div className="sb-program-empty">
        <p>{search.trim() ? 'No programs match your search.' : 'No available programs.'}</p>
        <p>{search.trim() ? 'Try a different program name, code or institute.' : 'An active program must be available to make an assignment.'}</p>
        {search.trim() && <button type="button" onClick={() => { setSearch(''); setPage(1); resetScroll(); searchInput.current?.focus({ preventScroll: true }) }}>Clear search</button>}
      </div>}
      {data?.count > 8 && <Pagination compact page={visiblePage} total={data.count} pageSize={8}
        summary={`Showing ${(visiblePage - 1) * 8 + 1}–${Math.min(visiblePage * 8, data.count)} of ${data.count}`}
        onPage={next => { setPage(next); resetScroll() }} />}
    </DataSection>
    {value && onClear && <div className="sb-program-clear"><button type="button" onClick={() => { onClear(); searchInput.current?.focus({ preventScroll: true }) }}>Clear selection</button></div>}
  </fieldset>
}
