import { SkillTagBadge } from './SkillTagBadge'
import { BAR_COLORS } from '../hooks/student/useStudentResults'
import { categoryPercentage, scorePercentage } from '../utils/assessmentSummary'
import './skillCategoryList.css'

// Bento cards scroll internally; document-style results can grow with their content.
export default function SkillCategoryList({ scores, animated = true, showRaw = false, showTags = true, colorful = true, scrollable = true, id }) {
  return <div id={id} role="region" aria-label="Skill categories" tabIndex={scrollable ? 0 : undefined} className={`sb-skill-category-list${scrollable ? '' : ' is-static'}`}>
    {scores.length ? <ul className="flex flex-col gap-4">
      {scores.map((score, index) => {
        const label = score.label ?? score.category
        const percentage = 'pct' in score ? score.pct : score.percentage
        const width = scorePercentage(percentage) ?? 0
        return <li key={label} className="min-w-0 py-0.5">
          <div className="mb-1.5 flex items-end justify-between gap-3 text-xs">
            <span className="min-w-0 font-medium leading-relaxed wrap-anywhere text-gray-700 dark:text-gray-200">{label}</span>
            <span className="shrink-0 font-bold tabular-nums text-gray-900 dark:text-white">
              {showRaw && <span className="mr-1.5 font-normal">{score.raw_score}/{score.max_score} ·</span>}{categoryPercentage(percentage)}
            </span>
          </div>
          <div className="flex items-center gap-2">
            {showTags && score.tag && <SkillTagBadge tag={score.tag} />}
            <div className="h-1.5 min-w-0 flex-1 overflow-hidden rounded-full bg-gray-100 dark:bg-gray-800">
              <div className={`h-full rounded-full transition-[width] duration-700 ease-out motion-reduce:transition-none ${colorful ? (score.barColor ?? BAR_COLORS[index % BAR_COLORS.length]) : 'bg-green-600'}`}
                style={{ width: animated ? `${width}%` : '0%' }} />
            </div>
          </div>
        </li>
      })}
    </ul> : <p className="py-4 text-center text-xs text-gray-500 dark:text-gray-400">No skill data yet.</p>}
  </div>
}
