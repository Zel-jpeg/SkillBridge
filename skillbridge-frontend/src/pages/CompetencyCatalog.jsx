import { lazy, Suspense, useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import api from '../api/axios'
import { requestErrorMessage } from '../api/requestErrors'
import { applyDataChange, invalidateCache, useApi } from '../hooks/useApi'
import { useToast } from '../context/ToastContext'
import DataSection from '../components/DataSection'
import DialogShell from '../components/DialogShell'
import TaxonomyLibraryCards from '../components/TaxonomyLibraryCards'
import OrganizationBreadcrumbs from '../components/OrganizationBreadcrumbs'
import SkillLibraryTable from '../components/SkillLibraryTable'
import { ORGANIZATION_OPTIONS } from '../utils/organizationScope'
import { CatalogForm } from './admin/AdminInstitutes'
import Pagination from '../components/Pagination'
import ConfirmModal from '../components/admin/ConfirmModal'
import { useScopedAssistance } from '../hooks/useScopedAssistance'
import { mergeSuggestedTags } from '../utils/competencyAssistance'
import SkillDefinitionFields from '../components/SkillDefinitionFields'
import { skillTagValues } from '../utils/skillTagEditor'
import { PencilIcon, TrashIcon } from '../components/Icons'
import { organizationField as field, organizationButton as button, organizationPrimary as primary } from '../components/admin/organizationUi'

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

function Editor({ kind, row, source, url, framework, programId, revision = false, starterName, onClose, onSaved }) {
  const category = kind === 'category'
  const [name, setName] = useState(row?.name || source?.name || '')
  const [description, setDescription] = useState(row?.description || source?.description || '')
  const [tags, setTags] = useState((row?.tags || []).join(', '))
  const [tagDraft, setTagDraft] = useState('')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [discard, setDiscard] = useState(false)
  const [requestId] = useState(() => crypto.randomUUID())
  const pending = useRef(false)
  const assistance = useScopedAssistance(`${url.replace(/categories\/$/, '')}assist/tags/`, { name, description }, framework?.digest)
  const title = category
    ? (row ? 'Edit Skill' : 'Add Skill')
    : (row ? 'Edit framework' : source ? 'Create new version' : 'Create framework')
  const changed = name !== (row?.name || source?.name || '') || description !== (row?.description || source?.description || '') || tags !== (row?.tags || []).join(', ') || Boolean(tagDraft.trim())
  function close() { if (!pending.current) { if (changed) setDiscard(true); else onClose() } }
  async function save(event) {
    event.preventDefault()
    if (pending.current) return
    if (!name.trim() || category && !description.trim()) { setError(category ? 'Enter a name and a clear category description.' : 'Enter a framework name.'); return }
    let tagValues
    try { tagValues = category ? skillTagValues(tags, tagDraft) : [] } catch (failure) { setError(failure.message); return }
    pending.current = true; setSaving(true); setError('')
    const content = { name: name.trim(), description: description.trim(),
      ...(category ? { tags: tagValues } : {}),
      ...(row ? { expected_digest: row.digest } : !category ? { request_id: requestId, ...(source ? { source_framework_id: source.id } : {}) } : {}) }
    try {
      const payload = starterName ? { name: starterName, request_id: requestId, initial_category: content } : content
      const revisionUrl = row ? `${url}${row.id}/revisions/` : `${url.replace(/categories\/$/, '')}revisions/`
      const { data } = revision ? await api.post(revisionUrl, {
        ...content, operation: row ? 'update' : 'add', expected_digest: framework.digest, request_id: requestId,
      }) : await api[row ? 'patch' : 'post'](row ? `${url}${row.id}/` : url, payload)
      onSaved(data)
    } catch (failure) { setError(requestErrorMessage(failure, { mutation: true })) }
    finally { pending.current = false; setSaving(false) }
  }
  return <DialogShell title={title} description={category ? 'Update this skill and its related keywords.' : source ? `Copy v${source.version} into a new editable version. Existing batches and categories keep their original definitions.` : 'A framework is a program’s reviewed set of assessment skill categories.'}
    onClose={close} closeDisabled={saving} size={category ? 'skill' : 'confirm'} fixedHeader footer={<div className="flex justify-end gap-2"><button type="button" className={button} disabled={saving} onClick={close}>Cancel</button><button type="submit" form="competency-editor" className={primary} disabled={saving}>{saving ? 'Saving…' : row ? 'Save changes' : source ? 'Create version' : title}</button></div>}>
    <form id="competency-editor" onSubmit={save} className="min-h-0 flex-1 space-y-4 overflow-y-auto p-5 text-xs">
      {error && <p role="alert" className="text-rose-700 dark:text-rose-300">{error}</p>}
      <fieldset disabled={saving} className="space-y-4">
        {revision && <p className="rounded-lg bg-amber-50 p-3 leading-5 text-amber-900 dark:bg-amber-950 dark:text-amber-200">This skill set is already in use. Saving creates an updated skill set for future work. Existing assessments and results keep their original definitions.</p>}
        {category ? <SkillDefinitionFields name={name} setName={setName} description={description} setDescription={setDescription}
          tags={tags} setTags={setTags} draft={tagDraft} setDraft={setTagDraft} disabled={saving}
          suggestionKey={JSON.stringify([programId, name, description])}
          onSuggest={async () => (await api.post(`/api/management/programs/${programId}/suggest-tags/`, { name, description })).data.suggested_tags}>
          {!starterName && <details className="rounded-xl border border-gray-200 p-3 dark:border-gray-700">
          <summary className="cursor-pointer font-semibold hover:text-green-700 focus-visible:outline-2 focus-visible:outline-green-600">Reuse saved tags <span className="ml-2 font-normal text-gray-500">Optional</span></summary>
          <section className="mt-3 space-y-3 break-words" aria-label="Optional tag assistance">
          <p className="leading-5 text-gray-500">Find keywords already used in this skill library.</p>
          <button type="button" className={button} disabled={assistance.loading || !name.trim() && !description.trim()} onClick={assistance.run}>{assistance.loading ? 'Finding…' : 'Find saved tags'}</button>
          {assistance.error && <p role="alert">{assistance.error} Manual entry is still available.</p>}
          {assistance.data && <div role="status" className="space-y-2">
            {assistance.data.suggested_tags.length ? <><p>Saved tags from {assistance.data.source_category.name}: {assistance.data.suggested_tags.join(', ')}</p><button type="button" className={button} onClick={() => setTags(current => mergeSuggestedTags(current, assistance.data.suggested_tags))}>Add suggested tags</button><p className="text-gray-500 dark:text-gray-400">Adds tags to your draft. Review them before saving.</p></> : <p>{assistanceMessages[assistance.data.status]}</p>}
          </div>}
          </section></details>}
        </SkillDefinitionFields> : <>
          <label className="block space-y-2 font-semibold">Name<input className={field} aria-label="Name" maxLength={160} value={name} onChange={event => setName(event.target.value)} required /></label>
          <label className="block space-y-2 font-semibold">Description<textarea className={`${field} min-h-28`} aria-label="Description" maxLength={2000} value={description} onChange={event => setDescription(event.target.value)} /></label>
        </>}
      </fieldset>
    </form>
    {discard && <ConfirmModal title="Discard definition changes?" message="Your unsaved definition changes will be discarded." confirmLabel="Discard changes" onCancel={() => setDiscard(false)} onConfirm={onClose} />}
  </DialogShell>
}

function Categories({ programId, frameworkId, onRevised }) {
  const { showToast } = useToast()
  const base = `/api/management/programs/${programId}/frameworks/`
  const detail = `${base}${frameworkId}/`
  const { data: framework } = useApi(detail)
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [removal, setRemoval] = useState(null)
  const [removalId, setRemovalId] = useState(null)
  const url = `${detail}categories/?page=${page}&page_size=8&search=${encodeURIComponent(search)}`
  const { data } = useApi(url)
  const [editor, setEditor] = useState(null)
  const available = framework?.can_update_skills
  function refresh() { invalidateCache(base); invalidateCache(detail); invalidateCache(`${detail}categories/`) }
  function saved(row) {
    refresh(); setEditor(null)
    if (row.framework_id == null) onRevised(row.id)
    showToast('Definition saved.')
  }
  function removeSkill(row) { setRemoval(row); setRemovalId(crypto.randomUUID()) }
  async function confirmRemoval() {
    try {
      if (removal.remove_requires_revision) {
        const { data: updated } = await api.post(`${detail}categories/${removal.id}/revisions/`, {
          operation: 'remove', expected_digest: framework.digest, request_id: removalId,
        })
        refresh(); setRemoval(null); onRevised(updated.id)
        showToast('Updated skill set created without this skill.')
      } else {
        await api.delete(`${detail}categories/${removal.id}/`, { data: { expected_digest: removal.digest } })
        refresh(); setRemoval(null); showToast('Unused skill removed.')
      }
    } catch (failure) { return { ok: false, message: requestErrorMessage(failure, { mutation: true }) } }
  }
  return <DataSection url={detail} layout="panel"><div className="space-y-5">
    {framework && <>
      <header className="flex flex-wrap items-start justify-between gap-4"><div className="min-w-0"><h2 className="break-words text-lg font-bold">{framework.program.name} skills</h2><p className="mt-2 text-xs text-gray-500 dark:text-gray-400">{framework.program.institute_code} · {framework.program.code} · {!framework.is_active ? 'Retired' : framework.locked ? 'Definitions frozen or in use' : 'Editable definitions'}</p><p className="mt-2 max-w-3xl whitespace-pre-wrap break-words text-xs">{framework.description}</p></div>
        {available && <button type="button" className={primary} onClick={() => setEditor({ kind: 'category' })}>Add Skill</button>}
      </header>
      {framework.locked && <p className="text-xs leading-5 text-gray-600 dark:text-gray-300">This skill set is already in use. Adding, editing or removing a skill prepares updated definitions for future work. Existing assessments keep their saved definitions.</p>}
      <SkillLibraryTable url={url} skills={data?.results} total={data?.count ?? null} search={search} onSearch={value => { setSearch(value); setPage(1) }}
        renderActions={available ? category => <div className="flex flex-wrap justify-end gap-2">
          <button type="button" className={`${button} h-9 w-9 !p-0`} aria-label={`Edit ${category.name}`} title={`Edit ${category.name}`} onClick={() => setEditor({ kind: 'category', row: category })}><PencilIcon size={14} /></button>
          <button type="button" className={`${button} h-9 w-9 !p-0 text-rose-700 dark:text-rose-300`} aria-label={`Remove ${category.name}`} title={`Remove ${category.name}`} onClick={() => removeSkill(category)}><TrashIcon size={14} /></button>
        </div> : undefined}
        footer={data && <div className="px-4"><Pagination total={data.count} page={data.page} pageSize={data.page_size} onPage={setPage} /></div>} />
      {editor && <Editor {...editor} framework={framework} programId={programId} revision={framework.locked} url={`${detail}categories/`} onClose={() => setEditor(null)} onSaved={saved} />}
      {removal && <ConfirmModal title={`Remove ${removal.name}?`} confirmLabel={removal.remove_requires_revision ? 'Create updated skill set' : 'Remove skill'}
        message={removal.remove_requires_revision ? 'This skill has retained records. Create an updated skill set without it for future assessments and batches. Existing questions, results and skill definitions remain available in the original set.' : 'Remove this unused skill and its tags from this skill set?'}
        onCancel={() => setRemoval(null)} onConfirm={confirmRemoval} />}

    </>}
  </div></DataSection>
}

function ProgramSkills({ programId }) {
  const { showToast } = useToast()
  const programUrl = `${PROGRAMS}${programId}/`
  const { data: program } = useApi(programUrl)
  const base = `/api/management/programs/${programId}/frameworks/`
  const url = `${base}?page=1&page_size=1&status=active`
  const { data } = useApi(url)
  const [starter, setStarter] = useState(false)
  const retiredUrl = data?.count === 0 ? `${base}?page=1&page_size=1&status=archived` : null
  const { data: retired } = useApi(retiredUrl)
  const frameworkId = data?.results[0]?.id ?? retired?.results[0]?.id

  if (!program || !data || retiredUrl && !retired) return <DataSection urls={[programUrl, url, retiredUrl].filter(Boolean)} layout="panel" label="Loading program skills" />
  if (frameworkId) return <Categories key={frameworkId} programId={programId} frameworkId={frameworkId} onRevised={() => invalidateCache(base)} />

  return <section className="space-y-4">
    <header className="flex flex-wrap items-start justify-between gap-4">
      <div><h2 className="text-lg font-bold">{program.name} skills</h2>
        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">Add the first skill to start this program’s skill library.</p></div>
      <button type="button" className={primary} disabled={!program.is_active} onClick={() => setStarter(true)}>Add Skill</button>
    </header>
    <SkillLibraryTable />
    {starter && <Editor kind="category" programId={programId} starterName={`${program.code} skills`} url={base} onClose={() => setStarter(false)} onSaved={() => {
      setStarter(false); invalidateCache(base); showToast('Skill added.')
    }} />}
  </section>
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
      applyDataChange({ topics: ['organization'] })
      setEditor(null)
      showToast('Card updated.')
    }
    return result
  }

  return <div className="mx-auto max-w-6xl space-y-6 px-4 py-6 sm:px-6">
    <header className="space-y-2">
      <h1 ref={heading} tabIndex={-1} className="text-xl font-bold">Skill taxonomy</h1>
      {!instituteId && !programId && <p className="text-xs leading-6 text-gray-600 dark:text-gray-300">{choosingInstitute ? 'Open an institute to browse its skill libraries.' : 'Browse the shared and program skill libraries available to you.'}</p>}
    </header>
    {(instituteId || programId) && <OrganizationBreadcrumbs label="Taxonomy path" items={[
      { label: admin ? 'All institutes' : 'All skill libraries', to: root },
      ...(institute ? [{ label: institute.name, ...(programId ? { to: institutePath } : {}) }] : []),
      ...(programId === 'shared' && showShared ? [{ label: 'Shared IC skills' }]
        : program ? [{ label: `${program.code} · ${program.name}` }] : []),
    ]} />}
    <DataSection url={ORGANIZATION_OPTIONS} layout="cards">
      {instituteId && !institute ? <p>This institute is unavailable.</p>
        : programId ? (programId === 'shared' && showShared
          ? <Suspense fallback={<p role="status">Loading shared IC skills…</p>}><AdminSkills embedded readOnly={!admin} /></Suspense>
          : program ? <ProgramSkills key={program.id} programId={program.id} /> : <p>This skill library is unavailable.</p>)
        : <>
          <TaxonomyLibraryCards key={instituteId || role} items={items} label={choosingInstitute ? 'Institutes' : 'Skill libraries'} onEdit={admin ? setEditor : null} />
        </>}
    </DataSection>
    {editor && <CatalogForm item={editor} program={!editor.institute} institute={data?.institutes.find(row => row.id === editor.institute_id)} brandingOnly onClose={() => setEditor(null)} onSave={saveCard} />}
  </div>
}
