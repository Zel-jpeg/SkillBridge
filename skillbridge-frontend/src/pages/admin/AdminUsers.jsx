// src/pages/admin/AdminUsers.jsx  (SLIMMED — 1676 → ~280 lines)
// All data + logic now in useAdminUsers.js
// All modals now in components/admin/

import { useNavigate } from 'react-router-dom'
import AdminNav          from '../../components/admin/AdminNav'
import ConfirmModal      from '../../components/admin/ConfirmModal'
import AddInstructorModal from '../../components/admin/AddInstructorModal'
import UserDetailModal   from '../../components/admin/UserDetailModal'
import PendingDetailModal from '../../components/admin/PendingDetailModal'
import Pagination        from '../../components/Pagination'
import SearchBar         from '../../components/SearchBar'
import EmptyState        from '../../components/EmptyState'
import StatusBadge       from '../../components/StatusBadge'
import { useAdminUsers } from '../../hooks/admin/useAdminUsers'
import { getInitials, matchColor } from '../../utils/formatters'

// ── Small page-scoped icons ───────────────────────────────────────
const PlusIcon     = () => <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M12 5v14M5 12h14"/></svg>
const SortIcon     = ({ dir }) => <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" className={`transition-transform ${dir === 'desc' ? 'rotate-180' : ''}`}><path d="M12 5v14M5 12l7-7 7 7"/></svg>
const GridIcon     = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/></svg>
const ListIcon     = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/></svg>

// ── Role pill ─────────────────────────────────────────────────────
function RolePill({ role }) {
  return role === 'instructor'
    ? <span className="text-xs bg-violet-100 dark:bg-violet-900 text-violet-700 dark:text-violet-300 font-semibold px-2 py-0.5 rounded-full">Instructor</span>
    : <span className="text-xs bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 font-semibold px-2 py-0.5 rounded-full">Student</span>
}

export default function AdminUsers() {
  const navigate = useNavigate()
  const {
    studentsList, instructors, pendingInstructors,
    showAddInstr, setShowAddInstr,
    selectedUser, setSelectedUser, selectedUserType, setSelectedUserType,
    selectedPending, setSelectedPending,
    confirmRemoveInstr, setConfirmRemoveInstr,
    activeTab, setActiveTab,
    search, setSearch,
    filterStatus, setFilterStatus, filterCourse, setFilterCourse, filterInstructor, setFilterInstructor,
    sortCol, sortDir, toggleSort,
    page, setPage, view, setView,
    displayed, counts, instructorsList,
    PAGE_SIZE,
    handleAddInstructor, confirmDeleteInstructor,
    approvePendingInstructor, rejectPendingInstructor,
    handleToggleRetake, handleUpdateUser, handleRemoveUser,
    toast,
  } = useAdminUsers()

  const TABS = [
    { key: 'students',    label: 'Students',    count: counts.students    },
    { key: 'instructors', label: 'Instructors', count: counts.instructors },
    { key: 'pending',     label: 'Pending',     count: counts.pending     },
    { key: 'all',         label: 'All Users',   count: counts.all         },
    { key: 'archived',    label: 'Archived',    count: counts.archived    },
  ]

  function openUser(user, type) {
    setSelectedUser(user)
    setSelectedUserType(type || user.role || 'student')
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      <AdminNav activePath="/admin/users" />

      {/* Toast */}
      {toast && (
        <div className="fixed top-4 right-4 z-60 bg-green-600 text-white text-sm font-medium px-5 py-3 rounded-2xl shadow-lg flex items-center gap-2">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M20 6L9 17l-5-5" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
          {toast}
        </div>
      )}

      {/* Modals */}
      {showAddInstr && (
        <AddInstructorModal
          existingInstructors={instructors}
          onClose={() => setShowAddInstr(false)}
          onAdd={handleAddInstructor}
        />
      )}
      {selectedUser && (
        <UserDetailModal
          user={selectedUser}
          type={selectedUserType}
          onClose={() => setSelectedUser(null)}
          onUpdate={handleUpdateUser}
          onRemove={handleRemoveUser}
          onToggleRetake={handleToggleRetake}
        />
      )}
      {selectedPending && (
        <PendingDetailModal
          user={selectedPending}
          onClose={() => setSelectedPending(null)}
          onApprove={() => approvePendingInstructor(selectedPending)}
          onReject={() => rejectPendingInstructor(selectedPending)}
        />
      )}
      {confirmRemoveInstr && (
        <ConfirmModal
          title="Remove instructor?"
          message={`This will archive ${confirmRemoveInstr.name}. Their students will remain.`}
          confirmLabel="Remove"
          onConfirm={confirmDeleteInstructor}
          onCancel={() => setConfirmRemoveInstr(null)}
        />
      )}

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-5">

        {/* Header */}
        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="text-xl font-semibold text-gray-900 dark:text-white">User Management</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">Manage students, instructors, and pending requests.</p>
          </div>
          <button onClick={() => setShowAddInstr(true)}
            className="flex items-center gap-1.5 px-3 py-2.5 bg-green-600 hover:bg-green-700 text-white text-sm font-medium rounded-xl transition-colors shrink-0">
            <PlusIcon /> Add Instructor
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 overflow-x-auto pb-1 scrollbar-none">
          {TABS.map(t => (
            <button key={t.key} onClick={() => setActiveTab(t.key)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-sm font-medium whitespace-nowrap transition-colors ${activeTab === t.key ? 'bg-white dark:bg-gray-800 text-gray-900 dark:text-white shadow-sm' : 'text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'}`}>
              {t.label}
              {t.count > 0 && (
                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                  t.key === 'pending' && t.count > 0 ? 'bg-amber-500 text-white' :
                  activeTab === t.key ? 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300' : 'bg-gray-100 dark:bg-gray-800 text-gray-400 dark:text-gray-500'
                }`}>{t.count}</span>
              )}
            </button>
          ))}
        </div>

        {/* ── PENDING TAB ── simple approve/reject list */}
        {activeTab === 'pending' && (
          <div className="space-y-2">
            {pendingInstructors.length === 0 ? (
              <EmptyState message="No pending instructor requests." />
            ) : pendingInstructors.map(p => (
              <div key={p.id} className="bg-white dark:bg-gray-900 border border-amber-100 dark:border-amber-900/30 rounded-2xl px-5 py-4 flex items-center gap-4 hover:shadow-sm transition cursor-pointer" onClick={() => setSelectedPending(p)}>
                <div className="w-10 h-10 rounded-xl bg-amber-100 dark:bg-amber-900 flex items-center justify-center text-amber-700 dark:text-amber-300 text-sm font-bold shrink-0">{getInitials(p.name)}</div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-900 dark:text-white">{p.name}</p>
                  <p className="text-xs text-gray-400 dark:text-gray-500">{p.email} · {p.instructorId}</p>
                </div>
                <div className="hidden sm:block text-xs text-gray-400 dark:text-gray-500">{p.department}</div>
                <div className="flex gap-2 shrink-0">
                  <button onClick={e => { e.stopPropagation(); rejectPendingInstructor(p) }}
                    className="px-3 py-1.5 text-xs font-medium rounded-lg bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-rose-100 dark:hover:bg-rose-900 hover:text-rose-600 dark:hover:text-rose-400 transition-colors">
                    Reject
                  </button>
                  <button onClick={e => { e.stopPropagation(); approvePendingInstructor(p) }}
                    className="px-3 py-1.5 text-xs font-medium rounded-lg bg-green-600 hover:bg-green-700 text-white transition-colors">
                    Approve
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ── ALL OTHER TABS ── full filter + table/grid */}
        {activeTab !== 'pending' && (
          <div className="space-y-3">
            {/* Controls row */}
            <div className="flex flex-col sm:flex-row sm:items-center gap-3 flex-wrap">
              <SearchBar value={search} onChange={setSearch} placeholder="Search…" className="flex-1 sm:max-w-xs" />

              {activeTab === 'students' && (
                <>
                  <select value={filterCourse} onChange={e => setFilterCourse(e.target.value)} className="text-xs px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 outline-none">
                    <option value="all">All courses</option>
                    <option value="BSIT">BSIT</option>
                    <option value="BSIS">BSIS</option>
                  </select>
                  <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} className="text-xs px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 outline-none">
                    <option value="all">All status</option>
                    <option value="completed">Completed</option>
                    <option value="pending">Pending</option>
                  </select>
                  {instructorsList.length > 0 && (
                    <select value={filterInstructor} onChange={e => setFilterInstructor(e.target.value)} className="text-xs px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 outline-none">
                      <option value="all">All instructors</option>
                      {instructorsList.map(i => <option key={i} value={i}>{i}</option>)}
                    </select>
                  )}
                </>
              )}

              <div className="hidden sm:flex items-center gap-1 bg-gray-100 dark:bg-gray-800 rounded-xl p-1 ml-auto">
                {[{ val: 'grid', Icon: GridIcon }, { val: 'list', Icon: ListIcon }].map(v => (
                  <button key={v.val} onClick={() => setView(v.val)}
                    className={`p-1.5 rounded-lg transition-colors ${view === v.val ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm' : 'text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'}`}>
                    <v.Icon />
                  </button>
                ))}
              </div>
            </div>

            {displayed.length === 0 && <EmptyState message="No users match your filters." onClear={() => { setSearch(''); setFilterStatus('all'); setFilterCourse('all'); setFilterInstructor('all') }} />}

            {/* Grid */}
            {displayed.length > 0 && (
              <div className={`${view === 'grid' ? 'grid' : 'grid sm:hidden'} grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3`}>
                {displayed.map(u => {
                  const role = u.role || (u.instructorId ? 'instructor' : 'student')
                  return (
                    <div key={u.id} onClick={() => openUser(u, role)}
                      className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-2xl p-4 flex flex-col gap-3 hover:shadow-md cursor-pointer transition-shadow">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-9 h-9 rounded-xl bg-linear-to-br from-indigo-400 to-violet-600 flex items-center justify-center text-white text-xs font-bold shrink-0">{getInitials(u.name)}</div>
                          <div className="min-w-0">
                            <p className="text-sm font-semibold text-gray-900 dark:text-white truncate">{u.name}</p>
                            <p className="text-xs text-gray-400 dark:text-gray-500 font-mono">{u.studentId || u.instructorId}</p>
                          </div>
                        </div>
                        <RolePill role={role} />
                      </div>
                      <p className="text-xs text-gray-400 dark:text-gray-500 truncate">{u.email}</p>
                      {role === 'student' && u.status && <StatusBadge status={u.status} />}
                      {role === 'student' && u.match != null && (
                        <div className="flex items-center gap-2">
                          <div className="flex-1 h-1.5 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
                            <div className={`h-full rounded-full ${u.match >= 80 ? 'bg-green-500' : u.match >= 60 ? 'bg-amber-500' : 'bg-rose-500'}`} style={{ width: `${u.match}%` }} />
                          </div>
                          <span className={`text-xs font-bold shrink-0 ${matchColor(u.match)}`}>{u.match}%</span>
                        </div>
                      )}
                      {role === 'instructor' && <p className="text-xs text-gray-400 dark:text-gray-500">{u.department}</p>}
                    </div>
                  )
                })}
              </div>
            )}

            {/* List */}
            {displayed.length > 0 && view === 'list' && (
              <div className="hidden sm:block bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-2xl overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/50">
                        <th className="text-left px-5 py-3.5 text-xs font-semibold text-gray-500 dark:text-gray-400 cursor-pointer hover:text-gray-700 dark:hover:text-gray-200" onClick={() => toggleSort('name')}>
                          Name {sortCol === 'name' && <SortIcon dir={sortDir} />}
                        </th>
                        <th className="text-left px-3 py-3.5 text-xs font-semibold text-gray-500 dark:text-gray-400">Email</th>
                        <th className="text-left px-3 py-3.5 text-xs font-semibold text-gray-500 dark:text-gray-400">Role</th>
                        <th className="text-left px-3 py-3.5 text-xs font-semibold text-gray-500 dark:text-gray-400">Status / Dept</th>
                        <th className="text-center px-5 py-3.5 text-xs font-semibold text-gray-500 dark:text-gray-400 cursor-pointer hover:text-gray-700 dark:hover:text-gray-200" onClick={() => toggleSort('match')}>
                          Match {sortCol === 'match' && <SortIcon dir={sortDir} />}
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {displayed.map((u, i) => {
                        const role = u.role || (u.instructorId ? 'instructor' : 'student')
                        return (
                          <tr key={u.id} onClick={() => openUser(u, role)}
                            className={`border-b border-gray-50 dark:border-gray-800 last:border-0 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors ${i % 2 !== 0 ? 'bg-gray-50/30 dark:bg-gray-800/20' : ''}`}>
                            <td className="px-5 py-4">
                              <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-xl bg-linear-to-br from-indigo-400 to-violet-600 flex items-center justify-center text-white text-xs font-bold shrink-0">{getInitials(u.name)}</div>
                                <div>
                                  <p className="text-sm font-medium text-gray-900 dark:text-white">{u.name}</p>
                                  <p className="text-xs text-gray-400 dark:text-gray-500 font-mono">{u.studentId || u.instructorId}</p>
                                </div>
                              </div>
                            </td>
                            <td className="px-3 py-4 text-xs text-gray-500 dark:text-gray-400 max-w-[160px] truncate">{u.email}</td>
                            <td className="px-3 py-4"><RolePill role={role} /></td>
                            <td className="px-3 py-4 text-xs text-gray-500 dark:text-gray-400">{role === 'student' ? u.status : u.department}</td>
                            <td className="px-5 py-4 text-center">
                              {role === 'student' && u.match != null
                                ? <span className={`text-sm font-bold ${matchColor(u.match)}`}>{u.match}%</span>
                                : <span className="text-xs text-gray-300 dark:text-gray-700">—</span>
                              }
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            <Pagination total={displayed.length} page={page} onPage={setPage} pageSize={PAGE_SIZE} />
          </div>
        )}
      </main>
    </div>
  )
}