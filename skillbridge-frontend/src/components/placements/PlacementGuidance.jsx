export default function PlacementGuidance({ compact = false }) {
  return <aside aria-label="OJT placement guidance" className={`flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 text-amber-950 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-100 ${compact ? 'p-3' : 'p-4 sm:p-5'}`}>
    <svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" className="mt-0.5 shrink-0 text-amber-700 dark:text-amber-400">
      <circle cx="12" cy="12" r="9" /><path d="M12 11v5M12 7h.01" />
    </svg>
    <div className="min-w-0">
      <p className={`${compact ? 'text-xs' : 'text-sm'} font-semibold leading-relaxed`}>Final placement decisions are made by your OJT coordinator.</p>
      <p className="mt-1 text-xs leading-relaxed text-amber-800 dark:text-amber-200">This list is for reference only.</p>
    </div>
  </aside>
}
