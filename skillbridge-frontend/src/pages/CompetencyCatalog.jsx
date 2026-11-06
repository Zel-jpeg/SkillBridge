import { lazy, Suspense, useEffect, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import api from '../api/axios'
import { requestErrorMessage } from '../api/requestErrors'
import { invalidateCache, useApi } from '../hooks/useApi'
import { useToast } from '../context/ToastContext'
import DataSection from '../components/DataSection'
import DialogShell from '../components/DialogShell'
import CollectionViewToggle from '../components/CollectionViewToggle'
import TaxonomyLibraryCards from '../components/TaxonomyLibraryCards'
import SkillLibraryTable, { SkillLibraryOptions } from '../components/SkillLibraryTable'
import { ORGANIZATION_OPTIONS } from '../utils/organizationScope'
import { CatalogForm } from './admin/AdminInstitutes'
import Pagination from '../components/Pagination'
import ConfirmModal from '../components/admin/ConfirmModal'
import { useScopedAssistance } from '../hooks/useScopedAssistance'
import { mergeSuggestedTags } from '../utils/competencyAssistance'
import { organizationField as field, organizationButton as button, organizationPrimary as primary, organizationCard as card } from '../components/admin/organizationUi'

const PROGRAMS = '/api/management/competency-programs/'
const AdminSkills = lazy(() => import('./admin/AdminSkills'))

const assistanceMessages = {
  empty_catalog: 'No saved categories yet. Enter your own definition and tags.',
  empty_text: 'Enter some text to check against the saved definitions.',
  no_match: 'No clear match in these definitions. Choose or define a category manually.',
  ambiguous: 'Several categories are similar. Review their definitions and choose manually.',
  unavailable: 'Suggestions are unavailable. Continue with manual entry.',
  no_suggestions: 'This saved category has no tags to reuse. Enter your own vocabulary.',
}

function QuestionCheck({ detail, digest }) {
  const [question, setQuestion] = useState('')
  const assistance = useScopedAssistance(`${detail}assist/category/`, { question_text: question }, digest)
  return <div className="mt-4 space-y-3 text-xs">
    <p>Compare question wording with this version’s saved names, definitions and tags. Similarity is a text clue; review the category yourself.</p>
    <label className="block space-y-2 font-semibold">Question to check<textarea aria-label="Question to check" className={`${field} min-h-24`} maxLength={4000} value={question} onChange={event => setQuestion(event.target.value)} /></label>
    <button type="button" className={button} disabled={assistance.loading || !question.trim()} onClick={assistance.run}>{assistance.loading ? 'Checking…' : 'Check saved categories'}</button>
    {assistance.error && <p role="alert">{assistance.error} You can still choose a category manually.</p>}
    {assistance.data && <div role="status" className="space-y-2">
      <p>{assistance.data.status === 'matched' ? `Suggested category: ${assistance.data.suggested_category.name}. Review its definition before use.` : assistanceMessages[assistance.data.status]}</p>
      {assistance.data.candidates.length > 0 && <ul className="list-inside list-disc space-y-1" aria-label="Similar saved categories">{assistance.data.candidates.map(candidate => <li key={candidate.id}>{candidate.name}</li>)}</ul>}
      <p className="text-gray-500 dark:text-gray-400">This check does not save questions or change scores.</p>
    </div>}
  </div>
}

function Editor({ kind, row, source, url, framework, starterName, onClose, onSaved }) {
  const category = kind === 'category'
  const [name, setName] = useState(row?.name || source?.name || '')
  const [description, setDescription] = useState(row?.description || source?.description || '')
  const [tags, setTags] = useState((row?.tags || []).join(', '))
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [discard, setDiscard] = useState(false)
  const [requestId] = useState(() => crypto.randomUUID())
  const pending = useRef(false)
  const assistance = useScopedAssistance(`${url.replace(/categories\/$/, '')}assist/tags/`, { name, description }, framework?.digest)
  const title = category
    ? (row ? 'Edit Skill' : 'Add Skill')
    : (row ? 'Edit framework' : source ? 'Create new version' : 'Create framework')
  const changed = name !== (row?.name || source?.name || '') || description !== (row?.description || source?.description || '') || tags !== (row?.tags || []).join(', ')
  function close() { if (!pending.current) { if (changed) setDiscard(true); else onClose() } }
  async function save(event) {
    event.preventDefault()
    if (pending.current) return
    if (!name.trim() || category && !description.trim()) { setError(category ? 'Enter a name and a clear category description.' : 'Enter a framework name.'); return }
    pending.current = true; setSaving(true); setError('')
    const content = { name: name.trim(), description: description.trim(),
      ...(category ? { tags: tags.split(',').map(tag => tag.trim()).filter(Boolean) } : {}),
      ...(row ? { expected_digest: row.digest } : !category ? { request_id: requestId, ...(source ? { source_framework_id: source.id } : {}) } : {}) }
    try {
      const payload = starterName ? { name: starterName, request_id: requestId, initial_category: content } : content
      const { data } = await api[row ? 'patch' : 'post'](row ? `${url}${row.id}/` : url, payload)
      onSaved(data)
    } catch (failure) { setError(requestErrorMessage(failure, { mutation: true })) }
    finally { pending.current = false; setSaving(false) }
  }
  return <DialogShell title={title} description={category ? 'Define the knowledge this category measures. Tags provide vocabulary; they are not separately scored.' : source ? `Copy v${source.version} into a new editable version. Existing batches and categories keep their original definitions.` : 'A framework is a program’s reviewed set of assessment skill categories.'}
    onClose={close} closeDisabled={saving} size="confirm" footer={<div className="flex gap-2"><button type="button" className={button} disabled={saving} onClick={close}>Cancel</button><button type="submit" form="competency-editor" className={primary} disabled={saving}>{saving ? 'Saving…' : row ? 'Save changes' : source ? 'Create version' : title}</button></div>}>
    <form id="competency-editor" onSubmit={save} className="min-h-0 flex-1 space-y-4 overflow-y-auto p-5 text-xs">
      {error && <p role="alert" className="text-rose-700 dark:text-rose-300">{error}</p>}
      <fieldset disabled={saving} className="space-y-4">
        <label className="block space-y-2 font-semibold">Name<input className={field} aria-label="Name" maxLength={category ? 100 : 160} value={name} onChange={event => setName(event.target.value)} required /></label>
        <label className="block space-y-2 font-semibold">Description<textarea className={`${field} min-h-28`} aria-label="Description" maxLength={2000} value={description} onChange={event => setDescription(event.target.value)} required={category} /></label>
        {category && <label className="block space-y-2 font-semibold">Tags, separated by commas<input className={field} aria-label="Tags" value={tags} onChange={event => setTags(event.target.value)} placeholder="Add your program’s vocabulary" /><span className="block font-normal text-gray-500 dark:text-gray-400">Up to 30 tags, 80 characters each. Manual tags stay under your control.</span></label>}
        {category && <section className="space-y-3 break-words rounded-xl border border-gray-200 p-4 dark:border-gray-700" aria-label="Optional tag assistance">
          <p>Reuse vocabulary from saved categories in this framework, or enter tags manually. Review definitions against your program’s curriculum or an applicable published standard.</p>
          <button type="button" className={button} disabled={assistance.loading || !name.trim() && !description.trim()} onClick={assistance.run}>{assistance.loading ? 'Finding…' : 'Find saved tags'}</button>
          {assistance.error && <p role="alert">{assistance.error} Manual entry is still available.</p>}
          {assistance.data && <div role="status" className="space-y-2">
            {assistance.data.suggested_tags.length ? <><p>Saved tags from {assistance.data.source_category.name}: {assistance.data.suggested_tags.join(', ')}</p><button type="button" className={button} onClick={() => setTags(current => mergeSuggestedTags(current, assistance.data.suggested_tags))}>Add suggested tags</button><p className="text-gray-500 dark:text-gray-400">Adds new tags within the 30-tag limit. Your existing tags stay first; nothing is saved until you submit this form.</p></> : <p>{assistanceMessages[assistance.data.status]}</p>}
          </div>}
        </section>}
      </fieldset>
    </form>
    {discard && <ConfirmModal title="Discard definition changes?" message="Your unsaved definition changes will be discarded." confirmLabel="Discard changes" onCancel={() => setDiscard(false)} onConfirm={onClose} />}
  </DialogShell>
}

function Categories({ programId, frameworkId, onBack, current = false }) {
  const { showToast } = useToast()
  const base = `/api/management/programs/${programId}/frameworks/`
  const detail = `${base}${frameworkId}/`
  const { data: framework } = useApi(detail)
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const url = `${detail}categories/?page=${page}&page_size=8&search=${encodeURIComponent(search)}`
  const { data } = useApi(url)
  const [editor, setEditor] = useState(null)
  const [action, setAction] = useState(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const pending = useRef(false)
  const available = framework?.is_active && framework.program.is_active
  function refresh() { invalidateCache(base); invalidateCache(detail); invalidateCache(`${detail}categories/`) }
  function saved(row) { refresh(); setEditor(null); if (row.framework_id == null) onBack(); showToast('Definition saved.') }
  async function changeVersion() {
    if (pending.current) return
    pending.current = true; setBusy(true); setError('')
    try {
      await api.patch(detail, { expected_digest: framework.digest, ...(action === 'freeze' ? { freeze: true } : { is_active: action === 'restore' }) })
      refresh(); setAction(null); showToast('Framework version updated.')
    } catch (failure) { setError(requestErrorMessage(failure, { mutation: true })); setAction(null) }
    finally { pending.current = false; setBusy(false) }
  }
  return <DataSection url={detail} layout="panel"><div className="space-y-5">
    {framework && <>
      <header className="flex flex-wrap items-start justify-between gap-4"><div className="min-w-0"><h2 className="break-words text-lg font-bold">{current ? `${framework.program.name} skills` : `${framework.name} · v${framework.version}`}</h2><p className="mt-2 text-xs text-gray-500 dark:text-gray-400">{framework.program.institute_code} · {framework.program.code} · {!framework.is_active ? 'Retired' : framework.locked ? 'Definitions frozen or in use' : 'Editable definitions'}</p><p className="mt-2 max-w-3xl whitespace-pre-wrap break-words text-xs">{framework.description}</p></div>
        {available && !framework.locked && <button type="button" className={primary} onClick={() => setEditor({ kind: 'category' })}>Add Skill</button>}
      </header>
      {framework.locked && <p className="text-xs text-gray-600 dark:text-gray-300">These definitions stay with their recorded evidence. Create a new version to revise names, descriptions or tags.</p>}
      {error && <p role="alert" className="text-xs text-rose-700 dark:text-rose-300">{error}</p>}
      <SkillLibraryOptions>
        <div className="flex flex-wrap gap-2">
          <button type="button" className={button} onClick={onBack}>{current ? 'Skill set versions' : '← All versions'}</button>
          <button type="button" className={button} onClick={refresh}>Refresh catalog</button>
          {!current && <>
            {framework.can_edit && available && <button className={button} onClick={() => setEditor({ kind: 'framework', row: framework })}>Edit framework</button>}
            {framework.program.is_active && <button className={button} onClick={() => setEditor({ kind: 'framework', source: framework })}>Create new version</button>}
            {framework.can_manage && available && !framework.locked && <button className={button} disabled={busy} onClick={() => setAction('freeze')}>Freeze definitions</button>}
            {framework.can_manage && <button className={button} disabled={busy} onClick={() => setAction(framework.is_active ? 'retire' : 'restore')}>{framework.is_active ? 'Retire version' : 'Restore version'}</button>}
          </>}
        </div>
        <details className="break-words text-xs"><summary className="cursor-pointer font-semibold hover:text-green-700 focus-visible:outline-2 focus-visible:outline-green-600 dark:hover:text-green-300">Check a question against saved categories</summary><QuestionCheck detail={detail} digest={framework.digest} /></details>
      </SkillLibraryOptions>
      <SkillLibraryTable url={url} skills={data?.results} total={data?.count ?? null} search={search} onSearch={value => { setSearch(value); setPage(1) }}
        renderActions={available && !framework.locked ? category => category.can_edit && <button type="button"
          className={button} aria-label={`Edit ${category.name}`} onClick={() => setEditor({ kind: 'category', row: category })}>Edit</button> : undefined}
        footer={data && <div className="px-4"><Pagination total={data.count} page={data.page} pageSize={data.page_size} onPage={setPage} /></div>} />
      {editor && <Editor {...editor} framework={framework} url={editor.kind === 'category' ? `${detail}categories/` : base} onClose={() => setEditor(null)} onSaved={saved} />}
      {action && <ConfirmModal tone="confirm" title={action === 'freeze' ? 'Freeze this version?' : action === 'retire' ? 'Retire this version?' : 'Restore this version?'} message={action === 'freeze' ? 'Names, descriptions and tags will become read-only. Review every category first. Later revisions need a new version; existing evidence keeps these definitions.' : action === 'retire' ? 'This version remains available for retained records. Its definitions will not accept new edits.' : 'Restore this version for its existing context. Frozen definitions stay frozen.'} confirmLabel={action === 'freeze' ? 'Freeze definitions' : action === 'retire' ? 'Retire version' : 'Restore version'} onCancel={() => { if (!busy) setAction(null) }} onConfirm={changeVersion} />}
    </>}
  </div></DataSection>
}

function Versions({ programId }) {
  const [view, setView] = useState('grid')
  const { showToast } = useToast()
  const programUrl = `${PROGRAMS}${programId}/`
  const { data: program } = useApi(programUrl)
  const base = `/api/management/programs/${programId}/frameworks/`
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [status, setStatus] = useState('all')
  const [selected, setSelected] = useState(null)
  const [create, setCreate] = useState(false)
  const [advanced, setAdvanced] = useState(false)
  const [starter, setStarter] = useState(false)
  const url = `${base}?page=${page}&page_size=8&status=${status}&search=${encodeURIComponent(search)}`
  const { data } = useApi(url)
  if (selected) return <Categories key={selected} programId={programId} frameworkId={selected} onBack={() => setSelected(null)} />
  if (!program || !data) return <DataSection urls={[programUrl, url]} layout="panel" label="Loading program skills" />
  if (!advanced && !starter && data?.count === 1 && data.results[0]?.is_active) {
    return <Categories key={data.results[0].id} programId={programId} frameworkId={data.results[0].id} current onBack={() => setAdvanced(true)} />
  }
  if (!advanced && (starter || data?.count === 0)) return <section className="space-y-4">
    <header className="flex flex-wrap items-start justify-between gap-4">
      <div><h2 className="text-lg font-bold">{program?.name} skills</h2>
        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">Add the first skill to start this program’s skill library.</p></div>
      <button type="button" className={primary} disabled={!program?.is_active} onClick={() => setStarter(true)}>Add Skill</button>
    </header>
    <SkillLibraryOptions>
      <button type="button" className={button} onClick={() => setAdvanced(true)}>Skill set versions</button>
    </SkillLibraryOptions>
    <SkillLibraryTable />
    {starter && <Editor kind="category" starterName={`${program.code} skills`} url={base} onClose={() => setStarter(false)} onSaved={() => {
      setStarter(false); invalidateCache(base); showToast('Skill added.')
    }} />}
  </section>
  return <DataSection url={programUrl} layout="panel"><section className="space-y-4">
    {advanced && <button type="button" className={button} onClick={() => {
      setAdvanced(false); setSearch(''); setPage(1); setStatus('all')
    }}>Back to skills</button>}
    <header className="flex flex-wrap items-start justify-between gap-4"><div><h2 className="text-lg font-bold">{program?.institute_code} · {program?.code}</h2><p className="mt-1 text-xs text-gray-500 dark:text-gray-400">{program?.name}</p></div><div className="flex flex-wrap gap-2"><button type="button" className={button} onClick={() => invalidateCache(base)}>Refresh catalog</button><button className={primary} disabled={!program?.is_active} onClick={() => setCreate(true)}>Create framework</button></div></header>
    <div className="grid gap-3 sm:grid-cols-[1fr_180px]"><label className="space-y-2 text-xs font-semibold">Search versions<input className={field} type="search" aria-label="Search versions" value={search} onChange={event => { setSearch(event.target.value); setPage(1) }} /></label><label className="space-y-2 text-xs font-semibold">Version status<select className={field} value={status} onChange={event => { setStatus(event.target.value); setPage(1) }}><option value="all">All versions</option><option value="active">Active</option><option value="archived">Retired</option></select></label></div>
    <DataSection url={url} layout="cards" count={4}>
      <div className="flex flex-wrap items-center justify-between gap-3"><p className="text-xs text-gray-500 dark:text-gray-400" role="status">{data?.count ?? 0} {data?.count === 1 ? 'version' : 'versions'}</p><CollectionViewToggle view={view} onChange={setView} label="Framework view" mobile /></div>
      <div className={`grid gap-4 ${view === 'grid' ? 'md:grid-cols-2' : ''}`}>
        {data?.results?.map(framework => <article key={framework.id} className={`${card} grid gap-4 p-4 sm:p-5 ${view === 'list' ? 'sm:grid-cols-[minmax(0,1fr)_auto] sm:items-start' : ''}`}>
          <div className="min-w-0">
            <h3 className="break-words text-sm font-semibold">{framework.name} · v{framework.version}</h3>
            <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">{framework.category_count} {framework.category_count === 1 ? 'category' : 'categories'} · {!framework.is_active ? 'Retired' : framework.locked ? 'Frozen or in use' : 'Editable'}</p>
            {framework.description && <p className="mt-3 line-clamp-3 whitespace-pre-wrap break-words text-xs leading-6">{framework.description}</p>}
          </div>
          <button className={`${button} justify-self-start`} onClick={() => setSelected(framework.id)}>Open v{framework.version}</button>
        </article>)}
      </div>
      {data?.count === 0 && <p className="py-8 text-center text-xs text-gray-500 dark:text-gray-400">{search ? 'No versions match this search.' : 'No competency framework yet. Create a version and define its categories.'}</p>}
      {data && <Pagination total={data.count} page={data.page} pageSize={data.page_size} onPage={setPage} />}
    </DataSection>
    {create && <Editor kind="framework" url={base} onClose={() => setCreate(false)} onSaved={framework => { setCreate(false); invalidateCache(base); setSelected(framework.id); showToast('Framework created.') }} />}
  </section></DataSection>
}

export default function CompetencyCatalog({ role = 'instructor' }) {
  const [params] = useSearchParams()
  const [editor, setEditor] = useState(null)
  const { showToast } = useToast()
  const admin = role === 'admin'
  const root = `/${role}/competencies`
  const { data, request } = useApi(ORGANIZATION_OPTIONS)
  const instituteId = admin ? params.get('institute') : null
  const programId = params.get('program')
  const heading = useRef(null)
  const scopeKey = `${instituteId}:${programId}`
  const previousScope = useRef(scopeKey)
  useEffect(() => {
    if (previousScope.current === scopeKey) return
    previousScope.current = scopeKey
    heading.current?.focus({ preventScroll: true })
    window.scrollTo(0, 0)
  }, [scopeKey])
  const institute = data?.institutes.find(row => String(row.id) === instituteId)
  const institutePath = institute ? `${root}?institute=${institute.id}` : root
  const libraryPath = id => `${institutePath}${institute ? '&' : '?'}program=${id}`
  const programs = (data?.programs || []).filter(row => !instituteId || row.institute_id === institute?.id)
  const program = programs.find(row => String(row.id) === programId)
  const sharedInstitute = data?.institutes.find(row => row.id === data.shared_skill_institute_id)
  const showShared = sharedInstitute && (!admin || institute?.id === sharedInstitute.id)
  const choosingInstitute = admin && !instituteId && !programId
  const items = choosingInstitute ? (data?.institutes || []).map(row => ({
    ...row, institute: true, to: `${root}?institute=${row.id}`, subtitle: 'Browse this institute’s skill libraries',
  })) : [
    ...(showShared ? [{ name: 'Shared IC skills', shared: true, to: libraryPath('shared'), subtitle: sharedInstitute.name }] : []),
    ...programs.map(row => ({ ...row, to: libraryPath(row.id), subtitle: row.institute_name })),
  ]

  async function saveCard(values) {
    const base = `/api/admin/institutes/${editor.institute ? editor.id : editor.institute_id}/`
    const result = await request('patch', editor.institute ? base : `${base}programs/${editor.id}/`, values, { silentError: true })
    if (result.ok) {
      invalidateCache('/api/admin/institutes/')
      invalidateCache(ORGANIZATION_OPTIONS)
      invalidateCache(PROGRAMS)
      setEditor(null)
      showToast('Card updated.')
    }
    return result
  }

  return <div className="mx-auto max-w-6xl space-y-6 px-4 py-6 sm:px-6">
    <header className="space-y-2">
      <h1 ref={heading} tabIndex={-1} className="text-xl font-bold">Skill taxonomy</h1>
      <p className="text-xs leading-6 text-gray-600 dark:text-gray-300">{choosingInstitute ? 'Open an institute to browse its skill libraries.' : 'Browse the shared and program skill libraries available to you.'}</p>
    </header>
    {(instituteId || programId) && <nav aria-label="Taxonomy path" className="flex flex-wrap gap-2">
      {admin && <Link className={button} to={root}>All institutes</Link>}
      {programId && <Link className={button} to={institutePath}>{institute ? institute.name : 'All skill libraries'}</Link>}
    </nav>}
    <DataSection url={ORGANIZATION_OPTIONS} layout="cards">
      {instituteId && !institute ? <p>This institute is unavailable.</p>
        : programId ? (programId === 'shared' && showShared
          ? <Suspense fallback={<p role="status">Loading shared IC skills…</p>}><AdminSkills embedded readOnly={!admin} /></Suspense>
          : program ? <Versions key={program.id} programId={program.id} /> : <p>This skill library is unavailable.</p>)
        : <>
          {institute && <h2 className="text-lg font-semibold">{institute.name}</h2>}
          <TaxonomyLibraryCards key={instituteId || role} items={items} label={choosingInstitute ? 'Institutes' : 'Skill libraries'} onEdit={admin ? setEditor : null} />
        </>}
    </DataSection>
    {editor && <CatalogForm item={editor} program={!editor.institute} brandingOnly onClose={() => setEditor(null)} onSave={saveCard} />}
  </div>
}
