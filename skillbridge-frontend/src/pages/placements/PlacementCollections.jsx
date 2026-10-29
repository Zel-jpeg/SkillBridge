import { Link } from 'react-router-dom'
import Avatar from '../../components/Avatar'
import CompanyImage from '../../components/CompanyImage'
import DialogShell from '../../components/DialogShell'
import Pagination from '../../components/Pagination'
import { BriefcaseIcon, ChevronRightIcon, ClockIcon, ReportIcon, UserIcon, WarnIcon } from '../../components/Icons'

const states = {
  results_locked: ['Results incomplete or stale', 'Review required assessments and current finalized evidence before matching.', 'warning', ReportIcon],
  awaiting_capacity: ['Awaiting a slot', 'Current matching positions have no available suggestion slots.', 'warning', UserIcon],
  no_current_matches: ['No current matches', 'Review competency evidence and the available partner positions.', 'neutral', WarnIcon],
  awaiting_draft: ['Preparing suggestions', 'Suggestions are being prepared from the current placement inputs.', 'info', ClockIcon],
  awaiting_update: ['Updating suggestions', 'Suggestions will update when current inputs are ready.', 'info', ClockIcon],
  coordinator_review: ['Coordinator choice needs review', 'The previous coordinator choice is no longer available. Review the alternatives.', 'warning', UserIcon],
  suggestions_declined: ['Available suggestions declined', 'Previous decisions remain recorded. Review other suitable positions when available.', 'neutral', BriefcaseIcon],
}
const decisions = { completed: 'Legacy record', approved: 'Approved', removed: 'Removed', rejected: 'Declined suggestion', suggested: 'Suggested' }
const percentage = value => value == null ? 'Not recorded' : `${value}%`
const stamp = value => {
  const parsed = value ? new Date(value) : null
  return parsed && Number.isFinite(parsed.getTime()) ? new Intl.DateTimeFormat('en-PH', { timeZone: 'Asia/Manila', dateStyle: 'medium', timeStyle: 'short' }).format(parsed) : 'Not recorded'
}
const recordedAt = item => (item.status === 'removed' ? item.removed_at : item.status === 'rejected' ? item.rejected_at : item.status === 'approved' ? item.approved_at : item.created_at) || item.updated_at
const actor = item => (item.status === 'removed' ? item.removed_by : item.status === 'rejected' ? item.rejected_by : item.status === 'approved' ? item.approved_by : item.assigned_by)?.name || 'Not recorded'

export function PlacementIdentity({ student, batch }) {
  return <div className="pl-identity"><Avatar name={student.name} photoUrl={student.photo_url} className="h-9 w-9 rounded-lg text-xs" /><div><strong>{student.name}</strong><p className="pl-muted">{student.school_id || student.student_id || 'No school ID'} · {student.course || 'No course'}{batch ? ` · ${batch.name}` : ''}</p></div></div>
}

export function CollectionPagination({ total, page, onPage, noun = 'records', pageSize = 10 }) {
  if (!total) return null
  const current = Math.min(page, Math.max(1, Math.ceil(total / pageSize)))
  const summary = `Showing ${(current - 1) * pageSize + 1}–${Math.min(current * pageSize, total)} of ${total} ${noun}`
  return <nav className="pl-collection-pagination" aria-label={`${noun} pages`}>{total > pageSize
    ? <Pagination total={total} page={current} pageSize={pageSize} onPage={onPage} summary={summary} />
    : <p className="pl-muted" role="status">{summary}</p>}</nav>
}

export function CompanyOverviewCard({ company, counts, suggestedInScope, address, onOpen }) {
  const totals = company.positions.reduce((sum, pos) => ({ total: sum.total + pos.slots_available, approved: sum.approved + pos.approved_count,
    suggested: sum.suggested + (counts[pos.id] || 0), available: sum.available + Math.max(0, pos.remaining_slots - (counts[pos.id] || 0)) }),
  { total: 0, approved: 0, suggested: 0, available: 0 })
  // Bound visual segments for legacy over-capacity records; numeric labels stay exact.
  const approvedWidth = totals.total ? Math.min(totals.approved / totals.total * 100, 100) : 0
  const suggestedWidth = totals.total ? Math.min(totals.suggested / totals.total * 100, 100 - approvedWidth) : 0
  return <button type="button" className="pl-company" onClick={() => onOpen(company)} aria-label={`Open partner ${company.name}`}>
    <div className="pl-company-heading"><div className="pl-identity"><CompanyImage name={company.name} imageUrl={company.image_url} className="h-11 w-11 rounded-xl" /><div><h2>{company.name}</h2><p className="pl-muted">{address || 'Address not provided'}</p><p className="pl-muted">{company.positions.length} position{company.positions.length === 1 ? '' : 's'} · {suggestedInScope} suggested in your scope</p></div></div>
      <div className="pl-company-available"><strong>{totals.available}</strong><span>available for suggestions</span></div></div>
    <div className="pl-capacity-strip" aria-hidden="true"><span className="pl-capacity-approved" style={{ width: `${approvedWidth}%` }} /><span className="pl-capacity-suggested" style={{ width: `${suggestedWidth}%` }} /></div>
    <div className="pl-capacity-legend"><span><i className="pl-capacity-approved" />{totals.approved} approved</span><span><i className="pl-capacity-suggested" />{totals.suggested} suggested</span><span><i className="pl-capacity-available" />{totals.available} available</span><span>{totals.total} total slots</span></div>
    <span className="pl-button pl-card-action" aria-hidden="true">Review positions <ChevronRightIcon size={15} /></span>
  </button>
}

export function AllocationStatus({ status, description = true }) {
  const [label, note, tone, Icon] = states[status] || ['Awaiting review', 'Review the current allocation status with the coordinator.', 'neutral', WarnIcon]
  return <div className="pl-allocation-status"><span className={`pl-status pl-status--${tone}`}><Icon size={15} />{label}</span>{description && <p className="pl-muted">{note}</p>}</div>
}

export function AwaitingAllocationList({ rows, page, onPage, onOpen, filtered }) {
  return <>
    <div className="pl-allocation-notice"><WarnIcon size={18} /><p><strong>Awaiting allocation is not a rejection.</strong> Students remain available for suitable placements.</p></div>
    <section className="pl-allocation-list" aria-label="Students awaiting allocation">
      <header className="pl-collection-heading"><div><h2>{rows.length} student{rows.length === 1 ? '' : 's'} awaiting allocation</h2><p className="pl-muted">Review each student's next step.</p></div></header>
      {rows.slice((page - 1) * 10, page * 10).map(item => <article className="pl-awaiting" key={item.student.id}>
        <PlacementIdentity student={item.student} /><p className="pl-allocation-batch pl-muted">{item.batch?.name || 'Batch not provided'}</p>
        <AllocationStatus status={item.status} /><button type="button" className="pl-button" aria-haspopup="dialog" aria-label={`View allocation details for ${item.student.name}`} onClick={() => onOpen(item.student.id)}>View details <ChevronRightIcon size={15} /></button>
      </article>)}
      {!rows.length && <div className="pl-empty"><UserIcon size={28} /><h3>{filtered ? 'No students match these filters' : 'No students awaiting allocation'}</h3><p>{filtered ? 'Adjust the search or student scope to see other students.' : 'Students needing allocation will appear here when current suggestions are ready.'}</p></div>}
      <CollectionPagination total={rows.length} page={page} onPage={onPage} noun="students" />
    </section>
  </>
}

export function AllocationDetails({ item, role, onClose, onReview }) {
  const recordsPath = role === 'admin' ? '/admin/users' : `/instructor/students${item.batch?.id ? `?batch_id=${item.batch.id}` : ''}`
  return <DialogShell title="Student allocation details" description="Current allocation state and available position matches." size="placement" onClose={onClose} closeLabel="Close allocation details">
    <div className="pl-dialog-body"><PlacementIdentity student={item.student} batch={item.batch} /><div className="pl-target"><AllocationStatus status={item.status} /></div>
      <p className="pl-muted">This status describes the current allocation. It is separate from a placement approval or rejection.</p>
      <h3 className="pl-subheading">Available position matches</h3><p className="pl-muted">These matches reserve no slots. Review the current evidence and capacity before deciding.</p>
      <div className="pl-alternatives">{item.alternatives?.slice(0, 3).map((option, index) => <button type="button" className="pl-alternative" key={option.id} onClick={() => onReview(option.id)}><strong>#{index + 1} · {option.position}</strong><span>{option.company} · {percentage(option.match_score)}</span><span className="pl-card-action pl-button">Review match <ChevronRightIcon size={14} /></span></button>)}</div>
      {!item.alternatives?.length && <p className="pl-muted pl-list-note">No current position matches are available for this student.</p>}
      <div className="pl-dialog-actions"><Link className="pl-button" to={recordsPath}>Review student records</Link><button type="button" className="pl-button pl-primary" onClick={onClose}>Close</button></div>
    </div>
  </DialogShell>
}

export function DecisionHistory({ rows, total, page, onPage, onOpen, filtered }) {
  return <>
    <section className="pl-history" aria-label="Placement decision history"><header className="pl-collection-heading"><div className="pl-history-title"><h2>Decision history</h2><span className="pl-muted">{total} decision{total === 1 ? '' : 's'}</span></div><p className="pl-muted pl-snapshot-note"><ClockIcon size={18} />Scores are snapshots from the placement decision, not current match rankings.</p></header>
      {rows.length ? <table className="pl-history-table"><caption className="sr-only">Recorded placement decisions. Scores were saved at assignment; recorded times use Asia/Manila.</caption><thead><tr><th>Student</th><th>Partner / Position</th><th>Decision</th><th>Score at decision</th><th>Recorded</th><th><span className="sr-only">Details</span></th></tr></thead><tbody>
        {rows.map(item => <tr className="pl-history-row" key={item.id}><td data-label="Student"><PlacementIdentity student={item.student} /></td>
          <td data-label="Partner / Position"><div className="pl-identity"><CompanyImage name={item.company.name} imageUrl={item.company.image_url} className="h-9 w-9 rounded-lg" /><div><strong>{item.company.name}</strong><p className="pl-muted">{item.position.title}</p></div></div></td>
          <td data-label="Decision"><span className={`pl-status pl-decision-status pl-decision-status--${item.status}`}>{decisions[item.status] || item.status}</span></td>
          <td data-label="Score at decision" className="pl-history-score">{item.match_score_at_assignment == null ? <span className="pl-muted">Manual / no score</span> : percentage(item.match_score_at_assignment)}</td>
          <td data-label="Recorded"><p>{stamp(recordedAt(item))}</p><p className="pl-muted">by {actor(item)}</p></td>
          <td><button type="button" className="pl-history-open pl-button" aria-haspopup="dialog" aria-label={`Decision details for ${item.student.name}`} onClick={() => onOpen(item.id)}><span className="pl-history-detail-label">Decision details</span><ChevronRightIcon size={17} /></button></td>
        </tr>)}
      </tbody></table> : <div className="pl-empty"><ClockIcon size={30} /><h3>{filtered ? 'No decisions match these filters' : 'No placement decisions yet'}</h3><p>{filtered ? 'Adjust the search, student scope or decision filter.' : 'Approved, declined and removed decisions will appear here after a coordinator records them.'}</p></div>}
      <CollectionPagination total={total} page={page} onPage={onPage} noun="decisions" />
    </section><p className="pl-muted pl-snapshot-note"><WarnIcon size={16} />Suggested allocations appear under Partners until a decision is recorded.</p>
  </>
}

export function DecisionDetails({ item, onClose }) {
  return <DialogShell title="Placement decision details" description="Read-only historical placement decision and saved score components." size="placement" onClose={onClose} closeLabel="Close decision details">
    <div className="pl-dialog-body"><PlacementIdentity student={item.student} batch={item.batch} /><div className="pl-target"><h3>{item.company.name}</h3><p>{item.position.title}</p><span className={`pl-status pl-decision-status pl-decision-status--${item.status}`}>{decisions[item.status] || item.status}</span><p className="pl-muted">Recorded {stamp(recordedAt(item))} (Manila) · by {actor(item)}</p></div>
      <p className="pl-muted">Recorded scores are historical snapshots. They do not describe a newly calculated match or change current placement eligibility.</p>
      <div className="pl-score-grid">{[['Hybrid match', item.match_score_at_assignment], ['Category fit', item.category_score_component_at_assignment], ['NLP fit', item.nlp_score_component_at_assignment], ['Location fit', item.location_score_component_at_assignment]].map(([label, value]) => <div key={label}><strong>{percentage(value)}</strong><span>{label}</span></div>)}</div>
      <h3>Decision remarks</h3><p className="pl-decision-remarks">{item.remarks || 'No remarks recorded.'}</p><p className="pl-muted">Distance at assignment: {item.distance_km_at_assignment == null ? 'Not recorded' : `${item.distance_km_at_assignment} km`}</p>
      <div className="pl-dialog-actions"><button type="button" className="pl-button pl-primary" onClick={onClose}>Close</button></div>
    </div>
  </DialogShell>
}
