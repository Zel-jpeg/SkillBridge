import { useMemo, useRef, useState } from 'react'
import Avatar from '../../components/Avatar'
import CompanyImage from '../../components/CompanyImage'
import DialogShell from '../../components/DialogShell'
import DataSection from '../../components/DataSection'
import Pagination from '../../components/Pagination'
import PageHeader from '../../components/PageHeader'
import ScoreLabel from '../../components/ScoreLabel'
import PlacementReportPanel from '../../components/placements/PlacementReportPanel'
import { ActionModal, ManualAssignmentModal } from './PlacementDialogs'
import { DRAFT_URL, usePlacements } from '../../hooks/usePlacements'
import { matchColor } from '../../utils/formatters'
import './placements.css'

const SUGGESTIONS = '/api/placements/suggestions/?include_history=true&include_placed=true'
const STATUS = { proposed: 'Suggested', awaiting_draft: 'Preparing suggestions', awaiting_capacity: 'Awaiting a seat', awaiting_update: 'Updating suggestions', coordinator_review: 'Coordinator choice needs review', results_locked: 'Results incomplete or stale', no_current_matches: 'No current matches', suggestions_declined: 'Available suggestions declined', approved: 'Approved', rejected: 'Declined suggestion', removed: 'Removed', suggested: 'Suggested' }
const score = value => value == null ? 'Not available' : `${value}%`
const address = value => typeof value === 'string' ? value : [value?.city, value?.municipality, value?.province].filter(Boolean).join(', ')
const historyActor = item => (item.status === 'removed' ? item.removed_by : item.status === 'rejected' ? item.rejected_by : item.status === 'approved' ? item.approved_by : item.assigned_by)?.name || 'Not recorded'
const date = value => value ? new Intl.DateTimeFormat('en-PH', { timeZone: 'Asia/Manila', dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value)) : 'Not recorded'
const actionable = item => ['unplaced', 'suggested'].includes(item.placement_status)
function Identity({ student, batch }) { return <div className="pl-identity"><Avatar name={student.name} photoUrl={student.photo_url} className="h-9 w-9 rounded-lg text-xs" /><div><strong>{student.name}</strong><p className="pl-muted">{student.school_id || student.student_id || 'No school ID'} · {student.course || 'No course'}{batch ? ` · ${batch.name}` : ''}</p></div></div> }
function Capacity({ position, held = 0 }) { return <p className="pl-capacity"><span>{position.slots_available} total</span><span>{position.approved_count} approved</span><span>{held} suggested</span><strong>{Math.max(0, position.remaining_slots - held)} available for suggestions</strong></p> }
function Empty({ children }) { return <p className="pl-empty">{children}</p> }
function Pager({ rows, page, onPage }) { return <Pagination total={rows.length} page={Math.min(page, Math.max(1, Math.ceil(rows.length / 10)))} pageSize={10} onPage={onPage} /> }
function slice(rows, page) { const current = Math.min(page, Math.max(1, Math.ceil(rows.length / 10))); return rows.slice((current - 1) * 10, current * 10) }

export default function PlacementWorkspace({ role = 'admin' }) {
  const [tab, setTab] = useState('companies')
  const [search, setSearch] = useState('')
  const [batch, setBatch] = useState('')
  const [area, setArea] = useState('')
  const [availability, setAvailability] = useState('all')
  const [companyId, setCompanyId] = useState(null)
  const [positionId, setPositionId] = useState(null)
  const [view, setView] = useState('proposed')
  const [page, setPage] = useState(1)
  const [companyPage, setCompanyPage] = useState(1)
  const [historyPage, setHistoryPage] = useState(1)
  const [historyStatus, setHistoryStatus] = useState('')
  const params = new URLSearchParams({ limit: '10', offset: String((historyPage - 1) * 10) })
  if (search.trim()) params.set('q', search.trim())
  if (batch) params.set('batch_id', batch)
  if (historyStatus) params.set('status', historyStatus)
  const data = usePlacements(`/api/placements/?${params}`)
  const [reports, setReports] = useState(false)
  const [reviewId, setReviewId] = useState(null)
  const [action, setAction] = useState(null)
  const [manual, setManual] = useState(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const pending = useRef(false)
  const overviewScroll = useRef(0)
  const draft = data.draft
  const counts = draft?.proposed_counts || {}
  const students = draft?.students || []
  const inScope = item => !batch || String(item.batch?.id) === batch
  const visible = students.filter(inScope)
  const approved = data.approvedPlacements.filter(inScope)
  const approvedByStudent = useMemo(() => new Map(data.approvedPlacements.map(item => [item.student.id, item])), [data.approvedPlacements])
  const pairs = useMemo(() => data.companies.flatMap(company => company.positions.flatMap(position => position.suggested_students.map(suggestion => ({ company, position, suggestion })))), [data.companies])
  const review = pairs.find(item => item.suggestion.recommendation_id === reviewId)
  const reviewing = review && students.find(item => item.student.id === review.suggestion.student.id)
  const batches = [...new Map([...students, ...data.approvedPlacements].filter(item => item.batch).map(item => [item.batch.id, item.batch])).values()]
  const company = data.companies.find(item => item.id === companyId)
  const position = company?.positions.find(item => item.id === positionId) || company?.positions.find(item => item.remaining_slots > 0) || company?.positions[0]
  const term = search.trim().toLowerCase()
  const matches = (...values) => !term || values.filter(Boolean).some(value => String(value).toLowerCase().includes(term))
  const historyMaxPage = Math.max(1, Math.ceil(data.historyCount / 10))
  if (data.historyReady && historyPage > historyMaxPage) setHistoryPage(historyMaxPage)
  function openCompany(co) {
    overviewScroll.current = window.scrollY
    const matchingApproval = term && approved.find(item => item.company.id === co.id && matches(item.student.name, item.student.school_id))
    const target = (matchingApproval && co.positions.find(pos => pos.id === matchingApproval.position.id)) || (term && co.positions.find(pos => matches(pos.title) || pos.suggested_students.some(row => inScope(row) && matches(row.student.name, row.student.school_id)))) || co.positions.find(pos => visible.some(item => item.proposal?.position_id === pos.id)) || co.positions.find(pos => pos.remaining_slots > 0) || co.positions[0]
    const hasProposal = visible.some(item => item.proposal?.position_id === target?.id && matches(item.student.name, item.student.school_id, co.name, target?.title))
    setCompanyId(co.id); setPositionId(target?.id); setPage(1); setView(matchingApproval ? 'approved' : hasProposal ? 'proposed' : 'ranked')
  }
  function backToCompanies() {
    setCompanyId(null); setPositionId(null)
    requestAnimationFrame(() => window.scrollTo({ top: overviewScroll.current, behavior: 'instant' }))
  }
  const companies = data.companies.filter(item => {
    const open = item.positions.some(pos => pos.remaining_slots > (counts[pos.id] || 0))
    return (!area || address(item.address) === area) && (availability === 'all' || (availability === 'open' ? open : !open)) &&
      (matches(item.name, address(item.address)) || item.positions.some(pos => matches(pos.title) || pos.suggested_students.some(row => inScope(row) && matches(row.student.name, row.student.school_id))) || approved.some(row => row.company.id === item.id && matches(row.student.name, row.student.school_id)))
  })
  const proposed = position ? visible.filter(item => item.proposal?.position_id === position.id) : []
  const ranked = (position?.suggested_students || []).filter(item => actionable(item) && inScope(item) && matches(item.student.name, item.student.school_id, company?.name, position?.title))
  const approvedHere = approved.filter(item => item.position.id === position?.id && matches(item.student.name, item.student.school_id, company?.name, position?.title))
  const candidates = view === 'approved' ? approvedHere : ranked.filter(item => view === 'proposed' ? proposed.some(row => row.proposal.id === item.recommendation_id) : !proposed.some(row => row.proposal.id === item.recommendation_id))
  const awaiting = visible.filter(item => !item.proposal && matches(item.student.name, item.student.school_id, item.batch.name))
  const areas = [...new Set(data.companies.map(item => address(item.address)).filter(Boolean))].sort()
  function filter(setter, value) { setter(value); setPage(1); setCompanyPage(1); setHistoryPage(1) }
  function changeTab(value) { setTab(value); setCompanyId(null); setPositionId(null); setPage(1) }
  async function draftAction(payload) {
    if (pending.current) return
    pending.current = true; setBusy(true); setError('')
    try {
      const result = await data.draftAction(payload)
      if (!result.ok) { setError(result.message || 'Suggestion update was not saved. Refresh before retrying.'); return }
      await data.refresh()
    } catch { setError('The update could not be confirmed. Refresh before retrying.') }
    finally { pending.current = false; setBusy(false) }
  }
  async function decide(current, remarks) {
    const result = current.type === 'approve' ? await data.approve(current.suggestion.recommendation_id, remarks) : current.type === 'remove' ? await data.remove({ placementId: current.suggestion.placement_id, remarks }) : await data.reject({ recommendationId: current.suggestion.recommendation_id, remarks })
    if (result?.ok) setReviewId(null)
    return result
  }
  const liveAction = action && (action.type === 'remove' ? data.approvedPlacements.some(item => item.id === action.suggestion.placement_id) && action : pairs.find(item => item.suggestion.recommendation_id === action.suggestion.recommendation_id) && { ...pairs.find(item => item.suggestion.recommendation_id === action.suggestion.recommendation_id), type: action.type })
  function removeRecord(item) { const co = data.companies.find(row => row.id === item.company.id); const pos = co?.positions.find(row => row.id === item.position.id); if (co && pos) setAction({ type: 'remove', company: co, position: pos, suggestion: { student: item.student, placement_id: item.id } }) }
  function alternative(option, index) {
    const target = data.positions.find(item => item.id === option.position_id)
    const selected = reviewing?.proposal?.id === option.id
    return <div className="pl-alternative" key={option.id}>
      <strong>{index != null ? `#${index + 1} · ` : ''}{option.position}</strong>
      <span>{option.company} · {score(option.match_score)}</span>
      <span>{target ? `${Math.max(0, target.remaining_slots - (counts[target.id] || 0))} available for suggestions · ${target.slots_available} total seats` : 'Capacity unavailable'}</span>
      {selected ? <span className="pl-status pl-current-suggestion">Current suggestion</span> : <button type="button" className="pl-button" disabled={busy || data.syncing || draft?.stale || !draft?.generated} onClick={() => draftAction({ action: 'choose', student_id: review.suggestion.student.id, recommendation_id: option.id, revision: draft.revision })}>Suggest this instead</button>}
    </div>
  }

  return <section className="pl-page">
    <PageHeader title="OJT Placement Management" subtitle={role === 'admin' ? 'Review suggested placements across active batches. You make the final decision.' : 'Review placements for your students. Company seats are shared across all batches.'} action={<><button className="pl-button" onClick={() => setReports(value => !value)}>Download reports</button><button className="pl-button" onClick={async () => { await data.synchronize(); await data.refresh() }} disabled={data.refreshing || data.syncing}>{data.refreshing || data.syncing ? 'Refreshing…' : 'Refresh suggestions'}</button></>} />
    {reports && <p className="pl-muted">Report filters are independent of the placement workspace. Downloads include recorded decisions and official capacity; provisional seats are not approved placements.</p>}
    {reports && <PlacementReportPanel companies={data.companies} positions={data.positions} placements={[...data.approvedPlacements, ...data.placements]} students={data.students} role={role} />}
    <DataSection urls={[SUGGESTIONS, DRAFT_URL]} layout="stats" count={3}>
      <div className="pl-stats">{[[visible.length, 'Students awaiting placement', 'Current student scope'], [approved.length, 'Approved placements', 'Current student scope'], [data.stats.remaining, 'Seats not yet approved', 'All batches; includes suggested seats']].map(([value, label, note]) => <div key={label}><p>{label}</p><strong>{value}</strong><span>{note}</span></div>)}</div>
      <p className="pl-muted pl-auto-status" role="status">{data.syncing || !draft?.generated ? 'Updating suggestions…' : draft.stale ? 'Suggestions need updating.' : 'Suggestions updated automatically · Awaiting coordinator approval'}</p>
      {data.syncError && <p role="alert" className="pl-error">Could not update suggestions. {data.syncError} Use Refresh suggestions to retry.</p>}
    </DataSection>
    {error && <p role="alert" className="pl-error">{error}</p>}
    <nav className="pl-tabs" aria-label="Placement views">{[['companies', 'Companies'], ['awaiting', `Awaiting allocation (${visible.filter(item => !item.proposal).length})`], ['history', 'Decision history']].map(([key, label]) => <button key={key} aria-current={tab === key ? 'page' : undefined} onClick={() => changeTab(key)}>{label}</button>)}</nav>
    <div className="pl-filters"><label className="pl-search">Search<input value={search} onChange={event => filter(setSearch, event.target.value)} placeholder="Company, position, student or school ID" /></label><label>Student scope<select value={batch} onChange={event => filter(setBatch, event.target.value)}><option value="">{role === 'admin' ? 'All authorized batches' : 'My batches'}</option>{batches.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
      {tab === 'companies' && !company && <><label>Company area<select value={area} onChange={event => filter(setArea, event.target.value)}><option value="">All areas</option>{areas.map(item => <option key={item}>{item}</option>)}</select></label><label>Suggestion availability<select value={availability} onChange={event => filter(setAvailability, event.target.value)}><option value="all">All companies</option><option value="open">Available suggestion seats</option><option value="full">No available suggestion seats</option></select></label></>}
      {tab === 'history' && <label>Decision<select value={historyStatus} onChange={event => filter(setHistoryStatus, event.target.value)}><option value="">All decisions</option>{['approved', 'rejected', 'removed', 'suggested'].map(item => <option key={item} value={item}>{STATUS[item]}</option>)}</select></label>}
      {(search || batch || area || availability !== 'all' || historyStatus) && <button className="pl-button" onClick={() => { setSearch(''); setBatch(''); setArea(''); setAvailability('all'); setHistoryStatus(''); setPage(1); setCompanyPage(1); setHistoryPage(1) }}>Clear filters</button>}
    </div>
    {tab === 'companies' && <DataSection urls={[SUGGESTIONS, DRAFT_URL]} layout="cards">{!company ? <>
      <div className="pl-section-heading"><p>{companies.length} companies · Open a company to review its positions</p><button className="pl-button" onClick={() => setManual({})} disabled={!data.students.length}>Manual assignment</button></div>
      <div className="pl-company-grid">{slice(companies, companyPage).map(co => { const totals = co.positions.reduce((sum, pos) => ({ total: sum.total + pos.slots_available, approved: sum.approved + pos.approved_count, proposed: sum.proposed + (counts[pos.id] || 0), open: sum.open + Math.max(0, pos.remaining_slots - (counts[pos.id] || 0)) }), { total: 0, approved: 0, proposed: 0, open: 0 }); return <button className="pl-company" key={co.id} onClick={() => openCompany(co)} aria-label={`Open company ${co.name}`}><div className="pl-identity"><CompanyImage name={co.name} imageUrl={co.image_url} className="h-11 w-11 rounded-xl" /><div><h2>{co.name}</h2><p className="pl-muted">{address(co.address) || 'Address not provided'}</p></div></div><p className="pl-muted">{co.positions.length} positions · {visible.filter(item => item.proposal?.company_id === co.id).length} suggested students in your scope</p><div className="pl-company-capacity"><strong>{totals.open}<span> available for suggestions</span></strong><p>{totals.approved} approved · {totals.proposed} suggested · {totals.total} total seats</p></div><span className="pl-button pl-card-action" aria-hidden="true">Review positions →</span></button> })}</div>
      {!companies.length && <Empty>No companies match these filters.</Empty>}<Pager rows={companies} page={companyPage} onPage={setCompanyPage} />
    </> : <>
      <button className="pl-button pl-back" onClick={backToCompanies}>← Back to companies</button><div className="pl-section-heading"><div className="pl-identity"><CompanyImage name={company.name} imageUrl={company.image_url} /><div><h2>{company.name}</h2><p className="pl-muted">{address(company.address)}</p></div></div><p className="pl-muted">Capacity: all batches · Student lists: selected scope</p></div>
      {!position ? <Empty>No positions are listed for this company.</Empty> : <div className="pl-workspace"><nav className="pl-positions" aria-label="Company positions">{company.positions.map(pos => <button key={pos.id} aria-pressed={pos.id === position.id} onClick={() => { setPositionId(pos.id); setPage(1) }}><strong>{pos.title}</strong><Capacity position={pos} held={counts[pos.id] || 0} /></button>)}</nav><section className="pl-candidates" aria-label="Position candidates"><div className="pl-position-header"><div><h3>{position.title}</h3><Capacity position={position} held={counts[position.id] || 0} /></div><button className="pl-button" onClick={() => setManual({ positionId: position.id })}>Assign manually</button></div><div className="pl-tabs" role="group" aria-label="Position student lists">{[['proposed', `Suggested (${proposed.length})`], ['ranked', 'Other ranked candidates'], ['approved', `Approved (${approvedHere.length})`]].map(([key, label]) => <button key={key} aria-pressed={view === key} onClick={() => { setView(key); setPage(1) }}>{label}</button>)}</div><p className="pl-muted pl-list-note">{view === 'approved' ? 'Confirmed assignments, including manual placements. Suggestion updates do not move these students.' : view === 'proposed' ? 'One provisional position per student. Review each proposal before approval.' : 'Candidates ranked within this position. A student may be proposed elsewhere.'}</p>
        {slice(candidates, page).map(item => view === 'approved' ? <div className="pl-candidate-row" key={item.id}><Identity student={item.student} batch={item.batch} /><div><span className="pl-status">Approved</span><p className="pl-muted">{item.match_score_at_assignment == null ? 'Manual / no score' : `${score(item.match_score_at_assignment)} at approval`}</p></div><button className="pl-button pl-danger" onClick={() => removeRecord(item)}>Remove placement</button></div> : <div className="pl-candidate-row" key={item.recommendation_id}><Identity student={item.student} batch={item.batch} /><div><strong className={matchColor(item.match_score)}>{score(item.match_score)}</strong><p className="pl-muted">{item.match_score < 60 ? 'Low match · review carefully' : 'Hybrid match'}{item.distance_km != null ? ` · ${item.distance_km} km` : ''}</p><p className="pl-muted">Position rank #{position.suggested_students.filter(actionable).findIndex(row => row.recommendation_id === item.recommendation_id) + 1}{role === 'instructor' ? ' · your roster' : ''}</p><p className="pl-muted">{students.find(row => row.student.id === item.student.id)?.proposal && `Suggested: ${students.find(row => row.student.id === item.student.id).proposal.position}`}</p></div><button className="pl-button pl-primary" onClick={() => { setReviewId(item.recommendation_id); setError('') }}>Review candidate</button></div>)}
        {!candidates.length && <Empty>{!draft?.generated && view === 'proposed' ? 'Suggestions are being prepared. You can also review other ranked candidates.' : 'No students match this view and scope.'}</Empty>}<Pager rows={candidates} page={page} onPage={setPage} />
      </section></div>}
    </>}</DataSection>}
    {tab === 'awaiting' && <DataSection url={DRAFT_URL} layout="table"><p className="pl-muted">Students remain available for future seats and opportunities. Awaiting allocation is not a rejection.</p>{slice(awaiting, page).map(item => <article className="pl-awaiting" key={item.student.id}><Identity student={item.student} batch={item.batch} /><span className="pl-status">{STATUS[item.status]}</span><div className="pl-alternatives">{item.alternatives.slice(0, 3).map((option, index) => <button className="pl-alternative" key={option.id} onClick={() => setReviewId(option.id)}><strong>#{index + 1} · {option.position}</strong><span>{option.company} · {score(option.match_score)}</span></button>)}</div></article>)}{!awaiting.length && <Empty>No students awaiting allocation match these filters.</Empty>}<Pager rows={awaiting} page={page} onPage={setPage} /></DataSection>}
    {tab === 'history' && <DataSection url={data.historyUrl} layout="table"><p className="pl-muted">{data.historyCount} decisions · Recorded scores are historical snapshots.</p><div className="pl-history">{data.placements.map(item => <article className="pl-history-row" key={item.id}><Identity student={item.student} batch={item.batch} /><div><strong>{item.position.title}</strong><p className="pl-muted">{item.company.name}</p></div><div><span className="pl-status">{STATUS[item.status] || item.status}</span><p>{item.match_score_at_assignment == null ? 'Manual / no score' : score(item.match_score_at_assignment)}</p></div><div><p>{date(item.updated_at)}</p><p className="pl-muted">{historyActor(item)}</p></div><details><summary>Decision details</summary><p>{item.remarks || 'No remarks recorded.'}</p><p>Category fit: {score(item.category_score_component_at_assignment)}</p><p>NLP fit: {score(item.nlp_score_component_at_assignment)}</p><p>Location fit: {score(item.location_score_component_at_assignment)}</p><p>Distance: {item.distance_km_at_assignment == null ? 'Not recorded' : `${item.distance_km_at_assignment} km`}</p></details></article>)}</div>{!data.placements.length && <Empty>No decisions match these filters.</Empty>}<Pagination total={data.historyCount} page={historyPage} pageSize={10} onPage={setHistoryPage} /></DataSection>}

    {review && <DialogShell title="Review suggested placement" description="Review evidence, alternatives and capacity before deciding." size="placement" onClose={() => setReviewId(null)} closeLabel="Close candidate review" footer={<div className="pl-dialog-actions"><button className="pl-button" onClick={() => setReviewId(null)}>Close</button><button className="pl-button pl-danger" disabled={!actionable(review.suggestion)} onClick={() => setAction({ ...review, type: 'reject' })}>Decline suggestion</button><button className="pl-button pl-primary" disabled={!actionable(review.suggestion) || review.position.remaining_slots <= 0 || draft?.stale || data.syncing || data.mutating} onClick={() => setAction({ ...review, type: 'approve' })}>Approve placement</button></div>}><div className="pl-dialog-body"><Identity student={review.suggestion.student} batch={review.suggestion.batch} /><div className="pl-target"><h3>{review.position.title}</h3><p>{review.company.name}</p><Capacity position={review.position} held={counts[review.position.id] || 0} /><p className="pl-muted">{reviewing?.proposal?.id === reviewId ? 'Current suggested position' : 'Alternative / ranked candidate'}{reviewing?.coordinator_choice ? ' · Coordinator chosen' : ''}</p></div>{review.suggestion.match_score < 60 && <p className="pl-notice">Low match. Review the evidence and alternatives carefully; this is not an automatic rejection.</p>}{draft?.stale && <p className="pl-notice">The shared suggestions need updating before approval.</p>}<div className="pl-score-grid">{[['Hybrid match', review.suggestion.match_score], ['Category fit', review.suggestion.category_score_component], ['NLP fit', review.suggestion.nlp_score_component], ['Location fit', review.suggestion.location_score_component]].map(([label, value]) => <div key={label}><strong>{score(value)}</strong><ScoreLabel label={label} /></div>)}</div><p className="pl-muted">Scores support your judgment; they do not guarantee suitability.</p>{reviewing?.proposal && reviewing.alternatives[0]?.id !== reviewing.proposal.id && <p className="pl-notice">Highest match: {reviewing.alternatives[0]?.position} at {reviewing.alternatives[0]?.company} ({score(reviewing.alternatives[0]?.match_score)}). The proposed placement balances shared seats and other students’ alternatives, or reflects a coordinator choice.</p>}<details className="pl-more"><summary>Position requirements and tags</summary><p className="pl-muted">Role requirements and descriptive tags; these are not independently assessed student skills.</p><p>{reviewing?.alternatives.find(item => item.id === reviewId)?.tags?.join(', ') || 'Not available for this suggestion.'}</p></details><h3 className="pl-subheading">Top three position matches</h3>{reviewing?.proposal && <p className="pl-muted">Current suggestion: {reviewing.proposal.position} at {reviewing.proposal.company} ({score(reviewing.proposal.match_score)}).</p>}<p className="pl-muted">Alternatives reserve no seats. Shared allocation considers other students and available capacity.</p><div className="pl-alternatives">{reviewing?.alternatives.slice(0, 3).map(alternative)}</div>{reviewing?.alternatives.length > 3 && <details className="pl-more"><summary>All other matches ({reviewing.alternatives.length - 3})</summary>{reviewing.alternatives.slice(3).map(option => alternative(option))}</details>}{error && <p role="alert" className="pl-error">{error}</p>}</div></DialogShell>}
    {liveAction && <ActionModal key={`${liveAction.type}-${liveAction.suggestion.recommendation_id || liveAction.suggestion.placement_id}`} action={liveAction} busy={data.mutating || data.syncing} onClose={() => setAction(null)} onSubmit={decide} />}
    {manual && <ManualAssignmentModal students={data.students} positions={data.positions} approvedByStudent={approvedByStudent} initialPositionId={manual.positionId} busy={data.mutating || data.syncing} onClose={() => setManual(null)} onSubmit={data.manualAssign} />}

  </section>
}
