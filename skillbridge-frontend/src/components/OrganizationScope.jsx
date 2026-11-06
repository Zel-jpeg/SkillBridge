import { useApi } from '../hooks/useApi'
import { ORGANIZATION_OPTIONS, SHARED_IC_SKILLS } from '../utils/organizationScope'

const control = 'mt-1 min-h-10 w-full min-w-0 cursor-pointer rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs text-gray-800 transition-colors hover:border-green-500 focus-visible:outline-2 focus-visible:outline-green-600 disabled:cursor-default disabled:opacity-60 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200 dark:hover:border-green-500'

export default function OrganizationScope({ value, onChange, programPlaceholder = 'All programs', includeSharedIc = false }) {
  const { data, loading, error } = useApi(ORGANIZATION_OPTIONS)
  const programs = (data?.programs || []).filter(program => !value.institute || String(program.institute_id) === value.institute)
  const showSharedIc = includeSharedIc && data?.institutes?.some(institute =>
    institute.code === 'IC' && (!value.institute || String(institute.id) === value.institute))
  return <fieldset aria-label="Institute and program scope" className="flex min-w-0 flex-wrap items-end gap-3 text-xs text-gray-700 dark:text-gray-300">
    <legend className="sr-only">Institute and program scope</legend>
    <label className="min-w-0 flex-1 basis-48 font-medium">Institute
      <select aria-label="Institute" className={control} value={value.institute} disabled={!data}
        onChange={event => onChange({ institute: event.target.value, program: '' })}>
        <option value="">All institutes</option>
        {data?.institutes?.map(institute => <option key={institute.id} value={institute.id}>{institute.name}{!institute.is_active ? ' (archived)' : ''}</option>)}
      </select>
    </label>
    <label className="min-w-0 flex-1 basis-48 font-medium">Program
      <select aria-label="Program" className={control} value={value.program} disabled={!data || !programs.length && !showSharedIc}
        onChange={event => onChange({ ...value, program: event.target.value })}>
        <option value="">{programPlaceholder}</option>
        {showSharedIc && <option value={SHARED_IC_SKILLS}>Shared IC skills</option>}
        {programs.map(program => <option key={program.id} value={program.id}>
          {value.institute ? '' : `${program.institute_code} · `}{program.name}{!program.is_active ? ' (archived)' : ''}
        </option>)}
      </select>
    </label>
    {!data && (loading || error) && <p role={error ? 'alert' : 'status'} className="w-full text-gray-500 dark:text-gray-400">
      {error ? 'Institute and program filters are unavailable.' : 'Loading institutes and programs…'}
    </p>}
  </fieldset>
}
