import { useState } from 'react'
import { UserIcon } from '../Icons'
import Pagination from '../Pagination'
import './assessmentProgressPanels.css'

const PAGE_SIZE = 4
const statuses = [
  { key: 'submitted', label: 'Valid submitted', color: '#16a34a' },
  { key: 'in_progress', label: 'In progress', color: '#3b82f6' },
  { key: 'not_started', label: 'Not started', color: '#94a3b8' },
  { key: 'stopped', label: 'Stopped / flagged', color: '#f43f5e' },
]

function usePanelPage(total) {
  const [page, setPage] = useState(1)
  const current = Math.min(page, Math.max(1, Math.ceil(total / PAGE_SIZE)))
  if (current !== page) setPage(current)
  return [current, setPage]
}

function PanelPagination({ total, page, onPage, label }) {
  return total > PAGE_SIZE ? <nav className="ap-pagination" aria-label={label}><Pagination total={total} page={page} onPage={onPage} pageSize={PAGE_SIZE} /></nav> : null
}

function PanelHeader({ title, description, children }) {
  return <header className="ap-header"><span className="ap-icon" aria-hidden="true">{children}</span><div><h3>{title}</h3><p>{description}</p></div></header>
}

export default function AssessmentProgressPanels({ data, onSelect, selection }) {
  const [batchPage, setBatchPage] = usePanelPage(data.batches.length)
  const [attemptPage, setAttemptPage] = usePanelPage(data.assessments.length)
  const batches = data.batches.slice((batchPage - 1) * PAGE_SIZE, batchPage * PAGE_SIZE)
  const assessments = data.assessments.slice((attemptPage - 1) * PAGE_SIZE, attemptPage * PAGE_SIZE)
  return <div className="ap-panels">
    <section className="ap-panel" aria-label="Required completion by batch">
      <PanelHeader title="Required completion by batch" description="Students who completed all required assessments in each batch."><UserIcon size={23} /></PanelHeader>
      <div className="ap-summary"><div><strong>{data.summary.completion_rate == null ? '—' : `${data.summary.completion_rate}%`}</strong><p>{data.summary.students ? 'required work complete' : 'No students in scope'}</p></div><span>{data.batches.length} {data.batches.length === 1 ? 'batch' : 'batches'}</span></div>
      <div className="ap-rows">{batches.length ? batches.map(row => {
        const remaining = Math.max(0, row.total - row.completed)
        return <article key={row.id} className="ap-batch">
          <div className="ar-batch-row"><h4>{row.name}</h4><div className="ar-stacked"><button type="button" className="ar-band-strong" style={{ flex: row.completed || 0.01 }} onClick={() => onSelect(`batch-score:${row.id}:complete`)} aria-label={`${row.name}: ${row.completed} complete`}>{row.completed}</button><button type="button" className="ar-band-missing" style={{ flex: remaining || 0.01 }} onClick={() => onSelect(`batch-score:${row.id}:incomplete`)} aria-label={`${row.name}: ${remaining} incomplete`}>{remaining}</button></div><button type="button" aria-pressed={selection === `batch:${row.id}`} onClick={() => onSelect(`batch:${row.id}`)}>{row.completed} / {row.total}</button></div>
        </article>
      }) : <p className="ap-empty">No batches in this scope. Adjust the report scope to view batch progress.</p>}</div>
      <PanelPagination total={data.batches.length} page={batchPage} onPage={setBatchPage} label="Batch progress pages" />
    </section>
    <section className="ap-panel ar-attempt-details" aria-label="Assessment attempt status">
      <h3>Current attempt states</h3><p className="ap-helper">Counts assignments, not distinct students.</p>
      <div className="ar-attempt-totals">{statuses.map(status => <div key={status.key}><span><i className="ap-dot" style={{ backgroundColor: status.color }} />{status.label}</span><strong>{data.assessments.reduce((sum, row) => sum + row[status.key], 0)}</strong></div>)}</div>
      <div className="ar-attempt-table"><table><caption className="sr-only">Current assignments by assessment; select a count to view students.</caption><thead><tr><th>Assessment</th>{statuses.map(status => <th key={status.key}>{status.label}</th>)}</tr></thead><tbody>{assessments.map(row => <tr key={row.id}><th>{row.name}<small>{row.batch}</small></th>{statuses.map(status => <td key={status.key}><button type="button" aria-label={`${row.name} · ${status.label}: ${row[status.key]}`} onClick={() => onSelect(`attempt:${row.id}:${status.key}`)}>{row[status.key]}</button></td>)}</tr>)}</tbody></table></div>
      {!assessments.length && <p className="ap-empty">No assessments in this scope.</p>}
      <PanelPagination total={data.assessments.length} page={attemptPage} onPage={setAttemptPage} label="Assessment status pages" />
    </section>
  </div>
}
