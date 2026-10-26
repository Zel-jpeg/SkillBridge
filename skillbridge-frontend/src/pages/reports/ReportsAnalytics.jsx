import { AnalyticsSkeleton, InsightsSkeleton } from '../../components/loading/Skeletons'
import { lazy, Suspense, useMemo, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useApi } from '../../hooks/useApi'
import { useSSE } from '../../hooks/useSSE'
import { useToast } from '../../context/ToastContext'
import DataSection from '../../components/DataSection'
import DialogShell from '../../components/DialogShell'
import StudentModal from '../../components/instructor/StudentModal'
import Pagination from '../../components/Pagination'
import AnalyticsRecordTable from '../../components/analytics/AnalyticsRecordTable'
import AnalyticsStudentCards from '../../components/analytics/AnalyticsStudentCards'
import CollectionViewToggle from '../../components/CollectionViewToggle'
import { useAnalyticsRecords } from '../../hooks/useAnalyticsRecords'
import { useAnalyticsData } from '../../hooks/useAnalyticsData'
import ActivityDateFilter from '../../components/analytics/ActivityDateFilter'
import AssessmentProgressPanels from '../../components/analytics/AssessmentProgressPanels'
import { BriefcaseIcon, ChevronDown, ReportIcon, SearchIcon, SkillIcon } from '../../components/Icons'
import { ActivityLine, ChartPanel } from '../../components/analytics/AnalyticsCharts'
import { analyticsCsv, analyticsFilterText, analyticsSelectionLabel, analyticsTable, selectAnalyticsStudents } from '../../utils/analytics'
import { normalizeStudent } from '../../utils/managementStudent'
import { activityPeriodLabel } from '../../utils/activityPeriods'
import { activityReport, analyticsSourceUrl } from '../../utils/analyticsActivity'
import { manilaDateTime } from '../../utils/assessmentDates'

const AssessmentReportPanel = lazy(() => import('../../components/AssessmentReportPanel'))
const SkillsInsights = lazy(() => import('../../components/analytics/SkillsInsights'))
const PlacementInsights = lazy(() => import('../../components/analytics/PlacementInsights'))
const AdminRecommendationTools = lazy(() => import('../admin/AdminRecommendationTools'))
const field = 'min-h-12 w-full min-w-0 rounded-xl border border-gray-300 bg-white px-3 py-2.5 text-xs text-gray-900 focus-visible:outline-2 focus-visible:outline-green-600 sm:text-xs dark:border-gray-700 dark:bg-gray-900 dark:text-white'
const button = 'inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-gray-300 bg-white px-4 py-2.5 text-xs font-medium text-gray-700 transition-colors hover:border-green-400 hover:bg-green-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-green-600 disabled:opacity-50 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200 dark:hover:bg-green-950'
const activeButton = `${button} border-green-700! bg-green-700! text-white! hover:bg-green-800! dark:border-green-600! dark:bg-green-600!`
const panel = 'min-w-0 rounded-2xl border border-gray-200 bg-white p-5 sm:p-7 dark:border-gray-800 dark:bg-gray-900'
const sections = [
  { key: 'assessments', label: 'Assessments', description: 'Completion & follow-up', icon: <ReportIcon size={22} />, title: 'Assessment progress', intro: 'See who has completed the required work and where follow-up is needed.' },
  { key: 'skills', label: 'Skills', description: 'Competency & matches', icon: <SkillIcon size={22} />, title: 'Skills & recommendation insights', intro: 'Identify strengths and areas for support using current final results.' },
  { key: 'placements', label: 'Placements', description: 'Decisions & capacity', icon: <BriefcaseIcon size={22} />, title: 'Placement overview', intro: 'Track approved placements, students awaiting review and available OJT slots.' },
]

function ReportSummary({ data, tab }) {
  const s = data.summary
  const cards = tab === 'assessments' ? [
    ['Students in scope', s.students, 'Students in the selected batches'],
    ['Required work complete', s.required_complete, s.completion_rate == null ? 'No students in scope' : `${s.completion_rate}% of students in scope`],
    ['Need follow-up', s.needs_followup, 'Students with work or results to review'],
  ] : tab === 'skills' ? [
    ['Students in scope', s.students, 'Students in the selected batches'],
    ['Current final results', data.students.filter(row => !row.recommendations_locked).length, 'Current results from completed assessments'],
    ['Results unavailable', data.students.filter(row => row.recommendations_locked).length, 'Missing, incomplete or locked final evidence'],
  ] : [
    ['Approved in selected batches', `${s.approved} / ${s.students}`, `${s.unplaced} unplaced${s.approved_other_batch ? ` · ${s.approved_other_batch} approved in another batch` : ''}`],
    ['Awaiting review', s.awaiting_review, 'Unplaced students with current recommendations'],
    ['Remaining OJT slots', s.slots_remaining, 'Shared across all batches; not reserved'],
  ]
  return <dl aria-label="Report summary" className="grid gap-4 md:grid-cols-3 sm:gap-5">{cards.map(([label, value, description]) => <div key={label} className={panel}>
    <dt className="text-xs font-medium text-gray-600 dark:text-gray-300">{label}</dt>
    <dd className="mt-3 text-2xl font-semibold tracking-tight text-gray-900 tabular-nums sm:text-3xl dark:text-white">{value ?? '—'}</dd>
    <dd className="mt-3 text-xs leading-6 text-gray-500 dark:text-gray-400">{description}</dd>
  </div>)}</dl>
}

function StudentDetails({ row, onClose, restoreFocusRef, role }) {
  const url = `/api/instructor/batches/${row.batch_id}/students/`
  const { data } = useApi(url)
  const record = data?.students?.find(student => student.id === row.id)
  if (!record) return <DialogShell title={row.name} description="Loading authorized student details" onClose={onClose} restoreFocusRef={restoreFocusRef}><DataSection url={url} layout="student-detail"><p className="p-5 text-xs">Student is no longer in this roster. Refresh the report.</p></DataSection></DialogShell>
  const student = { ...normalizeStudent(record), batch: { id: row.batch_id, name: row.batch }, instructor: row.instructor }
  return <StudentModal student={student} readOnly isArchived={row.batch_status === 'archived'} instructorName={row.instructor} onClose={onClose} restoreFocusRef={restoreFocusRef} footer={<Link className={button} to={`/${role}/${role === 'admin' ? 'batches' : 'students'}?batch_id=${row.batch_id}`}>Open batch management</Link>} />
}

function SelectFilter({ label, value, onChange, children }) {
  return <label className="block min-w-0 text-xs font-medium leading-6 text-gray-700 dark:text-gray-300">{label}<select aria-label={label} className={`${field} mt-2`} value={value} onChange={event => onChange(event.target.value)}>{children}</select></label>
}

export default function ReportsAnalytics({ role = 'admin' }) {
  useSSE(`/api/${role}/events/`)
  const { showToast } = useToast()
  const [params, setParams] = useSearchParams()
  const tab = ['assessments', 'skills', 'placements'].includes(params.get('tab')) ? params.get('tab') : 'assessments'
  const group = params.get('group') || ''
  const url = analyticsSourceUrl(params)
  const { data: source, updating, error: sourceError, denied, previous, retry } = useAnalyticsData(url)
  const activity = useMemo(() => activityReport(source, params), [source, params])
  const { data } = activity
  const error = sourceError || activity.error
  const options = source?.options ?? { batches: [], instructors: [], courses: [], assessments: [], companies: [], positions: [], areas: [] }
  const [requestedScope, setRequestedScope] = useState(null)
  // Only user-requested scope changes need a visible busy state. Polling/SSE
  // revalidation silently replaces the current authorized snapshot when ready.
  const scopeUpdating = updating && requestedScope === url
  if (requestedScope === url && !updating) setRequestedScope(null)
  function retryReport() { setRequestedScope(url); retry() }
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [student, setStudent] = useState(null)
  const [advanced, setAdvanced] = useState(false)
  const [exportsOpen, setExportsOpen] = useState(false)
  const [downloading, setDownloading] = useState(false)
  const [fullColumns, setFullColumns] = useState(false)
  const [recordView, setRecordView] = useState('list')
  const [sorting, setSorting] = useState([])
  const pending = useRef(false)
  const opener = useRef(null)
  const recordsHeading = useRef(null)
  if (denied && student) setStudent(null)
  function update(changes, clearGroup = false, preserveRecords = false) {
    // Browser history updates before Router's transition commits. Read its latest
    // query so a rapid second action cannot restore filters just cleared by Reset.
    const next = new URLSearchParams(window.location.search)
    for (const [key, value] of Object.entries(changes)) { if (value) next.set(key, value); else next.delete(key) }
    const nextUrl = analyticsSourceUrl(next)
    if (nextUrl !== url) setRequestedScope(nextUrl)
    if (clearGroup) next.delete('group')
    if (!preserveRecords) { setSearch(''); setPage(1); setStudent(null); setSorting([]) }
    setParams(next, { preventScrollReset: true })
  }
  function select(group) {
    update({ group })
    requestAnimationFrame(() => {
      recordsHeading.current?.focus({ preventScroll: true })
      document.getElementById('analytics-records')?.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' })
    })
  }
  const rows = useMemo(() => data ? selectAnalyticsStudents(data, tab, group, search) : [], [data, tab, group, search])
  const table = useMemo(() => data ? analyticsTable(data, tab, group, rows) : null, [data, tab, group, rows])
  const selectionLabel = data ? analyticsSelectionLabel(data, group) : ''
  const tableGroups = ['capacity', 'assessments', 'skills', 'activity', 'geography']
  const studentTable = !tableGroups.includes(group)
  const pageSize = studentTable ? 8 : 10
  const visiblePage = Math.min(page, Math.max(1, Math.ceil((table?.rows.length ?? 0) / pageSize)))
  if (page > visiblePage && data && !updating) setPage(visiblePage)
  const section = sections.find(section => section.key === tab)
  const engine = useAnalyticsRecords({ report: table, students: rows, studentTable, fullColumns, sorting,
    onSortingChange: next => { setSorting(next); setPage(1) } })
  const orderedRecords = engine.getRowModel().rows.map(row => row.original)
  function openStudent(record, element) { opener.current = element; setStudent(record) }
  const scopeText = data ? `Batches: ${data.scope.batch_ids.map(id => data.options.batches.find(batch => batch.id === id)?.name || id).join(', ') || 'none'}; ${data.scope.batch_status}; course: ${data.scope.course || 'all'}` : ''
  async function download(type) {
    if (!data || !table || pending.current || scopeUpdating || error || previous) return
    pending.current = true; setDownloading(true)
    const snapshot = { ...table, rows: orderedRecords.map(row => row.values) }
    const metadata = { Generated: manilaDateTime(data.generated_at), Scope: scopeText,
      Filters: analyticsFilterText(data),
      Records: `${selectionLabel}; search=${search || 'none'}`, Sort: sorting.length ? `${table.columns[Number(sorting[0].id)]} ${sorting[0].desc ? 'descending' : 'ascending'}` : 'Original record order', Unit: data.scope.cohort_unit,
      'Student status scope': tab === 'placements' && ['approved', 'approved_other_batch', 'unplaced', 'awaiting'].includes(group) ? 'Selected students; company, position and area filters do not narrow this status view.' : 'Current report and record filters.',
      Capacity: data.scope.capacity_scope, Activity: `${activityPeriodLabel(data.scope.activity_period)}; ${data.scope.date_from} to ${data.scope.date_to}; grouped by ${data.scope.activity_interval || 'day'}; ${data.scope.activity_note}` }
    try {
      if (type === 'csv') {
        const objectUrl = URL.createObjectURL(new Blob([analyticsCsv(snapshot, metadata)], { type: 'text/csv;charset=utf-8' }))
        const link = document.createElement('a'); link.href = objectUrl; link.download = `skillbridge-${role}-${tab}.csv`; link.click()
        setTimeout(() => URL.revokeObjectURL(objectUrl), 1000)
      } else {
        const [{ jsPDF }, autoTable] = await Promise.all([import('jspdf'), import('jspdf-autotable')])
        const doc = new jsPDF({ orientation: 'landscape', format: 'a4' })
        doc.setFontSize(15); doc.text(`SkillBridge - ${snapshot.title}`, 12, 15)
        autoTable.default(doc, { startY: 22, body: Object.entries(metadata), styles: { fontSize: 8, overflow: 'linebreak' }, columnStyles: { 0: { cellWidth: 25 } }, margin: { left: 12, right: 12 } })
        autoTable.default(doc, { startY: doc.lastAutoTable.finalY + 7, head: [snapshot.columns], body: snapshot.rows.map(row => row.map(value => value ?? '—')), styles: { fontSize: 6.5, overflow: 'linebreak' }, headStyles: { fillColor: [21, 128, 61] }, margin: { left: 12, right: 12, bottom: 15 } })
        doc.save(`skillbridge-${role}-${tab}.pdf`)
      }
      showToast('Displayed analytics snapshot downloaded.')
    } catch { showToast('Could not download this snapshot. Please try again.', 'error') }
    finally { pending.current = false; setDownloading(false) }
  }

  return <section className="mx-auto min-w-0 max-w-360 space-y-8 px-4 py-8 text-xs sm:px-8 sm:py-10 lg:space-y-10">
    <header className="space-y-3">
      <h1 className="text-xl font-semibold tracking-tight text-gray-950 sm:text-2xl dark:text-white">Reports &amp; Analytics</h1>
      <p className="max-w-3xl text-xs leading-5 text-gray-600 dark:text-gray-400">{role === 'admin' ? 'Understand assessment progress, student skills and OJT placements across your batches.' : 'Understand assessment progress, student skills and OJT placements in your batches.'}</p>
    </header>

    <section aria-label="Report scope" className={panel}>
      <div className="mb-5 flex flex-wrap items-start justify-between gap-4">
        <div><h2 className="text-sm font-semibold text-gray-900 dark:text-white">Report scope</h2><p className="mt-1 text-xs leading-6 text-gray-500 dark:text-gray-400">Choose the students and batches to include. Changes apply to every report section.</p></div>
        <button type="button" className={button} onClick={() => { const next = new URLSearchParams({ tab }); if (analyticsSourceUrl(next) !== url) setRequestedScope(analyticsSourceUrl(next)); setParams(next, { preventScrollReset: true }); setPage(1); setSearch(''); setStudent(null); setSorting([]) }}>Reset analytics filters</button>
      </div>
      <fieldset disabled={!source} aria-busy={!source} className={`grid gap-5 sm:grid-cols-2 ${role === 'admin' ? 'xl:grid-cols-4' : 'xl:grid-cols-3'}`}>
        <SelectFilter label="Batch status" value={params.get('batch_status') || 'active'} onChange={value => update({ batch_status: value, batch_id: '', assessment_id: '' }, true)}><option value="active">Active batches</option><option value="archived">Archived history</option><option value="all">Active and archived history</option></SelectFilter>
        <SelectFilter label="Batch" value={params.get('batch_id') || ''} onChange={value => update({ batch_id: value, assessment_id: '' }, true)}><option value="">{role === 'admin' ? 'Current batches in scope' : 'Current batch / latest in history'}</option>{options.batches.filter(batch => (!params.get('batch_status') ? batch.status === 'active' : params.get('batch_status') === 'all' || batch.status === params.get('batch_status')) && (!params.get('instructor_id') || String(batch.instructor_id) === params.get('instructor_id'))).map(batch => <option key={batch.id} value={batch.id}>{batch.name}</option>)}</SelectFilter>
        {role === 'admin' && <SelectFilter label="Instructor" value={params.get('instructor_id') || ''} onChange={value => update({ instructor_id: value, batch_id: '', assessment_id: '' }, true)}><option value="">All instructors</option>{options.instructors.map(owner => <option key={owner.id} value={owner.id}>{owner.name}</option>)}</SelectFilter>}
        <SelectFilter label="Course" value={params.get('course') || ''} onChange={value => update({ course: value }, true)}><option value="">All courses</option>{options.courses.map(course => <option key={course}>{course}</option>)}</SelectFilter>
      </fieldset>
      {!source && !error && <p role="status" className="mt-3 text-xs text-gray-500 dark:text-gray-400">Loading available report filters…</p>}
      {data && <div className="mt-5 space-y-1 border-t border-gray-100 pt-4 text-xs leading-5 text-gray-500 dark:border-gray-800 dark:text-gray-400"><p>{scopeText}</p><p>Each student is counted once, using their latest selected enrollment.{data.scope.batch_status !== 'active' ? ' Archived records are read-only; their final results may be locked.' : ''}</p></div>}
    </section>

    <nav className="grid grid-cols-3 border-b border-gray-200 dark:border-gray-800" aria-label="Analytics sections">{sections.map(({ key, label, description, icon }) => <button type="button" key={key} aria-label={label} aria-pressed={tab === key} onClick={() => { setExportsOpen(false); setFullColumns(false); update({ tab: key, group: '', assessment_id: key === 'assessments' ? params.get('assessment_id') : '', company_id: key === 'placements' ? params.get('company_id') : '', position_id: key === 'placements' ? params.get('position_id') : '', area: key === 'placements' ? params.get('area') : '' }) }} className={`-mb-px flex min-h-16 items-center justify-center gap-3 border-b-2 px-1 py-4 text-left transition-colors focus-visible:outline-2 focus-visible:outline-green-600 sm:justify-start sm:px-5 ${tab === key ? 'border-green-700 text-green-800 dark:border-green-400 dark:text-green-400' : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white'}`}>
      <span aria-hidden="true" className="hidden sm:block">{icon}</span><span><span className="block text-xs font-semibold sm:text-sm">{label}</span><span className="mt-1 hidden text-xs text-gray-500 lg:block dark:text-gray-400">{description}</span></span>
    </button>)}</nav>

    <section aria-label="Report results" aria-busy={scopeUpdating} className="space-y-8">
      {error && <div role="alert" className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-xs leading-5 text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200"><p className="font-semibold">{denied ? 'This report is unavailable or you no longer have access.' : 'The report could not be updated.'}</p><p className="mt-1">{error}</p>{data && <p className="mt-1">Showing the last successfully loaded report.{previous ? ' The new filters have not been applied to these results.' : ''}</p>}<button type="button" disabled={updating} className={`${button} mt-3`} onClick={retryReport}>Retry report</button></div>}
      <div className="pointer-events-none fixed top-20 left-1/2 z-20 m-0! w-max max-w-[calc(100%-32px)] -translate-x-1/2" aria-live="polite">{scopeUpdating && data && <p role="status" className="mx-auto w-fit max-w-full rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-xs leading-5 text-green-900 shadow-sm dark:border-green-900 dark:bg-green-950 dark:text-green-200">Applying report filters… The current report stays visible until the new results are ready.</p>}</div>
      {!data && !error && <><div><h2 className="text-lg font-semibold">{section.title}</h2><p className="mt-2 text-xs text-gray-500 dark:text-gray-400">{section.intro}</p></div><AnalyticsSkeleton tab={tab} /></>}
      {data && <>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div><h2 className="text-lg font-semibold tracking-tight text-gray-900 dark:text-white">{section.title}</h2><p className="mt-2 max-w-3xl text-xs leading-5 text-gray-600 dark:text-gray-400">{section.intro}</p></div>
          <p className="text-xs leading-6 text-gray-500 dark:text-gray-400">Last updated<br /><time dateTime={data.generated_at} className="font-medium text-gray-700 dark:text-gray-300">{manilaDateTime(data.generated_at)}</time></p>
        </div>
        <ReportSummary data={data} tab={tab} />

        {tab === 'assessments' && <>
          <div className="max-w-xl"><SelectFilter label="Assessment analysis (does not change student totals)" value={params.get('assessment_id') || ''} onChange={value => update({ assessment_id: value }, true)}><option value="">All assigned assessments</option>{options.assessments.map(assessment => <option key={assessment.id} value={assessment.id}>{assessment.name}</option>)}</SelectFilter></div>
          <AssessmentProgressPanels key={JSON.stringify([data.scope.batch_ids, data.scope.batch_status, data.scope.course, data.scope.instructor_id, data.scope.assessment_id])} data={data} onSelect={select} selection={group} />
          <ChartPanel title="Recorded submission activity" description="Valid submissions by Philippine date, including saved prior retakes. Only retained submission records are included; this is activity, not a historical completion rate.">
            <ActivityDateFilter scope={data.scope} updating={scopeUpdating} error={error} onRetry={retryReport} onApply={range => { update(range, false, true); if (group === 'activity') setPage(1) }} />
            <div aria-label="Submission activity graph" role="group" aria-busy={scopeUpdating}><ActivityLine rows={data.activity} interval={data.scope.activity_interval} onSelect={() => select('activity')} /></div>
          </ChartPanel>
        </>}

        {tab === 'skills' && <Suspense fallback={<InsightsSkeleton tab="skills" />}><SkillsInsights key={JSON.stringify([data.scope.batch_ids, data.scope.batch_status, data.scope.course, data.scope.instructor_id])} data={data} selection={group} onSelect={next => { setRecordView('list'); select(next) }} /></Suspense>}

        {tab === 'placements' && <>
          <section aria-label="Placement filters" className={panel}>
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Company &amp; capacity filters</h3>
            <p className="mt-2 text-xs leading-6 text-gray-600 dark:text-gray-400">Filters company approvals and shared slots. Student progress uses the selected batches.</p>
            <div className="mt-5 grid gap-5 lg:grid-cols-3">
              <SelectFilter label="Approved company / capacity" value={params.get('company_id') || ''} onChange={value => update({ company_id: value, position_id: '' }, true)}><option value="">All companies</option>{options.companies.map(company => <option key={company.id} value={company.id}>{company.name}</option>)}</SelectFilter>
              <SelectFilter label="Approved position / capacity" value={params.get('position_id') || ''} onChange={value => update({ position_id: value }, true)}><option value="">All positions</option>{options.positions.filter(position => !params.get('company_id') || String(position.company_id) === params.get('company_id')).map(position => <option key={position.id} value={position.id}>{position.name}</option>)}</SelectFilter>
              <SelectFilter label="Company area (not student residence)" value={params.get('area') || ''} onChange={value => update({ area: value }, true)}><option value="">All company areas</option>{options.areas.map(area => <option key={area}>{area}</option>)}</SelectFilter>
            </div>
          </section>
          <Suspense fallback={<InsightsSkeleton tab="placements" />}><PlacementInsights key={JSON.stringify([data.scope.batch_ids, data.scope.batch_status, data.scope.course, data.scope.instructor_id, data.scope.company_id, data.scope.position_id, data.scope.area])} data={data} selection={group} onClearArea={() => update({ area: '' }, true)} onSelect={next => { setRecordView('list'); select(next) }} /></Suspense>
        </>}

        <section id="analytics-records" aria-label="Analytics records" className={`${panel} analytics-records scroll-mt-24 space-y-5`}>
          <div className="flex flex-wrap items-start justify-between gap-5">
            <div><p className="mb-2 text-xs font-medium text-green-700 dark:text-green-400">Detailed records</p><h2 ref={recordsHeading} tabIndex={-1} className="rounded text-xl font-semibold text-gray-900 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-green-600 dark:text-white">{table.title}</h2><p className="mt-2 wrap-break-word text-xs leading-6 text-gray-600 dark:text-gray-400" role="status">{selectionLabel} · {table.rows.length} records</p></div>
            <div className="flex flex-wrap gap-3"><button type="button" className={button} disabled={downloading || scopeUpdating || !!error || previous} onClick={() => download('csv')}>Download displayed CSV</button><button type="button" className={button} disabled={downloading || scopeUpdating || !!error || previous} onClick={() => download('pdf')}>Download displayed PDF</button></div>
          </div>
          {group && studentTable && <div role="region" aria-label="Active record filter" className="analytics-record-filter">
            <div><span>Active record filter</span><strong>{selectionLabel}</strong><p>{group.startsWith('batch:') ? 'Showing all students in this batch. Their required completion status may vary.' : group.startsWith('attempt:') ? 'Showing students with this current attempt status for the selected assessment.' : 'Showing only the records matching this selection.'} {tab === 'placements' && ['approved', 'approved_other_batch', 'unplaced', 'awaiting'].includes(group) ? 'Student scope filters apply; company, position and area filters do not narrow this status view.' : 'Report scope filters still apply.'}</p></div>
            <button type="button" className={button} onClick={() => select('')}>Clear record selection</button>
          </div>}
          <div className="space-y-3 border-y border-gray-100 py-5 dark:border-gray-800">
            <p className="text-xs font-medium text-gray-700 dark:text-gray-300">View records</p>
            <div className="flex flex-wrap gap-2">{[['', 'Student records'], ...(tab === 'assessments' ? [['complete', 'Complete'], ['incomplete', 'Incomplete'], ['followup', 'Needs follow-up'], ['assessments', 'Assessment table'], ['activity', 'Activity table']] : tab === 'skills' ? [['skills', 'Category table']] : [['awaiting', 'Awaiting review'], ['approved', 'Approved'], ['unplaced', 'Unplaced'], ['capacity', 'Capacity table'], ['geography', 'Residence / company areas']])].map(([value, label]) => <button type="button" key={value} className={group === value ? activeButton : button} aria-pressed={group === value} onClick={() => select(value)}>{label}</button>)}</div>
            {group && !studentTable && <button type="button" className="min-h-10 rounded text-xs font-medium text-green-700 underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-green-600 dark:text-green-400" onClick={() => select('')}>Clear record selection</button>}
          </div>
          {studentTable && <div className="flex flex-wrap items-end justify-between gap-4">
            <label className="block w-full max-w-md text-xs font-medium text-gray-700 dark:text-gray-300">Search students<span className="relative mt-2 block"><span aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"><SearchIcon size={18} /></span><input className={`${field} pl-10`} type="search" value={search} onChange={event => { setSearch(event.target.value); setPage(1) }} placeholder="Search student, ID, batch or instructor…" /></span></label>
            <div className="flex max-w-full flex-wrap items-end gap-3">
              {recordView === 'grid' ? <label className="block min-w-0 text-xs font-medium text-gray-700 dark:text-gray-300">Sort students<select aria-label="Sort students" className={`${field} mt-2 max-w-64`} value={sorting.length ? `${sorting[0].id}:${sorting[0].desc ? 'desc' : 'asc'}` : ''} onChange={event => { const [id, direction] = event.target.value.split(':'); setSorting(id ? [{ id, desc: direction === 'desc' }] : []); setPage(1) }}><option value="">Original record order</option>{table.columns.flatMap((label, index) => ['asc', 'desc'].map(direction => <option key={`${index}:${direction}`} value={`${index}:${direction}`}>{label} · {direction === 'asc' ? 'ascending' : 'descending'}</option>))}</select></label>
                : <button type="button" aria-pressed={fullColumns} className={button} onClick={() => setFullColumns(value => !value)}>{fullColumns ? 'Show key columns' : 'Show all columns'}</button>}
              <CollectionViewToggle view={recordView} onChange={setRecordView} label="Student records view" mobile />
            </div>
          </div>}
          {!table.rows.length ? <div className="rounded-xl bg-gray-50 px-5 py-12 text-center dark:bg-gray-800/50"><p className="text-sm font-medium text-gray-800 dark:text-gray-200">No records match this selection.</p><p className="mt-2 text-xs text-gray-500 dark:text-gray-400">Try another record view or adjust the report scope.</p>{search && <button type="button" className={`${button} mt-4`} onClick={() => { setSearch(''); setPage(1) }}>Clear search</button>}</div> : <>
            {sorting.length > 0 && <p className="flex flex-wrap items-center gap-3 text-xs text-gray-600 dark:text-gray-400">Sorted by {table.columns[Number(sorting[0].id)]} ({sorting[0].desc ? 'descending' : 'ascending'})<button type="button" className="min-h-10 rounded font-medium text-green-700 underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-green-600 dark:text-green-400" onClick={() => { setSorting([]); setPage(1) }}>Reset order</button></p>}
            {studentTable && recordView === 'grid'
              ? <AnalyticsStudentCards records={orderedRecords.slice((visiblePage - 1) * pageSize, visiblePage * pageSize)} skills={tab === 'skills' ? data.skills : []} onStudent={openStudent} />
              : <AnalyticsRecordTable engine={engine} report={table} page={visiblePage} pageSize={pageSize} studentTable={studentTable} fullColumns={fullColumns} selectionLabel={selectionLabel} onStudent={openStudent} />}
            <nav aria-label="Report pagination" className="[&_button]:min-h-11 [&_button]:min-w-10 [&_button]:text-xs [&_p]:text-xs [&_p]:text-gray-500 dark:[&_p]:text-gray-400"><Pagination total={table.rows.length} page={visiblePage} onPage={setPage} pageSize={pageSize} />{table.rows.length <= pageSize && <p className="text-xs text-gray-500 dark:text-gray-400">Showing 1–{table.rows.length} of {table.rows.length}</p>}</nav>
          </>}
          <p className="text-xs leading-6 text-gray-500 dark:text-gray-400">{studentTable && recordView === 'grid' ? 'Use Sort students to change the order.' : 'Select a column title to sort.'} Downloads include every filtered row and all columns, in the same order as the records. Downloaded files are snapshots.</p>
          {studentTable && <p className="text-xs leading-5 text-gray-500 dark:text-gray-400">Assessment status shows required work. Placement approval is a separate decision.</p>}
          {tab === 'assessments' && <div className="border-t border-gray-100 pt-5 dark:border-gray-800"><button type="button" className="flex min-h-11 w-full items-center justify-between gap-4 rounded-lg text-left text-xs font-semibold text-gray-800 focus-visible:outline-2 focus-visible:outline-green-600 dark:text-gray-200" aria-expanded={exportsOpen} aria-controls="assessment-exports" onClick={() => setExportsOpen(value => !value)}>Individual assessment reports<span aria-hidden="true"><ChevronDown size={18} open={exportsOpen} /></span></button>{exportsOpen && <div id="assessment-exports" className="mt-3"><Suspense fallback={<p role="status">Loading assessment exports…</p>}><AssessmentReportPanel embedded /></Suspense></div>}</div>}
        </section>

        {tab === 'placements' && <Link className="inline-flex min-h-11 items-center text-sm font-semibold text-green-700 underline underline-offset-4 dark:text-green-400" to={`/${role}/placements`}>Open placement management and decision-history exports →</Link>}
      </>}
    </section>
    {role === 'admin' && <section className={`${panel} border-dashed`}><button type="button" className="flex min-h-11 w-full items-center justify-between gap-4 rounded-lg text-left text-sm font-semibold text-gray-700 focus-visible:outline-2 focus-visible:outline-green-600 dark:text-gray-300" aria-expanded={advanced} aria-controls="analytics-advanced" onClick={() => setAdvanced(value => !value)}>Advanced: recommendation model and evaluation<span aria-hidden="true"><ChevronDown size={18} open={advanced} /></span></button><p className="mt-2 text-xs leading-6 text-gray-500 dark:text-gray-400">Administrative model settings and evaluation tools.</p>{advanced && <div id="analytics-advanced" className="mt-6"><Suspense fallback={<p role="status">Loading advanced tools…</p>}><AdminRecommendationTools /></Suspense></div>}</section>}
    {student && <StudentDetails row={student} role={role} onClose={() => setStudent(null)} restoreFocusRef={opener} />}
  </section>
}
