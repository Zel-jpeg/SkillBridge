import { useId } from 'react'
import CompanyImage from '../CompanyImage'
import NlpTextPreview from '../NlpTextPreview'
import { ChevronDown, PencilIcon, PinIcon, PlusIcon, TrashIcon } from '../Icons'
import { companyLocation, positionDisclosureKey } from '../../utils/companyCollection'

const action = 'inline-flex h-10 w-10 shrink-0 cursor-pointer items-center justify-center rounded-lg text-gray-500 transition-colors motion-reduce:transition-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-green-600 dark:text-gray-400'
const editAction = `${action} hover:bg-green-50 hover:text-green-800 dark:hover:bg-green-950 dark:hover:text-green-300`
const deleteAction = `${action} hover:bg-rose-50 hover:text-rose-700 dark:hover:bg-rose-950 dark:hover:text-rose-300`

function PositionSummary({ company, position, expanded, onToggle, onEdit, onDelete }) {
  const id = useId()
  const requirements = Object.entries(position.requirements || {})
  const keywords = position.tags || []
  return <section aria-labelledby={`${id}-title`} className="min-w-0 rounded-xl border border-gray-100 bg-gray-50/60 dark:border-gray-800 dark:bg-gray-950/30">
    <div className="p-3 sm:p-4">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1"><h3 id={`${id}-title`} className="break-words text-sm font-semibold leading-6 text-gray-900 dark:text-white">{position.title}</h3><span className="mt-1.5 inline-flex rounded-md bg-green-50 px-2 py-0.5 text-xs font-medium text-green-800 dark:bg-green-950 dark:text-green-300" aria-label={`${position.slots} configured slots`}>{position.slots} slot{position.slots !== 1 ? 's' : ''}</span></div>
        <div className="flex shrink-0"><button type="button" aria-label={`Edit position ${position.title}`} title="Edit position" className={editAction} onClick={() => onEdit({ company, position })}><PencilIcon size={15} /></button><button type="button" aria-label={`Delete position ${position.title}`} title="Delete position" className={deleteAction} onClick={() => onDelete({ company, position })}><TrashIcon size={15} /></button></div>
      </div>
      <div className="mt-2 flex flex-wrap items-center justify-between gap-x-3 gap-y-1"><p className="text-xs leading-5 text-gray-500 dark:text-gray-400">{requirements.length} requirement{requirements.length !== 1 ? 's' : ''} · {keywords.length} keyword{keywords.length !== 1 ? 's' : ''}</p><button id={`${id}-toggle`} type="button" aria-expanded={expanded} aria-controls={`${id}-details`} aria-label={`${expanded ? 'Hide' : 'Show'} details for ${position.title}`} onClick={onToggle} className="inline-flex min-h-9 cursor-pointer items-center gap-1.5 rounded-lg px-2 text-xs font-semibold text-green-800 hover:bg-green-50 focus-visible:outline-2 focus-visible:outline-green-600 dark:text-green-300 dark:hover:bg-green-950"><span>{expanded ? 'Hide details' : 'Details'}</span><span aria-hidden="true"><ChevronDown size={14} open={expanded} /></span></button></div>
    </div>
    <div id={`${id}-details`} hidden={!expanded} role="region" aria-labelledby={`${id}-toggle`} className="space-y-5 border-t border-gray-100 bg-white p-3 sm:p-4 dark:border-gray-800 dark:bg-gray-900">
      {expanded && <>
        <section><h4 className="mb-2 text-xs font-semibold text-gray-800 dark:text-gray-200">Skill requirements</h4>{requirements.length ? <dl className="divide-y divide-gray-100 dark:divide-gray-800">{requirements.map(([category, percentage]) => <div key={category} className="grid grid-cols-[minmax(0,1fr)_auto] items-baseline gap-4 py-2 text-xs leading-5"><dt className="break-words text-gray-600 dark:text-gray-300">{category}</dt><dd className="whitespace-nowrap font-semibold tabular-nums text-gray-800 dark:text-gray-200">≥{percentage}%</dd></div>)}</dl> : <p className="text-xs text-gray-500 dark:text-gray-400">No skill requirements configured.</p>}</section>
        <section><h4 className="mb-2 text-xs font-semibold text-gray-800 dark:text-gray-200">Keywords</h4>{keywords.length ? <ul className="flex flex-wrap gap-x-3 gap-y-1.5 text-xs leading-5 text-gray-500 dark:text-gray-400" aria-label="Position keywords">{keywords.map((keyword, index) => <li key={`${index}-${keyword}`} className="max-w-full break-words">{keyword}</li>)}</ul> : <p className="text-xs text-gray-500 dark:text-gray-400">No keywords configured.</p>}</section>
        <section className="border-t border-gray-100 pt-2 dark:border-gray-800"><NlpTextPreview positionId={position.id} /></section>
      </>}
    </div>
  </section>
}

export default function CompanyCollectionCard({ company, expanded, onTogglePosition, onEditCompany, onDeleteCompany, onEditPosition, onDeletePosition, onAddPosition }) {
  const id = useId()
  const totalSlots = company.positions.reduce((sum, position) => sum + position.slots, 0)
  const hasAddress = company.address && company.address !== 'No address set'
  return <article aria-labelledby={`${id}-name`} className="min-w-0 self-start overflow-hidden rounded-2xl border border-gray-100 bg-white dark:border-gray-800 dark:bg-gray-900">
    <header className="border-b border-gray-100 p-4 sm:p-5 dark:border-gray-800">
      <div className="flex items-start gap-3"><CompanyImage name={company.name} imageUrl={company.image_url} className="h-10 w-10 rounded-xl" /><div className="min-w-0 flex-1"><h2 id={`${id}-name`} className="break-words text-sm font-semibold leading-6 text-gray-900 dark:text-white">{company.name}</h2><p className="mt-1 text-xs leading-5 text-gray-500 dark:text-gray-400">{company.positions.length} position{company.positions.length !== 1 ? 's' : ''} · {totalSlots} configured slot{totalSlots !== 1 ? 's' : ''}</p></div><div className="flex shrink-0"><button type="button" aria-label={`Edit partner ${company.name}`} title="Edit partner" className={editAction} onClick={() => onEditCompany(company)}><PencilIcon size={15} /></button><button type="button" aria-label={`Delete partner ${company.name}`} title="Delete partner" className={deleteAction} onClick={() => onDeleteCompany(company)}><TrashIcon size={15} /></button></div></div>
      {hasAddress ? <details className="mt-3 text-xs text-gray-500 dark:text-gray-400"><summary aria-label={`Full address for ${company.name}`} className="w-fit max-w-full cursor-pointer rounded-md leading-5 marker:text-gray-400 focus-visible:outline-2 focus-visible:outline-green-600"><span className="ml-1 inline-flex max-w-full items-start gap-1.5 align-top">{company.lat != null && company.lng != null && <span aria-hidden="true" className="mt-1 shrink-0 text-green-700 dark:text-green-400"><PinIcon size={12} /></span>}<span className="break-words">{companyLocation(company)}</span></span></summary><p className="mt-2 break-words rounded-lg bg-gray-50 px-3 py-2 leading-5 dark:bg-gray-800">{company.address}</p></details> : <p className="mt-3 text-xs text-gray-500 dark:text-gray-400">No address set</p>}
    </header>
    <div className="space-y-3 p-4 sm:p-5">{company.positions.length ? company.positions.map(position => { const key = positionDisclosureKey(company.id, position.id); return <PositionSummary key={position.id} company={company} position={position} expanded={expanded.has(key)} onToggle={() => onTogglePosition(key)} onEdit={onEditPosition} onDelete={onDeletePosition} /> }) : <p className="rounded-xl bg-gray-50 px-3 py-5 text-center text-xs text-gray-500 dark:bg-gray-950/30 dark:text-gray-400">No positions yet. Add a position to configure slots and requirements.</p>}</div>
    <footer className="border-t border-gray-100 px-4 py-3 sm:px-5 dark:border-gray-800"><button type="button" aria-label={`Add position to ${company.name}`} onClick={() => onAddPosition(company)} className="flex min-h-10 w-full cursor-pointer items-center justify-center gap-1.5 rounded-xl border border-dashed border-gray-300 px-3 py-2 text-xs font-semibold text-green-800 hover:border-green-400 hover:bg-green-50 focus-visible:outline-2 focus-visible:outline-green-600 dark:border-gray-700 dark:text-green-300 dark:hover:border-green-700 dark:hover:bg-green-950"><PlusIcon size={14} />Add Position</button></footer>
  </article>
}

export function CompanyCollectionSkeleton() {
  return <div role="status" aria-label="Loading partners and positions" aria-busy="true" className="space-y-6">
    <div aria-hidden="true" className="rounded-2xl border border-gray-100 bg-white p-4 dark:border-gray-800 dark:bg-gray-900"><div className="mb-4 h-6 w-48 rounded-lg bg-gray-100 motion-safe:animate-pulse dark:bg-gray-800" /><div className="h-64 rounded-xl bg-gray-100 motion-safe:animate-pulse sm:h-80 dark:bg-gray-800" /></div>
    <div aria-hidden="true" className="grid items-start gap-4 lg:grid-cols-2">{[0, 1].map(index => <div key={index} className="space-y-4 rounded-2xl border border-gray-100 bg-white p-5 dark:border-gray-800 dark:bg-gray-900"><div className="flex gap-3"><div className="h-10 w-10 shrink-0 rounded-xl bg-gray-100 motion-safe:animate-pulse dark:bg-gray-800" /><div className="flex-1 space-y-3"><div className="h-4 w-2/3 rounded bg-gray-100 motion-safe:animate-pulse dark:bg-gray-800" /><div className="h-3 w-1/2 rounded bg-gray-100 motion-safe:animate-pulse dark:bg-gray-800" /></div></div>{[0, 1].map(position => <div key={position} className="space-y-4 rounded-xl border border-gray-100 p-4 dark:border-gray-800"><div className="h-4 w-2/3 rounded bg-gray-100 motion-safe:animate-pulse dark:bg-gray-800" /><div className="h-3 w-1/2 rounded bg-gray-100 motion-safe:animate-pulse dark:bg-gray-800" /></div>)}<div className="h-10 rounded-xl bg-gray-100 motion-safe:animate-pulse dark:bg-gray-800" /></div>)}</div>
    <span className="sr-only">Loading partners and positions…</span>
  </div>
}
