import TaxonomyCardBanner from '../TaxonomyCardBanner'
import { ArchiveIcon, ChevronRightIcon, PencilIcon, RefreshIcon, UsersIcon } from '../Icons'
import { taxonomyBannerColor } from '../../utils/taxonomyBannerColors'
import { organizationButton, organizationCard } from './organizationUi'

export default function OrganizationCatalogCard({ row, program, view, banner, onCheckBanner, onOpen, onEdit, onToggle }) {
  const manageLabel = program ? `Manage instructors for ${row.name}` : `Manage programs in ${row.name}`
  const archiveLabel = `${row.is_active ? 'Archive' : 'Restore'} ${row.name}`
  const StatusIcon = row.is_active ? ArchiveIcon : RefreshIcon
  const pending = banner?.phase === 'saving' || banner?.phase === 'checking'
  const locked = pending || banner?.phase === 'uncertain'
  const action = 'relative z-20 grid h-11 w-11 cursor-pointer place-items-center rounded-lg text-white transition-colors hover:bg-white/20 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white disabled:cursor-not-allowed disabled:opacity-50 aria-disabled:cursor-not-allowed aria-disabled:opacity-50'
  return <li className={`${organizationCard} group relative isolate overflow-hidden ${view === 'list' ? 'sm:grid sm:grid-cols-[224px_minmax(0,1fr)]' : 'flex flex-col'}`}>
    <div className={`relative aspect-[3/1] min-h-24 max-h-36 overflow-hidden bg-emerald-950 ${view === 'list' ? 'sm:aspect-auto sm:h-full sm:max-h-none' : ''}`}>
      <TaxonomyCardBanner imageUrl={pending ? null : row.image_url} name={row.name} color={pending ? banner.color : taxonomyBannerColor(row.banner_color, row.id)} />
      <span className="pointer-events-none absolute left-3 right-28 top-3 flex">
        <span title={row.code} className="max-w-full truncate rounded-full bg-emerald-950/90 px-2.5 py-1 text-xs font-semibold leading-4 text-white">{row.code}</span>
      </span>
      <div className="absolute right-2 top-2 flex gap-1">
        <button type="button" aria-label={`Edit ${row.name}`} title={`Edit ${row.name}`} className={action} aria-disabled={locked} onClick={() => { if (!locked) onEdit(row) }}>
          <span aria-hidden="true" className="grid h-8 w-8 place-items-center rounded-lg bg-emerald-950/90"><PencilIcon size={16} /></span>
        </button>
        <button type="button" aria-label={archiveLabel} title={archiveLabel} className={action} disabled={locked} onClick={() => onToggle(row)}>
          <span aria-hidden="true" className="grid h-8 w-8 place-items-center rounded-lg bg-emerald-950/90"><StatusIcon size={16} /></span>
        </button>
      </div>
    </div>
    <div className="flex min-w-0 flex-1 flex-col gap-3 p-4 sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <h3 aria-label={row.name} className="min-w-0 break-words text-sm font-semibold leading-5 text-gray-900 dark:text-white">
          <button type="button" aria-label={manageLabel} title={`${row.name} · ${row.code}`} onClick={() => onOpen(row)}
            className="cursor-pointer text-left outline-none transition-colors after:absolute after:inset-0 after:z-10 after:rounded-2xl after:content-[''] hover:bg-green-50 hover:text-green-800 focus-visible:after:outline-2 focus-visible:after:-outline-offset-2 focus-visible:after:outline-green-600 dark:hover:bg-green-950 dark:hover:text-green-200">{row.name}</button>
        </h3>
        <span className={`shrink-0 rounded-full px-2 py-1 text-xs ${row.is_active ? 'bg-green-50 text-green-800 dark:bg-green-950 dark:text-green-200' : 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300'}`}>{row.is_active ? 'Active' : 'Archived'}</span>
      </div>
      {pending && <p role="status" className="text-xs font-medium text-gray-700 dark:text-gray-200">
        {banner.phase === 'saving' ? 'Saving banner…' : 'Checking saved banner…'}
      </p>}
      {banner?.message && <div className="relative z-20 space-y-2">
        <p role="alert" className="text-xs text-amber-800 dark:text-amber-200">{banner.message}</p>
        <div className="flex flex-wrap gap-2">
          {banner.phase !== 'rejected' && <button type="button" className={organizationButton} onClick={onCheckBanner}>Check saved banner</button>}
          {!locked && <button type="button" className={organizationButton} onClick={() => onEdit(row)}>Edit banner</button>}
        </div>
      </div>}
      {row.description && <p className="whitespace-pre-wrap break-words text-xs leading-5 text-gray-600 dark:text-gray-300">{row.description}</p>}
      {row.aliases?.length > 0 && <p className="break-words text-xs leading-5 text-gray-500 dark:text-gray-400">Other names: {row.aliases.join(', ')}</p>}
      {!program && <p className="text-xs text-gray-500 dark:text-gray-400">{row.program_count} program{row.program_count === 1 ? '' : 's'}</p>}
      <p aria-hidden="true" className="mt-auto flex items-center gap-2 border-t border-gray-100 pt-3 text-xs font-semibold text-green-800 group-hover:text-green-700 dark:border-gray-800 dark:text-green-300">
        {program && <UsersIcon size={16} />}{program ? 'Manage instructors' : 'Manage programs'}<ChevronRightIcon size={14} />
      </p>
    </div>
  </li>
}
