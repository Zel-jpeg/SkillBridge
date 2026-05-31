// src/pages/admin/AdminAssessments.jsx
// Read-only oversight view of all assessments across all batches/instructors.

import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import AdminNav    from '../../components/admin/AdminNav'
import SearchBar   from '../../components/SearchBar'
import Pagination  from '../../components/Pagination'
import EmptyState  from '../../components/EmptyState'
import { useAdminAssessments } from '../../hooks/admin/useAdminAssessments'

const Spinner = () => (
  <svg className="animate-spin w-5 h-5 text-gray-400" viewBox="0 0 24 24" fill="none">
    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
  </svg>
)

function formatDate(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-PH', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
}

const XIcon = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M18 6L6 18M6 6l12 12"/></svg>
const EyeIcon = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>


const TAB_CLASSES = (active) =>
  `px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
    active
      ? 'bg-gray-900 dark:bg-white text-white dark:text-gray-900'
      : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800'
  }`

function AssessmentModal({ assessment, onClose }) {
  if (!assessment) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm px-4 p-4 sm:p-0">
      <div className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-2xl shadow-xl w-full max-w-lg p-6 animate-in zoom-in-95 duration-200">
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 mb-6">
          <div>
            <h2 className="text-lg font-bold text-gray-900 dark:text-white leading-tight">
              {assessment.title}
            </h2>
            <div className="flex flex-wrap items-center gap-2 mt-2">
              <span className={`px-2.5 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider ${
                assessment.is_active 
                  ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400' 
                  : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400'
              }`}>
                {assessment.is_active ? 'Active' : 'Inactive'}
              </span>
              <span className="text-xs text-gray-500 dark:text-gray-400">{formatDate(assessment.created_at)}</span>
            </div>
          </div>
          <button onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-xl text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors shrink-0 self-end sm:self-auto">
            <XIcon />
          </button>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="p-4 bg-gray-50 dark:bg-gray-800/50 rounded-xl border border-gray-100 dark:border-gray-800">
            <p className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-1">Batch</p>
            <p className="text-sm font-medium text-gray-900 dark:text-white truncate" title={assessment.batch_name}>
              {assessment.batch_name || <span className="italic text-gray-400">None</span>}
            </p>
          </div>
          <div className="p-4 bg-gray-50 dark:bg-gray-800/50 rounded-xl border border-gray-100 dark:border-gray-800">
            <p className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-1">Duration</p>
            <p className="text-sm font-medium text-gray-900 dark:text-white">
              {assessment.duration_minutes ? `${assessment.duration_minutes} minutes` : 'Untimed'}
            </p>
          </div>
          <div className="p-4 bg-blue-50/50 dark:bg-blue-900/10 rounded-xl border border-blue-100 dark:border-blue-900/30">
            <p className="text-[10px] font-bold text-blue-400 dark:text-blue-500 uppercase tracking-wider mb-1">Questions</p>
            <p className="text-2xl font-black text-blue-600 dark:text-blue-400">
              {assessment.question_count}
            </p>
          </div>
          <div className="p-4 bg-green-50/50 dark:bg-green-900/10 rounded-xl border border-green-100 dark:border-green-900/30">
            <p className="text-[10px] font-bold text-green-400 dark:text-green-500 uppercase tracking-wider mb-1">Submissions</p>
            <p className="text-2xl font-black text-green-600 dark:text-green-400">
              {assessment.submission_count}
            </p>
          </div>
        </div>

        <div className="mt-6 flex justify-end">
          <button onClick={onClose}
            className="px-5 py-2 rounded-xl text-sm font-medium bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors">
            Close
          </button>
        </div>
      </div>
    </div>
  )
}

export default function AdminAssessments() {
  const {
    assessments, loading,
    search, setSearch,
    filterStatus, setFilterStatus,
    page, setPage,
    total, PAGE_SIZE,
    counts,
  } = useAdminAssessments()

  const TABS = [
    { key: 'all',      label: 'All',      count: counts.all      },
    { key: 'active',   label: 'Active',   count: counts.active   },
    { key: 'inactive', label: 'Inactive', count: counts.inactive },
  ]

  const [selectedAssessment, setSelectedAssessment] = useState(null)

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      <AdminNav activePath="/admin/assessments" />
      
      {selectedAssessment && (
        <AssessmentModal 
          assessment={selectedAssessment} 
          onClose={() => setSelectedAssessment(null)} 
        />
      )}

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-5">

        {/* Header */}
        <div>
          <h1 className="text-xl font-semibold text-gray-900 dark:text-white">Assessment Oversight</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
            System-wide view of all assessments created by instructors.
          </p>
        </div>

        {/* Table card */}
        <div className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-2xl shadow-sm overflow-hidden">

          {/* Toolbar */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 px-4 py-3 border-b border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-800/30">
            <div className="flex items-center gap-1 p-1 bg-gray-100 dark:bg-gray-800 rounded-xl">
              {TABS.map(t => (
                <button key={t.key} onClick={() => setFilterStatus(t.key)} className={TAB_CLASSES(filterStatus === t.key)}>
                  {t.label}
                  <span className="ml-1.5 text-[10px] font-bold opacity-60">{t.count}</span>
                </button>
              ))}
            </div>
            <SearchBar value={search} onChange={setSearch} placeholder="Search by title or batch…" className="w-full sm:max-w-xs" />
          </div>

          {/* Content */}
          {loading ? (
            <div className="flex justify-center py-16"><Spinner /></div>
          ) : assessments.length === 0 ? (
            <EmptyState message="No assessments found." onClear={() => { setSearch(''); setFilterStatus('all') }} />
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/50">
                      <th className="text-left px-4 sm:px-5 py-3.5 text-xs font-semibold text-gray-500 dark:text-gray-400">Title</th>
                      <th className="text-left px-5 py-3.5 text-xs font-semibold text-gray-500 dark:text-gray-400 hidden md:table-cell">Batch</th>
                      <th className="text-center px-5 py-3.5 text-xs font-semibold text-gray-500 dark:text-gray-400 hidden sm:table-cell">Questions</th>
                      <th className="text-center px-5 py-3.5 text-xs font-semibold text-gray-500 dark:text-gray-400 hidden sm:table-cell">Submissions</th>
                      <th className="text-center px-5 py-3.5 text-xs font-semibold text-gray-500 dark:text-gray-400 hidden lg:table-cell">Duration</th>
                      <th className="text-center px-4 sm:px-5 py-3.5 text-xs font-semibold text-gray-500 dark:text-gray-400">Status</th>
                      <th className="text-right px-4 sm:px-5 py-3.5 text-xs font-semibold text-gray-500 dark:text-gray-400"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {assessments.map((a, i) => (
                      <tr key={a.id}
                        onClick={() => setSelectedAssessment(a)}
                        className={`border-b border-gray-50 dark:border-gray-800 last:border-0 hover:bg-gray-100 dark:hover:bg-gray-800/60 transition-colors cursor-pointer ${i % 2 !== 0 ? 'bg-gray-50/30 dark:bg-gray-800/10' : ''}`}>
                        <td className="px-4 sm:px-5 py-4">
                          <div>
                            <p className="font-medium text-gray-900 dark:text-white">{a.title}</p>
                            <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5 md:hidden">{a.batch_name || <span className="italic">No batch</span>}</p>
                          </div>
                        </td>
                        <td className="px-5 py-4 text-gray-500 dark:text-gray-400 hidden md:table-cell">
                          {a.batch_name
                            ? <span className="px-2 py-0.5 bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 text-xs font-medium rounded-md">{a.batch_name}</span>
                            : <span className="text-gray-300 dark:text-gray-600 italic text-xs">No batch</span>
                          }
                        </td>
                        <td className="px-5 py-4 text-center hidden sm:table-cell">
                          <span className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-gray-100 dark:bg-gray-800 text-xs font-bold text-gray-700 dark:text-gray-300">
                            {a.question_count}
                          </span>
                        </td>
                        <td className="px-5 py-4 text-center hidden sm:table-cell">
                          <div className="flex flex-col items-center">
                            <span className={`text-sm font-bold ${a.submission_count > 0 ? 'text-green-600 dark:text-green-400' : 'text-gray-400 dark:text-gray-600'}`}>
                              {a.submission_count}
                            </span>
                            {a.submission_count > 0 && (
                              <span className="text-[10px] text-gray-400 dark:text-gray-500">submitted</span>
                            )}
                          </div>
                        </td>
                        <td className="px-5 py-4 text-center text-sm text-gray-500 dark:text-gray-400 hidden lg:table-cell">
                          {a.duration_minutes ? `${a.duration_minutes} min` : '—'}
                        </td>
                        <td className="px-4 sm:px-5 py-4 text-center">
                          {a.is_active
                            ? <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-300 border border-green-100 dark:border-green-800">
                                <span className="w-1.5 h-1.5 rounded-full bg-green-500 hidden sm:block" />Active
                              </span>
                            : <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400">
                                Inactive
                              </span>
                          }
                        </td>
                        <td className="px-4 sm:px-5 py-4 text-right">
                          <button onClick={(e) => { e.stopPropagation(); setSelectedAssessment(a) }} className="text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 p-2 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-900/30 transition-colors">
                            <EyeIcon />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              {total > PAGE_SIZE && (
                <div className="px-5 py-3 border-t border-gray-100 dark:border-gray-800">
                  <Pagination page={page} total={total} pageSize={PAGE_SIZE} onPageChange={setPage} />
                </div>
              )}
            </>
          )}
        </div>
      </main>
    </div>
  )
}
