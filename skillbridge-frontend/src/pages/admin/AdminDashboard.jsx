import { CollectionSkeleton } from '../../components/loading/Skeletons'
import { useToast } from '../../context/ToastContext'
import DataSection from '../../components/DataSection'
// src/pages/admin/AdminDashboard.jsx  (SLIMMED — 588 → ~170 lines)
// All data + logic now in useAdminDashboard.js

import { lazy, Suspense, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../../api/axios'
import Pagination  from '../../components/Pagination'
import StatusBadge from '../../components/StatusBadge'
import PageHeader  from '../../components/PageHeader'
import SearchBar   from '../../components/SearchBar'
import EmptyState  from '../../components/EmptyState'
import { useAdminDashboard } from '../../hooks/admin/useAdminDashboard'
import { matchColor } from '../../utils/formatters'
import Avatar from '../../components/Avatar'
import DashboardHighlights from '../../components/dashboard/DashboardHighlights'
import DashboardOverview from '../../components/dashboard/DashboardOverview'

const StudentModal = lazy(() => import('../../components/instructor/StudentModal'))

// ── Local icons (small, page-scoped) ─────────────────────────────
const GridIcon     = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/></svg>
const ListIcon     = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/></svg>
const IconStudents = () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
const IconCompany  = () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>




function matchBarColor(pct) {
  if (!pct) return 'bg-gray-200 dark:bg-gray-700'
  if (pct >= 80) return 'bg-green-500'
  if (pct >= 60) return 'bg-amber-500'
  return 'bg-rose-500'
}
function matchBg(pct) {
  if (pct == null) return ''
  if (pct >= 80) return 'bg-green-50 dark:bg-green-950'
  if (pct >= 60) return 'bg-amber-50 dark:bg-amber-950'
  return 'bg-rose-50 dark:bg-rose-950'
}

export default function AdminDashboard() {
  const { showToast } = useToast()
  const navigate = useNavigate()
  const {
    students, loading,
    search, setSearch, filterStatus, setFilter,
    view, setView, page, setPage,
    filtered, paginated, PAGE_SIZE,
  } = useAdminDashboard()

  const [selectedStudentId, setSelectedStudentId] = useState(null)
  const studentTrigger = useRef(null)
  const selectedStudent = students.find(student => student.id === selectedStudentId)
  function selectStudent(student, trigger = document.activeElement) { studentTrigger.current = trigger; setSelectedStudentId(student.id) }
  function openStudent(event, student) { event.currentTarget.focus(); selectStudent(student) }
  function studentKeyDown(event) {
    if (['Enter', ' '].includes(event.key)) { event.preventDefault(); event.currentTarget.click() }
  }

  const [rerunning,  setRerunning]  = useState(false)
  const [rerunMsg,   setRerunMsg]   = useState('')

  async function handleRerun() {
    setRerunning(true)
    setRerunMsg('')
    try {
      const res = await api.post('/api/admin/rerun-recommendations/')
      setRerunMsg(res.data.message || 'Done!')
      showToast(res.data.message || 'Recommendations refreshed.')
    } catch {
      setRerunMsg('Re-run failed. Try again.')
      showToast('Could not refresh recommendations. Please try again.', 'error')
    } finally {
      setRerunning(false)
      setTimeout(() => setRerunMsg(''), 4000)
    }
  }



  return (
    <div className="min-w-0">
      {selectedStudent && <Suspense fallback={<p role="status">Loading student details…</p>}><StudentModal student={selectedStudent} instructorName={selectedStudent.instructor} restoreFocusRef={studentTrigger} readOnly onClose={() => setSelectedStudentId(null)} /></Suspense>}


      <section className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-6 sm:space-y-8">

        <PageHeader
          title="Admin Dashboard"
          subtitle="System-wide overview of students, companies, and recommendations."
          action={<>
            <button onClick={handleRerun} disabled={rerunning}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors disabled:opacity-50"
            >
              {rerunning
                ? <svg className="animate-spin" width="13" height="13" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2" strokeDasharray="42" strokeDashoffset="12"/></svg>
                : <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M1 4v6h6"/><path d="M3.51 15a9 9 0 1 0 .49-4.95"/></svg>
              }
              {rerunning ? 'Running…' : 'Re-run Recommendations'}
            </button>
            <button onClick={() => navigate('/admin/companies')} className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
              <IconCompany /> Manage Companies
            </button>
            <button onClick={() => navigate('/admin/users')} className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium bg-green-600 hover:bg-green-700 text-white transition-colors">
              <IconStudents /> Manage Users
            </button>
          </>}
        />

        {/* Re-run status message */}
        {rerunMsg && (
          <div className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-medium ${
            rerunMsg.includes('failed') ? 'bg-red-50 dark:bg-red-950 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-800' : 'bg-green-50 dark:bg-green-950 text-green-700 dark:text-green-300 border border-green-200 dark:border-green-800'
          }`}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              {rerunMsg.includes('failed') ? <><circle cx="12" cy="12" r="10"/><path d="M12 8v4M12 16h.01"/></> : <><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></>}
            </svg>
            {rerunMsg}
          </div>
        )}

        <DashboardOverview role="admin" />

        <DashboardHighlights loadingUrl="/api/admin/students/recommendations/" students={students} onSelectStudent={selectStudent} />

        {/* All Students */}
        <div className="space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center gap-3 justify-between flex-wrap">
            <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300">All Students</h2>
            <div className="flex items-center gap-2 flex-wrap flex-1 sm:justify-end">
              <SearchBar value={search} onChange={setSearch} placeholder="Search students…" className="flex-1 sm:w-44 sm:flex-none" />
              <div className="flex items-center gap-1">
                {[{ value: 'all', label: 'All' }, { value: 'completed', label: 'Done' }, { value: 'pending', label: 'Pending' }].map(f => (
                  <button key={f.value} onClick={() => setFilter(f.value)}
                    className={`text-xs px-3 py-1.5 rounded-full font-medium transition-colors ${filterStatus === f.value ? 'bg-gray-900 dark:bg-white text-white dark:text-gray-900' : 'bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'}`}>
                    {f.label}
                  </button>
                ))}
              </div>
              <div className="hidden sm:flex items-center gap-1 bg-gray-100 dark:bg-gray-800 rounded-xl p-1">
                {[{ val: 'grid', Icon: GridIcon }, { val: 'list', Icon: ListIcon }].map(v => (
                  <button key={v.val} aria-label={v.val === 'grid' ? 'Show student cards' : 'Show student list'} onClick={() => setView(v.val)}
                    className={`p-1.5 rounded-lg transition-colors ${view === v.val ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm' : 'text-gray-400 dark:text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'}`}>
                    <v.Icon />
                  </button>
                ))}
              </div>
            </div>
            <p className="text-xs text-gray-400 dark:text-gray-500 shrink-0">{loading ? 'Loading students…' : `${filtered.length} students`}</p>
          </div>

          <DataSection url="/api/admin/students/recommendations/" skeleton={<CollectionSkeleton view={view} />}>
          {filtered.length === 0 && <EmptyState message="No students match your search." onClear={() => { setSearch(''); setFilter('all') }} />}

          {/* Grid view */}
          {filtered.length > 0 && (
            <div className={`${view === 'grid' ? 'grid' : 'grid sm:hidden'} grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4`}>
              {paginated.map(s => (
                <div key={s.id} role="button" tabIndex={0} aria-label={`View student ${s.name}`} aria-haspopup="dialog" onKeyDown={studentKeyDown} onClick={event => openStudent(event, s)} className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-2xl p-5 flex flex-col gap-3 cursor-pointer hover:shadow-md hover:border-green-300 dark:hover:border-green-700 hover:ring-2 hover:ring-green-200 dark:hover:ring-green-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-green-600 transition-all">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-3 min-w-0">
                      <Avatar name={s.name} photoUrl={s.photoUrl} className="w-10 h-10 rounded-full text-sm" />
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-gray-900 dark:text-white leading-tight truncate">{s.name}</p>
                        <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">{s.studentId} · {s.course}</p>
                        <p className="text-xs text-gray-400 dark:text-gray-500 truncate">{s.email}</p>
                      </div>
                    </div>
                    <StatusBadge status={s.status} />
                  </div>
                  <p className="text-xs text-gray-400 dark:text-gray-500"><span className="text-gray-500 dark:text-gray-400 font-medium">Instructor:</span> {s.instructor}</p>
                  {s.position ? (
                    <div className="pt-2 border-t border-gray-50 dark:border-gray-800 space-y-1.5">
                      <div className="flex items-center justify-between gap-2">
                        <div className="min-w-0">
                          <p className="text-xs font-medium text-gray-700 dark:text-gray-300 truncate">{s.position}</p>
                          <p className="text-xs text-gray-400 dark:text-gray-500 truncate">{s.company}</p>
                        </div>
                        <span className={`text-base font-bold shrink-0 ${matchColor(s.match)}`}>{s.match}%</span>
                      </div>
                      <div className="h-1.5 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
                        <div className={`h-full rounded-full transition-all ${matchBarColor(s.match)}`} style={{ width: `${s.match}%` }} />
                      </div>
                    </div>
                  ) : (
                    <div className="pt-2 border-t border-gray-50 dark:border-gray-800">
                      <p className="text-xs text-gray-300 dark:text-gray-700 italic">{s.recommendationsLocked ? 'Recommendations not available yet' : 'No current match available'}</p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* List view */}
          {filtered.length > 0 && view === 'list' && (
            <div className="hidden sm:block bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-2xl overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/50">
                      {['Student','Instructor','Status','Top Recommendation','Match'].map((h, i) => (
                        <th key={h} className={`${i === 4 ? 'text-center px-5' : i === 0 ? 'text-left px-5' : 'text-left px-3'} py-3.5 text-xs font-semibold text-gray-500 dark:text-gray-400`}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {paginated.map((s, i) => (
                      <tr key={s.id} tabIndex={0} aria-label={`View student ${s.name}`} aria-haspopup="dialog" onKeyDown={studentKeyDown} onClick={event => openStudent(event, s)} className={`cursor-pointer focus-visible:outline-2 focus-visible:outline-green-600 focus-visible:-outline-offset-2 border-b border-gray-50 dark:border-gray-800 last:border-0 hover:bg-green-50 dark:hover:bg-green-950/20 transition-colors ${i % 2 !== 0 ? 'bg-gray-50/30 dark:bg-gray-800/20' : ''}`}>
                        <td className="px-5 py-4">
                          <div className="flex items-center gap-3">
                            <Avatar name={s.name} photoUrl={s.photoUrl} className="w-7 h-7 rounded-full text-xs" />
                            <div>
                              <p className="text-sm font-medium text-gray-900 dark:text-white leading-tight">{s.name}</p>
                              <p className="text-xs text-gray-400 dark:text-gray-500">{s.studentId} · {s.course}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-3 py-4 text-xs text-gray-500 dark:text-gray-400">{s.instructor}</td>
                        <td className="px-3 py-4"><StatusBadge status={s.status} size="md" /></td>
                        <td className="px-3 py-4">{s.position ? <div><p className="text-xs font-medium text-gray-700 dark:text-gray-300">{s.position}</p><p className="text-xs text-gray-400 dark:text-gray-500">{s.company}</p></div> : <span className="text-xs text-gray-300 dark:text-gray-700">—</span>}</td>
                        <td className={`px-5 py-4 text-center ${matchBg(s.match)}`}>
                          <span className={`text-sm font-bold ${matchColor(s.match)}`}>{s.match !== null ? `${s.match}%` : '—'}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          <Pagination total={filtered.length} page={page} onPage={setPage} pageSize={PAGE_SIZE} />
          </DataSection>
        </div>

        <div className="flex flex-wrap items-center gap-3 px-1 pb-4">
          <p className="text-xs text-gray-400 dark:text-gray-600">Match key:</p>
          {[
            { label: '≥ 80% Strong',    cls: 'bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300' },
            { label: '60–79% Fair',     cls: 'bg-amber-100 dark:bg-amber-900 text-amber-700 dark:text-amber-300' },
            { label: '< 60% Low match', cls: 'bg-rose-100  dark:bg-rose-900  text-rose-700  dark:text-rose-300'  },
          ].map(l => <span key={l.label} className={`text-xs font-medium px-2.5 py-1 rounded-full ${l.cls}`}>{l.label}</span>)}
        </div>

      </section>
    </div>
  )
}
