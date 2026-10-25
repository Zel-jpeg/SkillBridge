import { GridIcon, ListIcon } from './Icons'

// Match the compact cards/list switch in the instructor dashboard.
export default function CollectionViewToggle({ view, onChange, label = 'Collection view' }) {
  return <div role="group" aria-label={label} className="hidden items-center gap-1 rounded-xl bg-gray-100 p-1 dark:bg-gray-800 sm:flex">
    {[['grid', <GridIcon size={14} />, 'Card view'], ['list', <ListIcon size={14} />, 'List view']].map(([value, icon, name]) => <button
      key={value} type="button" aria-label={name} aria-pressed={view === value} onClick={() => onChange(value)}
      className={`cursor-pointer rounded-lg p-1.5 transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-green-600 ${view === value ? 'bg-white text-gray-900 shadow-sm dark:bg-gray-700 dark:text-white' : 'text-gray-400 hover:text-gray-700 dark:text-gray-500 dark:hover:text-gray-300'}`}
    >{icon}</button>)}
  </div>
}
