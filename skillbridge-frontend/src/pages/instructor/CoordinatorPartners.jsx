import { lazy, Suspense, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import api from '../../api/axios'
import { requestErrorMessage } from '../../api/requestErrors'
import { applyDataChange, useApi } from '../../hooks/useApi'
import { useSnapshotFreshness } from '../../hooks/useSnapshotFreshness'
import DataSection from '../../components/DataSection'
import ProgramSelect from '../../components/ProgramSelect'
import Pagination from '../../components/Pagination'
import DialogShell from '../../components/DialogShell'
import ConfirmModal from '../../components/admin/ConfirmModal'
import CompanyImage from '../../components/CompanyImage'
import { companyRequest } from '../../utils/companyImages'
import { organizationButton as button, organizationPrimary as primary, organizationField as field, organizationCard as card } from '../../components/admin/organizationUi'
import CollectionViewToggle from '../../components/CollectionViewToggle'
import { ChevronRightIcon } from '../../components/Icons'

const PartnerForm = lazy(() => import('../../components/CoordinatorPartnerForm'))
const PositionDialog = lazy(() => import('../../components/admin/PositionDialog'))
const surface = 'min-w-0 rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-700 dark:bg-gray-900'
const addressText = address => ['street', 'barangay', 'city', 'province'].map(key => address?.[key]).filter(Boolean).join(', ')

function OpeningDetails({ position, partnerArchived }) {
  const programs = position.eligible_programs.filter(program => program.is_active)
  const archived = Boolean(position.archived_at || partnerArchived)
  const closed = position.eligibility_configured && !programs.length
  const status = archived ? 'Archived' : closed ? 'Closed to new placements' : 'Active'
  const eligibility = position.eligibility_configured ? programs.map(program => program.name).join(', ') || 'None' : 'Legacy eligibility'
  const requirements = position.category_requirements.map(row => `${row.name} ≥ ${row.percentage}%`).join('; ')
  return <>
    <div className="flex flex-wrap items-center justify-between gap-3">
      <h3 className="min-w-0 break-words font-bold">{position.title}</h3>
      <span>{status} · {position.slots} shared slots</span>
    </div>
    <p className="break-words">Eligible programs: {eligibility}</p>
    <p className="break-words">Requirements: {requirements || 'No numerical requirements'}{!requirements && !closed && !archived && ' — manual placement only'}</p>
    <p className="break-words text-gray-500 dark:text-gray-400">Tags: {position.tags.join(', ') || 'None'}</p>
  </>
}

function ExistingPartner({ base, onChoose, onClose }) {
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const url = `${base}partner-options/?page=${page}&page_size=8&search=${encodeURIComponent(search)}`
  const { data } = useApi(url)
  return <DialogShell title="Reuse existing partner" onClose={onClose} size="confirm"
    description="Choose the organization and create an opening for your program. Review its name and address to avoid duplicates.">
    <div className="min-h-0 space-y-4 overflow-y-auto p-5 text-xs">
      <label className="block font-semibold">Search organizations<input autoFocus className={field} aria-label="Search organizations" type="search" maxLength={255} value={search}
        onChange={event => { setSearch(event.target.value); setPage(1) }} /></label>
      <DataSection url={url} layout="control">
        <ul className="space-y-2">{data?.results.map(row => <li key={row.id} className="rounded-xl border border-gray-200 p-3 dark:border-gray-700">
          <p className="break-words font-semibold">{row.name}</p><p className="mt-1 break-words text-gray-500 dark:text-gray-400">{addressText(row.address) || 'Address not set'}</p>
          <button type="button" className={`${button} mt-3`} onClick={() => onChoose(row)}>Add opening at {row.name}</button>
        </li>)}</ul>
        {!data?.count && <p>No matching organizations. Close this dialog to create a new partner.</p>}
        <Pagination page={data?.page || 1} total={data?.count || 0} pageSize={8} onPage={setPage} />
      </DataSection>
    </div>
  </DialogShell>
}

function Workspace({ program, scopeVersion, scopeCurrent }) {
  const [view, setView] = useState('grid')
  const [openingView, setOpeningView] = useState('list')
  const base = `/api/management/programs/${program.id}/`
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('active')
  const [page, setPage] = useState(1)
  const [selected, setSelected] = useState(null)
  const [editor, setEditor] = useState(null)
  const [reuse, setReuse] = useState(false)
  const [action, setAction] = useState(null)
  const [recovery, setRecovery] = useState(null)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [busy, setBusy] = useState(false)
  const pending = useRef(false)
  const url = `${base}partners/?page=${page}&page_size=8&status=${status}&search=${encodeURIComponent(search)}`
  const { data } = useApi(url)
  const detailUrl = selected ? `${base}partners/${selected}/` : null
  const { data: partner } = useApi(detailUrl)
  function current() { return scopeCurrent(scopeVersion) }
  function refresh() { applyDataChange({ topics: ['catalog'] }) }
  function close() { setEditor(null); setRecovery(null) }
  async function open(kind, row, company, archiving = false) {
    if (pending.current) return
    pending.current = true; setBusy(true); setError('')
    try {
      const { data: fresh } = await api.get(`${base}${kind === 'partner' ? 'partners' : 'positions'}/${row.id}/`)
      if (!current()) return
      if (!fresh.can_edit || !archiving && fresh.archived_at) { refresh(); setError('This entry is no longer editable. Review its current status and authority.'); return }
      if (archiving) setAction({ kind, row: fresh })
      else { setRecovery(null); setEditor({ kind, row: fresh, company, key: Date.now() }) }
    } catch (failure) { if (current()) setError(requestErrorMessage(failure)) }
    finally { pending.current = false; setBusy(false) }
  }
  async function save(values, image) {
    if (pending.current || recovery) return { ok: false, message: 'Review the current records before saving again.' }
    pending.current = true
    const initial = editor.row
    const path = editor.kind === 'partner'
      ? `${base}partners/${initial ? initial.id + '/' : ''}`
      : initial ? `${base}positions/${initial.id}/` : `${base}partners/${editor.company.id}/positions/`
    const details = editor.kind === 'partner' ? values : {
      title: values.title, slots: values.slots, tags: values.tags, category_requirements: values.category_requirements || [],
      ...(!initial && editor.reuse ? { reuse_existing: true } : {}),
    }
    if (initial) details.revision = initial.revision
    try {
      const { data: saved } = await api[initial ? 'patch' : 'post'](path, editor.kind === 'partner' ? companyRequest(details, image) : details)
      if (!current()) return { ok: false, message: 'Program access changed. Review your assignments.' }
      setSelected(editor.kind === 'partner' ? saved.id : saved.company_id)
      setNotice('Saved. The program catalog is up to date.'); refresh()
      return { ok: true }
    } catch (failure) {
      if (!current()) return { ok: false, message: 'Program access changed.' }
      const code = failure.response?.status
      if (!code || code >= 500 || code === 409) setRecovery({ checked: false, conflict: code === 409, search: editor.kind === 'partner' ? values.name : editor.company.name })
      if (code === 403 || code === 404) {
        close(); refresh(); setError(requestErrorMessage(failure, { mutation: true }))
      }
      return { ok: false, message: requestErrorMessage(failure, { mutation: true }) }
    } finally { pending.current = false }
  }
  async function checkSaved() {
    if (pending.current) return
    pending.current = true; setBusy(true)
    try {
      const path = editor.row ? `${base}${editor.kind === 'partner' ? 'partners' : 'positions'}/${editor.row.id}/` :
        editor.kind === 'position' && !editor.reuse ? `${base}partners/${editor.company.id}/` : `${base}partners/?status=all&page_size=50&search=${encodeURIComponent(recovery.search)}`
      const { data: saved } = await api.get(path)
      if (current()) { setRecovery(previous => ({ ...previous, checked: true, saved })); refresh() }
    } catch (failure) { if (current()) setRecovery(previous => ({ ...previous, error: requestErrorMessage(failure) })) }
    finally { pending.current = false; setBusy(false) }
  }
  function loadSaved() {
    const saved = recovery.saved
    if (!saved.can_edit || saved.archived_at) { close(); refresh(); return }
    setEditor(previous => ({ ...previous, row: saved, key: Date.now() })); setRecovery(null)
  }
  const recoveryPanel = recovery && <div role="status" className="space-y-3 rounded-xl border border-amber-400 p-4 text-xs">
    <p>{recovery.conflict ? 'This entry conflicts with current records.' : 'The save outcome is uncertain.'} Your input is kept. Check saved records before deciding what to do.</p>
    <button type="button" className={button} disabled={busy} onClick={checkSaved}>Check saved records</button>
    {recovery.error && <p role="alert">{recovery.error}</p>}
    {recovery.checked && <>
      <p>Current records: {recovery.saved.name || recovery.saved.title || (recovery.saved.results || []).map(row => row.name).join(', ') || 'No partners saved.'}</p>
      {(recovery.saved.positions || recovery.saved.results) && <p>Openings: {(recovery.saved.positions || recovery.saved.results.flatMap(row => row.positions)).map(row => row.title).join(', ') || 'None'}</p>}
      {editor.row ? <button type="button" className={button} onClick={loadSaved}>Load saved version and replace unsaved input</button> : <>
        <button type="button" className={button} onClick={() => { close(); refresh() }}>Close and review catalog</button>
        <button type="button" className={button} onClick={() => setRecovery(null)}>I reviewed the records; allow a manual retry</button>
      </>}
    </>}
  </div>
  async function archive() {
    if (pending.current) return { ok: false, message: 'An operation is already pending.' }
    if (action.failed) return { ok: false, message: 'Close this confirmation and review the refreshed entry before trying again.' }
    pending.current = true
    try {
      await api.post(`${base}${action.kind === 'partner' ? 'partners' : 'positions'}/${action.row.id}/archive/`, { revision: action.row.revision, restore: Boolean(action.row.archived_at) })
      if (current()) { setAction(null); setNotice('Catalog status updated.'); refresh() }
      return { ok: true }
    } catch (failure) {
      if (current()) { setAction(previous => ({ ...previous, failed: true })); refresh() }
      return { ok: false, message: requestErrorMessage(failure, { mutation: true }) + ' Close and review the current entry before retrying.' }
    } finally { pending.current = false }
  }
  return <div className="space-y-5">
    <section className={surface} aria-label="Program partner catalog">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div><h2 className="break-words text-base font-bold">{program.institute_code} · {program.name}</h2><p className="mt-2 text-gray-500 dark:text-gray-400">Shared within this program. Batches and student matches keep their existing ownership.</p></div>
        <div className="flex flex-wrap gap-2"><button type="button" className={primary} onClick={() => { setRecovery(null); setEditor({ kind: 'partner', key: Date.now() }) }}>Add partner</button>
          <button type="button" className={button} onClick={() => setReuse(true)}>Reuse existing partner</button></div>
      </div>
      {notice && <p role="status" className="mt-4 text-green-800 dark:text-green-300">{notice}</p>}
      {error && <p role="alert" className="mt-4 text-rose-700 dark:text-rose-300">{error}</p>}
      <div className="sb-collection-toolbar my-5">
        <label className="min-w-0 flex-1 font-semibold">Search partners<input className={field} aria-label="Search partners" type="search" maxLength={255} value={search} onChange={event => { setSearch(event.target.value); setPage(1) }} /></label>
        <label className="font-semibold">Partner status<select className={field} aria-label="Partner status" value={status} onChange={event => { setStatus(event.target.value); setPage(1) }}><option value="active">Active</option><option value="archived">Archived</option><option value="all">All</option></select></label>
        <CollectionViewToggle view={view} onChange={setView} label="Program partner view" mobile />
      </div>
      <DataSection url={url} layout="company-cards">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <p role="status" className="text-gray-500 dark:text-gray-400">{data?.count || 0} matching {data?.count === 1 ? 'partner' : 'partners'}</p>
        </div>
        <ul className={`grid gap-3 ${view === 'grid' ? 'sm:grid-cols-2' : ''}`}>{data?.results.map(row => <li key={row.id}>
          <button type="button" aria-pressed={selected === row.id} onClick={() => setSelected(row.id)}
            className={`${card} group flex w-full cursor-pointer items-center gap-3 text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-green-600 aria-pressed:border-green-600 aria-pressed:bg-green-50 dark:aria-pressed:border-green-500 dark:aria-pressed:bg-green-950/30 ${view === 'grid' ? 'min-h-24 p-4' : 'min-h-16 px-4 py-2'}`}>
            <CompanyImage name={row.name} imageUrl={row.image_url} className="h-12 w-12 shrink-0 rounded-lg object-cover" />
            <span className="min-w-0 flex-1 break-words"><span className="block text-sm font-semibold">{row.name}</span><span className="mt-1 block text-gray-500 dark:text-gray-400">{row.archived_at ? 'Archived' : 'Active'} · {row.positions.length} program {row.positions.length === 1 ? 'opening' : 'openings'}</span></span>
            <span aria-hidden="true" className="shrink-0 text-gray-400 group-hover:text-green-700 dark:group-hover:text-green-300"><ChevronRightIcon size={16} /></span>
          </button>
        </li>)}</ul>
        {!data?.count && <p className="rounded-xl border border-dashed border-gray-300 p-6">No partners match this view. You can create a partner before creating a batch.</p>}
        <div className="mt-4"><Pagination total={data?.count || 0} page={data?.page || 1} pageSize={8} onPage={setPage} /></div>
      </DataSection>
    </section>
    {selected && <DataSection url={detailUrl} layout="control">{partner && <section className={surface} aria-label="Selected partner">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0"><h2 className="break-words text-base font-bold">{partner.name}</h2><p className="mt-2 break-words text-gray-500 dark:text-gray-400">{addressText(partner.address) || 'Address not set'}</p>
          <p className="mt-2 text-gray-500 dark:text-gray-400">{partner.lat != null && partner.lng != null ? `Pin: ${partner.lat}, ${partner.lng}` : 'Location not pinned'} · {partner.archived_at ? 'Archived' : 'Active'}</p></div>
        <div className="flex flex-wrap gap-2">{partner.can_edit && <>
          {!partner.archived_at && <button type="button" className={button} disabled={busy} onClick={() => open('partner', partner)}>Edit partner</button>}
          <button type="button" className={button} disabled={busy} onClick={() => open('partner', partner, null, true)}>{partner.archived_at ? 'Restore partner' : 'Archive partner'}</button>
        </>}{!partner.archived_at && <button type="button" className={primary} onClick={() => { setRecovery(null); setEditor({ kind: 'position', company: partner, key: Date.now() }) }}>Add position</button>}</div>
      </div>
      {!partner.can_edit && <p className="mt-4 text-gray-500 dark:text-gray-400">Common organization details are managed by the authorized creator or an administrator. You can add your own program opening at an active partner.</p>}
      {partner.positions.length > 0 && <div className="mt-5 flex flex-wrap items-center justify-between gap-3"><h3 className="font-semibold">Program openings</h3><CollectionViewToggle view={openingView} onChange={setOpeningView} label="Opening view" mobile /></div>}
      <ul className={`mt-3 grid gap-4 ${openingView === 'grid' ? 'md:grid-cols-2' : ''}`} aria-label="Program openings">{partner.positions.map(position => <li key={position.id} className={`${card} space-y-3 p-4`}>
        <OpeningDetails position={position} partnerArchived={partner.archived_at} />
        {position.can_edit && !partner.archived_at ? <div className="flex flex-wrap gap-2">
          {!position.archived_at && <button type="button" className={button} disabled={busy} onClick={() => open('position', position, partner)}>Edit {position.title}</button>}
          <button type="button" className={button} disabled={busy} onClick={() => open('position', position, partner, true)}>{position.archived_at ? 'Restore' : 'Archive'} {position.title}</button>
        </div> : <p className="text-gray-500 dark:text-gray-400">{partner.archived_at ? 'Restore the partner to manage its openings.' : !position.eligible_programs.length && position.eligibility_configured ? 'An administrator can reopen this position by assigning an eligible program.' : 'The authorized creator or an administrator manages this opening.'}</p>}
      </li>)}</ul>
      {!partner.positions.length && <p className="mt-5">No openings for this program yet.</p>}
    </section>}</DataSection>}
    {reuse && <ExistingPartner base={base} onClose={() => setReuse(false)} onChoose={company => { setReuse(false); setRecovery(null); setEditor({ kind: 'position', company, reuse: true, key: Date.now() }) }} />}
    {editor && <Suspense fallback={<p role="status">Loading editor…</p>}>{editor.kind === 'partner'
      ? <PartnerForm key={editor.key} initial={editor.row} program={program} onSave={save} onClose={close} saveBlocked={Boolean(recovery)} recovery={recoveryPanel} />
      : <PositionDialog key={editor.key} mode={editor.row ? 'edit' : 'add'} initialData={editor.row} companyName={editor.company.name}
        fixedProgram={program} confirmDiscard onSubmit={save} onClose={close} saveBlocked={Boolean(recovery)} recovery={recoveryPanel} />}</Suspense>}
    {action && <ConfirmModal title={`${action.row.archived_at ? 'Restore' : 'Archive'} ${action.kind}?`}
      message={`${action.row.title || action.row.name}. Current approved placements can prevent archiving. Saved assessment evidence is retained.`}
      confirmLabel={action.row.archived_at ? 'Restore' : 'Archive'} archive onCancel={() => setAction(null)} onConfirm={archive} />}
  </div>
}

export default function CoordinatorPartners() {
  const [params, setParams] = useSearchParams()
  const programId = /^\d+$/.test(params.get('program_id') || '') ? params.get('program_id') : null
  const url = programId ? `/api/management/programs/${programId}/` : null
  const { data: program } = useApi(url)
  const { scopeVersion, scopeCurrent } = useSnapshotFreshness(['catalog', 'assignments', 'organization'])
  return <section className="mx-auto max-w-6xl space-y-5 px-4 py-6 text-xs text-gray-900 dark:text-gray-100 sm:px-6">
    <header className="space-y-3"><Link className="inline-block text-green-800 underline dark:text-green-300" to="/instructor/companies">Back to OJT partners & student matches</Link>
      <h1 className="text-xl font-bold">Partner & position management</h1><p className="text-gray-500 dark:text-gray-400">Instructor / OJT coordinator · Prepare opportunities for your assigned programs.</p></header>
    <section className={surface}><ProgramSelect value={programId} onChange={value => setParams({ program_id: value })} /></section>
    {programId ? <DataSection url={url} layout="control">{program && <Workspace key={`${programId}:${scopeVersion}`} program={program} scopeVersion={scopeVersion} scopeCurrent={scopeCurrent} />}</DataSection>
      : <p className={surface}>Select an assigned program to manage its partners and positions.</p>}
  </section>
}
