// src/components/instructor/StudentModal.jsx
//
// Full student detail panel: skill breakdown, suggestions, retake toggle.
// Extracted from EnrolledStudents.jsx.
//
// Props:
//   student         — student object { name, studentId, course, email, status, scores, retakeAllowed }
//   isArchived      — bool — hides retake toggle if batch is archived
//   onClose         — close handler
//   onToggleRetake(studentId) — toggle retake permission

import {
  XIcon, RefreshIcon,
  CheckCircleIcon, WarnIcon, CrossCircleIcon,
  StarIcon, AlertTriangleIcon, LightbulbIcon, SparkleIcon, ClockIcon,
} from '../Icons'
import {
  avg, topSkill, bottomSkill, scoreColor, scoreBg, tierLabel,
} from '../../utils/formatters'
import { getInitials } from '../../utils/formatters'

const CATEGORIES = ['Web Development', 'Database', 'Design', 'Networking', 'Backend']

const SUGGESTIONS = {
  'Web Development': 'Review HTML, CSS, and JavaScript fundamentals. Practice building simple responsive layouts.',
  'Database':        'Reinforce SQL query writing — focus on JOINs, GROUP BY, and subqueries. Try SQLZoo or W3Schools SQL.',
  'Design':          'Study UI/UX design principles: color theory, typography, spacing, and component hierarchy.',
  'Networking':      'Review the OSI model, IP addressing, subnetting, and common network protocols (TCP/IP, DNS, HTTP).',
  'Backend':         'Strengthen server-side programming concepts: REST APIs, request/response cycles, and authentication.',
}
function getSuggestion(cat) {
  return SUGGESTIONS[cat] || `Focus on strengthening ${cat} skills through practice exercises and review materials.`
}

export default function StudentModal({ student, isArchived, onClose, onToggleRetake }) {
  const overall = avg(student.scores || {})
  const top     = topSkill(student.scores || {})
  const bottom  = bottomSkill(student.scores || {})
  const gaps    = Object.entries(student.scores || {}).filter(([, v]) => v < 60)
  const tier    = overall !== null ? tierLabel(overall) : null

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm px-0 sm:px-4 pb-0"
      onClick={e => e.target === e.currentTarget && onClose()}
    >
      <div
        className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-t-3xl sm:rounded-2xl shadow-2xl w-full sm:max-w-2xl flex flex-col max-h-[92vh] overflow-hidden"
        style={{ animation: 'modalIn 0.26s cubic-bezier(0.34,1.1,0.64,1) both' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-gray-800 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-linear-to-br from-green-400 to-emerald-600 flex items-center justify-center text-white text-sm font-bold shrink-0 shadow">
              {getInitials(student.name)}
            </div>
            <div>
              <h2 className="text-sm font-bold text-gray-900 dark:text-white leading-tight">{student.name}</h2>
              <p className="text-xs text-gray-400 dark:text-gray-500 font-mono">{student.studentId} · {student.course}</p>
            </div>
          </div>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-xl text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
            <XIcon size={16} />
          </button>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto">

          {/* Identity strip */}
          <div className="px-6 py-4 border-b border-gray-50 dark:border-gray-800 flex flex-wrap items-center gap-2">
            <p className="text-xs text-gray-400 dark:text-gray-500 truncate flex-1">{student.email}</p>
            <div className="flex items-center gap-2 shrink-0">
              <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300">{student.course}</span>
              {student.status === 'completed'
                ? <span className="inline-flex items-center gap-1 text-xs font-medium text-green-700 dark:text-green-300 bg-green-100 dark:bg-green-900 px-2.5 py-0.5 rounded-full"><span className="w-1.5 h-1.5 rounded-full bg-green-500"/>Assessment Done</span>
                : <span className="inline-flex items-center gap-1 text-xs font-medium text-amber-700 dark:text-amber-300 bg-amber-100 dark:bg-amber-900 px-2.5 py-0.5 rounded-full"><span className="w-1.5 h-1.5 rounded-full bg-amber-500"/>Pending</span>
              }
            </div>
          </div>

          {student.status === 'completed' ? (
            <div className="p-6 flex flex-col gap-6">

              {/* Overall + category breakdown */}
              <div className="grid grid-cols-1 sm:grid-cols-5 gap-4">
                <div className="sm:col-span-2 bg-gray-50 dark:bg-gray-800 rounded-2xl p-5 flex flex-col justify-between">
                  <div className="flex items-center justify-between mb-4">
                    <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Overall</p>
                    {tier && <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${tier.cls}`}>{tier.text}</span>}
                  </div>
                  <div>
                    <div className="flex items-end gap-1 mb-3">
                      <span className={`text-6xl font-black leading-none ${scoreColor(overall)}`}>{overall}</span>
                      <span className="text-2xl font-bold text-gray-300 dark:text-gray-600 mb-1">%</span>
                    </div>
                    <div className="h-2.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                      <div className={`h-full rounded-full ${scoreBg(overall)}`} style={{ width: `${overall}%` }} />
                    </div>
                  </div>
                </div>

                <div className="sm:col-span-3 flex flex-col gap-2.5">
                  <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Skill Breakdown</p>
                  {CATEGORIES.map(cat => {
                    const sc = student.scores[cat] ?? null
                    const StatusIcon = sc >= 80 ? CheckCircleIcon : sc >= 60 ? WarnIcon : CrossCircleIcon
                    return (
                      <div key={cat} className={`px-3 py-2.5 rounded-xl border ${
                        sc < 60  ? 'border-rose-200 dark:border-rose-900 bg-rose-50 dark:bg-rose-950/30'
                        : sc < 80 ? 'border-amber-100 dark:border-amber-900 bg-amber-50/50 dark:bg-amber-950/20'
                        : 'border-green-100 dark:border-green-900 bg-green-50/50 dark:bg-green-950/20'
                      }`}>
                        <div className="flex items-center gap-2 mb-1.5">
                          <StatusIcon />
                          <span className="text-xs font-medium text-gray-700 dark:text-gray-300 flex-1">{cat}</span>
                          {sc < 60 && <span className="text-xs font-semibold text-rose-600 dark:text-rose-400 bg-rose-100 dark:bg-rose-900 px-2 py-0.5 rounded-full">Needs improvement</span>}
                          <span className={`text-xs font-bold ${scoreColor(sc)}`}>{sc}%</span>
                        </div>
                        <div className="h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                          <div className={`h-full rounded-full ${scoreBg(sc)}`} style={{ width: `${sc}%` }} />
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* Strongest / Weakest */}
              <div className="grid grid-cols-2 gap-3">
                {top && (
                  <div className="bg-green-50 dark:bg-green-950/40 border border-green-100 dark:border-green-900 rounded-xl p-4">
                    <div className="flex items-center gap-1.5 mb-2"><StarIcon /><p className="text-xs font-semibold text-green-700 dark:text-green-400">Strongest skill</p></div>
                    <p className="text-sm font-bold text-gray-900 dark:text-white">{top[0]}</p>
                    <p className={`text-xl font-black mt-0.5 ${scoreColor(top[1])}`}>{top[1]}%</p>
                  </div>
                )}
                {bottom && (
                  <div className="bg-rose-50 dark:bg-rose-950/40 border border-rose-100 dark:border-rose-900 rounded-xl p-4">
                    <div className="flex items-center gap-1.5 mb-2"><AlertTriangleIcon /><p className="text-xs font-semibold text-rose-700 dark:text-rose-400">Weakest skill</p></div>
                    <p className="text-sm font-bold text-gray-900 dark:text-white">{bottom[0]}</p>
                    <p className={`text-xl font-black mt-0.5 ${scoreColor(bottom[1])}`}>{bottom[1]}%</p>
                  </div>
                )}
              </div>

              {/* Suggestions */}
              {gaps.length > 0 ? (
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <LightbulbIcon />
                    <p className="text-xs font-semibold text-amber-700 dark:text-amber-400 uppercase tracking-wider">Instructor Suggestions</p>
                  </div>
                  <div className="flex flex-col gap-2">
                    {gaps.map(([cat, sc]) => (
                      <div key={cat} className="bg-amber-50 dark:bg-amber-950/30 border border-amber-100 dark:border-amber-900 rounded-xl px-4 py-3">
                        <p className="text-xs font-bold text-amber-800 dark:text-amber-300 mb-1">{cat} <span className="font-normal text-amber-600 dark:text-amber-500">({sc}%)</span></p>
                        <p className="text-xs text-gray-600 dark:text-gray-400 leading-relaxed">{getSuggestion(cat)}</p>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="bg-green-50 dark:bg-green-950/40 border border-green-100 dark:border-green-900 rounded-2xl px-5 py-4 flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-green-100 dark:bg-green-900 flex items-center justify-center shrink-0"><SparkleIcon /></div>
                  <div>
                    <p className="text-sm font-bold text-green-800 dark:text-green-300">No weak areas!</p>
                    <p className="text-xs text-green-700 dark:text-green-400 mt-0.5">This student passed all categories above 60%. Great performance overall.</p>
                  </div>
                </div>
              )}
            </div>
          ) : (
            /* Pending state */
            <div className="flex flex-col items-center gap-4 py-14 px-6">
              <div className="w-20 h-20 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border-2 border-dashed border-amber-200 dark:border-amber-800 flex items-center justify-center text-amber-400 dark:text-amber-600">
                <ClockIcon />
              </div>
              <div className="text-center">
                <p className="text-sm font-semibold text-gray-700 dark:text-gray-300">No assessment data yet</p>
                <p className="text-xs text-gray-400 dark:text-gray-500 mt-1 max-w-xs leading-relaxed">This student hasn't completed the assessment. Results will appear here once submitted.</p>
              </div>
            </div>
          )}
        </div>

        {/* Footer — Retake toggle */}
        {!isArchived && student.status === 'completed' && (
          <div className="shrink-0 border-t border-gray-100 dark:border-gray-800 px-6 py-4 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
                student.retakeAllowed ? 'bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-400' : 'bg-gray-100 dark:bg-gray-800 text-gray-400 dark:text-gray-600'
              }`}>
                <RefreshIcon />
              </div>
              <div>
                <p className="text-xs font-semibold text-gray-700 dark:text-gray-300">Allow Retake</p>
                <p className="text-xs text-gray-400 dark:text-gray-500">{student.retakeAllowed ? 'Student can retake the assessment' : 'Retake not allowed yet'}</p>
              </div>
            </div>
            <button
              onClick={() => onToggleRetake(student.id)}
              className={`relative w-11 h-6 rounded-full transition-colors shrink-0 ${student.retakeAllowed ? 'bg-blue-600' : 'bg-gray-200 dark:bg-gray-700'}`}
            >
              <span className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full shadow transition-transform ${student.retakeAllowed ? 'translate-x-5' : 'translate-x-0'}`} />
            </button>
          </div>
        )}
        {isArchived && (
          <div className="shrink-0 border-t border-amber-100 dark:border-amber-900 bg-amber-50 dark:bg-amber-950/40 px-6 py-3">
            <p className="text-xs text-amber-700 dark:text-amber-400 font-medium">This student belongs to an archived batch — data is read-only.</p>
          </div>
        )}
      </div>

      <style>{`
        @keyframes modalIn {
          from { transform: translateY(32px) scale(0.97); opacity: 0; }
          to   { transform: translateY(0)    scale(1);    opacity: 1; }
        }
        @media (max-width: 639px) {
          @keyframes modalIn {
            from { transform: translateY(100%); opacity: 0.8; }
            to   { transform: translateY(0);    opacity: 1; }
          }
        }
      `}</style>
    </div>
  )
}
