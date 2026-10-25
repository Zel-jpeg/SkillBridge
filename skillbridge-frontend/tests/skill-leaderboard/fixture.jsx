import { useRef, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { SessionProvider } from '../../src/context/SessionContext'
import SkillLeaderboardModal from '../../src/components/instructor/SkillLeaderboardModal'
import StudentDetailModal from '../../src/components/StudentDetailModal'
import '../../src/index.css'

// Test-only synthetic records. No dependency on generated design files or API calls.
const names = ['Amelia Cruz', 'Noah Reyes', 'Isabel Santos', 'Luke Garcia', 'Maya Flores', 'Ethan Tan', 'Sofia Lopez', 'Daniel Lim', 'Chloe Reyes', 'Gabriel Santos', 'Harper Valdez', 'Julian Ramos', 'Leah Bautista', 'Mateo Perez', 'Nina Aquino', 'Oliver Torres', 'Paige Villanueva', 'Quinn Serrano', 'Riley Dizon', 'Theo Salazar', 'Ava Mendoza', 'Ben Castro', 'Chloe Navarro', 'Owen Dela Cruz']

function cohort(scenario, category) {
  const rows = names.map((name, index) => {
    const pending = index >= 20
    const score = Math.round((29 - index) / 30 * 10000) / 100
    return { id: index + 1, name, studentId: `2023-${String(index + 101).padStart(5, '0')}`, course: index % 3 ? 'BSIT' : 'BSIS',
      batch: { name: 'OJT Batch 2026' }, status: pending ? 'pending' : 'completed', recommendationsLocked: pending,
      scores: pending ? {} : { [category]: score }, totalRequiredCount: 1, completedRequiredCount: pending ? 0 : 1,
      remainingRequiredCount: pending ? 1 : 0, placement: { status: 'unplaced' },
      combinedCategoryScores: pending ? [] : [{ category, percentage: score, raw_score: 29 - index, max_score: 30 }],
      combinedCompetencyProfile: pending ? null : { finalized_at: '2026-10-21T01:00:00Z', model_used: 'regex' }, assessmentResults: [] }
  })
  if (scenario === 'empty') return []
  if (scenario === 'one') return rows.slice(0, 1)
  if (scenario === 'two') return rows.slice(0, 2)
  if (scenario === 'pending') return rows.map(row => ({ ...row, status: 'pending', scores: {}, recommendationsLocked: true }))
  if (scenario === 'zero') return rows.slice(0, 4).map(row => ({ ...row, scores: { [category]: 0 } }))
  if (scenario === 'ties') return [rows[2], rows[0], rows[1], ...rows.slice(3)].map((row, index) => index < 3 ? { ...row, scores: { [category]: 90 } } : row)
  if (scenario === 'locked') return rows.map(row => ({ ...row, scores: { [category]: 100 }, recommendationsLocked: true }))
  if (scenario === 'missing') return rows.map(row => ({ ...row, scores: {} }))
  if (scenario === 'long') return rows.map(row => ({ ...row, name: `${row.name} With An Extended Synthetic Enrollment Name`, studentId: `${row.studentId}-SYNTHETIC-LONG-ID`, course: 'Bachelor of Science in Information Technology' }))
  return rows
}

export default function Fixture() {
  const scenario = new URLSearchParams(location.search).get('scenario') || 'many'
  const category = scenario === 'long' ? 'Database Management and Enterprise Information Systems Administration' : 'Database Management'
  const [students, setStudents] = useState(() => cohort(scenario, category))
  const [open, setOpen] = useState(false)
  const [selected, setSelected] = useState(null)
  const opener = useRef(null)
  const studentOpener = useRef(null)
  return <main className="min-h-screen bg-gray-50 p-6 dark:bg-gray-950 dark:text-white">
    <h1>Skill leaderboard synthetic checks</h1>
    <button id="open-leaderboard" className="rounded-lg border p-3" onClick={event => { opener.current = event.currentTarget; setOpen(true) }}>Open leaderboard</button>
    <button id="shrink" onClick={() => setStudents(rows => rows.filter(row => row.id <= 4 || row.id >= 21))}>Simulate fewer ranked records</button>
    <button id="restore" onClick={() => setStudents(cohort(scenario, category))}>Restore synthetic cohort</button>
    {open && <SkillLeaderboardModal skill={{ category }} allStudents={students} onClose={() => setOpen(false)} onSelectStudent={student => { studentOpener.current = document.activeElement; setSelected(student) }} />}
    {selected && <StudentDetailModal student={selected} readOnly onClose={() => setSelected(null)} restoreFocusRef={studentOpener} />}
  </main>
}

createRoot(document.getElementById('root')).render(<BrowserRouter><SessionProvider><Fixture /></SessionProvider></BrowserRouter>)
