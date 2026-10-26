import { useId, useState } from 'react'

/** Keep categories readable and independent of a card's stretched open button. */
export default function AssessmentCategoryPills({ categories = [] }) {
  const [expanded, setExpanded] = useState(false)
  const id = useId()
  const badge = 'max-w-full break-words rounded-md bg-gray-100 px-2 py-1 text-[11px] text-gray-600 dark:bg-gray-800 dark:text-gray-300'
  return <div className="flex flex-wrap items-start gap-1" data-assessment-categories>
    <span id={id} className="contents">{(expanded ? categories : categories.slice(0, 3)).map(name => <span key={name} className={badge}>{name}</span>)}</span>
    {categories.length > 3 && <button type="button" aria-controls={id} aria-expanded={expanded} aria-label={expanded ? 'Show fewer categories' : `Show ${categories.length - 3} more categories`} onClick={() => setExpanded(value => !value)} className="relative z-10 max-w-full cursor-pointer rounded-md border border-green-300 bg-white px-2 py-1 text-[11px] font-semibold text-green-700 transition-colors hover:border-green-500 hover:bg-green-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-green-600 dark:border-green-800 dark:bg-gray-900 dark:text-green-300 dark:hover:border-green-500 dark:hover:bg-green-950">{expanded ? '− Show less' : `+${categories.length - 3} more`}</button>}
    {!categories.length && <span className="text-xs text-gray-500 dark:text-gray-400">No categories</span>}
  </div>
}
