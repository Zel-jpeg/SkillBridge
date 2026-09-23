export default function CompetencyInsights({ profile, compact = false }) {
  if (!profile?.orientation_label) return null

  const suggestions = profile.development_suggestions || []
  const evidence = profile.supporting_categories || []

  return (
    <section className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-2xl shadow-sm overflow-hidden">
      <div className="p-5">
        <div className="flex items-start gap-3">
          <div className="w-9 h-9 rounded-xl bg-violet-100 dark:bg-violet-900/50 flex items-center justify-center shrink-0" aria-hidden="true">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-violet-600 dark:text-violet-400">
              <path d="M12 3a6 6 0 0 0-3.7 10.7c.5.4.7 1 .7 1.6V17h6v-1.7c0-.6.3-1.2.7-1.6A6 6 0 0 0 12 3Z"/><path d="M9 21h6M9 17h6"/>
            </svg>
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-bold uppercase tracking-wider text-violet-600 dark:text-violet-400">System-Generated Skill Insights</p>
            <h3 className="text-sm font-bold text-gray-900 dark:text-white mt-1">{profile.orientation_label}</h3>
            <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed mt-1.5">{profile.orientation_summary}</p>
          </div>
        </div>

        {evidence.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-4">
            {evidence.slice(0, compact ? 3 : 5).map(item => (
              <span key={item.category} className="text-[11px] px-2.5 py-1 rounded-full bg-gray-50 dark:bg-gray-800 border border-gray-100 dark:border-gray-700 text-gray-600 dark:text-gray-300">
                {item.category} {Math.round(item.percentage)}% · {item.competency_label}
              </span>
            ))}
          </div>
        )}
      </div>

      {!compact && suggestions.length > 0 && (
        <div className="border-t border-gray-100 dark:border-gray-800 px-5 py-4">
          <p className="text-xs font-bold text-amber-700 dark:text-amber-400 uppercase tracking-wider">System-Generated Development Suggestions</p>
          <div className="flex flex-col gap-2 mt-2.5">
            {suggestions.map(item => (
              <div key={`${item.category}-${item.percentage}`} className="rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-100 dark:border-amber-900 px-3.5 py-3">
                <p className="text-xs font-bold text-amber-800 dark:text-amber-300">{item.category} <span className="font-normal">({Math.round(item.percentage)}%)</span></p>
                <p className="text-xs text-gray-600 dark:text-gray-400 leading-relaxed mt-1">{item.message}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="px-5 pb-4 pt-0">
        <p className="text-[10px] text-gray-400 dark:text-gray-500">Based on assessment results. Review these insights with an instructor or OJT coordinator.</p>
      </div>
    </section>
  )
}
