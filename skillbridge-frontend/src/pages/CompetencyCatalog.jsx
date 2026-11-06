import { useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import api from '../api/axios'
import { requestErrorMessage } from '../api/requestErrors'
import { invalidateCache, useApi } from '../hooks/useApi'
import { useToast } from '../context/ToastContext'
import DataSection from '../components/DataSection'
import DialogShell from '../components/DialogShell'
import ProgramSelect from '../components/ProgramSelect'
import OrganizationScope from '../components/OrganizationScope'
import CollectionViewToggle from '../components/CollectionViewToggle'
import { ALL_ORGANIZATIONS } from '../utils/organizationScope'
import Pagination from '../components/Pagination'
import ConfirmModal from '../components/admin/ConfirmModal'
import { useScopedAssistance } from '../hooks/useScopedAssistance'
import { mergeSuggestedTags } from '../utils/competencyAssistance'
import { organizationField as field, organizationButton as button, organizationPrimary as primary, organizationCard as card } from '../components/admin/organizationUi'

const PROGRAMS = '/api/management/competency-programs/'
const surface = 'rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-700 dark:bg-gray-900'

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

function Editor({ kind, row, source, url, framework, onClose, onSaved }) {
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
  const title = category ? row ? 'Edit category' : 'Add category' : row ? 'Edit framework' : source ? 'Create new version' : 'Create framework'
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
      const { data } = await api[row ? 'patch' : 'post'](row ? `${url}${row.id}/` : url, content)
      onSaved(data)
    } catch (failure) { setError(requestErrorMessage(failure, { mutation: true })) }
    finally { pending.current = false; setSaving(false) }
  }
  return <DialogShell title={title} description={category ? 'Define the knowledge this category measures. Tags provide vocabulary; they are not separately scored.' : source ? `Copy v${source.version} into a new editable version. Existing batches and categories keep their original definitions.` : 'A framework is a program’s reviewed set of assessment skill categories.'}
    onClose={close} closeDisabled={saving} size="confirm" footer={<div className="flex gap-2"><button type="button" className={button} disabled={saving} onClick={close}>Cancel</button><button type="submit" form="competency-editor" className={primary} disabled={saving}>{saving ? 'Saving…' : row ? 'Save changes' : source ? 'Create version' : category ? 'Add category' : 'Create framework'}</button></div>}>
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

function Categories({ programId, frameworkId, onBack }) {
  const [view, setView] = useState('grid')
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
    <div className="flex flex-wrap gap-2"><button type="button" className={button} onClick={onBack}>← All versions</button><button type="button" className={button} onClick={refresh}>Refresh catalog</button></div>
    {framework && <>
      <header className="flex flex-wrap items-start justify-between gap-4"><div className="min-w-0"><h2 className="break-words text-lg font-bold">{framework.name} · v{framework.version}</h2><p className="mt-2 text-xs text-gray-500 dark:text-gray-400">{framework.program.institute_code} · {framework.program.code} · {!framework.is_active ? 'Retired' : framework.locked ? 'Definitions frozen or in use' : 'Editable definitions'}</p><p className="mt-2 max-w-3xl whitespace-pre-wrap break-words text-xs">{framework.description}</p></div>
        <div className="flex flex-wrap gap-2">
          {available && !framework.locked && <button className={primary} onClick={() => setEditor({ kind: 'category' })}>Add category</button>}
          {framework.can_edit && available && <button className={button} onClick={() => setEditor({ kind: 'framework', row: framework })}>Edit framework</button>}
          {framework.program.is_active && <button className={button} onClick={() => setEditor({ kind: 'framework', source: framework })}>Create new version</button>}
          {framework.can_manage && available && !framework.locked && <button className={button} disabled={busy} onClick={() => setAction('freeze')}>Freeze definitions</button>}
          {framework.can_manage && <button className={button} disabled={busy} onClick={() => setAction(framework.is_active ? 'retire' : 'restore')}>{framework.is_active ? 'Retire version' : 'Restore version'}</button>}
        </div>
      </header>
      {framework.locked && <p className="text-xs text-gray-600 dark:text-gray-300">These definitions stay with their recorded evidence. Create a new version to revise names, descriptions or tags.</p>}
      {error && <p role="alert" className="text-xs text-rose-700 dark:text-rose-300">{error}</p>}
      <details className={`${surface} break-words text-xs`}><summary className="cursor-pointer font-semibold hover:text-green-700 focus-visible:outline-2 focus-visible:outline-green-600 dark:hover:text-green-300">Check a question against saved categories</summary><QuestionCheck detail={detail} digest={framework.digest} /></details>
      <label className="block space-y-2 text-xs font-semibold">Search categories<input className={field} type="search" aria-label="Search categories" value={search} onChange={event => { setSearch(event.target.value); setPage(1) }} /></label>
      <DataSection url={url} layout="cards" count={4}>
        <div className="flex flex-wrap items-center justify-between gap-3"><p className="text-xs text-gray-500 dark:text-gray-400" role="status">{data?.count ?? 0} {data?.count === 1 ? 'category' : 'categories'}</p><CollectionViewToggle view={view} onChange={setView} label="Category view" mobile /></div>
        <div className={`grid gap-4 ${view === 'grid' ? 'md:grid-cols-2' : ''}`}>{data?.results?.map(category => <article key={category.id} className={`${card} grid gap-4 p-4 sm:p-5 ${view === 'list' ? 'sm:grid-cols-[minmax(0,1fr)_auto] sm:items-start' : ''}`}>
          <div className="min-w-0">
            <h3 className="break-words text-sm font-semibold">{category.name}</h3><p className="mt-2 whitespace-pre-wrap break-words text-xs leading-6">{category.description}</p>
            <ul className="mt-3 flex flex-wrap gap-2" aria-label={`Tags for ${category.name}`}>{category.tags.map(tag => <li key={tag} className="max-w-full break-words rounded-lg bg-gray-100 px-2 py-1 text-xs dark:bg-gray-800">{tag}</li>)}</ul>
          </div>
          {category.can_edit && <button className={`${button} max-w-full justify-self-start break-words sm:max-w-56`} onClick={() => setEditor({ kind: 'category', row: category })}>Edit {category.name}</button>}
        </article>)}</div>
        {data?.count === 0 && <p className="py-8 text-center text-xs text-gray-500 dark:text-gray-400">{search ? 'No categories match this search.' : 'No categories yet. Add a defined skill area for this program.'}</p>}
        {data && <Pagination total={data.count} page={data.page} pageSize={data.page_size} onPage={setPage} />}
      </DataSection>
      {editor && <Editor {...editor} framework={framework} url={editor.kind === 'category' ? `${detail}categories/` : base} onClose={() => setEditor(null)} onSaved={saved} />}
      {action && <ConfirmModal tone="confirm" title={action === 'freeze' ? 'Freeze this version?' : action === 'retire' ? 'Retire this version?' : 'Restore this version?'} message={action === 'freeze' ? 'Names, descriptions and tags will become read-only. Review every category first. Later revisions need a new version; existing evidence keeps these definitions.' : action === 'retire' ? 'This version remains available for retained records. Its definitions will not accept new edits.' : 'Restore this version for its existing context. Frozen definitions stay frozen.'} confirmLabel={action === 'freeze' ? 'Freeze definitions' : action === 'retire' ? 'Retire version' : 'Restore version'} onCancel={() => { if (!busy) setAction(null) }} onConfirm={changeVersion} />}
    </>}
  </div></DataSection>
}

function Versions({ programId }) {
  const [view, setView] = useState('grid')
  const { showToast } = useToast()
  const { data: program } = useApi(`${PROGRAMS}${programId}/`)
  const base = `/api/management/programs/${programId}/frameworks/`
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [status, setStatus] = useState('all')
  const [selected, setSelected] = useState(null)
  const [create, setCreate] = useState(false)
  const url = `${base}?page=${page}&page_size=8&status=${status}&search=${encodeURIComponent(search)}`
  const { data } = useApi(url)
  if (selected) return <Categories key={selected} programId={programId} frameworkId={selected} onBack={() => setSelected(null)} />
  return <DataSection url={`${PROGRAMS}${programId}/`} layout="panel"><section className="space-y-4">
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
  const [scope, setScope] = useState(ALL_ORGANIZATIONS)
  const admin = role === 'admin'
  return <div className="mx-auto max-w-6xl space-y-6 px-4 py-6 sm:px-6">
    <header className="flex flex-wrap items-start justify-between gap-4">
      <div>
        <h1 className="text-xl font-bold">{admin ? 'Skill taxonomy' : 'Program competencies'}</h1>
        <p className="mt-2 max-w-3xl text-xs leading-6 text-gray-600 dark:text-gray-300">This is the skill library for a program. Use its categories to group assessment questions and set the skills an opening requires. Descriptions and tags give those skills context.</p>
      </div>
      {admin && <Link className={button} to="/admin/skills">Legacy IC taxonomy</Link>}
    </header>
    <details className="rounded-xl border border-gray-200 bg-white p-4 text-xs dark:border-gray-700 dark:bg-gray-900">
      <summary className="cursor-pointer font-semibold hover:text-green-700 focus-visible:outline-2 focus-visible:outline-green-600 dark:hover:text-green-300">How do frameworks and categories work?</summary>
      <p className="mt-2 max-w-3xl leading-6 text-gray-600 dark:text-gray-300">A framework is a version of the program’s skill library. For example, a category called “Reservation records” could group questions about booking forms and cancellations. A partner opening can set a minimum score for that category. Instructors assigned to the same program can reuse its categories. Once a version is used, create a new version to revise the definitions.</p>
    </details>
    <div className={surface}>{admin
      ? <OrganizationScope value={scope} onChange={setScope} programPlaceholder="Select a program" />
      : <ProgramSelect value={scope.program} onChange={program => setScope({ ...scope, program })} endpoint={PROGRAMS} status="all" />}</div>
    {scope.program ? <Versions key={scope.program} programId={scope.program} /> : <p className="py-8 text-center text-xs text-gray-500 dark:text-gray-400">Select a program to view or create its skill frameworks.</p>}
  </div>
}
