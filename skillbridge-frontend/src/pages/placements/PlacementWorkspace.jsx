import { useMemo, useRef, useState } from 'react'
import DialogShell from '../../components/DialogShell'
import DataSection from '../../components/DataSection'
import PageHeader from '../../components/PageHeader'
import ScoreLabel from '../../components/ScoreLabel'
import PlacementReportPanel from '../../components/placements/PlacementReportPanel'
import { ActionModal, ManualAssignmentModal } from './PlacementDialogs'
import PositionReviewWorkspace, { CANDIDATE_PAGE_SIZE } from './PositionReviewWorkspace'
import { AllocationDetails, AwaitingAllocationList, CollectionPagination, CompanyOverviewCard, DecisionDetails, DecisionHistory, PlacementIdentity as Identity } from './PlacementCollections'
import { BriefcaseIcon, CheckCircleIcon, RefreshIcon, ReportIcon, SearchIcon, UserIcon, WarnIcon } from '../../components/Icons'
import { DRAFT_URL, usePlacements } from '../../hooks/usePlacements'
import './placements.css'
import './positionReview.css'

const SUGGESTIONS = '/api/placements/suggestions/?include_history=true&include_placed=true'
const STATUS = { proposed: 'Suggested', awaiting_draft: 'Preparing suggestions', awaiting_capacity: 'Awaiting a slot', awaiting_update: 'Updating suggestions', coordinator_review: 'Coordinator choice needs review', results_locked: 'Results incomplete or stale', no_current_matches: 'No current matches', suggestions_declined: 'Available suggestions declined', approved: 'Approved', rejected: 'Declined suggestion', removed: 'Removed', suggested: 'Suggested' }
const score = value => value == null ? 'Not available' : `${value}%`
const address = value => typeof value === 'string' ? value : [value?.city, value?.municipality, value?.province].filter(Boolean).join(', ')
const actionable = item => ['unplaced', 'suggested'].includes(item.placement_status)
function Capacity({ position, held = 0 }) { return <p className="pl-capacity"><span>{position.slots_available} total</span><span>{position.approved_count} approved</span><span>{held} suggested</span><strong>{Math.max(0, position.remaining_slots - held)} available for suggestions</strong></p> }
function Empty({ children }) { return <p className="pl-empty">{children}</p> }
function Pager({ rows, page, onPage, noun }) { return <CollectionPagination total={rows.length} page={page} onPage={onPage} noun={noun} /> }
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
  const [awaitingId, setAwaitingId] = useState(null)
  const [decisionId, setDecisionId] = useState(null)
  const [action, setAction] = useState(null)
  const [manual, setManual] = useState(null)
  const [savingId, setSavingId] = useState(null)
  const busy = savingId !== null
  const [savedStudentId, setSavedStudentId] = useState(null)
  const [choiceRefreshError, setChoiceRefreshError] = useState(false)
  const [error, setError] = useState('')
  const pending = useRef(false)
  const refreshAttempt = useRef(0)
  const overviewScroll = useRef(0)
  const companyHeading = useRef(null)
  const companyTrigger = useRef(null)
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
  const rankByRecommendation = useMemo(() => new Map((position?.suggested_students || []).filter(actionable).map((item, index) => [item.recommendation_id, index + 1])), [position])
  const term = search.trim().toLowerCase()
  const matches = (...values) => !term || values.filter(Boolean).some(value => String(value).toLowerCase().includes(term))
  const historyMaxPage = Math.max(1, Math.ceil(data.historyCount / 10))
  if (data.historyReady && historyPage > historyMaxPage) setHistoryPage(historyMaxPage)
  function openCompany(co) {
    overviewScroll.current = window.scrollY
    companyTrigger.current = document.activeElement
    const matchingApproval = term && approved.find(item => item.company.id === co.id && matches(item.student.name, item.student.school_id))
    const target = (matchingApproval && co.positions.find(pos => pos.id === matchingApproval.position.id)) || (term && co.positions.find(pos => matches(pos.title) || pos.suggested_students.some(row => inScope(row) && matches(row.student.name, row.student.school_id)))) || co.positions.find(pos => visible.some(item => item.proposal?.position_id === pos.id)) || co.positions.find(pos => pos.remaining_slots > 0) || co.positions[0]
    const hasProposal = visible.some(item => item.proposal?.position_id === target?.id && matches(item.student.name, item.student.school_id, co.name, target?.title))
    setCompanyId(co.id); setPositionId(target?.id); setPage(1); setView(matchingApproval ? 'approved' : hasProposal ? 'proposed' : 'ranked')
    requestAnimationFrame(() => { companyHeading.current?.focus({ preventScroll: true }); companyHeading.current?.scrollIntoView({ block: 'start', behavior: 'instant' }) })
  }
  function backToCompanies() {
    setCompanyId(null); setPositionId(null)
    requestAnimationFrame(() => {
      const trigger = companyTrigger.current
      if (trigger?.isConnected) trigger.focus({ preventScroll: true })
      else [...document.querySelectorAll('button.pl-company')].find(node => node.getAttribute('aria-label') === trigger?.getAttribute('aria-label'))?.focus({ preventScroll: true })
      window.scrollTo({ top: overviewScroll.current, behavior: 'instant' })
    })
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
  const awaiting = visible.filter(item => !item.proposal && matches(item.student.name, item.student.school_id, item.student.student_id, item.batch?.name))
  const awaitingDetail = students.find(item => item.student.id === awaitingId && !item.proposal)
  const decisionDetail = data.placements.find(item => item.id === decisionId)
  const maxCompanyPage = Math.max(1, Math.ceil(companies.length / 10))
  if (data.suggestionsReady && companyPage > maxCompanyPage) setCompanyPage(maxCompanyPage)
  const maxPage = Math.max(1, Math.ceil((tab === 'awaiting' ? awaiting : candidates).length / (tab === 'awaiting' ? 10 : CANDIDATE_PAGE_SIZE)))
  if (data.suggestionsReady && draft && (tab === 'awaiting' || company) && page > maxPage) setPage(maxPage)
  const areas = [...new Set(data.companies.map(item => address(item.address)).filter(Boolean))].sort()
  function filter(setter, value) { setter(value); setPage(1); setCompanyPage(1); setHistoryPage(1) }
  function changeTab(value) { setTab(value); setCompanyId(null); setPositionId(null); setPage(1) }
  async function refreshChoice() {
    const attempt = ++refreshAttempt.current
    setChoiceRefreshError(false)
    const result = await data.refresh({ includeDraft: false, silentError: true })
    if (attempt === refreshAttempt.current) setChoiceRefreshError(!result.ok)
  }
  async function draftAction(payload) {
    if (pending.current) return
    pending.current = true; setSavingId(payload.recommendation_id); setError(''); setSavedStudentId(null)
    setChoiceRefreshError(false)
    ++refreshAttempt.current
    try {
      const result = await data.draftAction(payload)
      if (!result.ok) { setError(result.message || 'Suggestion update was not saved. Refresh before retrying.'); return }
      const proposal = result.data.students.find(item => item.student.id === payload.student_id)?.proposal
      // Follow the confirmed choice without reopening a dialog closed during save.
      setReviewId(current => current === reviewId ? (proposal?.id ?? current) : current)
      setSavedStudentId(payload.student_id)
      void refreshChoice()
    } catch { setError('The update could not be confirmed. Refresh before retrying.') }
    finally { pending.current = false; setSavingId(null) }
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
      <span>{target ? `${Math.max(0, target.remaining_slots - (counts[target.id] || 0))} available for suggestions · ${target.slots_available} total slots` : 'Capacity unavailable'}</span>
      {selected ? <span className="pl-status pl-current-suggestion">Current suggestion</span> : <button type="button" className="pl-button" aria-busy={savingId === option.id} disabled={busy || data.mutating || data.syncing || draft?.stale || !draft?.generated} onClick={() => draftAction({ action: 'choose', student_id: review.suggestion.student.id, recommendation_id: option.id, revision: draft.revision })}>{savingId === option.id ? 'Saving suggestion…' : 'Suggest this instead'}</button>}
    </div>
  }

  return <section className="pl-page">
    <PageHeader title="OJT Placement Management" subtitle={role === 'admin' ? 'Review suggested placements across active batches. You make the final decision.' : 'Review placements for your students. Partner slots are shared across all batches.'} action={<><button className="pl-button" aria-expanded={reports} onClick={() => setReports(value => !value)}><ReportIcon size={16} />Download reports</button><button className="pl-button" onClick={async () => { await data.synchronize(); await data.refresh() }} disabled={data.refreshing || data.syncing}><RefreshIcon size={16} />{data.refreshing || data.syncing ? 'Refreshing…' : 'Refresh suggestions'}</button></>} />
    {reports && <p className="pl-muted">Report filters are independent of the placement workspace. Downloads include recorded decisions and official capacity; provisional slots are not approved placements.</p>}
    {reports && <PlacementReportPanel companies={data.companies} positions={data.positions} placements={[...data.approvedPlacements, ...data.placements]} students={data.students} role={role} />}
    <DataSection urls={[SUGGESTIONS, DRAFT_URL]} layout="placement-stats" count={3}>
      <div className="pl-stats">{[[visible.length, 'Students awaiting placement', 'Current student scope', UserIcon], [approved.length, 'Approved placements', 'Current student scope', CheckCircleIcon], [data.stats.remaining, 'Slots not yet approved', 'All batches; includes suggested slots', BriefcaseIcon]].map((stat, index) => { const [value, label, note] = stat; const Icon = stat[3]; return <div key={label}><span className={`pl-stat-icon pl-stat-icon--${index}`} aria-hidden="true"><Icon size={25} /></span><div className="pl-stat-content"><p>{label}</p><strong>{value}</strong><span>{note}</span></div></div> })}</div>
      <p className="pl-muted pl-auto-status" role="status"><span className={`pl-sync-dot ${draft?.stale || data.syncError ? 'pl-sync-dot--warning' : ''}`} aria-hidden="true" />{data.syncing || !draft?.generated ? 'Updating suggestions…' : draft.stale ? 'Suggestions need updating.' : 'Suggestions updated automatically · Awaiting coordinator approval'}</p>
      {data.syncError && <p role="alert" className="pl-error">Could not update suggestions. {data.syncError} Use Refresh suggestions to retry.</p>}
    </DataSection>
    {error && <p role="alert" className="pl-error">{error}</p>}
    <nav className="pl-tabs pl-overview-tabs" aria-label="Placement views">{[['companies', 'Partners'], ['awaiting', 'Awaiting allocation'], ['history', 'Decision history']].map(([key, label]) => <button key={key} aria-label={key === 'awaiting' ? `${label} (${visible.filter(item => !item.proposal).length})` : label} aria-current={tab === key ? 'page' : undefined} onClick={() => changeTab(key)}>{label}{key === 'awaiting' && <span className="pl-tab-count">{visible.filter(item => !item.proposal).length}</span>}</button>)}</nav>
    <div className="pl-filters"><label className="pl-search">Search<span className="pl-search-control"><SearchIcon size={16} /><input type="search" value={search} onChange={event => filter(setSearch, event.target.value)} placeholder="Partner, position, student or school ID" /></span></label><label>Student scope<select aria-label="Student scope" value={batch} onChange={event => filter(setBatch, event.target.value)}><option value="">{role === 'admin' ? 'All authorized batches' : 'My batches'}</option>{batches.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
      {tab === 'companies' && !company && <><label>Partner area<select value={area} onChange={event => filter(setArea, event.target.value)}><option value="">All areas</option>{areas.map(item => <option key={item}>{item}</option>)}</select></label><label>Suggestion availability<select value={availability} onChange={event => filter(setAvailability, event.target.value)}><option value="all">All partners</option><option value="open">Available suggestion slots</option><option value="full">No available suggestion slots</option></select></label></>}
      {tab === 'history' && <label>Decision<select aria-label="Decision" value={historyStatus} onChange={event => filter(setHistoryStatus, event.target.value)}><option value="">All decisions</option>{['approved', 'rejected', 'removed', 'suggested'].map(item => <option key={item} value={item}>{STATUS[item]}</option>)}</select></label>}
      {(search || batch || area || availability !== 'all' || historyStatus) && <button className="pl-button" onClick={() => { setSearch(''); setBatch(''); setArea(''); setAvailability('all'); setHistoryStatus(''); setPage(1); setCompanyPage(1); setHistoryPage(1) }}>Clear filters</button>}
    </div>
    {tab === 'companies' && <DataSection urls={[SUGGESTIONS, DRAFT_URL]} layout={company ? 'position-review' : 'placement-company-cards'} columns={2}>{!company ? <>
      <div className="pl-section-heading"><p><strong>{companies.length} partners</strong><span className="pl-muted"> · Open a partner to review its positions</span></p><p className="pl-muted pl-snapshot-note"><WarnIcon size={16} />Suggested slots await approval.</p><button className="pl-button" onClick={() => setManual({})} disabled={!data.students.length}><UserIcon size={16} />Manual assignment</button></div>
      <div className="pl-company-grid">{slice(companies, companyPage).map(co => <CompanyOverviewCard key={co.id} company={co} counts={counts} suggestedInScope={visible.filter(item => item.proposal?.company_id === co.id).length} address={address(co.address)} onOpen={openCompany} />)}</div>
      {!companies.length && <Empty>No partners match these filters.</Empty>}<Pager rows={companies} page={companyPage} onPage={setCompanyPage} noun="partners" />
    </> : <PositionReviewWorkspace company={company} position={position} counts={counts} proposed={proposed} ranked={ranked} approved={approvedHere}
      candidates={candidates} students={students} rankByRecommendation={rankByRecommendation} view={view} page={page} onPage={setPage}
      onView={next => { setView(next); setPage(1) }} onPosition={id => { setPositionId(id); setPage(1) }}
      onReview={id => { setReviewId(id); setError('') }} onRemove={removeRecord} onManual={id => setManual({ positionId: id })}
      onBack={backToCompanies} address={address(company.address)} generated={draft?.generated} role={role} companyHeadingRef={companyHeading} />}</DataSection>}
    {tab === 'awaiting' && <DataSection url={DRAFT_URL} layout="allocation"><AwaitingAllocationList rows={awaiting} page={page} onPage={setPage} onOpen={setAwaitingId} filtered={Boolean(search || batch)} /></DataSection>}
    {tab === 'history' && <DataSection url={data.historyUrl} layout="table"><DecisionHistory rows={data.placements} total={data.historyCount} page={historyPage} onPage={setHistoryPage} onOpen={setDecisionId} filtered={Boolean(search || batch || historyStatus)} /></DataSection>}

    {awaitingDetail && <AllocationDetails item={awaitingDetail} role={role} onClose={() => setAwaitingId(null)} onReview={setReviewId} />}
    {decisionDetail && <DecisionDetails item={decisionDetail} onClose={() => setDecisionId(null)} />}

    {review && <DialogShell title="Review suggested placement" description="Review evidence, alternatives and capacity before deciding." size="placement" onClose={() => setReviewId(null)} closeLabel="Close candidate review" footer={<div className="pl-dialog-actions"><button className="pl-button" onClick={() => setReviewId(null)}>Close</button><button className="pl-button pl-danger" disabled={busy || data.mutating || data.syncing || !actionable(review.suggestion)} onClick={() => setAction({ ...review, type: 'reject' })}>Decline suggestion</button><button className="pl-button pl-primary" disabled={busy || !actionable(review.suggestion) || review.position.remaining_slots <= 0 || draft?.stale || data.syncing || data.mutating} onClick={() => setAction({ ...review, type: 'approve' })}>Approve placement</button></div>}><div className="pl-dialog-body">{savedStudentId === review.suggestion.student.id && (choiceRefreshError ? <div role="alert" className="pl-notice"><p>Suggestion saved, but related placement data could not refresh. Retry the refresh; you do not need to submit the choice again.</p><button type="button" className="pl-button" disabled={data.refreshing} onClick={refreshChoice}>{data.refreshing ? 'Refreshing…' : 'Retry refresh'}</button></div> : <p role="status" className="pl-notice">Suggestion saved. Review the updated position before approving.</p>)}<Identity student={review.suggestion.student} batch={review.suggestion.batch} /><div className="pl-target"><h3>{review.position.title}</h3><p>{review.company.name}</p><Capacity position={review.position} held={counts[review.position.id] || 0} /><p className="pl-muted">{reviewing?.proposal?.id === reviewId ? 'Current suggested position' : 'Alternative / ranked candidate'}{reviewing?.coordinator_choice ? ' · Coordinator chosen' : ''}</p></div>{review.suggestion.match_score < 60 && <p className="pl-notice">Low match. Review the evidence and alternatives carefully; this is not an automatic rejection.</p>}{draft?.stale && <p className="pl-notice">The shared suggestions need updating before approval.</p>}<div className="pl-score-grid">{[['Hybrid match', review.suggestion.match_score], ['Category fit', review.suggestion.category_score_component], ['NLP fit', review.suggestion.nlp_score_component], ['Location fit', review.suggestion.location_score_component]].map(([label, value]) => <div key={label}><strong>{score(value)}</strong><ScoreLabel label={label} /></div>)}</div><p className="pl-muted">Scores support your judgment; they do not guarantee suitability.</p>{reviewing?.proposal && reviewing.alternatives[0]?.id !== reviewing.proposal.id && <p className="pl-notice">Highest match: {reviewing.alternatives[0]?.position} at {reviewing.alternatives[0]?.company} ({score(reviewing.alternatives[0]?.match_score)}). The proposed placement balances shared slots and other students’ alternatives, or reflects a coordinator choice.</p>}<details className="pl-more"><summary>Position requirements and tags</summary><p className="pl-muted">Role requirements and descriptive tags; these are not independently assessed student skills.</p><p>{reviewing?.alternatives.find(item => item.id === reviewId)?.tags?.join(', ') || 'Not available for this suggestion.'}</p></details><h3 className="pl-subheading">Top three position matches</h3>{reviewing?.proposal && <p className="pl-muted">Current suggestion: {reviewing.proposal.position} at {reviewing.proposal.company} ({score(reviewing.proposal.match_score)}).</p>}<p className="pl-muted">Alternatives reserve no slots. Shared allocation considers other students and available capacity.</p><div className="pl-alternatives">{reviewing?.alternatives.slice(0, 3).map(alternative)}</div>{reviewing?.alternatives.length > 3 && <details className="pl-more"><summary>All other matches ({reviewing.alternatives.length - 3})</summary>{reviewing.alternatives.slice(3).map(option => alternative(option))}</details>}{error && <p role="alert" className="pl-error">{error}</p>}</div></DialogShell>}
    {liveAction && <ActionModal key={`${liveAction.type}-${liveAction.suggestion.recommendation_id || liveAction.suggestion.placement_id}`} action={liveAction} busy={data.mutating || data.syncing} onClose={() => setAction(null)} onSubmit={decide} />}
    {manual && <ManualAssignmentModal students={data.students} positions={data.positions} approvedByStudent={approvedByStudent} initialPositionId={manual.positionId} busy={data.mutating || data.syncing} onClose={() => setManual(null)} onSubmit={data.manualAssign} />}

  </section>
}
