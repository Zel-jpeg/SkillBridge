import { useToast } from '../../context/ToastContext'
import { ContentSkeleton } from '../../components/DataSection'
// src/pages/student/StudentAssessment.jsx
//
// Fully wired to real API (Week 4):
//   GET  /api/assessments/            → verifies this route's assigned assessment
//   POST /api/assessments/{id}/start/ → records started_at, returns questions
//   POST /api/assessments/{id}/submit/→ auto-scores, writes SkillScore, generates recommendations
//
// Features:
//   - One question at a time (MCQ, True/False, Identification)
//   - Instructor-set countdown timer (auto-submits at 0, warns at 5 min)
//   - Answers autosaved to localStorage — survives refresh/disconnect
//   - Integrity agreement before the attempt starts
//   - Fullscreen/focus/visibility/shortcut integrity monitoring
//   - Review screen with Edit per question
//   - Confirmation modal before final submit
//   - Question navigator: numbered sidebar (desktop) / collapsible panel (mobile)

import { useState, useEffect, useRef } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import FocusedStudentHeader from '../../components/layout/FocusedStudentHeader'
import api from '../../api/axios'
import { requestErrorMessage } from '../../api/requestErrors'
import { useApi, invalidateCache, fetchWithDedup } from '../../hooks/useApi'
import { remainingAttemptSeconds } from '../../utils/assessmentClock'
import { manilaDateTime } from '../../utils/assessmentDates'
import { attemptStorageKey } from '../../utils/attemptStorage'
import { useAssessmentInterruptions } from '../../hooks/student/useAssessmentInterruptions'
import AssessmentInactivityReminder from '../../components/AssessmentInactivityReminder'

const WARN_AT_SECS = 5 * 60
// Grading and first-use recommendation model loading can exceed the shared 30s timeout.
const SUBMISSION_TIMEOUT_MS = 120000

const STOP_REASON_TEXT = {
  interruption_review: 'Repeated or prolonged interruptions require instructor review. Your recorded answers are preserved.',
  window_lost_focus: 'The assessment window lost focus.',
  tab_hidden: 'The assessment tab or app was hidden.',
  fullscreen_exited: 'Fullscreen mode was exited.',
  restricted_shortcut: 'A restricted keyboard shortcut was used.',
  page_closed: 'The assessment page was refreshed, closed, or left.',
}

function isMobileLikeDevice() {
  const reportedMobile = navigator.userAgentData?.mobile
  if (typeof reportedMobile === 'boolean') return reportedMobile
  return /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent) ||
    (navigator.maxTouchPoints > 1 && window.innerWidth < 768)
}

function getFullscreenElement() {
  return document.fullscreenElement || document.webkitFullscreenElement || null
}

async function enterFullscreen() {
  const root = document.documentElement
  const request = root.requestFullscreen || root.webkitRequestFullscreen
  if (!request) throw new Error('Fullscreen is not supported by this browser.')
  await request.call(root)
}

async function leaveFullscreen() {
  if (!getFullscreenElement()) return
  const exit = document.exitFullscreen || document.webkitExitFullscreen
  if (exit) {
    try { await Promise.resolve(exit.call(document)) } catch { /* fullscreen may already be closing */ }
  }
}

function formatTime(secs) {
  const m = Math.floor(secs / 60).toString().padStart(2, '0')
  const s = (secs % 60).toString().padStart(2, '0')
  return `${m}:${s}`
}

// ── Loading screen ────────────────────────────────────────────────
function AssessmentLoading() {
  return <div className="mx-auto max-w-4xl p-6"><ContentSkeleton layout="assessment" label="Loading assessment" /></div>
}

function AssessmentError({ message, retry = false }) {
  const navigate = useNavigate()
  const isSubmitted = message === 'already_submitted'
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex items-center justify-center px-4">
      <div className="text-center space-y-4 max-w-sm">
        <div className="w-14 h-14 bg-amber-50 dark:bg-amber-950 rounded-2xl flex items-center justify-center mx-auto">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#d97706" strokeWidth="2"
               strokeLinecap="round" strokeLinejoin="round">
            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
            <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
          </svg>
        </div>
        <div>
          <p className="text-base font-semibold text-gray-900 dark:text-white">
            {isSubmitted            ? 'Already submitted'
             : message === 'no_active_assessment' ? 'No active assessment'
             : message === 'not_enrolled'          ? 'Not enrolled in a batch'
             : 'Assessment unavailable'}
          </p>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            {isSubmitted
              ? 'You have already submitted. Check your results.'
              : 'Please check with your instructor or OJT coordinator.'}
          </p>
        </div>
        {retry && <button type="button" onClick={() => fetchWithDedup('/api/assessments/').catch(() => {})} className="rounded-xl border border-green-600 px-4 py-2 text-sm font-semibold text-green-700">Retry</button>}
        <button
          onClick={() => navigate('/student/assessments')}
          className="inline-flex items-center px-5 py-2.5 bg-green-600 text-white text-sm font-medium rounded-xl hover:bg-green-700 transition-colors"
        >
          Back to assessments
        </button>
      </div>
    </div>
  )
}

function IntegrityAgreement({ assessment, student, accepted, onAcceptedChange, onStart, starting, error }) {
  const navigate = useNavigate()
  const mobile = isMobileLikeDevice()
  const rules = [
    'Stay on the assessment screen. Interruptions are recorded without assuming their cause.',
    mobile
      ? 'If a call or system alert interrupts you, return and use Resume assessment.'
      : 'The assessment opens in fullscreen. Restore fullscreen after an interruption to resume.',
    'Your timer continues during interruptions or reloads. Return using the same device and browser.',
    'Copy, paste, cut, print, save, find, refresh, and developer-tool shortcuts are restricted.',
    'Focus interruptions of 2 seconds, or hidden/fullscreen interruptions of 10 seconds, count as incidents. Three incidents or 60 total interrupted seconds require review.',
    'A retake requires approval from an instructor, OJT coordinator, or administrator.',
  ]

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      <FocusedStudentHeader student={student} />
      <main className="max-w-2xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
        <div className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-3xl shadow-sm overflow-hidden">
          <div className="bg-amber-50 dark:bg-amber-950/30 border-b border-amber-100 dark:border-amber-900 px-6 sm:px-8 py-6">
            <div className="flex items-start gap-4">
              <div className="w-11 h-11 rounded-xl bg-amber-100 dark:bg-amber-900 flex items-center justify-center shrink-0 text-amber-700 dark:text-amber-300 font-bold">!</div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-amber-700 dark:text-amber-400">Assessment integrity agreement</p>
                <h1 className="text-xl font-bold text-gray-900 dark:text-white mt-1">Read and confirm before starting</h1>
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">{assessment?.title} · {assessment?.duration_minutes} minutes</p>
                {assessment?.due_at && <p className="mt-2 text-xs leading-5 text-gray-500 dark:text-gray-400">Submission deadline: {manilaDateTime(assessment.due_at)} · Manila. Starting near the deadline gives less than the full time limit.</p>}
              </div>
            </div>
          </div>
          <div className="px-6 sm:px-8 py-6">
            <p className="text-sm text-gray-600 dark:text-gray-300 leading-relaxed mb-4">
              Browser monitoring cannot identify calls, system alerts or every overlay. Charge your device, close chat bubbles and consider Do Not Disturb with emergency exceptions before starting.
            </p>
            <ul className="space-y-3 mb-6">
              {rules.map(rule => (
                <li key={rule} className="flex gap-3 text-sm text-gray-700 dark:text-gray-300 leading-relaxed">
                  <span className="w-5 h-5 rounded-full bg-amber-100 dark:bg-amber-900 text-amber-700 dark:text-amber-300 flex items-center justify-center shrink-0 text-xs font-bold">•</span>
                  <span>{rule}</span>
                </li>
              ))}
            </ul>
            <label className="flex items-start gap-3 p-4 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 cursor-pointer">
              <input
                type="checkbox"
                checked={accepted}
                onChange={event => onAcceptedChange(event.target.checked)}
                className="mt-0.5 w-4 h-4 accent-green-600"
              />
              <span className="text-sm text-gray-700 dark:text-gray-300">I understand these rules and agree that a triggered integrity rule will stop my attempt and record my completed answers.</span>
            </label>
            {error && <p className="mt-3 text-sm text-rose-600 dark:text-rose-400">{error}</p>}
            <div className="flex flex-col-reverse sm:flex-row gap-3 mt-6">
              <button onClick={() => navigate('/student/assessments')} className="flex-1 py-3 rounded-xl border border-gray-200 dark:border-gray-700 text-sm font-medium text-gray-700 dark:text-gray-300">Back to assessments</button>
              <button
                onClick={onStart}
                disabled={!accepted || starting}
                className="flex-1 py-3 rounded-xl bg-green-600 text-white text-sm font-semibold hover:bg-green-700 disabled:bg-gray-200 dark:disabled:bg-gray-800 disabled:text-gray-400 disabled:cursor-not-allowed"
              >
                {starting ? 'Starting…' : mobile ? 'Agree & start' : 'Agree, enter fullscreen & start'}
              </button>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}

function AssessmentStopped({ reason, assessmentId, saving = false, saveError = false, reviewRequired = false, error, onRetry }) {
  const navigate = useNavigate()
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex items-center justify-center px-4">
      <div className="w-full max-w-md bg-white dark:bg-gray-900 border border-rose-100 dark:border-rose-900 rounded-3xl p-7 sm:p-9 shadow-sm">
        <div className="w-14 h-14 rounded-2xl bg-rose-100 dark:bg-rose-950 text-rose-600 dark:text-rose-400 flex items-center justify-center text-2xl font-bold mb-5">!</div>
        <p className="text-xs font-semibold uppercase tracking-wider text-rose-600 dark:text-rose-400">{reviewRequired ? 'Submission requires instructor review' : 'Assessment integrity rule triggered'}</p>
        <h1 className="text-xl font-bold text-gray-900 dark:text-white mt-1">Your assessment was stopped</h1>
        <p className="text-sm text-gray-600 dark:text-gray-300 mt-3 leading-relaxed">{reason || 'An assessment integrity rule was triggered.'}</p>
        <div className="mt-5 p-4 rounded-xl bg-gray-50 dark:bg-gray-800 text-sm text-gray-600 dark:text-gray-300 space-y-2">
          <p>{saving ? 'Saving your completed answers…' : saveError ? 'Saving could not be confirmed. Your completed answers are kept on this device.' : 'Your completed answers were recorded.'}</p>
          {saveError && error && <p role="alert">{error}</p>}
          <p>You must contact your instructor, OJT coordinator, or administrator to request a retake.</p>
        </div>
        {saveError && (
          <button onClick={onRetry} className="w-full mt-4 py-3 rounded-xl bg-rose-600 text-white text-sm font-semibold hover:bg-rose-700">Retry saving now</button>
        )}
        <button onClick={() => navigate(assessmentId ? `/student/assessments/${assessmentId}/results` : '/student/assessments')} disabled={saving || saveError} className="w-full mt-3 py-3 rounded-xl border border-gray-200 dark:border-gray-700 text-sm font-medium text-gray-700 dark:text-gray-300 disabled:opacity-50">View recorded attempt</button>
        {assessmentId && !saving && !saveError && <button onClick={() => navigate(`/student/assessments/${assessmentId}/retake-request`)} className="mt-3 min-h-11 w-full text-sm font-semibold text-green-700 dark:text-green-300">Request a retake</button>}
      </div>
    </div>
  )
}

// ── Question Navigator ────────────────────────────────────────────
function QuestionNavigator({ questions, answers, current, onJump, isReview, className = '' }) {
  function getState(q, idx) {
    const isAnswered = (() => {
      const a = answers[q.id]
      if (!a) return false
      if (q.question_type === 'identification') return (a.text_answer ?? '').trim().length > 0
      return !!a.selected_choice_id
    })()
    const isCurrent = idx === current && !isReview
    return { isAnswered, isCurrent }
  }

  return (
    <div className={`bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-2xl p-4 ${className}`}>
      <div className="flex items-center justify-between mb-3">
        <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Questions</p>
        <p className="text-xs text-gray-400 dark:text-gray-500">
          {questions.filter(q => {
            const a = answers[q.id]
            if (!a) return false
            if (q.question_type === 'identification') return (a.text_answer ?? '').trim().length > 0
            return !!a.selected_choice_id
          }).length}/{questions.length} done
        </p>
      </div>
      <div className="grid grid-cols-5 gap-1.5">
        {questions.map((q, idx) => {
          const { isAnswered, isCurrent } = getState(q, idx)
          return (
            <button
              key={q.id}
              onClick={() => onJump(idx)}
              title={`Q${idx + 1}: ${q.question_text?.slice(0, 60) ?? ''}…`}
              className={`
                w-full aspect-square rounded-lg text-xs font-semibold transition-all
                ${isCurrent
                  ? 'bg-green-600 text-white ring-2 ring-green-300 dark:ring-green-700 scale-110 shadow-md'
                  : isAnswered
                  ? 'bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300 hover:bg-green-200 dark:hover:bg-green-800'
                  : 'bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'
                }
              `}
            >
              {idx + 1}
            </button>
          )
        })}
      </div>
      {/* Legend */}
      <div className="mt-3 flex flex-wrap gap-2">
        <span className="flex items-center gap-1 text-[10px] text-gray-400 dark:text-gray-500">
          <span className="w-2.5 h-2.5 rounded bg-green-600 inline-block" /> Current
        </span>
        <span className="flex items-center gap-1 text-[10px] text-gray-400 dark:text-gray-500">
          <span className="w-2.5 h-2.5 rounded bg-green-100 dark:bg-green-900 inline-block" /> Answered
        </span>
        <span className="flex items-center gap-1 text-[10px] text-gray-400 dark:text-gray-500">
          <span className="w-2.5 h-2.5 rounded bg-gray-100 dark:bg-gray-800 inline-block" /> Skipped
        </span>
      </div>
    </div>
  )
}

// ════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ════════════════════════════════════════════════════════════════════
export default function StudentAssessment() {
  const { showToast } = useToast()
  const navigate = useNavigate()
  const { assessmentId: routeAssessmentId } = useParams()

  // Read cached user for the focused agreement header (instant render)
  const cachedUser = (() => { try { return JSON.parse(localStorage.getItem('sb-user')) } catch { return null } })()
  const attemptKey = (kind, id) => attemptStorageKey(kind, cachedUser?.id ?? 'missing-user', id)
  const navStudent = {
    name:      cachedUser?.name     || 'Student',
    initials:  (cachedUser?.name || 'ST').split(' ').map(n => n[0]).slice(0, 2).join(''),
    studentId: cachedUser?.school_id || '',
    course:    cachedUser?.course    || '',
    photoUrl:  cachedUser?.photo_url || null,
  }

  // Only IDs returned by the student's batch-scoped list can start an attempt.
  const validRouteId = /^\d+$/.test(routeAssessmentId || '')
  const { data: assessmentList, loading: checkingActive, error: activeError } = useApi('/api/assessments/')
  const activeInfo = validRouteId
    ? assessmentList?.assessments?.find(item => String(item.id) === routeAssessmentId)
    : null

  // ── Step 2: Agreement, then start the server attempt ───────────
  const [questions,    setQuestions]    = useState([])
  const [responseId,   setResponseId]   = useState(null)
  const [assessmentId, setAssessmentId] = useState(null)
  const [startError,   setStartError]   = useState(null)
  const [starting,     setStarting]     = useState(false)
  const [started,      setStarted]      = useState(false)
  const [interruptionSeed, setInterruptionSeed] = useState(null)
  const [agreementAccepted, setAgreementAccepted] = useState(false)
  const [stoppedAttempt, setStoppedAttempt] = useState(null)
  const [initialSecs,  setInitialSecs]  = useState(3600) // fallback 60 min

  // ── Step 3: Local state ────────────────────────────────────────
  const storageKey = assessmentId ? attemptKey('answers', assessmentId) : null

  const [answers, setAnswers] = useState(() => {
    // Pre-load locally saved answers for this assessment if they exist
    try {
      const key  = activeInfo?.id ? attemptKey('answers', activeInfo.id) : null
      return key ? JSON.parse(localStorage.getItem(key) ?? 'null') ?? {} : {}
    } catch { return {} }
  })
  const [timeLeft, setTimeLeft] = useState(initialSecs)
  const [attemptCutoff, setAttemptCutoff] = useState(null)

  const [current,      setCurrent]      = useState(0)
  const [showConfirm,  setShowConfirm]  = useState(false)
  const [showWarning,  setShowWarning]  = useState(false)
  const [submitting,   setSubmitting]   = useState(false)
  const [identText,    setIdentText]    = useState({})      // { [questionId]: string }
  const [showNavPanel, setShowNavPanel] = useState(false)   // mobile navigator toggle
  const warningShown = useRef(false)
  const answersRef = useRef(answers)
  const assessmentIdRef = useRef(null)
  const responseIdRef = useRef(null)
  const attemptIdentityRef = useRef(null)
  const deadlineRef = useRef(0)
  const timingSyncRef = useRef(null)
  const autoSubmitAttemptedRef = useRef(false)
  const integrityArmedRef = useRef(false)
  const finalizingRef = useRef(false)
  const fullscreenRequiredRef = useRef(false)
  const interruptedRef = useRef(false)

  useEffect(() => { answersRef.current = answers }, [answers])
  useEffect(() => { assessmentIdRef.current = assessmentId }, [assessmentId])
  useEffect(() => { responseIdRef.current = responseId }, [responseId])

  function answersArrayFrom(savedAnswers = answersRef.current) {
    return Object.entries(savedAnswers || {}).map(([qId, ans]) => ({
      question_id: parseInt(qId, 10),
      selected_choice_id: ans.selected_choice_id ?? null,
      text_answer: ans.text_answer ?? '',
    }))
  }

  function clearAttemptStorage(id) {
    if (!id) return
    try {
      localStorage.removeItem(attemptKey('answers', id))
      localStorage.removeItem(attemptKey('timer', id))
      localStorage.removeItem(attemptKey('integrity_active', id))
    } catch { /* browser cleanup must not undo a confirmed server save */ }
  }

  function updateCachedAttemptStatus(status) {
    try {
      const cached = JSON.parse(localStorage.getItem('sb-user'))
      if (cached) localStorage.setItem('sb-user', JSON.stringify({
        ...cached,
        has_submitted: true,
        retake_allowed: false,
        attempt_status: status,
      }))
    } catch { /* localStorage may be unavailable */ }
  }

  async function finishRecordedAttempt(record) {
    const id = assessmentIdRef.current
    finalizingRef.current = true
    integrityArmedRef.current = false
    setStarted(false)
    clearAttemptStorage(id)
    for (const url of [
      '/api/student/results/', '/api/student/results/combined/', '/api/assessments/',
      `/api/student/results/?assessment_id=${id}`, `/api/student/results/review/?assessment_id=${id}`,
      '/api/assessments/active/', '/api/students/me/',
    ]) invalidateCache(url)
    const stopped = record.attempt_status === 'stopped'
    updateCachedAttemptStatus(stopped ? 'stopped' : 'submitted')
    await leaveFullscreen()
    if (stopped) {
      setSubmitting(false)
      setStoppedAttempt({
        reasonDisplay: record.stopped_reason_display || record.message,
        reviewRequired: record.review_required || record.stopped_reason === 'attempt_expired',
        saving: false,
        saveError: false,
      })
    } else {
      showToast('Assessment submitted successfully. Your responses have been saved.')
      navigate(`/student/assessments/${id}/results`, { replace: true })
    }
  }

  async function reconcileFinalizedAttempt() {
    try {
      // Read directly: the cached list may predate a write whose response timed out.
      const { data } = await api.get('/api/assessments/')
      const record = data.assessments?.find(item => String(item.id) === String(assessmentIdRef.current))
      const normalize = value => typeof value === 'string' ? value.replace(/Z$/, '+00:00') : null
      if (!record?.submitted_at || !['submitted', 'stopped'].includes(record.attempt_status) ||
          !attemptIdentityRef.current || normalize(record.started_at) !== normalize(attemptIdentityRef.current)) return false
      await finishRecordedAttempt(record)
      return true
    } catch { return false /* retain local answers if verification is unavailable */ }
  }

  async function handleAgreementStart() {
    if (!agreementAccepted || !activeInfo?.id || starting) return
    setStarting(true)
    setStartError(null)
    const mobile = isMobileLikeDevice()
    fullscreenRequiredRef.current = !mobile

    try {
      if (!mobile) await enterFullscreen()
      const res = await api.post(`/api/assessments/${activeInfo.id}/start/`)
      const id = activeInfo.id
      setAssessmentId(id)
      assessmentIdRef.current = id
      setResponseId(res.data.response_id)
      responseIdRef.current = res.data.response_id
      attemptIdentityRef.current = res.data.attempt_started_at
      setQuestions(res.data.questions || [])

      const answerKey = attemptKey('answers', id)
      let restoredAnswers = {}
      restoredAnswers = Object.fromEntries((res.data.draft_answers || []).map(answer => [answer.question_id, answer]))
      try {
        const savedMarker = JSON.parse(localStorage.getItem(attemptKey('integrity_active', id)) || '{}')
        if (savedMarker.attempt_started_at === res.data.attempt_started_at) restoredAnswers = JSON.parse(localStorage.getItem(answerKey) || 'null') || restoredAnswers
      } catch { /* server draft remains available */ }
      setInterruptionSeed(res.data.interruption || null)
      setAnswers(restoredAnswers)
      answersRef.current = restoredAnswers

      const secs = res.data.time_limit_sec ?? activeInfo.duration_minutes * 60
      setInitialSecs(secs)
      const timer = Math.max(0, res.data.remaining_seconds ?? 0)
      deadlineRef.current = performance.now() + timer * 1000
      setAttemptCutoff(res.data.deadline_at || null)
      autoSubmitAttemptedRef.current = false
      let priorInterruption
      try { priorInterruption = JSON.parse(localStorage.getItem(attemptKey('integrity_active', id)) || '{}') } catch { /* fresh marker */ }
      localStorage.setItem(attemptKey('integrity_active', id), JSON.stringify({
        interruption: priorInterruption?.attempt_started_at === res.data.attempt_started_at ? priorInterruption.interruption : null,
        response_id: res.data.response_id,
        started_at: res.data.started_at,
        attempt_started_at: res.data.attempt_started_at,
      }))
      setTimeLeft(Math.ceil(timer))
      setStarted(true)
      requestAnimationFrame(() => { integrityArmedRef.current = true })
    } catch (err) {
      integrityArmedRef.current = false
      await leaveFullscreen()
      setStartError(err.response?.data?.error || err.message || 'Failed to start assessment')
    } finally {
      setStarting(false)
    }
  }

  const TOTAL    = questions.length
  const isReview = TOTAL > 0 && current === TOTAL
  const question = questions[current]
  const answered = TOTAL > 0
    ? questions.filter(q => {
        const a = answers[q.id]
        if (!a) return false
        if (q.question_type === 'identification') return (a.text_answer ?? '').trim().length > 0
        return !!a.selected_choice_id
      }).length
    : 0

  async function submitIntegrityStop(reason, detail = '', { unloading = false, retry = false } = {}) {
    const id = assessmentIdRef.current
    if (!id || (!retry && (finalizingRef.current || !integrityArmedRef.current))) return

    finalizingRef.current = true
    integrityArmedRef.current = false
    const reasonText = `${STOP_REASON_TEXT[reason] || 'An assessment integrity rule was triggered.'}${detail ? ` (${detail})` : ''}`
    const payload = {
      response_id: responseIdRef.current,
      attempt_started_at: attemptIdentityRef.current,
      answers: answersArrayFrom(),
      reason,
      detail,
      occurred_at: new Date().toISOString(),
    }

    if (unloading) {
      const token = localStorage.getItem('sb-token')
      const base = api.defaults.baseURL || window.location.origin
      const url = new URL(`/api/assessments/${id}/stop/`, base).toString()
      fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(payload),
        keepalive: true,
      }).catch(() => {})
      return
    }

    setStarted(false)
    setStoppedAttempt({ reason, detail, reasonDisplay: reasonText, saving: true, saveError: false })
    try {
      const res = await api.post(`/api/assessments/${id}/stop/`, payload)
      clearAttemptStorage(id)
      invalidateCache('/api/assessments/')
      invalidateCache('/api/assessments/active/')
      invalidateCache('/api/students/me/')
      invalidateCache('/api/student/results/')
      invalidateCache('/api/student/results/combined/')
      invalidateCache(`/api/student/results/?assessment_id=${id}`)
      invalidateCache(`/api/student/results/review/?assessment_id=${id}`)
      updateCachedAttemptStatus('stopped')
      await leaveFullscreen()
      setStoppedAttempt({
        reason,
        detail,
        reasonDisplay: res.data.stopped_reason_display || reasonText,
        reviewRequired: res.data.review_required,
        saving: false,
        saveError: false,
      })
    } catch (err) {
      if (await reconcileFinalizedAttempt()) return
      finalizingRef.current = false
      setStoppedAttempt({
        reason,
        detail,
        reasonDisplay: reasonText,
        saving: false,
        saveError: true,
        error: err.response?.data?.error || 'Could not reach the server.',
      })
    }
  }

  // A confirmed finalized list response makes a leftover local marker obsolete.
  // Active attempts still recover through the neutral interruption flow below.
  useEffect(() => {
    if (activeInfo?.id && !started && !starting && !activeInfo.retake_allowed &&
        ['submitted', 'stopped'].includes(activeInfo.attempt_status)) clearAttemptStorage(activeInfo.id)
  }, [activeInfo, started, starting]) // eslint-disable-line react-hooks/exhaustive-deps

  const recovery = useAssessmentInterruptions({
    active: started && !submitting && !stoppedAttempt,
    assessmentId, responseId, identity: attemptIdentityRef.current,
    markerKey: assessmentId ? attemptKey('integrity_active', assessmentId) : null,
    seed: interruptionSeed, answers: answersArrayFrom,
    requireFullscreen: () => fullscreenRequiredRef.current,
    fullscreenElement: getFullscreenElement, enterFullscreen,
    onStop: submitIntegrityStop,
    onTiming: data => {
      deadlineRef.current = performance.now() + Math.max(0, data.remaining_seconds) * 1000
      setTimeLeft(Math.ceil(Math.max(0, data.remaining_seconds))); setAttemptCutoff(data.deadline_at)
      autoSubmitAttemptedRef.current = false
    },
    onWarning: text => showToast(text, 'info', 6000),
  })
  useEffect(() => { interruptedRef.current = Boolean(recovery.interruption) }, [recovery.interruption])

  // Read-only synchronization applies explicit staff extensions without
  // restarting an attempt, resetting integrity, or replacing local answers.
  useEffect(() => {
    if (!started || submitting) return
    let active = true
    let pending = null
    const controller = new AbortController()
    const synchronize = () => {
      if (pending) return pending
      pending = api.get(`/api/assessments/${assessmentIdRef.current}/timing/`, {
        params: { attempt_started_at: attemptIdentityRef.current }, signal: controller.signal, timeout: 5000,
      }).then(({ data }) => {
        if (!active || data.status !== 'in_progress') return null
        const remaining = Math.max(0, data.remaining_seconds)
        deadlineRef.current = performance.now() + remaining * 1000
        setTimeLeft(Math.ceil(remaining)); setAttemptCutoff(data.deadline_at)
        return remaining
      }).catch(() => null).finally(() => { pending = null })
      return pending
    }
    timingSyncRef.current = synchronize
    const interval = setInterval(synchronize, 15000)
    return () => {
      active = false; controller.abort(); clearInterval(interval)
      if (timingSyncRef.current === synchronize) timingSyncRef.current = null
    }
  }, [started, submitting])

  // ── Countdown timer ────────────────────────────────────────────
  useEffect(() => {
    if (!started || submitting) return
    let active = true
    const tick = () => {
      const next = remainingAttemptSeconds(deadlineRef.current, performance.now())
      setTimeLeft(next)
      if (next > 0 && next <= WARN_AT_SECS && !warningShown.current) {
        warningShown.current = true
        setShowWarning(true)
      }
      if (next <= 0 && !autoSubmitAttemptedRef.current && !interruptedRef.current) {
        autoSubmitAttemptedRef.current = true
        // Check once at the old cutoff so an extension granted just before it
        // cannot be missed between regular timing reads.
        Promise.resolve(timingSyncRef.current?.()).then(remaining => {
          if (!active) return
          if (remaining > 0) autoSubmitAttemptedRef.current = false
          else if (!finalizingRef.current) handleSubmit({ automatic: true })
        })
      }
    }
    const interval = setInterval(tick, 1000)
    tick()
    return () => { active = false; clearInterval(interval) }
  }, [started, submitting]) // eslint-disable-line

  // ── Answer selection ───────────────────────────────────────────
  function selectChoice(questionId, choiceId) {
    if (finalizingRef.current || remainingAttemptSeconds(deadlineRef.current, performance.now()) <= 0) return
    const updated = { ...answers, [questionId]: { selected_choice_id: choiceId, text_answer: '' } }
    answersRef.current = updated
    setAnswers(updated)
    if (storageKey) localStorage.setItem(storageKey, JSON.stringify(updated))
  }

  function setIdentificationText(questionId, text) {
    if (finalizingRef.current || remainingAttemptSeconds(deadlineRef.current, performance.now()) <= 0) return
    setIdentText(prev => ({ ...prev, [questionId]: text }))
    const updated = { ...answers, [questionId]: { selected_choice_id: null, text_answer: text } }
    answersRef.current = updated
    setAnswers(updated)
    if (storageKey) localStorage.setItem(storageKey, JSON.stringify(updated))
  }

  // ── Submit ─────────────────────────────────────────────────────
  async function handleSubmit(options = {}) {
    const automatic = options?.automatic === true
    if (interruptedRef.current) return
    if (finalizingRef.current) return
    finalizingRef.current = true
    integrityArmedRef.current = false
    setShowConfirm(false)
    setShowWarning(false)
    setSubmitting(true)

    const answersArray = answersArrayFrom()

    let result
    try {
      result = await api.post(`/api/assessments/${assessmentId}/submit/`, {
        answers:     answersArray,
        response_id: responseId,
        attempt_started_at: attemptIdentityRef.current,
        auto_submit: automatic,
      }, { timeout: SUBMISSION_TIMEOUT_MS })
    } catch (err) {
      const remaining = err.response?.data
      if (automatic && remaining?.code === 'attempt_time_remaining' && remaining.attempt_started_at === attemptIdentityRef.current && Number.isFinite(remaining.remaining_seconds) && remaining.remaining_seconds > 0) {
        deadlineRef.current = performance.now() + remaining.remaining_seconds * 1000
        setTimeLeft(Math.ceil(remaining.remaining_seconds)); setAttemptCutoff(remaining.deadline_at)
        autoSubmitAttemptedRef.current = false
        finalizingRef.current = false; integrityArmedRef.current = true; setSubmitting(false)
        showToast('Your attempt still has time remaining. The countdown has been updated.')
        return
      }
      // A timeout does not roll back the server transaction. Verify before
      // re-arming integrity monitoring or offering another submission.
      if (await reconcileFinalizedAttempt()) return
      finalizingRef.current = false
      integrityArmedRef.current = true
      setSubmitting(false)
      const message = requestErrorMessage(err, { mutation: true })
      showToast(`${message} Your answers are kept on this device. Check the assessment list before retrying.`, 'error', 12000)
      return
    }
    await finishRecordedAttempt(result.data)
  }

  // ── Render guards ──────────────────────────────────────────────
  if (submitting) return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex flex-col items-center justify-center gap-6 px-4">
      <div className="w-16 h-16 rounded-2xl bg-green-600 flex items-center justify-center shadow-lg animate-pulse">
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M20 6L9 17l-5-5"/>
        </svg>
      </div>
      <div className="text-center">
        <p className="text-lg font-bold text-gray-900 dark:text-white">Analyzing your answers…</p>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 max-w-xs">
          Our system is scoring your responses and finding your best partner matches. This may take a few seconds.
        </p>
      </div>
      <div className="flex gap-1.5">
        {[0,1,2].map(i => (
          <div key={i} className="w-2 h-2 rounded-full bg-green-500 animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />
        ))}
      </div>
    </div>
  )
  if (checkingActive && !started && !stoppedAttempt) return <AssessmentLoading />
  if (activeError && !started && !stoppedAttempt) return <AssessmentError message={activeError} retry />
  if (!activeInfo && !started && !stoppedAttempt) return <AssessmentError message="unavailable" />
  if (!started && !stoppedAttempt && activeInfo.availability_status !== 'available') return <AssessmentError message="unavailable" />
  if (!started && !stoppedAttempt && activeInfo.attempt_status === 'submitted' && !activeInfo.retake_allowed) return <AssessmentError message="already_submitted" />
  if (!started && !stoppedAttempt && activeInfo?.attempt_status === 'stopped' && !activeInfo?.retake_allowed) {
    return <AssessmentStopped reason={activeInfo.stopped_reason_display} assessmentId={activeInfo.id} reviewRequired={activeInfo.stopped_reason === 'attempt_expired'} />
  }
  if (stoppedAttempt) return (
    <AssessmentStopped
      reason={stoppedAttempt.reasonDisplay}
      assessmentId={assessmentId}
      saving={stoppedAttempt.saving}
      saveError={stoppedAttempt.saveError}
      reviewRequired={stoppedAttempt.reviewRequired}
      error={stoppedAttempt.error}
      onRetry={() => submitIntegrityStop(stoppedAttempt.reason, stoppedAttempt.detail, { retry: true })}
    />
  )
  if (!started) return (
    <IntegrityAgreement
      assessment={activeInfo}
      student={navStudent}
      accepted={agreementAccepted}
      onAcceptedChange={setAgreementAccepted}
      onStart={handleAgreementStart}
      starting={starting}
      error={startError}
    />
  )
  if (started && recovery.interruption) return <div className="min-h-screen bg-gray-50 px-4 py-12 text-gray-900 dark:bg-gray-950 dark:text-white">
    <section className="mx-auto max-w-lg rounded-2xl border border-amber-200 bg-white p-6 dark:border-amber-900 dark:bg-gray-900" aria-labelledby="interruption-title">
      <h1 id="interruption-title" className="text-xl font-bold">Assessment interrupted</h1>
      <p className="mt-4 text-sm">Your answers are preserved. The timer continues while you are away. A call, system alert or app change can cause an interruption; this does not establish cheating.</p>
      <p className="mt-3 text-sm">Remaining time: {formatTime(timeLeft)} · Interrupted for about {recovery.interruption.elapsed || 0} seconds</p>
      <p className="mt-3 text-sm">Return within 10 seconds where possible. Three counted incidents or 60 cumulative interrupted seconds require instructor review.</p>
      {recovery.error && <p role="alert" className="mt-4 text-sm text-rose-700 dark:text-rose-300">{recovery.error}</p>}
      <button type="button" disabled={recovery.busy} onClick={recovery.recover} className="mt-5 min-h-11 rounded-xl bg-green-700 px-5 py-3 font-semibold text-white disabled:opacity-50">{recovery.busy ? 'Checking recovery…' : 'Resume assessment'}</button>
    </section>
  </div>
  if (started && TOTAL === 0)     return <AssessmentError message="empty_assessment" />

  // ── Timer display ──────────────────────────────────────────────
  const isCritical       = timeLeft <= WARN_AT_SECS
  const isTimerWarning   = timeLeft <= WARN_AT_SECS * 2
  const timerPillClass   = isCritical
    ? 'bg-red-500 text-white shadow-red-200 dark:shadow-red-900 shadow-md'
    : isTimerWarning
    ? 'bg-amber-500 text-white shadow-amber-200 dark:shadow-amber-900 shadow-md'
    : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-200'

  const progressPct = isReview ? 100 : (TOTAL > 0 ? Math.round((current / TOTAL) * 100) : 0)

  // ── Choice display helper ──────────────────────────────────────
  function getChoiceLabel(idx) {
    return String.fromCharCode(65 + idx) // A, B, C, D
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex flex-col relative">
      {!showConfirm && !showWarning && !showNavPanel && timeLeft > 0 && <AssessmentInactivityReminder key={`${assessmentId}-${attemptIdentityRef.current}`} />}

      <div className="bg-white dark:bg-gray-900 border-b border-gray-100 dark:border-gray-800 px-4 sm:px-6 h-14 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <img src="/SB-logov1.png" alt="SkillBridge" className="w-7 h-7 rounded-md object-cover" />
          <span className="text-sm font-semibold text-gray-900 dark:text-white">{activeInfo?.title || 'Assessment'}</span>
        </div>
        <span className="inline-flex items-center gap-2 text-xs font-semibold text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950 px-3 py-1.5 rounded-full">
          <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse" /> Integrity monitoring active
        </span>
      </div>

      {/* Sub-bar: question counter + timer + leave button */}
      <div className="bg-white dark:bg-gray-900 border-b border-gray-100 dark:border-gray-800 px-4 sm:px-6 py-2.5 flex items-center justify-between gap-3">

        <span className="text-xs font-medium text-gray-500 dark:text-gray-400 shrink-0">Do not leave this screen</span>

        {/* Centre: Timer */}
        {started && (
          <div role="timer" aria-label="Time remaining" aria-live="off" className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl font-mono font-bold text-sm transition-colors ${timerPillClass} ${isCritical ? 'animate-pulse' : ''}`}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" className="shrink-0">
              <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2.2"/>
              <path d="M12 7v5l3 3" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"/>
            </svg>
            {formatTime(timeLeft)}
            {isCritical && <span className="text-xs font-semibold opacity-90 hidden sm:inline">Low!</span>}
          </div>
        )}

        {/* Right: answered count */}
        <span className="text-xs text-gray-400 dark:text-gray-500 shrink-0">
          {started ? `${answered}/${TOTAL} answered` : ''}
        </span>
      </div>

      {started && attemptCutoff && <p className="px-4 py-1 text-center text-xs text-gray-500 dark:text-gray-400">Attempt ends {manilaDateTime(attemptCutoff)} · Manila</p>}
      {/* Progress bar */}
      <div className="h-1 bg-gray-100 dark:bg-gray-800">
        <div className="h-full bg-green-500 transition-all duration-500" style={{ width: `${progressPct}%` }} />
      </div>

      {/* ── MAIN LAYOUT: question area + navigator ── */}
      <main className="flex-1 flex justify-center px-4 sm:px-6 py-6 sm:py-10">
        {/* On desktop: 2-col (question | navigator). On mobile: single col + floating toggle */}
        <div className="w-full max-w-5xl flex gap-6 items-start">

          {/* ── QUESTION / REVIEW column ── */}
          <div className="flex-1 min-w-0">

            {/* ── QUESTION ─ */}
            {started && !isReview && question && (
              <div>
                <h2 className="text-base sm:text-lg font-bold text-gray-900 dark:text-white mb-5 sm:mb-6 leading-snug">
                  <span className="whitespace-pre-wrap">{question.question_text || question.text}</span>
                </h2>

                {/* MCQ / True-False choices */}
                {question.question_type !== 'identification' && (
                  <div className="flex flex-col gap-2.5 sm:gap-3 mb-6 sm:mb-8">
                    {(question.choices || []).map((choice, idx) => {
                      const selected = answers[question.id]?.selected_choice_id === choice.id
                      return (
                        <button
                          key={choice.id}
                          disabled={timeLeft <= 0}
                          onClick={() => selectChoice(question.id, choice.id)}
                          className={`w-full text-left px-4 sm:px-5 py-3.5 sm:py-4 rounded-xl border text-sm transition-all active:scale-[0.99]
                            ${selected
                              ? 'bg-green-50 dark:bg-green-950 border-green-500 text-green-800 dark:text-green-200 font-medium'
                              : 'bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:border-green-300 dark:hover:border-green-700'
                            }`}
                        >
                          <span className={`inline-flex items-center justify-center w-5 h-5 rounded-full border mr-3 text-xs shrink-0
                            ${selected ? 'bg-green-500 border-green-500 text-white' : 'border-gray-300 dark:border-gray-600 text-gray-400'}`}>
                            {getChoiceLabel(idx)}
                          </span>
                          {choice.text || choice.choice_text}
                        </button>
                      )
                    })}
                  </div>
                )}

                {/* Identification answer input */}
                {question.question_type === 'identification' && (
                  <div className="mb-6 sm:mb-8">
                    <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-2">
                      Type your answer below:
                    </label>
                    <input
                      type="text"
                      disabled={timeLeft <= 0}
                      value={identText[question.id] ?? answers[question.id]?.text_answer ?? ''}
                      onChange={e => setIdentificationText(question.id, e.target.value)}
                      placeholder="Your answer…"
                      className="w-full px-4 py-3.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-gray-600 focus:outline-none focus:ring-2 focus:ring-green-500 text-sm"
                    />
                    <p className="text-xs text-gray-400 dark:text-gray-600 mt-2">Answer is not case-sensitive.</p>
                  </div>
                )}

                {/* Navigation */}
                <div className="flex gap-3">
                  {current > 0 && (
                    <button
                      onClick={() => setCurrent(prev => prev - 1)}
                      className="flex-1 py-3.5 rounded-xl border border-gray-200 dark:border-gray-700 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                    >
                      Back
                    </button>
                  )}
                  <button
                    onClick={() => setCurrent(prev => prev + 1)}
                    disabled={
                      question.question_type === 'identification'
                        ? !(answers[question.id]?.text_answer?.trim())
                        : !answers[question.id]?.selected_choice_id
                    }
                    className={`flex-1 py-3.5 rounded-xl text-sm font-semibold transition-colors
                      ${(question.question_type === 'identification'
                          ? answers[question.id]?.text_answer?.trim()
                          : answers[question.id]?.selected_choice_id)
                        ? 'bg-green-600 text-white hover:bg-green-700 active:bg-green-800'
                        : 'bg-gray-100 dark:bg-gray-800 text-gray-400 cursor-not-allowed'}`}
                  >
                    {current === TOTAL - 1 ? 'Review answers' : 'Next →'}
                  </button>
                </div>
                {!(question.question_type === 'identification'
                    ? answers[question.id]?.text_answer?.trim()
                    : answers[question.id]?.selected_choice_id) && (
                  <p className="text-center text-xs text-gray-400 dark:text-gray-600 mt-3">Answer this question to continue</p>
                )}
                <p className="text-center text-xs text-gray-300 dark:text-gray-700 mt-4">Your answers are saved automatically</p>
              </div>
            )}

            {/* ── REVIEW ─ */}
            {started && isReview && (
              <div>
                <div className="mb-5">
                  <h2 className="text-lg sm:text-xl font-bold text-gray-900 dark:text-white mb-1">Review your answers</h2>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    {answered === TOTAL
                      ? 'All questions answered. Ready to submit.'
                      : `${TOTAL - answered} unanswered — tap Edit to go back.`}
                  </p>
                </div>
                <div className="flex flex-col gap-2 mb-6">
                  {questions.map((q, i) => {
                    const ans = answers[q.id]
                    const isIdent = q.question_type === 'identification'
                    const displayAnswer = isIdent
                      ? ans?.text_answer?.trim() || null
                      : (q.choices || []).find(c => c.id === ans?.selected_choice_id)?.text || (q.choices || []).find(c => c.id === ans?.selected_choice_id)?.choice_text || null
                    return (
                      <div key={q.id} className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-xl px-4 py-3 flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <p className="text-xs text-gray-400 dark:text-gray-500 mb-0.5">Q{i + 1} · {isIdent ? 'Identification' : q.question_type === 'truefalse' ? 'True/False' : 'MCQ'}</p>
                          <p className="text-sm text-gray-700 dark:text-gray-300 line-clamp-2">{q.question_text || q.text}</p>
                          {displayAnswer
                            ? <p className="text-xs text-green-600 dark:text-green-400 font-medium mt-1">"{displayAnswer}"</p>
                            : <p className="text-xs text-amber-500 font-medium mt-1">Not answered</p>
                          }
                        </div>
                        <button
                          onClick={() => setCurrent(i)}
                          className="text-xs font-medium text-gray-400 dark:text-gray-500 hover:text-green-600 dark:hover:text-green-400 shrink-0 mt-0.5 transition-colors px-2 py-1 -mr-1"
                        >
                          Edit
                        </button>
                      </div>
                    )
                  })}
                </div>
                <div className="flex gap-3">
                  <button
                    onClick={() => setCurrent(TOTAL - 1)}
                    className="flex-1 py-3.5 rounded-xl border border-gray-200 dark:border-gray-700 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                  >
                    Back
                  </button>
                  <button
                    onClick={() => setShowConfirm(true)}
                    className="flex-1 py-3.5 rounded-xl bg-green-600 text-white text-sm font-semibold hover:bg-green-700 transition-colors"
                  >
                    Submit
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* ── NAVIGATOR — desktop sidebar (hidden on mobile) ── */}
          {started && TOTAL > 0 && (
            <div className="hidden lg:block w-56 xl:w-64 shrink-0 sticky top-6">
              <QuestionNavigator
                questions={questions}
                answers={answers}
                current={current}
                onJump={idx => { setCurrent(idx); setShowNavPanel(false) }}
                isReview={isReview}
              />
            </div>
          )}
        </div>
      </main>

      {/* ── MOBILE NAVIGATOR — floating button + bottom panel ── */}
      {started && TOTAL > 0 && (
        <>
          {/* Floating toggle button — only visible on mobile/tablet (<lg) */}
          <button
            onClick={() => setShowNavPanel(prev => !prev)}
            className="lg:hidden fixed bottom-6 right-4 z-40 bg-green-600 hover:bg-green-700 text-white rounded-2xl shadow-lg px-4 py-2.5 flex items-center gap-2 text-sm font-semibold transition-all"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/>
              <rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>
            </svg>
            {answered}/{TOTAL}
          </button>

          {/* Bottom panel overlay */}
          {showNavPanel && (
            <div className="lg:hidden fixed inset-0 z-50 flex flex-col justify-end">
              {/* Backdrop */}
              <div
                className="absolute inset-0 bg-black/30 backdrop-blur-sm"
                onClick={() => setShowNavPanel(false)}
              />
              {/* Panel */}
              <div className="relative bg-white dark:bg-gray-900 rounded-t-2xl p-5 shadow-2xl max-h-[60vh] overflow-y-auto">
                <div className="flex items-center justify-between mb-4">
                  <p className="text-sm font-bold text-gray-900 dark:text-white">Question Navigator</p>
                  <button
                    onClick={() => setShowNavPanel(false)}
                    className="w-7 h-7 flex items-center justify-center rounded-lg bg-gray-100 dark:bg-gray-800 text-gray-500 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
                  >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                      <path d="M18 6L6 18M6 6l12 12"/>
                    </svg>
                  </button>
                </div>
                <QuestionNavigator
                  questions={questions}
                  answers={answers}
                  current={current}
                  onJump={idx => { setCurrent(idx); setShowNavPanel(false) }}
                  isReview={isReview}
                  className="border-0 p-0"
                />
              </div>
            </div>
          )}
        </>
      )}

      {/* 5-MIN WARNING */}
      {showWarning && (
        <div className="fixed inset-0 bg-black/40 dark:bg-black/60 flex items-end sm:items-center justify-center z-50 p-4 sm:px-6">
          <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 p-6 sm:p-8 w-full max-w-sm">
            <div className="w-12 h-12 bg-amber-100 dark:bg-amber-900 rounded-xl flex items-center justify-center mb-4">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
                <path d="M12 9v4M12 17h.01" stroke="#d97706" strokeWidth="2.2" strokeLinecap="round"/>
                <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" stroke="#d97706" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
            <h3 className="text-base font-bold text-gray-900 dark:text-white mb-2">5 minutes remaining</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-5 leading-relaxed">
              Your assessment will be automatically submitted when time runs out. Unanswered questions will be left blank.
            </p>
            <button
              onClick={() => setShowWarning(false)}
              className="w-full py-3.5 rounded-xl bg-amber-500 text-white text-sm font-semibold hover:bg-amber-600 transition-colors"
            >
              Got it, keep going
            </button>
          </div>
        </div>
      )}

      {/* CONFIRM SUBMIT */}
      {showConfirm && (
        <div className="fixed inset-0 bg-black/40 dark:bg-black/60 flex items-end sm:items-center justify-center z-50 p-4 sm:px-6">
          <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 p-6 sm:p-8 w-full max-w-sm">
            <div className="w-12 h-12 bg-green-100 dark:bg-green-900 rounded-xl flex items-center justify-center mb-4">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
                <path d="M9 12l2 2 4-4" stroke="#16a34a" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
                <circle cx="12" cy="12" r="9" stroke="#16a34a" strokeWidth="2"/>
              </svg>
            </div>
            <h3 className="text-base font-bold text-gray-900 dark:text-white mb-2">Submit your assessment?</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-5 leading-relaxed">
              You answered <span className="font-semibold text-gray-700 dark:text-gray-200">{answered} of {TOTAL}</span> questions.
              Once submitted, you cannot change your answers.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowConfirm(false)}
                className="flex-1 py-3.5 rounded-xl border border-gray-200 dark:border-gray-700 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
              >
                Go back
              </button>
              <button
                onClick={handleSubmit}
                className="flex-1 py-3.5 rounded-xl bg-green-600 text-white text-sm font-semibold hover:bg-green-700 transition-colors"
              >
                Yes, submit
              </button>
            </div>
          </div>
        </div>
      )}

      {/* SUBMITTING OVERLAY */}
      {submitting && (
        <div className="fixed inset-0 bg-white/80 dark:bg-gray-950/80 flex flex-col items-center justify-center z-50 gap-4">
          <div className="w-10 h-10 border-4 border-green-200 border-t-green-600 rounded-full animate-spin" />
          <p className="text-sm text-gray-500 dark:text-gray-400">Submitting and scoring your answers…</p>
        </div>
      )}
    </div>
  )
}
