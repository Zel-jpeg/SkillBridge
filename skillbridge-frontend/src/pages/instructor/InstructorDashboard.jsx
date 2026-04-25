// src/pages/instructor/InstructorDashboard.jsx  (SLIMMED — 937 → ~200 lines)
// All data + logic now in useInstructorDashboard.js
// StudentModal now in components/instructor/StudentModal.jsx

import { useNavigate }          from 'react-router-dom'
import InstructorNav            from '../../components/instructor/InstructorNav'
import StudentModal             from '../../components/instructor/StudentModal'
import Pagination               from '../../components/Pagination'
import StatusBadge              from '../../components/StatusBadge'
import SearchBar                from '../../components/SearchBar'
import EmptyState               from '../../components/EmptyState'
import { useInstructorDashboard, getPalette } from '../../hooks/instructor/useInstructorDashboard'
import { getInitials }          from '../../utils/formatters'

function scoreColor(pct) {
  if (pct == null) return 'text-gray-300 dark:text-gray-700'
  if (pct >= 80)   return 'text-green-600 dark:text-green-400'
  if (pct >= 60)   return 'text-amber-600 dark:text-amber-400'
  return 'text-rose-500 dark:text-rose-400'
}
function scoreBg(pct) {
  if (pct == null) return ''
  if (pct >= 80)   return 'bg-green-50 dark:bg-green-950'
  if (pct >= 60)   return 'bg-amber-50 dark:bg-amber-950'
  return 'bg-rose-50 dark:bg-rose-950'
}
function scoreBgBar(pct) {
  if (pct >= 80) return 'bg-green-600'
  if (pct >= 60) return 'bg-amber-500'
  return 'bg-rose-500'
}
function avgOf(scores) {
  const vals = Object.values(scores)
  return vals.length ? Math.round(vals.reduce((a, b) => a + b, 0) / vals.length) : null
}

const GridIcon = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/></svg>
const ListIcon  = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/></svg>

function SortIndicator({ col, sortBy, sortDir }) {
  if (sortBy !== col) return <span className="text-gray-300 dark:text-gray-700 ml-1">↕</span>
  return <span className="text-green-600 dark:text-green-400 ml-1">{sortDir === 'asc' ? '↑' : '↓'}</span>
}

export default function InstructorDashboard() {
  const navigate = useNavigate()
  const {
    studentsList, loading,
    search, setSearch, filterStatus, setFilter,
    sortBy, sortDir, toggleSort,
    view, setView, page, setPage,
    selectedStudent, setSelectedStudent,
    toast, showToast,
    completed, pending, avgOverall, leaders,
    displayed, paginated,
    PAGE_SIZE, categories, average,
  } = useInstructorDashboard()

  // Instructor from localStorage (read in hook, also readable here for nav)
  const cachedUser = (() => { try { return JSON.parse(localStorage.getItem('sb-user')) } catch { return null } })()
  const instructor = {
    name:     cachedUser?.name    || 'Instructor',
    initials: (cachedUser?.name || 'IN').split(' ').map(n => n[0]).slice(0, 2).join(''),
    subject:  cachedUser?.course  || 'OJT Coordinator',
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      <InstructorNav instructor={instructor} activePath="/instructor/dashboard" />

      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-gray-900 dark:bg-white text-white dark:text-gray-900 text-sm font-medium px-5 py-3 rounded-2xl shadow-lg flex items-center gap-2">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M20 6L9 17l-5-5" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
          {toast}
        </div>
      )}

      {selectedStudent && (
        <StudentModal
          student={selectedStudent}
          onClose={() => setSelectedStudent(null)}
          onToggleRetake={() => {}} // read-only in dashboard; retake managed in students page
        />
      )}

      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-6 sm:py-8 flex flex-col gap-6 sm:gap-8">

        {/* Header */}
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-xl font-bold text-gray-900 dark:text-white">Student performance</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">{instructor.subject} · OJT Assessment 2025–2026</p>
          </div>
          <div className="flex items-center gap-2 flex-wrap shrink-0">
            <button onClick={() => navigate('/instructor/students')}
              className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold px-4 py-2.5 rounded-xl transition-colors">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" stroke="white" strokeWidth="2.5" strokeLinecap="round"/><circle cx="9" cy="7" r="4" stroke="white" strokeWidth="2.5"/><line x1="19" y1="8" x2="19" y2="14" stroke="white" strokeWidth="2.5" strokeLinecap="round"/><line x1="22" y1="11" x2="16" y2="11" stroke="white" strokeWidth="2.5" strokeLinecap="round"/></svg>
              Enroll Students
            </button>
            <button onClick={() => navigate('/instructor/assessment/create')}
              className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white text-sm font-semibold px-4 py-2.5 rounded-xl transition-colors">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M12 5v14M5 12h14" stroke="white" strokeWidth="2.5" strokeLinecap="round"/></svg>
              New assessment
            </button>
          </div>
        </div>

        {/* Stat cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
          {[
            { label: 'Enrolled',  value: studentsList.length, sub: 'total students',    green: false, amber: false },
            { label: 'Completed', value: completed.length,    sub: 'took the assessment', green: true,  amber: false },
            { label: 'Pending',   value: pending.length,      sub: 'have not started',  green: false, amber: pending.length > 0 },
            { label: 'Avg score', value: `${avgOverall}%`,    sub: 'across all skills', green: false, amber: false },
          ].map(card => (
            <div key={card.label} className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-2xl p-4 sm:p-5">
              <p className="text-xs text-gray-400 dark:text-gray-500 mb-3">{card.label}</p>
              <p className={`text-2xl font-bold mb-1 ${card.green ? 'text-green-600 dark:text-green-400' : card.amber ? 'text-amber-500 dark:text-amber-400' : 'text-gray-900 dark:text-white'}`}>{card.value}</p>
              <p className="text-xs text-gray-400 dark:text-gray-600">{card.sub}</p>
            </div>
          ))}
        </div>

        {/* Skill leaders */}
        <div>
          <p className="text-sm font-semibold text-gray-900 dark:text-white mb-3">Top performers by skill</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
            {leaders.map(({ category, student, score }, idx) => (
              <div key={category} className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-2xl p-4">
                <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${getPalette(idx).pill}`}>{category.split(' ')[0]}</span>
                <div className="mt-3">
                  <p className="text-xs font-semibold text-gray-900 dark:text-white leading-tight mt-2">{student ? student.name.split(' ').slice(0, 2).join(' ') : '—'}</p>
                  <p className={`text-lg font-bold mt-0.5 ${scoreColor(score)}`}>{score}%</p>
                </div>
                <div className="mt-2 h-1 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
                  <div className={`h-full rounded-full ${getPalette(idx).bar}`} style={{ width: `${score}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Student table */}
        <div className="flex flex-col gap-4">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 flex-wrap">
            <p className="text-sm font-semibold text-gray-900 dark:text-white shrink-0">All students</p>
            <SearchBar value={search} onChange={setSearch} placeholder="Search by name or ID…" className="flex-1 min-w-0 sm:min-w-48" />
            <div className="flex items-center gap-1.5 flex-wrap">
              {[{ value: 'all', label: 'All' }, { value: 'completed', label: 'Completed' }, { value: 'pending', label: 'Pending' }].map(f => (
                <button key={f.value} onClick={() => setFilter(f.value)}
                  className={`text-xs px-3 py-1.5 rounded-full font-medium transition-colors ${filterStatus === f.value ? 'bg-gray-900 dark:bg-white text-white dark:text-gray-900' : 'bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'}`}>
                  {f.label}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-2 ml-auto">
              <button onClick={() => showToast('Exporting scores to CSV...')} className="hidden sm:flex items-center gap-1.5 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                Export
              </button>
              <div className="hidden sm:flex items-center gap-1 bg-gray-100 dark:bg-gray-800 rounded-xl p-1">
                {[{ v: 'grid', Icon: GridIcon }, { v: 'list', Icon: ListIcon }].map(vw => (
                  <button key={vw.v} onClick={() => setView(vw.v)} className={`p-1.5 rounded-lg transition-colors ${view === vw.v ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm' : 'text-gray-400 dark:text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'}`}><vw.Icon /></button>
                ))}
              </div>
            </div>
            <p className="text-xs text-gray-400 dark:text-gray-500 shrink-0">{displayed.length} students</p>
          </div>

          {displayed.length === 0 ? (
            <EmptyState message="No students match your search." onClear={() => { setSearch(''); setFilter('all') }} />
          ) : (
            <>
              {/* Grid view */}
              <div className={`${view === 'grid' ? 'grid' : 'grid sm:hidden'} grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4`}>
                {paginated.map(s => {
                  const overall = avgOf(s.scores)
                  const topEntry = Object.entries(s.scores).reduce((a, b) => b[1] > a[1] ? b : a, ['', -1])
                  const top = topEntry[1] >= 0 ? topEntry : null
                  return (
                    <div key={s.id} onClick={() => setSelectedStudent(s)}
                      className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-2xl p-5 flex flex-col gap-4 hover:shadow-md hover:border-green-300 dark:hover:border-green-700 hover:ring-2 hover:ring-green-200 dark:hover:ring-green-900 transition-all cursor-pointer">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-10 h-10 rounded-full bg-green-100 dark:bg-green-900 flex items-center justify-center text-sm font-bold text-green-700 dark:text-green-300 shrink-0">{getInitials(s.name)}</div>
                          <div className="min-w-0">
                            <p className="text-sm font-semibold text-gray-900 dark:text-white leading-tight truncate">{s.name}</p>
                            <p className="text-xs text-gray-400 dark:text-gray-500">{s.studentId} · {s.course}</p>
                          </div>
                        </div>
                        <StatusBadge status={s.status} />
                      </div>

                      {s.status === 'completed' ? (
                        <div className="flex flex-col gap-3">
                          {/* Overall bar */}
                          <div>
                            <div className="flex justify-between mb-1">
                              <span className="text-xs text-gray-500">Overall</span>
                              <span className={`text-sm font-bold ${scoreColor(overall)}`}>{overall}%</span>
                            </div>
                            <div className="h-2 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
                              <div className={`h-full rounded-full ${scoreBgBar(overall)}`} style={{ width: `${overall}%` }} />
                            </div>
                          </div>
                          {/* Compact 2-col skill chips */}
                          <div className="grid grid-cols-2 gap-1">
                            {categories.map(cat => {
                              const sc = s.scores[cat]
                              return (
                                <div key={cat} className="flex items-center gap-1.5 bg-gray-50 dark:bg-gray-800/60 rounded-lg px-2 py-1">
                                  <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                                    sc >= 80 ? 'bg-green-500' : sc >= 60 ? 'bg-amber-400' : 'bg-rose-400'
                                  }`} />
                                  <span className="text-[10px] text-gray-400 dark:text-gray-500 truncate flex-1 min-w-0">{cat.split(' ')[0]}</span>
                                  <span className={`text-[11px] font-semibold shrink-0 ${scoreColor(sc)}`}>{sc}%</span>
                                </div>
                              )
                            })}
                          </div>
                          {/* Best skill + company */}
                          {top && top[0] && (
                            <div className="flex items-center gap-2 bg-gray-50 dark:bg-gray-800 rounded-xl px-3 py-2">
                              <svg width="12" height="12" viewBox="0 0 24 24" fill="none"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" stroke="#16a34a" strokeWidth="2" strokeLinecap="round"/></svg>
                              <span className="text-xs text-gray-500 dark:text-gray-400">Best in</span>
                              <span className="text-xs font-semibold text-gray-900 dark:text-white">{top[0]}</span>
                              <span className="ml-auto text-xs font-bold text-green-600 dark:text-green-400">{top[1]}%</span>
                            </div>
                          )}
                          {s.top_recommendations?.[0] && (
                            <div className="flex items-center gap-1.5 bg-blue-50 dark:bg-blue-950/40 border border-blue-100 dark:border-blue-800 rounded-lg px-2.5 py-1.5">
                              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
                              <span className="text-xs text-blue-600 dark:text-blue-400 font-medium truncate">{s.top_recommendations[0].company}</span>
                              <span className="text-xs font-bold text-blue-700 dark:text-blue-300 shrink-0">{s.top_recommendations[0].match_score}%</span>
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="flex flex-col items-center gap-2 py-2">
                          <div className="w-8 h-8 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="9"/><path d="M12 8v4M12 16h.01"/></svg>
                          </div>
                          <p className="text-xs text-gray-400 dark:text-gray-600">Waiting for assessment</p>
                          <div className="flex flex-wrap gap-1 justify-center">
                            {categories.slice(0, 4).map(c => (
                              <span key={c} className="text-[10px] px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-800 text-gray-300 dark:text-gray-700">{c.split(' ')[0]}</span>
                            ))}
                            {categories.length > 4 && <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-800 text-gray-300 dark:text-gray-700">+{categories.length - 4}</span>}
                          </div>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>

              {/* List view */}
              {view === 'list' && (
                <div className="hidden sm:block bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-2xl overflow-hidden">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/50">
                        <th onClick={() => toggleSort('name')} className="text-left px-5 py-3.5 text-xs font-semibold text-gray-500 dark:text-gray-400 cursor-pointer hover:text-gray-900 dark:hover:text-white select-none">Student <SortIndicator col="name" sortBy={sortBy} sortDir={sortDir} /></th>
                        <th className="text-left px-3 py-3.5 text-xs font-semibold text-gray-500 dark:text-gray-400">Status</th>
                        <th className="text-left px-3 py-3.5 text-xs font-semibold text-gray-500 dark:text-gray-400">Skills</th>
                        <th className="text-center px-3 py-3.5 text-xs font-semibold text-gray-500 dark:text-gray-400">Top Match</th>
                        <th onClick={() => toggleSort('overall')} className="text-center px-5 py-3.5 text-xs font-semibold text-gray-500 dark:text-gray-400 cursor-pointer hover:text-gray-900 dark:hover:text-white select-none">Overall <SortIndicator col="overall" sortBy={sortBy} sortDir={sortDir} /></th>
                      </tr>
                    </thead>
                    <tbody>
                      {paginated.map((s, i) => {
                        const overall = avgOf(s.scores)
                        return (
                          <tr key={s.id} onClick={() => setSelectedStudent(s)}
                            className={`border-b border-gray-50 dark:border-gray-800 last:border-0 hover:bg-green-50 dark:hover:bg-green-950/20 cursor-pointer transition-colors ${i % 2 !== 0 ? 'bg-gray-50/30 dark:bg-gray-800/20' : ''}`}>
                            <td className="px-5 py-4">
                              <div className="flex items-center gap-3">
                                <div className="w-7 h-7 rounded-full bg-green-100 dark:bg-green-900 flex items-center justify-center text-xs font-semibold text-green-700 dark:text-green-300 shrink-0">{getInitials(s.name)}</div>
                                <div><p className="text-sm font-medium text-gray-900 dark:text-white">{s.name}</p><p className="text-xs text-gray-400 dark:text-gray-500">{s.studentId} · {s.course}</p></div>
                              </div>
                            </td>
                            <td className="px-3 py-4">
                              {s.status === 'completed'
                                ? <span className="inline-flex items-center gap-1 text-xs font-medium text-green-700 dark:text-green-300 bg-green-100 dark:bg-green-900 px-2.5 py-1 rounded-full"><span className="w-1 h-1 rounded-full bg-green-500 inline-block" />Done</span>
                                : <span className="inline-flex items-center gap-1 text-xs font-medium text-amber-700 dark:text-amber-300 bg-amber-100 dark:bg-amber-900 px-2.5 py-1 rounded-full"><span className="w-1 h-1 rounded-full bg-amber-500 inline-block" />Pending</span>
                              }
                            </td>
                            <td className="px-3 py-4 max-w-xs">
                              {s.status === 'completed' ? (
                                <div className="flex flex-wrap gap-1">
                                  {categories.map(cat => {
                                    const sc = s.scores[cat] ?? null
                                    return (
                                      <span key={cat} className={`inline-flex items-center gap-0.5 text-[10px] font-semibold px-1.5 py-0.5 rounded-md ${
                                        sc === null ? 'bg-gray-100 dark:bg-gray-800 text-gray-400'
                                        : sc >= 80 ? 'bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300'
                                        : sc >= 60 ? 'bg-amber-100 dark:bg-amber-900 text-amber-700 dark:text-amber-300'
                                        : 'bg-rose-100 dark:bg-rose-900 text-rose-600 dark:text-rose-400'
                                      }`}>
                                        {cat.split(' ')[0]} {sc !== null ? `${sc}%` : '—'}
                                      </span>
                                    )
                                  })}
                                </div>
                              ) : (
                                <span className="text-xs text-gray-300 dark:text-gray-700 italic">Not assessed</span>
                              )}
                            </td>
                            <td className="px-3 py-4 text-center">{s.top_recommendations?.[0] ? (
                              <div className="text-center"><p className="text-xs font-semibold text-blue-600 dark:text-blue-400 whitespace-nowrap truncate max-w-24">{s.top_recommendations[0].company}</p><p className="text-xs text-gray-400">{s.top_recommendations[0].match_score}%</p></div>
                            ) : <span className="text-xs text-gray-300 dark:text-gray-700">—</span>}</td>
                            <td className={`px-5 py-4 text-center ${overall !== null ? scoreBg(overall) : ''}`}>
                              <span className={`text-sm font-bold ${scoreColor(overall)}`}>{overall !== null ? `${overall}%` : '—'}</span>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )}

              <Pagination total={displayed.length} page={page} onPage={setPage} pageSize={PAGE_SIZE} />
            </>
          )}

          {/* Score legend */}
          <div className="flex flex-wrap items-center gap-3 px-1 pb-4">
            <p className="text-xs text-gray-400 dark:text-gray-600 mr-1">Score key:</p>
            {[{ label: '≥ 80% Strong', cls: 'bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300' }, { label: '60–79% Fair', cls: 'bg-amber-100 dark:bg-amber-900 text-amber-700 dark:text-amber-300' }, { label: '< 60% Needs work', cls: 'bg-rose-100 dark:bg-rose-900 text-rose-700 dark:text-rose-300' }].map(l => (
              <span key={l.label} className={`text-xs font-medium px-2.5 py-1 rounded-full ${l.cls}`}>{l.label}</span>
            ))}
          </div>
        </div>
      </main>
    </div>
  )
}