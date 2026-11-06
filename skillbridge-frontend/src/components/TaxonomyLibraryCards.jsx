import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ChevronRightIcon, PencilIcon } from './Icons'
import Pagination from './Pagination'
import TaxonomyCardBanner from './TaxonomyCardBanner'
import { organizationCard as card, organizationField as field } from './admin/organizationUi'

const PAGE_SIZE = 9
const PROGRAM_TONES = ['hue-rotate-[28deg]', 'hue-rotate-[54deg]', 'hue-rotate-[82deg]']

export default function TaxonomyLibraryCards({ items, label, onEdit }) {
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const term = search.trim().toLocaleLowerCase()
  const rows = items.filter(item => [item.name, item.code, item.subtitle].some(value => value?.toLocaleLowerCase().includes(term)))
  const visiblePage = Math.min(page, Math.max(1, Math.ceil(rows.length / PAGE_SIZE)))

  return <section aria-label={label} className="space-y-4">
    {items.length > 0 && <label className="block max-w-sm text-xs font-medium">
      Search {label.toLowerCase()}
      <input className={field} type="search" maxLength={255} value={search} onChange={event => { setSearch(event.target.value); setPage(1) }} />
    </label>}
    {rows.length === 0 ? <p className="rounded-2xl border border-dashed border-gray-300 p-6 text-sm text-gray-600 dark:border-gray-700 dark:text-gray-300">
      {term ? 'No cards match your search.' : 'No skill libraries are available here yet.'}
    </p> : <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {rows.slice((visiblePage - 1) * PAGE_SIZE, visiblePage * PAGE_SIZE).map(item => {
        const tone = item.institute || item.shared ? '' : PROGRAM_TONES[item.id % PROGRAM_TONES.length]
        const editLabel = `Edit ${item.name}`
        return <li key={item.to} className={`${card} relative flex flex-col overflow-hidden`}>
          <Link to={item.to} aria-label={item.name} className="group flex flex-1 flex-col rounded-2xl focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-green-600">
            <div className="relative aspect-[3/1] min-h-24 max-h-36 overflow-hidden rounded-t-2xl bg-emerald-950">
              <TaxonomyCardBanner imageUrl={item.image_url} name={item.name} fallbackTone={tone} />
              <div className="absolute left-3 right-16 top-3 flex">
                <span title={item.code || undefined} className="truncate rounded-full bg-emerald-950/90 px-2.5 py-1 text-xs font-semibold leading-4 text-white">
                  {item.code || 'Shared'}
                </span>
              </div>
            </div>
            <div className="flex flex-1 items-start gap-3 px-5 py-4">
              <div className="min-w-0 flex-1">
                <h2 className="break-words text-sm font-semibold leading-5 group-hover:text-green-800 dark:group-hover:text-green-300">{item.name}</h2>
                {item.subtitle && <p className="mt-1 break-words text-xs leading-5 text-gray-600 dark:text-gray-400">{item.subtitle}</p>}
                {item.is_active === false && <p className="mt-2 text-xs text-gray-600 dark:text-gray-400">Archived</p>}
              </div>
              <span aria-hidden="true" className="mt-0.5 shrink-0 text-gray-400 group-hover:text-green-700 dark:group-hover:text-green-300"><ChevronRightIcon size={16} /></span>
            </div>
          </Link>
          {onEdit && !item.shared && <button type="button" aria-label={editLabel} title={editLabel} onClick={() => onEdit(item)}
            className="absolute right-2 top-2 grid h-11 w-11 cursor-pointer place-items-center rounded-lg text-white hover:bg-white/20 focus-visible:bg-white/20 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white">
            <span aria-hidden="true" className="grid h-8 w-8 place-items-center rounded-lg bg-emerald-950/90"><PencilIcon size={16} /></span>
          </button>}
        </li>
      })}
    </ul>}
    <Pagination total={rows.length} pageSize={PAGE_SIZE} page={visiblePage} onPage={setPage} />
  </section>
}
