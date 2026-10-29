import { CollectionSkeleton } from '../../components/loading/Skeletons'
import { useToast } from '../../context/ToastContext'
import { lazy, Suspense, useMemo, useRef, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import api from '../../api/axios'
import { invalidateCache, useApi } from '../../hooks/useApi'
import DataSection from '../../components/DataSection'
import DialogShell from '../../components/DialogShell'
import BatchCyclePanel from '../../components/BatchCyclePanel'
import StudentTransferAction from '../../components/StudentTransferAction'
import ActionMenu from '../../components/ActionMenu'
import { BatchEmailProgress } from '../../components/enrollment/EmailProgress'
import ConfirmModal from '../../components/admin/ConfirmModal'
import Pagination from '../../components/Pagination'
import CollectionViewToggle from '../../components/CollectionViewToggle'
import { BatchCollection, BatchStatus, BatchStudentCollection, CollectionRange } from '../../components/admin/BatchCollections'
import StudentEnrollmentModal from '../../components/enrollment/StudentEnrollmentModal'
const EnrollmentEmails = lazy(() => import('../../components/enrollment/EnrollmentEmails'))
import PreviouslyUnenrolled, { EnrollmentRecoveryFilters } from '../../components/enrollment/EnrollmentRecovery'
import { matchesAccount } from '../../utils/studentAccount'
import StudentModal from '../../components/instructor/StudentModal'
import { normalizeStudent } from '../../utils/managementStudent'
import { requestErrorMessage } from '../../api/requestErrors'
import { assessmentRetakeCandidate } from '../../utils/assessmentManagement'
import { ArchiveIcon, ChevronRightIcon, MailIcon, MoreHorizontalIcon, PencilIcon, PlusIcon, ReportIcon, SearchIcon, UsersIcon } from '../../components/Icons'

const BATCHES = '/api/instructor/batches/'
const OWNERS = '/api/admin/batch-instructors/'
const SkillLeaderboardModal = lazy(() => import('../../components/instructor/SkillLeaderboardModal'))
const field = 'min-h-11 w-full min-w-0 rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs focus-visible:outline-2 focus-visible:outline-green-600 dark:border-gray-700 dark:bg-gray-800'
const button = 'inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-gray-200 px-3 py-2 text-xs font-semibold hover:bg-green-50 focus-visible:outline-2 focus-visible:outline-green-600 disabled:opacity-50 dark:border-gray-700 dark:hover:bg-green-950'
const surface = 'rounded-2xl border border-gray-100 bg-white dark:border-gray-800 dark:bg-gray-900'

function BatchEditor({ batch, owners, onClose, onSaved }) {
  const { showToast } = useToast()
  const [name, setName] = useState(batch?.name || '')
  const [owner, setOwner] = useState(String(batch?.instructor_id || ''))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [review, setReview] = useState(false)
  const [discard, setDiscard] = useState(false)
  const pending = useRef(false)
  const changed = name !== (batch?.name || '') || owner !== String(batch?.instructor_id || '')
  function close() { if (!pending.current) { if (changed) setDiscard(true); else onClose() } }
  function prepare(event) {
    event.preventDefault()
    if (!name.trim() || name.trim().length > 100 || !owner) { setError('Enter a batch name and choose an instructor.'); return }
    setReview(true)
  }
  async function save() {
    if (pending.current) return
    pending.current = true; setSaving(true); setError(''); setReview(false)
    try {
      const data = { name: name.trim(), ...(!batch || owner !== String(batch.instructor_id) ? { instructor_id: Number(owner) } : {}) }
      const result = batch ? await api.patch(`/api/admin/batches/${batch.id}/`, data) : await api.post(BATCHES, data)
      showToast(batch ? 'Batch updated successfully.' : 'Batch created successfully.')
      onSaved(result.data)
    } catch (failure) { const message = requestErrorMessage(failure, { mutation: true }); setError(message); showToast(message, 'error') }
    finally { pending.current = false; setSaving(false) }
  }
  return <DialogShell title={batch ? 'Manage batch' : 'Create batch'} description="Choose the instructor responsible for the selected students." onClose={close} size="confirm" footer={<div className="flex gap-2"><button className={button} disabled={saving} onClick={close}>Cancel</button><button className={`${button} bg-green-700 text-white hover:bg-green-800`} disabled={saving || !changed} form="batch-editor" type="submit">{saving ? 'Saving…' : 'Review batch changes'}</button></div>}>
    <form id="batch-editor" onSubmit={prepare} className="space-y-4 p-4 sm:p-5">
      <fieldset disabled={saving} className="space-y-4"><label className="block text-xs font-semibold">Batch name<input aria-label="Batch name" className={field} maxLength={100} value={name} onChange={event => setName(event.target.value)} /></label>
        <label className="block text-xs font-semibold">Responsible instructor<DataSection url={OWNERS} layout="control" count={1}><select aria-label="Responsible instructor" className={field} value={owner} onChange={event => setOwner(event.target.value)}><option value="">Select an instructor</option>{batch && !owners.some(person => person.id === batch.instructor_id) && <option value={batch.instructor_id} disabled>{batch.instructor_name} (current owner unavailable for new assignments)</option>}{owners.map(person => <option key={person.id} value={person.id}>{person.name}</option>)}</select></DataSection></label>
        {batch && <p className="text-xs text-gray-500">Reassignment transfers access to this batch, including its assessments and student history. Scores and placement snapshots are preserved.</p>}
      </fieldset>{error && <p role="alert" className="text-sm text-rose-700 dark:text-rose-300">{error}</p>}
    </form>
    {review && <ConfirmModal tone="confirm" title={batch ? 'Save batch ownership and name?' : 'Create this batch?'} message={batch ? `Save changes to ${batch.name}? ${owner !== String(batch.instructor_id) ? `${owners.find(person => String(person.id) === owner)?.name || 'The selected instructor'} will replace ${batch.instructor_name || 'the previous instructor'} as responsible instructor. The previous instructor loses batch access. ` : ''}Student memberships and recorded results stay with this batch.` : `Create ${name.trim()} with ${owners.find(person => String(person.id) === owner)?.name || 'the selected instructor'} as responsible instructor? Your admin account is recorded as its creator.`} confirmLabel="Save batch" onCancel={() => setReview(false)} onConfirm={save} />}
    {discard && <ConfirmModal title="Discard batch changes?" message="Your unsaved batch changes will be discarded." confirmLabel="Discard changes" onCancel={() => setDiscard(false)} onConfirm={onClose} />}
  </DialogShell>
}

export default function AdminBatches() {
  const emailLocation = useLocation()
  const { showToast } = useToast()
  const { data: batchData } = useApi(BATCHES)
  const { data: ownerData } = useApi(OWNERS)
  const batches = useMemo(() => batchData || [], [batchData])
  const owners = ownerData || []
  const [selectedId, setSelectedId] = useState(() => {
    const id = Number(new URLSearchParams(window.location.search).get('batch_id'))
    return Number.isSafeInteger(id) && id > 0 ? id : null
  })
  const [search, setSearch] = useState('')
  const [owner, setOwner] = useState('all')
  const [status, setStatus] = useState('all')
  const [view, setView] = useState('grid')
  const [page, setPage] = useState(1)
  const [studentPage, setStudentPage] = useState(1)
  const [studentSearch, setStudentSearch] = useState('')
  const [studentView, setStudentView] = useState('list')
  const [enrollment, setEnrollment] = useState('enrolled')
  const [accountStatus, setAccountStatus] = useState('all')
  const batchOpener = useRef(null)
  const batchHeading = useRef(null)
  const batchCollectionRef = useRef(null)
  const [editor, setEditor] = useState(null)
  const [enrolling, setEnrolling] = useState(false)
  const [showEmails, setShowEmails] = useState(false)
  const [closedEmailKey, setClosedEmailKey] = useState(null)
  const emailParams = new URLSearchParams(emailLocation.search)
  const routeEmailId = emailParams.get('emails') === '1' ? Number(emailParams.get('batch_id')) : null
  const emailRouteOpen = Number.isSafeInteger(routeEmailId) && routeEmailId > 0 && closedEmailKey !== emailLocation.key
  const [confirm, setConfirm] = useState(null)
  const [studentId, setStudentId] = useState(null)
  const [leaderCategory, setLeaderCategory] = useState('')
  const [busy, setBusy] = useState(false)
  const pending = useRef(false)
  const [feedback, setFeedback] = useState(null)
  const [showAudit, setShowAudit] = useState(false)
  const [auditPage, setAuditPage] = useState(1)
  const filtered = useMemo(() => batches.filter(batch =>
    `${batch.name} ${batch.instructor_name}`.toLowerCase().includes(search.trim().toLowerCase()) &&
    (owner === 'all' || String(batch.instructor_id) === owner) && (status === 'all' || batch.status === status)), [batches, search, owner, status])
  const visiblePage = Math.min(page, Math.ceil(filtered.length / 10) || 1)
  const records = filtered.slice((visiblePage - 1) * 10, visiblePage * 10)
  const selected = batches.find(batch => batch.id === selectedId)
  const rosterUrl = selected ? `${BATCHES}${selected.id}/students/` : null
  const { data: roster } = useApi(rosterUrl)
  const auditUrl = showAudit && selected ? `/api/admin/management-actions/?batch_id=${selected.id}&offset=${(auditPage - 1) * 50}` : null
  const { data: audit } = useApi(auditUrl)
  const students = useMemo(() => (roster?.students || []).map(normalizeStudent), [roster])
  const studentRows = students.filter(student => matchesAccount(student, accountStatus) && `${student.name} ${student.studentId} ${student.email}`.toLowerCase().includes(studentSearch.trim().toLowerCase()))
  const visibleStudentPage = Math.min(studentPage, Math.ceil(studentRows.length / 10) || 1)
  const currentStudent = students.find(student => student.id === studentId)
  const leaderboardStudents = students.map(student => ({ ...student,
    status: student.recommendationsLocked ? 'pending' : 'completed',
    scores: Object.fromEntries(student.combinedCategoryScores.map(score => [score.category, score.percentage])),
  }))
  const leaderCategories = [...new Set(leaderboardStudents.filter(student => student.status === 'completed').flatMap(student => Object.keys(student.scores)))].sort()
  function refresh() {
    [BATCHES, '/api/instructor/assessments/', '/api/admin/users/', '/api/admin/stats/', '/api/admin/management-actions/', rosterUrl, selected ? `${BATCHES}${selected.id}/unenrolled/` : null].filter(Boolean).forEach(invalidateCache)
  }
  function choose(batch, opener) { opener?.focus(); batchOpener.current = batch.id; setSelectedId(batch.id); setStudentId(null); setLeaderCategory(''); setStudentPage(1); setStudentSearch(''); setEnrollment('enrolled'); setAccountStatus('all'); setShowAudit(false); setAuditPage(1); setFeedback(null); requestAnimationFrame(() => { batchHeading.current?.focus({ preventScroll: true }); window.scrollTo({ top: 0, behavior: 'instant' }) }) }
  function backToBatches() { setSelectedId(null); setStudentId(null); setLeaderCategory(''); setShowAudit(false); setFeedback(null); requestAnimationFrame(() => [...(batchCollectionRef.current?.querySelectorAll(`[data-batch-id="${batchOpener.current}"]`) || [])].find(node => node.getClientRects().length)?.focus({ preventScroll: true })) }
  function openStudent(student, opener) { opener?.focus(); setStudentId(student.id) }
  async function mutate(endpoint, method = 'post', payload) {
    if (pending.current) return { ok: false, message: 'An action is already in progress.' }
    pending.current = true; setBusy(true); setFeedback(null)
    try {
      await api[method](endpoint, payload)
      refresh(); setConfirm(null)
      setFeedback({ text: 'Changes saved.' })
      showToast('Batch changes saved successfully.')
      return { ok: true }
    } catch (error) {
      const message = requestErrorMessage(error, { mutation: true })
      setFeedback({ text: message, error: true })
      showToast(message, 'error')
      return { ok: false, message }
    } finally { pending.current = false; setBusy(false) }
  }
  function retake(id, assessmentId) {
    const attempt = assessmentRetakeCandidate(students.find(student => student.id === id), assessmentId)
    if (attempt) return mutate(`/api/instructor/students/${id}/retake/`, 'patch', { assessment_id: assessmentId, retake_allowed: !attempt.retake_allowed })
  }
  const ownerOptions = [...new Map(batches.map(batch => [batch.instructor_id, batch.instructor_name])).entries()]
  return <div className="admin-batches mx-auto max-w-7xl space-y-6 px-4 py-6 sm:px-6 sm:py-8">
    {!selected ? <>
      <header className="flex flex-wrap items-start justify-between gap-3"><div><h1 className="text-xl font-bold">Batches & students</h1><p className="mt-1 text-xs text-gray-500 dark:text-gray-400">Manage batches, instructors and student enrollment.</p></div><button className={`${button} border-green-700 bg-green-700 text-white hover:bg-green-800`} onClick={() => setEditor({ create: true })}><PlusIcon size={15} />Create batch</button></header>
      <section ref={batchCollectionRef} aria-label="Batch collection" className="space-y-5">
        <div className={`${surface} grid gap-4 p-4 sm:grid-cols-[1.2fr_1fr_1fr] sm:p-5`}>
          <label className="min-w-0 text-xs font-medium text-gray-600 dark:text-gray-300">Search batches<span className="relative mt-2 block"><span aria-hidden="true" className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-gray-400"><SearchIcon size={16} /></span><input aria-label="Search batches" placeholder="Search batch or instructor…" className={`${field} pl-9`} value={search} onChange={event => { setSearch(event.target.value); setPage(1) }} /></span></label>
          <label className="min-w-0 text-xs font-medium text-gray-600 dark:text-gray-300">Instructor<select aria-label="Filter batches by instructor" className={`${field} mt-2`} value={owner} onChange={event => { setOwner(event.target.value); setPage(1) }}><option value="all">All instructors</option>{ownerOptions.map(([id, name]) => <option key={id} value={id}>{name || 'Instructor not assigned'}</option>)}</select></label>
          <label className="min-w-0 text-xs font-medium text-gray-600 dark:text-gray-300">Status<select aria-label="Filter batches by status" className={`${field} mt-2`} value={status} onChange={event => { setStatus(event.target.value); setPage(1) }}><option value="all">All statuses</option><option value="active">Active</option><option value="archived">Archived</option></select></label>
        </div>
        <div className="flex items-center justify-between gap-3"><p className="text-xs text-gray-500 dark:text-gray-400" aria-live="polite">{batchData == null ? 'Loading batches…' : `${filtered.length} ${filtered.length === 1 ? 'batch' : 'batches'}`}</p><CollectionViewToggle view={view} onChange={setView} label="Batch view" /></div>
        <DataSection url={BATCHES} skeleton={<CollectionSkeleton kind="batch" view={view} />} >
          {!records.length ? <div className={`${surface} py-12 text-center`}><p className="text-sm font-medium">{batches.length ? 'No batches match your filters.' : 'No batches yet'}</p><p className="mt-2 text-xs text-gray-500 dark:text-gray-400">{batches.length ? 'Try another search or clear your filters.' : 'Create a batch and select its responsible instructor to begin.'}</p>{batches.length > 0 && <button className="mt-3 min-h-11 text-xs font-semibold text-green-700 dark:text-green-300" onClick={() => { setSearch(''); setOwner('all'); setStatus('all'); setPage(1) }}>Clear filters</button>}</div> : <BatchCollection records={records} view={view} onOpen={choose} />}
          <CollectionRange total={filtered.length} page={visiblePage} onPage={setPage} noun="batches" />
        </DataSection>
        {!!records.length && <p className="text-xs text-gray-500 dark:text-gray-400">Select a batch to view its students.</p>}
      </section>
    </> : <>
      <nav aria-label="Batch navigation" className="flex flex-wrap items-center gap-3 text-xs"><button disabled={busy} className="inline-flex min-h-11 items-center gap-2 font-medium text-green-800 dark:text-green-300" onClick={backToBatches}><span aria-hidden="true" className="rotate-180"><ChevronRightIcon size={16} /></span>Back to batches</button><span aria-hidden="true" className="text-gray-300">/</span><span className="text-gray-500 dark:text-gray-400">Batches & students</span><span aria-hidden="true" className="text-gray-300">/</span><span className="break-words font-medium">{selected.name}</span></nav>
      <section className={`${surface} p-5 sm:p-6`} aria-label="Selected batch">
        <header className="flex flex-wrap items-start justify-between gap-5"><div className="flex min-w-0 items-start gap-3"><span className="batch-symbol h-12 w-12" aria-hidden="true"><UsersIcon size={23} /></span><div className="min-w-0"><div className="flex flex-wrap items-center gap-3"><h1 ref={batchHeading} tabIndex={-1} className="break-words text-xl font-bold outline-none">{selected.name}</h1><BatchStatus status={selected.status} /></div><p className="mt-2 text-xs text-gray-500 dark:text-gray-400">Responsible instructor · {selected.instructor_name || 'Instructor not assigned'}</p><p className="mt-3 text-xs text-gray-500 dark:text-gray-400">{selected.student_count ?? 0} students</p></div></div>
        <div className="flex flex-wrap gap-2">
          {selected.status === 'active' && <StudentTransferAction key={`transfer-${selected.id}`} batchId={selected.id} batchName={selected.name} />}
          <button className={button} onClick={() => setShowEmails(true)}><MailIcon size={16} />Enrollment emails</button>
          {selected.status === 'active' && <><Link className={button} to={`/admin/assessment/create?batch_id=${selected.id}`}><PlusIcon size={14} />New assessment</Link><button className={`${button} border-green-700 bg-green-700 text-white hover:bg-green-800`} disabled={busy} onClick={() => setEnrolling(true)}><PlusIcon size={14} />Enroll students</button></>}
          <ActionMenu label="Batch actions" className={button} disabled={busy} items={[
            { id: 'manage', label: 'Manage batch', icon: <PencilIcon size={14} /> },
            { id: 'status', label: selected.status === 'active' ? 'Archive batch' : 'Reactivate batch', icon: <ArchiveIcon size={14} />, danger: selected.status === 'active' },
          ]} onAction={action => action === 'manage' ? setEditor({ batch: selected }) : setConfirm({ type: selected.status === 'active' ? 'archive' : 'unarchive' })}><MoreHorizontalIcon /></ActionMenu>
        </div></header>
        <div className="mt-4"><BatchEmailProgress key={selected.id} batchId={selected.id} onView={() => setShowEmails(true)} /></div>
        {selected.status === 'archived' && <p className="mt-4 rounded-xl bg-amber-50 p-3 text-xs text-amber-900 dark:bg-amber-950 dark:text-amber-200">This batch is archived. Student assessment availability and final recommendations are locked. Reactivate it before enrolling students or starting assessments.</p>}
      </section>
      <BatchCyclePanel key={`cycle-${selected.id}`} batchId={selected.id} role="admin" />
      <section className={`${surface} space-y-5 p-4 sm:p-6`} aria-label="Batch students">
        {feedback && <p role={feedback.error ? 'alert' : 'status'} className={`rounded-lg p-3 text-xs ${feedback.error ? 'bg-rose-50 text-rose-700 dark:bg-rose-950 dark:text-rose-300' : 'bg-green-50 text-green-800 dark:bg-green-950 dark:text-green-300'}`}>{feedback.text}</p>}
        <header className="flex items-start justify-between gap-3"><div><h2 className="text-lg font-semibold">Students <span className="ml-2 text-xs font-normal text-gray-500 dark:text-gray-400">{students.length} enrolled</span></h2><p className="mt-1 text-xs text-gray-500 dark:text-gray-400">Required assessment progress for this batch. Select a student for results, history and retake management.</p></div><CollectionViewToggle view={studentView} onChange={setStudentView} label="Batch student view" /></header>
        <div className="grid items-end gap-4 md:grid-cols-[1.2fr_1fr_auto]"><label className="min-w-0 text-xs font-medium text-gray-600 dark:text-gray-300">Search students<span className="relative mt-2 block"><span aria-hidden="true" className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-gray-400"><SearchIcon size={16} /></span><input aria-label="Search batch students" className={`${field} pl-9`} placeholder="Name, ID or email…" value={studentSearch} onChange={event => { setStudentSearch(event.target.value); setStudentPage(1) }} /></span></label>
        <label className="min-w-0 text-xs font-medium text-gray-600 dark:text-gray-300">Skill leaderboard<select aria-label="Open skill leaderboard" className={`${field} mt-2`} value={leaderCategory} onChange={event => setLeaderCategory(event.target.value)} disabled={!leaderCategories.length}><option value="">{leaderCategories.length ? 'Choose a combined skill category' : 'No unlocked combined competency available'}</option>{leaderCategories.map(category => <option key={category} value={category}>{category}</option>)}</select></label>
        <button className="inline-flex min-h-11 items-center gap-2 text-xs font-medium text-green-800 underline underline-offset-4 dark:text-green-300" aria-expanded={showAudit} onClick={() => setShowAudit(value => !value)}><ReportIcon size={16} />{showAudit ? 'Hide action history' : 'View action history'}</button></div>
        <EnrollmentRecoveryFilters enrollment={enrollment} onEnrollment={value => { setEnrollment(value); setStudentPage(1) }} account={accountStatus} onAccount={value => { setAccountStatus(value); setStudentPage(1) }} />
        {enrollment === 'unenrolled' ? <PreviouslyUnenrolled key={selected.id} batch={selected} search={studentSearch} account={accountStatus} view={studentView} onChanged={refresh} /> : <DataSection url={rosterUrl} skeleton={<CollectionSkeleton kind="batch-student" view={studentView} />} >
          {studentSearch && <p className="mb-3 text-xs text-gray-500 dark:text-gray-400" role="status">{studentRows.length} matching students</p>}
          <BatchStudentCollection students={studentRows.slice((visibleStudentPage - 1) * 10, visibleStudentPage * 10)} view={studentView} busy={busy} onOpen={openStudent} onUnenroll={selected.status === 'active' ? student => setConfirm({ type: 'unenroll', student }) : undefined} />
          {!studentRows.length && <p className="py-8 text-center text-xs text-gray-500 dark:text-gray-400">{students.length ? 'No students match your search.' : 'No students enrolled in this batch.'}</p>}
          <CollectionRange total={studentRows.length} page={visibleStudentPage} onPage={setStudentPage} noun="students" />
        </DataSection>}
        {showAudit && <section aria-label="Batch action history" className="border-t border-gray-100 pt-4 dark:border-gray-800"><h3 className="mb-3 text-sm font-semibold">Action history</h3><DataSection url={auditUrl} layout="timeline" label="Loading batch action history"><ol className="space-y-3 text-xs">{audit?.results.map(row => <li key={row.id} className="border-t border-gray-100 pt-3 dark:border-gray-800"><strong>{row.action}</strong> · {row.actor_name}<p className="mt-1 text-gray-500 dark:text-gray-400">{new Date(row.created_at).toLocaleString('en-PH', { timeZone: 'Asia/Manila' })} · {row.target_type} #{row.target_id}</p></li>)}</ol>{audit?.count === 0 && <p className="text-xs text-gray-500 dark:text-gray-400">No recorded actions yet. Historical actions before this feature are not backfilled.</p>}<Pagination total={audit?.count || 0} page={auditPage} onPage={setAuditPage} pageSize={50} /></DataSection></section>}
      </section>
    </>}
    {editor && <BatchEditor batch={editor.batch} owners={owners} onClose={() => setEditor(null)} onSaved={batch => { refresh(); setSelectedId(batch.id); setEditor(null); setFeedback({ text: 'Batch saved.' }) }} />}
    {(showEmails || emailRouteOpen) && (emailRouteOpen || selected) && <Suspense fallback={<p role="status">Loading enrollment emails…</p>}><EnrollmentEmails initialGroupId={emailRouteOpen ? emailParams.get('email_group') : undefined} key={emailRouteOpen ? routeEmailId : selected.id} batchId={emailRouteOpen ? routeEmailId : selected.id} onClose={() => { setShowEmails(false); setClosedEmailKey(emailLocation.key) }} /></Suspense>}
    {selected && enrolling && <StudentEnrollmentModal requireConfirmation batchId={selected.id} onClose={() => setEnrolling(false)} onEnrolled={refresh} />}
    {selected && currentStudent && <StudentModal student={{ ...currentStudent, batchLabel: selected.name }} instructorName={selected.instructor_name} isArchived={selected.status === 'archived'} onClose={() => setStudentId(null)} onToggleRetake={retake} />}
    {selected && leaderCategory && <Suspense fallback={<p role="status">Loading skill leaderboard…</p>}><SkillLeaderboardModal skill={{ category: leaderCategory }} allStudents={leaderboardStudents} onClose={() => setLeaderCategory('')} onSelectStudent={student => { setLeaderCategory(''); setStudentId(student.id) }} /></Suspense>}
    {selected && confirm && <ConfirmModal title={confirm.type === 'unenroll' ? 'Unenroll from this batch?' : confirm.type === 'archive' ? 'Archive this batch?' : 'Reactivate this batch?'} message={confirm.type === 'unenroll' ? `Unenroll ${confirm.student.name} from ${selected.name}? Their account, assessment results, retake history and placement history will be preserved. Access to this batch's assessments and current recommendations will be removed. Other batch memberships remain unchanged.` : `${confirm.type === 'archive' ? 'Archive' : 'Reactivate'} ${selected.name}? This changes assessment availability and final recommendation access for its students. Existing memberships, results and history are preserved.`} confirmLabel={confirm.type === 'unenroll' ? 'Unenroll student' : confirm.type === 'archive' ? 'Archive batch' : 'Reactivate batch'} tone={confirm.type === 'unarchive' ? 'confirm' : 'danger'} onCancel={() => setConfirm(null)} onConfirm={() => confirm.type === 'unenroll' ? mutate(`/api/instructor/students/${confirm.student.id}/?batch_id=${selected.id}`, 'delete') : mutate(`${BATCHES}${selected.id}/${confirm.type}/`)} />}
  </div>
}
