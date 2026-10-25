import { useState } from 'react'
import { ChevronRightIcon, CompanyIcon, LockIcon, ReportIcon, SkillIcon } from '../Icons'
import Pagination from '../Pagination'
import './skillsInsights.css'

const PAGE_SIZE = 8
const scoreBands = [
  { key: 'strong', label: 'Strong', guide: '80% and above' },
  { key: 'fair', label: 'Fair', guide: '60% to below 80%' },
  { key: 'needs_work', label: 'Needs work', guide: 'Below 60%' },
]
const matchBands = [
  { key: 'Strong', label: 'Strong fit', guide: '80% and above', tone: 'strong' },
  { key: 'Fair', label: 'Fair fit', guide: '60% to below 80%', tone: 'fair' },
  { key: 'Low', label: 'Low fit', guide: 'Below 60%', tone: 'needs_work' },
]
const unavailableBands = [
  { key: 'No current match', label: 'No current recommendation', icon: <ReportIcon size={17} /> },
  { key: 'Locked', label: 'Final results locked', icon: <LockIcon size={17} /> },
]

function MatchRow({ band, count, selection, onSelect }) {
  const selected = selection === `band:${band.key}`
  return <button type="button" className={`si-match-row ${count && band.tone ? `si-tone-${band.tone}` : ''}`} aria-label={`${band.label}: ${count} ${count === 1 ? 'student' : 'students'}`} aria-pressed={selected} onClick={() => onSelect(`band:${band.key}`)}>
    <span className="si-match-label"><span aria-hidden="true">{band.icon || <i className={`si-dot si-dot-${band.tone}`} />}</span><span><strong>{band.label}</strong>{band.guide && <small>{band.guide}</small>}</span></span>
    <span className="si-match-count">{count}<ChevronRightIcon size={16} /></span>
  </button>
}

export default function SkillsInsights({ data, selection, onSelect }) {
  const [page, setPage] = useState(1)
  const current = Math.min(page, Math.max(1, Math.ceil(data.skills.length / PAGE_SIZE)))
  if (page !== current) setPage(current)
  const rows = data.skills.slice((current - 1) * PAGE_SIZE, current * PAGE_SIZE)
  const counts = new Map(data.match_bands.map(row => [row.name, row.count]))
  const withMatch = matchBands.reduce((sum, row) => sum + (counts.get(row.key) ?? 0), 0)
  const withoutMatch = unavailableBands.reduce((sum, row) => sum + (counts.get(row.key) ?? 0), 0)
  return <div className="si-panels">
    <section className="si-panel" aria-label="Skill results by category">
      <header className="si-header"><span className="si-icon" aria-hidden="true"><SkillIcon size={23} /></span><div><h3>Skill results by category</h3><p>Final skill scores. Numbers below count students, not average scores.</p></div><span className="si-badge">{data.skills.length} {data.skills.length === 1 ? 'category' : 'categories'}</span></header>
      {rows.length ? <table className="si-matrix">
        <caption className="sr-only">Students in each final category score band. Unavailable means missing or locked evidence, not a zero score. Select a score-band count to filter student records.</caption>
        <thead><tr><th scope="col">Skill category</th>{scoreBands.map(band => <th scope="col" key={band.key}><span><i className={`si-dot si-dot-${band.key}`} />{band.label}</span><small>{band.guide}</small></th>)}<th scope="col" className="si-unavailable"><span><i className="si-dot si-dot-missing" />Unavailable</span><small>Missing or locked</small></th></tr></thead>
        <tbody>{rows.map(row => <tr key={row.id}><th scope="row">{row.name}</th>{scoreBands.map(band => <td key={band.key} data-label={`${band.label} · ${band.guide}`}><button type="button" className={`si-count ${row[band.key] ? `si-tone-${band.key}` : ''}`} aria-label={`${row.name} · ${band.label}: ${row[band.key]}`} aria-pressed={selection === `skill:${row.id}:${band.key}`} onClick={() => onSelect(`skill:${row.id}:${band.key}`)}><span>{row[band.key]}</span><ChevronRightIcon size={14} /></button></td>)}<td className="si-unavailable" data-label="Unavailable · Missing or locked"><span className="si-missing" aria-label={`${row.name}: ${row.missing} students with missing or locked results`}>{row.missing}</span></td></tr>)}</tbody>
      </table> : <p className="si-empty">{data.summary.students ? 'No final category results in this scope. Missing or locked evidence stays unavailable.' : 'No students in this scope. Adjust the report scope to review skills.'}</p>}
      {data.skills.length > PAGE_SIZE && <nav className="si-pagination" aria-label="Skill category pages"><Pagination total={data.skills.length} page={current} onPage={setPage} pageSize={PAGE_SIZE} /></nav>}
      {rows.length > 0 && <p className="si-helper">Each row totals {data.summary.students} {data.summary.students === 1 ? 'student' : 'students'}. A student may appear in several skill categories.</p>}
      <footer className="si-footer"><button type="button" className="si-table-action" onClick={() => onSelect('skills')}><ReportIcon size={16} />View category table</button><div><p>Select a score-band count to view its students.</p><p>Unavailable is not a zero score.</p></div></footer>
    </section>
    <section className="si-panel" aria-label="Current company matches">
      <header className="si-header"><span className="si-icon" aria-hidden="true"><CompanyIcon size={23} /></span><div><h3>Current company matches</h3><p>Each student counts once, using their highest current recommendation match.</p></div></header>
      <div className="si-match-group"><div className="si-match-heading"><h4>With a current match</h4><span className="si-badge">{withMatch} {withMatch === 1 ? 'student' : 'students'}</span></div>{matchBands.map(band => <MatchRow key={band.key} band={band} count={counts.get(band.key) ?? 0} selection={selection} onSelect={onSelect} />)}</div>
      <div className="si-match-group si-match-group-neutral"><div className="si-match-heading"><h4>Without a current match</h4><span className="si-badge">{withoutMatch} {withoutMatch === 1 ? 'student' : 'students'}</span></div>{unavailableBands.map(band => <MatchRow key={band.key} band={band} count={counts.get(band.key) ?? 0} selection={selection} onSelect={onSelect} />)}</div>
      <p className="si-helper si-approval-note">A company match supports review. Placement still needs approval.</p>
    </section>
  </div>
}
