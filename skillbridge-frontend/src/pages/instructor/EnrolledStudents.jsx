// src/pages/instructor/EnrolledStudents.jsx
// Wired to real API (Week 4):
//   GET    /api/instructor/batches/              → list batches + students
//   POST   /api/instructor/batches/              → create new batch
//   POST   /api/instructor/batches/{id}/enroll/  → enroll students
//   PATCH  /api/instructor/students/{id}/retake/ → toggle retake
//   DELETE /api/instructor/students/{id}/        → remove student

import { useState, useMemo, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../../api/axios'

const CATEGORIES = ['Web Development', 'Database', 'Design', 'Networking', 'Backend']
const PAGE_SIZE  = 10
// Fallback batches shown before API loads
const FALLBACK_BATCHES = []

// Helper: derive initials from a full name string
function getInitials(name = '') {
  return name.split(' ').map(n => n[0]).filter(Boolean).slice(0, 2).join('').toUpperCase() || 'IN'
}

// ── Helpers ───────────────────────────────────────────────────────
function avg(scores) {
  const v = Object.values(scores); if (!v.length) return null
  return Math.round(v.reduce((a, b) => a + b, 0) / v.length)
}
function topSkill(scores) {
  const e = Object.entries(scores); if (!e.length) return null
  return e.reduce((a, b) => b[1] > a[1] ? b : a)
}
function bottomSkill(scores) {
  const e = Object.entries(scores); if (!e.length) return null
  return e.reduce((a, b) => b[1] < a[1] ? b : a)
}
function scoreColor(p) {
  if (p === null) return 'text-gray-300 dark:text-gray-700'
  if (p >= 80) return 'text-green-600 dark:text-green-400'
  if (p >= 60) return 'text-amber-600 dark:text-amber-400'
  return 'text-rose-500 dark:text-rose-400'
}
function scoreBg(p) { return p >= 80 ? 'bg-green-600' : p >= 60 ? 'bg-amber-500' : 'bg-rose-500' }
function ini(name) { return name.split(' ').map(n => n[0]).slice(0, 2).join('') }
function tierLabel(p) {
  if (p >= 80) return { text: 'Strong', cls: 'text-green-700 dark:text-green-300 bg-green-100 dark:bg-green-900' }
  if (p >= 60) return { text: 'Fair', cls: 'text-amber-700 dark:text-amber-300 bg-amber-100 dark:bg-amber-900' }
  return { text: 'Needs Work', cls: 'text-rose-700 dark:text-rose-300 bg-rose-100 dark:bg-rose-900' }
}

// ── Auto-suggestion map per category ─────────────────────────────
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

// Extract name from DNSC email: lastname.firstname@dnsc.edu.ph → "Firstname Lastname"
function nameFromEmail(email) {
  const local = email.split('@')[0]           // e.g. "villanueva.azel"
  const parts = local.split('.')              // ["villanueva", "azel"]
  const cap   = s => s.charAt(0).toUpperCase() + s.slice(1).toLowerCase()
  if (parts.length >= 2) return `${cap(parts[1])} ${cap(parts[0])}`  // "Azel Villanueva"
  return cap(parts[0])                        // fallback: just capitalise what we have
}

// ── Shared icons ──────────────────────────────────────────────────
const TrashIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
    <path d="M10 11v6M14 11v6M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
  </svg>
)
const XIcon = ({ size = 14 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
    <path d="M18 6L6 18M6 6l12 12"/>
  </svg>
)
const MenuIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
    <path d="M3 12h18M3 6h18M3 18h18"/>
  </svg>
)

// ── Score status icons (no emojis) ────────────────────────────────
const CheckCircleIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10"/><path d="M8 12l3 3 5-5"/>
  </svg>
)
const WarnIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#d97706" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
  </svg>
)
const CrossCircleIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#e11d48" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10"/><path d="M15 9l-6 6M9 9l6 6"/>
  </svg>
)
const StarIcon = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
  </svg>
)
const AlertTriangleIcon = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#e11d48" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
  </svg>
)
const LightbulbIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M9 18h6M10 22h4M12 2a7 7 0 0 1 4 12.74V17a1 1 0 0 1-1 1H9a1 1 0 0 1-1-1v-2.26A7 7 0 0 1 12 2z"/>
  </svg>
)
const SparkleIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 3v3M12 18v3M4.22 4.22l2.12 2.12M17.66 17.66l2.12 2.12M3 12h3M18 12h3M4.22 19.78l2.12-2.12M17.66 6.34l2.12-2.12"/>
  </svg>
)
const ClockIcon = () => (
  <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>
  </svg>
)

// ── Extra icons for batch + retake ───────────────────────────────
const ArchiveIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="21 8 21 21 3 21 3 8"/><rect x="1" y="3" width="22" height="5" rx="1"/><line x1="10" y1="12" x2="14" y2="12"/>
  </svg>
)
const RefreshIcon = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M23 4v6h-6"/><path d="M1 20v-6h6"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>
  </svg>
)
const PlusIcon = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
    <path d="M12 5v14M5 12h14"/>
  </svg>
)

// ── Student Detail Modal ──────────────────────────────────────────
function StudentModal({ student, isArchived, onClose, onToggleRetake }) {
  const overall = avg(student.scores)
  const top     = topSkill(student.scores)
  const bottom  = bottomSkill(student.scores)
  const gaps    = Object.entries(student.scores).filter(([, v]) => v < 60)
  const tier    = overall !== null ? tierLabel(overall) : null

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm px-0 sm:px-4 pb-0 sm:pb-0"
      onClick={e => e.target === e.currentTarget && onClose()}
    >
      <div
        className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-t-3xl sm:rounded-2xl shadow-2xl w-full sm:max-w-2xl flex flex-col max-h-[92vh] overflow-hidden"
        style={{ animation: 'modalIn 0.26s cubic-bezier(0.34,1.1,0.64,1) both' }}
      >
        {/* ── Header ── */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-gray-800 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-linear-to-br from-green-400 to-emerald-600 flex items-center justify-center text-white text-sm font-bold shrink-0 shadow">
              {ini(student.name)}
            </div>
            <div>
              <h2 className="text-sm font-bold text-gray-900 dark:text-white leading-tight">{student.name}</h2>
              <p className="text-xs text-gray-400 dark:text-gray-500 font-mono">{student.studentId} · {student.course}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-xl text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          >
            <XIcon size={16} />
          </button>
        </div>

        {/* ── Scrollable body ── */}
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

              {/* Overall + category grid */}
              <div className="grid grid-cols-1 sm:grid-cols-5 gap-4">

                {/* Overall score card */}
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

                {/* Category breakdown */}
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
                    <div className="flex items-center gap-1.5 mb-2">
                      <StarIcon />
                      <p className="text-xs font-semibold text-green-700 dark:text-green-400">Strongest skill</p>
                    </div>
                    <p className="text-sm font-bold text-gray-900 dark:text-white">{top[0]}</p>
                    <p className={`text-xl font-black mt-0.5 ${scoreColor(top[1])}`}>{top[1]}%</p>
                  </div>
                )}
                {bottom && (
                  <div className="bg-rose-50 dark:bg-rose-950/40 border border-rose-100 dark:border-rose-900 rounded-xl p-4">
                    <div className="flex items-center gap-1.5 mb-2">
                      <AlertTriangleIcon />
                      <p className="text-xs font-semibold text-rose-700 dark:text-rose-400">Weakest skill</p>
                    </div>
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
                        <p className="text-xs font-bold text-amber-800 dark:text-amber-300 mb-1">
                          {cat} <span className="font-normal text-amber-600 dark:text-amber-500">({sc}%)</span>
                        </p>
                        <p className="text-xs text-gray-600 dark:text-gray-400 leading-relaxed">{getSuggestion(cat)}</p>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="bg-green-50 dark:bg-green-950/40 border border-green-100 dark:border-green-900 rounded-2xl px-5 py-4 flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-green-100 dark:bg-green-900 flex items-center justify-center shrink-0">
                    <SparkleIcon />
                  </div>
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
                <p className="text-xs text-gray-400 dark:text-gray-500 mt-1 max-w-xs leading-relaxed">This student hasn't completed the assessment. Results and skill breakdown will appear here once submitted.</p>
              </div>
              <div className="w-full flex flex-col gap-2 mt-2 opacity-40">
                {CATEGORIES.map(cat => (
                  <div key={cat} className="flex items-center gap-2">
                    <span className="text-xs text-gray-400 dark:text-gray-600 w-28 truncate shrink-0">{cat}</span>
                    <div className="flex-1 h-2 bg-gray-100 dark:bg-gray-800 rounded-full" />
                    <span className="text-xs text-gray-300 dark:text-gray-700 w-8 text-right">--%</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* ── Modal footer — Retake toggle (instructor action) ── */}
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
                <p className="text-xs text-gray-400 dark:text-gray-500">
                  {student.retakeAllowed ? 'Student can retake the assessment' : 'Retake not allowed yet'}
                </p>
              </div>
            </div>
            <button
              onClick={() => onToggleRetake(student.id)}
              className={`relative w-11 h-6 rounded-full transition-colors shrink-0 ${
                student.retakeAllowed ? 'bg-blue-600' : 'bg-gray-200 dark:bg-gray-700'
              }`}
            >
              <span className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full shadow transition-transform ${
                student.retakeAllowed ? 'translate-x-5' : 'translate-x-0'
              }`}/>
            </button>
          </div>
        )}
        {isArchived && (
          <div className="shrink-0 border-t border-amber-100 dark:border-amber-900 bg-amber-50 dark:bg-amber-950/40 px-6 py-3">
            <p className="text-xs text-amber-700 dark:text-amber-400 font-medium">This student belongs to an archived batch — data is read-only.</p>
          </div>
        )}
      </div>

      {/* Modal animation */}
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



// ── Confirm Modal ─────────────────────────────────────────────────
function ConfirmModal({ title, message, confirmLabel = 'Remove', onConfirm, onCancel }) {
  return (
    <div className="fixed inset-0 z-60 flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-sm px-4 pb-4 sm:pb-0">
      <div className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-2xl shadow-xl w-full max-w-sm p-6 space-y-4">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-rose-50 dark:bg-rose-950 flex items-center justify-center shrink-0 text-rose-500">
            <TrashIcon />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white">{title}</h3>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 leading-relaxed">{message}</p>
          </div>
        </div>
        <div className="flex gap-2">
          <button onClick={onCancel} className="flex-1 py-2.5 rounded-xl text-sm font-medium bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors">Cancel</button>
          <button onClick={onConfirm} className="flex-1 py-2.5 rounded-xl text-sm font-medium bg-rose-600 hover:bg-rose-700 text-white transition-colors">{confirmLabel}</button>
        </div>
      </div>
    </div>
  )
}

// ── Pagination ────────────────────────────────────────────────────
function Pagination({ total, page, onPage }) {
  const pages = Math.ceil(total / PAGE_SIZE)
  if (pages <= 1) return null
  const from = (page - 1) * PAGE_SIZE + 1
  const to   = Math.min(page * PAGE_SIZE, total)
  const nums = []
  for (let i = Math.max(1, page - 1); i <= Math.min(pages, page + 1); i++) nums.push(i)
  const btnBase = 'transition-colors text-xs font-medium rounded-lg'
  return (
    <div className="flex flex-col sm:flex-row items-center justify-between gap-2 px-1 py-1">
      <p className="text-xs text-gray-400 dark:text-gray-500 order-2 sm:order-1">Showing {from}–{to} of {total}</p>
      <div className="flex items-center gap-1 order-1 sm:order-2">
        <button onClick={() => onPage(page - 1)} disabled={page === 1}
          className={`${btnBase} px-3 py-1.5 bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 disabled:opacity-40 hover:bg-gray-200 dark:hover:bg-gray-700 disabled:cursor-not-allowed`}>← Prev</button>
        {page > 2 && <><button onClick={() => onPage(1)} className={`${btnBase} w-8 h-8 text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800`}>1</button><span className="text-xs text-gray-300 dark:text-gray-700 px-0.5">…</span></>}
        {nums.map(p => <button key={p} onClick={() => onPage(p)} className={`${btnBase} w-8 h-8 ${p === page ? 'bg-gray-900 dark:bg-white text-white dark:text-gray-900' : 'text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'}`}>{p}</button>)}
        {page < pages - 1 && <><span className="text-xs text-gray-300 dark:text-gray-700 px-0.5">…</span><button onClick={() => onPage(pages)} className={`${btnBase} w-8 h-8 text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800`}>{pages}</button></>}
        <button onClick={() => onPage(page + 1)} disabled={page === pages}
          className={`${btnBase} px-3 py-1.5 bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 disabled:opacity-40 hover:bg-gray-200 dark:hover:bg-gray-700 disabled:cursor-not-allowed`}>Next →</button>
      </div>
    </div>
  )
}

// ── Instructor Nav ────────────────────────────────────────────────
function InstructorNav({ instructor }) {
  const navigate = useNavigate()
  const [open,    setOpen]    = useState(false)
  const [mobile,  setMobile]  = useState(false)
  const [dark,    setDark]    = useState(() => localStorage.getItem('sb-theme') === 'dark')

  function toggleDark() {
    const next = !dark; setDark(next)
    document.documentElement.classList.toggle('dark', next)
    localStorage.setItem('sb-theme', next ? 'dark' : 'light')
  }

  const links = [
    { label: 'Dashboard',      path: '/instructor/dashboard' },
    { label: 'Students',       path: '/instructor/students',          active: true },
    { label: 'New assessment', path: '/instructor/assessment/create' },
  ]

  return (
    <>
      <nav className="bg-white dark:bg-gray-900 border-b border-gray-100 dark:border-gray-800 px-4 sm:px-6 h-14 flex items-center justify-between sticky top-0 z-10">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 bg-green-600 rounded-lg flex items-center justify-center shrink-0">
            <svg width="16" height="16" viewBox="0 0 26 26" fill="none">
              <path d="M3 18 Q3 10 13 10 Q23 10 23 18" stroke="white" strokeWidth="2.2" strokeLinecap="round"/>
              <path d="M7 18 L7 14M13 18 L13 12M19 18 L19 14" stroke="white" strokeWidth="2.2" strokeLinecap="round"/>
              <circle cx="7" cy="8" r="2.5" fill="white" opacity="0.85"/><circle cx="19" cy="8" r="2.5" fill="white" opacity="0.85"/>
            </svg>
          </div>
          <span className="text-sm font-semibold text-gray-900 dark:text-white">SkillBridge</span>
          <span className="hidden sm:inline text-gray-300 dark:text-gray-700">/</span>
          <span className="hidden sm:inline text-sm text-gray-500 dark:text-gray-400">Instructor</span>
        </div>
        <div className="hidden md:flex items-center gap-1">
          {links.map(l => (
            <button key={l.label} onClick={() => navigate(l.path)}
              className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${l.active ? 'bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-white font-medium' : 'text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-50 dark:hover:bg-gray-800'}`}
            >{l.label}</button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setMobile(p => !p)} className="md:hidden p-2 rounded-lg text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
            {mobile ? <XIcon size={20} /> : <MenuIcon />}
          </button>
          <div className="relative">
            <button onClick={() => setOpen(p => !p)} className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center text-xs font-semibold text-blue-700 dark:text-blue-300 hover:ring-2 hover:ring-blue-400 transition-all">
              {instructor.initials}
            </button>
            {open && (
              <div className="absolute right-0 mt-2 w-56 bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-2xl shadow-lg overflow-hidden z-20">
                <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-800">
                  <p className="text-sm font-semibold text-gray-900 dark:text-white truncate">{instructor.name}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">{instructor.subject}</p>
                </div>
                <div className="px-4 py-3 flex items-center justify-between border-b border-gray-100 dark:border-gray-800">
                  <span className="text-sm text-gray-700 dark:text-gray-300">{dark ? 'Dark mode' : 'Light mode'}</span>
                  <button onClick={toggleDark} className={`relative w-9 h-5 rounded-full transition-colors ${dark ? 'bg-green-600' : 'bg-gray-200'}`}>
                    <span className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${dark ? 'translate-x-4' : 'translate-x-0'}`}/>
                  </button>
                </div>
                <button onClick={() => { localStorage.removeItem('sb-token'); navigate('/login') }}
                  className="w-full text-left px-4 py-3 text-sm text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950 transition-colors">Sign out</button>
              </div>
            )}
          </div>
        </div>
      </nav>
      {mobile && (
        <div className="md:hidden bg-white dark:bg-gray-900 border-b border-gray-100 dark:border-gray-800 px-4 py-3 flex flex-col gap-1 sticky top-14 z-10 shadow-sm">
          {links.map(l => (
            <button key={l.label} onClick={() => { navigate(l.path); setMobile(false) }}
              className={`w-full text-left px-3 py-2.5 rounded-xl text-sm transition-colors ${l.active ? 'bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-white font-medium' : 'text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-50 dark:hover:bg-gray-800'}`}
            >{l.label}</button>
          ))}
        </div>
      )}
    </>
  )
}

// ── Enroll Modal ──────────────────────────────────────────────────
function EnrollModal({ existingStudents, onClose, onEnroll }) {
  const [tab,         setTab]         = useState('excel')
  const fileRef                       = useRef(null)
  const [xlsxRows,    setXlsxRows]    = useState([])
  const [xlsxErrors,  setXlsxErrors]  = useState([])
  const [xlsxFile,    setXlsxFile]    = useState(null)
  const [xlsxLoading, setXlsxLoading] = useState(false)
  const [manId,       setManId]       = useState('')
  const [manEmail,    setManEmail]    = useState('')
  const [manName,     setManName]     = useState('')
  const [nameEdited,  setNameEdited]  = useState(false)
  const [manCourse,   setManCourse]   = useState('BSIT')
  const [manErr,      setManErr]      = useState({})

  async function parseExcel(file) {
    setXlsxLoading(true); setXlsxRows([]); setXlsxErrors([]); setXlsxFile(file.name)
    try {
      if (!window.XLSX) await new Promise((res, rej) => { const s = document.createElement('script'); s.src = 'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js'; s.onload = res; s.onerror = rej; document.head.appendChild(s) })
      const wb  = window.XLSX.read(await file.arrayBuffer(), { type: 'array' })
      const raw = window.XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { defval: '' })
      const rows = [], errs = []
      raw.forEach((row, i) => {
        const rowNum = i + 2
        const name   = String(row.name || row.Name || '').trim()
        const sid    = String(row.student_id || row['Student ID'] || '').trim()
        const email  = String(row.email || row.Email || '').trim().toLowerCase()
        const course = String(row.course || row.Course || '').trim().toUpperCase()
        const e = []
        if (!name)    e.push('Name required')
        if (!sid)     e.push('Student ID required')
        if (!email)   e.push('Email required')
        else if (!email.endsWith('@dnsc.edu.ph')) e.push('Must be @dnsc.edu.ph')
        if (!['BSIT','BSIS'].includes(course)) e.push('Course must be BSIT or BSIS')
        if (existingStudents.find(s => s.studentId === sid))   e.push(`ID ${sid} already enrolled`)
        if (existingStudents.find(s => s.email === email))     e.push('Email already enrolled')
        if (e.length) errs.push({ rowNum, errors: e }); else rows.push({ name, studentId: sid, email, course })
      })
      setXlsxRows(rows); setXlsxErrors(errs)
    } catch { setXlsxErrors([{ rowNum: '–', errors: ['Failed to read file. Use a valid .xlsx or .csv.'] }]) }
    finally { setXlsxLoading(false) }
  }

  function handleManual() {
    const e = {}
    if (!manName.trim()) e.name = 'Name is required'
    if (!manId.trim()) e.studentId = 'Student ID is required'
    else if (!/^\d{4}-\d{5}$/.test(manId.trim())) e.studentId = 'Format: YYYY-NNNNN'
    if (!manEmail.trim()) e.email = 'Email is required'
    else if (!manEmail.toLowerCase().endsWith('@dnsc.edu.ph')) e.email = 'Must be a @dnsc.edu.ph email'
    if (existingStudents.find(s => s.studentId === manId.trim())) e.studentId = 'ID already enrolled'
    if (existingStudents.find(s => s.email === manEmail.trim().toLowerCase())) e.email = 'Email already enrolled'
    if (Object.keys(e).length) { setManErr(e); return }
    onEnroll([{ name: manName.trim(), studentId: manId.trim(), email: manEmail.trim().toLowerCase(), course: manCourse }])
    setManId(''); setManEmail(''); setManName(''); setNameEdited(false); setManCourse('BSIT'); setManErr({})
  }

  function downloadTemplate() {
    const csv = 'name,student_id,email,course\nJuan Dela Cruz,2023-01001,jdelacruz@dnsc.edu.ph,BSIT\n'
    const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(new Blob([csv], { type: 'text/csv' })), download: 'students_template.csv' })
    a.click()
  }

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-t-2xl sm:rounded-2xl shadow-2xl w-full sm:max-w-lg flex flex-col max-h-[92vh] overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-gray-800 shrink-0">
          <div>
            <h2 className="text-base font-bold text-gray-900 dark:text-white">Enroll students</h2>
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">Upload a spreadsheet or add manually</p>
          </div>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-xl text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
            <XIcon size={16}/>
          </button>
        </div>

        <div className="flex gap-0 px-6 pt-4 shrink-0">
          {[{ key: 'excel', label: 'Upload Excel / CSV' }, { key: 'manual', label: 'Manual entry' }].map(t => (
            <button key={t.key} onClick={() => setTab(t.key)}
              className={`px-4 py-2 text-sm font-medium rounded-t-xl transition-colors border-b-2 ${tab === t.key ? 'text-green-700 dark:text-green-300 border-green-600 bg-green-50 dark:bg-green-950/40' : 'text-gray-500 dark:text-gray-400 border-transparent hover:text-gray-700'}`}
            >{t.label}</button>
          ))}
        </div>

        <div className="overflow-y-auto flex-1 px-6 py-5 flex flex-col gap-4">
          {tab === 'excel' ? (
            <>
              <div className="flex items-center justify-between bg-blue-50 dark:bg-blue-950/40 border border-blue-100 dark:border-blue-900 rounded-xl px-4 py-3">
                <div>
                  <p className="text-xs font-semibold text-blue-700 dark:text-blue-300">Need a template?</p>
                  <p className="text-xs text-blue-500 dark:text-blue-400 mt-0.5">Columns: <code className="font-mono">name, student_id, email, course</code></p>
                </div>
                <button onClick={downloadTemplate} className="text-xs font-semibold text-blue-700 dark:text-blue-300 hover:underline shrink-0">Download ↓</button>
              </div>

              <div onDragOver={e => e.preventDefault()} onDrop={e => { e.preventDefault(); const f = e.dataTransfer?.files?.[0]; if (f) parseExcel(f) }}
                onClick={() => fileRef.current?.click()}
                className="border-2 border-dashed border-gray-200 dark:border-gray-700 rounded-2xl p-8 flex flex-col items-center gap-3 cursor-pointer hover:border-green-400 hover:bg-green-50 dark:hover:bg-green-950/20 transition-colors">
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" className="text-gray-300 dark:text-gray-700">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                  <polyline points="14 2 14 8 20 8" stroke="currentColor" strokeWidth="1.5"/>
                  <line x1="12" y1="18" x2="12" y2="12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                  <polyline points="9 15 12 12 15 15" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                </svg>
                <div className="text-center">
                  <p className="text-sm font-medium text-gray-600 dark:text-gray-300">{xlsxFile || 'Drop your .xlsx or .csv here'}</p>
                  <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">or tap to browse</p>
                </div>
                <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={e => e.target.files?.[0] && parseExcel(e.target.files[0])} />
              </div>

              {xlsxLoading && <p className="text-xs text-center text-gray-400 animate-pulse">Parsing file…</p>}

              {xlsxErrors.length > 0 && (
                <div className="bg-rose-50 dark:bg-rose-950/40 border border-rose-100 dark:border-rose-900 rounded-xl px-4 py-3 space-y-1">
                  <p className="text-xs font-semibold text-rose-700 dark:text-rose-300">{xlsxErrors.length} row{xlsxErrors.length > 1 ? 's' : ''} with issues (skipped):</p>
                  {xlsxErrors.map((e, i) => <p key={i} className="text-xs text-rose-600 dark:text-rose-400">Row {e.rowNum}: {e.errors.join(' · ')}</p>)}
                </div>
              )}

              {xlsxRows.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs font-semibold text-gray-700 dark:text-gray-300">{xlsxRows.length} student{xlsxRows.length > 1 ? 's' : ''} ready to enroll:</p>
                  <div className="border border-gray-100 dark:border-gray-800 rounded-xl overflow-hidden">
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs min-w-380px">
                        <thead><tr className="bg-gray-50 dark:bg-gray-800 border-b border-gray-100 dark:border-gray-800">
                          <th className="text-left px-3 py-2.5 text-gray-500 dark:text-gray-400 font-semibold">Name</th>
                          <th className="text-left px-3 py-2.5 text-gray-500 dark:text-gray-400 font-semibold">ID</th>
                          <th className="text-left px-3 py-2.5 text-gray-500 dark:text-gray-400 font-semibold">Email</th>
                          <th className="text-left px-3 py-2.5 text-gray-500 dark:text-gray-400 font-semibold">Course</th>
                        </tr></thead>
                        <tbody>
                          {xlsxRows.map((r, i) => (
                            <tr key={i} className={`border-b border-gray-50 dark:border-gray-800 last:border-0 ${i % 2 ? 'bg-gray-50/50 dark:bg-gray-800/30' : ''}`}>
                              <td className="px-3 py-2.5 font-medium text-gray-900 dark:text-white">{r.name}</td>
                              <td className="px-3 py-2.5 font-mono text-gray-500 dark:text-gray-400">{r.studentId}</td>
                              <td className="px-3 py-2.5 text-gray-500 dark:text-gray-400 max-w-120px truncate">{r.email}</td>
                              <td className="px-3 py-2.5"><span className="bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300 px-2 py-0.5 rounded-full font-semibold">{r.course}</span></td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                  <button onClick={() => onEnroll(xlsxRows)} className="w-full py-3 rounded-xl bg-green-600 hover:bg-green-700 text-white text-sm font-semibold transition-colors">
                    Enroll {xlsxRows.length} student{xlsxRows.length > 1 ? 's' : ''}
                  </button>
                </div>
              )}
            </>
          ) : (
            <>
              <p className="text-xs text-gray-400 dark:text-gray-500 mb-2">
                Add one student at a time. The name is suggested automatically from the DNSC email.
              </p>

              {/* DNSC Email */}
              <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">DNSC Email</label>
                <input
                  type="email"
                  value={manEmail}
                  onChange={e => {
                    const val = e.target.value
                    setManEmail(val)
                    setManErr(err => ({ ...err, email: '' }))
                    if (!nameEdited && val.includes('.')) {
                      setManName(nameFromEmail(val.trim().toLowerCase()))
                    }
                  }}
                  placeholder="e.g. villanueva.azel@dnsc.edu.ph"
                  className={`w-full px-4 py-3 rounded-xl border text-sm outline-none transition-colors bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder:text-gray-400
                    ${manErr.email ? 'border-rose-400' : 'border-gray-200 dark:border-gray-700 focus:border-green-500'}`}
                />
                {manErr.email && <p className="text-xs text-rose-500 mt-1">{manErr.email}</p>}
              </div>

              {/* Full Name */}
              <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">Full Name</label>
                <input
                  type="text"
                  value={manName}
                  onChange={e => {
                    setManName(e.target.value)
                    setNameEdited(true)
                    setManErr(err => ({ ...err, name: '' }))
                  }}
                  placeholder="e.g. Azel Villanueva"
                  className={`w-full px-4 py-3 rounded-xl border text-sm outline-none transition-colors bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder:text-gray-400
                    ${manErr.name ? 'border-rose-400' : 'border-gray-200 dark:border-gray-700 focus:border-green-500'}`}
                />
                {manErr.name && <p className="text-xs text-rose-500 mt-1">{manErr.name}</p>}
              </div>

              {/* Student ID */}
              <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">Student ID</label>
                <input
                  type="text"
                  value={manId}
                  onChange={e => { setManId(e.target.value); setManErr(err => ({ ...err, studentId: '' })) }}
                  placeholder="e.g. 2023-01001"
                  className={`w-full px-4 py-3 rounded-xl border text-sm font-mono outline-none transition-colors bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder:text-gray-400 placeholder:font-sans
                    ${manErr.studentId ? 'border-rose-400' : 'border-gray-200 dark:border-gray-700 focus:border-green-500'}`}
                />
                {manErr.studentId && <p className="text-xs text-rose-500 mt-1">{manErr.studentId}</p>}
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">Course</label>
                <div className="flex gap-2">
                  {['BSIT','BSIS'].map(c => (
                    <button key={c} onClick={() => setManCourse(c)}
                      className={`flex-1 py-2.5 rounded-xl text-sm font-semibold border transition-colors ${manCourse === c ? 'bg-green-600 border-green-600 text-white' : 'border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:border-green-400'}`}
                    >{c}</button>
                  ))}
                </div>
              </div>
              <button onClick={handleManual} className="w-full py-3 rounded-xl bg-green-600 hover:bg-green-700 text-white text-sm font-semibold transition-colors mt-1">Add student</button>
            </>
          )}
        </div>

        <div className="px-6 py-4 border-t border-gray-100 dark:border-gray-800 shrink-0 flex justify-end">
          <button onClick={onClose} className="text-sm text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors">Close</button>
        </div>
      </div>
    </div>
  )
}

// ── Main ──────────────────────────────────────────────────────────
export default function EnrolledStudents() {
  const navigate = useNavigate()

  // ── Logged-in instructor — loaded from API ──────────────────────
  const [user, setUser] = useState(null)

  useEffect(() => {
    api.get('/api/auth/me/')
      .then(res => setUser(res.data))
      .catch(() => { /* keep null; nav will show fallback initials */ })
  }, []) // eslint-disable-line

  // Build the shape InstructorNav expects from the real user object
  const instructor = {
    name:     user?.name     ?? 'Instructor',
    initials: user ? getInitials(user.name) : 'IN',
    subject:  user?.course   ?? 'OJT Coordinator',
  }

  // ── Batch state — loaded from API ───────────────────────────────
  const [batches,         setBatches]         = useState(FALLBACK_BATCHES)
  const [loadingBatches,  setLoadingBatches]  = useState(true)
  const [activeBatchId,   setActiveBatchId]   = useState(null)
  const [showArchiveConf, setShowArchiveConf] = useState(false)
  const [showNewBatch,    setShowNewBatch]    = useState(false)
  const [newBatchName,    setNewBatchName]    = useState('')

  // Load batches from API on mount
  useEffect(() => {
    api.get('/api/instructor/batches/')
      .then(res => {
        const apiData = res.data
        // Normalize API shape → { id, name, status, archivedAt, students[] }
        const normalized = apiData.map(b => ({
          id:         b.id,
          name:       b.name,
          status:     b.is_active ? 'active' : 'archived',
          archivedAt: b.archived_at ?? null,
          students:   (b.students || []).map(s => ({
            id:            s.id,
            name:          s.name,
            studentId:     s.school_id || s.student_id || '',
            email:         s.email,
            course:        s.course,
            status:        s.has_submitted ? 'completed' : 'pending',
            retakeAllowed: s.retake_allowed ?? false,
            scores:        s.skill_scores ?? {},
          }))
        }))
        setBatches(normalized)
        const active = normalized.find(b => b.status === 'active')
        setActiveBatchId(active?.id ?? normalized[normalized.length - 1]?.id ?? null)
      })
      .catch(() => {
        // API not yet wired — keep empty list, show "no batch" state
      })
      .finally(() => setLoadingBatches(false))
  }, []) // eslint-disable-line

  const viewedBatch   = batches.find(b => b.id === activeBatchId)
  const isArchived    = viewedBatch?.status === 'archived'
  const students      = viewedBatch?.students ?? []
  const activeBatch   = batches.find(b => b.status === 'active')

  function setStudents(updater) {
    setBatches(prev => prev.map(b =>
      b.id === activeBatchId ? { ...b, students: typeof updater === 'function' ? updater(b.students) : updater } : b
    ))
  }

  async function handleArchiveBatch() {
    try {
      await api.post(`/api/instructor/batches/${activeBatchId}/archive/`)
    } catch { /* fall through to local update */ }
    setBatches(prev => prev.map(b =>
      b.id === activeBatchId ? { ...b, status: 'archived', archivedAt: new Date().toISOString().slice(0, 10) } : b
    ))
    setShowArchiveConf(false)
    setShowNewBatch(true)
  }

  async function handleCreateBatch() {
    const name = newBatchName.trim() || `AY ${new Date().getFullYear()}–${new Date().getFullYear() + 1}`
    let newId = Date.now()
    try {
      const res = await api.post('/api/instructor/batches/', { name })
      newId = res.data.id
    } catch { /* use temp ID */ }
    const nb = { id: newId, name, status: 'active', archivedAt: null, students: [] }
    setBatches(prev => [...prev, nb])
    setActiveBatchId(nb.id)
    setShowNewBatch(false)
    setNewBatchName('')
    showToast(`New batch "${name}" created.`)
  }

  async function handleToggleRetake(studentId) {
    const st = students.find(s => s.id === studentId)
    try {
      await api.patch(`/api/instructor/students/${studentId}/retake/`, { retake_allowed: !st?.retakeAllowed })
    } catch { /* optimistic update still applied */ }
    setBatches(prev => prev.map(b =>
      b.id === activeBatchId
        ? { ...b, students: b.students.map(s => s.id === studentId ? { ...s, retakeAllowed: !s.retakeAllowed } : s) }
        : b
    ))
    setSelectedStudent(prev => prev?.id === studentId ? { ...prev, retakeAllowed: !prev.retakeAllowed } : prev)
    if (st) showToast(st.retakeAllowed ? `Retake revoked for ${st.name}.` : `Retake allowed for ${st.name}.`)
  }

  const [search,          setSearch]          = useState('')
  const [course,          setCourse]          = useState('all')
  const [status,          setStatus]          = useState('all')
  const [view,            setView]            = useState('grid')
  const [showModal,       setShowModal]       = useState(false)
  const [toast,           setToast]           = useState(null)
  const [confirmRemove,   setConfirmRemove]   = useState(null)
  const [page,            setPage]            = useState(1)
  const [selectedStudent, setSelectedStudent] = useState(null)

  // Close modal on Escape
  useEffect(() => {
    function onKey(e) { if (e.key === 'Escape') { setSelectedStudent(null); setShowNewBatch(false); setShowArchiveConf(false) } }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  function showToast(msg) { setToast(msg); setTimeout(() => setToast(null), 4000) }


  async function handleEnroll(newStudents) {
    if (!activeBatchId) { showToast('No active batch. Create one first.'); return }
    try {
      const res = await api.post(`/api/instructor/batches/${activeBatchId}/enroll/`, { students: newStudents })
      // API returns the newly created student records
      const added = (res.data.enrolled || newStudents).map(s => ({
        id:            s.id || Date.now() + Math.random(),
        name:          s.name,
        studentId:     s.school_id || s.student_id || newStudents.find(n => n.email === s.email)?.studentId || '',
        email:         s.email,
        course:        s.course,
        status:        'pending',
        retakeAllowed: false,
        scores:        {},
      }))
      setStudents(p => [...p, ...added])
      showToast(`${added.length} student${added.length > 1 ? 's' : ''} enrolled successfully`)
    } catch (err) {
      const msg = err.response?.data?.error || 'Enrollment failed. Please try again.'
      showToast(`❌ ${msg}`)
    }
    setShowModal(false)
    setPage(1)
  }

  function handleRemove(s) { setStudents(p => p.filter(x => x.id !== s.id)); setConfirmRemove(null) }

  const completed = students.filter(s => s.status === 'completed')
  const bsit = students.filter(s => s.course === 'BSIT')
  const bsis = students.filter(s => s.course === 'BSIS')

  const filtered = useMemo(() => {
    let list = [...students]
    if (course !== 'all') list = list.filter(s => s.course === course)
    if (status !== 'all') list = list.filter(s => s.status === status)
    if (search.trim()) {
      const q = search.toLowerCase()
      list = list.filter(s => s.name.toLowerCase().includes(q) || s.studentId.toLowerCase().includes(q) || s.email.toLowerCase().includes(q))
    }
    return list
  }, [search, course, status, students])

  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      <InstructorNav instructor={instructor} />

      {toast && (
        <div className="fixed top-4 right-4 z-50 bg-green-600 text-white text-sm font-medium px-5 py-3 rounded-2xl shadow-lg flex items-center gap-2">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M20 6L9 17l-5-5" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
          {toast}
        </div>
      )}

      {confirmRemove && (
        <ConfirmModal
          title="Remove student?"
          message={`This will unenroll ${confirmRemove.name} (${confirmRemove.studentId}). Their assessment data will also be removed.`}
          confirmLabel="Remove"
          onConfirm={() => handleRemove(confirmRemove)}
          onCancel={() => setConfirmRemove(null)}
        />
      )}

      {showModal && <EnrollModal existingStudents={students} onClose={() => setShowModal(false)} onEnroll={handleEnroll} />}

      {selectedStudent && <StudentModal student={selectedStudent} isArchived={isArchived} onClose={() => setSelectedStudent(null)} onToggleRetake={handleToggleRetake} />}

      {/* ── Archive batch confirmation ── */}
      {showArchiveConf && (
        <div className="fixed inset-0 z-60 flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-sm px-4 pb-4 sm:pb-0">
          <div className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-2xl shadow-xl w-full max-w-sm p-6 space-y-4">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-50 dark:bg-amber-950 flex items-center justify-center shrink-0 text-amber-500"><ArchiveIcon /></div>
              <div>
                <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Archive this batch?</h3>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 leading-relaxed">
                  <strong>{viewedBatch?.name}</strong> will be marked as archived and become read-only.
                  All student data is preserved. You will then create a new active batch.
                </p>
              </div>
            </div>
            <div className="flex gap-2">
              <button onClick={() => setShowArchiveConf(false)} className="flex-1 py-2.5 rounded-xl text-sm font-medium bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors">Cancel</button>
              <button onClick={handleArchiveBatch} className="flex-1 py-2.5 rounded-xl text-sm font-medium bg-amber-500 hover:bg-amber-600 text-white transition-colors">Archive Batch</button>
            </div>
          </div>
        </div>
      )}

      {/* ── New batch modal ── */}
      {showNewBatch && (
        <div className="fixed inset-0 z-60 flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-sm px-4 pb-4 sm:pb-0">
          <div className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-2xl shadow-xl w-full max-w-sm p-6 space-y-4">
            <div>
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white flex items-center gap-2"><PlusIcon /> Start New Batch</h3>
              <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">Give this cohort a school-year name.</p>
            </div>
            <div>
              <label className="text-xs font-medium text-gray-700 dark:text-gray-300 block mb-1">Batch Name</label>
              <input
                value={newBatchName}
                onChange={e => setNewBatchName(e.target.value)}
                placeholder={`AY ${new Date().getFullYear()}–${new Date().getFullYear() + 1}`}
                className="w-full px-3 py-2 text-sm rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-green-500"
              />
            </div>
            <div className="flex gap-2">
              <button onClick={() => setShowNewBatch(false)} className="flex-1 py-2.5 rounded-xl text-sm font-medium bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors">Cancel</button>
              <button onClick={handleCreateBatch} className="flex-1 py-2.5 rounded-xl text-sm font-medium bg-green-600 hover:bg-green-700 text-white transition-colors">Create Batch</button>
            </div>
          </div>
        </div>
      )}

      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-6 sm:py-8 flex flex-col gap-6">

        {/* ── Header ── */}
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-xl font-bold text-gray-900 dark:text-white">Enrolled students</h1>
              {isArchived && (
                <span className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full bg-amber-100 dark:bg-amber-900 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
                  <ArchiveIcon /> Archived
                </span>
              )}
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <p className="text-sm text-gray-500 dark:text-gray-400">{instructor.subject}</p>
              {/* Batch selector */}
              <select
                value={activeBatchId}
                onChange={e => { setActiveBatchId(Number(e.target.value)); setPage(1) }}
                className="text-xs px-2.5 py-1 rounded-lg bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 border-none focus:outline-none focus:ring-2 focus:ring-green-500 cursor-pointer font-medium"
              >
                {[...batches].reverse().map(b => (
                  <option key={b.id} value={b.id}>{b.name}{b.status === 'archived' ? ' (Archived)' : ' ★ Active'}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {!isArchived && activeBatch && (
              <>
                <button onClick={() => setShowModal(true)}
                  className="flex items-center gap-2 bg-green-600 hover:bg-green-700 active:bg-green-800 text-white text-sm font-semibold px-4 py-2.5 rounded-xl transition-colors">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" stroke="white" strokeWidth="2.5" strokeLinecap="round"/><circle cx="9" cy="7" r="4" stroke="white" strokeWidth="2.5"/><line x1="19" y1="8" x2="19" y2="14" stroke="white" strokeWidth="2.5" strokeLinecap="round"/><line x1="22" y1="11" x2="16" y2="11" stroke="white" strokeWidth="2.5" strokeLinecap="round"/></svg>
                  Enroll students
                </button>
                <button onClick={() => navigate('/instructor/assessment/create')}
                  className="flex items-center gap-2 border border-gray-200 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-300 text-sm font-semibold px-4 py-2.5 rounded-xl transition-colors">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"/></svg>
                  New assessment
                </button>
                <button onClick={() => setShowArchiveConf(true)}
                  className="flex items-center gap-1.5 border border-amber-200 dark:border-amber-800 hover:bg-amber-50 dark:hover:bg-amber-950 text-amber-700 dark:text-amber-400 text-sm font-semibold px-3 py-2.5 rounded-xl transition-colors">
                  <ArchiveIcon /> Archive batch
                </button>
              </>
            )}
            {isArchived && (
              <button onClick={() => { const ab = batches.find(b => b.status === 'active'); if (ab) setActiveBatchId(ab.id) }}
                className="text-xs px-3 py-2 rounded-xl border border-green-200 dark:border-green-800 text-green-700 dark:text-green-400 hover:bg-green-50 dark:hover:bg-green-950 transition-colors font-medium">
                Switch to active batch
              </button>
            )}
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: 'Total enrolled', value: students.length, sub: 'all courses' },
            { label: 'BSIT', value: bsit.length, sub: 'students' },
            { label: 'BSIS', value: bsis.length, sub: 'students' },
            { label: 'Completion', value: `${Math.round((completed.length / (students.length || 1)) * 100)}%`, sub: `${completed.length} of ${students.length} done`, green: true },
          ].map(c => (
            <div key={c.label} className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-2xl p-4">
              <p className="text-xs text-gray-400 dark:text-gray-500 mb-2">{c.label}</p>
              <p className={`text-2xl font-bold mb-1 ${c.green ? 'text-green-600 dark:text-green-400' : 'text-gray-900 dark:text-white'}`}>{c.value}</p>
              <p className="text-xs text-gray-400 dark:text-gray-600">{c.sub}</p>
            </div>
          ))}
        </div>

        {/* Controls */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 flex-wrap">
          <div className="relative flex-1 min-w-0 sm:min-w-56">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"><circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="2"/><path d="M16.5 16.5L21 21" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>
            <input value={search} onChange={e => { setSearch(e.target.value); setPage(1) }} placeholder="Search by name, ID, or email…"
              className="w-full pl-9 pr-4 py-2.5 text-sm rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white outline-none focus:border-green-500 transition-colors"/>
          </div>
          <div className="flex items-center gap-1.5 flex-wrap">
            {[{v:'all',l:'All courses'},{v:'BSIT',l:'BSIT'},{v:'BSIS',l:'BSIS'}].map(f => (
              <button key={f.v} onClick={() => { setCourse(f.v); setPage(1) }}
                className={`text-xs px-3 py-1.5 rounded-full font-medium transition-colors ${course===f.v?'bg-gray-900 dark:bg-white text-white dark:text-gray-900':'bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'}`}>{f.l}</button>
            ))}
          </div>
          <div className="flex items-center gap-1.5">
            {[{v:'all',l:'All'},{v:'completed',l:'Done'},{v:'pending',l:'Pending'}].map(f => (
              <button key={f.v} onClick={() => { setStatus(f.v); setPage(1) }}
                className={`text-xs px-3 py-1.5 rounded-full font-medium transition-colors ${status===f.v?'bg-gray-900 dark:bg-white text-white dark:text-gray-900':'bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'}`}>{f.l}</button>
            ))}
          </div>
          <div className="hidden sm:flex items-center gap-1 bg-gray-100 dark:bg-gray-800 rounded-xl p-1 ml-auto">
            {[
              {v:'grid', ic:<svg width="14" height="14" viewBox="0 0 24 24" fill="none"><rect x="3" y="3" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="2"/><rect x="14" y="3" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="2"/><rect x="3" y="14" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="2"/><rect x="14" y="14" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="2"/></svg>},
              {v:'list', ic:<svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>},
            ].map(v => (
              <button key={v.v} onClick={() => setView(v.v)}
                className={`p-1.5 rounded-lg transition-colors ${view===v.v?'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm':'text-gray-400 dark:text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'}`}>{v.ic}</button>
            ))}
          </div>
          <p className="text-xs text-gray-400 dark:text-gray-500 shrink-0">{filtered.length} students</p>
        </div>

        {/* Empty state */}
        {filtered.length === 0 ? (
          <div className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-2xl py-16 flex flex-col items-center gap-3">
            <p className="text-sm font-medium text-gray-400 dark:text-gray-600">No students match your search.</p>
            <button onClick={() => { setSearch(''); setCourse('all'); setStatus('all') }} className="text-xs text-green-600 dark:text-green-400 hover:underline">Clear filters</button>
          </div>
        ) : (
          <>
            {/* Grid view (always on mobile) */}
            <div className={`${view === 'grid' ? 'grid' : 'grid sm:hidden'} grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4`}>
              {paginated.map(s => {
                const overall = avg(s.scores), top = topSkill(s.scores)
                return (
                  <div key={s.id}
                    onClick={() => setSelectedStudent(s)}
                    className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-2xl p-5 flex flex-col gap-4 hover:shadow-md hover:border-green-300 dark:hover:border-green-700 hover:ring-2 hover:ring-green-200 dark:hover:ring-green-900 transition-all cursor-pointer">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-10 h-10 rounded-full bg-green-100 dark:bg-green-900 flex items-center justify-center text-sm font-bold text-green-700 dark:text-green-300 shrink-0">{ini(s.name)}</div>
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-gray-900 dark:text-white leading-tight truncate">{s.name}</p>
                          <p className="text-xs text-gray-400 dark:text-gray-500">{s.studentId} · {s.course}</p>
                          <p className="text-xs text-gray-400 dark:text-gray-500 truncate">{s.email}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        {s.status === 'completed'
                          ? <span className="inline-flex items-center gap-1 text-xs font-medium text-green-700 dark:text-green-300 bg-green-100 dark:bg-green-900 px-2 py-0.5 rounded-full"><span className="w-1 h-1 rounded-full bg-green-500"/>Done</span>
                          : <span className="inline-flex items-center gap-1 text-xs font-medium text-amber-700 dark:text-amber-300 bg-amber-100 dark:bg-amber-900 px-2 py-0.5 rounded-full"><span className="w-1 h-1 rounded-full bg-amber-500"/>Pending</span>
                        }
                        <button onClick={e => { e.stopPropagation(); setConfirmRemove(s) }}
                          className="p-1.5 rounded-lg text-gray-300 dark:text-gray-700 hover:text-rose-500 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950 transition-colors" title="Remove"><TrashIcon/></button>
                      </div>
                    </div>
                    {s.status === 'completed' ? (
                      <div className="flex flex-col gap-2">
                        <div>
                          <div className="flex justify-between mb-1"><span className="text-xs text-gray-500 dark:text-gray-400">Overall</span><span className={`text-sm font-bold ${scoreColor(overall)}`}>{overall}%</span></div>
                          <div className="h-2 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden"><div className={`h-full rounded-full ${scoreBg(overall)}`} style={{width:`${overall}%`}}/></div>
                        </div>
                        {CATEGORIES.map(cat => { const sc = s.scores[cat]; return (
                          <div key={cat} className="flex items-center gap-2">
                            <span className="text-xs text-gray-400 dark:text-gray-500 w-24 truncate shrink-0">{cat}</span>
                            <div className="flex-1 h-1 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden"><div className={`h-full rounded-full ${scoreBg(sc)}`} style={{width:`${sc}%`}}/></div>
                            <span className={`text-xs font-medium w-9 text-right ${scoreColor(sc)}`}>{sc}%</span>
                          </div>
                        )})}
                        {top && <div className="flex items-center gap-2 bg-gray-50 dark:bg-gray-800 rounded-xl px-3 py-2 mt-1">
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" stroke="#16a34a" strokeWidth="2" strokeLinecap="round"/></svg>
                          <span className="text-xs text-gray-500 dark:text-gray-400">Best in</span>
                          <span className="text-xs font-semibold text-gray-900 dark:text-white">{top[0]}</span>
                          <span className="ml-auto text-xs font-bold text-green-600 dark:text-green-400">{top[1]}%</span>
                        </div>}
                      </div>
                    ) : (
                      <div className="flex flex-col gap-2">
                        {CATEGORIES.map(c => <div key={c} className="flex items-center gap-2"><span className="text-xs text-gray-300 dark:text-gray-700 w-24 truncate shrink-0">{c}</span><div className="flex-1 h-1 bg-gray-100 dark:bg-gray-800 rounded-full"/><span className="text-xs text-gray-300 dark:text-gray-700 w-9 text-right">--%</span></div>)}
                        <p className="text-xs text-gray-400 dark:text-gray-600 text-center mt-1">Waiting for assessment</p>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>

            {/* List view — desktop only */}
            {view === 'list' && (
              <div className="hidden sm:block bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-2xl overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm min-w-700px">
                    <thead><tr className="border-b border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/50">
                      <th className="text-left px-5 py-3.5 text-xs font-semibold text-gray-500 dark:text-gray-400">Student</th>
                      <th className="text-left px-3 py-3.5 text-xs font-semibold text-gray-500 dark:text-gray-400">Status</th>
                      {CATEGORIES.map(c => <th key={c} className="text-center px-3 py-3.5 text-xs font-semibold text-gray-500 dark:text-gray-400 whitespace-nowrap">{c.split(' ')[0]}</th>)}
                      <th className="text-center px-4 py-3.5 text-xs font-semibold text-gray-500 dark:text-gray-400">Overall</th>
                      <th className="px-3 py-3.5"/>
                    </tr></thead>
                    <tbody>
                      {paginated.map((s, i) => { const overall = avg(s.scores); return (
                        <tr key={s.id}
                          onClick={() => setSelectedStudent(s)}
                          className={`border-b border-gray-50 dark:border-gray-800 last:border-0 hover:bg-green-50 dark:hover:bg-green-950/20 hover:cursor-pointer transition-colors ${i%2?'bg-gray-50/30 dark:bg-gray-800/20':''}`}>
                          <td className="px-5 py-4"><div className="flex items-center gap-3">
                            <div className="w-7 h-7 rounded-full bg-green-100 dark:bg-green-900 flex items-center justify-center text-xs font-semibold text-green-700 dark:text-green-300 shrink-0">{ini(s.name)}</div>
                            <div><p className="text-sm font-medium text-gray-900 dark:text-white leading-tight">{s.name}</p><p className="text-xs text-gray-400 dark:text-gray-500">{s.studentId} · {s.course}</p></div>
                          </div></td>
                          <td className="px-3 py-4">
                            {s.status==='completed'?<span className="inline-flex items-center gap-1 text-xs font-medium text-green-700 dark:text-green-300 bg-green-100 dark:bg-green-900 px-2.5 py-1 rounded-full"><span className="w-1 h-1 rounded-full bg-green-500"/>Done</span>:<span className="inline-flex items-center gap-1 text-xs font-medium text-amber-700 dark:text-amber-300 bg-amber-100 dark:bg-amber-900 px-2.5 py-1 rounded-full"><span className="w-1 h-1 rounded-full bg-amber-500"/>Pending</span>}
                          </td>
                          {CATEGORIES.map(c => { const sc = s.scores[c] ?? null; return <td key={c} className="px-3 py-4 text-center"><span className={`text-sm font-semibold ${scoreColor(sc)}`}>{sc!==null?`${sc}%`:'—'}</span></td> })}
                          <td className="px-4 py-4 text-center"><span className={`text-sm font-bold ${scoreColor(overall)}`}>{overall!==null?`${overall}%`:'—'}</span></td>
                          <td className="px-3 py-4 text-center">
                            <button onClick={e => { e.stopPropagation(); setConfirmRemove(s) }} className="p-1.5 rounded-lg text-gray-300 dark:text-gray-700 hover:text-rose-500 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950 transition-colors" title="Remove"><TrashIcon/></button>
                          </td>
                        </tr>
                      )})}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Pagination */}
            <Pagination total={filtered.length} page={page} onPage={setPage} />
          </>
        )}

        {/* Legend */}
        <div className="flex flex-wrap items-center gap-3 px-1 pb-4">
          <p className="text-xs text-gray-400 dark:text-gray-600 mr-1">Score key:</p>
          {[{l:'≥ 80% Strong',c:'bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300'},{l:'60–79% Fair',c:'bg-amber-100 dark:bg-amber-900 text-amber-700 dark:text-amber-300'},{l:'< 60% Needs work',c:'bg-rose-100 dark:bg-rose-900 text-rose-700 dark:text-rose-300'}].map(x => <span key={x.l} className={`text-xs font-medium px-2.5 py-1 rounded-full ${x.c}`}>{x.l}</span>)}
        </div>
      </main>
    </div>
  )
}