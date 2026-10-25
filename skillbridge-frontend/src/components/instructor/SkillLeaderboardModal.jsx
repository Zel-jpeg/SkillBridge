import { useMemo, useState } from 'react'
import DialogShell from '../DialogShell'
import Avatar from '../Avatar'
import Pagination from '../Pagination'
import { ChevronRightIcon, ClockIcon, ListIcon, SearchIcon, SkillIcon, StarIcon, UserIcon } from '../Icons'
import { scoreBg, scoreColor } from '../../utils/formatters'
import './skillLeaderboard.css'

const PAGE_SIZE = 5

function ScoreBar({ score }) {
  return <span className="lb-score-track" aria-hidden="true"><span className={scoreBg(score)} style={{ width: `${Math.max(0, Math.min(100, score))}%` }} /></span>
}

function PodiumCard({ student, rank, score, onSelectStudent }) {
  return <button type="button" className={`lb-podium-card lb-podium-card--${rank}`} data-rank={rank}
    aria-haspopup="dialog" aria-label={`View ${student.name}'s details`} onClick={() => onSelectStudent(student)}>
    <span className="lb-podium-rank">#{rank}</span>
    <span className="lb-medal" aria-hidden="true"><StarIcon size={13} /></span>
    <Avatar name={student.name} photoUrl={student.photoUrl} tone="neutral" className="lb-avatar h-12 w-12 rounded-full text-sm" />
    <span className="lb-podium-identity"><strong>{student.name}</strong><span>{student.course || 'Course not provided'}</span><span className="sr-only">{student.studentId || 'No student ID'}</span></span>
    <strong className={`lb-podium-score ${scoreColor(score)}`}>{score}%</strong>
    <ScoreBar score={score} />
  </button>
}

// Search only this list. Global podium positions are assigned before filtering.
function useStudentPage(rows) {
  const [query, setQuery] = useState('')
  const [page, setPage] = useState(1)
  const filtered = useMemo(() => {
    const term = query.trim().toLocaleLowerCase()
    return rows.filter(({ student }) => !term || [student.name, student.studentId, student.course]
      .some(value => String(value || '').toLocaleLowerCase().includes(term)))
  }, [rows, query])
  const currentPage = Math.min(page, Math.max(1, Math.ceil(filtered.length / PAGE_SIZE)))
  // Persist the clamped page so a later live refresh cannot jump back to an old page.
  if (page !== currentPage) setPage(currentPage)
  const from = (currentPage - 1) * PAGE_SIZE
  return { query, search: value => { setQuery(value); setPage(1) }, page: currentPage, setPage,
    filtered, visible: filtered.slice(from, from + PAGE_SIZE), from }
}

function SearchStudents({ label, value, onChange }) {
  return <label className="lb-search"><span className="sr-only">{label}</span><SearchIcon size={16} /><input type="search" placeholder={label} value={value} onChange={event => onChange(event.target.value)} /></label>
}

function ListPagination({ list, summary, label }) {
  return list.filtered.length > PAGE_SIZE
    ? <nav className="lb-pagination" aria-label={label}><Pagination total={list.filtered.length} page={list.page} onPage={list.setPage} pageSize={PAGE_SIZE} summary={summary} /></nav>
    : <p className="lb-muted lb-range" role="status">{summary}</p>
}

function RemainingRankings({ rows, totalRanked, onSelectStudent }) {
  const list = useStudentPage(rows)
  const summary = list.query.trim()
    ? `Showing ${list.visible.length ? list.from + 1 : 0}–${list.from + list.visible.length} of ${list.filtered.length} matching students`
    : list.visible.length ? `Showing ranks ${list.visible[0].rank}–${list.visible.at(-1).rank} of ${totalRanked}` : 'No remaining ranked students'
  return <section className="lb-section" aria-label="Remaining rankings">
    <div className="lb-section-heading"><h3><ListIcon size={19} />Remaining rankings <span className="lb-count" role="status">{list.query.trim() ? `${list.filtered.length} of ${rows.length}` : rows.length} students</span></h3>
      <SearchStudents label="Search remaining students…" value={list.query} onChange={list.search} /></div>
    <p className="lb-muted lb-search-hint">Search by name, ID or course. The top three above stay unchanged.</p>
    {list.visible.length ? <div className="lb-table" role="table" aria-label="Remaining student rankings">
      <div className="lb-row lb-row--header" role="row"><span role="columnheader">Rank</span><span role="columnheader">Student</span><span role="columnheader">Course</span><span role="columnheader">Category score</span><span role="columnheader" className="sr-only">Details</span></div>
      {list.visible.map(({ student, rank, score }) => <div key={student.id} className="lb-row" role="row">
        <span className="lb-rank" role="cell">#{rank}</span>
        <span className="lb-student" role="cell"><Avatar name={student.name} photoUrl={student.photoUrl} tone="neutral" className="lb-avatar h-9 w-9 rounded-full text-xs" /><span><strong>{student.name}</strong><span className="lb-muted">{student.studentId || 'No student ID'}</span></span></span>
        <span className="lb-course" role="cell">{student.course || 'Not provided'}</span>
        <span className="lb-row-score" role="cell"><strong className={scoreColor(score)}>{score}%</strong><ScoreBar score={score} /></span>
        <span role="cell"><button type="button" className="lb-open-student" aria-haspopup="dialog" aria-label={`View ${student.name}'s details`} onClick={() => onSelectStudent(student)}><ChevronRightIcon size={18} /></button></span>
      </div>)}
    </div> : <div className="lb-no-matches"><p>No students match this search.</p><button type="button" className="lb-clear" onClick={() => list.search('')}>Clear search</button></div>}
    <ListPagination list={list} summary={summary} label="Remaining rankings pages" />
  </section>
}

function PendingStudents({ rows, onSelectStudent }) {
  const list = useStudentPage(rows)
  return <section className="lb-section lb-pending" aria-label="Not yet assessed">
    <div className="lb-section-heading"><h3><ClockIcon size={19} />Not yet assessed <span className="lb-count" role="status">{list.query.trim() ? `${list.filtered.length} of ${rows.length}` : rows.length}</span></h3>
      {(rows.length > PAGE_SIZE || list.query) && <SearchStudents label="Search unassessed students…" value={list.query} onChange={list.search} />}</div>
    <p className="lb-muted">These students have no assessed score yet and are not ranked.</p>
    <div className="lb-pending-grid">{list.visible.map(({ student }) => <button key={student.id} type="button" className="lb-pending-student" aria-haspopup="dialog" aria-label={`View ${student.name}'s details`} onClick={() => onSelectStudent(student)}>
      <Avatar name={student.name} photoUrl={student.photoUrl} tone="neutral" className="lb-avatar h-9 w-9 rounded-full text-xs" /><span><strong>{student.name}</strong><span className="lb-muted">{student.studentId || student.course || 'ID not provided'}</span></span><span className="lb-count">Pending</span>
    </button>)}</div>
    {!list.visible.length && <div className="lb-no-matches"><p>No students match this search.</p><button type="button" className="lb-clear" onClick={() => list.search('')}>Clear search</button></div>}
    {rows.length > PAGE_SIZE && <ListPagination list={list} summary={`Showing ${list.visible.length ? list.from + 1 : 0}–${list.from + list.visible.length} of ${list.filtered.length} unassessed students`} label="Unassessed student pages" />}
  </section>
}

export default function SkillLeaderboardModal({ skill, allStudents, onClose, onSelectStudent }) {
  const { category } = skill
  // Preserve existing ranking eligibility and deterministic ties; never recalculate scores.
  const ranked = useMemo(() => allStudents
    .filter(student => student.status === 'completed' && student.recommendationsLocked !== true && Number.isFinite(student.scores[category]))
    .sort((a, b) => b.scores[category] - a.scores[category] || a.name.localeCompare(b.name) || a.id - b.id)
    .map((student, index) => ({ student, rank: index + 1, score: student.scores[category] })), [allStudents, category])
  const pending = useMemo(() => allStudents.filter(student => student.status === 'pending').map(student => ({ student })), [allStudents])
  const top = ranked.slice(0, 3)
  const podium = top.length === 3 ? [top[1], top[0], top[2]] : top.length === 2 ? [top[1], top[0]] : top
  const rest = useMemo(() => ranked.slice(3), [ranked])
  const unavailable = allStudents.length - ranked.length - pending.length
  const batchNames = [...new Set(allStudents.map(student => student.batch?.name).filter(Boolean))]
  const courses = [...new Set(allStudents.map(student => student.course).filter(Boolean))]
  const scope = batchNames.length === 1 ? batchNames[0] : 'Current dashboard scope'
  return <DialogShell size="leaderboard" title={`${category} Leaderboard`} description={`${ranked.length} assessed · ${pending.length} pending`}
    avatar={<span className="lb-category-icon" aria-hidden="true"><SkillIcon size={24} /></span>}
    headerDetails={<p className="lb-muted">{scope}{courses.length ? ` · ${courses.join(' / ')}` : ''}</p>}
    onClose={onClose} closeLabel="Close skill leaderboard"
    footer={<p className="lb-footer-hint"><UserIcon size={15} />Select any student to view full assessment details.</p>}>
    <div className="lb-body">
      <div className="lb-summary"><p><strong>{allStudents.length}</strong> students <span><strong>{ranked.length}</strong> ranked</span><span><strong>{pending.length}</strong> not yet assessed</span></p><p className="lb-muted">Ranked by combined category score, highest first.</p></div>
      {unavailable > 0 && <p className="lb-muted lb-unavailable">{unavailable} other student{unavailable === 1 ? ' has' : 's have'} no current unlocked score in this category.</p>}
      {top.length ? <section className="lb-top" aria-label="Top performers"><h3><StarIcon size={18} />Top performers</h3><div className={`lb-podium lb-podium--${top.length}`}>
        {podium.map(row => <PodiumCard key={row.student.id} {...row} onSelectStudent={onSelectStudent} />)}
      </div></section> : <div className="lb-empty"><SkillIcon size={32} /><h3>No results yet</h3><p className="lb-muted">No current unlocked category results are available for {category}.</p></div>}
      {rest.length > 0 && <RemainingRankings key={`remaining-${category}`} rows={rest} totalRanked={ranked.length} onSelectStudent={onSelectStudent} />}
      {pending.length > 0 && <PendingStudents key={`pending-${category}`} rows={pending} onSelectStudent={onSelectStudent} />}
    </div>
  </DialogShell>
}
