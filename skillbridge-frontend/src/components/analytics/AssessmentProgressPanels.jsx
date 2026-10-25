import { useState } from 'react'
import { ChevronRightIcon, ReportIcon, UserIcon } from '../Icons'
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
  const assigned = data.assessments.reduce((sum, row) => sum + row.assigned, 0)
  const submitted = data.assessments.reduce((sum, row) => sum + row.submitted, 0)
  const batches = data.batches.slice((batchPage - 1) * PAGE_SIZE, batchPage * PAGE_SIZE)
  const assessments = data.assessments.slice((attemptPage - 1) * PAGE_SIZE, attemptPage * PAGE_SIZE)
  return <div className="ap-panels">
    <section className="ap-panel" aria-label="Required completion by batch">
      <PanelHeader title="Required completion by batch" description="Students who completed all required assessments in each batch."><UserIcon size={23} /></PanelHeader>
      <div className="ap-summary"><div><strong>{data.summary.completion_rate == null ? '—' : `${data.summary.completion_rate}%`}</strong><p>{data.summary.students ? 'required work complete' : 'No students in scope'}</p></div><span>{data.batches.length} {data.batches.length === 1 ? 'batch' : 'batches'}</span></div>
      <div className="ap-rows">{batches.length ? batches.map(row => {
        const remaining = Math.max(0, row.total - row.completed)
        const width = row.total > 0 ? Math.max(0, Math.min(100, row.completed / row.total * 100)) : 0
        return <article key={row.id} className="ap-batch">
          <div className="ap-row-title"><h4>{row.name}</h4><span>{row.completed} of {row.total} complete</span></div>
          <div className="ap-track" role="progressbar" aria-label={`${row.name} required completion`} aria-valuemin={0} aria-valuemax={row.total || 1} aria-valuenow={row.completed} aria-valuetext={row.total ? `${row.completed} of ${row.total} students complete` : 'No students in this batch'}><span style={{ width: `${width}%` }} /></div>
          <div className="ap-progress-caption"><span>{row.completion_rate == null ? 'No students in this batch' : `${row.completion_rate}% complete`}</span><span>{remaining} {remaining === 1 ? 'student' : 'students'} remaining</span></div>
          <dl className="ap-counts"><div><dt><i className="ap-dot ap-dot--complete" />Completed</dt><dd>{row.completed}</dd></div><div><dt><i className="ap-dot ap-dot--remaining" />Remaining</dt><dd>{remaining}</dd></div></dl>
          <button type="button" className="ap-batch-action" aria-label={`View students in ${row.name}`} aria-pressed={selection === `batch:${row.id}`} onClick={() => onSelect(`batch:${row.id}`)}><span><strong>View batch students</strong><small>Opens the students in this batch.</small></span><ChevronRightIcon size={18} /></button>
        </article>
      }) : <p className="ap-empty">No batches in this scope. Adjust the report scope to view batch progress.</p>}</div>
      <PanelPagination total={data.batches.length} page={batchPage} onPage={setBatchPage} label="Batch progress pages" />
    </section>
    <section className="ap-panel" aria-label="Assessment attempt status">
      <PanelHeader title="Assessment attempt status" description="Current attempt states for each assigned assessment."><ReportIcon size={23} /></PanelHeader>
      <div className="ap-summary"><div><strong>{assigned ? `${submitted} of ${assigned}` : '—'}</strong><p>{assigned ? 'valid submitted assignments' : 'No student assignments in scope'}</p></div><span>{data.assessments.length} {data.assessments.length === 1 ? 'assessment' : 'assessments'}</span></div>
      <div className="ap-rows">{assessments.length ? assessments.map(row => <article key={row.id} className="ap-assessment">
        <div className="ap-assessment-heading"><h4>{row.name}</h4><p>{row.batch} · {row.assigned} {row.assigned === 1 ? 'student' : 'students'} assigned</p></div>
        <div className="ap-track ap-attempt-track" role="img" aria-label={`${row.name}: ${statuses.map(status => `${row[status.key]} ${status.label.toLowerCase()}`).join(', ')}. ${row.assigned} assigned.`}>{statuses.map(status => <span key={status.key} style={{ backgroundColor: status.color, width: `${row.assigned > 0 ? row[status.key] / row.assigned * 100 : 0}%` }} />)}</div>
        <div className="ap-statuses">{statuses.map(status => <button type="button" key={status.key} aria-label={`${row.name} · ${status.label}: ${row[status.key]}`} aria-pressed={selection === `attempt:${row.id}:${status.key}`} onClick={() => onSelect(`attempt:${row.id}:${status.key}`)}><span><span className="ap-status-label"><i className="ap-dot" style={{ backgroundColor: status.color }} />{status.label}</span><strong>{row[status.key]}</strong></span><ChevronRightIcon size={17} /></button>)}</div>
      </article>) : <p className="ap-empty">No assessments in this scope. Choose another batch or assessment filter.</p>}</div>
      {assessments.length > 0 && <p className="ap-helper">Select a status to view its students. A student can have an assignment in more than one assessment.</p>}
      <PanelPagination total={data.assessments.length} page={attemptPage} onPage={setAttemptPage} label="Assessment status pages" />
    </section>
  </div>
}
