import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useApi, invalidateCache } from '../../hooks/useApi'
import { useSSE } from '../../hooks/useSSE'
import { ORGANIZATION_OPTIONS } from '../../utils/organizationScope'
import { ADMIN_DASHBOARD_URL, adminDashboardCards, adminDashboardStudents, adminOrganizationHighlights } from '../../utils/adminDashboard'
import { schoolReportLink } from '../../utils/schoolOverview'
import TaxonomyCardBanner from '../../components/TaxonomyCardBanner'
import { taxonomyBannerColor } from '../../utils/taxonomyBannerColors'
import DashboardSummary from '../../components/dashboard/DashboardSummary'
import DashboardHighlights from '../../components/dashboard/DashboardHighlights'
import DashboardCarousel from '../../components/dashboard/DashboardCarousel'
import AdminStudentCollection from '../../components/dashboard/AdminStudentCollection'
import { AttentionCard, AttentionDialog } from '../../components/dashboard/AdminDashboardAttention'
import { ContentSkeleton } from '../../components/loading/Skeletons'
import { organizationButton as button, organizationField as field } from '../../components/admin/organizationUi'
import { ChevronRightIcon, ReportIcon } from '../../components/Icons'

const StudentDetailModal = lazy(() => import('../../components/StudentDetailModal'))
const surface = 'rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900'

function OrganizationHighlights({ students, options, scope, onChoose }) {
  const rows = useMemo(() => adminOrganizationHighlights(students, options, scope.institute), [students, options, scope.institute])
  const type = scope.institute ? 'program' : 'institute'
  return <>{['matches', 'skills'].map(kind => <DashboardCarousel key={kind} count={rows.length}
    title={kind === 'matches' ? `Top matches by ${type}` : `Skill results by ${type}`}
    description={`Choose ${type === 'institute' ? 'an institute to explore its programs' : 'a program to view its student results'}.`}>
    {rows.map(row => <li key={row.id}><button type="button" className="dashboard-organization-card text-left" aria-label={`View ${kind === 'matches' ? 'matches' : 'skill results'} for ${row.name}`} onClick={() => onChoose(row.id)}>
      <span className="flex items-start gap-3"><span className="dashboard-banner-thumbnail" aria-hidden="true"><TaxonomyCardBanner imageUrl={row.image_url} name={row.name} color={taxonomyBannerColor(row.banner_color, row.id)} /></span><span className="min-w-0 flex-1"><strong className="block text-xs">{row.code}</strong><span className="mt-1 block break-words text-xs text-gray-500 dark:text-gray-400">{row.name}</span></span><ChevronRightIcon size={14} /></span>
      <span className="space-y-1 text-xs text-gray-600 dark:text-gray-300">{kind === 'matches' ? <><span className="block"><strong className="tabular-nums">{row.matches}</strong> students with current matches</span><span className="block">{scope.institute ? `${row.students} students in this view` : `${row.programs} programs`}</span></> : <><span className="block"><strong className="tabular-nums">{row.assessed}</strong> students with skill results</span><span className="block">{row.categories} assessed categories</span></>}</span>
      {!row.is_active && <span className="text-xs text-gray-500 dark:text-gray-400">Archived</span>}
      {!!row.shared && <span className="text-xs text-gray-500 dark:text-gray-400">Includes {row.shared} shared-institute students</span>}
    </button></li>)}
  </DashboardCarousel>)}</>
}

function DashboardContent({ data, options, scope, onChoose, onSelectStudent }) {
  const students = useMemo(() => adminDashboardStudents(data, options), [data, options])
  return <>
    <DashboardSummary cards={adminDashboardCards(data, scope)} variant="instructor" />
    {scope.program ? <DashboardHighlights carousel students={students} onSelectStudent={onSelectStudent} /> : <OrganizationHighlights students={students} options={options} scope={scope} onChoose={onChoose} />}
    <AdminStudentCollection students={students} onSelectStudent={onSelectStudent} />
  </>
}

export default function AdminDashboard() {
  useSSE('/api/admin/events/')
  const [params, setParams] = useSearchParams()
  const { data: options, error: optionsError } = useApi(ORGANIZATION_OPTIONS)
  const scope = { institute: params.get('institute') || '', program: params.get('program') || '', status: params.get('batch_status') || 'active' }
  const institute = options?.institutes.find(row => String(row.id) === scope.institute)
  const programs = (options?.programs || []).filter(row => String(row.institute_id) === scope.institute)
  const program = programs.find(row => String(row.id) === scope.program)
  const invalid = Boolean(options && (scope.institute && !institute || scope.program && !program || !['active', 'archived', 'all'].includes(scope.status)))
    || ['institute', 'program', 'batch_status'].some(key => params.getAll(key).length > 1)
  const analyticsParams = new URLSearchParams({ view: 'dashboard', ...(scope.status !== 'active' ? { batch_status: scope.status } : {}), ...(scope.institute ? { institute_id: scope.institute } : {}), ...(scope.program ? { program_id: scope.program } : {}) })
  const url = options && !invalid ? `${ADMIN_DASHBOARD_URL.split('?')[0]}?${analyticsParams}` : null
  const { data, error } = useApi(url)
  const [attention, setAttention] = useState(null), [selectedStudent, setStudent] = useState(null)
  const studentTrigger = useRef(null)
  const heading = useRef(null), focusScope = useRef(false)
  useEffect(() => {
    if (focusScope.current && data && !invalid) {
      focusScope.current = false
      heading.current?.focus({ preventScroll: true })
    }
  }, [data, invalid, scope.institute, scope.program])
  function selectStudent(student) { studentTrigger.current = document.activeElement; setStudent(student) }
  function change(next) {
    setAttention(null); setStudent(null)
    const updated = { batch_status: scope.status, ...scope.institute && { institute: scope.institute }, ...scope.program && { program: scope.program }, ...next }
    setParams(Object.fromEntries(Object.entries(updated).filter(([, value]) => value)))
  }
  const attentionRows = data?.dashboard_attention ? [
    { label: 'Pending retake requests', count: data.dashboard_attention.pending_retakes, action: () => setAttention('retakes'), note: 'Active enrolled batches' },
    { label: 'Instructor accounts awaiting approval', count: data.summary.pending_instructors, to: '/admin/users?tab=pending', note: 'School-wide account approvals' },
    { label: 'Batches without required assessments', count: data.dashboard_attention.batches_without_required.length, action: () => setAttention('setup'), note: 'Active batches without published required work' },
    { label: 'Students whose results need updating', count: data.dashboard_attention.unavailable_results, to: schoolReportLink(scope, 'assessments', 'reason:Final results unavailable'), note: 'Required work complete; final results unavailable' },
  ].filter(row => row.count > 0) : []
  const scopeKey = `${scope.institute}:${scope.program}:${scope.status}`
  return <section className="mx-auto flex min-w-0 max-w-7xl flex-col gap-7 px-4 py-6 sm:gap-8 sm:px-6 sm:py-8">
    <header className="flex flex-wrap items-start justify-between gap-5">
      <div className="min-w-0"><h1 ref={heading} tabIndex={-1} aria-describedby="admin-dashboard-context" className="text-xl font-bold outline-none">Student performance</h1>
        <nav aria-label="Dashboard navigation" className="mt-2 flex flex-wrap items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
          <Link to={`/admin/dashboard${scope.status !== 'active' ? `?batch_status=${scope.status}` : ''}`} className="rounded text-green-700 underline focus-visible:outline-2 focus-visible:outline-green-600 dark:text-green-300">All institutes</Link>
          {institute && <><ChevronRightIcon size={12} /><button type="button" className="rounded text-green-700 underline focus-visible:outline-2 focus-visible:outline-green-600 dark:text-green-300" onClick={() => change({ program: '' })}>{institute.code}</button></>}
          {program && <><ChevronRightIcon size={12} /><span aria-current="page">{program.code}</span></>}
          {!institute && <span>School-wide overview</span>}
        </nav>
      </div>
      <div aria-label="Dashboard scope" className="grid w-full min-w-0 gap-3 sm:w-auto sm:grid-cols-[minmax(180px,230px)_minmax(180px,230px)_auto] sm:items-end">
        <label className="min-w-0 text-xs font-medium">Institute<select aria-label="Institute" className={field} value={scope.institute} disabled={!options} onChange={event => change({ institute: event.target.value, program: '' })}><option value="">All institutes</option>{options?.institutes.map(row => <option key={row.id} value={row.id}>{row.name}{!row.is_active ? ' (archived)' : ''}</option>)}</select></label>
        <label className="min-w-0 text-xs font-medium">Program<select aria-label="Program" className={field} value={scope.program} disabled={!institute} onChange={event => change({ program: event.target.value })}><option value="">All programs</option>{programs.map(row => <option key={row.id} value={row.id}>{row.name}{!row.is_active ? ' (archived)' : ''}</option>)}</select></label>
        {(scope.institute || scope.program || scope.status !== 'active') && <Link className="inline-flex min-h-10 items-center rounded text-xs font-medium text-green-700 underline focus-visible:outline-2 focus-visible:outline-green-600 dark:text-green-300" to="/admin/dashboard">Reset filters</Link>}
      </div>
    </header>
    <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-gray-500 dark:text-gray-400"><p id="admin-dashboard-context">{program ? `${institute.name} · ${program.name}` : institute ? `${institute.name} · All programs` : 'All institutes and programs'} · {scope.status === 'all' ? 'All batches' : `${scope.status === 'archived' ? 'Archived' : 'Active'} batches`}</p>
      <label className="flex items-center gap-2">Batch scope<select aria-label="Batch scope" className={`${field} !mt-0 !w-auto`} value={scope.status} onChange={event => change({ batch_status: event.target.value })}><option value="active">Active batches</option><option value="archived">Archived batches</option><option value="all">All batches</option></select></label></div>
    {invalid && <p role="alert" className="text-xs">This dashboard institute, program or batch scope is unavailable.</p>}
    {(error || optionsError) && <div role="alert" className={`${surface} space-y-3 p-4 text-xs`}><p>Could not refresh this dashboard.{data ? ' Showing the last loaded data for this scope.' : ''}</p><button type="button" className={button} onClick={() => { invalidateCache(ORGANIZATION_OPTIONS); if (url) invalidateCache(url) }}>Retry dashboard</button></div>}
    {!invalid && !error && !optionsError && (!options || !data) && <div className="space-y-6"><ContentSkeleton layout="stats" count={4} label="Loading dashboard overview" /><ContentSkeleton layout="cards" count={4} label="Loading dashboard highlights" /></div>}
    {!invalid && options && data && <>
      {!!data.scope.shared_batch_ids?.length && <p className="rounded-xl bg-green-50 p-3 text-xs leading-5 text-green-900 dark:bg-green-950 dark:text-green-200">{scope.program ? 'Includes' : 'Contains'} {data.scope.shared_batch_ids.length} shared-institute batches. Program views include their full mixed-program rosters. Program counts can overlap; school and institute totals count each student once.</p>}
      <DashboardContent key={scopeKey} data={data} options={options} scope={scope} onChoose={id => { focusScope.current = true; change(scope.institute ? { program: String(id) } : { institute: String(id), program: '' }) }} onSelectStudent={selectStudent} />
      <details><summary className="cursor-pointer rounded-lg py-2 text-xs font-semibold focus-visible:outline-2 focus-visible:outline-green-600">Attention and administration{attentionRows.length ? ` · ${attentionRows.length} queues` : ''}</summary><div className="mt-3 space-y-4">
        <AttentionCard rows={attentionRows} available={Boolean(data.dashboard_attention)} />
        <nav aria-label="Admin dashboard tools" className="flex flex-wrap gap-2"><Link className={button} to={schoolReportLink(scope)}><ReportIcon size={15} />Open reports</Link><Link className={button} to="/admin/institutes">Manage institutes</Link><Link className={button} to={schoolReportLink(scope, 'placements', 'awaiting')}>{data.summary.awaiting_review} awaiting placement review</Link><Link className={button} to={schoolReportLink(scope, 'placements', 'capacity')}>{data.summary.slots_remaining} remaining shared slots</Link></nav>
      </div></details>
      <p className="text-xs leading-5 text-gray-500 dark:text-gray-400">{data.scope.batch_ids.length} selected batches. Each student uses their newest enrollment in this scope. Cards summarize that cohort; opening a program includes its program-owned and shared-institute records. Approved decisions do not establish OJT completion.</p>
      {attention && <AttentionDialog key={attention} kind={attention} data={data} options={options} scope={scope} onClose={() => setAttention(null)} />}
    </>}
    {selectedStudent && <Suspense fallback={<p role="status" className="text-xs">Loading student details…</p>}><StudentDetailModal student={selectedStudent} readOnly isArchived={selectedStudent.archived} restoreFocusRef={studentTrigger} onClose={() => setStudent(null)} /></Suspense>}
  </section>
}
