// src/components/instructor/SkillLeaderboardModal.jsx
//
// Modal showing ALL students ranked by a specific skill category.
// Top 3 are displayed in a podium layout with gold/silver/bronze medal icons.
// Remaining students appear in a compact ranked list below.
// Pending (not assessed) students are shown in a muted section at the bottom.
//
// Props:
//   skill        — { category, student, score } — the leader card that was clicked
//   allStudents  — full studentsList from useInstructorDashboard
//   palette      — { pill, bar } — color palette for the skill
//   onClose      — close handler
//   onSelectStudent(student) — opens StudentModal for a student

import { XIcon } from '../Icons'
import { getInitials } from '../../utils/formatters'
import Avatar from '../Avatar'

// ── Score helpers (local, no import needed) ────────────────────────
function scoreColor(p) {
  if (p == null) return 'text-gray-300 dark:text-gray-700'
  if (p >= 80)   return 'text-green-600 dark:text-green-400'
  if (p >= 60)   return 'text-amber-600 dark:text-amber-400'
  return 'text-rose-500 dark:text-rose-400'
}
function scoreBgBar(p) {
  if (p >= 80) return 'bg-green-500'
  if (p >= 60) return 'bg-amber-500'
  return 'bg-rose-500'
}

// ── Medal SVG icons ────────────────────────────────────────────────
const GoldMedalIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="9" fill="#FDE68A" stroke="#D97706" strokeWidth="1.5"/>
    <path d="M12 7l1.5 3h3l-2.5 2 1 3L12 13.5 9 15l1-3-2.5-2h3z" fill="#D97706" stroke="none"/>
  </svg>
)

const SilverMedalIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="9" fill="#E2E8F0" stroke="#94A3B8" strokeWidth="1.5"/>
    <path d="M12 7l1.5 3h3l-2.5 2 1 3L12 13.5 9 15l1-3-2.5-2h3z" fill="#94A3B8" stroke="none"/>
  </svg>
)

const BronzeMedalIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="9" fill="#FED7AA" stroke="#C2410C" strokeWidth="1.5"/>
    <path d="M12 7l1.5 3h3l-2.5 2 1 3L12 13.5 9 15l1-3-2.5-2h3z" fill="#C2410C" stroke="none"/>
  </svg>
)

const TrophyIcon = ({ size = 22 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M6 9H3.5a2.5 2.5 0 0 1 0-5H6"/>
    <path d="M18 9h2.5a2.5 2.5 0 0 0 0-5H18"/>
    <path d="M4 2h16v7a8 8 0 0 1-16 0z"/>
    <path d="M9 17v1a4 4 0 0 0-4 4h14a4 4 0 0 0-4-4v-1"/>
    <path d="M8 17h8"/>
  </svg>
)

const UserGroupIcon = ({ size = 14 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
    <circle cx="9" cy="7" r="4"/>
    <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
    <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
  </svg>
)

const ClockSmallIcon = ({ size = 13 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10"/>
    <path d="M12 6v6l4 2"/>
  </svg>
)

// ── Podium card for top 3 ──────────────────────────────────────────
function PodiumCard({ student, rank, score, category, onSelectStudent }) {
  const MedalIcon = rank === 1 ? GoldMedalIcon : rank === 2 ? SilverMedalIcon : BronzeMedalIcon

  const cardStyle = rank === 1
    ? 'bg-gradient-to-b from-amber-50 to-white dark:from-amber-950/40 dark:to-gray-900 border-2 border-amber-300 dark:border-amber-700 shadow-lg shadow-amber-100 dark:shadow-amber-950/30'
    : rank === 2
    ? 'bg-white dark:bg-gray-900 border border-slate-200 dark:border-slate-700'
    : 'bg-white dark:bg-gray-900 border border-orange-100 dark:border-orange-900/50'

  const avatarStyle = rank === 1
    ? 'bg-gradient-to-br from-amber-400 to-yellow-600 text-white shadow shadow-amber-300 dark:shadow-amber-900'
    : rank === 2
    ? 'bg-gradient-to-br from-slate-300 to-slate-500 text-white'
    : 'bg-gradient-to-br from-orange-300 to-orange-500 text-white'

  const avatarSize = rank === 1 ? 'w-14 h-14 text-base' : 'w-11 h-11 text-sm'

  return (
    <div
      className={`relative flex flex-col items-center gap-2 rounded-2xl p-4 cursor-pointer transition-all hover:scale-[1.02] hover:shadow-md ${cardStyle} ${rank === 1 ? 'pt-5' : 'pt-4'}`}
      onClick={() => onSelectStudent(student)}
      title={`View ${student.name}'s details`}
    >
      {/* Medal icon floating top-right */}
      <div className="absolute top-2.5 right-2.5">
        <MedalIcon />
      </div>

      {/* Rank number */}
      <div className={`text-xs font-bold ${rank === 1 ? 'text-amber-600 dark:text-amber-400' : rank === 2 ? 'text-slate-500 dark:text-slate-400' : 'text-orange-600 dark:text-orange-400'}`}>
        #{rank}
      </div>

      {/* Avatar */}
      <Avatar name={student.name} photoUrl={student.photoUrl} className={`rounded-full shadow-sm shrink-0 ${avatarSize}`} />

      {/* Name */}
      <div className="text-center min-w-0 w-full">
        <p className={`font-semibold text-gray-900 dark:text-white leading-tight truncate ${rank === 1 ? 'text-sm' : 'text-xs'}`}>
          {student.name.split(' ').slice(0, 2).join(' ')}
        </p>
        <p className="text-[10px] text-gray-400 dark:text-gray-500 truncate mt-0.5">{student.course}</p>
      </div>

      {/* Score */}
      <p className={`font-black leading-none ${rank === 1 ? 'text-2xl' : 'text-xl'} ${scoreColor(score)}`}>
        {score}%
      </p>

      {/* Score bar */}
      <div className="w-full h-1.5 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${scoreBgBar(score)}`}
          style={{ width: `${score}%` }}
        />
      </div>

      {/* Gold ring glow for #1 */}
      {rank === 1 && (
        <div className="absolute inset-0 rounded-2xl ring-2 ring-amber-300/40 dark:ring-amber-700/30 pointer-events-none" />
      )}
    </div>
  )
}

// ── Main modal ─────────────────────────────────────────────────────
export default function SkillLeaderboardModal({ skill, allStudents, palette, onClose, onSelectStudent }) {
  const { category } = skill

  // Sort completed students for this skill, descending by score
  const ranked = allStudents
    .filter(s => s.status === 'completed' && s.scores[category] != null)
    .sort((a, b) => b.scores[category] - a.scores[category])

  const pendingStudents = allStudents.filter(s => s.status === 'pending')

  // Podium: top 3 (rearranged: 2, 1, 3 for visual podium effect)
  const top3 = ranked.slice(0, 3)
  const podiumOrder = top3.length === 3
    ? [top3[1], top3[0], top3[2]]   // 2nd left, 1st center, 3rd right
    : top3.length === 2
    ? [top3[1], top3[0]]
    : [top3[0]]

  const rest = ranked.slice(3)

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm px-0 sm:px-4 pb-0"
      onClick={e => e.target === e.currentTarget && onClose()}
    >
      <div
        className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-t-3xl sm:rounded-2xl shadow-2xl w-full sm:max-w-xl flex flex-col max-h-[88vh] overflow-hidden"
        style={{ animation: 'skillModalIn 0.26s cubic-bezier(0.34,1.1,0.64,1) both' }}
      >

        {/* ── Header ─────────────────────────────────────────────── */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 dark:border-gray-800 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-amber-50 dark:bg-amber-950/50 flex items-center justify-center text-amber-600 dark:text-amber-400 shrink-0">
              <TrophyIcon size={18} />
            </div>
            <div>
              <h2 className="text-sm font-bold text-gray-900 dark:text-white leading-tight">
                {category} Leaderboard
              </h2>
              <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5 flex items-center gap-1.5">
                <UserGroupIcon size={11} />
                {ranked.length} assessed · {pendingStudents.length} pending
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-xl text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          >
            <XIcon size={16} />
          </button>
        </div>

        {/* ── Scrollable body ────────────────────────────────────── */}
        <div className="flex-1 overflow-y-auto">

          {ranked.length === 0 ? (
            /* No assessed students yet */
            <div className="flex flex-col items-center gap-3 py-14 px-6 text-center">
              <div className="w-14 h-14 rounded-2xl bg-gray-50 dark:bg-gray-800 flex items-center justify-center text-gray-300 dark:text-gray-700">
                <TrophyIcon size={26} />
              </div>
              <p className="text-sm font-semibold text-gray-500 dark:text-gray-400">No results yet</p>
              <p className="text-xs text-gray-400 dark:text-gray-600 max-w-xs leading-relaxed">
                No student has been assessed for <span className="font-medium">{category}</span> yet.
                Results will appear here once students complete the assessment.
              </p>
            </div>
          ) : (
            <div className="p-5 flex flex-col gap-5">

              {/* ── Podium (Top 1-3) ─────────────────────────────── */}
              <div>
                <p className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                  <GoldMedalIcon />
                  Top Performers
                </p>

                {/* Podium grid — 3 cols when 3 students, else equal cols */}
                <div className={`grid gap-3 items-end ${
                  top3.length === 1 ? 'grid-cols-1 max-w-[180px] mx-auto'
                  : top3.length === 2 ? 'grid-cols-2'
                  : 'grid-cols-3'
                }`}>
                  {podiumOrder.map((s, i) => {
                    // Map display position back to actual rank
                    const actualRank = top3.indexOf(s) + 1
                    return (
                      <div
                        key={s.id}
                        className={top3.length === 3 && actualRank === 1 ? 'mt-0' : top3.length === 3 ? 'mt-4' : ''}
                      >
                        <PodiumCard
                          student={s}
                          rank={actualRank}
                          score={s.scores[category]}
                          category={category}
                          onSelectStudent={onSelectStudent}
                        />
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* ── Rest of ranked list (4th onwards) ────────────── */}
              {rest.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-2">
                    Rankings
                  </p>
                  <div className="flex flex-col divide-y divide-gray-50 dark:divide-gray-800 bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-2xl overflow-hidden">
                    {rest.map((s, i) => {
                      const rank = i + 4
                      const score = s.scores[category]
                      return (
                        <div
                          key={s.id}
                          className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-800/60 cursor-pointer transition-colors group"
                          onClick={() => onSelectStudent(s)}
                        >
                          {/* Rank badge */}
                          <div className="w-6 h-6 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center text-[10px] font-bold text-gray-500 dark:text-gray-400 shrink-0">
                            {rank}
                          </div>

                          {/* Avatar */}
                          <Avatar name={s.name} photoUrl={s.photoUrl} className="w-8 h-8 rounded-full text-xs" />

                          {/* Name + course */}
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-gray-900 dark:text-white truncate group-hover:text-green-700 dark:group-hover:text-green-400 transition-colors">
                              {s.name}
                            </p>
                            <p className="text-[10px] text-gray-400 dark:text-gray-500 truncate">{s.course}</p>
                          </div>

                          {/* Score bar + value */}
                          <div className="flex items-center gap-2 shrink-0">
                            <div className="w-16 h-1.5 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
                              <div
                                className={`h-full rounded-full ${scoreBgBar(score)}`}
                                style={{ width: `${score}%` }}
                              />
                            </div>
                            <span className={`text-sm font-bold w-10 text-right ${scoreColor(score)}`}>
                              {score}%
                            </span>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}

              {/* ── Pending students section ──────────────────────── */}
              {pendingStudents.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-gray-300 dark:text-gray-600 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                    <ClockSmallIcon />
                    Not yet assessed ({pendingStudents.length})
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {pendingStudents.map(s => (
                      <div
                        key={s.id}
                        className="flex items-center gap-1.5 bg-gray-50 dark:bg-gray-800/60 border border-gray-100 dark:border-gray-800 rounded-xl px-2.5 py-1.5 cursor-pointer hover:border-gray-300 dark:hover:border-gray-600 transition-colors"
                        onClick={() => onSelectStudent(s)}
                        title={s.name}
                      >
                        <Avatar name={s.name} photoUrl={s.photoUrl} className="w-5 h-5 rounded-full text-[9px]" />
                        <span className="text-xs text-gray-400 dark:text-gray-500 truncate max-w-[100px]">
                          {s.name.split(' ')[0]}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

            </div>
          )}
        </div>

        {/* ── Footer hint ────────────────────────────────────────── */}
        <div className="shrink-0 border-t border-gray-50 dark:border-gray-800 px-5 py-3">
          <p className="text-[10px] text-gray-300 dark:text-gray-700 text-center">
            Click any student to view their full assessment details
          </p>
        </div>
      </div>

      <style>{`
        @keyframes skillModalIn {
          from { transform: translateY(32px) scale(0.97); opacity: 0; }
          to   { transform: translateY(0)    scale(1);    opacity: 1; }
        }
        @media (max-width: 639px) {
          @keyframes skillModalIn {
            from { transform: translateY(100%); opacity: 0.8; }
            to   { transform: translateY(0);    opacity: 1; }
          }
        }
      `}</style>
    </div>
  )
}
