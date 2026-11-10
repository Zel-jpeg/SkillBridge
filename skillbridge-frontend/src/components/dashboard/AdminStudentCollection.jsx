import { useState } from 'react'
import Avatar from '../Avatar'
import StatusBadge from '../StatusBadge'
import SearchBar from '../SearchBar'
import Pagination from '../Pagination'
import CollectionViewToggle from '../CollectionViewToggle'
import { averageCategoryScore } from '../../utils/adminDashboard'
import { recommendationDisplay } from '../../utils/recommendationResults'
import { scoreColor } from '../../utils/formatters'

const PAGE_SIZE = 6
const focus = 'rounded-lg text-left hover:text-green-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-green-600 dark:hover:text-green-300'
const placementLabels = { approved: 'Approved', approved_other_batch: 'Approved in another batch', unplaced: 'Unplaced' }

function Skills({ student }) {
  return Object.keys(student.scores).length ? <div className="flex flex-wrap gap-1">{Object.entries(student.scores).map(([name, score]) => <span key={name} className={`rounded-md bg-gray-50 px-1.5 py-1 text-xs dark:bg-gray-800 ${scoreColor(score)}`}>{name} {score}%</span>)}</div>
    : <span className="text-xs text-gray-500 dark:text-gray-400">{student.competencyLocked ? 'Results not available yet' : 'Not assessed'}</span>
}

export default function AdminStudentCollection({ students, onSelectStudent }) {
  const [search, setSearch] = useState(''), [status, setStatus] = useState('all')
  const [page, setPage] = useState(1), [view, setView] = useState('list')
  const [sort, setSort] = useState({ column: 'name', direction: 1 })
  const query = search.trim().toLowerCase()
  const filtered = students.filter(student => (status === 'all' || student.status === status) &&
    [student.name, student.studentId, student.organization].some(value => value.toLowerCase().includes(query)))
    .sort((a, b) => {
      if (sort.column === 'score') {
        const av = averageCategoryScore(a), bv = averageCategoryScore(b)
        if (av == null || bv == null) return av == null && bv == null ? a.name.localeCompare(b.name) : av == null ? 1 : -1
        return (av - bv) * sort.direction || a.name.localeCompare(b.name) || a.id - b.id
      }
      return a.name.localeCompare(b.name) * sort.direction || a.id - b.id
    })
  const currentPage = Math.min(page, Math.max(1, Math.ceil(filtered.length / PAGE_SIZE)))
  const visible = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE)
  function sortBy(column) { setSort({ column, direction: sort.column === column ? -sort.direction : 1 }); setPage(1) }
  return <section aria-label="All students" className="space-y-4">
    <div className="flex flex-wrap items-center gap-3">
      <h2 className="text-sm font-semibold">All students</h2>
      <div className="min-w-0 flex-1 basis-60"><SearchBar label="Search dashboard students" type="search" maxLength={255} placeholder="Search by name, ID or program…" value={search} onChange={value => { setSearch(value); setPage(1) }} /></div>
      <div role="group" aria-label="Student completion filter" className="flex gap-1">{[['all', 'All'], ['completed', 'Completed'], ['pending', 'Pending']].map(([value, label]) => <button key={value} type="button" aria-pressed={status === value} onClick={() => { setStatus(value); setPage(1) }} className={`min-h-10 rounded-full px-3 text-xs font-medium focus-visible:outline-2 focus-visible:outline-green-600 ${status === value ? 'bg-gray-900 text-white dark:bg-white dark:text-gray-900' : 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700'}`}>{label}</button>)}</div>
      <CollectionViewToggle view={view} onChange={setView} label="Student collection view" />
      <p className="text-xs text-gray-500 dark:text-gray-400" role="status">{filtered.length} students</p>
    </div>
    {visible.length ? <>
      <div className={`${view === 'grid' ? 'grid' : 'grid lg:hidden'} gap-4 sm:grid-cols-2 xl:grid-cols-3`}>
        {visible.map(student => <article key={student.id} className="min-w-0 space-y-4 rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-gray-900">
          <button type="button" aria-haspopup="dialog" onClick={() => onSelectStudent(student)} className={`flex min-h-11 w-full min-w-0 items-center gap-3 ${focus}`}><Avatar name={student.name} photoUrl={student.photoUrl} className="h-10 w-10 shrink-0 rounded-full text-xs" /><span className="min-w-0"><strong className="block break-words text-xs">{student.name}</strong><span className="mt-1 block break-words text-xs text-gray-500 dark:text-gray-400">{student.studentId || 'No student ID'}</span></span></button>
          <p className="break-words text-xs text-gray-500 dark:text-gray-400">{student.organization}<span className="mt-1 block">{student.batch.name}</span></p>
          <div className="flex flex-wrap items-center gap-2"><StatusBadge status={student.status} /><span className="text-xs">{placementLabels[student.placementStatus]}</span></div>
          <Skills student={student} />
          <dl className="grid gap-3 text-xs"><div><dt className="text-gray-500 dark:text-gray-400">Average category score</dt><dd className={`mt-1 font-bold ${scoreColor(averageCategoryScore(student))}`}>{averageCategoryScore(student) == null ? '—' : `${averageCategoryScore(student)}%`}</dd></div>
            <div><dt className="text-gray-500 dark:text-gray-400">Top suggestion</dt><dd className="mt-1 break-words">{student.topRecommendation ? `${student.company} · ${recommendationDisplay(student.topRecommendation)}` : 'No current recommendation'}</dd></div></dl>
        </article>)}
      </div>
      {view === 'list' && <div className="hidden overflow-x-auto rounded-2xl border border-gray-200 bg-white lg:block dark:border-gray-800 dark:bg-gray-900">
        <table className="w-full text-left text-xs"><thead className="bg-gray-50 text-gray-600 dark:bg-gray-800/50 dark:text-gray-300"><tr>
          <th scope="col" className="p-4" aria-sort={sort.column === 'name' ? sort.direction === 1 ? 'ascending' : 'descending' : 'none'}><button type="button" className={`min-h-10 ${focus}`} onClick={() => sortBy('name')}>Student {sort.column === 'name' ? sort.direction === 1 ? '↑' : '↓' : '↕'}</button></th>
          {['Institute / Program', 'Status', 'Placement', 'Skills', 'Top suggestion'].map(name => <th scope="col" className="px-3 py-4" key={name}>{name}</th>)}
          <th scope="col" className="p-4" aria-sort={sort.column === 'score' ? sort.direction === 1 ? 'ascending' : 'descending' : 'none'}><button type="button" className={`min-h-10 ${focus}`} onClick={() => sortBy('score')}>Avg. category score {sort.column === 'score' ? sort.direction === 1 ? '↑' : '↓' : '↕'}</button></th>
        </tr></thead><tbody className="divide-y divide-gray-100 dark:divide-gray-800">{visible.map(student => <tr key={student.id} className="hover:bg-green-50 dark:hover:bg-green-950/20">
          <td className="p-4"><button type="button" aria-haspopup="dialog" className={`flex min-h-11 items-center gap-2 ${focus}`} onClick={() => onSelectStudent(student)}><Avatar name={student.name} photoUrl={student.photoUrl} className="h-8 w-8 shrink-0 rounded-full text-xs" /><span><strong className="block">{student.name}</strong><span className="mt-1 block text-gray-500 dark:text-gray-400">{student.studentId || 'No student ID'}</span></span></button></td>
          <td className="px-3 py-4"><span className="block">{student.organization}</span><span className="mt-1 block text-gray-500 dark:text-gray-400">{student.batch.name}</span></td>
          <td className="px-3 py-4"><StatusBadge status={student.status} /></td>
          <td className="px-3 py-4">{placementLabels[student.placementStatus]}</td>
          <td className="min-w-40 max-w-64 px-3 py-4"><Skills student={student} /></td>
          <td className="px-3 py-4">{student.topRecommendation ? <button type="button" onClick={() => onSelectStudent(student)} className={`min-h-11 ${focus}`}><span className="block text-blue-700 dark:text-blue-300">{student.company}</span><span className="mt-1 block text-gray-500 dark:text-gray-400">{recommendationDisplay(student.topRecommendation)}</span></button> : '—'}</td>
          <td className={`p-4 text-center font-bold ${scoreColor(averageCategoryScore(student))}`}>{averageCategoryScore(student) == null ? '—' : `${averageCategoryScore(student)}%`}</td>
        </tr>)}</tbody></table>
      </div>}
      <Pagination total={filtered.length} page={currentPage} pageSize={PAGE_SIZE} onPage={setPage} />
    </> : <div className="rounded-xl border border-dashed border-gray-200 p-6 text-xs dark:border-gray-700"><p>{students.length ? 'No students match your filters.' : 'No students in the selected batches yet.'}</p>{(search || status !== 'all') && <button type="button" className={`mt-3 min-h-11 text-green-700 dark:text-green-300 ${focus}`} onClick={() => { setSearch(''); setStatus('all'); setPage(1) }}>Clear student filters</button>}</div>}
    <p className="text-xs leading-5 text-gray-500 dark:text-gray-400">Average category score is the mean of available combined category percentages. It is separate from a position’s Match percentage.</p>
  </section>
}
