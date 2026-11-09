import { useState } from 'react'
import { ChevronRightIcon, CompanyIcon, LockIcon, ReportIcon, SkillIcon } from '../Icons'
import Pagination from '../Pagination'
import { analyticsSkillName } from '../../utils/analytics'
import './skillsInsights.css'

const PAGE_SIZE = 8
const scoreBands = [
  { key: 'strong', label: 'Strong', guide: '80% and above' },
  { key: 'fair', label: 'Fair', guide: '60% to below 80%' },
  { key: 'needs_work', label: 'Needs work', guide: 'Below 60%' },
]
const matchBands = [
  { key: 'Minimums met', label: 'Minimums met', guide: 'All listed numerical targets met; not approval', tone: 'strong' },
  { key: 'Below minimums', label: 'Below minimums', guide: 'At least one assessed requirement below target', tone: 'fair' },
  { key: 'Unassessed requirements', label: 'Unassessed requirements', guide: 'Required category evidence is unavailable', tone: 'needs_work' },
  { key: 'Strong', label: 'Legacy strong fit', guide: '80% and above', tone: 'strong' },
  { key: 'Fair', label: 'Legacy fair fit', guide: '60% to below 80%', tone: 'fair' },
  { key: 'Low', label: 'Legacy low fit', guide: 'Below 60%', tone: 'needs_work' },
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
  const currentBands = new Set(['Minimums met', 'Below minimums', 'Unassessed requirements'])
  const hasAssessmentLed = data.match_bands.some(row => currentBands.has(row.name))
  const withMatch = matchBands.reduce((sum, row) => sum + (counts.get(row.key) ?? 0), 0)
  const withoutMatch = unavailableBands.reduce((sum, row) => sum + (counts.get(row.key) ?? 0), 0)
  return <div className="si-panels">
    <section className="si-panel" aria-label="Skill results by category">
      <header className="si-header"><span className="si-icon" aria-hidden="true"><SkillIcon size={23} /></span><div><h3>Skill results by category</h3><p>Final skill scores. Numbers below count students, not average scores.</p></div><span className="si-badge">{data.skills.length} {data.skills.length === 1 ? 'category' : 'categories'}</span></header>
      <div className="ar-skill-legend">{scoreBands.map(band => <span key={band.key}><i className={`ar-band-${band.key}`} />{band.label} · {band.guide}</span>)}<span><i className="ar-band-missing" />Unavailable · Missing or locked</span></div>
      {rows.length ? <div className="ar-skill-bars">{rows.map(row => {
        const name = analyticsSkillName(row)
        const total = row.strong + row.fair + row.needs_work + row.missing
        return <div className="ar-skill-row" key={row.id}><strong>{name}</strong><div className="ar-stacked">{scoreBands.map(band => <button type="button" key={band.key} className={`ar-band-${band.key}`} style={{ flex: row[band.key] || 0.01 }} aria-label={`${name} · ${band.label}: ${row[band.key]}`} aria-pressed={selection === `skill:${row.id}:${band.key}`} onClick={() => onSelect(`skill:${row.id}:${band.key}`)} title={`${band.label}: ${row[band.key]}`}>{row[band.key]}</button>)}<span className="ar-band-missing" title={`Missing or locked: ${row.missing}`} style={{ flex: row.missing || 0.01 }}>{row.missing}</span></div><span className="tabular-nums">{total}</span></div>
      })}</div> : <p className="si-empty">No eligible final category evidence in this scope.</p>}
      {data.skills.length > PAGE_SIZE && <nav className="si-pagination" aria-label="Skill category pages"><Pagination total={data.skills.length} page={current} onPage={setPage} pageSize={PAGE_SIZE} /></nav>}
      {rows.length > 0 && <p className="si-helper">Each row counts students in the matching framework or legacy cohorts. A student may appear in several skill categories.</p>}
      <footer className="si-footer"><button type="button" className="si-table-action" onClick={() => onSelect('skills')}><ReportIcon size={16} />View category table</button><div><p>Select a score-band count to view its students.</p><p>Unavailable is not a zero score.</p></div></footer>
    </section>
    <section className="si-panel" aria-label="Current partner matches">
      <header className="si-header"><span className="si-icon" aria-hidden="true"><CompanyIcon size={23} /></span><div><h3>Current partner matches</h3><p>Each student counts once, using their highest current recommendation match.</p></div></header>
      <div className="si-match-group"><div className="si-match-heading"><h4>With a current match</h4><span className="si-badge">{withMatch} {withMatch === 1 ? 'student' : 'students'}</span></div>{matchBands.filter(band => hasAssessmentLed ? currentBands.has(band.key) || (counts.get(band.key) ?? 0) > 0 : !currentBands.has(band.key)).map(band => <MatchRow key={band.key} band={band} count={counts.get(band.key) ?? 0} selection={selection} onSelect={onSelect} />)}</div>
      <div className="si-match-group si-match-group-neutral"><div className="si-match-heading"><h4>Without a current match</h4><span className="si-badge">{withoutMatch} {withoutMatch === 1 ? 'student' : 'students'}</span></div>{unavailableBands.map(band => <MatchRow key={band.key} band={band} count={counts.get(band.key) ?? 0} selection={selection} onSelect={onSelect} />)}</div>
      <p className="si-helper si-approval-note">A partner match supports review. Placement still needs approval.</p>
    </section>
  </div>
}
