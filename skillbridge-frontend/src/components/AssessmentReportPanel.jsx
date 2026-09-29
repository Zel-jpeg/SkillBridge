import { useState } from 'react'
import api from '../api/axios'
import { useApi } from '../hooks/useApi'
import { manilaDateTime } from '../utils/assessmentDates'
import { buildAssessmentReportPdf } from '../utils/assessmentReportPdf'

const kinds = [['batch_progress', 'Batch Assessment Progress'], ['student_competency', 'Student Competency'], ['assessment_completion', 'Assessment Completion']]
const field = 'min-w-0 max-w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 dark:border-gray-700 dark:bg-gray-800 dark:text-white'

export default function AssessmentReportPanel() {
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
  const params = () => ({ type: kind, ...(batch && { batch_id: batch }), ...(assessment && { assessment_id: assessment }), ...(student && { student_id: student }) })
  const generate = async () => {
    setBusy(true); setError('')
    try { setPayload((await api.get('/api/management/assessment-reports/', { params: params() })).data) }
    catch (err) { setError(err.response?.data?.error || 'Report could not be generated.') }
    finally { setBusy(false) }
  }
  const csv = async () => {
    setBusy(true); setError('')
    try {
      const response = await api.get('/api/management/assessment-reports/', { params: { ...params(), export: 'csv' }, responseType: 'blob' })
      const url = URL.createObjectURL(response.data)
      const link = document.createElement('a'); link.href = url; link.download = `skillbridge-${kind}-${new Date().toISOString().slice(0, 10)}.csv`; link.click()
      setTimeout(() => URL.revokeObjectURL(url), 1000)
    } catch { setError('CSV export failed.') } finally { setBusy(false) }
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
    } catch { setError('PDF export failed.') } finally { setBusy(false) }
  }
  return <section className="rounded-2xl border border-gray-100 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
    <h2 className="text-sm font-bold text-gray-900 dark:text-white">Assessment reports</h2>
    <p className="mb-3 text-xs text-gray-500 dark:text-gray-400">Progress and scores stay assessment-specific; recommendations appear only after final completion. No answer keys are exported.</p>
    <div className="flex flex-wrap gap-2">
      <select aria-label="Report type" className={field} value={kind} onChange={e => { setKind(e.target.value); setPayload(null) }}>{kinds.map(([value, name]) => <option key={value} value={value}>{name}</option>)}</select>
      <select aria-label="Batch filter" className={field} value={batch} onChange={e => { setBatch(e.target.value); setAssessment(''); setPayload(null) }}><option value="">All batches</option>{batches.map(b => <option key={b.id} value={b.id}>{b.name} · {b.instructor_name}</option>)}</select>
      <select aria-label="Assessment filter" className={field} value={assessment} onChange={e => { setAssessment(e.target.value); setPayload(null) }}><option value="">All assessments</option>{assessments.filter(a => !batch || String(a.batch_id) === batch).map(a => <option key={a.id} value={a.id}>{a.title}</option>)}</select>
      {kind === 'student_competency' && <input className={field} aria-label="Student database ID" placeholder="Student database ID (optional)" value={student} onChange={e => { setStudent(e.target.value); setPayload(null) }} />}
      <button disabled={busy} className="rounded-lg bg-green-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50" onClick={generate}>Generate report</button>
      <button disabled={busy} className="rounded-lg border border-green-600 px-4 py-2 text-sm font-semibold text-green-700 disabled:opacity-50 dark:text-green-400" onClick={csv}>Download CSV</button>
      <button disabled={busy || !payload} className="rounded-lg border border-green-600 px-4 py-2 text-sm font-semibold text-green-700 disabled:opacity-50 dark:text-green-400" onClick={pdf}>Download PDF</button>
    </div>
    {error && <p role="alert" className="mt-3 text-sm text-rose-700 dark:text-rose-400">{error}</p>}
    {payload && <div className="mt-4"><p className="mb-2 text-xs text-gray-500 dark:text-gray-400">Generated {manilaDateTime(payload.generated_at)} · {payload.rows.length} records</p>{payload.rows.length === 0 ? <p className="text-sm text-gray-500">No records match the selected filters.</p> : <div className="max-h-72 overflow-auto"><table className="min-w-[650px] w-full text-left text-xs text-gray-700 dark:text-gray-300"><thead className="sticky top-0 bg-gray-100 dark:bg-gray-800"><tr>{kind === 'assessment_completion' ? ['Assessment', 'Batch', 'Assigned', 'Submitted', 'In progress', 'Not started', 'Stopped/flagged', 'Completion'].map(h => <th key={h} className="p-2">{h}</th>) : ['Student', 'Batch', 'Progress', 'Recommendations', 'Assessments'].map(h => <th key={h} className="p-2">{h}</th>)}</tr></thead><tbody>{payload.rows.map((r, i) => <tr key={i} className="border-t border-gray-100 dark:border-gray-800">{kind === 'assessment_completion' ? [r.assessment, r.batch, r.assigned, r.submitted, r.in_progress, r.not_started, r.stopped_or_flagged, `${r.completion_percentage}%`].map((v, j) => <td key={j} className="p-2">{v}</td>) : [r.student, r.batch, `${r.completed_required_count}/${r.total_required_count}`, r.recommendations_locked ? 'Locked' : 'Unlocked', r.assessments.map(a => `${a.title}: ${a.status}`).join(' · ')].map((v, j) => <td key={j} className="p-2">{v}</td>)}</tr>)}</tbody></table></div>}</div>}
  </section>
}
