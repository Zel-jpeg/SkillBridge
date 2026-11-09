import { useState } from 'react'
import Pagination from '../Pagination'
import './placementInsights.css'

const PAGE_SIZE = 8
export default function PlacementInsights({ data, selection, onSelect, onClearArea }) {
  const [byArea, setByArea] = useState(false)
  const [page, setPage] = useState(1)
  const comparison = byArea ? data.areas : data.companies
  const current = Math.min(page, Math.max(1, Math.ceil(comparison.length / PAGE_SIZE)))
  const s = data.summary
  const statuses = [
    { key: 'approved', label: 'Approved', count: s.approved, tone: 'approved' },
    { key: 'approved_other_batch', label: 'Another batch', count: s.approved_other_batch, tone: 'other' },
    { key: 'unplaced', label: 'Unplaced', count: s.unplaced, tone: 'unplaced' },
  ]
  const total = data.capacity.reduce((sum, row) => sum + row.total, 0)
  const occupied = data.capacity.reduce((sum, row) => sum + row.occupied, 0)
  const remaining = data.capacity.reduce((sum, row) => sum + row.remaining, 0)
  return <div className="pi-insights ar-placement-insights">
    <div className="ar-placement-overview">
      <section className="ar-panel"><h3>Placement states</h3><p>{s.students} selected students · independent of partner filters</p>
        <div className="pi-progress-track" role="img" aria-label={statuses.map(row => `${row.label}: ${row.count}`).join(', ')}>{statuses.map(row => <span key={row.key} className={`pi-fill-${row.tone}`} style={{ width: `${s.students ? Math.min(100, row.count / s.students * 100) : 0}%` }} />)}</div>
        <div className="ar-placement-states">{statuses.map(row => <button type="button" key={row.key} aria-pressed={selection === row.key} onClick={() => onSelect(row.key)}><span><i className={`pi-dot pi-fill-${row.tone}`} />{row.label}</span><strong>{row.count}</strong></button>)}</div>
      </section>
      <section className="ar-panel"><header className="ar-capacity-heading"><h3>Shared position capacity</h3><button type="button" onClick={() => onSelect('capacity')}>View capacity records →</button></header><p>Occupancy includes approvals across eligible batches.</p>
        <dl className="ar-capacity-numbers">{[['Total slots', total], ['Occupied', occupied], ['Remaining', remaining]].map(([label, count]) => <div key={label}><dt>{label}</dt><dd>{count}</dd></div>)}</dl>
        <div className="ar-capacity-track" role="img" aria-label={`${occupied} occupied of ${total} slots`}><span style={{ width: `${total ? Math.min(100, occupied / total * 100) : 0}%` }} /></div>
        {occupied > total && <p>Approved occupancy exceeds configured capacity.</p>}
        {data.scope.area && <button type="button" onClick={onClearArea}>Clear partner area: {data.scope.area} ×</button>}
      </section>
    </div>
    <section className="ar-panel" aria-label="Approved placement comparison"><header className="pi-header"><h3>Approved placements by {byArea ? 'partner area' : 'partner'}</h3><div className="pi-switch" role="group" aria-label="Compare approved placements">{[[false, 'Partner'], [true, 'Partner area']].map(([value, label]) => <button type="button" key={label} aria-pressed={byArea === value} onClick={() => { setByArea(value); setPage(1) }}>{label}</button>)}</div></header>
      {comparison.length ? <div className="pi-comparison">{comparison.slice((current - 1) * PAGE_SIZE, current * PAGE_SIZE).map(row => <button type="button" key={row.id ?? row.name} aria-label={`${row.name}: ${row.count} approved placements`} aria-pressed={selection === `${byArea ? 'area' : 'company'}:${byArea ? row.name : row.id}`} onClick={() => onSelect(`${byArea ? 'area' : 'company'}:${byArea ? row.name : row.id}`)}><span>{row.name}</span><strong>{row.count}</strong><span className="ar-approval-bar" style={{ width: `${s.approved ? Math.min(100, row.count / s.approved * 100) : 0}%` }} /></button>)}</div> : <p>No approved placements match the partner filters.</p>}
      {comparison.length > PAGE_SIZE && <Pagination total={comparison.length} page={current} onPage={setPage} pageSize={PAGE_SIZE} />}
    </section>
  </div>
}
