import { useEffect, useRef } from 'react'
import { Link, useLocation, useSearchParams } from 'react-router-dom'
import { invalidateCache, useApi } from '../../hooks/useApi'
import { ORGANIZATION_OPTIONS } from '../../utils/organizationScope'
import TaxonomyLibraryCards from '../TaxonomyLibraryCards'
import { organizationButton as button, organizationField as field } from './organizationUi'

// Collections mount only after the administrator chooses a valid context.
export default function AdminScopeNavigator({ title, children, dropdowns = false, overview, action }) {
  const { pathname } = useLocation()
  const [params, setParams] = useSearchParams()
  const { data, error, loading } = useApi(ORGANIZATION_OPTIONS)
  const instituteId = params.get('institute') || ''
  const programId = params.get('program') || ''
  const institute = data?.institutes.find(row => String(row.id) === instituteId)
  const programs = (data?.programs || []).filter(row => row.institute_id === institute?.id)
  const program = programs.find(row => String(row.id) === programId)
  const ready = Boolean(institute && (program || programId === 'all'))
  const heading = useRef(null)
  useEffect(() => { heading.current?.focus({ preventScroll: true }) }, [instituteId, programId, ready])
  const root = pathname
  const retained = new URLSearchParams()
  if (pathname === '/admin/batches') for (const key of ['batch_id', 'emails', 'email_group']) {
    if (params.get(key)) retained.set(key, params.get(key))
  }
  const instituteLink = id => `${root}?${new URLSearchParams({ ...Object.fromEntries(retained), institute: id })}`
  const institutePath = instituteLink(instituteId)
  const path = value => `${institutePath}&program=${value}`
  const items = !instituteId ? (data?.institutes || []).map(row => ({ ...row,
    to: instituteLink(row.id), subtitle: 'Choose a program in this institute',
  })) : institute ? [
    { ...institute, name: `All ${institute.code} programs`, code: institute.code,
      to: path('all'), subtitle: 'All programs, including shared institute records', shared: true },
    ...programs.map(row => ({ ...row, to: path(row.id), subtitle: institute.name })),
  ] : []
  const invalid = data && (instituteId && !institute || programId && (!institute || !program && programId !== 'all'))
  const headingContent = <>
    {!ready && <header><h1 ref={heading} tabIndex={-1} className="text-xl font-bold outline-none">{title}</h1>
      <p className="mt-2 text-xs leading-5 text-gray-500 dark:text-gray-400">{overview ? 'View partner locations across the school, or choose an institute and program to manage its records.' : 'Choose an institute, then a program to view its records.'}</p></header>}
    {(instituteId || programId) && <nav aria-label="Institute and program path" className="flex flex-wrap items-center gap-2 text-xs">
      <Link className={button} to={root}>All institutes</Link>
      {institute && <Link className={button} to={institutePath}>{institute.name}</Link>}
      {ready && <p ref={heading} tabIndex={-1} className="break-words font-semibold outline-none" aria-current="page">{program ? `${program.code} · ${program.name}` : `All ${institute.code} programs`}</p>}
    </nav>}
  </>
  return <>
    <section aria-label="Admin institute and program navigation" className="mx-auto max-w-7xl space-y-4 px-4 pt-6 sm:px-6">
      {action ? <div className="flex flex-wrap items-start justify-between gap-3">
        {headingContent}<div className="ml-auto">{action}</div>
      </div> : headingContent}
      {dropdowns && <fieldset className="grid gap-3 sm:grid-cols-2" aria-label="Institute and program scope">
        <label className="text-xs font-medium">Institute<select aria-label="Institute" className={field} value={instituteId} disabled={!data}
          onChange={event => setParams(event.target.value ? { institute: event.target.value } : {})}>
          <option value="">{overview ? 'All institutes' : 'Choose an institute'}</option>{data?.institutes.map(row => <option key={row.id} value={row.id}>{row.name}{!row.is_active ? ' (archived)' : ''}</option>)}
        </select></label>
        <label className="text-xs font-medium">Program<select aria-label="Program" className={field} value={programId} disabled={!institute}
          onChange={event => setParams({ institute: instituteId, ...(event.target.value ? { program: event.target.value } : {}) })}>
          <option value="">{overview ? 'All programs on map' : 'Choose a program'}</option>{institute && <option value="all">All {institute.code} programs</option>}
          {programs.map(row => <option key={row.id} value={row.id}>{row.name}{!row.is_active ? ' (archived)' : ''}</option>)}
        </select></label>
      </fieldset>}
      {error && <div role="alert" className="text-xs text-rose-700 dark:text-rose-300"><p>Could not refresh institute and program choices.</p><button type="button" className={button} onClick={() => invalidateCache(ORGANIZATION_OPTIONS)}>Retry choices</button></div>}
      {loading && !data && <p role="status" className="text-xs">Loading institutes and programs…</p>}
      {invalid ? <p role="alert" className="text-xs">This institute or program is unavailable. Choose a valid institute and program.</p>
        : !ready && data && !dropdowns && <TaxonomyLibraryCards key={instituteId} items={items} label={institute ? 'Programs' : 'Institutes'} emptyMessage="No institutes or programs are available here." />}
      {ready && <p className="text-xs leading-5 text-gray-500 dark:text-gray-400">{program ? `${program.code} records and shared ${institute.code} records are shown together. Shared records open their full batch, including students from other programs.` : `All ${institute.code} programs includes program-specific and shared institute records. Shared records keep one full batch.`}</p>}
      {overview && overview({ institute: instituteId, program: programId === 'all' ? '' : programId })}
    </section>
    {ready && <div key={`${instituteId}:${programId}`}>{children({ institute: instituteId, program: program ? programId : '' }, { institute, program })}</div>}
  </>
}
