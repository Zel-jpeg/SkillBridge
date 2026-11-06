import { useId, useRef, useState } from 'react'
import { useApi, invalidateCache, applyDataChange } from '../../hooks/useApi'
import { useToast } from '../../context/ToastContext'
import DialogShell from '../../components/DialogShell'
import ConfirmModal from '../../components/admin/ConfirmModal'
import Pagination from '../../components/Pagination'
import EmptyState from '../../components/EmptyState'
import { ContentSkeleton } from '../../components/loading/Skeletons'
import { PlusIcon } from '../../components/Icons'
import ProgramInstructors from '../../components/admin/ProgramInstructors'
import { organizationButton as button, organizationPrimary as primary, organizationField as field, organizationError as errorText } from '../../components/admin/organizationUi'
import CollectionViewToggle from '../../components/CollectionViewToggle'
import OrganizationCatalogCard from '../../components/admin/OrganizationCatalogCard'
import CompanyImageInput from '../../components/CompanyImageInput'
import TaxonomyBannerPicker from '../../components/TaxonomyBannerPicker'
import { companyRequest } from '../../utils/companyImages'
import { taxonomyBannerColor } from '../../utils/taxonomyBannerColors'

const ROOT = '/api/admin/institutes/'

export function CatalogForm({ item, program, onClose, onSave, brandingOnly = false }) {
  const id = useId()
  const [values, setValues] = useState({ code: item?.code || '', name: item?.name || '', description: item?.description || '', aliases: (item?.aliases || []).join('\n') })
  const [saving, setSaving] = useState(false)
  const [image, setImage] = useState({ action: 'unchanged', file: null, error: '' })
  const [bannerColor, setBannerColor] = useState(() => taxonomyBannerColor(item?.banner_color, item?.id))
  const [error, setError] = useState('')
  const pending = useRef(false)
  const close = () => { if (!pending.current) onClose() }
  async function save(event) {
    event.preventDefault()
    if (pending.current || image.error) return
    pending.current = true
    setSaving(true)
    setError('')
    try {
      const details = { name: values.name.trim(), banner_color: bannerColor, ...(!brandingOnly && {
        code: values.code.trim(), description: values.description.trim(),
        ...(program ? { aliases: values.aliases.split('\n').map(value => value.trim()).filter(Boolean) } : {}),
      }) }
      const result = await onSave(companyRequest(details, image))
      if (!result.ok) setError(errorText(result))
    } finally {
      pending.current = false
      setSaving(false)
    }
  }
  const kind = program ? 'program' : 'institute'
  const input = (key, label, maxLength, hint) => <div className="text-xs text-gray-700 dark:text-gray-200">
    <label className="font-medium" htmlFor={`${id}-${key}`}>{label}</label><input id={`${id}-${key}`} className={field} maxLength={maxLength} required value={values[key]} disabled={saving}
      onChange={event => setValues(previous => ({ ...previous, [key]: event.target.value }))} aria-describedby={hint ? `${id}-${key}-hint` : undefined} />
    {hint && <span id={`${id}-${key}-hint`} className="mt-1 block font-normal text-gray-500 dark:text-gray-400">{hint}</span>}
  </div>
  return <DialogShell title={`${item?.id ? 'Edit' : 'Add'} ${kind}`} description={brandingOnly ? `Update the name or banner shown on this ${kind} card.` : `Configure this ${kind}'s name, code and description.`}
    size="confirm" fixedHeader onClose={close} closeDisabled={saving} closeLabel={`Close ${kind} form`}
    footer={<div className="flex justify-end gap-2"><button type="button" className={button} disabled={saving} onClick={close}>Cancel</button>
      <button type="submit" form={id} className={primary} disabled={saving || Boolean(image.error)}>{saving ? 'Saving…' : `Save ${kind}`}</button></div>}>
    <form id={id} onSubmit={save} className="min-h-0 flex-1 space-y-4 overflow-y-auto px-6 py-4">
      {error && <p role="alert" className="rounded-lg bg-rose-50 p-3 text-xs text-rose-700 dark:bg-rose-950/30 dark:text-rose-300">{error}</p>}
      {input('name', 'Name', 255)}
      {!brandingOnly && input('code', 'Code', 30, 'Use letters, numbers, spaces, hyphens or underscores.')}
      {!brandingOnly && <label className="block text-xs font-medium text-gray-700 dark:text-gray-200" htmlFor={`${id}-description`}>Description
        <textarea id={`${id}-description`} className={field} rows={3} maxLength={2000} value={values.description} disabled={saving}
          onChange={event => setValues(previous => ({ ...previous, description: event.target.value }))} /></label>}
      {!brandingOnly && program && <div className="text-xs text-gray-700 dark:text-gray-200"><label className="font-medium" htmlFor={`${id}-aliases`}>Other names or codes</label>
        <textarea id={`${id}-aliases`} className={field} rows={3} value={values.aliases} disabled={saving} aria-describedby={`${id}-aliases-hint`}
          onChange={event => setValues(previous => ({ ...previous, aliases: event.target.value }))} />
        <span id={`${id}-aliases-hint`} className="mt-1 block font-normal text-gray-500 dark:text-gray-400">Optional. One per line, up to 12. These must be distinct from other programs in this institute.</span></div>}
      <TaxonomyBannerPicker value={bannerColor} disabled={saving}
        uploaded={image.action !== 'remove' && Boolean(image.file || item?.image_url)}
        onChange={value => { setBannerColor(value); setImage({ action: 'remove', file: null, error: '' }) }} />
      <CompanyImageInput banner bannerColor={bannerColor} label={program ? 'Program banner' : 'Institute banner'} name={values.name} imageUrl={item?.image_url}
        value={image} onChange={setImage} disabled={saving} />
    </form>
  </DialogShell>
}

function CatalogCollection({ institute: selected, onSelect }) {
  const statusId = useId()
  const { data: latestInstitute } = useApi(selected ? `${ROOT}${selected.id}/` : null)
  const institute = latestInstitute || selected
  const { showToast } = useToast()
  const [filters, setFilters] = useState({ search: '', status: 'all', page: 1 })
  const [view, setView] = useState('grid')
  const [form, setForm] = useState(null)
  const [confirmation, setConfirmation] = useState(null)
  const [instructorProgram, setInstructorProgram] = useState(null)
  const base = institute ? `${ROOT}${institute.id}/programs/` : ROOT
  const query = new URLSearchParams({ ...filters, page_size: 8 })
  const { data, loading, error } = useApi(`${base}?${query}`)
  const { request } = useApi()
  const kind = institute ? 'program' : 'institute'
  const rows = data?.results || []
  function change(key, value) { setFilters(previous => ({ ...previous, [key]: value, page: 1 })) }
  function refresh() { invalidateCache(base) }
  async function save(values) {
    const result = await request(form.id ? 'patch' : 'post', form.id ? `${base}${form.id}/` : base, values, { silentError: true })
    if (result.ok) {
      applyDataChange({ topics: ['organization'] })
      setForm(null)
      showToast(`${institute ? 'Program' : 'Institute'} saved.`, 'success')
    }
    return result
  }
  async function toggle() {
    const result = await request('patch', `${base}${confirmation.id}/`, { is_active: !confirmation.is_active }, { silentError: true })
    if (result.ok) {
      applyDataChange({ topics: ['organization'] })
      setConfirmation(null)
      showToast(`${institute ? 'Program' : 'Institute'} ${confirmation.is_active ? 'archived' : 'restored'}.`, 'success')
    }
    return result.ok ? result : { ...result, message: errorText(result) }
  }
  const filtered = filters.search || filters.status !== 'all'
  const clear = () => setFilters({ search: '', status: 'all', page: 1 })
  return <section aria-label={institute ? `Programs in ${institute.name}` : 'Institutes'} className="space-y-5">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div><h2 className="text-base font-semibold text-gray-900 dark:text-white">{institute ? institute.name : 'Institutes'}</h2>
        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">{institute ? `Manage the programs belonging to ${institute.code}.` : 'Choose an institute to manage its programs.'}</p></div>
      <button type="button" className={primary} onClick={() => setForm({})} disabled={Boolean(institute && !institute.is_active)}><PlusIcon size={14} />Add {kind}</button>
    </div>
    {institute && !institute.is_active && <p className="text-xs text-amber-700 dark:text-amber-300">This institute is archived. Restore it before adding or restoring active programs.</p>}
    <div className="flex flex-wrap items-end gap-3">
      <label className="min-w-48 flex-1 text-xs font-medium text-gray-600 dark:text-gray-300">Search by name or code
        <input type="search" value={filters.search} maxLength={255} className={field} onChange={event => change('search', event.target.value)} /></label>
      <div className="text-xs font-medium text-gray-600 dark:text-gray-300"><label htmlFor={statusId}>Status</label>
        <select id={statusId} value={filters.status} className={field} onChange={event => change('status', event.target.value)}><option value="all">All statuses</option><option value="active">Active</option><option value="archived">Archived</option></select></div>
      {filtered && <button type="button" className={button} onClick={clear}>Clear filters</button>}
    </div>
    {error && <div role="alert" className="flex flex-wrap items-center gap-3 rounded-xl border border-rose-200 p-4 text-xs text-rose-700 dark:border-rose-900 dark:text-rose-300">
      <p>{error}</p><button type="button" className={button} onClick={() => refresh()}>Retry</button></div>}
    {loading && !data ? <ContentSkeleton layout="cards" count={4} label={`Loading ${kind}s`} /> : data && <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p role="status" className="text-xs text-gray-500 dark:text-gray-400">{data.count} {kind}{data.count === 1 ? '' : 's'}{filtered ? ' matching filters' : ''}</p>
        <CollectionViewToggle view={view} onChange={setView} label={institute ? 'Program view' : 'Institute view'} mobile />
      </div>
      {rows.length === 0 ? <EmptyState message={filtered ? `No ${kind}s match these filters.` : `No ${kind}s yet. Add one to get started.`} onClear={filtered ? clear : undefined} /> : <ul className={`grid gap-4 ${view === 'grid' ? 'sm:grid-cols-2 xl:grid-cols-3' : ''}`}>
        {rows.map(row => <OrganizationCatalogCard key={row.id} row={row} program={Boolean(institute)} view={view}
          onOpen={institute ? setInstructorProgram : onSelect} onEdit={setForm} onToggle={setConfirmation} />)}
      </ul>}
      <Pagination total={data.count} page={data.page} pageSize={data.page_size} onPage={page => setFilters(previous => ({ ...previous, page }))} />
    </>}
    {form && <CatalogForm item={form} program={Boolean(institute)} onClose={() => setForm(null)} onSave={save} />}
    {instructorProgram && <ProgramInstructors program={instructorProgram} institute={institute} onClose={() => setInstructorProgram(null)} />}
    {confirmation && <ConfirmModal title={`${confirmation.is_active ? 'Archive' : 'Restore'} ${kind}`} confirmLabel={confirmation.is_active ? 'Archive' : 'Restore'} archive tone="neutral"
      message={confirmation.is_active ? `Archive ${confirmation.name}? Records are retained. ${institute ? '' : 'Archive its active programs first.'}` : `Restore ${confirmation.name}?`}
      onCancel={() => setConfirmation(null)} onConfirm={toggle} />}
  </section>
}

export default function AdminInstitutes() {
  const [institute, setInstitute] = useState(null)
  return <section className="mx-auto max-w-7xl space-y-6 px-4 py-6 sm:px-6 sm:py-8">
    <header><h1 className="text-xl font-bold text-gray-900 dark:text-white">Institutes & Programs</h1><p className="mt-1 text-xs text-gray-500 dark:text-gray-400">Configure the academic structure used by SkillBridge.</p></header>
    {institute && <button type="button" className={button} onClick={() => setInstitute(null)}>← All institutes</button>}
    <CatalogCollection key={institute?.id || 'institutes'} institute={institute} onSelect={setInstitute} />
  </section>
}
