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
import OrganizationBreadcrumbs from '../../components/OrganizationBreadcrumbs'
import CatalogBannerEditor from '../../components/CatalogBannerEditor'
import { companyRequest } from '../../utils/companyImages'
import { taxonomyBannerColor } from '../../utils/taxonomyBannerColors'

const ROOT = '/api/admin/institutes/'

export function CatalogForm({ item, program, institute, onClose, onSave, brandingOnly = false }) {
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
    <label className="font-medium" htmlFor={`${id}-${key}`}>{label} <span className="text-rose-600">*</span></label><input id={`${id}-${key}`} aria-label={key === 'name' ? 'Name' : 'Code'} className={field} maxLength={maxLength} required value={values[key]} disabled={saving}
      onChange={event => setValues(previous => ({ ...previous, [key]: event.target.value }))} aria-describedby={hint ? `${id}-${key}-hint` : undefined} />
    {hint && <span id={`${id}-${key}-hint`} className="mt-1 block font-normal text-gray-500 dark:text-gray-400">{hint}</span>}
  </div>
  return <DialogShell title={`${item?.id ? 'Edit' : 'Add'} ${kind}`} description={brandingOnly ? `Update the name or banner shown on this ${kind} card.` : `Configure this ${kind}'s name, code and description.`}
    size="catalog" fixedHeader headerDetails={<div className="mt-2 space-y-2 text-xs text-gray-500 dark:text-gray-400"><p>{brandingOnly ? `Update the name or banner shown on this ${kind} card.` : `Configure this ${kind}'s name, code and description.`}</p>
      {program && institute && <p className="inline-flex rounded-md bg-green-50 px-2 py-1 text-green-800 dark:bg-green-950 dark:text-green-200">{institute.name} · {institute.code}</p>}</div>}
    onClose={close} closeDisabled={saving} closeLabel={`Close ${kind} form`}
    footer={<div className="flex justify-end gap-2"><button type="button" className={button} disabled={saving} onClick={close}>Cancel</button>
      <button type="submit" form={id} className={primary} disabled={saving || Boolean(image.error)}>{saving ? 'Saving…' : `Save ${kind}`}</button></div>}>
    <form id={id} onSubmit={save} className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 py-5 sm:px-6">
      {error && <p role="alert" className="rounded-lg bg-rose-50 p-3 text-xs text-rose-700 dark:bg-rose-950/30 dark:text-rose-300">{error}</p>}
      <div className="grid items-start gap-6 md:grid-cols-2">
      <section aria-label={`${program ? 'Program' : 'Institute'} details`} className="min-w-0 space-y-4">
      <h3 className="text-sm font-semibold text-gray-900 dark:text-white">{brandingOnly ? 'Card details' : `${program ? 'Program' : 'Institute'} details`}</h3>
      {input('name', `${program ? 'Program' : 'Institute'} name`, 255)}
      {!brandingOnly && input('code', `${program ? 'Program' : 'Institute'} code`, 30, 'Use a short, unique code.')}
      {!brandingOnly && <label className="block text-xs font-medium text-gray-700 dark:text-gray-200" htmlFor={`${id}-description`}>Description <span className="ml-2 font-normal text-gray-500">Optional</span>
        <textarea id={`${id}-description`} aria-label="Description" className={field} rows={3} maxLength={2000} value={values.description} disabled={saving}
          onChange={event => setValues(previous => ({ ...previous, description: event.target.value }))} /></label>}
      {!brandingOnly && program && <details open={Boolean(item?.aliases?.length)} className="rounded-lg border border-gray-200 p-3 text-xs text-gray-700 dark:border-gray-700 dark:text-gray-200">
        <summary className="cursor-pointer font-medium hover:text-green-700 focus-visible:outline-2 focus-visible:outline-green-600">Other names or codes <span className="ml-2 font-normal text-gray-500">Optional</span></summary>
        <div className="mt-3"><label className="font-medium" htmlFor={`${id}-aliases`}>Other names or codes</label>
        <textarea id={`${id}-aliases`} className={field} rows={3} value={values.aliases} disabled={saving} aria-describedby={`${id}-aliases-hint`}
          onChange={event => setValues(previous => ({ ...previous, aliases: event.target.value }))} />
        <span id={`${id}-aliases-hint`} className="mt-1 block font-normal leading-5 text-gray-500 dark:text-gray-400">One per line, up to 12. Use names distinct from other programs in this institute.</span></div></details>}
      </section>
      <div className="min-w-0 border-t border-gray-100 pt-5 md:border-t-0 md:border-l md:pt-0 md:pl-6 dark:border-gray-800">
        <CatalogBannerEditor item={item} program={program} name={values.name} code={values.code} color={bannerColor} onColorChange={setBannerColor}
          image={image} onImageChange={setImage} disabled={saving} />
      </div>
      </div>
    </form>
  </DialogShell>
}

function CatalogCollection({ institute: selected, onSelect, onBack }) {
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
      <div><h1 className="text-xl font-bold text-gray-900 dark:text-white">Institutes & Programs</h1>
        {!institute && <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">Choose an institute to manage its programs.</p>}</div>
      <button type="button" className={primary} onClick={() => setForm({})} disabled={Boolean(institute && !institute.is_active)}><PlusIcon size={14} />Add {kind}</button>
    </div>
    {institute && <OrganizationBreadcrumbs items={[
      { label: 'All institutes', onClick: onBack },
      { label: institute.name },
    ]} />}
    {institute && !institute.is_active && <p className="text-xs text-amber-700 dark:text-amber-300">This institute is archived. Restore it before adding or restoring active programs.</p>}
    <div className="sb-collection-toolbar" role="group" aria-label="Institute and program filters">
      <label className="min-w-48 flex-1 text-xs font-medium text-gray-600 dark:text-gray-300">Search by name or code
        <input type="search" value={filters.search} maxLength={255} className={field} onChange={event => change('search', event.target.value)} /></label>
      <label className="text-xs font-medium text-gray-600 dark:text-gray-300" htmlFor={statusId}>Status
        <select id={statusId} aria-label="Status" value={filters.status} className={field} onChange={event => change('status', event.target.value)}><option value="all">All statuses</option><option value="active">Active</option><option value="archived">Archived</option></select></label>
      {filtered && <button type="button" className={button} onClick={clear}>Clear filters</button>}
      <CollectionViewToggle view={view} onChange={setView} label={institute ? 'Program view' : 'Institute view'} mobile />
    </div>
    {error && <div role="alert" className="flex flex-wrap items-center gap-3 rounded-xl border border-rose-200 p-4 text-xs text-rose-700 dark:border-rose-900 dark:text-rose-300">
      <p>{error}</p><button type="button" className={button} onClick={() => refresh()}>Retry</button></div>}
    {loading && !data ? <ContentSkeleton layout="cards" count={4} label={`Loading ${kind}s`} /> : data && <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p role="status" className="text-xs text-gray-500 dark:text-gray-400">{data.count} {kind}{data.count === 1 ? '' : 's'}{filtered ? ' matching filters' : ''}</p>
      </div>
      {rows.length === 0 ? <EmptyState message={filtered ? `No ${kind}s match these filters.` : `No ${kind}s yet. Add one to get started.`} onClear={filtered ? clear : undefined} /> : <ul className={`grid gap-4 ${view === 'grid' ? 'sm:grid-cols-2 xl:grid-cols-3' : ''}`}>
        {rows.map(row => <OrganizationCatalogCard key={row.id} row={row} program={Boolean(institute)} view={view}
          onOpen={institute ? setInstructorProgram : onSelect} onEdit={setForm} onToggle={setConfirmation} />)}
      </ul>}
      <Pagination total={data.count} page={data.page} pageSize={data.page_size} onPage={page => setFilters(previous => ({ ...previous, page }))} />
    </>}
    {form && <CatalogForm item={form} program={Boolean(institute)} institute={institute} onClose={() => setForm(null)} onSave={save} />}
    {instructorProgram && <ProgramInstructors program={instructorProgram} institute={institute} onClose={() => setInstructorProgram(null)} />}
    {confirmation && <ConfirmModal title={`${confirmation.is_active ? 'Archive' : 'Restore'} ${kind}`} confirmLabel={confirmation.is_active ? 'Archive' : 'Restore'} archive tone="neutral"
      message={confirmation.is_active ? `Archive ${confirmation.name}? Records are retained. ${institute ? '' : 'Archive its active programs first.'}` : `Restore ${confirmation.name}?`}
      onCancel={() => setConfirmation(null)} onConfirm={toggle} />}
  </section>
}

export default function AdminInstitutes() {
  const [institute, setInstitute] = useState(null)
  return <section className="mx-auto max-w-7xl space-y-6 px-4 py-6 sm:px-6 sm:py-8">
    <CatalogCollection key={institute?.id || 'institutes'} institute={institute} onSelect={setInstitute} onBack={() => setInstitute(null)} />
  </section>
}
