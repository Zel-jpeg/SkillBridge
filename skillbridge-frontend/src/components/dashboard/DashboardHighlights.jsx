import { lazy, Suspense, useMemo, useState } from 'react'
import Avatar from '../Avatar'
import { dashboardHighlights } from '../../utils/dashboardStudents'
import { matchColor, scoreColor } from '../../utils/formatters'

const SkillLeaderboardModal = lazy(() => import('../instructor/SkillLeaderboardModal'))
const palettes = [
  { pill: 'bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300', bar: 'bg-blue-500' },
  { pill: 'bg-violet-100 dark:bg-violet-900 text-violet-700 dark:text-violet-300', bar: 'bg-violet-500' },
  { pill: 'bg-pink-100 dark:bg-pink-900 text-pink-700 dark:text-pink-300', bar: 'bg-pink-500' },
  { pill: 'bg-amber-100 dark:bg-amber-900 text-amber-700 dark:text-amber-300', bar: 'bg-amber-500' },
  { pill: 'bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300', bar: 'bg-green-500' },
]
const card = 'group w-full min-w-0 rounded-2xl border border-gray-100 bg-white p-4 text-left dark:border-gray-800 dark:bg-gray-900 hover:shadow-md hover:border-green-300 dark:hover:border-green-700 hover:ring-2 hover:ring-green-200 dark:hover:ring-green-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-green-600 transition-all'
const grid = 'grid grid-cols-1 min-[360px]:grid-cols-2 lg:grid-cols-4 gap-3'
const barWidth = score => `${Math.max(0, Math.min(100, score))}%`

function ViewIcon() {
  return <svg aria-hidden="true" className="mt-1 h-3.5 w-3.5 shrink-0 text-gray-400 group-hover:text-green-600 dark:text-gray-500 dark:group-hover:text-green-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8S1 12 1 12Z" /><circle cx="12" cy="12" r="3" /></svg>
}

export default function DashboardHighlights({ students, onSelectStudent }) {
  const { leaders, topMatches } = useMemo(() => dashboardHighlights(students), [students])
  const [category, setCategory] = useState(null)
  const skill = leaders.find(leader => leader.category === category)
  return <>
    <section aria-label="Top matches" className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-gray-900 dark:text-white">Top matches</h2>
        <p className="text-xs text-gray-500 dark:text-gray-400">Select a student to view recommendations</p>
      </div>
      {topMatches.length ? <div className={grid}>{topMatches.map(student => <button type="button" key={student.id} aria-label={`View top match for ${student.name}`} aria-haspopup="dialog" onClick={() => onSelectStudent(student)} className={card}>
        <div className="flex items-start justify-between gap-2"><span className="rounded-full bg-blue-100 px-2.5 py-1 text-xs font-medium text-blue-700 dark:bg-blue-900 dark:text-blue-300">Top match</span><ViewIcon /></div>
        <div className="mt-3 flex items-center gap-2"><Avatar name={student.name} photoUrl={student.photoUrl} className="h-7 w-7 shrink-0 rounded-full text-[10px]" /><p className="min-w-0 truncate text-xs font-semibold text-gray-900 dark:text-white">{student.name}</p></div>
        <p className={`mt-1 text-lg font-bold ${matchColor(student.match)}`}>{student.match}%</p>
        <p className="mt-1 truncate text-xs font-medium text-gray-700 dark:text-gray-300">{student.position}</p><p className="truncate text-xs text-gray-500 dark:text-gray-400">{student.company}</p>
        <div className="mt-2 h-1 overflow-hidden rounded-full bg-gray-100 dark:bg-gray-800"><div className="h-full rounded-full bg-blue-500" style={{ width: barWidth(student.match) }} /></div>
      </button>)}</div> : <p className="rounded-2xl border border-dashed border-gray-200 p-4 text-xs text-gray-500 dark:border-gray-700 dark:text-gray-400">No current matches available. Matches appear when final competency and recommendations are ready.</p>}
    </section>
    <section aria-label="Top performers by skill" className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2"><h2 className="text-sm font-semibold text-gray-900 dark:text-white">Top performers by skill</h2><p className="text-xs text-gray-500 dark:text-gray-400">Select a skill to see the full ranking</p></div>
      {leaders.length ? <div className={grid}>{leaders.map(({ category, student, score }, index) => {
        const palette = palettes[index % palettes.length]
        return <button type="button" key={category} aria-label={`View ${category} ranking`} aria-haspopup="dialog" onClick={() => setCategory(category)} className={card}>
          <div className="flex items-start justify-between gap-2"><span className={`min-w-0 break-words rounded-full px-2.5 py-1 text-xs font-medium ${palette.pill}`}>{category}</span><ViewIcon /></div>
          <p className="mt-3 truncate text-xs font-semibold text-gray-900 dark:text-white">{student.name}</p><p className={`mt-0.5 text-lg font-bold ${scoreColor(score)}`}>{score}%</p>
          <div className="mt-2 h-1 overflow-hidden rounded-full bg-gray-100 dark:bg-gray-800"><div className={`h-full rounded-full ${palette.bar}`} style={{ width: barWidth(score) }} /></div>
        </button>
      })}</div> : <p className="rounded-2xl border border-dashed border-gray-200 p-4 text-xs text-gray-500 dark:border-gray-700 dark:text-gray-400">No final skill results available yet. Locked or missing results are excluded from rankings.</p>}
    </section>
    {skill && <Suspense fallback={<p role="status" className="text-xs text-gray-500">Loading skill ranking…</p>}><SkillLeaderboardModal skill={skill} allStudents={students} onClose={() => setCategory(null)} onSelectStudent={onSelectStudent} /></Suspense>}
  </>
}
