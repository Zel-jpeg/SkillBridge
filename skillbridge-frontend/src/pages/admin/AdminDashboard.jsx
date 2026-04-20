// src/pages/admin/AdminDashboard.jsx  (SLIMMED — 588 → ~170 lines)
// All data + logic now in useAdminDashboard.js

import { useNavigate } from 'react-router-dom'
import Pagination  from '../../components/Pagination'
import StatusBadge from '../../components/StatusBadge'
import PageHeader  from '../../components/PageHeader'
import SearchBar   from '../../components/SearchBar'
import EmptyState  from '../../components/EmptyState'
import AdminNav    from '../../components/admin/AdminNav'
import { useAdminDashboard } from '../../hooks/admin/useAdminDashboard'
import { getInitials, matchColor } from '../../utils/formatters'

// ── Local icons (small, page-scoped) ─────────────────────────────
const GridIcon     = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/></svg>
const ListIcon     = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/></svg>
const IconStudents = () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
const IconCompany  = () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
const IconPos      = () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2"/><line x1="12" y1="12" x2="12" y2="16"/><line x1="10" y1="14" x2="14" y2="14"/></svg>
const IconCheck    = () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
const IconTrophy   = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"/><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"/><path d="M4 22h16"/><path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22"/><path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22"/><path d="M18 2H6v7a6 6 0 0 0 12 0V2z"/></svg>

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
  const navigate = useNavigate()
  const {
    stats, topMatches,
    search, setSearch, filterStatus, setFilter,
    view, setView, page, setPage,
    filtered, paginated, PAGE_SIZE,
  } = useAdminDashboard()

  const STATS = [
    { label: 'Total Students',       Icon: IconStudents, color: 'bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-300 border-blue-100 dark:border-blue-900',       value: stats.total_students },
    { label: 'Companies Listed',     Icon: IconCompany,  color: 'bg-violet-50 dark:bg-violet-950 text-violet-700 dark:text-violet-300 border-violet-100 dark:border-violet-900', value: stats.total_companies },
    { label: 'Open Positions',       Icon: IconPos,      color: 'bg-amber-50 dark:bg-amber-950 text-amber-700 dark:text-amber-300 border-amber-100 dark:border-amber-900', value: stats.open_positions },
    { label: 'Recommendations Made', Icon: IconCheck,    color: 'bg-green-50 dark:bg-green-950 text-green-700 dark:text-green-300 border-green-100 dark:border-green-900', value: stats.recommendations_made },
  ]

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      <AdminNav activePath="/admin/dashboard" />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-6 sm:space-y-8">

        <PageHeader
          title="Admin Dashboard"
          subtitle="System-wide overview of students, companies, and recommendations."
          action={<>
            <button onClick={() => navigate('/admin/companies')} className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
              <IconCompany /> Manage Companies
            </button>
            <button onClick={() => navigate('/admin/users')} className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium bg-green-600 hover:bg-green-700 text-white transition-colors">
              <IconStudents /> Manage Users
            </button>
          </>}
        />

        {/* Stat cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          {STATS.map(s => (
            <div key={s.label} className={`border rounded-2xl p-4 sm:p-5 flex flex-col gap-2 ${s.color}`}>
              <div className="opacity-70"><s.Icon /></div>
              <p className="text-2xl sm:text-3xl font-bold">{s.value}</p>
              <p className="text-xs font-medium opacity-80">{s.label}</p>
            </div>
          ))}
        </div>

        {/* Top matches */}
        {topMatches.length > 0 && (
          <div>
            <h2 className="flex items-center gap-1.5 text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
              <IconTrophy /> Top Matches This Cycle
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {topMatches.map((m, i) => (
                <div key={i} className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-2xl p-4 flex flex-col gap-2">
                  <div className="flex items-center justify-between">
                    <div className="w-8 h-8 rounded-full bg-green-100 dark:bg-green-900 flex items-center justify-center text-xs font-semibold text-green-700 dark:text-green-300">
                      {getInitials(m.student)}
                    </div>
                    <span className={`text-lg font-bold ${matchColor(m.match)}`}>{m.match}%</span>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-900 dark:text-white leading-tight">{m.student}</p>
                    <p className="text-xs text-gray-400 dark:text-gray-500">{m.studentId} · {m.course}</p>
                  </div>
                  <div className="pt-1 border-t border-gray-50 dark:border-gray-800">
                    <p className="text-xs font-medium text-gray-700 dark:text-gray-300 truncate">{m.position}</p>
                    <p className="text-xs text-gray-400 dark:text-gray-500 truncate">{m.company}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

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
                  <button key={v.val} onClick={() => setView(v.val)}
                    className={`p-1.5 rounded-lg transition-colors ${view === v.val ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm' : 'text-gray-400 dark:text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'}`}>
                    <v.Icon />
                  </button>
                ))}
              </div>
            </div>
            <p className="text-xs text-gray-400 dark:text-gray-500 shrink-0">{filtered.length} students</p>
          </div>

          {filtered.length === 0 && <EmptyState message="No students match your search." onClear={() => { setSearch(''); setFilter('all') }} />}

          {/* Grid view */}
          {filtered.length > 0 && (
            <div className={`${view === 'grid' ? 'grid' : 'grid sm:hidden'} grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4`}>
              {paginated.map(s => (
                <div key={s.id} className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-2xl p-5 flex flex-col gap-3 hover:shadow-sm transition-shadow">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center text-sm font-bold text-blue-700 dark:text-blue-300 shrink-0">{getInitials(s.name)}</div>
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
                      <p className="text-xs text-gray-300 dark:text-gray-700 italic">No assessment yet</p>
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
                      <tr key={s.id} className={`border-b border-gray-50 dark:border-gray-800 last:border-0 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors ${i % 2 !== 0 ? 'bg-gray-50/30 dark:bg-gray-800/20' : ''}`}>
                        <td className="px-5 py-4">
                          <div className="flex items-center gap-3">
                            <div className="w-7 h-7 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center text-xs font-semibold text-blue-700 dark:text-blue-300 shrink-0">{getInitials(s.name)}</div>
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
        </div>

        <div className="flex flex-wrap items-center gap-3 px-1 pb-4">
          <p className="text-xs text-gray-400 dark:text-gray-600">Match key:</p>
          {[
            { label: '≥ 80% Strong',    cls: 'bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300' },
            { label: '60–79% Fair',     cls: 'bg-amber-100 dark:bg-amber-900 text-amber-700 dark:text-amber-300' },
            { label: '< 60% Low match', cls: 'bg-rose-100  dark:bg-rose-900  text-rose-700  dark:text-rose-300'  },
          ].map(l => <span key={l.label} className={`text-xs font-medium px-2.5 py-1 rounded-full ${l.cls}`}>{l.label}</span>)}
        </div>

      </main>
    </div>
  )
}