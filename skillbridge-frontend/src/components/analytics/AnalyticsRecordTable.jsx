import Avatar from '../Avatar'
import StatusBadge from '../StatusBadge'
import { scoreColor } from '../../utils/formatters'
import { reportTableStyles as styles } from './reportTableStyles'

const compactOrder = ['0', '4', '5', '7', '12', '10']
const compactLabels = { 0: 'Student', 4: 'Instructor', 5: 'Assessment status', 7: 'Placement', 10: 'Match', 12: 'Top recommendation' }
const matchSurface = value => value == null ? '' : value >= 80 ? 'bg-green-50/70 dark:bg-green-950/30' : value >= 60 ? 'bg-amber-50/70 dark:bg-amber-950/30' : 'bg-rose-50/70 dark:bg-rose-950/30'

export default function AnalyticsRecordTable({ engine, report, page, studentTable, fullColumns, selectionLabel, onStudent }) {
  // In the compact view keep the recommendation and its match next to each other.
  const displayHeaders = group => !studentTable || fullColumns ? group.headers : [...group.headers].sort((a, b) => compactOrder.indexOf(a.column.id) - compactOrder.indexOf(b.column.id))
  const displayCells = row => !studentTable || fullColumns ? row.getVisibleCells() : [...row.getVisibleCells()].sort((a, b) => compactOrder.indexOf(a.column.id) - compactOrder.indexOf(b.column.id))
  return <div role="region" aria-label="Report table, scroll horizontally for more columns" tabIndex={0} className={`${studentTable ? 'hidden lg:block' : ''} max-h-[42rem] ${styles.frame}`}>
    <table className={styles.table}>
      <caption className="sr-only">{report.title}. {selectionLabel}. Assessment status shows required work; placement is a separate decision. Column headers sort all filtered records before pagination.</caption>
      <thead className={styles.head}>{engine.getHeaderGroups().map(group => <tr key={group.id} className="border-b border-gray-100 dark:border-gray-800">{displayHeaders(group).map((header, index, headers) => {
        const sorted = header.column.getIsSorted()
        const id = Number(header.column.id)
        const title = studentTable && !fullColumns ? compactLabels[id] : header.column.columnDef.header
        const numeric = studentTable ? id === 10 || id >= 14 : engine.getRowModel().rows.some(row => typeof row.original.values[id] === 'number')
        return <th scope="col" key={header.id} aria-sort={sorted === 'asc' ? 'ascending' : sorted === 'desc' ? 'descending' : 'none'} className={`${index === 0 || index === headers.length - 1 ? 'px-5' : 'px-3'} py-1.5 font-medium ${index === 0 ? 'min-w-52' : numeric ? 'min-w-24' : 'min-w-32'}`}>
          <button type="button" aria-label={`Sort by ${studentTable && id === 0 ? 'Student' : title}`} onClick={header.column.getToggleSortingHandler()} className={`group flex min-h-10 w-full items-center gap-2 rounded text-left focus-visible:outline-2 focus-visible:outline-green-600 ${numeric ? 'justify-center' : ''}`}><span>{title}</span><span aria-hidden="true" className={sorted ? 'text-green-700 dark:text-green-400' : 'text-gray-300 group-hover:text-gray-500 dark:text-gray-600'}>{sorted === 'asc' ? '↑' : sorted === 'desc' ? '↓' : '↕'}</span></button>
        </th>
      })}</tr>)}</thead>
      <tbody>{engine.getRowModel().rows.slice((page - 1) * 10, page * 10).map(row => <tr key={row.id} className={styles.row}>{displayCells(row).map((cell, cellIndex, cells) => {
        const index = Number(cell.column.id)
        const value = row.original.values[index]
        const student = row.original.student
        const numeric = typeof value === 'number'
        const score = studentTable ? index === 10 || index >= 14 : /%|Mean of final/.test(report.columns[index])
        let content = value ?? <span className="text-gray-400 dark:text-gray-500">—</span>
        if (studentTable && index === 0) content = <div className="flex items-center gap-3">
          <Avatar name={student.name} photoUrl={student.photo_url || student.photoUrl} className="h-7 w-7 rounded-full text-xs" />
          <div className="min-w-0"><button type="button" aria-label={`View details for ${student.name}`} className="rounded text-left font-medium leading-5 text-gray-900 hover:text-green-700 focus-visible:outline-2 focus-visible:outline-green-600 dark:text-white dark:hover:text-green-300" onClick={event => onStudent(student, event.currentTarget)}>{value}</button>
            {!fullColumns && <p className="text-xs text-gray-400 dark:text-gray-500">{student.school_id || 'No school ID'} · {student.course || 'No course'}</p>}
          </div>
        </div>
        else if (studentTable && index === 5 && !fullColumns) content = <div className="space-y-1"><StatusBadge status={student.required_complete ? 'completed' : Object.values(student.attempt_states || {}).includes('stopped') ? 'stopped' : 'pending'} /><p className="text-gray-400 dark:text-gray-500">{value} required</p>{student.recommendations_locked && <p className="text-gray-500 dark:text-gray-400">Final results locked</p>}</div>
        else if (studentTable && index === 7) content = <StatusBadge status={student.placement_status} label={student.placement_status === 'approved_other_batch' ? 'Approved in another batch' : undefined} />
        else if (studentTable && index === 12 && !fullColumns) content = value ? <div><p className="font-medium text-gray-700 dark:text-gray-200">{value}</p><p className="text-gray-400 dark:text-gray-500">{student.top_company}</p></div> : <span className="text-gray-400 dark:text-gray-500">—</span>
        else if (score && value != null) content = <strong className={`font-semibold tabular-nums ${scoreColor(value)}`}>{value}%</strong>
        else if (numeric) content = <span className="tabular-nums">{value}</span>
        else if (!studentTable && cellIndex === 0) content = <span className="font-medium text-gray-900 dark:text-white">{value ?? '—'}</span>
        return <td key={cell.id} className={`${styles.cell} ${cellIndex === 0 || cellIndex === cells.length - 1 ? 'px-5!' : ''} ${numeric || score ? 'text-center' : ''} ${score ? matchSurface(value) : ''}`}>{content}</td>
      })}</tr>)}</tbody>
    </table>
  </div>
}
