import { useState } from 'react'
import { BriefcaseIcon, ChevronRightIcon, CompanyIcon } from '../Icons'
import CompanyImage from '../CompanyImage'
import Pagination from '../Pagination'
import './placementInsights.css'

const PAGE_SIZE = 8
function usePage(total) {
  const [page, setPage] = useState(1)
  const current = Math.min(page, Math.max(1, Math.ceil(total / PAGE_SIZE)))
  if (page !== current) setPage(current)
  return [current, setPage]
}
function Pages({ total, page, onPage, label }) {
  return total > PAGE_SIZE ? <nav className="pi-pages" aria-label={label}><Pagination total={total} page={page} onPage={onPage} pageSize={PAGE_SIZE} /></nav> : total > 0 ? <p className="pi-helper">Showing 1–{total} of {total}</p> : null
}

export default function PlacementInsights({ data, selection, onSelect, onClearArea }) {
  const [byArea, setByArea] = useState(false)
  const comparison = byArea ? data.areas : data.companies
  const [comparisonPage, setComparisonPage] = usePage(comparison.length)
  const [capacityPage, setCapacityPage] = usePage(data.capacity.length)
  const s = data.summary
  const statuses = [
    { key: 'approved', label: 'Approved in selected batches', count: s.approved, tone: 'approved' },
    { key: 'approved_other_batch', label: 'Approved in another batch', count: s.approved_other_batch, tone: 'other' },
    { key: 'unplaced', label: 'Unplaced', count: s.unplaced, tone: 'unplaced' },
  ]
  const scope = data.scope.area ? `Company area: ${data.scope.area}` : 'All company areas'
  const total = data.capacity.reduce((sum, row) => sum + row.total, 0)
  const occupied = data.capacity.reduce((sum, row) => sum + row.occupied, 0)
  const remaining = data.capacity.reduce((sum, row) => sum + row.remaining, 0)
  return <div className="pi-insights">
    <div className="pi-overview">
      <section className="pi-panel" aria-label="Student placement progress">
        <header className="pi-header"><h3>Student placement progress</h3><span className="pi-badge">Selected students · {s.students}</span></header>
        <div className="pi-progress-summary"><div><strong>{s.approved} of {s.students}</strong><p>approved in selected batches</p></div><span className="pi-rate">{s.placement_rate == null ? '—' : `${s.placement_rate}%`}</span></div>
        <div className="pi-progress-track" role="img" aria-label={statuses.map(row => `${row.count} ${row.label.toLowerCase()}`).join(', ')}>{statuses.map(row => <span key={row.key} className={`pi-fill-${row.tone}`} style={{ width: `${s.students ? Math.max(0, Math.min(100, row.count / s.students * 100)) : 0}%` }} />)}</div>
        <p className="pi-helper">Select a status to filter student records. Company filters do not change these counts.</p>
        <div className="pi-status-list">{statuses.map(row => <button type="button" key={row.key} aria-label={`${row.label}: ${row.count}`} aria-pressed={selection === row.key} onClick={() => onSelect(row.key)}><span><i className={`pi-dot pi-fill-${row.tone}`} />{row.label}</span><strong>{row.count}</strong><ChevronRightIcon size={16} /></button>)}</div>
      </section>
      <section className="pi-panel" aria-label="Approved placement comparison">
        <header className="pi-header"><h3>{byArea ? 'Approved placements by company area' : 'Approved placements by company'}</h3><div className="pi-switch" role="group" aria-label="Compare approved placements">{[[false, 'Company'], [true, 'Company area']].map(([value, label]) => <button type="button" key={label} aria-pressed={byArea === value} onClick={() => { setByArea(value); setComparisonPage(1) }}>{label}</button>)}</div></header>
        <p className="pi-helper">{scope} · Uses company and position filters</p>
        {comparison.length ? <div className="pi-comparison">{comparison.slice((comparisonPage - 1) * PAGE_SIZE, comparisonPage * PAGE_SIZE).map(row => <button type="button" key={row.id ?? row.name} aria-label={`${row.name}: ${row.count} approved placements`} aria-pressed={selection === `${byArea ? 'area' : 'company'}:${byArea ? row.name : row.id}`} onClick={() => onSelect(`${byArea ? 'area' : 'company'}:${byArea ? row.name : row.id}`)}><span>{row.name}</span><strong>{row.count}</strong><ChevronRightIcon size={16} /></button>)}</div>
          : <div className="pi-empty"><CompanyIcon size={30} /><h4>No approved placements in this view</h4><p>Company comparisons will appear when placements are approved.</p></div>}
        <Pages total={comparison.length} page={comparisonPage} onPage={setComparisonPage} label="Company approval pages" />
        <p className="pi-helper pi-footer-note">Areas refer to company locations, not student residences.</p>
      </section>
    </div>
    <section className="pi-panel" aria-label="Shared position slots">
      <header className="pi-capacity-header"><div><h3>Shared position slots</h3><p className="pi-helper">Company slots are shared across all batches. These totals are not reserved for the selected students.</p><span className="pi-badge">All batches · {scope}</span></div><dl className="pi-totals">{[['Total slots', total], ['Occupied', occupied], ['Remaining', remaining]].map(([label, value]) => <div key={label}><BriefcaseIcon size={18} /><div><dt>{label}</dt><dd>{value}</dd></div></div>)}</dl></header>
      {data.scope.area && <button type="button" className="pi-area-chip" aria-label={`Clear company area filter: ${data.scope.area}`} onClick={onClearArea}>Company area: {data.scope.area}<span aria-hidden="true">×</span></button>}
      {data.capacity.length ? <table className="pi-capacity-table"><caption className="sr-only">Shared configured position slots and approved occupancy across all batches. {scope}. Counts are slots, not students in the selected batches.</caption><thead><tr><th scope="col">Company / position</th><th scope="col">Company area</th><th scope="col">Total slots</th><th scope="col">Occupied</th><th scope="col">Remaining</th></tr></thead><tbody>{data.capacity.slice((capacityPage - 1) * PAGE_SIZE, capacityPage * PAGE_SIZE).map(row => <tr key={row.id}><th scope="row"><div className="pi-company"><CompanyImage name={row.company} className="h-8 w-8 shrink-0 rounded-lg" /><div>{row.company}<p>{row.name}</p>{row.occupied > row.total && <span className="pi-over-capacity">Above configured slots</span>}</div></div></th><td data-label="Company area">{row.area || 'Unknown Area'}</td><td data-label="Total slots">{row.total}</td><td data-label="Occupied">{row.occupied}</td><td data-label="Remaining">{row.remaining}</td></tr>)}</tbody></table>
        : <div className="pi-empty"><BriefcaseIcon size={28} /><h4>No positions match these company filters</h4><p>Choose another company, position or area to review shared slots.</p></div>}
      <Pages total={data.capacity.length} page={capacityPage} onPage={setCapacityPage} label="Shared slots pages" />
      <footer className="pi-capacity-footer"><button type="button" className="pi-record-action" onClick={() => onSelect('capacity')}>View capacity records<ChevronRightIcon size={16} /></button><div><p>Occupied = approved placements across all batches.</p><p>Remaining slots may not match every student’s skills or location.</p></div></footer>
    </section>
  </div>
}
