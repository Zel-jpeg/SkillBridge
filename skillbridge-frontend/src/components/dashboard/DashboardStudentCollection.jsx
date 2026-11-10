import { useMemo, useState } from 'react'
import { recommendationDisplay } from '../../utils/recommendationResults'
import { averageCategoryScore } from '../../utils/dashboardStudents'
import DataSection from '../DataSection'
import { CollectionSkeleton } from '../loading/Skeletons'
import Avatar from '../Avatar'
import CompanyImage from '../CompanyImage'
import StatusBadge from '../StatusBadge'
import PlacementStatusCard from '../placements/PlacementStatusCard'
import SearchBar from '../SearchBar'
import EmptyState from '../EmptyState'
import Pagination from '../Pagination'

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
const GridIcon = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/></svg>
const ListIcon  = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/></svg>

function SortIndicator({ col, sortBy, sortDir }) {
  if (sortBy !== col) return <span className="text-gray-300 dark:text-gray-700 ml-1">↕</span>
  return <span className="text-green-600 dark:text-green-400 ml-1">{sortDir === 'asc' ? '↑' : '↓'}</span>
}

function StudentPlacement({ student }) {
  if ((student.placementStatus ?? student.placement?.status) === 'approved_other_batch') return <div className="flex flex-wrap items-center gap-2"><span className="text-[11px] font-medium text-gray-400 dark:text-gray-500">OJT</span><StatusBadge status="approved_other_batch" label="Approved in another batch" /></div>
  return <PlacementStatusCard placement={student.placement ?? (student.placementStatus ? { status: student.placementStatus } : null)} audience="instructor" compact />
}

// Extracted from InstructorDashboard; both staff roles render this same UI.
export default function DashboardStudentCollection({ students, onSelectStudent, showOrganization = false, loading = false, loadingUrl }) {
  const [search, setSearchValue] = useState(''), [filterStatus, setFilterValue] = useState('all')
  const [view, setView] = useState('list'), [pageValue, setPage] = useState(1)
  const [sortBy, setSortBy] = useState('name'), [sortDir, setSortDir] = useState('asc')
  const PAGE_SIZE = 6
  const categories = useMemo(() => [...new Set(students.flatMap(student => Object.keys(student.scores)))].sort(), [students])
  function setSearch(value) { setSearchValue(value); setPage(1) }
  function setFilter(value) { setFilterValue(value); setPage(1) }
  function toggleSort(column) {
    if (sortBy === column) setSortDir(value => value === 'asc' ? 'desc' : 'asc')
    else { setSortBy(column); setSortDir('asc') }
    setPage(1)
  }
  const displayed = useMemo(() => {
    const query = search.trim().toLowerCase()
    return students.filter(student => (filterStatus === 'all' || student.status === filterStatus) &&
      [student.name, student.studentId, student.course, showOrganization ? student.organization : ''].some(value => (value || '').toLowerCase().includes(query)))
      .sort((a, b) => {
        if (sortBy === 'name') return (a.name.localeCompare(b.name) || a.id - b.id) * (sortDir === 'asc' ? 1 : -1)
        const av = averageCategoryScore(a), bv = averageCategoryScore(b)
        if (av == null || bv == null) return av == null && bv == null ? a.name.localeCompare(b.name) : av == null ? 1 : -1
        return (av - bv) * (sortDir === 'asc' ? 1 : -1) || a.name.localeCompare(b.name) || a.id - b.id
      })
  }, [students, search, filterStatus, showOrganization, sortBy, sortDir])
  const page = Math.min(pageValue, Math.max(1, Math.ceil(displayed.length / PAGE_SIZE)))
  const paginated = displayed.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)
  return <section aria-label="All students" data-dashboard-student-collection className="min-w-0">
        {/* Student table */}
        <div className="flex flex-col gap-4">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 flex-wrap">
            <p className="text-sm font-semibold text-gray-900 dark:text-white shrink-0">All students</p>
            <SearchBar value={search} onChange={setSearch} label="Search dashboard students" type="search" placeholder={showOrganization ? "Search by name, ID or program…" : "Search by name or ID…"} className="flex-1 min-w-0 sm:min-w-48" />
            <div className="flex items-center gap-1.5 flex-wrap">
              {[{ value: 'all', label: 'All' }, { value: 'completed', label: 'Completed' }, { value: 'pending', label: 'Pending' }].map(f => (
                <button key={f.value} aria-pressed={filterStatus === f.value} onClick={() => setFilter(f.value)}
                  className={`text-xs px-3 py-1.5 rounded-full font-medium transition-colors ${filterStatus === f.value ? 'bg-gray-900 dark:bg-white text-white dark:text-gray-900' : 'bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'}`}>
                  {f.label}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-2 ml-auto">
              <div className="hidden sm:flex items-center gap-1 bg-gray-100 dark:bg-gray-800 rounded-xl p-1">
                {[{ v: 'grid', Icon: GridIcon }, { v: 'list', Icon: ListIcon }].map(vw => (
                  <button key={vw.v} onClick={() => setView(vw.v)} aria-label={vw.v === 'grid' ? 'Card view' : 'List view'} aria-pressed={view === vw.v} className={`p-1.5 rounded-lg transition-colors ${view === vw.v ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm' : 'text-gray-400 dark:text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'}`}><vw.Icon /></button>
                ))}
              </div>
            </div>
            <p className="text-xs text-gray-400 dark:text-gray-500 shrink-0">{loading ? 'Loading students…' : `${displayed.length} students`}</p>
          </div>

          <DataSection url={loadingUrl} skeleton={<CollectionSkeleton view={view} />}>
          {displayed.length === 0 ? (
            <EmptyState message={students.length ? "No students match your filters." : "No students in this scope yet."} onClear={() => { setSearch(''); setFilter('all') }} />
          ) : (
            <>
              {/* Grid view */}
              <div className={`${view === 'grid' ? 'grid' : 'grid sm:hidden'} grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4`}>
                {paginated.map(s => {
                  const overall = averageCategoryScore(s)
                  const topEntry = Object.entries(s.scores).reduce((a, b) => b[1] > a[1] ? b : a, ['', -1])
                  const top = topEntry[1] >= 0 ? topEntry : null
                  return (
                    <div key={s.id} data-student-id={s.id} aria-label={`View ${s.name} details`} tabIndex={0} role="button" aria-haspopup="dialog" onKeyDown={event => { if (['Enter', ' '].includes(event.key)) { event.preventDefault(); event.currentTarget.click() } }} onClick={event => { event.currentTarget.focus(); onSelectStudent(s) }}
                      className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-2xl p-5 flex flex-col gap-4 hover:shadow-md hover:border-green-300 dark:hover:border-green-700 hover:ring-2 hover:ring-green-200 dark:hover:ring-green-900 focus-visible:outline-2 focus-visible:outline-green-600 focus-visible:outline-offset-2 transition-all cursor-pointer">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-3 min-w-0">
                          <Avatar name={s.name} photoUrl={s.photoUrl} className="w-10 h-10 rounded-full text-sm" />
                          <div className="min-w-0">
                            <p className="text-sm font-semibold text-gray-900 dark:text-white leading-tight truncate">{s.name}</p>
                            <p className="text-xs text-gray-400 dark:text-gray-500">{s.studentId} · {s.course}</p>{showOrganization && <p className="mt-1 break-words text-xs text-gray-500 dark:text-gray-400">{s.organization} · {s.batch?.name}</p>}
                          </div>
                        </div>
                        <StatusBadge status={s.status} />
                      </div>

                      <StudentPlacement student={s} />

                      {s.status === 'completed' && Object.keys(s.scores).length > 0 ? (
                        <div className="flex flex-col gap-3">
                          {/* Overall bar */}
                          <div>
                            <div className="flex justify-between mb-1">
                              <span className="text-xs text-gray-500">Overall</span>
                              <span className={`text-sm font-bold ${scoreColor(overall)}`}>{overall === null ? '—' : `${overall}%`}</span>
                            </div>
                            <div className="h-2 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
                              <div className={`h-full rounded-full ${scoreBgBar(overall)}`} style={{ width: `${overall}%` }} />
                            </div>
                          </div>
                          {/* Compact 2-col skill chips */}
                          <div className="grid grid-cols-2 gap-1">
                            {categories.map(cat => {
                              const sc = s.scores[cat] ?? null
                              return (
                                <div key={cat} title={cat} className="flex items-center gap-1.5 bg-gray-50 dark:bg-gray-800/60 rounded-lg px-2 py-1">
                                  <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                                    sc === null ? 'bg-gray-300 dark:bg-gray-600' : sc >= 80 ? 'bg-green-500' : sc >= 60 ? 'bg-amber-400' : 'bg-rose-400'
                                  }`} />
                                  <span className="text-[10px] text-gray-400 dark:text-gray-500 truncate flex-1 min-w-0">{cat.split(' ')[0]}</span>
                                  <span className={`text-[11px] font-semibold shrink-0 ${scoreColor(sc)}`}>{sc === null ? '—' : `${sc}%`}</span>
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
                              <CompanyImage name={s.top_recommendations[0].company} imageUrl={s.top_recommendations[0].company_image_url} className="h-6 w-6 rounded-md" />
                              <span className="text-xs text-blue-600 dark:text-blue-400 font-medium truncate">{s.top_recommendations[0].company}</span>
                              <span className="text-xs font-bold text-blue-700 dark:text-blue-300 shrink-0">{recommendationDisplay(s.top_recommendations[0])}</span>
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="flex flex-col items-center gap-2 py-2">
                          <div className="w-8 h-8 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="9"/><path d="M12 8v4M12 16h.01"/></svg>
                          </div>
                          <p className="text-xs text-gray-400 dark:text-gray-600">{s.status === 'completed' ? 'Results not available yet' : 'Waiting for assessment'}</p>
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
                <div className="hidden sm:block overflow-x-auto bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-2xl overflow-hidden">
                  <table className="w-full min-w-[720px] text-sm">
                    <thead>
                      <tr className="border-b border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/50">
                        <th scope="col" aria-sort={sortBy === 'name' ? sortDir === 'asc' ? 'ascending' : 'descending' : 'none'} className="text-left px-5 py-3.5 text-xs font-semibold text-gray-500 dark:text-gray-400"><button type="button" onClick={() => toggleSort('name')} className="rounded hover:text-gray-900 focus-visible:outline-2 focus-visible:outline-green-600 dark:hover:text-white">Student <SortIndicator col="name" sortBy={sortBy} sortDir={sortDir} /></button></th>
                        <th className="text-left px-3 py-3.5 text-xs font-semibold text-gray-500 dark:text-gray-400">Status</th>
                        <th className="text-left px-3 py-3.5 text-xs font-semibold text-gray-500 dark:text-gray-400">Placement</th>
                        <th className="text-left px-3 py-3.5 text-xs font-semibold text-gray-500 dark:text-gray-400">Skills</th>
                        <th className="text-center px-3 py-3.5 text-xs font-semibold text-gray-500 dark:text-gray-400">Top suggestion</th>
                        <th scope="col" aria-sort={sortBy === 'overall' ? sortDir === 'asc' ? 'ascending' : 'descending' : 'none'} className="text-center px-5 py-3.5 text-xs font-semibold text-gray-500 dark:text-gray-400"><button type="button" title="Average of available combined category scores" onClick={() => toggleSort('overall')} className="rounded hover:text-gray-900 focus-visible:outline-2 focus-visible:outline-green-600 dark:hover:text-white">Overall <SortIndicator col="overall" sortBy={sortBy} sortDir={sortDir} /></button></th>
                      </tr>
                    </thead>
                    <tbody>
                      {paginated.map((s, i) => {
                        const overall = averageCategoryScore(s)
                        return (
                          <tr key={s.id} data-student-id={s.id} aria-label={`View ${s.name} details`} tabIndex={0} aria-haspopup="dialog" onKeyDown={event => { if (['Enter', ' '].includes(event.key)) { event.preventDefault(); event.currentTarget.click() } }} onClick={event => { event.currentTarget.focus(); onSelectStudent(s) }}
                            className={`border-b border-gray-50 dark:border-gray-800 last:border-0 hover:bg-green-50 dark:hover:bg-green-950/20 cursor-pointer focus-visible:outline-2 focus-visible:outline-green-600 focus-visible:-outline-offset-2 transition-colors ${i % 2 !== 0 ? 'bg-gray-50/30 dark:bg-gray-800/20' : ''}`}>
                            <td className="px-5 py-4">
                              <div className="flex items-center gap-3">
                                <Avatar name={s.name} photoUrl={s.photoUrl} className="w-7 h-7 rounded-full text-xs" />
                                <div><p className="text-sm font-medium text-gray-900 dark:text-white">{s.name}</p><p className="text-xs text-gray-400 dark:text-gray-500">{s.studentId} · {s.course}</p>{showOrganization && <p className="mt-1 break-words text-xs text-gray-500 dark:text-gray-400">{s.organization} · {s.batch?.name}</p>}</div>
                              </div>
                            </td>
                            <td className="px-3 py-4">
                              <StatusBadge status={s.status} />
                            </td>
                            <td className="px-3 py-4 min-w-36">
                              <StudentPlacement student={s} />
                            </td>
                            <td className="px-3 py-4 max-w-xs">
                              {s.status === 'completed' && Object.keys(s.scores).length > 0 ? (
                                <div className="flex flex-wrap gap-1">
                                  {categories.map(cat => {
                                    const sc = s.scores[cat] ?? null
                                    return (
                                      <span key={cat} title={cat} className={`inline-flex items-center gap-0.5 text-[10px] font-semibold px-1.5 py-0.5 rounded-md ${
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
                                <span className="text-xs text-gray-400 dark:text-gray-500">{s.status === 'completed' ? 'Results not available yet' : 'Not assessed'}</span>
                              )}
                            </td>
                            <td className="px-3 py-4 text-center">{s.top_recommendations?.[0] ? (
                              <div className="text-center"><p className="text-xs font-semibold text-blue-600 dark:text-blue-400 whitespace-nowrap truncate max-w-24">{s.top_recommendations[0].company}</p><p className="text-xs text-gray-400">{recommendationDisplay(s.top_recommendations[0])}</p></div>
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

          </DataSection>

          {/* Score legend */}
          <div className="flex flex-wrap items-center gap-3 px-1 pb-4">
            <p className="text-xs text-gray-400 dark:text-gray-600 mr-1">Score key:</p>
            {[{ label: '≥ 80% Strong', cls: 'bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300' }, { label: '60–79% Fair', cls: 'bg-amber-100 dark:bg-amber-900 text-amber-700 dark:text-amber-300' }, { label: '< 60% Needs work', cls: 'bg-rose-100 dark:bg-rose-900 text-rose-700 dark:text-rose-300' }].map(l => (
              <span key={l.label} className={`text-xs font-medium px-2.5 py-1 rounded-full ${l.cls}`}>{l.label}</span>
            ))}
          </div>
        </div>
    <p className="text-xs leading-5 text-gray-500 dark:text-gray-400">Overall is the average of available combined category scores. It is separate from a position’s Match percentage.</p>
  </section>
}
