// src/pages/instructor/InstructorAssessments.jsx
//
// Assessment Library — browse, review, and fully edit all published assessments.
//
// Features:
//   • Summary stats (total, active, questions, submissions)
//   • Search by title or batch name + filter by batch / status
//   • Card grid — click any card to open the FULL EDIT MODAL
//
// Edit modal features:
//   • Edit assessment title (inline), duration, active toggle
//   • All questions shown as collapsible cards (collapsed by default)
//   • Per-question: edit text, change type (MCQ/T-F/Identification), edit choices,
//     mark correct answer, change skill category, delete question
//   • Add new questions: + Multiple Choice / + True/False / + Identification
//   • Expand All / Collapse All toggle for navigating 50-100 question assessments
//   • "Upload Questions" button → opens the existing bulk-file upload sub-modal
//   • Single "Save All Changes" → confirmation dialog → batch API calls
//   • Toast feedback on success / error

import { useState }                      from 'react'
import { useNavigate }                   from 'react-router-dom'
import InstructorNav                     from '../../components/instructor/InstructorNav'
import { useInstructorAssessments }      from '../../hooks/instructor/useInstructorAssessments'
import { useAssessmentUpload }           from '../../hooks/instructor/useAssessmentUpload'

// ── Type meta ─────────────────────────────────────────────────────────────────
const TYPE_META = {
  mcq:            { label: 'MCQ',   color: 'bg-blue-100 dark:bg-blue-900/60 text-blue-700 dark:text-blue-300'       },
  truefalse:      { label: 'T / F', color: 'bg-purple-100 dark:bg-purple-900/60 text-purple-700 dark:text-purple-300' },
  identification: { label: 'IDENT', color: 'bg-amber-100 dark:bg-amber-900/60 text-amber-700 dark:text-amber-300'   },
}
const CHOICE_LABELS = ['A', 'B', 'C', 'D']
const QUESTION_TYPES = [
  { key: 'mcq',            label: 'Multiple Choice' },
  { key: 'truefalse',      label: 'True / False'    },
  { key: 'identification', label: 'Identification'  },
]

// ── Icons ─────────────────────────────────────────────────────────────────────
const SearchIcon  = () => <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
const CloseIcon   = () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M18 6 6 18M6 6l12 12"/></svg>
const PlusIcon    = () => <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M12 5v14M5 12h14"/></svg>
const ClockIcon   = () => <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>
const LayersIcon  = () => <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/></svg>
const UsersIcon   = () => <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
const TrashIcon   = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
const UploadIcon  = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
const WarnIcon    = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
const ChevronIcon = ({ open }) => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"
    className={`transition-transform duration-200 ${open ? 'rotate-180' : ''}`}>
    <path d="M6 9l6 6 6-6"/>
  </svg>
)
const SaveIcon    = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>

// ── Upload sub-modal preview helpers ─────────────────────────────────────────
const UPLOAD_TYPE_COLORS = {
  mcq:            'bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300',
  truefalse:      'bg-purple-100 dark:bg-purple-900 text-purple-700 dark:text-purple-300',
  identification: 'bg-amber-100 dark:bg-amber-900 text-amber-700 dark:text-amber-300',
}
const UPLOAD_TYPE_LABELS = { mcq: 'MCQ', truefalse: 'T/F', identification: 'IDENT' }

function PreviewTable({ rows }) {
  return (
    <div className="border border-gray-100 dark:border-gray-800 rounded-xl overflow-hidden">
      <div className="overflow-x-auto max-h-48">
        <table className="w-full text-xs">
          <thead className="sticky top-0">
            <tr className="bg-gray-50 dark:bg-gray-800 border-b border-gray-100 dark:border-gray-800">
              {['#', 'Question', 'Type', 'Answer', 'Category'].map(h => (
                <th key={h} className="px-3 py-2 text-left text-gray-500 dark:text-gray-400 font-semibold whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i} className={`border-b border-gray-50 dark:border-gray-800 last:border-0 ${i % 2 ? 'bg-gray-50/50 dark:bg-gray-800/30' : ''}`}>
                <td className="px-3 py-2 text-gray-400">{i + 1}</td>
                <td className="px-3 py-2 text-gray-900 dark:text-white max-w-160px truncate">{r.question}</td>
                <td className="px-3 py-2">
                  <span className={`font-semibold px-2 py-0.5 rounded-full text-[10px] ${UPLOAD_TYPE_COLORS[r.type]}`}>
                    {UPLOAD_TYPE_LABELS[r.type]}
                  </span>
                </td>
                <td className="px-3 py-2 text-green-700 dark:text-green-300 font-semibold max-w-90px truncate">
                  {r.type === 'identification' ? r.identAnswer
                    : r.type === 'truefalse' ? (r.correctIdx === 0 ? 'True' : 'False')
                    : ['A','B','C','D'][r.correctIdx]}
                </td>
                <td className="px-3 py-2 text-gray-500 dark:text-gray-400 max-w-90px truncate">{r.category}</td>
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
    <div className="bg-red-50 dark:bg-red-950/40 border border-red-100 dark:border-red-900 rounded-xl px-4 py-3 flex flex-col gap-1">
      <p className="text-xs font-semibold text-red-700 dark:text-red-300">
        {errors.length} row{errors.length > 1 ? 's' : ''} with issues (skipped):
      </p>
      {errors.map((e, i) => (
        <p key={i} className="text-xs text-red-600 dark:text-red-400">Row {e.rowNum}: {e.errors.join(' · ')}</p>
      ))}
    </div>
  )
}

// ── Editable question card ────────────────────────────────────────────────────
function EditableQuestionCard({ q, index, categories, onUpdate, onChangeType, onUpdateChoice, onSetCorrect, onRemove }) {
  const typeMeta = TYPE_META[q.question_type] || TYPE_META.mcq

  const preview = q.question_text
    ? (q.question_text.length > 70 ? q.question_text.slice(0, 70) + '…' : q.question_text)
    : 'No question text yet…'

  return (
    <div
      id={`q_${q._tempId}`}
      className={`rounded-2xl overflow-hidden border transition-all ${
        q._isNew
          ? 'border-green-200 dark:border-green-800 shadow-sm shadow-green-100 dark:shadow-green-950'
          : 'border-gray-100 dark:border-gray-800'
      }`}
    >
      {/* ── Collapsed header ── always visible, click to expand */}
      <div
        role="button"
        onClick={() => onUpdate(q._tempId, { _expanded: !q._expanded })}
        className="flex items-center gap-3 px-4 py-3.5 bg-white dark:bg-gray-900 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/60 select-none transition-colors"
      >
        {/* Index */}
        <div className="w-6 h-6 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center text-xs font-bold text-gray-500 dark:text-gray-400 shrink-0">
          {index + 1}
        </div>

        {/* Type badge */}
        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full tracking-wide shrink-0 ${typeMeta.color}`}>
          {typeMeta.label}
          {q._isNew && <span className="ml-1 opacity-70">NEW</span>}
        </span>

        {/* Category pill — hidden on smallest screens */}
        {q.category && (
          <span className="hidden sm:inline text-[10px] font-medium px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 shrink-0">
            {q.category.name}
          </span>
        )}

        {/* Question preview */}
        <p className={`flex-1 text-sm truncate ${q.question_text ? 'text-gray-700 dark:text-gray-300' : 'text-gray-400 dark:text-gray-600 italic'}`}>
          {preview}
        </p>

        {/* Actions */}
        <div className="flex items-center gap-0.5 shrink-0">
          <button
            onClick={(e) => { e.stopPropagation(); onRemove(q._tempId) }}
            className="p-1.5 rounded-lg text-gray-300 dark:text-gray-700 hover:text-rose-500 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950 transition-colors"
            title="Remove question"
          >
            <TrashIcon />
          </button>
          <div className="p-1.5 text-gray-400 dark:text-gray-600">
            <ChevronIcon open={q._expanded} />
          </div>
        </div>
      </div>

      {/* ── Expanded edit body ── */}
      {q._expanded && (
        <div className="px-4 pb-5 pt-4 flex flex-col gap-5 border-t border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900">

          {/* QUESTION TYPE */}
          <div>
            <p className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-2">Question Type</p>
            <div className="flex flex-wrap gap-2">
              {QUESTION_TYPES.map(t => (
                <button
                  key={t.key}
                  onClick={() => onChangeType(q._tempId, t.key)}
                  className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold border transition-colors ${
                    q.question_type === t.key
                      ? 'bg-blue-600 border-blue-600 text-white shadow-sm'
                      : 'border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:border-blue-400 dark:hover:border-blue-600 hover:text-blue-700 dark:hover:text-blue-300'
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          {/* QUESTION TEXT */}
          <div>
            <p className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-1.5">Question</p>
            <textarea
              value={q.question_text}
              onChange={e => onUpdate(q._tempId, { question_text: e.target.value })}
              onClick={e => e.stopPropagation()}
              placeholder="Type the question here..."
              rows={2}
              className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-sm text-gray-900 dark:text-white resize-none outline-none focus:border-green-500 focus:bg-white dark:focus:bg-gray-900 transition-colors"
            />
          </div>

          {/* MCQ CHOICES */}
          {q.question_type === 'mcq' && (
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <p className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest">Answer Choices</p>
                <span className="text-[10px] text-gray-400 dark:text-gray-500">Click a letter to mark correct</span>
              </div>
              <div className="flex flex-col gap-2">
                {q.choices.map((choice, ci) => (
                  <div key={ci} className="flex items-center gap-2">
                    <button
                      onClick={() => onSetCorrect(q._tempId, ci)}
                      className={`w-7 h-7 rounded-lg text-xs font-bold shrink-0 transition-colors border ${
                        choice.is_correct
                          ? 'bg-green-600 border-green-600 text-white'
                          : 'border-gray-200 dark:border-gray-700 text-gray-400 dark:text-gray-500 hover:border-green-400 hover:text-green-600 dark:hover:text-green-400'
                      }`}
                      title={choice.is_correct ? 'Correct answer' : 'Mark as correct'}
                    >
                      {CHOICE_LABELS[ci]}
                    </button>
                    <input
                      type="text"
                      value={choice.text}
                      onChange={e => onUpdateChoice(q._tempId, ci, 'text', e.target.value)}
                      placeholder={`Choice ${CHOICE_LABELS[ci]}`}
                      className={`flex-1 px-3 py-2.5 rounded-xl border text-sm outline-none transition-colors text-gray-900 dark:text-white ${
                        choice.is_correct
                          ? 'border-green-400 dark:border-green-600 bg-green-50 dark:bg-green-950/50'
                          : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 focus:border-green-500'
                      }`}
                    />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TRUE / FALSE */}
          {q.question_type === 'truefalse' && (
            <div>
              <p className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-1.5">Correct Answer</p>
              <div className="flex gap-3">
                {[0, 1].map(ci => (
                  <button
                    key={ci}
                    onClick={() => onSetCorrect(q._tempId, ci)}
                    className={`flex-1 py-3 rounded-xl text-sm font-semibold border transition-colors ${
                      q.choices[ci]?.is_correct
                        ? 'bg-green-600 border-green-600 text-white shadow-sm'
                        : 'border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:border-green-400 dark:hover:border-green-600'
                    }`}
                  >
                    {ci === 0 ? 'True' : 'False'}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* IDENTIFICATION */}
          {q.question_type === 'identification' && (
            <div>
              <p className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-1.5">Correct Answer</p>
              <input
                type="text"
                value={q.identAnswer || ''}
                onChange={e => onUpdate(q._tempId, { identAnswer: e.target.value })}
                placeholder="Type the exact correct answer..."
                className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-sm text-gray-900 dark:text-white outline-none focus:border-green-500 focus:bg-white dark:focus:bg-gray-900 transition-colors"
              />
              <p className="text-[11px] text-gray-400 dark:text-gray-500 mt-1.5">Graded with case-insensitive matching.</p>
            </div>
          )}

          {/* SKILL CATEGORY */}
          <div>
            <p className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-1.5">Skill Category</p>
            {categories.length === 0 ? (
              <p className="text-xs text-amber-600 dark:text-amber-400 italic">No categories found.</p>
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {categories.map(cat => (
                  <button
                    key={cat.id}
                    onClick={() => onUpdate(q._tempId, { category: { id: cat.id, name: cat.name } })}
                    className={`text-xs font-medium px-3 py-1.5 rounded-full border transition-colors ${
                      (q.category?.id === cat.id || q.category?.name?.toLowerCase() === cat.name.toLowerCase())
                        ? 'bg-green-600 border-green-600 text-white'
                        : 'border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:border-green-400 hover:text-green-700 dark:hover:text-green-300'
                    }`}
                  >
                    {cat.name}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

// ── Assessment card (in the list) ─────────────────────────────────────────────
function AssessmentCard({ a, onClick }) {
  const created = new Date(a.created_at).toLocaleDateString('en-PH', {
    month: 'short', day: 'numeric', year: 'numeric',
  })
  return (
    <button
      onClick={onClick}
      className="w-full text-left bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-2xl p-5 flex flex-col gap-4 hover:border-gray-300 dark:hover:border-gray-600 hover:shadow-md transition-all active:scale-[0.99] group"
    >
      <div className="flex items-start justify-between gap-3">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-white leading-snug flex-1 group-hover:text-green-700 dark:group-hover:text-green-400 transition-colors">
          {a.title}
        </h3>
        <span className={`shrink-0 text-[10px] font-bold px-2.5 py-1 rounded-full ${
          a.is_active
            ? 'bg-green-100 dark:bg-green-900/50 text-green-700 dark:text-green-300'
            : 'bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400'
        }`}>
          {a.is_active ? 'Active' : 'Inactive'}
        </span>
      </div>
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
    name:     cachedUser?.name   || 'Instructor',
    initials: (cachedUser?.name  || 'IN').split(' ').map(n => n[0]).slice(0, 2).join(''),
    subject:  cachedUser?.course || 'OJT Coordinator',
  }

  const {
    loadingList, filtered, stats, batchOptions,
    search, setSearch,
    filterBatch, setFilterBatch, filterStatus, setFilterStatus,
    selected, loadingQuestions,
    openAssessment, closeAssessment,
    editTitle, setEditTitle,
    editDuration, setEditDuration,
    editActive, setEditActive,
    visibleQuestions, questionStats, categories,
    expandAll, collapseAll, allExpanded,
    updateQuestion, changeQuestionType, updateChoice, setCorrectChoice,
    addQuestion, removeQuestion,
    showSaveConfirm, setShowSaveConfirm,
    saving, saveAllChanges,
    toast,
  } = useInstructorAssessments()

  // ── Upload sub-modal (existing bulk file upload) ──────────────────────────
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

      {/* Global toast */}
      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-200 bg-gray-900 dark:bg-white text-white dark:text-gray-900 text-sm font-medium px-5 py-3 rounded-2xl shadow-xl pointer-events-none">
          {toast}
        </div>
      )}

      <main className="max-w-6xl mx-auto px-4 py-8 flex flex-col gap-6">

        {/* ── Page header ──────────────────────────────────────────────────── */}
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-xl font-bold text-gray-900 dark:text-white">Assessments</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">Review, edit, and manage all published assessments</p>
          </div>
          <button
            onClick={() => navigate('/instructor/assessment/create')}
            className="flex items-center gap-2 px-4 py-2.5 bg-green-600 hover:bg-green-700 active:bg-green-800 text-white text-sm font-semibold rounded-xl transition-colors shadow-sm"
          >
            <PlusIcon /> Create Assessment
          </button>
        </div>

        {/* ── Stats ────────────────────────────────────────────────────────── */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <StatCard label="Total assessments" value={stats.total}       accent="border-gray-100 dark:border-gray-800" />
          <StatCard label="Active"             value={stats.active}      accent="border-green-100 dark:border-green-900/40" />
          <StatCard label="Total questions"    value={stats.questions}   accent="border-blue-100 dark:border-blue-900/40" />
          <StatCard label="Submissions"        value={stats.submissions} accent="border-purple-100 dark:border-purple-900/40" />
        </div>

        {/* ── Filters ──────────────────────────────────────────────────────── */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative flex-1 min-w-180px">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"><SearchIcon /></span>
            <input
              type="text"
              placeholder="Search assessments…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2.5 text-sm bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-green-500/30 focus:border-green-500"
            />
          </div>
          <select value={filterBatch} onChange={e => setFilterBatch(e.target.value)}
            className="text-sm bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-2.5 text-gray-700 dark:text-gray-300 focus:outline-none focus:ring-2 focus:ring-green-500/30">
            <option value="all">All batches</option>
            {batchOptions.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select>
          <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
            className="text-sm bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-2.5 text-gray-700 dark:text-gray-300 focus:outline-none focus:ring-2 focus:ring-green-500/30">
            <option value="all">All statuses</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
        </div>

        {/* ── Assessment grid ───────────────────────────────────────────────── */}
        {loadingList ? (
          <div className="flex flex-col gap-3">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-32 bg-gray-100 dark:bg-gray-800 rounded-2xl animate-pulse" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-2xl p-12 text-center flex flex-col items-center gap-3">
            <div className="w-14 h-14 bg-gray-100 dark:bg-gray-800 rounded-2xl flex items-center justify-center text-gray-400 dark:text-gray-600">
              <LayersIcon />
            </div>
            <p className="text-sm font-semibold text-gray-700 dark:text-gray-300">
              {search || filterBatch !== 'all' || filterStatus !== 'all'
                ? 'No assessments match your filters'
                : 'No assessments published yet'}
            </p>
            {!(search || filterBatch !== 'all' || filterStatus !== 'all') && (
              <p className="text-xs text-gray-400 dark:text-gray-500">Create your first assessment using the button above.</p>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map(a => (
              <AssessmentCard key={a.id} a={a} onClick={() => openAssessment(a)} />
            ))}
          </div>
        )}
      </main>

      {/* ════════════════════════════════════════════════════════════════════
          FULL EDIT MODAL
          Mobile: fixed inset-0 (full screen)
          Desktop (sm+): centered with margins, max-w-4xl, max-h-[92vh]
      ════════════════════════════════════════════════════════════════════ */}
      {selected && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm sm:p-4">
          <div className="relative w-full h-[95dvh] sm:h-auto sm:max-h-[92vh] sm:max-w-4xl bg-white dark:bg-gray-900 sm:rounded-2xl flex flex-col overflow-hidden shadow-2xl border-0 sm:border border-gray-100 dark:border-gray-800">

            {/* ── Modal header ─────────────────────────────────────────── */}
            <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-800 flex flex-col gap-3 shrink-0 bg-white dark:bg-gray-900">
              <div className="flex items-start justify-between gap-3">
                {/* Editable title */}
                <div className="flex-1 min-w-0">
                  <input
                    value={editTitle}
                    onChange={e => setEditTitle(e.target.value)}
                    placeholder="Assessment title"
                    className="w-full text-base font-bold text-gray-900 dark:text-white bg-transparent border-0 border-b-2 border-transparent focus:border-green-500 outline-none pb-0.5 transition-colors"
                  />
                </div>
                {/* Upload + Close */}
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => { setShowUpload(true); upload.reset() }}
                    className="hidden sm:flex items-center gap-1.5 text-xs font-semibold text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white px-3 py-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                  >
                    <UploadIcon /> Upload Questions
                  </button>
                  <button
                    onClick={closeAssessment}
                    className="p-2 rounded-lg text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                    title="Close without saving"
                  >
                    <CloseIcon />
                  </button>
                </div>
              </div>

              {/* Meta row: duration | batch | active toggle */}
              <div className="flex flex-wrap items-center gap-3">
                <div className="flex items-center gap-1.5">
                  <ClockIcon />
                  <input
                    type="number" min="1"
                    value={editDuration}
                    onChange={e => setEditDuration(e.target.value)}
                    className="w-14 text-xs text-gray-700 dark:text-gray-300 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg px-2 py-1 focus:outline-none focus:ring-1 focus:ring-green-500"
                  />
                  <span className="text-xs text-gray-500 dark:text-gray-400">min</span>
                </div>
                {selected.batch_name && (
                  <span className="text-[11px] font-medium px-2.5 py-1 rounded-full bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 border border-blue-100 dark:border-blue-900">
                    {selected.batch_name}
                  </span>
                )}
                <button
                  onClick={() => setEditActive(v => !v)}
                  className={`text-[11px] font-bold px-3 py-1 rounded-full transition-colors ${
                    editActive
                      ? 'bg-green-100 dark:bg-green-900/50 text-green-700 dark:text-green-300'
                      : 'bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400'
                  }`}
                >
                  {editActive ? '● Active' : '○ Inactive'} — tap to toggle
                </button>
                {/* Mobile upload button */}
                <button
                  onClick={() => { setShowUpload(true); upload.reset() }}
                  className="flex sm:hidden items-center gap-1.5 text-xs font-semibold text-gray-500 dark:text-gray-400 px-2.5 py-1.5 rounded-lg bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
                >
                  <UploadIcon /> Upload
                </button>
              </div>

              {/* Stats + expand/collapse toggle */}
              {!loadingQuestions && visibleQuestions.length > 0 && (
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
                  <span className="text-xs text-gray-400 dark:text-gray-500 font-medium">
                    {visibleQuestions.length} total
                  </span>
                  <button
                    onClick={allExpanded ? collapseAll : expandAll}
                    className="ml-auto text-xs text-gray-500 dark:text-gray-400 hover:text-green-600 dark:hover:text-green-400 transition-colors font-medium"
                  >
                    {allExpanded ? 'Collapse all ↑' : 'Expand all ↓'}
                  </button>
                </div>
              )}
            </div>

            {/* ── Scrollable question list ──────────────────────────────── */}
            <div className="flex-1 overflow-y-auto px-5 py-5 bg-gray-50 dark:bg-gray-950">
              {loadingQuestions ? (
                <div className="flex flex-col gap-3">
                  {[...Array(5)].map((_, i) => (
                    <div key={i} className="h-14 bg-gray-100 dark:bg-gray-800 rounded-2xl animate-pulse" />
                  ))}
                </div>
              ) : (
                <div className="flex flex-col gap-3">
                  {visibleQuestions.length === 0 && (
                    <div className="text-center py-12">
                      <p className="text-sm text-gray-400 dark:text-gray-500">No questions yet. Add some below.</p>
                    </div>
                  )}

                  {visibleQuestions.map((q, i) => (
                    <EditableQuestionCard
                      key={q._tempId}
                      q={q}
                      index={i}
                      categories={categories}
                      onUpdate={updateQuestion}
                      onChangeType={changeQuestionType}
                      onUpdateChoice={updateChoice}
                      onSetCorrect={setCorrectChoice}
                      onRemove={removeQuestion}
                    />
                  ))}

                  {/* Add question buttons */}
                  <div className="flex flex-col sm:flex-row gap-2 mt-2 pb-2">
                    {[
                      { type: 'mcq',            label: '+ Add Multiple Choice' },
                      { type: 'truefalse',       label: '+ Add True / False'   },
                      { type: 'identification',  label: '+ Add Identification'  },
                    ].map(t => (
                      <button
                        key={t.type}
                        onClick={() => addQuestion(t.type)}
                        className="flex-1 py-3 rounded-2xl border-2 border-dashed border-gray-200 dark:border-gray-700 text-sm text-gray-400 dark:text-gray-500 hover:border-green-400 hover:text-green-600 dark:hover:text-green-400 hover:bg-green-50 dark:hover:bg-green-950/30 transition-colors"
                      >
                        {t.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* ── Footer ───────────────────────────────────────────────── */}
            <div className="px-5 py-4 border-t border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 flex items-center gap-3 shrink-0">
              <p className="hidden sm:block text-xs text-gray-400 dark:text-gray-500 flex-1">
                Changes are not saved until you click "Save All Changes".
              </p>
              <button
                onClick={closeAssessment}
                className="px-5 py-3 rounded-xl bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 text-sm font-semibold transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => setShowSaveConfirm(true)}
                disabled={saving || loadingQuestions}
                className="flex items-center gap-2 px-5 py-3 rounded-xl bg-green-600 hover:bg-green-700 active:bg-green-800 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-semibold transition-colors shadow-sm"
              >
                <SaveIcon />
                {saving ? 'Saving…' : 'Save All Changes'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Save confirmation dialog (z-60, above main modal) ──────────────── */}
      {showSaveConfirm && (
        <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/60 backdrop-blur-sm px-4">
          <div className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-2xl p-6 w-full max-w-sm shadow-2xl">
            <div className="w-12 h-12 bg-amber-50 dark:bg-amber-950/50 rounded-2xl flex items-center justify-center mb-4 text-amber-500">
              <WarnIcon />
            </div>
            <h3 className="text-sm font-bold text-gray-900 dark:text-white mb-2">Save all changes?</h3>
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-5 leading-relaxed">
              This will update the assessment metadata, edited questions, and any new or deleted questions.
              Students who have already submitted <strong>will not be affected</strong>.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowSaveConfirm(false)}
                className="flex-1 py-3 rounded-xl bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 text-sm font-semibold transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={saveAllChanges}
                disabled={saving}
                className="flex-1 py-3 rounded-xl bg-green-600 hover:bg-green-700 disabled:opacity-60 text-white text-sm font-semibold transition-colors"
              >
                {saving ? 'Saving…' : 'Confirm Save'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Upload Questions sub-modal (z-70, topmost) ─────────────────────── */}
      {showUpload && selected && (
        <>
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-70" onClick={() => setShowUpload(false)} />
          <div className="fixed inset-x-0 bottom-0 sm:inset-auto sm:top-1/2 sm:left-1/2 sm:-translate-x-1/2 sm:-translate-y-1/2 w-full sm:w-560px max-h-[90dvh] bg-white dark:bg-gray-900 rounded-t-3xl sm:rounded-2xl shadow-2xl z-80 flex flex-col overflow-hidden border-0 sm:border border-gray-100 dark:border-gray-800">

            {/* Upload modal header */}
            <div className="px-6 py-4 border-b border-gray-100 dark:border-gray-800 flex items-start justify-between gap-3 shrink-0">
              <div>
                <h3 className="text-sm font-bold text-gray-900 dark:text-white">Upload Questions</h3>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 truncate max-w-360px">
                  Appending to: {selected.title}
                </p>
              </div>
              <button onClick={() => setShowUpload(false)} className="p-2 rounded-lg text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
                <CloseIcon />
              </button>
            </div>

            {/* Warning */}
            <div className="mx-6 mt-4 flex items-start gap-2.5 bg-amber-50 dark:bg-amber-900/30 border border-amber-200 dark:border-amber-800 rounded-xl px-4 py-3 shrink-0">
              <span className="text-amber-600 dark:text-amber-400 shrink-0 mt-0.5"><WarnIcon /></span>
              <p className="text-xs text-amber-800 dark:text-amber-300 leading-relaxed">
                New questions will be <strong>appended</strong> to the existing {selected.question_count} questions. Student submissions will be <strong>cleared</strong> so everyone retakes from scratch.
              </p>
            </div>

            {/* Tab switcher */}
            <div className="flex mx-6 mt-4 bg-gray-100 dark:bg-gray-800 rounded-xl p-1 shrink-0">
              {[{ key: 'excel', label: 'Excel / CSV' }, { key: 'text', label: 'Text file (.txt)' }].map(t => (
                <button key={t.key} onClick={() => upload.setTab(t.key)}
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

            {/* Upload body */}
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
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
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
                <input ref={upload.xlsxRef} type="file" accept=".xlsx,.xls,.csv" className="hidden"
                  onChange={e => { if (e.target.files?.[0]) upload.parseExcelQuestions(e.target.files[0]) }} />
                <input ref={upload.txtRef}  type="file" accept=".txt" className="hidden"
                  onChange={e => { if (e.target.files?.[0]) upload.parseTxtFile(e.target.files[0]) }} />
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

            {/* Upload footer */}
            <div className="px-6 py-4 border-t border-gray-100 dark:border-gray-800 flex gap-3 shrink-0">
              <button onClick={() => setShowUpload(false)}
                className="flex-1 py-3 rounded-xl bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 text-sm font-semibold transition-colors">
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