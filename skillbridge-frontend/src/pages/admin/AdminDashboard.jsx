import { useMemo, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useApi, invalidateCache } from '../../hooks/useApi'
import api from '../../api/axios'
import { readBrowserSession } from '../../api/sessionRenewal'
import { rerunRecommendations, RECOMMENDATION_REFRESH_URLS } from '../../api/recommendationRerun'
import { useSSE } from '../../hooks/useSSE'
import { ANALYTICS_URL } from '../../utils/analytics'
import { ORGANIZATION_OPTIONS } from '../../utils/organizationScope'
import { schoolDashboardCards, schoolOrganizationRows, schoolReportLink } from '../../utils/schoolOverview'
import TaxonomyCardBanner from '../../components/TaxonomyCardBanner'
import { taxonomyBannerColor } from '../../utils/taxonomyBannerColors'
import CollectionViewToggle from '../../components/CollectionViewToggle'
import Pagination from '../../components/Pagination'
import DialogShell from '../../components/DialogShell'
import ConfirmModal from '../../components/admin/ConfirmModal'
import { ContentSkeleton } from '../../components/loading/Skeletons'
import { organizationButton as button, organizationPrimary as primary, organizationField as field, organizationCard } from '../../components/admin/organizationUi'
import { BriefcaseIcon, CheckCircleIcon, ChevronRightIcon, RefreshIcon, ReportIcon, UsersIcon, WarnIcon } from '../../components/Icons'

const icons = { students: UsersIcon, complete: CheckCircleIcon, review: WarnIcon, approved: BriefcaseIcon, capacity: BriefcaseIcon }
const surface = 'rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900'
const scopeQuery = scope => new URLSearchParams({ ...(scope.institute ? { institute: scope.institute, program: scope.program || 'all' } : {}) })
const dashboardPath = (scope, changes = {}) => `/admin/dashboard?${new URLSearchParams({ ...(scope.institute ? { institute: scope.institute } : {}), ...(scope.program ? { program: scope.program } : {}), batch_status: scope.status, ...changes })}`

function Summary({ data, scope }) {
  return <dl aria-label="Dashboard summary" className="grid grid-cols-1 gap-3 min-[480px]:grid-cols-2 xl:grid-cols-5">
    {schoolDashboardCards(data, scope).map(card => { const Icon = icons[card.kind]; return <div key={card.kind} className={`${organizationCard} relative min-w-0 p-4`}>
      <dt className="mb-4 flex items-start gap-2 text-xs font-semibold"><span aria-hidden="true" className="rounded-lg bg-green-50 p-2 text-green-700 dark:bg-green-950 dark:text-green-300"><Icon size={18} /></span><Link className="break-words before:absolute before:inset-0 before:rounded-2xl focus-visible:before:outline-2 focus-visible:before:outline-green-600" to={card.to}>{card.label}</Link></dt>
      <dd className="text-2xl font-bold tabular-nums">{card.value}</dd><dd className="mt-2 text-xs leading-5 text-gray-500 dark:text-gray-400">{card.description}</dd>
    </div> })}
  </dl>
}

function OrganizationCards({ data, options, scope }) {
  const [search, setSearch] = useState(''), [page, setPage] = useState(1), [view, setView] = useState('grid')
  const { rows, sharedStudents } = useMemo(() => schoolOrganizationRows(data, options, scope.institute), [data, options, scope.institute])
  const program = Boolean(scope.institute)
  const term = search.trim().toLowerCase()
  const filtered = rows.filter(row => `${row.name} ${row.code}`.toLowerCase().includes(term))
  const currentPage = Math.min(page, Math.max(1, Math.ceil(filtered.length / 9)))
  return <section aria-label={program ? 'Program overview' : 'Institute overview'} className="space-y-4">
    <header><h2 className="text-lg font-bold">{program ? 'Programs' : 'Institutes'}</h2><p className="mt-1 text-xs text-gray-500 dark:text-gray-400">{program ? 'Open a program for its records and skill highlights.' : 'Open an institute to see its programs and records.'}</p></header>
    <div className="flex flex-wrap items-end justify-between gap-3"><label className="w-full text-xs font-medium sm:max-w-sm">Search {program ? 'programs' : 'institutes'}<input type="search" className={field} value={search} maxLength={255} onChange={event => { setSearch(event.target.value); setPage(1) }} /></label><CollectionViewToggle view={view} onChange={setView} label="Organization overview view" mobile /></div>
    {sharedStudents > 0 && <p className="text-xs leading-5 text-gray-500 dark:text-gray-400">{sharedStudents} students are included in the totals through {program ? 'shared institute batches without a single program assignment' : 'batches awaiting an institute assignment'}. {program && <span>Program cards count program-owned batches; shared records are also visible within each program. </span>}{program && <Link className="text-green-700 underline dark:text-green-300" to={`/admin/batches?${scopeQuery(scope)}`}>View shared institute batches</Link>}</p>}
    <p className="text-xs text-gray-500 dark:text-gray-400">{filtered.length} {program ? 'programs' : 'institutes'}</p>
    {filtered.length ? <ul className={`grid gap-4 ${view === 'grid' ? 'sm:grid-cols-2 xl:grid-cols-3' : ''}`}>
      {filtered.slice((currentPage - 1) * 9, currentPage * 9).map(row => <li key={row.id} className={`${organizationCard} overflow-hidden`}>
        <Link aria-label={`Open ${row.name} dashboard`} to={dashboardPath(scope, program ? { program: String(row.id) } : { institute: String(row.id), program: '' })} className={`group flex h-full cursor-pointer flex-col rounded-2xl focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-green-600 ${view === 'list' ? 'sm:grid sm:grid-cols-[200px_minmax(0,1fr)]' : ''}`}>
          <div className={`relative aspect-[3/1] min-h-24 overflow-hidden ${view === 'list' ? 'sm:aspect-auto sm:h-full' : ''}`}><TaxonomyCardBanner imageUrl={row.image_url} name={row.name} color={taxonomyBannerColor(row.banner_color, row.id)} /><span className="absolute left-3 top-3 max-w-[calc(100%-24px)] truncate rounded-full bg-emerald-950/90 px-2.5 py-1 text-xs font-semibold text-white">{row.code}</span></div>
          <div className="min-w-0 space-y-4 p-4"><div className="flex items-start justify-between gap-2"><h3 className="break-words text-sm font-semibold group-hover:text-green-700 dark:group-hover:text-green-300">{row.name}</h3><ChevronRightIcon size={16} /></div>{!row.is_active && <p className="text-xs text-gray-500">Archived</p>}
            <dl className="grid grid-cols-2 gap-3 text-xs min-[480px]:grid-cols-4">{[[program ? row.batches : row.programs, program ? 'batches' : 'programs'], [row.students, program ? 'program-batch students' : 'students'], [row.complete, 'required complete'], [row.approved, 'approved placements']].map(([value, label]) => <div key={label}><dd className="font-bold tabular-nums">{value}</dd><dt className="mt-1 text-gray-500 dark:text-gray-400">{label}</dt></div>)}</dl>
          </div>
        </Link></li>)}
    </ul> : <p className={`${surface} p-6 text-xs text-gray-500`}>No {program ? 'programs' : 'institutes'} match this view.</p>}
    <Pagination total={filtered.length} page={currentPage} pageSize={9} onPage={setPage} />
  </section>
}

function AttentionDialog({ kind, data, options, scope, onClose }) {
  const [search, setSearch] = useState(''), [page, setPage] = useState(1)
  const attention = data.dashboard_attention
  const rows = kind === 'retakes' ? attention.retake_scopes.map((row, index) => {
    const institute = options.institutes.find(item => item.id === row.institute_id)
    const program = options.programs.find(item => item.id === row.program_id)
    return { id: index, name: program?.name || (institute ? `${institute.code} shared batches` : 'Institute not assigned'), detail: `${row.count} pending requests`,
      to: row.institute_id ? `/admin/retake-requests?${new URLSearchParams({ institute: row.institute_id, program: row.program_id || 'all', active_batches: '1' })}` : '/admin/retake-requests' }
  }) : attention.batches_without_required.map(id => {
    const batch = data.options.batches.find(row => row.id === id)
    return { id, name: batch?.name || `Batch ${id}`, detail: 'No published required assessments', to: `/admin/batches?${new URLSearchParams({ ...(batch?.institute_id ? { institute: batch.institute_id, program: batch.program_id || 'all' } : {}), batch_id: id })}` }
  })
  const filtered = rows.filter(row => row.name.toLowerCase().includes(search.trim().toLowerCase()))
  const currentPage = Math.min(page, Math.max(1, Math.ceil(filtered.length / 8)))
  return <DialogShell title={kind === 'retakes' ? 'Pending retake requests' : 'Batches without required assessments'} description="Open the relevant program or batch to review its records." onClose={onClose} size="collection" footer={<button type="button" className={button} onClick={onClose}>Done</button>}>
    <div className="min-h-0 space-y-4 overflow-y-auto p-5"><label className="block text-xs">Search attention records<input type="search" className={field} value={search} onChange={event => { setSearch(event.target.value); setPage(1) }} /></label>
      <ul className="space-y-2">{filtered.slice((currentPage - 1) * 8, currentPage * 8).map(row => <li key={row.id}><Link className={`${organizationCard} flex items-center justify-between gap-3 p-4 text-xs focus-visible:outline-2 focus-visible:outline-green-600`} to={row.to}><span className="min-w-0"><strong className="block break-words">{row.name}</strong><span className="mt-1 block text-gray-500 dark:text-gray-400">{row.detail}</span></span><ChevronRightIcon /></Link></li>)}</ul>
      {!filtered.length && <p className="text-xs">No attention records match.</p>}<Pagination total={filtered.length} page={currentPage} pageSize={8} onPage={setPage} />
      <p className="text-xs text-gray-500">Scope: {scope.program ? 'Selected program' : scope.institute ? 'Selected institute' : 'School-wide'}</p>
    </div>
  </DialogShell>
}

function ProgramHighlights({ data, scope }) {
  return <section aria-label="Program skill highlights" className="space-y-4"><h2 className="text-lg font-bold">Program skill highlights</h2><p className="text-xs leading-5 text-gray-500 dark:text-gray-400">Each saved category keeps its own skill set and version. Missing or locked evidence is excluded from skill results.</p>
    {data.skills.length ? <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{data.skills.slice(0, 6).map(skill => <li key={skill.id}><Link className={`${organizationCard} block h-full p-4 focus-visible:outline-2 focus-visible:outline-green-600`} to={schoolReportLink(scope, 'skills', `skill:${skill.id}`)}><h3 className="text-sm font-semibold">{skill.name}</h3><p className="mt-2 break-words text-xs text-gray-500 dark:text-gray-400">{skill.framework_label || 'Shared institute skills'}</p><p className="mt-3 text-xs">{skill.sample} with evidence · {skill.missing} missing / locked</p><p className="mt-2 text-xs text-gray-500 dark:text-gray-400">Strong {skill.strong} · Fair {skill.fair} · Needs work {skill.needs_work}</p></Link></li>)}</ul> : <p className={`${surface} p-5 text-xs`}>No final skill evidence is available for this program yet.</p>}
    <Link className={button} to={schoolReportLink(scope, 'skills')}>Open program skill report</Link>
    <h2 className="pt-3 text-lg font-bold">Students in this program</h2><ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{data.students.slice(0, 6).map(student => <li key={student.id}><Link className={`${organizationCard} block p-4 focus-visible:outline-2 focus-visible:outline-green-600`} to={schoolReportLink(scope, 'assessments', `batch:${student.batch_id}`)}><h3 className="break-words text-sm font-semibold">{student.name}</h3><p className="mt-1 break-words text-xs text-gray-500 dark:text-gray-400">{student.school_id || 'No student ID'} · {student.batch}</p><p className="mt-3 text-xs">{student.required_completed} / {student.required_total} required complete</p><p className="mt-1 text-xs text-gray-500 dark:text-gray-400">{student.reasons.join(' · ') || (student.placement_status === 'approved' ? 'Approved placement decision' : 'No current follow-up issue')}</p></Link></li>)}</ul>
    {!data.students.length && <p className="text-xs text-gray-500">No students in the selected program cohort.</p>}
    <Link className={button} to={schoolReportLink(scope)}>View all program records</Link>
  </section>
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
  const analyticsParams = new URLSearchParams({ ...(scope.status !== 'active' ? { batch_status: scope.status } : {}), ...(scope.institute ? { institute_id: scope.institute } : {}), ...(scope.program ? { program_id: scope.program } : {}) })
  const url = options && !invalid ? `${ANALYTICS_URL}${analyticsParams.size ? `?${analyticsParams}` : ''}` : null
  const { data, loading, error } = useApi(url)
  const [attention, setAttention] = useState(null), [confirm, setConfirm] = useState(false), [result, setResult] = useState(null)
  const pending = useRef(false)
  function change(next) { setAttention(null); setResult(null); setParams({ batch_status: scope.status, ...scope.institute && { institute: scope.institute }, ...scope.program && { program: scope.program }, ...next }) }
  async function refreshRecommendations() {
    if (pending.current) return { ok: false, message: 'A refresh is already in progress.' }
    pending.current = true
    try {
      const outcome = await rerunRecommendations(api, readBrowserSession().id, { ...(confirm.institute ? { institute_id: Number(confirm.institute) } : {}), ...(confirm.program ? { program_id: Number(confirm.program) } : {}) })
      if (outcome.refresh) RECOMMENDATION_REFRESH_URLS.forEach(invalidateCache)
      setResult(outcome)
      if (outcome.type !== 'error') setConfirm(false)
      return { ok: outcome.type !== 'error', message: outcome.message }
    } finally { pending.current = false }
  }
  const attentionRows = data?.dashboard_attention ? [
    { label: 'Pending retake requests', count: data.dashboard_attention.pending_retakes, action: () => setAttention('retakes'), note: 'Active enrolled batches' },
    { label: 'Instructor accounts awaiting approval', count: data.summary.pending_instructors, to: '/admin/users?tab=pending', note: 'School-wide account approvals' },
    { label: 'Batches without required assessments', count: data.dashboard_attention.batches_without_required.length, action: () => setAttention('setup'), note: 'Active batches without published required work' },
    { label: 'Students whose results need updating', count: data.dashboard_attention.unavailable_results, to: schoolReportLink(scope, 'assessments', 'reason:Final results unavailable'), note: 'Required work complete; final results unavailable' },
  ].filter(row => row.count > 0) : []
  return <section className="mx-auto min-w-0 max-w-7xl space-y-6 px-4 py-6 sm:px-6 sm:py-8">
    <header className="flex flex-wrap items-start justify-between gap-4"><div><h1 className="text-xl font-bold">Admin dashboard</h1><p className="mt-2 text-xs text-gray-500 dark:text-gray-400">School overview across institutes and programs.</p></div><div className="flex flex-wrap gap-2"><Link className={button} to="/admin/institutes">Manage institutes</Link><Link className={primary} to={schoolReportLink(scope)}><ReportIcon size={16} />Open reports</Link></div></header>
    <section aria-label="Dashboard scope" className={`${surface} space-y-4 p-4`}><p className="text-xs font-semibold text-green-800 dark:text-green-300">{program ? `${institute.code} · ${program.name}` : institute ? `${institute.name} · All programs` : 'School-wide overview'}</p><div className="grid gap-3 sm:grid-cols-3"><label className="text-xs font-medium">Institute<select aria-label="Institute" className={field} value={scope.institute} disabled={!options} onChange={event => change({ institute: event.target.value, program: '' })}><option value="">All institutes</option>{options?.institutes.map(row => <option key={row.id} value={row.id}>{row.name}{!row.is_active ? ' (archived)' : ''}</option>)}</select></label><label className="text-xs font-medium">Program<select aria-label="Program" className={field} value={scope.program} disabled={!institute} onChange={event => change({ program: event.target.value })}><option value="">{institute ? 'All programs' : 'Choose an institute first'}</option>{programs.map(row => <option key={row.id} value={row.id}>{row.name}{!row.is_active ? ' (archived)' : ''}</option>)}</select></label><label className="text-xs font-medium">Batch scope<select aria-label="Batch scope" className={field} value={scope.status} onChange={event => change({ batch_status: event.target.value })}><option value="active">Active batches</option><option value="archived">Archived batches</option><option value="all">All batches</option></select></label></div>
      {(scope.institute || scope.program || scope.status !== 'active') && <Link className={button} to="/admin/dashboard">School-wide overview</Link>}
    </section>
    {invalid && <p role="alert" className="text-xs">This dashboard institute, program or batch scope is unavailable.</p>}
    {(error || optionsError) && <div role="alert" className={`${surface} space-y-3 p-4 text-xs`}><p>Could not refresh this dashboard.{data ? ' Showing the last loaded data.' : ''}</p><button className={button} onClick={() => { invalidateCache(ORGANIZATION_OPTIONS); if (url) invalidateCache(url) }}>Retry dashboard</button></div>}
    {!invalid && !error && !optionsError && (!options || !data) && <div className="space-y-6"><ContentSkeleton layout="stats" count={5} label="Loading dashboard overview" /><ContentSkeleton layout="cards" count={3} label="Loading institute overview" /></div>}
    {!invalid && options && data && <>
      {scope.program && data.scope.shared_batch_ids?.length > 0 && <p className="rounded-xl bg-green-50 p-4 text-xs leading-5 text-green-900 dark:bg-green-950 dark:text-green-200">Includes {data.scope.shared_batch_ids.length} shared {institute.code} batches with their full mixed-program rosters. Program views can overlap; school and institute totals still count each student once.</p>}
      <Summary data={data} scope={scope} />
      <p className="text-xs leading-5 text-gray-500 dark:text-gray-400">{scope.institute ? programs.length : options.institutes.length} {scope.institute ? 'programs in this institute' : 'institutes'} · {data.scope.batch_ids.length} selected batches. Each student is counted once using their newest selected enrollment. Approved decisions do not establish OJT completion.</p>
      {!scope.program ? <OrganizationCards key={`${scope.institute}:${scope.status}`} data={data} options={options} scope={scope} /> : <><nav aria-label="Program workspaces" className="flex flex-wrap gap-2">{[['batches', 'Batches'], ['assessments', 'Assessments'], ['companies', 'OJT Partners'], ['placements', 'Placements']].map(([path, label]) => <Link key={path} className={button} to={`/admin/${path}?${scopeQuery(scope)}`}>{label}</Link>)}</nav><ProgramHighlights data={data} scope={scope} /></>}
      <section aria-label="Needs attention" className="space-y-4"><h2 className="text-lg font-bold">Needs attention</h2><div className={`${surface} divide-y divide-gray-100 dark:divide-gray-800`}>{attentionRows.map(row => <div key={row.label}>{row.to ? <Link className="flex min-h-16 items-center justify-between gap-3 rounded-lg px-4 py-3 text-xs hover:bg-green-50 focus-visible:outline-2 focus-visible:outline-green-600 dark:hover:bg-green-950" to={row.to}><span><strong>{row.label}</strong><span className="mt-1 block text-gray-500 dark:text-gray-400">{row.note}</span></span><span className="flex items-center gap-3 font-semibold">{row.count}<ChevronRightIcon /></span></Link> : <button type="button" className="flex min-h-16 w-full cursor-pointer items-center justify-between gap-3 rounded-lg px-4 py-3 text-left text-xs hover:bg-green-50 focus-visible:outline-2 focus-visible:outline-green-600 dark:hover:bg-green-950" onClick={row.action}><span><strong>{row.label}</strong><span className="mt-1 block text-gray-500 dark:text-gray-400">{row.note}</span></span><span className="flex items-center gap-3 font-semibold">{row.count}<ChevronRightIcon /></span></button>}</div>)}{!attentionRows.length && <p className="p-5 text-xs text-gray-500 dark:text-gray-400">{data.dashboard_attention ? 'No current attention items in this scope.' : 'Attention details are unavailable. Refresh the dashboard to load them.'}</p>}</div></section>
      {!scope.program && <p className="text-xs text-gray-500 dark:text-gray-400">Choose a program to view its student and skill highlights.</p>}
      <details className={`${surface} p-4`}><summary className="cursor-pointer text-xs font-semibold hover:text-green-700 focus-visible:outline-2 focus-visible:outline-green-600">Recommendation maintenance</summary><div className="mt-4 space-y-3"><p className="text-xs leading-5 text-gray-500 dark:text-gray-400">Refresh recommendations for {scope.program ? 'program-owned active batches' : 'active batches'} in {program ? program.name : institute ? institute.name : 'all institutes'}. Existing approved decisions and assessment evidence are retained. Shared institute batches use the institute-wide maintenance scope.</p><button type="button" className={button} disabled={loading || scope.status !== 'active' || !data.options.batches.some(row => data.scope.batch_ids.includes(row.id) && (!scope.program || String(row.program_id) === scope.program))} onClick={() => setConfirm({ institute: scope.institute, program: scope.program, label: program?.name || institute?.name || 'all institutes' })}><RefreshIcon />Refresh recommendations for this scope</button>{scope.status !== 'active' && <p className="text-xs text-gray-500">Choose Active batches to use this maintenance action.</p>}{result && <p role="status" className="text-xs">{result.message}</p>}</div></details>
      {attention && <AttentionDialog key={attention} kind={attention} data={data} options={options} scope={scope} onClose={() => setAttention(null)} />}
      {confirm && <ConfirmModal title="Refresh recommendations for this scope?" message={`Refresh recommendations for ${confirm.label}? This uses the current active batches; approved placements and assessment evidence are retained.`} confirmLabel="Refresh recommendations" tone="neutral" onCancel={() => setConfirm(false)} onConfirm={refreshRecommendations} />}
    </>}
  </section>
}
