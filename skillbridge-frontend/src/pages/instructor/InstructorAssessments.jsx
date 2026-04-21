// src/pages/instructor/InstructorAssessments.jsx
//
// Assessment Library — browse, review, and edit all published assessments.
//
// Features:
//   • Summary stats (total, active, questions, submissions)
//   • Search by title or batch name
//   • Filter by batch and active/inactive status
//   • Card grid — click any card to open the question review drawer
//   • Right-side drawer: full question list with choices, correct answers highlighted
//   • Inline edit: title, duration, active toggle (PATCH /api/instructor/assessments/:id/)
//   • "Add Questions" upload modal — append from Excel or .txt file
//   • "Create Assessment" button → /instructor/assessment/create

import { useState }                from 'react'
import { useNavigate }             from 'react-router-dom'
import InstructorNav               from '../../components/instructor/InstructorNav'
import { useInstructorAssessments } from '../../hooks/instructor/useInstructorAssessments'
import { useAssessmentUpload }      from '../../hooks/instructor/useAssessmentUpload'

// ── Type badge config ─────────────────────────────────────────────────────────
const TYPE_META = {
  mcq:            { label: 'MCQ',   color: 'bg-blue-100 dark:bg-blue-900/60 text-blue-700 dark:text-blue-300' },
  truefalse:      { label: 'T / F', color: 'bg-purple-100 dark:bg-purple-900/60 text-purple-700 dark:text-purple-300' },
  identification: { label: 'IDENT', color: 'bg-amber-100 dark:bg-amber-900/60 text-amber-700 dark:text-amber-300' },
}

const CHOICE_LABELS = ['A', 'B', 'C', 'D']

// ── Tiny icons ────────────────────────────────────────────────────────────────
const SearchIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
  </svg>
)
const CloseIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M18 6 6 18M6 6l12 12"/>
  </svg>
)
const EditIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
  </svg>
)
const PlusIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 5v14M5 12h14"/>
  </svg>
)
const ClockIcon = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>
  </svg>
)
const LayersIcon = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/>
  </svg>
)
const UsersIcon = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/>
    <path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
  </svg>
)
const CheckIcon = () => (
  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
    <path d="M20 6 9 17l-5-5"/>
  </svg>
)
const UploadIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
    <polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>
  </svg>
)
const WarnIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
    <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
  </svg>
)

// ── Upload preview table ──────────────────────────────────────────────────────
const UPLOAD_CHOICE_LABELS = ['A', 'B', 'C', 'D']
const UPLOAD_TYPE_LABELS   = { mcq: 'MCQ', truefalse: 'T/F', identification: 'IDENT' }
const UPLOAD_TYPE_COLORS   = {
  mcq:            'bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300',
  truefalse:      'bg-purple-100 dark:bg-purple-900 text-purple-700 dark:text-purple-300',
  identification: 'bg-amber-100 dark:bg-amber-900 text-amber-700 dark:text-amber-300',
}

function PreviewTable({ rows }) {
  return (
    <div className="border border-gray-100 dark:border-gray-800 rounded-xl overflow-hidden">
      <div className="overflow-x-auto max-h-52">
        <table className="w-full text-xs">
          <thead className="sticky top-0">
            <tr className="bg-gray-50 dark:bg-gray-800 border-b border-gray-100 dark:border-gray-800">
              {['#', 'Question', 'Type', 'Answer', 'Category'].map(h => (
                <th key={h} className="px-3 py-2 text-left text-gray-500 dark:text-gray-400 font-semibold">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i} className={`border-b border-gray-50 dark:border-gray-800 last:border-0 ${i % 2 ? 'bg-gray-50/50 dark:bg-gray-800/30' : ''}`}>
                <td className="px-3 py-2 text-gray-400">{i + 1}</td>
                <td className="px-3 py-2 text-gray-900 dark:text-white max-w-[180px] truncate">{r.question}</td>
                <td className="px-3 py-2">
                  <span className={`font-semibold px-2 py-0.5 rounded-full text-[10px] ${UPLOAD_TYPE_COLORS[r.type]}`}>
                    {UPLOAD_TYPE_LABELS[r.type]}
                  </span>
                </td>
                <td className="px-3 py-2 text-green-700 dark:text-green-300 font-semibold max-w-[100px] truncate">
                  {r.type === 'identification'
                    ? r.identAnswer
                    : r.type === 'truefalse'
                    ? (r.correctIdx === 0 ? 'True' : 'False')
                    : UPLOAD_CHOICE_LABELS[r.correctIdx]}
                </td>
                <td className="px-3 py-2 text-gray-500 dark:text-gray-400 max-w-[100px] truncate">{r.category}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function UploadErrors({ errors }) {
  if (!errors.length) return null
  return (
    <div className="bg-red-50 dark:bg-red-950/40 border border-red-100 dark:border-red-900 rounded-xl px-4 py-3 flex flex-col gap-1.5">
      <p className="text-xs font-semibold text-red-700 dark:text-red-300">
        {errors.length} row{errors.length > 1 ? 's' : ''} with issues (skipped):
      </p>
      {errors.map((e, i) => (
        <p key={i} className="text-xs text-red-600 dark:text-red-400">
          Row {e.rowNum}: {e.errors.join(' · ')}
        </p>
      ))}
    </div>
  )
}

// ── Question type badge ───────────────────────────────────────────────────────
function TypeBadge({ type }) {
  const m = TYPE_META[type] || { label: type, color: 'bg-gray-100 text-gray-600' }
  return (
    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full tracking-wide ${m.color}`}>
      {m.label}
    </span>
  )
}

// ── Single question display (inside drawer) ───────────────────────────────────
function QuestionCard({ q, index }) {
  const isMCQ   = q.question_type === 'mcq'
  const isTF    = q.question_type === 'truefalse'
  const isIdent = q.question_type === 'identification'

  const correctChoice = q.choices.find(c => c.is_correct)

  return (
    <div className="border border-gray-100 dark:border-gray-800 rounded-xl p-4 flex flex-col gap-3 bg-white dark:bg-gray-900">
      {/* Header row */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs font-semibold text-gray-400 dark:text-gray-500 w-5 shrink-0">
            {index + 1}.
          </span>
          <TypeBadge type={q.question_type} />
          {q.category && (
            <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400">
              {q.category.name}
            </span>
          )}
        </div>
      </div>

      {/* Question text */}
      <p className="text-sm text-gray-800 dark:text-gray-200 leading-relaxed pl-7">
        {q.question_text}
      </p>

      {/* Choices */}
      {(isMCQ || isTF) && q.choices.length > 0 && (
        <div className="pl-7 flex flex-col gap-1.5">
          {q.choices.filter(c => c.text).map((c, i) => (
            <div
              key={c.id}
              className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs transition-colors ${
                c.is_correct
                  ? 'bg-green-50 dark:bg-green-900/30 border border-green-200 dark:border-green-800 text-green-800 dark:text-green-300'
                  : 'bg-gray-50 dark:bg-gray-800/60 text-gray-600 dark:text-gray-400'
              }`}
            >
              {isMCQ && (
                <span className={`text-[10px] font-bold w-4 shrink-0 ${c.is_correct ? 'text-green-600 dark:text-green-400' : 'text-gray-400'}`}>
                  {CHOICE_LABELS[i]}
                </span>
              )}
              <span className="flex-1">{c.text}</span>
              {c.is_correct && (
                <span className="text-green-600 dark:text-green-400 shrink-0">
                  <CheckIcon />
                </span>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Identification answer */}
      {isIdent && correctChoice && (
        <div className="pl-7">
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-green-50 dark:bg-green-900/30 border border-green-200 dark:border-green-800">
            <span className="text-[10px] font-semibold text-green-600 dark:text-green-400 uppercase tracking-wide">Answer</span>
            <span className="text-xs text-green-800 dark:text-green-300 font-medium">{correctChoice.text}</span>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Assessment card ───────────────────────────────────────────────────────────
function AssessmentCard({ a, onClick }) {
  const created = new Date(a.created_at).toLocaleDateString('en-PH', {
    month: 'short', day: 'numeric', year: 'numeric'
  })

  return (
    <button
      onClick={onClick}
      className="w-full text-left bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-2xl p-5 flex flex-col gap-4 hover:border-gray-300 dark:hover:border-gray-600 hover:shadow-md transition-all active:scale-[0.99] group"
    >
      {/* Top row: title + status badge */}
      <div className="flex items-start justify-between gap-3">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-white leading-snug flex-1 group-hover:text-green-700 dark:group-hover:text-green-400 transition-colors">
          {a.title}
        </h3>
        <span className={`shrink-0 text-[10px] font-bold px-2.5 py-1 rounded-full tracking-wide ${
          a.is_active
            ? 'bg-green-100 dark:bg-green-900/50 text-green-700 dark:text-green-300'
            : 'bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400'
        }`}>
          {a.is_active ? 'Active' : 'Inactive'}
        </span>
      </div>

      {/* Batch + Duration */}
      <div className="flex flex-wrap items-center gap-2">
        {a.batch_name ? (
          <span className="text-[11px] font-medium px-2.5 py-1 rounded-full bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 border border-blue-100 dark:border-blue-900">
            {a.batch_name}
          </span>
        ) : (
          <span className="text-[11px] font-medium px-2.5 py-1 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400">
            No batch
          </span>
        )}
        <span className="flex items-center gap-1 text-[11px] text-gray-400 dark:text-gray-500">
          <ClockIcon /> {a.duration_minutes} min
        </span>
      </div>

      {/* Stats row */}
      <div className="flex items-center gap-4 pt-1 border-t border-gray-50 dark:border-gray-800">
        <span className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400">
          <LayersIcon />
          <span className="font-semibold text-gray-700 dark:text-gray-300">{a.question_count}</span> questions
        </span>
        <span className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400">
          <UsersIcon />
          <span className="font-semibold text-gray-700 dark:text-gray-300">{a.submission_count}</span> submitted
        </span>
        <span className="ml-auto text-[10px] text-gray-300 dark:text-gray-600">{created}</span>
      </div>
    </button>
  )
}

// ── Stat card ─────────────────────────────────────────────────────────────────
function StatCard({ label, value, accent }) {
  return (
    <div className={`bg-white dark:bg-gray-900 border rounded-2xl px-5 py-4 flex flex-col gap-1 ${accent}`}>
      <p className="text-2xl font-bold text-gray-900 dark:text-white">{value}</p>
      <p className="text-xs text-gray-500 dark:text-gray-400">{label}</p>
    </div>
  )
}

// ════════════════════════════════════════════════════════════════════════════
// MAIN PAGE
// ════════════════════════════════════════════════════════════════════════════
export default function InstructorAssessments() {
  const navigate = useNavigate()

  const cachedUser = (() => { try { return JSON.parse(localStorage.getItem('sb-user')) } catch { return null } })()
  const instructor = {
    name:     cachedUser?.name    || 'Instructor',
    initials: (cachedUser?.name   || 'IN').split(' ').map(n => n[0]).slice(0, 2).join(''),
    subject:  cachedUser?.course  || 'OJT Coordinator',
  }

  const {
    loadingList, filtered, stats, batchOptions,
    search, setSearch,
    filterBatch,  setFilterBatch,
    filterStatus, setFilterStatus,
    selected, questions, loadingQuestions, questionStats,
    openAssessment, closeAssessment,
    editMode, setEditMode,
    editTitle, setEditTitle,
    editDuration, setEditDuration,
    editActive, setEditActive,
    saving, handleSave,
    toast,
  } = useInstructorAssessments()

  // ── Upload modal ──────────────────────────────────────────────────────────//
  const [showUpload, setShowUpload] = useState(false)

  const upload = useAssessmentUpload({
    assessmentId: selected?.id,
    onSuccess: (result) => {
      setShowUpload(false)
      if (selected) openAssessment({ ...selected, question_count: result.total })
    },
  })

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      <InstructorNav instructor={instructor} activePath="/instructor/assessments" />

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-60 bg-gray-900 dark:bg-white text-white dark:text-gray-900 text-sm font-medium px-5 py-3 rounded-2xl shadow-xl animate-in fade-in slide-in-from-bottom-2 duration-200">
          {toast}
        </div>
      )}

      <main className="max-w-6xl mx-auto px-4 py-8 flex flex-col gap-6">

        {/* ── Page header ──────────────────────────────────────────────── */}
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-xl font-bold text-gray-900 dark:text-white">Assessments</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
              Review, edit, and manage all published assessments
            </p>
          </div>
          <button
            onClick={() => navigate('/instructor/assessment/create')}
            className="flex items-center gap-2 px-4 py-2.5 bg-green-600 hover:bg-green-700 active:bg-green-800 text-white text-sm font-semibold rounded-xl transition-colors shadow-sm"
          >
            <PlusIcon /> Create Assessment
          </button>
        </div>

        {/* ── Stats row ────────────────────────────────────────────────── */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <StatCard label="Total assessments" value={stats.total}       accent="border-gray-100 dark:border-gray-800" />
          <StatCard label="Active"             value={stats.active}      accent="border-green-100 dark:border-green-900/40" />
          <StatCard label="Total questions"    value={stats.questions}   accent="border-blue-100 dark:border-blue-900/40" />
          <StatCard label="Submissions"        value={stats.submissions} accent="border-purple-100 dark:border-purple-900/40" />
        </div>

        {/* ── Search + filters ─────────────────────────────────────────── */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Search */}
          <div className="relative flex-1 min-w-[200px]">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none">
              <SearchIcon />
            </span>
            <input
              type="text"
              placeholder="Search assessments…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2.5 text-sm bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-green-500/30 focus:border-green-500"
            />
          </div>

          {/* Batch filter */}
          <select
            value={filterBatch}
            onChange={e => setFilterBatch(e.target.value)}
            className="text-sm bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-2.5 text-gray-700 dark:text-gray-300 focus:outline-none focus:ring-2 focus:ring-green-500/30 focus:border-green-500"
          >
            <option value="all">All batches</option>
            {batchOptions.map(b => (
              <option key={b.id} value={b.id}>{b.name}</option>
            ))}
          </select>

          {/* Status filter */}
          <select
            value={filterStatus}
            onChange={e => setFilterStatus(e.target.value)}
            className="text-sm bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-2.5 text-gray-700 dark:text-gray-300 focus:outline-none focus:ring-2 focus:ring-green-500/30 focus:border-green-500"
          >
            <option value="all">All statuses</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
        </div>

        {/* ── Assessment grid ───────────────────────────────────────────── */}
        {loadingList ? (
          <div className="flex flex-col gap-3">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-32 bg-gray-100 dark:bg-gray-800 rounded-2xl animate-pulse" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-2xl p-12 text-center flex flex-col items-center gap-3">
            <div className="w-14 h-14 bg-gray-100 dark:bg-gray-800 rounded-2xl flex items-center justify-center">
              <LayersIcon />
            </div>
            <p className="text-sm font-semibold text-gray-700 dark:text-gray-300">
              {search || filterBatch !== 'all' || filterStatus !== 'all'
                ? 'No assessments match your filters'
                : 'No assessments published yet'}
            </p>
            <p className="text-xs text-gray-400 dark:text-gray-500">
              {!(search || filterBatch !== 'all' || filterStatus !== 'all') &&
                'Create your first assessment using the button above.'}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map(a => (
              <AssessmentCard key={a.id} a={a} onClick={() => openAssessment(a)} />
            ))}
          </div>
        )}
      </main>

      {/* ── Question review drawer ────────────────────────────────────────── */}
      {selected && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-black/30 backdrop-blur-sm z-40"
            onClick={closeAssessment}
          />

          {/* Drawer panel */}
          <div className="fixed right-0 top-0 h-full w-full max-w-xl bg-white dark:bg-gray-900 z-50 flex flex-col shadow-2xl border-l border-gray-100 dark:border-gray-800 overflow-hidden">

            {/* Drawer header */}
            <div className="px-6 py-4 border-b border-gray-100 dark:border-gray-800 flex flex-col gap-3 shrink-0">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  {editMode ? (
                    <input
                      autoFocus
                      value={editTitle}
                      onChange={e => setEditTitle(e.target.value)}
                      className="w-full text-base font-bold text-gray-900 dark:text-white bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-green-500/30"
                    />
                  ) : (
                    <h2 className="text-base font-bold text-gray-900 dark:text-white leading-tight truncate">
                      {selected.title}
                    </h2>
                  )}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {!editMode && (
                    <>
                      <button
                        onClick={() => { setShowUpload(true); upload.reset() }}
                        className="flex items-center gap-1.5 text-xs font-semibold text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white px-3 py-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                      >
                        <UploadIcon /> Add Questions
                      </button>
                      <button
                        onClick={() => setEditMode(true)}
                        className="flex items-center gap-1.5 text-xs font-semibold text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white px-3 py-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                      >
                        <EditIcon /> Edit
                      </button>
                    </>
                  )}
                  <button
                    onClick={closeAssessment}
                    className="p-2 rounded-lg text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                  >
                    <CloseIcon />
                  </button>
                </div>
              </div>

              {/* Meta row */}
              <div className="flex flex-wrap items-center gap-2">
                {selected.batch_name ? (
                  <span className="text-[11px] font-medium px-2.5 py-1 rounded-full bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 border border-blue-100 dark:border-blue-900">
                    {selected.batch_name}
                  </span>
                ) : (
                  <span className="text-[11px] px-2.5 py-1 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-500">No batch</span>
                )}

                {editMode ? (
                  <div className="flex items-center gap-1.5">
                    <ClockIcon />
                    <input
                      type="number"
                      min="1"
                      value={editDuration}
                      onChange={e => setEditDuration(e.target.value)}
                      className="w-16 text-xs text-gray-700 dark:text-gray-300 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-green-500/30"
                    />
                    <span className="text-xs text-gray-500">min</span>
                  </div>
                ) : (
                  <span className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400">
                    <ClockIcon /> {selected.duration_minutes} min
                  </span>
                )}

                {editMode ? (
                  <button
                    onClick={() => setEditActive(v => !v)}
                    className={`text-[11px] font-bold px-2.5 py-1 rounded-full transition-colors ${
                      editActive
                        ? 'bg-green-100 dark:bg-green-900/50 text-green-700 dark:text-green-300'
                        : 'bg-gray-100 dark:bg-gray-800 text-gray-500'
                    }`}
                  >
                    {editActive ? 'Active' : 'Inactive'} (tap to toggle)
                  </button>
                ) : (
                  <span className={`text-[11px] font-bold px-2.5 py-1 rounded-full ${
                    selected.is_active
                      ? 'bg-green-100 dark:bg-green-900/50 text-green-700 dark:text-green-300'
                      : 'bg-gray-100 dark:bg-gray-800 text-gray-500'
                  }`}>
                    {selected.is_active ? 'Active' : 'Inactive'}
                  </span>
                )}
              </div>

              {/* Question type breakdown */}
              {!loadingQuestions && questions.length > 0 && (
                <div className="flex items-center gap-2 flex-wrap">
                  {questionStats.mcq > 0 && (
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-900/60 text-blue-700 dark:text-blue-300">
                      {questionStats.mcq} MCQ
                    </span>
                  )}
                  {questionStats.truefalse > 0 && (
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-purple-100 dark:bg-purple-900/60 text-purple-700 dark:text-purple-300">
                      {questionStats.truefalse} T/F
                    </span>
                  )}
                  {questionStats.identification > 0 && (
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-900/60 text-amber-700 dark:text-amber-300">
                      {questionStats.identification} Identification
                    </span>
                  )}
                  <span className="text-xs text-gray-400 dark:text-gray-500 ml-auto">
                    {questions.length} total
                  </span>
                </div>
              )}

              {/* Edit action buttons */}
              {editMode && (
                <div className="flex items-center gap-2 pt-1">
                  <button
                    onClick={handleSave}
                    disabled={saving}
                    className="flex-1 py-2 rounded-xl bg-green-600 hover:bg-green-700 disabled:opacity-60 text-white text-sm font-semibold transition-colors"
                  >
                    {saving ? 'Saving…' : 'Save changes'}
                  </button>
                  <button
                    onClick={() => setEditMode(false)}
                    className="flex-1 py-2 rounded-xl bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 text-sm font-semibold transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              )}
            </div>

            {/* Scrollable question list */}
            <div className="flex-1 overflow-y-auto px-6 py-4">
              {loadingQuestions ? (
                <div className="flex flex-col gap-3">
                  {[...Array(4)].map((_, i) => (
                    <div key={i} className="h-24 bg-gray-100 dark:bg-gray-800 rounded-xl animate-pulse" />
                  ))}
                </div>
              ) : questions.length === 0 ? (
                <div className="text-center py-12">
                  <p className="text-sm text-gray-400 dark:text-gray-500">No questions found.</p>
                </div>
              ) : (
                <div className="flex flex-col gap-3 pb-6">
                  {questions.map((q, i) => (
                    <QuestionCard key={q.id} q={q} index={i} />
                  ))}
                </div>
              )}
            </div>
          </div>
        </>
      )}

      {/* ── Add Questions upload modal ───────────────────────────────────── */}
      {showUpload && selected && (
        <>
          <div
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-60"
            onClick={() => setShowUpload(false)}
          />
          <div className="fixed inset-x-0 bottom-0 sm:inset-auto sm:top-1/2 sm:left-1/2 sm:-translate-x-1/2 sm:-translate-y-1/2 w-full sm:w-[560px] max-h-[90vh] bg-white dark:bg-gray-900 rounded-t-3xl sm:rounded-2xl shadow-2xl z-70 flex flex-col overflow-hidden border border-gray-100 dark:border-gray-800">

            {/* Modal header */}
            <div className="px-6 py-4 border-b border-gray-100 dark:border-gray-800 flex items-start justify-between gap-3 shrink-0">
              <div>
                <h3 className="text-sm font-bold text-gray-900 dark:text-white">Add Questions</h3>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 truncate max-w-[360px]">
                  {selected.title}
                </p>
              </div>
              <button
                onClick={() => setShowUpload(false)}
                className="p-2 rounded-lg text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors shrink-0"
              >
                <CloseIcon />
              </button>
            </div>

            {/* Warning banner */}
            <div className="mx-6 mt-4 flex items-start gap-2.5 bg-amber-50 dark:bg-amber-900/30 border border-amber-200 dark:border-amber-800 rounded-xl px-4 py-3 shrink-0">
              <span className="text-amber-600 dark:text-amber-400 shrink-0 mt-0.5"><WarnIcon /></span>
              <p className="text-xs text-amber-800 dark:text-amber-300 leading-relaxed">
                New questions will be <strong>appended</strong> to the existing {selected.question_count} questions.
                All student submissions will be <strong>cleared</strong> so everyone retakes from scratch.
              </p>
            </div>

            {/* Tab switcher */}
            <div className="flex mx-6 mt-4 bg-gray-100 dark:bg-gray-800 rounded-xl p-1 shrink-0">
              {[{ key: 'excel', label: 'Excel / CSV' }, { key: 'text', label: 'Text file (.txt)' }].map(t => (
                <button
                  key={t.key}
                  onClick={() => upload.setTab(t.key)}
                  className={`flex-1 py-2 rounded-lg text-xs font-semibold transition-colors ${
                    upload.tab === t.key
                      ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm'
                      : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>

            {/* Scrollable body */}
            <div className="flex-1 overflow-y-auto px-6 py-4 flex flex-col gap-4">

              {/* Drop zone */}
              <div
                onDragOver={e => e.preventDefault()}
                onDrop={e => {
                  e.preventDefault()
                  const f = e.dataTransfer?.files?.[0]
                  if (!f) return
                  upload.tab === 'excel' ? upload.parseExcelQuestions(f) : upload.parseTxtFile(f)
                }}
                onClick={() => (upload.tab === 'excel' ? upload.xlsxRef : upload.txtRef).current?.click()}
                className="border-2 border-dashed border-gray-200 dark:border-gray-700 rounded-2xl p-8 flex flex-col items-center gap-3 cursor-pointer hover:border-green-400 hover:bg-green-50 dark:hover:bg-green-950/20 transition-colors"
              >
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" className="text-gray-300 dark:text-gray-700">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  <polyline points="14 2 14 8 20 8" stroke="currentColor" strokeWidth="1.5"/>
                  <line x1="12" y1="18" x2="12" y2="12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                  <polyline points="9 15 12 12 15 15" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                </svg>
                <div className="text-center">
                  <p className="text-sm font-medium text-gray-600 dark:text-gray-300">
                    {upload.tab === 'excel'
                      ? (upload.xlsxFileName || 'Drop your .xlsx or .csv here')
                      : (upload.txtFileName  || 'Drop your .txt file here')}
                  </p>
                  <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">or click to browse</p>
                </div>
                <input
                  ref={upload.xlsxRef}
                  type="file"
                  accept=".xlsx,.xls,.csv"
                  className="hidden"
                  onChange={e => { if (e.target.files?.[0]) upload.parseExcelQuestions(e.target.files[0]) }}
                />
                <input
                  ref={upload.txtRef}
                  type="file"
                  accept=".txt"
                  className="hidden"
                  onChange={e => { if (e.target.files?.[0]) upload.parseTxtFile(e.target.files[0]) }}
                />
              </div>

              {upload.activeLoading && (
                <p className="text-xs text-gray-400 text-center animate-pulse">Parsing file…</p>
              )}

              <UploadErrors errors={upload.activeErrors} />

              {upload.activeRows.length > 0 && (
                <div className="flex flex-col gap-2">
                  <p className="text-xs font-semibold text-gray-700 dark:text-gray-300">
                    {upload.activeRows.length} question{upload.activeRows.length > 1 ? 's' : ''} ready to add:
                  </p>
                  <PreviewTable rows={upload.activeRows} />
                </div>
              )}

              {upload.submitError && (
                <p className="text-xs text-red-600 dark:text-red-400 text-center">{upload.submitError}</p>
              )}
            </div>

            {/* Footer actions */}
            <div className="px-6 py-4 border-t border-gray-100 dark:border-gray-800 flex gap-3 shrink-0">
              <button
                onClick={() => setShowUpload(false)}
                className="flex-1 py-3 rounded-xl bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 text-sm font-semibold transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={upload.handleSubmit}
                disabled={upload.activeRows.length === 0 || upload.submitting}
                className="flex-1 py-3 rounded-xl bg-green-600 hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-semibold transition-colors"
              >
                {upload.submitting
                  ? 'Adding…'
                  : upload.activeRows.length > 0
                  ? `Add ${upload.activeRows.length} question${upload.activeRows.length > 1 ? 's' : ''}`
                  : 'Add Questions'}
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}