import { useState } from 'react'
import GroupedFilterPanel from './GroupedFilterPanel'
import { SearchIcon } from './Icons'
import { fetchWithDedup, useApi } from '../hooks/useApi'

export default function CollectionFilterToolbar({ filters, defaults, groups, onApply, onSearch, getPreviewCount, previewUrl, count, total, pending = false, error, noun, label, searchLabel, placeholder, children }) {
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState(filters)
  const { data: preview, error: previewError } = useApi(open && previewUrl ? previewUrl(draft) : null)
  const active = groups.filter(group => filters[group.key] !== defaults[group.key])
  const searching = Boolean(filters.search.trim())
  function changeOpen(next) {
    if (next) setDraft({ ...filters })
    setOpen(next)
  }
  return <section className="sb-roster-toolbar" aria-label={label}>
    <div className="sb-roster-primary">
      <label className="sb-roster-field"><span className="sr-only">{searchLabel}</span><span className="relative block">
        <span aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"><SearchIcon size={14} /></span>
        <input type="search" value={filters.search} onChange={event => onSearch(event.target.value)} placeholder={placeholder} className="h-[38px] w-full rounded-xl border border-gray-200 bg-white py-2 pr-4 pl-9 text-xs text-gray-900 outline-none focus:border-green-500 focus-visible:ring-2 focus-visible:ring-green-500 dark:border-gray-700 dark:bg-gray-900 dark:text-white" />
      </span></label>
      <div className="sb-roster-controls">
        {groups.length > 0 && <GroupedFilterPanel groups={groups} draft={draft} onChange={(key, value) => setDraft(previous => ({ ...previous, [key]: value }))}
          open={open} onOpenChange={changeOpen} onApply={() => onApply(draft)} onClear={() => setDraft({ ...defaults })}
          activeCount={active.length} previewCount={previewUrl && preview?.pagination ? preview.pagination.count : open ? getPreviewCount(draft) : 0}
          pending={pending || Boolean(open && previewUrl && !preview)} error={error || (open ? previewError : null)}
          onRetry={previewUrl ? () => fetchWithDedup(previewUrl(draft)).catch(() => {}) : undefined}
          noun={noun} dialogLabel={`${label} options`} />}
        {children}
      </div>
    </div>
    <div className="sb-roster-secondary">
      <p role="status">{error ? 'Results unavailable' : pending ? 'Loading results…' : `${count} of ${total} ${total === 1 ? noun.replace(/s$/, '') : noun}`}</p>
      {active.map(group => <button key={group.key} type="button" className="sb-collection-active-filter" aria-label={`Remove ${group.label} filter`} onClick={() => onApply({ ...filters, [group.key]: defaults[group.key] })}>{group.label}: {group.options.find(([value]) => value === filters[group.key])?.[1] ?? filters[group.key]} <span aria-hidden="true">×</span></button>)}
      {searching && <button type="button" className="sb-collection-active-filter" aria-label="Remove Search filter" onClick={() => onSearch('')}>Search: {filters.search} <span aria-hidden="true">×</span></button>}
      {(active.length > 0 || searching) && <button type="button" className="sb-roster-reset" onClick={() => onApply({ ...defaults })}>Clear filters</button>}
    </div>
  </section>
}
