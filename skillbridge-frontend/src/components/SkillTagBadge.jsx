// src/components/SkillTagBadge.jsx
//
// Shared components for displaying qualitative skill tags and score rows.
// Used across student, instructor, and admin pages for consistency.

import { SKILL_TAG_CONFIG, getQualitativeTag, scoreBg, scoreColor } from '../utils/formatters'

// ── SkillTagBadge ─────────────────────────────────────────────────
// Renders a small colored pill badge for a qualitative skill level.
//
// Props:
//   tag   — 'Expert' | 'Proficient' | 'Competent' | 'Beginner' | null
//   pct   — optional percentage; if tag is null, derived from pct
//   size  — 'xs' (default) | 'sm'

export function SkillTagBadge({ tag, pct, size = 'xs' }) {
  const resolved = tag ?? getQualitativeTag(pct)
  if (!resolved) return null
  const cfg = SKILL_TAG_CONFIG[resolved]
  if (!cfg) return null

  const textSize = size === 'sm' ? 'text-[11px] px-2 py-0.5' : 'text-[9px] px-1.5 py-0.5'

  return (
    <span className={`inline-flex items-center font-bold uppercase tracking-wider rounded ${textSize} ${cfg.classes} shrink-0`}>
      {cfg.label}
    </span>
  )
}

// ── SkillScoreRow ─────────────────────────────────────────────────
// Full skill row with category name, tag badge, animated bar, and pct.
// Used in instructor StudentModal, admin UserDetailModal, etc.
//
// Props:
//   category  — string
//   score     — number (0–100)
//   tag       — optional string tag; derived from score if omitted
//   compact   — boolean; smaller row height

export function SkillScoreRow({ category, score, tag, compact = false }) {
  const resolved = tag ?? getQualitativeTag(score)
  const StatusDot = () => {
    const color = score >= 80 ? 'bg-green-500' : score >= 60 ? 'bg-amber-400' : 'bg-rose-400'
    return <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${color}`} />
  }

  if (compact) {
    return (
      <div className="flex flex-col gap-1.5 bg-gray-50 dark:bg-gray-800/60 rounded-lg px-2 py-1.5">
        <div className="flex justify-between items-start">
          <div className="flex items-center gap-1.5 min-w-0 pr-2">
            <StatusDot />
            <span className="text-[10px] text-gray-600 dark:text-gray-300 font-medium leading-tight truncate">{category}</span>
          </div>
          <span className={`text-[11px] font-bold shrink-0 ${scoreColor(score)}`}>{score}%</span>
        </div>
        <div className="flex items-center gap-2">
          {resolved && <SkillTagBadge tag={resolved} size="xs" />}
          <div className="flex-1 h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
            <div className={`h-full rounded-full ${scoreBg(score)}`} style={{ width: `${score}%` }} />
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-1.5 mb-1.5">
      <div className="flex justify-between items-end">
        <span className="text-xs font-medium text-gray-700 dark:text-gray-300 leading-tight mr-2">{category}</span>
        <span className={`text-xs font-bold shrink-0 ${scoreColor(score)}`}>{score}%</span>
      </div>
      <div className="flex items-center gap-2">
        {resolved && <SkillTagBadge tag={resolved} size="xs" />}
        <div className="flex-1 h-1.5 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
          <div className={`h-full rounded-full ${scoreBg(score)}`} style={{ width: `${score}%` }} />
        </div>
      </div>
    </div>
  )
}

// ── SkillProfilePanel ─────────────────────────────────────────────
// Full panel showing all skill scores with overall average.
// Suitable for modals and detail pages.
//
// Props:
//   scores    — { [category]: number }
//   tags      — { [category]: string } (optional; derived if absent)
//   title     — string (default "Skill Breakdown")

export function SkillProfilePanel({ scores = {}, tags = {}, title = 'Skill Breakdown' }) {
  const entries = Object.entries(scores).sort(([a], [b]) => a.localeCompare(b))
  const vals = Object.values(scores)
  const overall = vals.length ? Math.round(vals.reduce((a, b) => a + b, 0) / vals.length) : null

  if (!entries.length) {
    return (
      <div className="bg-gray-50 dark:bg-gray-800 rounded-xl px-4 py-3 text-xs text-gray-400 dark:text-gray-500 italic">
        No skill scores yet.
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-3">
      {/* Overall summary bar */}
      {overall !== null && (
        <div className="flex items-center gap-3 bg-gray-50 dark:bg-gray-800 rounded-xl px-3 py-2.5">
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 font-black text-sm ${
            overall >= 80 ? 'bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300'
            : overall >= 60 ? 'bg-amber-100 dark:bg-amber-900 text-amber-700 dark:text-amber-300'
            : 'bg-rose-100 dark:bg-rose-900 text-rose-600 dark:text-rose-400'
          }`}>
            {overall}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-gray-700 dark:text-gray-300">Overall Average</span>
              <SkillTagBadge pct={overall} size="xs" />
            </div>
            <div className="h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden mt-1.5">
              <div className={`h-full rounded-full transition-all duration-500 ${scoreBg(overall)}`}
                style={{ width: `${overall}%` }} />
            </div>
          </div>
        </div>
      )}

      {/* Individual skill rows */}
      <div className="flex flex-col gap-2.5">
        <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">{title}</p>
        {entries.map(([cat, sc]) => (
          <SkillScoreRow key={cat} category={cat} score={sc} tag={tags[cat]} />
        ))}
      </div>
    </div>
  )
}
