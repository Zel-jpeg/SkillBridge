import { CollectionSkeleton } from '../../components/loading/Skeletons'
import DataSection from '../../components/DataSection'
// src/pages/instructor/EnrolledStudents.jsx  (SLIMMED — 1273 → ~200 lines)
// All data + logic now in useEnrolledStudents.js
// Modals now in components/instructor/ and components/admin/

import { lazy, Suspense, useState } from 'react'
const EnrollmentEmails = lazy(() => import('../../components/enrollment/EnrollmentEmails'))
import PreviouslyUnenrolled from '../../components/enrollment/EnrollmentRecovery'
import StudentRosterToolbar from '../../components/instructor/StudentRosterToolbar'
import { useLocation, useNavigate }         from 'react-router-dom'
import StudentModal            from '../../components/instructor/StudentModal'
import StudentPerformanceCard from '../../components/StudentPerformanceCard'
import EnrollModal             from '../../components/instructor/EnrollModal'
import ConfirmModal            from '../../components/admin/ConfirmModal'
import Pagination              from '../../components/Pagination'
import { useEnrolledStudents } from '../../hooks/instructor/useEnrolledStudents'
import Avatar                  from '../../components/Avatar'
import StatusBadge             from '../../components/StatusBadge'
import PlacementStatusCard      from '../../components/placements/PlacementStatusCard'
import ActionMenu from '../../components/ActionMenu'
import BatchCyclePanel from '../../components/BatchCyclePanel'
import StudentTransferAction from '../../components/StudentTransferAction'
import { MailIcon, UsersIcon, UserPlusIcon, TransferIcon, CheckCircleIcon, ReportIcon, ClockIcon, ListIcon as BatchListIcon, ChevronDown, PlusIcon as AddIcon, ArchiveIcon as SharedArchiveIcon } from '../../components/Icons'
import { BatchEmailProgress } from '../../components/enrollment/EmailProgress'
import './studentRosterToolbar.css'

// ── Page-scoped icons ─────────────────────────────────────────────
const ArchiveIcon = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="21 8 21 21 3 21 3 8"/><rect x="1" y="3" width="22" height="5"/><line x1="10" y1="12" x2="14" y2="12"/></svg>
const UnarchiveIcon = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="21 8 21 21 3 21 3 8"/><rect x="1" y="3" width="22" height="5"/><polyline points="9 13 12 10 15 13"/><line x1="12" y1="10" x2="12" y2="17"/></svg>
const PlusIcon    = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M12 5v14M5 12h14"/></svg>
const TrashIcon   = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
const GridIcon    = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/></svg>
const ListIcon    = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/></svg>
const headerButton = 'inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-gray-200 px-3 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-100 focus-visible:outline-2 focus-visible:outline-green-600 disabled:opacity-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800'


function scoreColor(pct) {
  if (pct == null) return 'text-gray-300 dark:text-gray-700'
  if (pct >= 80)   return 'text-green-600 dark:text-green-400'
  if (pct >= 60)   return 'text-amber-600 dark:text-amber-400'
  return 'text-rose-500 dark:text-rose-400'
}

function avg(scores) {
  const vals = Object.values(scores ?? {})
  return vals.length ? Math.round(vals.reduce((a, b) => a + b, 0) / vals.length) : null
}


export default function EnrolledStudents() {
  const navigate = useNavigate()
  const emailLocation = useLocation()
  const [enrollment, setEnrollment] = useState('enrolled')
  const [showEmails, setShowEmails] = useState(false)
  const [showReactivate, setShowReactivate] = useState(false)
  const [showReportReview, setShowReportReview] = useState(false)
  const [showTransfer, setShowTransfer] = useState(false)
  const [section, setSection] = useState('students')
  const [closedEmailKey, setClosedEmailKey] = useState(null)
  const emailParams = new URLSearchParams(emailLocation.search)
  const routeEmailId = emailParams.get('emails') === '1' ? Number(emailParams.get('batch_id')) : null
  const emailRouteOpen = Number.isSafeInteger(routeEmailId) && routeEmailId > 0 && closedEmailKey !== emailLocation.key
  const {
    instructor,
    batches, activeBatchId, setActiveBatchId, initialBatchPending, initialRosterPending,
    viewedBatch, isArchived, students, activeBatch, completed,
    showArchiveConf, setShowArchiveConf, handleArchiveBatch, handleUnarchiveBatch,
    showNewBatch, setShowNewBatch,
    newBatchName, setNewBatchName, handleCreateBatch, batchBusy, batchError,
    handleEnroll, handleRemove, handleToggleRetake,
    showModal, setShowModal,
    selectedStudent, setSelectedStudent,
    confirmRemove, setConfirmRemove,
    search, setSearch, course, assessmentStatus,
    recommendationStatus, hasActiveFilters, applyFilters, accountStatus,
    view, setView, page, setPage,
    filtered, paginated, filteredCount, rosterUrl, rosterSummary, previewUrl,
    PAGE_SIZE,
    categories,
  } = useEnrolledStudents()

  const bsit = students.filter(s => s.course === 'BSIT')
  const bsis = students.filter(s => s.course === 'BSIS')

  return (
    <div className="min-w-0">



      {/* Modals */}
      {confirmRemove && (
        <ConfirmModal
          title="Unenroll from this batch?"
          message={`Unenroll ${confirmRemove.name} (${confirmRemove.studentId}) from ${viewedBatch?.name}? Their account, assessment results, retake history and placement history will be preserved. Access to this batch’s assessments and current recommendations will be removed. Other memberships remain unchanged.`}
          confirmLabel="Unenroll student"
          onConfirm={() => handleRemove(confirmRemove)}
          onCancel={() => setConfirmRemove(null)}
        />
      )}
      {(showEmails || emailRouteOpen) && (emailRouteOpen || activeBatchId) && <Suspense fallback={<p role="status">Loading enrollment emails…</p>}><EnrollmentEmails initialGroupId={emailRouteOpen ? emailParams.get('email_group') : undefined} key={emailRouteOpen ? routeEmailId : activeBatchId} batchId={emailRouteOpen ? routeEmailId : activeBatchId} onClose={() => { setShowEmails(false); setClosedEmailKey(emailLocation.key) }} /></Suspense>}
      {showModal && <EnrollModal batchId={activeBatchId} onClose={() => setShowModal(false)} onEnrolled={handleEnroll} />}
      {selectedStudent && <StudentModal student={selectedStudent} instructorName={instructor.name} isArchived={isArchived} onClose={() => setSelectedStudent(null)} onToggleRetake={handleToggleRetake} />}

      {/* Archive confirmation */}
      {showArchiveConf && (
        <div className="fixed inset-0 z-60 flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-sm px-4 pb-4 sm:pb-0">
          <div className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-2xl shadow-xl w-full max-w-sm p-6 space-y-4">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-50 dark:bg-amber-950 flex items-center justify-center shrink-0 text-amber-500"><ArchiveIcon /></div>
              <div>
                <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Archive this batch?</h3>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 leading-relaxed">
                  <strong>{viewedBatch?.name}</strong> will become read-only. Its current allocations will release their slots; student records and approved decision history stay preserved. This action does not save a final report.
                </p>
              </div>
            </div>
            {batchError && <p role="alert" className="text-sm text-rose-700 dark:text-rose-300">{batchError}</p>}
            <div className="flex gap-2">
              <button disabled={batchBusy} onClick={() => setShowArchiveConf(false)} className="flex-1 py-2.5 rounded-xl text-sm font-medium bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors">Cancel</button>
              <button disabled={batchBusy} onClick={handleArchiveBatch} className="flex-1 py-2.5 rounded-xl text-sm font-medium bg-amber-500 hover:bg-amber-600 text-white transition-colors">{batchBusy ? 'Saving…' : 'Archive Batch'}</button>
            </div>
          </div>
        </div>
      )}

      {batchError && !showArchiveConf && !showNewBatch && <p role="alert" className="px-4 py-2 text-sm text-rose-700 dark:text-rose-300">{batchError}</p>}
      {/* New batch modal */}
      {showNewBatch && (
        <div className="fixed inset-0 z-60 flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-sm px-4 pb-4 sm:pb-0">
          <div className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-2xl shadow-xl w-full max-w-sm p-6 space-y-4">
            <div>
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white flex items-center gap-2"><PlusIcon /> Start New Batch</h3>
              <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">Give this batch a school-year name.</p>
            </div>
            <div>
              <label className="text-xs font-medium text-gray-700 dark:text-gray-300 block mb-1">Batch Name</label>
              <input value={newBatchName} onChange={e => setNewBatchName(e.target.value)}
                placeholder={`AY ${new Date().getFullYear()}–${new Date().getFullYear() + 1}`}
                className="w-full px-3 py-2 text-sm rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-green-500" />
            </div>
            {batchError && <p role="alert" className="text-sm text-rose-700 dark:text-rose-300">{batchError}</p>}
            <div className="flex gap-2">
              <button disabled={batchBusy} onClick={() => setShowNewBatch(false)} className="flex-1 py-2.5 rounded-xl text-sm font-medium bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors">Cancel</button>
              <button disabled={batchBusy} onClick={handleCreateBatch} className="flex-1 py-2.5 rounded-xl text-sm font-medium bg-green-600 hover:bg-green-700 text-white transition-colors">{batchBusy ? 'Saving…' : 'Create Batch'}</button>
            </div>
          </div>
        </div>
      )}

      <section className="max-w-6xl mx-auto px-4 sm:px-6 py-6 sm:py-8 flex flex-col gap-6">

        {/* Header */}
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-xl font-bold text-gray-900 dark:text-white">Enrolled students</h1>
              {isArchived && (
                <span className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full bg-amber-100 dark:bg-amber-900 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
                  <ArchiveIcon /> Archived
                </span>
              )}
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <p className="text-sm text-gray-500 dark:text-gray-400">{instructor.subject}</p>
              <DataSection pending={initialBatchPending} url="/api/instructor/batches/" layout="control" count={1}><select aria-label="Selected batch" value={activeBatchId} onChange={e => { setActiveBatchId(Number(e.target.value)); setPage(1) }}
                className="text-xs px-2.5 py-1 rounded-lg bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 border-none focus:outline-none focus:ring-2 focus:ring-green-500 cursor-pointer font-medium">
                {[...batches].reverse().map(b => (
                  <option key={b.id} value={b.id}>{b.name}{b.status === 'archived' ? ' (Archived)' : ' ★ Active'}</option>
                ))}
              </select></DataSection>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {activeBatchId && <button className={headerButton} onClick={() => setShowEmails(true)}><MailIcon size={16} />Enrollment emails</button>}
            {!isArchived && !activeBatch && (
                <button onClick={() => setShowNewBatch(true)}
                  className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white text-sm font-semibold px-4 py-2.5 rounded-xl transition-colors">
                  <PlusIcon /> Start new batch
                </button>
            )}
            {!isArchived && activeBatch && (
              <>
                <ActionMenu label="Batch actions" className={headerButton} disabled={initialBatchPending}
                  items={[{ id: 'assessment', label: 'New assessment', icon: <AddIcon size={16} /> }, { id: 'transfer', label: 'Transfer student', icon: <TransferIcon size={16} /> }, { id: 'report', label: 'Save report & archive batch', icon: <ReportIcon size={16} /> }, { id: 'archive', label: 'Archive without final report', icon: <SharedArchiveIcon size={16} />, danger: true }]}
                  onAction={action => { if (action === 'assessment') navigate('/instructor/assessment/create'); else if (action === 'transfer') setShowTransfer(true); else if (action === 'report') setShowReportReview(true); else setShowArchiveConf(true) }}><span aria-hidden="true"><BatchListIcon size={16} /></span><span>Batch actions</span><span aria-hidden="true"><ChevronDown size={14} /></span></ActionMenu>
                <button disabled={initialBatchPending} onClick={() => setShowModal(true)}
                  className="flex min-h-11 items-center gap-2 bg-green-600 hover:bg-green-700 text-white text-xs font-semibold px-4 py-2.5 rounded-xl transition-colors">
                  <UserPlusIcon size={16} />
                  Enroll students
                </button>
              </>
            )}
            {isArchived && (
              <>
                {!activeBatch && (
                  <button onClick={() => setShowNewBatch(true)}
                    className="flex items-center gap-1.5 bg-green-600 hover:bg-green-700 text-white text-sm font-semibold px-3 py-2.5 rounded-xl transition-colors">
                    <PlusIcon /> Start new batch
                  </button>
                )}
                {activeBatch && (
                  <button onClick={() => { const ab = batches.find(b => b.status === 'active'); if (ab) setActiveBatchId(ab.id) }}
                    className="text-xs px-3 py-2 rounded-xl border border-green-200 dark:border-green-800 text-green-700 dark:text-green-400 hover:bg-green-50 dark:hover:bg-green-950 transition-colors font-medium">
                    Switch to active batch
                  </button>
                )}
                <button disabled={initialBatchPending} onClick={() => setShowReactivate(true)}
                  className="flex items-center gap-1.5 border border-green-200 dark:border-green-800 hover:bg-green-50 dark:hover:bg-green-950 text-green-700 dark:text-green-400 text-sm font-semibold px-3 py-2.5 rounded-xl transition-colors">
                  <UnarchiveIcon /> Reactivate batch
                </button>
              </>
            )}
          </div>
        </div>


{showTransfer && <StudentTransferAction key={`transfer-${activeBatchId}`} batchId={activeBatchId} batchName={viewedBatch?.name || 'this batch'} isOpen onClose={() => setShowTransfer(false)} showTrigger={false} />}
{showReportReview && <BatchCyclePanel key={`review-${activeBatchId}`} batchId={activeBatchId} role="instructor" mode="review" onClose={() => setShowReportReview(false)} onSaved={() => { setShowReportReview(false); setSection('reports') }} />}
<nav className="flex gap-5 border-b border-gray-200 text-xs font-semibold dark:border-gray-800" aria-label="Batch sections">{[['students', 'Students'], ['reports', 'Saved reports']].map(([id, label]) => <button key={id} className={`min-h-11 border-b-2 px-1 focus-visible:outline-2 focus-visible:outline-green-600 ${section === id ? 'border-green-600 text-green-700 dark:text-green-300' : 'border-transparent text-gray-500 dark:text-gray-400'}`} aria-current={section === id ? 'page' : undefined} onClick={() => setSection(id)}>{label}</button>)}</nav>
{section === 'reports' && activeBatchId && <BatchCyclePanel key={`reports-${activeBatchId}`} batchId={activeBatchId} role="instructor" mode="reports" />}
{showReactivate && <ConfirmModal tone="confirm" title="Reactivate this batch?" message={`Reactivate ${viewedBatch?.name}? Its published assessments can become available again, and recommendations are reviewed using current inputs. Saved closeout reports and previous attempts remain preserved. Students must not have another active batch.`} confirmLabel="Reactivate batch" onCancel={() => setShowReactivate(false)} onConfirm={async () => { await handleUnarchiveBatch(); setShowReactivate(false) }} />}
{isArchived && <p className="mt-3 text-xs leading-6 text-gray-500 dark:text-gray-400">Use saved closeout reports for the recorded cycle details. Personal details in this roster reflect the student's current account.</p>}
{section === 'students' && <>
<BatchEmailProgress key={`email-progress-${activeBatchId}`} batchId={activeBatchId} onView={() => setShowEmails(true)} paused={showEmails || emailRouteOpen} />
<DataSection pending={initialRosterPending} urls={rosterUrl ? ['/api/instructor/batches/', rosterUrl] : ['/api/instructor/batches/']} layout="roster-stats" count={4} label="Loading batch totals">
        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: 'Enrolled students', icon: UsersIcon, value: rosterSummary?.student_count ?? students.length, sub: `BSIT ${rosterSummary?.courses?.BSIT ?? bsit.length} · BSIS ${rosterSummary?.courses?.BSIS ?? bsis.length}`, green: false },
            { label: 'Required assessments complete', icon: CheckCircleIcon, value: `${rosterSummary?.completed_students ?? completed.length} of ${rosterSummary?.student_count ?? students.length}`, sub: (rosterSummary?.student_count ?? students.length) ? `${rosterSummary?.published_required_count ?? students[0]?.totalRequiredCount ?? 0} required assessments` : 'No students enrolled', green: true },
            { label: 'Recommendations available', icon: ReportIcon, value: rosterSummary?.recommendations_available_students ?? students.filter(s => !s.recommendationsLocked && s.top_recommendations.length > 0).length, sub: 'students with current ranked matches', green: true },
            { label: 'Awaiting coordinator review', icon: ClockIcon, value: rosterSummary?.awaiting_review_students ?? students.filter(s => !s.recommendationsLocked && !s.hasCurrentApproval && s.top_recommendations.length > 0).length, sub: 'current matches, no approved decision', green: false },
          ].map(c => (
            <div key={c.label} className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-2xl p-4">
              <div className="mb-3 flex items-start gap-2.5"><span aria-hidden="true" className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-green-50 text-green-700 dark:bg-green-950/40 dark:text-green-300 [&_svg]:stroke-[1.8]"><c.icon size={18} /></span><p className="pt-1 text-xs leading-5 text-gray-500 dark:text-gray-400">{c.label}</p></div>
              <p className={`text-2xl font-bold mb-1 ${c.green ? 'text-green-600 dark:text-green-400' : 'text-gray-900 dark:text-white'}`}>{c.value}</p>
              <p className="text-xs text-gray-400 dark:text-gray-600">{c.sub}</p>
            </div>
          ))}
        </div>

</DataSection>
        {/* Controls */}
        <StudentRosterToolbar key={`roster-toolbar-${activeBatchId}`} batchId={activeBatchId} students={students} pending={initialRosterPending}
          count={filteredCount} total={rosterSummary?.student_count} previewUrl={previewUrl}
          filters={{ search, course, enrollment, accountStatus, assessmentStatus, recommendationStatus }}
          onApply={values => { setEnrollment(values.enrollment); applyFilters(values) }} onSearch={setSearch}
          view={view} onView={setView} gridIcon={GridIcon} listIcon={ListIcon} />
{enrollment === 'unenrolled' && viewedBatch ? <PreviouslyUnenrolled key={activeBatchId} batch={viewedBatch} search={search} course={course} account={accountStatus} view={view} onChanged={handleEnroll} /> : <DataSection pending={initialRosterPending} urls={rosterUrl ? ['/api/instructor/batches/', rosterUrl] : ['/api/instructor/batches/']} skeleton={<CollectionSkeleton view={view} />}>
        {/* Empty state */}
        {filtered.length === 0 ? (
          <div className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-2xl py-16 flex flex-col items-center gap-3">
            <p className="text-sm font-medium text-gray-400 dark:text-gray-600">{hasActiveFilters ? 'No students match these filters.' : 'No students enrolled in this batch.'}</p>
            {hasActiveFilters && <p className="text-xs text-gray-500 dark:text-gray-400">Try another selection or clear the filters above.</p>}
          </div>
        ) : (
          <>
            {/* Grid */}
            <div className={`${view === 'grid' ? 'grid' : 'grid sm:hidden'} grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4`}>
              {paginated.map(student => <StudentPerformanceCard key={student.id} student={student} categories={categories}
                onOpen={selected => setSelectedStudent(selected)} onRemove={isArchived ? undefined : selected => setConfirmRemove(selected)} />)}
            </div>

            {/* List */}
            {view === 'list' && (
              <div className="hidden sm:block bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-2xl overflow-hidden">
                <table className="w-full text-sm">
                  <thead><tr className="border-b border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/50">
                    <th className="text-left px-5 py-3.5 text-xs font-semibold text-gray-500 dark:text-gray-400">Student</th>
                    <th className="text-left px-3 py-3.5 text-xs font-semibold text-gray-500 dark:text-gray-400">Status</th>
                    <th className="text-left px-3 py-3.5 text-xs font-semibold text-gray-500 dark:text-gray-400">Required progress</th>
                    <th className="text-left px-3 py-3.5 text-xs font-semibold text-gray-500 dark:text-gray-400">Placement</th>
                    <th className="text-left px-3 py-3.5 text-xs font-semibold text-gray-500 dark:text-gray-400">Skills</th>
                    <th className="text-center px-3 py-3.5 text-xs font-semibold text-gray-500 dark:text-gray-400">Top Match</th>
                    <th className="text-center px-4 py-3.5 text-xs font-semibold text-gray-500 dark:text-gray-400">Overall</th>
                    <th className="px-3 py-3.5" />
                  </tr></thead>
                  <tbody>
                    {paginated.map((s, i) => { const overall = avg(s.scores); return (
                      <tr key={s.id} tabIndex={0} aria-haspopup="dialog" onKeyDown={event => { if (['Enter', ' '].includes(event.key)) { event.preventDefault(); event.currentTarget.click() } }} onClick={event => { event.currentTarget.focus(); setSelectedStudent(s) }}
                        className={`border-b border-gray-50 dark:border-gray-800 last:border-0 hover:bg-green-50 dark:hover:bg-green-950/20 cursor-pointer transition-colors ${i%2?'bg-gray-50/30 dark:bg-gray-800/20':''}`}>
                        <td className="px-5 py-4"><div className="flex items-center gap-3">
                          <Avatar name={s.name} photoUrl={s.photoUrl} className="w-7 h-7 rounded-full text-xs" />
                          <div><p className="text-sm font-medium text-gray-900 dark:text-white">{s.name}</p><p className="text-xs text-gray-400 dark:text-gray-500">{s.studentId} · {s.course}</p></div>
                        </div></td>
                        <td className="px-3 py-4"><StatusBadge status={s.status} />{s.archived && <p className="text-xs text-amber-800 dark:text-amber-300">Account archived</p>}</td>
                        <td className="px-3 py-4 text-xs text-gray-600 dark:text-gray-300">{s.completedRequiredCount}/{s.totalRequiredCount}<br />{s.recommendationsLocked ? 'Recommendations locked' : 'Unlocked'}</td>
                        <td className="px-3 py-4 min-w-36"><PlacementStatusCard placement={s.placement} audience="instructor" compact /></td>
                        <td className="px-3 py-4 max-w-xs">
                          {s.status === 'completed' ? (
                            <div className="flex flex-wrap gap-1">
                              {categories.map(c => { const sc = s.scores[c] ?? null; return (
                                <span key={c} className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-md ${
                                  sc === null ? 'bg-gray-100 dark:bg-gray-800 text-gray-400'
                                  : sc >= 80 ? 'bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300'
                                  : sc >= 60 ? 'bg-amber-100 dark:bg-amber-900 text-amber-700 dark:text-amber-300'
                                  : 'bg-rose-100 dark:bg-rose-900 text-rose-600 dark:text-rose-400'
                                }`}>{c.split(' ')[0]} {sc !== null ? `${sc}%` : '—'}</span>
                              )})}
                            </div>
                          ) : (
                            <span className="text-xs text-gray-300 dark:text-gray-700 italic">Not assessed</span>
                          )}
                        </td>
                        <td className="px-3 py-4 text-center">{s.top_recommendations?.[0] ? <span className="text-xs font-semibold text-blue-600 dark:text-blue-400 whitespace-nowrap">{s.top_recommendations[0].company}<br/><span className="font-normal text-gray-400">{s.top_recommendations[0].match_score}%</span></span> : <span className="text-xs text-gray-300 dark:text-gray-700">—</span>}</td>
                        <td className="px-4 py-4 text-center"><span className={`text-sm font-bold ${scoreColor(overall)}`}>{overall!==null?`${overall}%`:'—'}</span></td>
                        <td className="px-3 py-4 text-center">
                          {!isArchived && !s.archived && <button onClick={e => { e.stopPropagation(); setConfirmRemove(s) }} className="p-1.5 rounded-lg text-gray-300 dark:text-gray-700 hover:text-rose-500 dark:hover:text-rose-400 transition-colors" title="Unenroll from this batch" aria-label={`Unenroll ${s.name} from this batch`}><TrashIcon /></button>}
                        </td>
                      </tr>
                    )})}
                  </tbody>
                </table>
              </div>
            )}

            <Pagination total={filteredCount} page={page} onPage={setPage} pageSize={PAGE_SIZE} />
          </>
        )}


</DataSection>}
        {/* Legend */}
        <div className="flex flex-wrap items-center gap-3 px-1 pb-4">
          <p className="text-xs text-gray-400 dark:text-gray-600 mr-1">Score key:</p>
          {[{l:'≥ 80% Strong',c:'bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300'},{l:'60–79% Fair',c:'bg-amber-100 dark:bg-amber-900 text-amber-700 dark:text-amber-300'},{l:'< 60% Needs work',c:'bg-rose-100 dark:bg-rose-900 text-rose-700 dark:text-rose-300'}].map(x => <span key={x.l} className={`text-xs font-medium px-2.5 py-1 rounded-full ${x.c}`}>{x.l}</span>)}
        </div>
        </>}
      </section>
    </div>
  )
}
