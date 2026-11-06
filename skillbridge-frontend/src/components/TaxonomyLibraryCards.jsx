import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ChevronRightIcon, CompanyIcon, PencilIcon, SkillIcon } from './Icons'
import Pagination from './Pagination'
import CompanyImage from './CompanyImage'
import { organizationButton as button, organizationCard as card, organizationField as field } from './admin/organizationUi'

const PAGE_SIZE = 9

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
        const Icon = item.institute ? CompanyIcon : SkillIcon
        return <li key={item.to} className={`${card} flex flex-col overflow-hidden`}>
          <Link to={item.to} aria-label={item.name} className="group flex min-h-32 flex-1 items-start gap-4 rounded-t-2xl p-5 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-green-600">
            {item.image_url
              ? <CompanyImage name={item.name} imageUrl={item.image_url} className="h-12 w-12 rounded-xl" />
              : <span aria-hidden="true" className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-300"><Icon size={22} /></span>}
            <div className="min-w-0 flex-1">
              {item.code && <p className="text-xs font-semibold text-green-700 dark:text-green-300">{item.code}</p>}
              <h2 className="break-words text-sm font-semibold leading-5 group-hover:text-green-800 dark:group-hover:text-green-300">{item.name}</h2>
              {item.subtitle && <p className="mt-1 text-xs leading-5 text-gray-600 dark:text-gray-400">{item.subtitle}</p>}
              {item.is_active === false && <p className="mt-2 text-xs text-gray-600 dark:text-gray-400">Archived</p>}
            </div>
            <span aria-hidden="true" className="mt-1 text-gray-400 group-hover:text-green-700 dark:group-hover:text-green-300"><ChevronRightIcon size={16} /></span>
          </Link>
          {onEdit && !item.shared && <div className="flex justify-end border-t border-gray-100 px-4 py-2 dark:border-gray-800">
            <button type="button" className={button} aria-label={`Edit ${item.name}`} onClick={() => onEdit(item)}><PencilIcon size={14} />Edit card</button>
          </div>}
        </li>
      })}
    </ul>}
    <Pagination total={rows.length} pageSize={PAGE_SIZE} page={visiblePage} onPage={setPage} />
  </section>
}
