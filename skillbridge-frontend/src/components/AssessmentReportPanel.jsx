import { useToast } from '../context/ToastContext'
import DataSection from './DataSection'
import { useState } from 'react'
import api from '../api/axios'
import { useApi } from '../hooks/useApi'
import { useSnapshotFreshness } from '../hooks/useSnapshotFreshness'
import { manilaDateTime } from '../utils/assessmentDates'
import { buildAssessmentReportPdf } from '../utils/assessmentReportPdf'
import Avatar from './Avatar'
import { reportTableStyles as tableStyles } from './analytics/reportTableStyles'

const kinds = [['batch_progress', 'Batch Assessment Progress'], ['student_competency', 'Student Competency'], ['assessment_completion', 'Assessment Completion']]
const field = 'min-w-0 max-w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 dark:border-gray-700 dark:bg-gray-800 dark:text-white'

function AssessmentReportTable({ payload, kind }) {
  const completion = kind === 'assessment_completion'
  const columns = completion ? ['Assessment', 'Batch', 'Assigned', 'Submitted', 'In progress', 'Not started', 'Stopped/flagged', 'Completion'] : ['Student', 'Batch', 'Progress', 'Recommendations', 'Assessments']
  return <div role="region" aria-label="Individual assessment report table" tabIndex={0} className={`max-h-80 ${tableStyles.frame}`}><table className={`min-w-[650px] ${tableStyles.table}`}>
    <caption className="sr-only">Generated individual assessment report</caption>
    <thead className={tableStyles.head}><tr>{columns.map((column, index) => <th scope="col" key={column} className={`${index === 0 ? 'px-5' : 'px-3'} py-3.5 font-medium ${completion && index >= 2 ? 'text-center' : ''}`}>{column}</th>)}</tr></thead>
    <tbody>{payload.rows.map((row, index) => {
      const values = completion ? [row.assessment, row.batch, row.assigned, row.submitted, row.in_progress, row.not_started, row.stopped_or_flagged, `${row.completion_percentage}%`] : [row.student, row.batch, `${row.completed_required_count}/${row.total_required_count}`, row.recommendations_locked ? 'Locked' : 'Unlocked', row.assessments.map(item => `${item.title}: ${item.status}`).join(' · ')]
      return <tr key={index} className={tableStyles.row}>{values.map((value, column) => <td key={column} className={`${tableStyles.cell} ${column === 0 ? 'px-5!' : ''} ${completion && column >= 2 ? 'text-center tabular-nums' : ''}`}>{column === 0 ? <div className="flex items-center gap-3">{!completion && <Avatar name={row.student} className="h-7 w-7 rounded-full text-xs" />}<span className="font-medium text-gray-900 dark:text-white">{value}</span></div> : value}</td>)}</tr>
    })}</tbody>
  </table></div>
}

export default function AssessmentReportPanel({ embedded = false }) {
  const { showToast } = useToast()
  const { data: batchesData } = useApi('/api/instructor/batches/')
  const { data: assessmentsData } = useApi('/api/instructor/assessments/')
  const batches = Array.isArray(batchesData) ? batchesData : []
  const assessments = Array.isArray(assessmentsData) ? assessmentsData : []
  const [kind, setKind] = useState('batch_progress')
  const [batch, setBatch] = useState('')
  const [assessment, setAssessment] = useState('')
  const [student, setStudent] = useState('')
  const [payload, setPayload] = useState(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const freshness = useSnapshotFreshness(['students', 'batches', 'assessments', 'results', 'placements', 'taxonomy', 'catalog'])
  const params = () => ({ type: kind, ...(batch && { batch_id: batch }), ...(assessment && { assessment_id: assessment }), ...(student && { student_id: student }) })
  const generate = async () => {
    setBusy(true); setError('')
    const revision = freshness.begin()
    try { setPayload((await api.get('/api/management/assessment-reports/', { params: params() })).data); freshness.complete(revision); showToast('Assessment report generated.') }
    catch (err) { const message = err.response?.data?.error || 'Report could not be generated.'; setError(message); showToast(message, 'error') }
    finally { setBusy(false) }
  }
  const csv = async () => {
    setBusy(true); setError('')
    try {
      const response = await api.get('/api/management/assessment-reports/', { params: { ...params(), export: 'csv' }, responseType: 'blob' })
      const url = URL.createObjectURL(response.data)
      const link = document.createElement('a'); link.href = url; link.download = `skillbridge-${kind}-${new Date().toISOString().slice(0, 10)}.csv`; link.click()
      setTimeout(() => URL.revokeObjectURL(url), 1000)
      showToast('CSV report downloaded.')
    } catch { setError('CSV export failed.'); showToast('CSV export failed.', 'error') } finally { setBusy(false) }
  }
  const pdf = async () => {
    if (!payload) return
    setBusy(true); setError('')
    try {
      const [{ jsPDF }, autoTableModule] = await Promise.all([import('jspdf'), import('jspdf-autotable')])
      const doc = buildAssessmentReportPdf(payload, {
        batch: batches.find(item => String(item.id) === batch)?.name,
        assessment: assessments.find(item => String(item.id) === assessment)?.title,
        student,
      }, jsPDF, autoTableModule.default)
      doc.save(`skillbridge-${kind}-${new Date().toISOString().slice(0, 10)}.pdf`)
      showToast('PDF report downloaded.')
    } catch { setError('PDF export failed.'); showToast('PDF export failed.', 'error') } finally { setBusy(false) }
  }
  return <section aria-label="Individual assessment report controls" className={embedded ? 'min-w-0 [&_select]:min-h-11 [&_select]:text-xs [&_input]:text-xs [&_button]:min-h-11 [&_button]:text-xs' : 'rounded-2xl border border-gray-100 bg-white p-4 dark:border-gray-800 dark:bg-gray-900'}>
    {!embedded && <h2 className="text-sm font-bold text-gray-900 dark:text-white">Assessment reports</h2>}
    <p className="mb-3 text-xs leading-5 text-gray-500 dark:text-gray-400">{embedded ? 'Choose filters for this individual report. ' : ''}Progress and scores stay assessment-specific; recommendations appear only after final completion. No answer keys are exported.</p>
<DataSection urls={['/api/instructor/batches/', '/api/instructor/assessments/']} layout="panel" count={1}>    <div className="flex flex-wrap gap-2">
      <select aria-label="Report type" className={field} value={kind} onChange={e => { setKind(e.target.value); setPayload(null) }}>{kinds.map(([value, name]) => <option key={value} value={value}>{name}</option>)}</select>
      <select aria-label="Batch filter" className={field} value={batch} onChange={e => { setBatch(e.target.value); setAssessment(''); setPayload(null) }}><option value="">All batches</option>{batches.map(b => <option key={b.id} value={b.id}>{b.name} · {b.instructor_name}</option>)}</select>
      <select aria-label="Assessment filter" className={field} value={assessment} onChange={e => { setAssessment(e.target.value); setPayload(null) }}><option value="">All assessments</option>{assessments.filter(a => !batch || String(a.batch_id) === batch).map(a => <option key={a.id} value={a.id}>{a.title}</option>)}</select>
      {kind === 'student_competency' && <input className={field} aria-label="Student database ID" placeholder="Student database ID (optional)" value={student} onChange={e => { setStudent(e.target.value); setPayload(null) }} />}
      <button disabled={busy} className="rounded-lg bg-green-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50" onClick={generate}>Generate report</button>
      <button disabled={busy} className="rounded-lg border border-green-600 px-4 py-2 text-sm font-semibold text-green-700 disabled:opacity-50 dark:text-green-400" onClick={csv}>Download CSV</button>
      <button disabled={busy || !payload} className="rounded-lg border border-green-600 px-4 py-2 text-sm font-semibold text-green-700 disabled:opacity-50 dark:text-green-400" onClick={pdf}>Download PDF</button>
    </div></DataSection>
    {error && <p role="alert" className="mt-3 text-sm text-rose-700 dark:text-rose-400">{error}</p>}
    {payload && freshness.stale && <p role="status" className="mt-3 text-sm text-amber-700 dark:text-amber-400">Underlying data may have changed. This report still shows its generated snapshot. <button type="button" onClick={generate} disabled={busy} className="underline">Regenerate report</button></p>}
    {payload && <div className="mt-4"><p className="mb-2 text-xs text-gray-500 dark:text-gray-400">Generated {manilaDateTime(payload.generated_at)} · {payload.rows.length} records</p>{payload.rows.length === 0 ? <p className="text-sm text-gray-500">No records match the selected filters.</p> : <AssessmentReportTable payload={payload} kind={kind} />}</div>}
  </section>
}
