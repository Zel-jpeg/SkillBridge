// src/pages/instructor/EnrolledStudents.jsx  (SLIMMED — 1273 → ~200 lines)
// All data + logic now in useEnrolledStudents.js
// Modals now in components/instructor/ and components/admin/

import { useNavigate }         from 'react-router-dom'
import InstructorNav           from '../../components/instructor/InstructorNav'
import StudentModal            from '../../components/instructor/StudentModal'
import EnrollModal             from '../../components/instructor/EnrollModal'
import ConfirmModal            from '../../components/admin/ConfirmModal'
import Pagination              from '../../components/Pagination'
import { useEnrolledStudents } from '../../hooks/instructor/useEnrolledStudents'
import { getInitials }         from '../../utils/formatters'

// ── Page-scoped icons ─────────────────────────────────────────────
const ArchiveIcon = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="21 8 21 21 3 21 3 8"/><rect x="1" y="3" width="22" height="5"/><line x1="10" y1="12" x2="14" y2="12"/></svg>
const PlusIcon    = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M12 5v14M5 12h14"/></svg>
const TrashIcon   = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
const GridIcon    = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/></svg>
const ListIcon    = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/></svg>

const CATEGORIES = ['Web Development', 'Database', 'Design', 'Networking', 'Backend']

function scoreColor(pct) {
  if (pct == null) return 'text-gray-300 dark:text-gray-700'
  if (pct >= 80)   return 'text-green-600 dark:text-green-400'
  if (pct >= 60)   return 'text-amber-600 dark:text-amber-400'
  return 'text-rose-500 dark:text-rose-400'
}
function scoreBgBar(pct) {
  if (pct >= 80) return 'bg-green-600'
  if (pct >= 60) return 'bg-amber-500'
  return 'bg-rose-500'
}
function avg(scores) {
  const vals = Object.values(scores ?? {})
  return vals.length ? Math.round(vals.reduce((a, b) => a + b, 0) / vals.length) : null
}
function topSkill(scores) {
  const e = Object.entries(scores ?? {}); if (!e.length) return null
  return e.reduce((a, b) => b[1] > a[1] ? b : a)
}

export default function EnrolledStudents() {
  const navigate = useNavigate()
  const {
    instructor,
    batches, activeBatchId, setActiveBatchId, loadingBatches,
    viewedBatch, isArchived, students, activeBatch, completed,
    showArchiveConf, setShowArchiveConf, handleArchiveBatch,
    showNewBatch, setShowNewBatch,
    newBatchName, setNewBatchName, handleCreateBatch,
    handleEnroll, handleRemove, handleToggleRetake,
    showModal, setShowModal,
    selectedStudent, setSelectedStudent,
    confirmRemove, setConfirmRemove,
    search, setSearch, course, setCourse, status, setStatus,
    view, setView, page, setPage,
    filtered, paginated,
    toast, PAGE_SIZE,
  } = useEnrolledStudents()

  const bsit = students.filter(s => s.course === 'BSIT')
  const bsis = students.filter(s => s.course === 'BSIS')

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      <InstructorNav activePath="/instructor/students" />

      {/* Toast */}
      {toast && (
        <div className="fixed top-4 right-4 z-50 bg-green-600 text-white text-sm font-medium px-5 py-3 rounded-2xl shadow-lg flex items-center gap-2">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M20 6L9 17l-5-5" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
          {toast}
        </div>
      )}

      {/* Modals */}
      {confirmRemove && (
        <ConfirmModal
          title="Remove student?"
          message={`This will unenroll ${confirmRemove.name} (${confirmRemove.studentId}). Their assessment data will also be removed.`}
          confirmLabel="Remove"
          onConfirm={() => handleRemove(confirmRemove)}
          onCancel={() => setConfirmRemove(null)}
        />
      )}
      {showModal && <EnrollModal existingStudents={students} onClose={() => setShowModal(false)} onEnroll={handleEnroll} />}
      {selectedStudent && <StudentModal student={selectedStudent} isArchived={isArchived} onClose={() => setSelectedStudent(null)} onToggleRetake={handleToggleRetake} />}

      {/* Archive confirmation */}
      {showArchiveConf && (
        <div className="fixed inset-0 z-60 flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-sm px-4 pb-4 sm:pb-0">
          <div className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-2xl shadow-xl w-full max-w-sm p-6 space-y-4">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-50 dark:bg-amber-950 flex items-center justify-center shrink-0 text-amber-500"><ArchiveIcon /></div>
              <div>
                <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Archive this batch?</h3>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 leading-relaxed">
                  <strong>{viewedBatch?.name}</strong> will be marked as archived and become read-only. All student data is preserved.
                </p>
              </div>
            </div>
            <div className="flex gap-2">
              <button onClick={() => setShowArchiveConf(false)} className="flex-1 py-2.5 rounded-xl text-sm font-medium bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors">Cancel</button>
              <button onClick={handleArchiveBatch} className="flex-1 py-2.5 rounded-xl text-sm font-medium bg-amber-500 hover:bg-amber-600 text-white transition-colors">Archive Batch</button>
            </div>
          </div>
        </div>
      )}

      {/* New batch modal */}
      {showNewBatch && (
        <div className="fixed inset-0 z-60 flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-sm px-4 pb-4 sm:pb-0">
          <div className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-2xl shadow-xl w-full max-w-sm p-6 space-y-4">
            <div>
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white flex items-center gap-2"><PlusIcon /> Start New Batch</h3>
              <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">Give this cohort a school-year name.</p>
            </div>
            <div>
              <label className="text-xs font-medium text-gray-700 dark:text-gray-300 block mb-1">Batch Name</label>
              <input value={newBatchName} onChange={e => setNewBatchName(e.target.value)}
                placeholder={`AY ${new Date().getFullYear()}–${new Date().getFullYear() + 1}`}
                className="w-full px-3 py-2 text-sm rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-green-500" />
            </div>
            <div className="flex gap-2">
              <button onClick={() => setShowNewBatch(false)} className="flex-1 py-2.5 rounded-xl text-sm font-medium bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors">Cancel</button>
              <button onClick={handleCreateBatch} className="flex-1 py-2.5 rounded-xl text-sm font-medium bg-green-600 hover:bg-green-700 text-white transition-colors">Create Batch</button>
            </div>
          </div>
        </div>
      )}

      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-6 sm:py-8 flex flex-col gap-6">

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
              <select value={activeBatchId} onChange={e => { setActiveBatchId(Number(e.target.value)); setPage(1) }}
                className="text-xs px-2.5 py-1 rounded-lg bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 border-none focus:outline-none focus:ring-2 focus:ring-green-500 cursor-pointer font-medium">
                {[...batches].reverse().map(b => (
                  <option key={b.id} value={b.id}>{b.name}{b.status === 'archived' ? ' (Archived)' : ' ★ Active'}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {!isArchived && (
              <>
                <button onClick={() => { if (!activeBatch) { setShowNewBatch(true); return } setShowModal(true) }}
                  className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white text-sm font-semibold px-4 py-2.5 rounded-xl transition-colors">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" stroke="white" strokeWidth="2.5" strokeLinecap="round"/><circle cx="9" cy="7" r="4" stroke="white" strokeWidth="2.5"/><line x1="19" y1="8" x2="19" y2="14" stroke="white" strokeWidth="2.5" strokeLinecap="round"/><line x1="22" y1="11" x2="16" y2="11" stroke="white" strokeWidth="2.5" strokeLinecap="round"/></svg>
                  Enroll students
                </button>
                {activeBatch && (
                  <>
                    <button onClick={() => navigate('/instructor/assessment/create')}
                      className="flex items-center gap-2 border border-gray-200 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-300 text-sm font-semibold px-4 py-2.5 rounded-xl transition-colors">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"/></svg>
                      New assessment
                    </button>
                    <button onClick={() => setShowArchiveConf(true)}
                      className="flex items-center gap-1.5 border border-amber-200 dark:border-amber-800 hover:bg-amber-50 dark:hover:bg-amber-950 text-amber-700 dark:text-amber-400 text-sm font-semibold px-3 py-2.5 rounded-xl transition-colors">
                      <ArchiveIcon /> Archive batch
                    </button>
                  </>
                )}
              </>
            )}
            {isArchived && (
              <button onClick={() => { const ab = batches.find(b => b.status === 'active'); if (ab) setActiveBatchId(ab.id) }}
                className="text-xs px-3 py-2 rounded-xl border border-green-200 dark:border-green-800 text-green-700 dark:text-green-400 hover:bg-green-50 dark:hover:bg-green-950 transition-colors font-medium">
                Switch to active batch
              </button>
            )}
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: 'Total enrolled', value: students.length, sub: 'all courses',      green: false },
            { label: 'BSIT',           value: bsit.length,    sub: 'students',         green: false },
            { label: 'BSIS',           value: bsis.length,    sub: 'students',         green: false },
            { label: 'Completion',     value: `${Math.round((completed.length / (students.length || 1)) * 100)}%`, sub: `${completed.length} of ${students.length} done`, green: true },
          ].map(c => (
            <div key={c.label} className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-2xl p-4">
              <p className="text-xs text-gray-400 dark:text-gray-500 mb-2">{c.label}</p>
              <p className={`text-2xl font-bold mb-1 ${c.green ? 'text-green-600 dark:text-green-400' : 'text-gray-900 dark:text-white'}`}>{c.value}</p>
              <p className="text-xs text-gray-400 dark:text-gray-600">{c.sub}</p>
            </div>
          ))}
        </div>

        {/* Controls */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 flex-wrap">
          <div className="relative flex-1 min-w-0 sm:min-w-56">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"><circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="2"/><path d="M16.5 16.5L21 21" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>
            <input value={search} onChange={e => { setSearch(e.target.value); setPage(1) }} placeholder="Search by name, ID, or email…"
              className="w-full pl-9 pr-4 py-2.5 text-sm rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white outline-none focus:border-green-500 transition-colors" />
          </div>
          <div className="flex items-center gap-1.5 flex-wrap">
            {[{v:'all',l:'All courses'},{v:'BSIT',l:'BSIT'},{v:'BSIS',l:'BSIS'}].map(f => (
              <button key={f.v} onClick={() => { setCourse(f.v); setPage(1) }}
                className={`text-xs px-3 py-1.5 rounded-full font-medium transition-colors ${course===f.v?'bg-gray-900 dark:bg-white text-white dark:text-gray-900':'bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'}`}>{f.l}</button>
            ))}
          </div>
          <div className="flex items-center gap-1.5">
            {[{v:'all',l:'All'},{v:'completed',l:'Done'},{v:'pending',l:'Pending'}].map(f => (
              <button key={f.v} onClick={() => { setStatus(f.v); setPage(1) }}
                className={`text-xs px-3 py-1.5 rounded-full font-medium transition-colors ${status===f.v?'bg-gray-900 dark:bg-white text-white dark:text-gray-900':'bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'}`}>{f.l}</button>
            ))}
          </div>
          <div className="hidden sm:flex items-center gap-1 bg-gray-100 dark:bg-gray-800 rounded-xl p-1 ml-auto">
            {[{v:'grid',Icon:GridIcon},{v:'list',Icon:ListIcon}].map(vi => (
              <button key={vi.v} onClick={() => setView(vi.v)} className={`p-1.5 rounded-lg transition-colors ${view===vi.v?'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm':'text-gray-400 dark:text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'}`}><vi.Icon /></button>
            ))}
          </div>
          <p className="text-xs text-gray-400 dark:text-gray-500 shrink-0">{filtered.length} students</p>
        </div>

        {/* Empty state */}
        {filtered.length === 0 ? (
          <div className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-2xl py-16 flex flex-col items-center gap-3">
            <p className="text-sm font-medium text-gray-400 dark:text-gray-600">No students match your search.</p>
            <button onClick={() => { setSearch(''); setCourse('all'); setStatus('all') }} className="text-xs text-green-600 dark:text-green-400 hover:underline">Clear filters</button>
          </div>
        ) : (
          <>
            {/* Grid */}
            <div className={`${view === 'grid' ? 'grid' : 'grid sm:hidden'} grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4`}>
              {paginated.map(s => {
                const overall = avg(s.scores), top = topSkill(s.scores)
                return (
                  <div key={s.id} onClick={() => setSelectedStudent(s)}
                    className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-2xl p-5 flex flex-col gap-4 hover:shadow-md hover:border-green-300 dark:hover:border-green-700 hover:ring-2 hover:ring-green-200 dark:hover:ring-green-900 transition-all cursor-pointer">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-10 h-10 rounded-full bg-green-100 dark:bg-green-900 flex items-center justify-center text-sm font-bold text-green-700 dark:text-green-300 shrink-0">{getInitials(s.name)}</div>
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-gray-900 dark:text-white leading-tight truncate">{s.name}</p>
                          <p className="text-xs text-gray-400 dark:text-gray-500">{s.studentId} · {s.course}</p>
                          <p className="text-xs text-gray-400 dark:text-gray-500 truncate">{s.email}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        {s.status === 'completed'
                          ? <span className="inline-flex items-center gap-1 text-xs font-medium text-green-700 dark:text-green-300 bg-green-100 dark:bg-green-900 px-2 py-0.5 rounded-full"><span className="w-1 h-1 rounded-full bg-green-500" />Done</span>
                          : <span className="inline-flex items-center gap-1 text-xs font-medium text-amber-700 dark:text-amber-300 bg-amber-100 dark:bg-amber-900 px-2 py-0.5 rounded-full"><span className="w-1 h-1 rounded-full bg-amber-500" />Pending</span>
                        }
                        {!isArchived && <button onClick={e => { e.stopPropagation(); setConfirmRemove(s) }} className="p-1.5 rounded-lg text-gray-300 dark:text-gray-700 hover:text-rose-500 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950 transition-colors" title="Remove"><TrashIcon /></button>}
                      </div>
                    </div>
                    {s.status === 'completed' ? (
                      <div className="flex flex-col gap-2">
                        <div>
                          <div className="flex justify-between mb-1"><span className="text-xs text-gray-500 dark:text-gray-400">Overall</span><span className={`text-sm font-bold ${scoreColor(overall)}`}>{overall}%</span></div>
                          <div className="h-2 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden"><div className={`h-full rounded-full ${scoreBgBar(overall)}`} style={{ width: `${overall}%` }} /></div>
                        </div>
                        {CATEGORIES.map(cat => { const sc = s.scores[cat]; return (
                          <div key={cat} className="flex items-center gap-2">
                            <span className="text-xs text-gray-400 dark:text-gray-500 w-24 truncate shrink-0">{cat}</span>
                            <div className="flex-1 h-1 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden"><div className={`h-full rounded-full ${scoreBgBar(sc)}`} style={{ width: `${sc}%` }} /></div>
                            <span className={`text-xs font-medium w-9 text-right ${scoreColor(sc)}`}>{sc}%</span>
                          </div>
                        )})}
                        {top && <div className="flex items-center gap-2 bg-gray-50 dark:bg-gray-800 rounded-xl px-3 py-2 mt-1"><svg width="12" height="12" viewBox="0 0 24 24" fill="none"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" stroke="#16a34a" strokeWidth="2" strokeLinecap="round"/></svg><span className="text-xs text-gray-500 dark:text-gray-400">Best in</span><span className="text-xs font-semibold text-gray-900 dark:text-white">{top[0]}</span><span className="ml-auto text-xs font-bold text-green-600 dark:text-green-400">{top[1]}%</span></div>}
                      </div>
                    ) : (
                      <div className="flex flex-col gap-2">
                        {CATEGORIES.map(c => <div key={c} className="flex items-center gap-2"><span className="text-xs text-gray-300 dark:text-gray-700 w-24 truncate shrink-0">{c}</span><div className="flex-1 h-1 bg-gray-100 dark:bg-gray-800 rounded-full" /><span className="text-xs text-gray-300 dark:text-gray-700 w-9 text-right">--%</span></div>)}
                        <p className="text-xs text-gray-400 dark:text-gray-600 text-center mt-1">Waiting for assessment</p>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>

            {/* List */}
            {view === 'list' && (
              <div className="hidden sm:block bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-2xl overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead><tr className="border-b border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/50">
                      <th className="text-left px-5 py-3.5 text-xs font-semibold text-gray-500 dark:text-gray-400">Student</th>
                      <th className="text-left px-3 py-3.5 text-xs font-semibold text-gray-500 dark:text-gray-400">Status</th>
                      {CATEGORIES.map(c => <th key={c} className="text-center px-3 py-3.5 text-xs font-semibold text-gray-500 dark:text-gray-400 whitespace-nowrap">{c.split(' ')[0]}</th>)}
                      <th className="text-center px-4 py-3.5 text-xs font-semibold text-gray-500 dark:text-gray-400">Overall</th>
                      <th className="px-3 py-3.5" />
                    </tr></thead>
                    <tbody>
                      {paginated.map((s, i) => { const overall = avg(s.scores); return (
                        <tr key={s.id} onClick={() => setSelectedStudent(s)}
                          className={`border-b border-gray-50 dark:border-gray-800 last:border-0 hover:bg-green-50 dark:hover:bg-green-950/20 cursor-pointer transition-colors ${i%2?'bg-gray-50/30 dark:bg-gray-800/20':''}`}>
                          <td className="px-5 py-4"><div className="flex items-center gap-3">
                            <div className="w-7 h-7 rounded-full bg-green-100 dark:bg-green-900 flex items-center justify-center text-xs font-semibold text-green-700 dark:text-green-300 shrink-0">{getInitials(s.name)}</div>
                            <div><p className="text-sm font-medium text-gray-900 dark:text-white">{s.name}</p><p className="text-xs text-gray-400 dark:text-gray-500">{s.studentId} · {s.course}</p></div>
                          </div></td>
                          <td className="px-3 py-4">{s.status==='completed'?<span className="inline-flex items-center gap-1 text-xs font-medium text-green-700 dark:text-green-300 bg-green-100 dark:bg-green-900 px-2.5 py-1 rounded-full"><span className="w-1 h-1 rounded-full bg-green-500"/>Done</span>:<span className="inline-flex items-center gap-1 text-xs font-medium text-amber-700 dark:text-amber-300 bg-amber-100 dark:bg-amber-900 px-2.5 py-1 rounded-full"><span className="w-1 h-1 rounded-full bg-amber-500"/>Pending</span>}</td>
                          {CATEGORIES.map(c => { const sc = s.scores[c] ?? null; return <td key={c} className="px-3 py-4 text-center"><span className={`text-sm font-semibold ${scoreColor(sc)}`}>{sc!==null?`${sc}%`:'—'}</span></td> })}
                          <td className="px-4 py-4 text-center"><span className={`text-sm font-bold ${scoreColor(overall)}`}>{overall!==null?`${overall}%`:'—'}</span></td>
                          <td className="px-3 py-4 text-center">
                            {!isArchived && <button onClick={e => { e.stopPropagation(); setConfirmRemove(s) }} className="p-1.5 rounded-lg text-gray-300 dark:text-gray-700 hover:text-rose-500 dark:hover:text-rose-400 transition-colors" title="Remove"><TrashIcon /></button>}
                          </td>
                        </tr>
                      )})}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            <Pagination total={filtered.length} page={page} onPage={setPage} pageSize={PAGE_SIZE} />
          </>
        )}

        {/* Legend */}
        <div className="flex flex-wrap items-center gap-3 px-1 pb-4">
          <p className="text-xs text-gray-400 dark:text-gray-600 mr-1">Score key:</p>
          {[{l:'≥ 80% Strong',c:'bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300'},{l:'60–79% Fair',c:'bg-amber-100 dark:bg-amber-900 text-amber-700 dark:text-amber-300'},{l:'< 60% Needs work',c:'bg-rose-100 dark:bg-rose-900 text-rose-700 dark:text-rose-300'}].map(x => <span key={x.l} className={`text-xs font-medium px-2.5 py-1 rounded-full ${x.c}`}>{x.l}</span>)}
        </div>
      </main>
    </div>
  )
}