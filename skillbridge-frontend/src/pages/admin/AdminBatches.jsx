import { useToast } from '../../context/ToastContext'
import { lazy, Suspense, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import api from '../../api/axios'
import { invalidateCache, useApi } from '../../hooks/useApi'
import DataSection from '../../components/DataSection'
import DialogShell from '../../components/DialogShell'
import ConfirmModal from '../../components/admin/ConfirmModal'
import Pagination from '../../components/Pagination'
import StudentEnrollmentModal from '../../components/enrollment/StudentEnrollmentModal'
import StudentModal from '../../components/instructor/StudentModal'
import { normalizeStudent } from '../../utils/managementStudent'
import { requestErrorMessage } from '../../api/requestErrors'
import { assessmentRetakeCandidate } from '../../utils/assessmentManagement'
import { GridIcon, ListIcon } from '../../components/Icons'

const BATCHES = '/api/instructor/batches/'
const OWNERS = '/api/admin/batch-instructors/'
const SkillLeaderboardModal = lazy(() => import('../../components/instructor/SkillLeaderboardModal'))
const field = 'min-h-11 w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm focus-visible:outline-2 focus-visible:outline-green-600 dark:border-gray-700 dark:bg-gray-800'
const button = 'inline-flex min-h-11 items-center justify-center rounded-xl border border-gray-200 px-3 py-2 text-xs font-semibold hover:bg-green-50 focus-visible:outline-2 focus-visible:outline-green-600 disabled:opacity-50 dark:border-gray-700 dark:hover:bg-green-950'
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
  return <DialogShell title={batch ? 'Manage batch' : 'Create batch'} description="Choose the instructor responsible for this cohort." onClose={close} size="confirm" footer={<div className="flex gap-2"><button className={button} disabled={saving} onClick={close}>Cancel</button><button className={`${button} bg-green-700 text-white hover:bg-green-800`} disabled={saving || !changed} form="batch-editor" type="submit">{saving ? 'Saving…' : 'Review batch changes'}</button></div>}>
    <form id="batch-editor" onSubmit={prepare} className="space-y-4 p-4 sm:p-5">
      <fieldset disabled={saving} className="space-y-4"><label className="block text-xs font-semibold">Batch name<input aria-label="Batch name" className={field} maxLength={100} value={name} onChange={event => setName(event.target.value)} /></label>
        <DataSection url={OWNERS} layout="control" count={1}><label className="block text-xs font-semibold">Responsible instructor<select aria-label="Responsible instructor" className={field} value={owner} onChange={event => setOwner(event.target.value)}><option value="">Select an instructor</option>{batch && !owners.some(person => person.id === batch.instructor_id) && <option value={batch.instructor_id} disabled>{batch.instructor_name} (current owner unavailable for new assignments)</option>}{owners.map(person => <option key={person.id} value={person.id}>{person.name}</option>)}</select></label></DataSection>
        {batch && <p className="text-xs text-gray-500">Reassignment transfers access to this batch, including its assessments and student history. Scores and placement snapshots are preserved.</p>}
      </fieldset>{error && <p role="alert" className="text-sm text-rose-700 dark:text-rose-300">{error}</p>}
    </form>
    {review && <ConfirmModal tone="confirm" title={batch ? 'Save batch ownership and name?' : 'Create this batch?'} message={batch ? 'The selected instructor will manage this batch. The previous instructor loses batch access. Student memberships and recorded results stay with this batch.' : 'The selected instructor will manage the batch. Your admin account is recorded as its creator.'} confirmLabel="Save batch" onCancel={() => setReview(false)} onConfirm={save} />}
    {discard && <ConfirmModal title="Discard batch changes?" message="Your unsaved batch changes will be discarded." confirmLabel="Discard changes" onCancel={() => setDiscard(false)} onConfirm={onClose} />}
  </DialogShell>
}

export default function AdminBatches() {
  const { showToast } = useToast()
  const { data: batchData } = useApi(BATCHES)
  const { data: ownerData } = useApi(OWNERS)
  const batches = useMemo(() => batchData || [], [batchData])
  const owners = ownerData || []
  const [selectedId, setSelectedId] = useState(null)
  const [search, setSearch] = useState('')
  const [owner, setOwner] = useState('all')
  const [status, setStatus] = useState('all')
  const [view, setView] = useState('grid')
  const [page, setPage] = useState(1)
  const [studentPage, setStudentPage] = useState(1)
  const [studentSearch, setStudentSearch] = useState('')
  const [editor, setEditor] = useState(null)
  const [enrolling, setEnrolling] = useState(false)
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
  const students = (roster?.students || []).map(normalizeStudent)
  const studentRows = students.filter(student => `${student.name} ${student.studentId} ${student.email}`.toLowerCase().includes(studentSearch.trim().toLowerCase()))
  const visibleStudentPage = Math.min(studentPage, Math.ceil(studentRows.length / 10) || 1)
  const currentStudent = students.find(student => student.id === studentId)
  const leaderboardStudents = students.map(student => ({ ...student,
    status: student.recommendationsLocked ? 'pending' : 'completed',
    scores: Object.fromEntries(student.combinedCategoryScores.map(score => [score.category, score.percentage])),
  }))
  const leaderCategories = [...new Set(leaderboardStudents.filter(student => student.status === 'completed').flatMap(student => Object.keys(student.scores)))].sort()
  function refresh() {
    [BATCHES, '/api/instructor/assessments/', '/api/admin/users/', '/api/admin/stats/', '/api/admin/management-actions/', rosterUrl].filter(Boolean).forEach(invalidateCache)
  }
  function choose(batch) { setSelectedId(batch.id); setStudentId(null); setLeaderCategory(''); setStudentPage(1); setStudentSearch(''); setShowAudit(false); setAuditPage(1); setFeedback(null) }
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
  return <div className="mx-auto max-w-6xl space-y-6 px-4 py-6 sm:px-6 sm:py-8">
    <header className="flex flex-wrap items-start justify-between gap-3"><div><h1 className="text-xl font-bold">Batches & students</h1><p className="mt-1 text-sm text-gray-500">Manage cohorts, responsible instructors and batch enrollment.</p></div><button className={`${button} bg-green-700 text-white hover:bg-green-800`} onClick={() => setEditor({ create: true })}>Create batch</button></header>
    <section className={`${surface} space-y-4 p-4`} aria-label="Batch collection">
      <div className="grid gap-3 sm:grid-cols-3"><input aria-label="Search batches" placeholder="Search batch or instructor…" className={field} value={search} onChange={event => { setSearch(event.target.value); setPage(1) }} /><select aria-label="Filter batches by instructor" className={field} value={owner} onChange={event => { setOwner(event.target.value); setPage(1) }}><option value="all">All instructors</option>{ownerOptions.map(([id, name]) => <option key={id} value={id}>{name}</option>)}</select><select aria-label="Filter batches by status" className={field} value={status} onChange={event => { setStatus(event.target.value); setPage(1) }}><option value="all">All statuses</option><option value="active">Active</option><option value="archived">Archived</option></select></div>
      <div className="flex items-center justify-between gap-3"><p className="text-xs text-gray-500" aria-live="polite">{filtered.length} batches</p><div className="flex gap-1">{[['grid', 'Show batch cards'], ['list', 'Show batch list']].map(([value, label]) => <button key={value} className={button} aria-label={label} aria-pressed={view === value} onClick={() => setView(value)}>{value === 'grid' ? <GridIcon size={16} /> : <ListIcon size={16} />}</button>)}</div></div>
      <DataSection url={BATCHES} layout="cards">
        {!records.length ? <p className="py-8 text-center text-sm text-gray-500">{batches.length ? 'No batches match your filters.' : 'Create a batch and select its responsible instructor to begin.'}</p> : <><div className={`${view === 'list' ? 'grid sm:hidden' : 'grid'} gap-3 sm:grid-cols-2 lg:grid-cols-3` }>{records.map(batch => <button key={batch.id} className={`${surface} p-4 text-left transition-all hover:border-green-300 hover:shadow-md hover:ring-2 hover:ring-green-200 focus-visible:outline-2 focus-visible:outline-green-600 dark:hover:border-green-700 dark:hover:ring-green-900 ${selectedId === batch.id ? 'ring-2 ring-green-600' : ''}`} aria-pressed={selectedId === batch.id} onClick={() => choose(batch)}><h2 className="break-words text-sm font-semibold">{batch.name}</h2><p className="mt-1 break-words text-xs text-gray-500">{batch.instructor_name}</p><p className="mt-3 text-xs capitalize">{batch.status} · {batch.student_count} students</p>{!batch.created_by_id && <p className="mt-1 text-xs text-gray-500">Legacy creator not recorded</p>}</button>)}</div><div className={`${view === 'grid' ? 'hidden' : 'hidden sm:block'} overflow-x-auto`}><table className="w-full min-w-[540px] text-left text-xs"><thead><tr>{['Batch', 'Instructor', 'Status', 'Students'].map(label => <th scope="col" className="p-3" key={label}>{label}</th>)}</tr></thead><tbody>{records.map(batch => <tr className="border-t border-gray-100 hover:bg-green-50 dark:border-gray-800 dark:hover:bg-green-950/20" key={batch.id}><td className="p-3"><button className="min-h-10 text-left font-semibold text-green-800 focus-visible:outline-2 focus-visible:outline-green-600 dark:text-green-300" onClick={() => choose(batch)}>{batch.name}</button></td><td className="p-3">{batch.instructor_name}</td><td className="p-3 capitalize">{batch.status}</td><td className="p-3">{batch.student_count}</td></tr>)}</tbody></table></div></>}
        <Pagination total={filtered.length} page={visiblePage} onPage={setPage} />
      </DataSection>
    </section>
    {selected && <section className={`${surface} space-y-4 p-4 sm:p-5`} aria-label="Selected batch">
      <header className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="break-words text-lg font-semibold">{selected.name}</h2><p className="text-xs text-gray-500">{selected.instructor_name} · {selected.status}</p></div><div className="flex flex-wrap gap-2"><button className={button} disabled={busy} onClick={() => setEditor({ batch: selected })}>Manage batch</button>{selected.status === 'active' && <><button className={button} disabled={busy} onClick={() => setEnrolling(true)}>Enroll students</button><Link className={button} to={`/admin/assessment/create?batch_id=${selected.id}`}>New assessment</Link></>}<button className={button} disabled={busy} onClick={() => setConfirm({ type: selected.status === 'active' ? 'archive' : 'unarchive' })}>{selected.status === 'active' ? 'Archive batch' : 'Reactivate batch'}</button></div></header>
      {selected.status === 'archived' && <p className="rounded-xl bg-amber-50 p-3 text-xs text-amber-900">This batch is archived. Student assessment availability and final recommendations are locked. Reactivate it before enrolling students or starting assessments.</p>}
      {feedback && <p role={feedback.error ? 'alert' : 'status'} className={`text-sm ${feedback.error ? 'text-rose-700' : 'text-green-800 dark:text-green-300'}`}>{feedback.text}</p>}
      <input aria-label="Search batch students" className={field} placeholder="Search name, ID or email…" value={studentSearch} onChange={event => { setStudentSearch(event.target.value); setStudentPage(1) }} />
      <label className="block text-xs font-semibold">Skill leaderboard<select aria-label="Open skill leaderboard" className={field} value={leaderCategory} onChange={event => setLeaderCategory(event.target.value)} disabled={!leaderCategories.length}><option value="">{leaderCategories.length ? 'Choose a combined skill category' : 'No unlocked combined competency available'}</option>{leaderCategories.map(category => <option key={category} value={category}>{category}</option>)}</select></label>
      <DataSection url={rosterUrl} layout="table">
        <p className="text-xs text-gray-500">{studentRows.length} students · Select a student for results, history and retake management.</p>
        <div className="divide-y divide-gray-100 dark:divide-gray-800">{studentRows.slice((visibleStudentPage - 1) * 10, visibleStudentPage * 10).map(student => <article key={student.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl p-3 hover:bg-green-50 dark:hover:bg-green-950/20"><button className="min-h-11 min-w-0 flex-1 break-words text-left focus-visible:outline-2 focus-visible:outline-green-600" onClick={() => setStudentId(student.id)}><span className="text-sm font-semibold">{student.name}</span><span className="mt-1 block text-xs text-gray-500">{student.studentId} · {student.course} · {student.completedRequiredCount}/{student.totalRequiredCount} required complete</span></button><button className={button} disabled={busy} onClick={() => setConfirm({ type: 'unenroll', student })}>Unenroll from batch</button></article>)}</div>
        {!studentRows.length && <p className="py-5 text-sm text-gray-500">{students.length ? 'No students match your search.' : 'No students enrolled in this batch.'}</p>}
        <Pagination total={studentRows.length} page={visibleStudentPage} onPage={setStudentPage} />
      </DataSection>
      <button className={button} aria-expanded={showAudit} onClick={() => setShowAudit(value => !value)}>{showAudit ? 'Hide action history' : 'View action history'}</button>
      {showAudit && <DataSection url={auditUrl} layout="table"><ol className="space-y-3 text-xs">{audit?.results.map(row => <li key={row.id} className="border-t border-gray-100 pt-3 dark:border-gray-800"><strong>{row.action}</strong> · {row.actor_name}<p className="mt-1 text-gray-500">{new Date(row.created_at).toLocaleString('en-PH', { timeZone: 'Asia/Manila' })} · {row.target_type} #{row.target_id}</p></li>)}</ol>{audit?.count === 0 && <p className="text-xs text-gray-500">No recorded actions yet. Historical actions before this feature are not backfilled.</p>}<Pagination total={audit?.count || 0} page={auditPage} onPage={setAuditPage} pageSize={50} /></DataSection>}
    </section>}
    {editor && <BatchEditor batch={editor.batch} owners={owners} onClose={() => setEditor(null)} onSaved={batch => { refresh(); setSelectedId(batch.id); setEditor(null); setFeedback({ text: 'Batch saved.' }) }} />}
    {selected && enrolling && <StudentEnrollmentModal batchId={selected.id} onClose={() => setEnrolling(false)} onEnrolled={refresh} />}
    {selected && currentStudent && <StudentModal student={currentStudent} instructorName={selected.instructor_name} isArchived={selected.status === 'archived'} onClose={() => setStudentId(null)} onToggleRetake={retake} />}
    {selected && leaderCategory && <Suspense fallback={<p role="status">Loading skill leaderboard…</p>}><SkillLeaderboardModal skill={{ category: leaderCategory }} allStudents={leaderboardStudents} onClose={() => setLeaderCategory('')} onSelectStudent={student => { setLeaderCategory(''); setStudentId(student.id) }} /></Suspense>}
    {selected && confirm && <ConfirmModal title={confirm.type === 'unenroll' ? 'Unenroll from this batch?' : confirm.type === 'archive' ? 'Archive this batch?' : 'Reactivate this batch?'} message={confirm.type === 'unenroll' ? `Remove ${confirm.student.name} from ${selected.name}? Other enrollments, the student account and recorded history are preserved.` : 'This changes batch availability and recalculates affected completion and recommendation access. Existing history is preserved.'} confirmLabel={confirm.type === 'unenroll' ? 'Unenroll student' : 'Confirm batch status'} tone={confirm.type === 'unarchive' ? 'confirm' : 'danger'} onCancel={() => setConfirm(null)} onConfirm={() => confirm.type === 'unenroll' ? mutate(`/api/instructor/students/${confirm.student.id}/?batch_id=${selected.id}`, 'delete') : mutate(`${BATCHES}${selected.id}/${confirm.type}/`)} />}
  </div>
}
