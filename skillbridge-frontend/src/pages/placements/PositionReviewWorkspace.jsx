import CompanyImage from '../../components/CompanyImage'
import ScoreLabel from '../../components/ScoreLabel'
import { BriefcaseIcon, UserIcon, WarnIcon } from '../../components/Icons'
import { CollectionPagination, PlacementIdentity } from './PlacementCollections'

export const CANDIDATE_PAGE_SIZE = 8

function PositionCapacity({ position, held = 0, compact = false }) {
  const total = position.slots_available
  const available = Math.max(0, position.remaining_slots - held)
  const approvedWidth = total > 0 ? Math.max(0, Math.min(100, position.approved_count / total * 100)) : 0
  const suggestedWidth = total > 0 ? Math.max(0, Math.min(100 - approvedWidth, held / total * 100)) : 0
  if (compact) return <div className="pl-position-capacity"><p>{total} total · {position.approved_count} approved · {held} suggested</p><strong>{available} available for suggestions</strong></div>
  return <div className="pl-position-capacity-panel" aria-label="Position capacity across all batches">
    <p className="pl-position-total"><strong>{total}</strong> total slots</p>
    <div><div className="pl-capacity-strip" aria-hidden="true"><span className="pl-capacity-approved" style={{ width: `${approvedWidth}%` }} /><span className="pl-capacity-suggested" style={{ width: `${suggestedWidth}%` }} /></div>
      <div className="pl-capacity-legend"><span><i className="pl-capacity-approved" />{position.approved_count} approved</span><span><i className="pl-capacity-suggested" />{held} suggested</span><span><i className="pl-capacity-available" />{available} available for suggestions</span></div>
    </div>
  </div>
}

function CandidateMatch({ value, distance }) {
  const available = value != null && Number.isFinite(Number(value))
  const numeric = available ? Number(value) : null
  const band = !available ? 'missing' : numeric >= 80 ? 'strong' : numeric >= 60 ? 'fair' : 'low'
  return <div className={`pl-candidate-match pl-candidate-match--${band}`}>
    <div><strong>{available ? `${value}%` : 'Not available'}</strong>{available && <span className="pl-candidate-match-track" aria-hidden="true"><span style={{ width: `${Math.max(0, Math.min(100, numeric))}%` }} /></span>}</div>
    <p>{!available ? 'No current match score' : band === 'strong' ? 'Strong match' : band === 'fair' ? 'Fair match' : 'Low match · review carefully'}</p>
    {distance != null && <p className="pl-muted">{distance} km</p>}
  </div>
}

export default function PositionReviewWorkspace({ company, position, counts, proposed, ranked, approved, candidates, students,
  rankByRecommendation, view, page, onPage, onView, onPosition, onReview, onRemove, onManual, onBack, address, generated, role, companyHeadingRef }) {
  const approvedView = view === 'approved'
  const start = (Math.min(page, Math.max(1, Math.ceil(candidates.length / CANDIDATE_PAGE_SIZE))) - 1) * CANDIDATE_PAGE_SIZE
  const current = candidates.slice(start, start + CANDIDATE_PAGE_SIZE)
  const suggestedIds = new Set(proposed.map(row => row.proposal.id))
  const othersCount = ranked.filter(row => !suggestedIds.has(row.recommendation_id)).length
  const studentById = new Map(students.map(row => [row.student.id, row]))
  return <div className="pl-position-review">
    <div className="pl-company-context">
      <button type="button" className="pl-button pl-back" onClick={onBack}>← Back to partners</button>
      <div className="pl-identity"><CompanyImage name={company.name} imageUrl={company.image_url} className="h-11 w-11 rounded-xl" /><div><h2 ref={companyHeadingRef} tabIndex={-1}>{company.name}</h2><p className="pl-muted">{address || 'Address not provided'}</p></div></div>
      <p className="pl-muted">Slot counts: all batches · Students: selected scope</p>
    </div>
    {!position ? <div className="pl-empty"><BriefcaseIcon size={28} /><h3>No positions listed</h3><p>This partner has no positions available to review.</p></div> : <div className="pl-workspace pl-position-workspace">
      <nav className="pl-positions pl-position-navigation" aria-label="Partner positions"><h3>Positions <span>{company.positions.length}</span></h3>
        {company.positions.map(item => <button type="button" key={item.id} aria-pressed={item.id === position.id} onClick={() => onPosition(item.id)}><strong>{item.title}</strong><PositionCapacity position={item} held={counts[item.id] || 0} compact /></button>)}
      </nav>
      <section className="pl-candidates pl-position-candidates" aria-label="Position candidates">
        <div className="pl-position-header"><div><h3>{position.title}</h3><p className="pl-muted">{company.name}</p></div><button type="button" className="pl-button" onClick={() => onManual(position.id)}><UserIcon size={16} />Assign manually</button></div>
        <PositionCapacity position={position} held={counts[position.id] || 0} />
        <div className="pl-tabs pl-position-tabs" role="group" aria-label="Position student lists">
          <button type="button" aria-pressed={view === 'proposed'} onClick={() => onView('proposed')}>Suggested ({proposed.length})</button>
          <button type="button" aria-label="Other ranked candidates" aria-pressed={view === 'ranked'} onClick={() => onView('ranked')}>Other ranked candidates <span className="pl-tab-count">{othersCount}</span></button>
          <button type="button" aria-pressed={approvedView} onClick={() => onView('approved')}>Approved ({approved.length})</button>
        </div>
        <p className="pl-muted pl-list-note">{approvedView ? 'Confirmed assignments. Suggestion updates do not move these students.' : view === 'proposed' ? 'One provisional position per student. Review each suggestion before approval.' : 'Ranked for this position. Students may already be suggested to another position.'}</p>
        {current.length ? <table className={`pl-candidate-table ${approvedView ? 'pl-candidate-table--approved' : ''}`}>
          <caption className="sr-only">{approvedView ? 'Approved students and their saved assignment scores' : `Candidates for ${position.title}. Position ranks are preserved across filters${role === 'instructor' ? ' within your roster' : ''}.`}</caption>
          <thead><tr>{!approvedView && <th scope="col" className="pl-candidate-rank">Rank</th>}<th scope="col">Student</th><th scope="col">{approvedView ? 'Score at approval' : <ScoreLabel label="Hybrid match" />}</th><th scope="col">{approvedView ? 'Placement' : 'Current suggestion'}</th><th scope="col">{approvedView ? 'Action' : 'Review'}</th></tr></thead>
          <tbody>{current.map(item => {
            const proposal = studentById.get(item.student.id)?.proposal
            const rank = rankByRecommendation.get(item.recommendation_id)
            return <tr className="pl-candidate-row" key={approvedView ? item.id : item.recommendation_id}>
              {!approvedView && <td className="pl-candidate-rank" data-label="Position rank">{rank != null ? `#${rank}` : '—'}</td>}
              <td data-label="Student"><PlacementIdentity student={item.student} batch={item.batch} /></td>
              <td data-label={approvedView ? 'Score at approval' : 'Hybrid match'}>{approvedView ? <div className="pl-approved-score"><strong>{item.match_score_at_assignment == null ? 'Manual / no score' : `${item.match_score_at_assignment}%`}</strong><p className="pl-muted">Saved at approval</p></div> : <CandidateMatch value={item.match_score} distance={item.distance_km} />}</td>
              <td data-label={approvedView ? 'Placement' : 'Current suggestion'}>{approvedView ? <span className="pl-status pl-decision-status pl-decision-status--approved">Approved</span> : proposal ? <div className="pl-current-position"><strong>{proposal.position}</strong><p className="pl-muted">{proposal.company || 'Partner not provided'}</p>{proposal.position_id === position.id && <span className="pl-muted">This position</span>}</div> : <span className="pl-muted">No current suggestion</span>}</td>
              <td className="pl-candidate-action">{approvedView ? <button type="button" className="pl-button pl-danger" onClick={() => onRemove(item)}>Remove placement</button> : <button type="button" className="pl-button pl-primary" onClick={() => onReview(item.recommendation_id)}>Review candidate</button>}</td>
            </tr>
          })}</tbody>
        </table> : <div className="pl-empty"><UserIcon size={28} /><h3>No students in this view</h3><p>{!generated && view === 'proposed' ? 'Suggestions are being prepared. You can also review other ranked candidates.' : 'No students match this view and scope.'}</p></div>}
        <CollectionPagination total={candidates.length} page={page} onPage={onPage} pageSize={CANDIDATE_PAGE_SIZE} noun={approvedView ? 'approved students' : 'candidates'} />
        {!approvedView && <p className="pl-muted pl-position-footnote"><WarnIcon size={16} />Match scores support coordinator review. Suggestions are provisional; approval makes a placement official.</p>}
      </section>
    </div>}
  </div>
}
