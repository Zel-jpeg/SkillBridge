import { useEffect, useMemo, useState } from 'react'
import AssessmentSettings from '../../components/instructor/AssessmentSettings'
import { manilaApiDate, manilaDateTime, toManilaInput } from '../../utils/assessmentDates'
import AssessmentStudentDetail from '../../components/AssessmentStudentDetail'
import ConfirmModal from '../../components/admin/ConfirmModal'
import api from '../../api/axios'
import { fetchWithDedup, invalidateCache, useApi } from '../../hooks/useApi'
import { filterAssessments } from '../../utils/assessmentManagement'

const input = 'rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 dark:border-gray-700 dark:bg-gray-800 dark:text-white'

export default function AdminAssessments() {
  const { data, loading, error } = useApi('/api/instructor/assessments/')
  const assessments = useMemo(() => Array.isArray(data) ? data : [], [data])
  const [filters, setFilters] = useState({ search: '', instructor: 'all', batch: 'all', state: 'all', required: 'all', category: 'all', completion: 'all' })
  const [selected, setSelected] = useState(null)
  const [draft, setDraft] = useState(null)
  const rosterUrl = selected?.batch_id ? `/api/instructor/batches/${selected.batch_id}/students/` : null
  const { data: rosterData } = useApi(rosterUrl)
  const roster = rosterData?.students || []
  const [selectedStudent, setSelectedStudent] = useState(null)
  const [questions, setQuestions] = useState(null)
  const [confirm, setConfirm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const set = (key, value) => setFilters(prev => ({ ...prev, [key]: value }))
  const options = key => [...new Set(assessments.map(a => a[key]).filter(Boolean))].sort()
  const categories = [...new Set(assessments.flatMap(a => a.categories || []))].sort()
  const filtered = filterAssessments(assessments, filters)
  useEffect(() => {
    if (selectedStudent && rosterData) {
      const latest = roster.find(student => student.id === selectedStudent.id)
      if (latest && latest !== selectedStudent) setSelectedStudent(latest)
    }
  }, [rosterData]) // eslint-disable-line react-hooks/exhaustive-deps
  const open = assessment => {
    setSelected(assessment); setSelectedStudent(null); setQuestions(null); setMessage('')
    setDraft({ title: assessment.title, duration_minutes: assessment.duration_minutes,
      publication_status: assessment.publication_status, is_required: assessment.is_required,
      include_in_competency: assessment.include_in_competency, display_order: String(assessment.display_order),
      available_at: toManilaInput(assessment.available_at), due_at: toManilaInput(assessment.due_at) })
  }
  const save = async () => {
    setConfirm(false); setSaving(true); setMessage('')
    try {
      const response = await api.patch(`/api/instructor/assessments/${selected.id}/`, { ...draft,
        display_order: Number(draft.display_order), available_at: manilaApiDate(draft.available_at), due_at: manilaApiDate(draft.due_at) })
      setSelected(prev => ({ ...prev, ...response.data }))
      const urls = ['/api/instructor/assessments/', '/api/admin/users/', '/api/admin/stats/']
      urls.forEach(invalidateCache)
      window.dispatchEvent(new CustomEvent('sse:data_changed', { detail: { urls } }))
      if (selected.batch_id) {
        try {
          invalidateCache(rosterUrl)
          const latest = await fetchWithDedup(rosterUrl)
          setSelectedStudent(previous => (latest.data.students || []).find(student => student.id === previous?.id) || null)
        } catch { /* Keep the last roster on refresh failure. */ }
      }
      setMessage('Assessment updated. Student completion and recommendations now reflect the server state.')
    } catch (err) { setMessage(err.response?.data?.error || 'Update failed. Please retry.') }
    finally { setSaving(false) }
  }
  const retake = async (studentId, assessmentId) => {
    const student = roster.find(s => s.id === studentId)
    const attempt = student?.assessment_results.find(a => a.id === assessmentId)
    if (!attempt) return
    try {
      await api.patch(`/api/instructor/students/${studentId}/retake/`, { assessment_id: assessmentId, retake_allowed: !attempt.retake_allowed })
      invalidateCache(rosterUrl)
      const response = await fetchWithDedup(rosterUrl)
      setSelectedStudent((response.data.students || []).find(s => s.id === studentId))
      invalidateCache('/api/admin/users/')
      invalidateCache('/api/admin/stats/')
      setMessage('Assessment-specific retake updated.')
    } catch (err) { setMessage(err.response?.data?.error || 'Retake update failed.') }
  }
  return <div className="min-w-0">
    <section className="mx-auto flex max-w-7xl flex-col gap-5 px-4 py-6 sm:px-6">
      <header><h1 className="text-xl font-bold text-gray-900 dark:text-white">Assessment oversight</h1><p className="text-sm text-gray-500 dark:text-gray-400">System-wide publication, completion, and integrity status.</p></header>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">{[
        ['Total', assessments.length], ['Published', assessments.filter(a => a.publication_status === 'published').length],
        ['Draft', assessments.filter(a => a.publication_status === 'draft').length], ['Closed', assessments.filter(a => a.publication_status === 'closed').length],
        ['Stopped / flagged', assessments.reduce((n, a) => n + a.flagged_count, 0)],
      ].map(([name, value]) => <div key={name} className="rounded-xl border border-gray-100 bg-white p-3 dark:border-gray-800 dark:bg-gray-900"><strong className="text-xl text-gray-900 dark:text-white">{value}</strong><p className="text-xs text-gray-500 dark:text-gray-400">{name}</p></div>)}</div>
      <div className="flex flex-wrap gap-2" aria-label="Assessment filters">
        <input className={`${input} w-full min-w-[180px] sm:flex-1`} aria-label="Search assessments" placeholder="Search title, instructor, batch" value={filters.search} onChange={e => set('search', e.target.value)} />
        {[
          ['instructor', 'All instructors', options('instructor_name').map(v => [v, v])],
          ['batch', 'All batches', assessments.filter(a => a.batch_id).map(a => [String(a.batch_id), a.batch_name])],
          ['state', 'All states', [['draft', 'Draft'], ['published', 'Published'], ['closed', 'Closed']]],
          ['required', 'Required + optional', [['required', 'Required'], ['optional', 'Optional']]],
          ['category', 'All categories', categories.map(v => [v, v])],
          ['completion', 'Any completion', [['complete', '100% complete'], ['incomplete', 'Below 100%']]],
        ].map(([key, placeholder, values]) => <select key={key} aria-label={placeholder} className={input} value={filters[key]} onChange={e => set(key, e.target.value)}><option value="all">{placeholder}</option>{[...new Map(values).entries()].map(([v, name]) => <option key={v} value={v}>{name}</option>)}</select>)}
      </div>
      {loading ? <p className="text-sm text-gray-500">Loading assessments…</p> : error ? <p role="alert" className="text-sm text-rose-700">Could not load assessments.</p> : filtered.length === 0 ? <p className="rounded-xl bg-white p-8 text-sm text-gray-500 dark:bg-gray-900">No assessments match these filters.</p> :
        <div className="overflow-x-auto rounded-xl border border-gray-100 bg-white dark:border-gray-800 dark:bg-gray-900"><table className="min-w-[900px] w-full text-left text-xs"><thead className="bg-gray-50 text-gray-600 dark:bg-gray-800 dark:text-gray-300"><tr>{['Assessment', 'Instructor / batch', 'State', 'Settings', 'Categories', 'Schedule', 'Progress', 'Integrity'].map(h => <th key={h} className="px-3 py-3">{h}</th>)}</tr></thead><tbody>{filtered.map(a => <tr key={a.id} className="border-t border-gray-100 dark:border-gray-800"><td className="px-3 py-3"><button className="max-w-48 break-words text-left font-semibold text-green-700 underline dark:text-green-400" onClick={() => open(a)}>{a.title}</button><p>{a.question_count} questions · {a.duration_minutes} min</p></td><td className="px-3 py-3">{a.instructor_name}<br />{a.batch_name || 'Unassigned'}</td><td className="px-3 py-3 capitalize">{a.publication_status}</td><td className="px-3 py-3">{a.is_required ? 'Required' : 'Optional'}<br />{a.include_in_competency ? 'Included' : 'Excluded'} · #{a.display_order}</td><td className="px-3 py-3">{a.categories.join(', ') || 'None'}</td><td className="px-3 py-3">{a.availability_status}<br />Due {manilaDateTime(a.due_at)}</td><td className="px-3 py-3">{a.submission_count}/{a.assigned_count} submitted<br />{a.completion_rate}% complete</td><td className="px-3 py-3">{a.flagged_count} stopped / flagged</td></tr>)}</tbody></table></div>}
    </section>
    {selected && draft && <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 sm:items-center sm:p-4" onClick={event => event.target === event.currentTarget && setSelected(null)}><div role="dialog" aria-modal="true" aria-label={`Manage ${selected.title}`} className="flex max-h-[95dvh] w-full flex-col rounded-t-2xl bg-white shadow-xl sm:max-w-3xl sm:rounded-2xl dark:bg-gray-900"><header className="flex items-start justify-between gap-2 border-b border-gray-100 p-4 dark:border-gray-800"><h2 className="break-words font-bold text-gray-900 dark:text-white">{selected.title} · {selected.batch_name}</h2><button className="text-sm text-gray-500" onClick={() => setSelected(null)}>Close</button></header><div className="space-y-5 overflow-y-auto p-4">
      {message && <p role="status" className="rounded-lg bg-gray-100 p-2 text-sm text-gray-800 dark:bg-gray-800 dark:text-gray-200">{message}</p>}
      <div className="grid gap-3 sm:grid-cols-2"><label className="text-xs font-semibold text-gray-700 dark:text-gray-300">Title<input className={`${input} mt-1 w-full`} value={draft.title} onChange={e => setDraft({ ...draft, title: e.target.value })} /></label><label className="text-xs font-semibold text-gray-700 dark:text-gray-300">Duration · minutes<input type="number" min="1" className={`${input} mt-1 w-full`} value={draft.duration_minutes} onChange={e => setDraft({ ...draft, duration_minutes: e.target.value })} /></label></div>
      <AssessmentSettings value={draft} onChange={setDraft} />
      <p className="text-xs text-gray-500 dark:text-gray-400">Changing a required or included assessment can lock or recalculate final recommendations. Existing attempts and scores remain preserved.</p>
      <button disabled={saving} className="rounded-lg bg-green-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50" onClick={() => setConfirm(true)}>{saving ? 'Saving…' : 'Save metadata'}</button>
      <section><div className="flex items-center justify-between"><h3 className="text-sm font-semibold text-gray-900 dark:text-white">Questions</h3><button className="text-xs text-green-700 underline dark:text-green-400" onClick={async () => { const res = await api.get(`/api/instructor/assessments/${selected.id}/questions/`); setQuestions(res.data.questions) }}>View authorized answer key</button></div>{questions?.map((q, i) => <p key={q.id} className="border-b border-gray-100 py-2 text-xs text-gray-700 dark:border-gray-800 dark:text-gray-300">{i + 1}. {q.question_text} · {q.category?.name} · Key: {q.choices?.filter(c => c.is_correct).map(c => c.text).join(', ')}</p>)}</section>
      <section><h3 className="mb-2 text-sm font-semibold text-gray-900 dark:text-white">Student attempts · {roster.length} assigned</h3>{roster.length === 0 ? <p className="text-xs text-gray-500">No students enrolled.</p> : roster.map(student => <button key={student.id} className="flex w-full flex-wrap justify-between gap-2 border-b border-gray-100 py-2 text-left text-xs text-gray-700 dark:border-gray-800 dark:text-gray-300" onClick={() => setSelectedStudent(student)}><span>{student.name} · {student.school_id}</span><span>{student.completed_required_count}/{student.total_required_count} required · {student.assessment_results?.find(a => a.id === selected.id)?.attempt_status || 'Not started'}</span></button>)}</section>
      {selectedStudent && <section className="border-t border-gray-100 pt-3 dark:border-gray-800"><h3 className="mb-2 text-sm font-bold text-gray-900 dark:text-white">{selectedStudent.name}</h3><AssessmentStudentDetail student={selectedStudent} onToggleRetake={retake} /></section>}
    </div></div></div>}
    {confirm && <ConfirmModal tone="confirm" title="Save assessment changes?" message="Publication, required status, and competency inclusion can change student completion and recommendation locks. Existing attempts stay intact. The server will recalculate affected profiles." confirmLabel="Save" onConfirm={save} onCancel={() => setConfirm(false)} />}
  </div>
}
