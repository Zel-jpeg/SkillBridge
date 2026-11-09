import { AnalyticsSkeleton, InsightsSkeleton } from '../../components/loading/Skeletons'
import { lazy, Suspense, useMemo, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useApi } from '../../hooks/useApi'
import { useSSE } from '../../hooks/useSSE'
import { useToast } from '../../context/ToastContext'
import api from '../../api/axios'
import DataSection from '../../components/DataSection'
import DialogShell from '../../components/DialogShell'
import StudentModal from '../../components/instructor/StudentModal'
import Pagination from '../../components/Pagination'
import AnalyticsRecordTable from '../../components/analytics/AnalyticsRecordTable'
import AnalyticsStudentCards from '../../components/analytics/AnalyticsStudentCards'
import CollectionViewToggle from '../../components/CollectionViewToggle'
import { useAnalyticsRecords } from '../../hooks/useAnalyticsRecords'
import { useAnalyticsData } from '../../hooks/useAnalyticsData'
import { useSnapshotFreshness } from '../../hooks/useSnapshotFreshness'
import { matchesOrganization } from '../../utils/organizationScope'
import OrganizationComparison from '../../components/analytics/OrganizationComparison'
import { analyticsScopeText } from '../../utils/analyticsOrganization'
import ActivityDateFilter from '../../components/analytics/ActivityDateFilter'
import AssessmentProgressPanels from '../../components/analytics/AssessmentProgressPanels'
import { BriefcaseIcon, ReportIcon, SearchIcon, SkillIcon, UserIcon, CheckCircleIcon, WarnIcon } from '../../components/Icons'
import CompletionRing from '../../components/analytics/CompletionRing'
import '../../components/analytics/analyticsRedesign.css'
import { ActivityLine, ChartPanel } from '../../components/analytics/AnalyticsCharts'
import { analyticsCsv, analyticsFilterText, analyticsSelectionLabel, analyticsTable, selectAnalyticsStudents } from '../../utils/analytics'
import { normalizeStudent } from '../../utils/managementStudent'
import { activityPeriodLabel } from '../../utils/activityPeriods'
import { activityReport, analyticsSourceUrl } from '../../utils/analyticsActivity'
import { manilaDateTime } from '../../utils/assessmentDates'

const AssessmentReportPanel = lazy(() => import('../../components/AssessmentReportPanel'))
const SkillsInsights = lazy(() => import('../../components/analytics/SkillsInsights'))
const PlacementMap = lazy(() => import('../../components/analytics/PlacementMap'))
const PlacementInsights = lazy(() => import('../../components/analytics/PlacementInsights'))
const AdminRecommendationTools = lazy(() => import('../admin/AdminRecommendationTools'))
const field = 'min-h-11 w-full min-w-0 rounded-xl border border-gray-300 bg-white px-3 py-2.5 text-xs text-gray-900 focus-visible:outline-2 focus-visible:outline-green-600 sm:text-xs dark:border-gray-700 dark:bg-gray-900 dark:text-white'
const button = 'inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-gray-300 bg-white px-4 py-2.5 text-xs font-medium text-gray-700 transition-colors hover:border-green-400 hover:bg-green-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-green-600 disabled:opacity-50 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200 dark:hover:bg-green-950'
const activeButton = `${button} border-green-700! bg-green-700! text-white! hover:bg-green-800! dark:border-green-600! dark:bg-green-600!`
const panel = 'min-w-0 rounded-2xl border border-gray-200 bg-white p-5 sm:p-7 dark:border-gray-800 dark:bg-gray-900'
const sections = [
  { key: 'assessments', label: 'Assessments', description: 'Completion & follow-up', icon: <ReportIcon size={22} />, title: 'Assessment progress', intro: 'See who has completed the required work and where follow-up is needed.' },
  { key: 'skills', label: 'Skills', description: 'Competency & matches', icon: <SkillIcon size={22} />, title: 'Skills & recommendation insights', intro: 'Identify strengths and areas for support using current final results.' },
  { key: 'placements', label: 'Placements', description: 'Decisions & capacity', icon: <BriefcaseIcon size={22} />, title: 'Placement overview', intro: 'Track approved placements, students awaiting review and available OJT slots.' },
]

function ReportSummary({ data, tab, measure }) {
  const mapData = measure === 'suggested' ? data.suggested_placement_map : data.placement_map
  const s = data.summary
  const cards = tab === 'assessments' ? [
    ['Students in scope', s.students, 'Students in the selected batches'],
    ['Required work complete', s.required_complete, s.completion_rate == null ? 'No students in scope' : `${s.completion_rate}% of students in scope`],
    ['Required work incomplete', s.students - s.required_complete, 'Students with required work remaining'],
    ['Need follow-up', s.needs_followup, 'Students with work or results to review'],
  ] : tab === 'skills' ? [
    ['Students in scope', s.students, 'Students in the selected batches'],
    ['Current final results', data.students.filter(row => !row.recommendations_locked).length, 'Current results from completed assessments'],
    ['Results unavailable', data.students.filter(row => row.recommendations_locked).length, 'Missing, incomplete or locked final evidence'],
    ['Current recommendations', data.match_bands.filter(row => !['Locked', 'No current match'].includes(row.name)).reduce((sum, row) => sum + row.count, 0), 'Highest current recommendation per student'],
  ] : [
    ['Students in scope', s.students, 'Selected batches'],
    ['Approved placements', s.approved, `${s.placement_rate ?? 0}% of selected students`],
    ['Unplaced students', s.unplaced, `${s.approved_other_batch} approved in another batch`],
    ['Without map pins', mapData ? mapData.coverage.pins.missing + mapData.coverage.pins.invalid : null, `Included in ${measure === 'suggested' ? 'suggestion' : 'approval'} totals`],
  ]
  return <dl aria-label="Report summary" className="ar-summary grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{cards.map(([label, value, description], index) => <div key={label} className={`${panel} ar-stat`}><span className="ar-stat-icon" aria-hidden="true">{index === 0 ? <UserIcon size={21} /> : index === 1 ? <CheckCircleIcon size={21} /> : index === 3 ? <WarnIcon size={21} /> : <ReportIcon size={21} />}</span>
    <dt className="text-xs font-medium text-gray-600 dark:text-gray-300">{label}</dt>
    <dd className="mt-3 text-2xl font-semibold tracking-tight text-gray-900 tabular-nums sm:text-3xl dark:text-white">{value ?? '—'}</dd>
    <dd className="mt-3 text-xs leading-6 text-gray-500 dark:text-gray-400">{description}</dd>
  </div>)}</dl>
}

function StudentDetails({ row, onClose, restoreFocusRef, role, report }) {
  const url = `/api/instructor/batches/${row.batch_id}/students/`
  const { data } = useApi(url)
  const record = data?.students?.find(student => student.id === row.id)
  if (!record) return <DialogShell title={row.name} description="Loading authorized student details" onClose={onClose} restoreFocusRef={restoreFocusRef}><DataSection url={url} layout="student-detail"><p className="p-5 text-xs">Student is no longer in this roster. Refresh the report.</p></DataSection></DialogShell>
  const student = { ...normalizeStudent(record), batch: { id: row.batch_id, name: row.batch }, instructor: row.instructor }
  const batch = report.options.batches.find(item => item.id === row.batch_id)
  const query = new URLSearchParams({ batch_id: row.batch_id, ...(role === 'admin' && batch?.institute_id ? { institute: batch.institute_id, program: batch.program_id || 'all' } : {}) })
  return <StudentModal student={student} readOnly isArchived={row.batch_status === 'archived'} instructorName={row.instructor} onClose={onClose} restoreFocusRef={restoreFocusRef} footer={<Link className={button} to={`/${role}/${role === 'admin' ? 'batches' : 'students'}?${query}`}>Open batch management</Link>} />
}

function SelectFilter({ label, value, onChange, children, disabled = false }) {
  return <label className="block min-w-0 text-xs font-medium leading-6 text-gray-700 dark:text-gray-300">{label}<select aria-label={label} disabled={disabled} className={`${field} mt-2`} value={value} onChange={event => onChange(event.target.value)}>{children}</select></label>
}

export default function ReportsAnalytics({ role = 'admin' }) {
  useSSE(`/api/${role}/events/`)
  const { showToast } = useToast()
  const [params, setParams] = useSearchParams()
  const tab = ['assessments', 'skills', 'placements'].includes(params.get('tab')) ? params.get('tab') : 'assessments'
  const group = params.get('group') || ''
  const url = analyticsSourceUrl(params)
  const { data: source, updating, error: sourceError, denied, previous, retry } = useAnalyticsData(url)
  const { scopeVersion, scopeCurrent } = useSnapshotFreshness([])
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
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [exportsOpen, setExportsOpen] = useState(false)
  const [downloading, setDownloading] = useState(false)
  const [fullColumns, setFullColumns] = useState(false)
  const [recordView, setRecordView] = useState('list')
  const [sorting, setSorting] = useState([])
  const pending = useRef(false)
  const opener = useRef(null)
  const recordsHeading = useRef(null)
  if ((denied || !source || (student && !source.students.some(row => row.id === student.id && row.batch_id === student.batch_id))) && student) setStudent(null)
  const institute = params.get('institute_id') || (role === 'admin' && params.get('program_id') ? String(options.programs?.find(row => String(row.id) === params.get('program_id'))?.institute_id || '') : '')
  const program = params.get('program_id') || ''
  const programInstitute = institute || String(options.programs?.find(row => String(row.id) === program)?.institute_id || '')
  const scopedBatches = options.batches.filter(batch => matchesOrganization(batch, { institute: programInstitute, program }))
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
  const table = useMemo(() => data ? analyticsTable(data, tab, group, rows, search) : null, [data, tab, group, rows, search])
  const selectionLabel = data ? analyticsSelectionLabel(data, group) : ''
  const tableGroups = ['capacity', 'assessments', 'skills', 'activity', 'geography', 'organizations']
  const studentTable = !tableGroups.includes(group)
  const pageSize = studentTable ? 8 : 10
  const visiblePage = Math.min(page, Math.max(1, Math.ceil((table?.rows.length ?? 0) / pageSize)))
  if (page > visiblePage && data && !updating) setPage(visiblePage)
  const section = sections.find(section => section.key === tab)
  const engine = useAnalyticsRecords({ report: table, students: rows, studentTable, fullColumns, sorting,
    onSortingChange: next => { setSorting(next); setPage(1) } })
  const orderedRecords = engine.getRowModel().rows.map(row => row.original)
  function openStudent(record, element) { opener.current = element; setStudent(record) }
  const scopeText = data ? analyticsScopeText(data) : ''
  async function download(type) {
    if (!data || !table || pending.current || scopeUpdating || error || previous) return
    pending.current = true; setDownloading(true)
    const snapshot = { ...table, rows: orderedRecords.map(row => row.values) }
    const metadata = { Generated: manilaDateTime(data.generated_at), Scope: scopeText,
      Filters: analyticsFilterText(data),
      Records: `${selectionLabel}; search=${search || 'none'}`, Sort: sorting.length ? `${table.columns[Number(sorting[0].id)]} ${sorting[0].desc ? 'descending' : 'ascending'}` : 'Original record order', Unit: data.scope.cohort_unit,
      'Student status scope': tab === 'placements' && ['approved', 'approved_other_batch', 'unplaced', 'awaiting'].includes(group) ? 'Selected students; partner, position and area filters do not narrow this status view.' : 'Current report and record filters.',
      Capacity: data.scope.capacity_scope, Activity: `${activityPeriodLabel(data.scope.activity_period)}; ${data.scope.date_from} to ${data.scope.date_to}; grouped by ${data.scope.activity_interval || 'day'}; ${data.scope.activity_note}` }
    try {
      const pdfModules = type === 'pdf' ? await Promise.all([import('jspdf'), import('jspdf-autotable')]) : null
      if (!scopeCurrent(scopeVersion) || url !== analyticsSourceUrl(new URLSearchParams(window.location.search))) return
      const { data: current } = await api.get(url)
      if (!scopeCurrent(scopeVersion) || url !== analyticsSourceUrl(new URLSearchParams(window.location.search))) return
      const fresh = activityReport(current, params).data
      const freshTable = fresh && analyticsTable(fresh, tab, group, selectAnalyticsStudents(fresh, tab, group, search), search)
      if (!freshTable || analyticsFilterText(fresh) !== analyticsFilterText(data) || JSON.stringify(fresh.scope.batch_ids) !== JSON.stringify(data.scope.batch_ids) || JSON.stringify(freshTable) !== JSON.stringify(table)) {
        retryReport()
        showToast('The report changed. Review the updated records before downloading.', 'warning')
        return
      }
      if (type === 'csv') {
        const objectUrl = URL.createObjectURL(new Blob([analyticsCsv(snapshot, metadata)], { type: 'text/csv;charset=utf-8' }))
        const link = document.createElement('a'); link.href = objectUrl; link.download = `skillbridge-${role}-${tab}.csv`; link.click()
        setTimeout(() => URL.revokeObjectURL(objectUrl), 1000)
      } else {
        const [{ jsPDF }, autoTable] = pdfModules
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

  return <section className="analytics-redesign mx-auto min-w-0 max-w-360 space-y-5 px-4 py-6 text-xs sm:px-6">
    <header className="space-y-3 ar-report-header">
      <h1 className="text-xl font-semibold tracking-tight text-gray-950 sm:text-2xl dark:text-white">Reports &amp; Analytics</h1>
      <p className="max-w-3xl text-xs leading-5 text-gray-600 dark:text-gray-400">Assessment progress, skills and placement insights.</p>
      <button type="button" className={button} onClick={() => document.getElementById('analytics-records')?.scrollIntoView({ block: 'start', behavior: 'auto' })}>Export report</button>
    </header>

    <section aria-label="Report scope" className="ar-scope">
      <fieldset disabled={!source} aria-busy={!source} className="ar-scope-row">
        {(role === 'admin' || !!options.institutes?.length) && <SelectFilter label="Institute" value={institute} onChange={value => update({ institute_id: value, program_id: '', instructor_id: '', batch_id: '', assessment_id: '', course: '', company_id: '', position_id: '', area: '' }, true)}><option value="">All accessible institutes</option>{options.institutes?.map(item => <option key={item.id} value={item.id}>{item.name}{item.is_active === false ? ' (archived)' : ''}</option>)}</SelectFilter>}
        {(role === 'admin' || !!options.programs?.length) && <SelectFilter label="Program" value={program} disabled={role === 'admin' && !institute} onChange={value => update({ program_id: value, instructor_id: '', batch_id: '', assessment_id: '', course: '', company_id: '', position_id: '', area: '' }, true)}><option value="">{role === 'admin' && !institute ? 'Choose an institute first' : 'All programs in scope'}</option>{options.programs?.filter(item => !institute || String(item.institute_id) === institute).map(item => <option key={item.id} value={item.id}>{item.name}{item.is_active === false ? ' (archived)' : ''}</option>)}</SelectFilter>}
        <SelectFilter label="Batch" value={params.get('batch_id') || ''} disabled={role === 'admin' && !institute} onChange={value => update({ batch_id: value, assessment_id: '', company_id: '', position_id: '', area: '' }, true)}><option value="">{role === 'admin' && !institute ? 'Choose an institute first' : role === 'admin' || institute || program ? 'All matching batches' : params.get('batch_scope') === 'matching' ? 'My matching batches' : 'Current batch / latest in history'}</option>{scopedBatches.filter(batch => (!params.get('batch_status') ? batch.status === 'active' : params.get('batch_status') === 'all' || batch.status === params.get('batch_status')) && (!params.get('instructor_id') || String(batch.instructor_id) === params.get('instructor_id'))).map(batch => <option key={batch.id} value={batch.id}>{batch.name}</option>)}</SelectFilter>
        <SelectFilter label="Batch status" value={params.get('batch_status') || 'active'} onChange={value => update({ batch_status: value, batch_id: '', assessment_id: '' }, true)}><option value="active">Active batches</option><option value="archived">Archived history</option><option value="all">Active and archived history</option></SelectFilter>
        <button type="button" className={button} onClick={() => setFiltersOpen(true)}>More filters</button>
      </fieldset>

      {!source && !error && <p role="status" className="mt-3 text-xs text-gray-500 dark:text-gray-400">Loading available report filters…</p>}
      {data && <p className="ar-scope-caption">{data.summary.students} students · {data.scope.batch_ids.length} {data.scope.batch_ids.length === 1 ? 'batch' : 'batches'} · {role === 'admin' ? 'Selected scope' : 'Your accessible batches'}</p>}
    </section>

    <nav className="ar-tabs" aria-label="Analytics sections">{sections.map(({ key, label }) => <button type="button" key={key} aria-label={label} aria-pressed={tab === key} onClick={() => { setExportsOpen(false); setFullColumns(false); update({ tab: key, group: '', assessment_id: key === 'assessments' ? params.get('assessment_id') : '', company_id: key === 'placements' ? params.get('company_id') : '', position_id: key === 'placements' ? params.get('position_id') : '', area: key === 'placements' ? params.get('area') : '' }) }} className={`-mb-px flex min-h-16 items-center justify-center gap-3 border-b-2 px-1 py-4 text-left transition-colors focus-visible:outline-2 focus-visible:outline-green-600 sm:justify-start sm:px-5 ${tab === key ? 'border-green-700 text-green-800 dark:border-green-400 dark:text-green-400' : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white'}`}>
      <span>{label}</span>
    </button>)}</nav>

    <section aria-label="Report results" aria-busy={scopeUpdating} className="space-y-8">
      {error && <div role="alert" className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-xs leading-5 text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200"><p className="font-semibold">{denied ? 'This report is unavailable or you no longer have access.' : 'The report could not be updated.'}</p><p className="mt-1">{error}</p>{data && <p className="mt-1">Showing the last successfully loaded report.{previous ? ' The new filters have not been applied to these results.' : ''}</p>}<button type="button" disabled={updating} className={`${button} mt-3`} onClick={retryReport}>Retry report</button></div>}
      <div className="pointer-events-none fixed top-20 left-1/2 z-20 m-0! w-max max-w-[calc(100%-32px)] -translate-x-1/2" aria-live="polite">{scopeUpdating && data && <p role="status" className="mx-auto w-fit max-w-full rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-xs leading-5 text-green-900 shadow-sm dark:border-green-900 dark:bg-green-950 dark:text-green-200">Applying report filters… The current report stays visible until the new results are ready.</p>}</div>
      {!data && !error && <><div><h2 className="text-lg font-semibold">{section.title}</h2><p className="mt-2 text-xs text-gray-500 dark:text-gray-400">{section.intro}</p></div><AnalyticsSkeleton tab={tab} /></>}
      {data && <>
        <ReportSummary data={data} tab={tab} measure={params.get('map_measure')} />



        {tab === 'assessments' && <>


          <div className="ar-assessment-grid"><ChartPanel title="Recorded submission activity" description="Valid submissions, including saved prior retakes.">
            <ActivityDateFilter scope={data.scope} updating={scopeUpdating} error={error} onRetry={retryReport} onApply={range => { update(range, false, true); if (group === 'activity') setPage(1) }} />
            <div aria-label="Submission activity graph" role="group" aria-busy={scopeUpdating}><ActivityLine rows={data.activity} interval={data.scope.activity_interval} onSelect={() => select('activity')} /></div>
          </ChartPanel><CompletionRing summary={data.summary} onSelect={select} /></div>
          <AssessmentProgressPanels key={JSON.stringify([data.scope.batch_ids, data.scope.batch_status, data.scope.course, data.scope.instructor_id, data.scope.assessment_id])} data={data} onSelect={select} selection={group} />
        </>}

        {tab === 'skills' && !data.scope.program_id && role === 'admin' && <p className="text-xs leading-5 text-gray-500 dark:text-gray-400">Skill rows retain their program, skill set and version. Choose a program for a focused review; categories from different skill sets are not one school-wide ranking.</p>}
        {tab === 'skills' && <Suspense fallback={<InsightsSkeleton tab="skills" />}><SkillsInsights key={JSON.stringify([data.scope.batch_ids, data.scope.batch_status, data.scope.course, data.scope.instructor_id])} data={data} selection={group} onSelect={next => { setRecordView('list'); select(next) }} /></Suspense>}

        {tab === 'placements' && <>
          <Suspense fallback={<InsightsSkeleton tab="placements" />}><PlacementMap data={data} selection={group} onSelect={select} /></Suspense>
          <Suspense fallback={<InsightsSkeleton tab="placements" />}><PlacementInsights key={JSON.stringify([data.scope.batch_ids, data.scope.batch_status, data.scope.course, data.scope.instructor_id, data.scope.company_id, data.scope.position_id, data.scope.area])} data={data} selection={group} onClearArea={() => update({ area: '' }, true)} onSelect={next => { setRecordView('list'); select(next) }} /></Suspense>
        </>}

        {role === 'admin' && !data.scope.program_id && <OrganizationComparison key={`${data.scope.institute_id || ''}:${data.scope.batch_status}`} data={data} disabled={previous || scopeUpdating || !!error} onRecords={() => select('organizations')} onOpen={id => { if (!previous && !scopeUpdating && !error) update(data.scope.institute_id ? { program_id: String(id), instructor_id: '', batch_id: '', assessment_id: '', course: '', company_id: '', position_id: '', area: '' } : { institute_id: String(id), program_id: '', instructor_id: '', batch_id: '', assessment_id: '', course: '', company_id: '', position_id: '', area: '' }, true) }} />}
        <section id="analytics-records" aria-label="Analytics records" className={`${panel} analytics-records scroll-mt-24 space-y-5`}>
          <div className="flex flex-wrap items-start justify-between gap-5">
            <div><p className="mb-2 text-xs font-medium text-green-700 dark:text-green-400">Detailed records</p><h2 ref={recordsHeading} tabIndex={-1} className="rounded text-xl font-semibold text-gray-900 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-green-600 dark:text-white">{table.title}</h2><p className="mt-2 wrap-break-word text-xs leading-6 text-gray-600 dark:text-gray-400" role="status">{selectionLabel} · {table.rows.length} records</p></div>
            <div className="flex flex-wrap gap-3"><button type="button" className={button} disabled={downloading || scopeUpdating || !!error || previous} onClick={() => download('csv')}>Download displayed CSV</button><button type="button" className={button} disabled={downloading || scopeUpdating || !!error || previous} onClick={() => download('pdf')}>Download displayed PDF</button></div>
          </div>
          {group && studentTable && <div role="region" aria-label="Active record filter" className="analytics-record-filter">
            <div><span>Active record filter</span><strong>{selectionLabel}</strong><p>{group.startsWith('batch:') ? 'Showing all students in this batch. Their required completion status may vary.' : group.startsWith('attempt:') ? 'Showing students with this current attempt status for the selected assessment.' : 'Showing only the records matching this selection.'} {tab === 'placements' && ['approved', 'approved_other_batch', 'unplaced', 'awaiting'].includes(group) ? 'Student scope filters apply; partner, position and area filters do not narrow this status view.' : 'Report scope filters still apply.'}</p></div>
            <button type="button" className={button} onClick={() => select('')}>Clear record selection</button>
          </div>}
          <div className="space-y-3 border-y border-gray-100 py-5 dark:border-gray-800">
            <p className="text-xs font-medium text-gray-700 dark:text-gray-300">View records</p>
            <div className="flex flex-wrap gap-2">{[['', 'Student records'], ...(role === 'admin' && !data.scope.program_id ? [['organizations', 'Organization comparison']] : []), ...(tab === 'assessments' ? [['complete', 'Complete'], ['incomplete', 'Incomplete'], ['followup', 'Needs follow-up'], ['assessments', 'Assessment table'], ['activity', 'Activity table']] : tab === 'skills' ? [['skills', 'Category table']] : [['awaiting', 'Awaiting review'], ['approved', 'Approved'], ['unplaced', 'Unplaced'], ['capacity', 'Capacity table'], ['geography', 'Residence / partner areas']])].map(([value, label]) => <button type="button" key={value} className={group === value ? activeButton : button} aria-pressed={group === value} onClick={() => select(value)}>{label}</button>)}</div>
            {group && !studentTable && <button type="button" className="min-h-10 rounded text-xs font-medium text-green-700 underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-green-600 dark:text-green-400" onClick={() => select('')}>Clear record selection</button>}
          </div>
          {(studentTable || group === 'organizations') && <div className="sb-collection-toolbar justify-between">
            <label className="block w-full max-w-md text-xs font-medium text-gray-700 dark:text-gray-300">{group === 'organizations' ? 'Search organizations' : 'Search students'}<span className="relative mt-2 block"><span aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"><SearchIcon size={18} /></span><input className={`${field} pl-10`} type="search" value={search} onChange={event => { setSearch(event.target.value); setPage(1) }} placeholder={group === 'organizations' ? 'Search institute or program…' : 'Search student, ID, batch or instructor…'} /></span></label>
            {studentTable && <div className="flex max-w-full flex-wrap items-end gap-3">
              {recordView === 'grid' ? <label className="block min-w-0 text-xs font-medium text-gray-700 dark:text-gray-300">Sort students<select aria-label="Sort students" className={`${field} mt-2 max-w-64`} value={sorting.length ? `${sorting[0].id}:${sorting[0].desc ? 'desc' : 'asc'}` : ''} onChange={event => { const [id, direction] = event.target.value.split(':'); setSorting(id ? [{ id, desc: direction === 'desc' }] : []); setPage(1) }}><option value="">Original record order</option>{table.columns.flatMap((label, index) => ['asc', 'desc'].map(direction => <option key={`${index}:${direction}`} value={`${index}:${direction}`}>{label} · {direction === 'asc' ? 'ascending' : 'descending'}</option>))}</select></label>
                : <button type="button" aria-pressed={fullColumns} className={button} onClick={() => setFullColumns(value => !value)}>{fullColumns ? 'Show key columns' : 'Show all columns'}</button>}
              <CollectionViewToggle view={recordView} onChange={setRecordView} label="Student records view" mobile />
            </div>}
          </div>}
          {!table.rows.length ? <div className="rounded-xl bg-gray-50 px-5 py-12 text-center dark:bg-gray-800/50"><p className="text-sm font-medium text-gray-800 dark:text-gray-200">No records match this selection.</p><p className="mt-2 text-xs text-gray-500 dark:text-gray-400">Try another record view or adjust the report scope.</p>{search && <button type="button" className={`${button} mt-4`} onClick={() => { setSearch(''); setPage(1) }}>Clear search</button>}</div> : <>
            {sorting.length > 0 && <p className="flex flex-wrap items-center gap-3 text-xs text-gray-600 dark:text-gray-400">Sorted by {table.columns[Number(sorting[0].id)]} ({sorting[0].desc ? 'descending' : 'ascending'})<button type="button" className="min-h-10 rounded font-medium text-green-700 underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-green-600 dark:text-green-400" onClick={() => { setSorting([]); setPage(1) }}>Reset order</button></p>}
            {studentTable && recordView === 'grid'
              ? <AnalyticsStudentCards records={orderedRecords.slice((visiblePage - 1) * pageSize, visiblePage * pageSize)} skills={tab === 'skills' ? data.skills : []} onStudent={openStudent} suggested={table.suggested} />
              : <AnalyticsRecordTable engine={engine} report={table} page={visiblePage} pageSize={pageSize} studentTable={studentTable} fullColumns={fullColumns} selectionLabel={selectionLabel} onStudent={openStudent} />}
            <nav aria-label="Report pagination" className="[&_button]:min-h-11 [&_button]:min-w-10 [&_button]:text-xs [&_p]:text-xs [&_p]:text-gray-500 dark:[&_p]:text-gray-400"><Pagination total={table.rows.length} page={visiblePage} onPage={setPage} pageSize={pageSize} />{table.rows.length <= pageSize && <p className="text-xs text-gray-500 dark:text-gray-400">Showing 1–{table.rows.length} of {table.rows.length}</p>}</nav>
          </>}
          <p className="text-xs leading-6 text-gray-500 dark:text-gray-400">{studentTable && recordView === 'grid' ? 'Use Sort students to change the order.' : 'Select a column title to sort.'} Downloads include every filtered row and all columns, in the same order as the records. Downloaded files are snapshots.</p>
          {studentTable && <p className="text-xs leading-5 text-gray-500 dark:text-gray-400">Assessment status shows required work. Placement approval is a separate decision.</p>}
          {tab === 'assessments' && <button type="button" className={button} onClick={() => setExportsOpen(true)}>Individual assessment reports</button>}
        </section>

        {tab === 'placements' && <Link className="inline-flex min-h-11 items-center text-sm font-semibold text-green-700 underline underline-offset-4 dark:text-green-400" to={`/${role}/placements?${new URLSearchParams({ ...(data.scope.institute_id ? { institute: data.scope.institute_id, program: data.scope.program_id || 'all' } : {}), ...(data.scope.batch_ids.length === 1 ? { batch_id: data.scope.batch_ids[0] } : {}) })}`}>Open placement management and decision-history exports →</Link>}
      </>}
    </section>
    {role === 'admin' && <button type="button" className={button} onClick={() => setAdvanced(true)}>Advanced tools</button>}
    {advanced && role === 'admin' && <DialogShell title="Advanced recommendation tools" onClose={() => setAdvanced(false)}><Suspense fallback={<p>Loading tools…</p>}><AdminRecommendationTools /></Suspense></DialogShell>}
    {exportsOpen && <DialogShell title="Individual assessment reports" onClose={() => setExportsOpen(false)}><Suspense fallback={<p>Loading assessment reports…</p>}><AssessmentReportPanel embedded /></Suspense></DialogShell>}
    {filtersOpen && <DialogShell title="Report filters" onClose={() => setFiltersOpen(false)}><div className="space-y-5"><fieldset disabled={!source} className="mt-4 grid gap-5 sm:grid-cols-2">
        {role === 'admin' && <SelectFilter label="Instructor" value={params.get('instructor_id') || ''} onChange={value => update({ instructor_id: value, batch_id: '', assessment_id: '' }, true)}><option value="">All instructors</option>{options.instructors.filter(owner => scopedBatches.some(batch => batch.instructor_id === owner.id)).map(owner => <option key={owner.id} value={owner.id}>{owner.name}</option>)}</SelectFilter>}
        <SelectFilter label="Course" value={params.get('course') || ''} onChange={value => update({ course: value }, true)}><option value="">All courses</option>{options.courses.map(course => <option key={course}>{course}</option>)}</SelectFilter>
      </fieldset>{tab === 'assessments' && <><div className="max-w-xl"><SelectFilter label="Assessment analysis (does not change student totals)" value={params.get('assessment_id') || ''} onChange={value => update({ assessment_id: value }, true)}><option value="">All assigned assessments</option>{options.assessments.map(assessment => <option key={assessment.id} value={assessment.id}>{assessment.name}</option>)}</SelectFilter></div></>}{tab === 'placements' && <><div className="mt-5 grid gap-5 lg:grid-cols-3">
              <SelectFilter label="Approved partner / capacity" value={params.get('company_id') || ''} onChange={value => update({ company_id: value, position_id: '' }, true)}><option value="">All partners</option>{options.companies.map(company => <option key={company.id} value={company.id}>{company.name}</option>)}</SelectFilter>
              <SelectFilter label="Approved position / capacity" value={params.get('position_id') || ''} onChange={value => update({ position_id: value }, true)}><option value="">All positions</option>{options.positions.filter(position => !params.get('company_id') || String(position.company_id) === params.get('company_id')).map(position => <option key={position.id} value={position.id}>{position.name}</option>)}</SelectFilter>
              <SelectFilter label="Partner area (not student residence)" value={params.get('area') || ''} onChange={value => update({ area: value }, true)}><option value="">All partner areas</option>{options.areas.map(area => <option key={area}>{area}</option>)}</SelectFilter>
            </div></>}<div className="flex gap-3"><button type="button" className={button} onClick={() => { const next = new URLSearchParams({ tab }); if (analyticsSourceUrl(next) !== url) setRequestedScope(analyticsSourceUrl(next)); setParams(next, { preventScrollReset: true }); setPage(1); setSearch(''); setStudent(null); setSorting([]) }}>Reset analytics filters</button><button type="button" className={activeButton} onClick={() => setFiltersOpen(false)}>Done</button></div></div></DialogShell>}
    {student && <StudentDetails row={student} role={role} report={data} onClose={() => setStudent(null)} restoreFocusRef={opener} />}
  </section>
}
