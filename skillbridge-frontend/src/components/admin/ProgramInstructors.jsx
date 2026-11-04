import { useId, useRef, useState } from 'react'
import { useApi, invalidateCache } from '../../hooks/useApi'
import { useToast } from '../../context/ToastContext'
import DialogShell from '../DialogShell'
import Pagination from '../Pagination'
import ConfirmModal from './ConfirmModal'
import { ContentSkeleton } from '../loading/Skeletons'
import { organizationButton as button, organizationPrimary as primary, organizationField as field, organizationError } from './organizationUi'

function InstructorPicker({ base, onClose, onAssigned }) {
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [saving, setSaving] = useState(null)
  const [saveError, setSaveError] = useState('')
  const pending = useRef(false)
  const options = base.replace(/instructors\/$/, 'instructor-options/')
  const url = `${options}?${new URLSearchParams({ search, page, page_size: 8 })}`
  const { data, loading, error } = useApi(url)
  const { request } = useApi()
  function close() { if (!pending.current) onClose() }
  async function assign(instructor) {
    if (pending.current) return
    pending.current = true
    setSaving(instructor.id)
    setSaveError('')
    try {
      const result = await request('post', base, { instructor_id: instructor.id }, { silentError: true })
      if (result.ok) {
        invalidateCache(options)
        onAssigned()
      } else setSaveError(organizationError(result))
    } finally {
      pending.current = false
      setSaving(null)
    }
  }
  return <DialogShell title="Assign instructor" description="Choose an active, approved instructor account. Manage accounts in Users."
    size="confirm" onClose={close} closeDisabled={Boolean(saving)} closeLabel="Close instructor selection"
    footer={<button type="button" className={button} disabled={Boolean(saving)} onClick={close}>Cancel</button>}>
    <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 py-4">
      {saveError && <p role="alert" className="text-xs text-rose-700 dark:text-rose-300">{saveError}</p>}
      <label className="block text-xs font-medium text-gray-600 dark:text-gray-300">Search instructors by name, email or ID
        <input type="search" maxLength={255} className={field} value={search} disabled={Boolean(saving)} onChange={event => { setSearch(event.target.value); setPage(1) }} /></label>
      {error && <div role="alert" className="space-y-2 text-xs text-rose-700 dark:text-rose-300"><p>{error}</p><button className={button} onClick={() => invalidateCache(options)}>Retry instructor search</button></div>}
      {loading && !data ? <ContentSkeleton layout="cards" count={2} label="Loading instructor options" /> : data && <>
        <p role="status" className="text-xs text-gray-500 dark:text-gray-400">{data.count} eligible instructor{data.count === 1 ? '' : 's'}</p>
        {data.results.length ? <ul className="space-y-3">{data.results.map(instructor => <li key={instructor.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-gray-200 p-3 dark:border-gray-700">
          <div className="min-w-0"><p className="break-words text-xs font-semibold text-gray-900 dark:text-white">{instructor.name || instructor.email}</p><p className="mt-1 break-all text-xs text-gray-500 dark:text-gray-400">{instructor.email}</p></div>
          <button type="button" className={button} disabled={Boolean(saving) || instructor.assigned} onClick={() => assign(instructor)} aria-label={`Assign ${instructor.name || instructor.email}`}>
            {saving === instructor.id ? 'Assigning…' : instructor.assigned ? 'Assigned' : 'Assign'}</button>
        </li>)}</ul> : <p className="py-4 text-xs text-gray-500 dark:text-gray-400">No eligible instructors match. Check the search or approve an instructor account in Users.</p>}
        <Pagination total={data.count} page={data.page} pageSize={data.page_size} onPage={setPage} />
      </>}
    </div>
  </DialogShell>
}

export default function ProgramInstructors({ program: selected, institute: selectedInstitute, onClose }) {
  const statusId = useId()
  const detail = `/api/admin/institutes/${selected.institute_id}/programs/${selected.id}/`
  const { data: currentProgram } = useApi(detail)
  const { data: currentInstitute } = useApi(`/api/admin/institutes/${selected.institute_id}/`)
  const program = currentProgram || selected
  const institute = currentInstitute || selectedInstitute
  const available = program.is_active && institute.is_active
  const [filters, setFilters] = useState({ search: '', status: 'all', page: 1 })
  const [picker, setPicker] = useState(false)
  const [confirmation, setConfirmation] = useState(null)
  const base = `${detail}instructors/`
  const { data, loading, error } = useApi(`${base}?${new URLSearchParams({ ...filters, page_size: 8 })}`)
  const { request } = useApi()
  const { showToast } = useToast()
  function refresh() {
    invalidateCache(base)
    invalidateCache(`${detail}instructor-options/`)
    invalidateCache('/api/management/programs/')
  }
  function assigned() {
    refresh()
    setPicker(false)
    setFilters({ search: '', status: 'all', page: 1 })
    showToast('Instructor assigned to this program.', 'success')
  }
  async function toggle() {
    const result = await request('patch', `${base}${confirmation.id}/`, { is_active: !confirmation.is_active }, { silentError: true })
    if (result.ok) {
      refresh()
      setConfirmation(null)
      showToast(`Program assignment ${confirmation.is_active ? 'revoked' : 'restored'}.`, 'success')
    }
    return result.ok ? result : { ...result, message: organizationError(result) }
  }
  function change(key, value) { setFilters(previous => ({ ...previous, [key]: value, page: 1 })) }
  return <DialogShell title={`Instructors: ${program.name}`} description={`Manage instructors assigned to ${program.name} in ${institute.name}.`}
    onClose={onClose} closeLabel="Close program instructors" footer={<button type="button" className={button} onClick={onClose}>Done</button>}>
    <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 py-4">
      <div className="flex flex-wrap items-center justify-between gap-3"><p className="max-w-lg text-xs leading-relaxed text-gray-500 dark:text-gray-400">Assign program access here. Each instructor still manages their own batches.</p>
        <button type="button" className={primary} disabled={!available} onClick={() => setPicker(true)}>Assign instructor</button></div>
      {!available && <p className="text-xs text-amber-700 dark:text-amber-300">Restore this institute and program before assigning or restoring instructors.</p>}
      <div className="flex flex-wrap items-end gap-3"><label className="min-w-48 flex-1 text-xs font-medium text-gray-600 dark:text-gray-300">Search assigned instructors
        <input type="search" maxLength={255} className={field} value={filters.search} onChange={event => change('search', event.target.value)} /></label>
        <div className="text-xs font-medium text-gray-600 dark:text-gray-300"><label htmlFor={statusId}>Assignment status</label><select id={statusId} className={field} value={filters.status} onChange={event => change('status', event.target.value)}><option value="all">All assignments</option><option value="active">Active</option><option value="revoked">Revoked</option></select></div></div>
      {error && <div role="alert" className="space-y-2 text-xs text-rose-700 dark:text-rose-300"><p>{error}</p><button className={button} onClick={refresh}>Retry assignments</button></div>}
      {loading && !data ? <ContentSkeleton layout="cards" count={2} label="Loading program instructors" /> : data && <>
        <p role="status" className="text-xs text-gray-500 dark:text-gray-400">{data.count} assignment{data.count === 1 ? '' : 's'}</p>
        {data.results.length ? <ul className="space-y-3">{data.results.map(row => <li key={row.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-gray-200 p-4 dark:border-gray-700">
          <div className="min-w-0"><h3 className="break-words text-sm font-semibold text-gray-900 dark:text-white">{row.name || row.email}</h3><p className="mt-1 break-all text-xs text-gray-500 dark:text-gray-400">{row.email}</p><p className="mt-2 text-xs text-gray-500 dark:text-gray-400">{row.is_active ? row.effective ? 'Active assignment' : 'Unavailable: check program and account status' : 'Revoked assignment'}</p></div>
          <button type="button" className={button} disabled={!row.is_active && !available} onClick={() => setConfirmation(row)} aria-label={`${row.is_active ? 'Revoke' : 'Restore'} assignment for ${row.name || row.email}`}>{row.is_active ? 'Revoke' : 'Restore'}</button>
        </li>)}</ul> : <p className="py-5 text-xs text-gray-500 dark:text-gray-400">No assignments match. Assign an instructor or adjust these filters.</p>}
        {(filters.search || filters.status !== 'all') && <button type="button" className={button} onClick={() => setFilters({ search: '', status: 'all', page: 1 })}>Clear assignment filters</button>}
        <Pagination total={data.count} page={data.page} pageSize={data.page_size} onPage={page => setFilters(previous => ({ ...previous, page }))} />
      </>}
    </div>
    {picker && <InstructorPicker base={base} onClose={() => setPicker(false)} onAssigned={assigned} />}
    {confirmation && <ConfirmModal title={`${confirmation.is_active ? 'Revoke' : 'Restore'} program assignment`} confirmLabel={confirmation.is_active ? 'Revoke' : 'Restore'} tone="neutral"
      message={`${confirmation.is_active ? 'Revoke' : 'Restore'} ${confirmation.name || confirmation.email}'s access to this program? Their account and existing records are retained.`}
      onCancel={() => setConfirmation(null)} onConfirm={toggle} />}
  </DialogShell>
}
