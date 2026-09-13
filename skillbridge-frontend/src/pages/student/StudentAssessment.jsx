// src/pages/student/StudentAssessment.jsx
//
// Fully wired to real API (Week 4):
//   GET  /api/assessments/active/     → checks enrollment + active assessment
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
import { useNavigate } from 'react-router-dom'
import NavBar from '../../components/NavBar'
import api from '../../api/axios'
import { useApi, invalidateCache } from '../../hooks/useApi'

const WARN_AT_SECS = 5 * 60

const STOP_REASON_TEXT = {
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
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex items-center justify-center">
      <div className="text-center space-y-3">
        <div className="w-10 h-10 border-4 border-green-200 border-t-green-600 rounded-full animate-spin mx-auto" />
        <p className="text-sm text-gray-500 dark:text-gray-400">Loading assessment…</p>
      </div>
    </div>
  )
}

// ── Error / no assessment ─────────────────────────────────────────
function AssessmentError({ message }) {
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
        <button
          onClick={() => navigate(isSubmitted ? '/student/results' : '/student')}
          className="inline-flex items-center px-5 py-2.5 bg-green-600 text-white text-sm font-medium rounded-xl hover:bg-green-700 transition-colors"
        >
          {isSubmitted ? 'View Results →' : '← Back to Dashboard'}
        </button>
      </div>
    </div>
  )
}

function IntegrityAgreement({ assessment, student, accepted, onAcceptedChange, onStart, starting, error }) {
  const navigate = useNavigate()
  const mobile = isMobileLikeDevice()
  const rules = [
    'Do not switch tabs or apps, minimize the browser, or leave this assessment screen.',
    mobile
      ? 'Backgrounding the browser, switching apps, or hiding the page stops the attempt.'
      : 'The assessment opens in fullscreen. Exiting fullscreen stops the attempt.',
    'Do not refresh or close the page while the attempt is active.',
    'Copy, paste, cut, print, save, find, refresh, and developer-tool shortcuts are restricted.',
    'On the first integrity rule trigger, answered items are submitted and recorded immediately.',
    'A retake requires approval from an instructor, OJT coordinator, or administrator.',
  ]

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      <NavBar student={student} />
      <main className="max-w-2xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
        <div className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-3xl shadow-sm overflow-hidden">
          <div className="bg-amber-50 dark:bg-amber-950/30 border-b border-amber-100 dark:border-amber-900 px-6 sm:px-8 py-6">
            <div className="flex items-start gap-4">
              <div className="w-11 h-11 rounded-xl bg-amber-100 dark:bg-amber-900 flex items-center justify-center shrink-0 text-amber-700 dark:text-amber-300 font-bold">!</div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-amber-700 dark:text-amber-400">Assessment integrity agreement</p>
                <h1 className="text-xl font-bold text-gray-900 dark:text-white mt-1">Read and confirm before starting</h1>
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">{assessment?.title} · {assessment?.duration_minutes} minutes</p>
              </div>
            </div>
          </div>
          <div className="px-6 sm:px-8 py-6">
            <p className="text-sm text-gray-600 dark:text-gray-300 leading-relaxed mb-4">
              Browser monitoring supports assessment integrity, but it cannot completely prevent OS-level actions. Any browser-detected rule below will stop this attempt.
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
              <button onClick={() => navigate('/student/dashboard')} className="flex-1 py-3 rounded-xl border border-gray-200 dark:border-gray-700 text-sm font-medium text-gray-700 dark:text-gray-300">Back to dashboard</button>
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

function AssessmentStopped({ reason, saving = false, saveError = false, onRetry }) {
  const navigate = useNavigate()
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex items-center justify-center px-4">
      <div className="w-full max-w-md bg-white dark:bg-gray-900 border border-rose-100 dark:border-rose-900 rounded-3xl p-7 sm:p-9 shadow-sm">
        <div className="w-14 h-14 rounded-2xl bg-rose-100 dark:bg-rose-950 text-rose-600 dark:text-rose-400 flex items-center justify-center text-2xl font-bold mb-5">!</div>
        <p className="text-xs font-semibold uppercase tracking-wider text-rose-600 dark:text-rose-400">Assessment integrity rule triggered</p>
        <h1 className="text-xl font-bold text-gray-900 dark:text-white mt-1">Your assessment was stopped</h1>
        <p className="text-sm text-gray-600 dark:text-gray-300 mt-3 leading-relaxed">{reason || 'An assessment integrity rule was triggered.'}</p>
        <div className="mt-5 p-4 rounded-xl bg-gray-50 dark:bg-gray-800 text-sm text-gray-600 dark:text-gray-300 space-y-2">
          <p>{saving ? 'Saving your completed answers…' : saveError ? 'The attempt is stopped locally, but the server could not be reached yet.' : 'Your completed answers were recorded.'}</p>
          <p>You must contact your instructor, OJT coordinator, or administrator to request a retake.</p>
        </div>
        {saveError && (
          <button onClick={onRetry} className="w-full mt-4 py-3 rounded-xl bg-rose-600 text-white text-sm font-semibold hover:bg-rose-700">Retry saving now</button>
        )}
        <button onClick={() => navigate('/student/dashboard')} disabled={saving || saveError} className="w-full mt-3 py-3 rounded-xl border border-gray-200 dark:border-gray-700 text-sm font-medium text-gray-700 dark:text-gray-300 disabled:opacity-50">Back to dashboard</button>
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
  const navigate = useNavigate()

  // Read cached user for NavBar (instant render)
  const cachedUser = (() => { try { return JSON.parse(localStorage.getItem('sb-user')) } catch { return null } })()
  const navStudent = {
    name:      cachedUser?.name     || 'Student',
    initials:  (cachedUser?.name || 'ST').split(' ').map(n => n[0]).slice(0, 2).join(''),
    studentId: cachedUser?.school_id || '',
    course:    cachedUser?.course    || '',
    photoUrl:  cachedUser?.photo_url || null,
  }

  // ── Step 1: Check for active assessment ────────────────────────
  const { data: activeInfo, loading: checkingActive, error: activeError } = useApi('/api/assessments/active/')

  // ── Step 2: Agreement, then start the server attempt ───────────
  const [questions,    setQuestions]    = useState([])
  const [responseId,   setResponseId]   = useState(null)
  const [assessmentId, setAssessmentId] = useState(null)
  const [startError,   setStartError]   = useState(null)
  const [starting,     setStarting]     = useState(false)
  const [started,      setStarted]      = useState(false)
  const [agreementAccepted, setAgreementAccepted] = useState(false)
  const [stoppedAttempt, setStoppedAttempt] = useState(null)
  const [initialSecs,  setInitialSecs]  = useState(3600) // fallback 60 min

  // ── Step 3: Local state ────────────────────────────────────────
  const storageKey = assessmentId ? `sb_answers_${assessmentId}` : null
  const timerKey   = assessmentId ? `sb_timer_${assessmentId}`   : null

  const [answers, setAnswers] = useState(() => {
    // Pre-load locally saved answers for this assessment if they exist
    try {
      const key  = activeInfo?.id ? `sb_answers_${activeInfo.id}` : null
      return key ? JSON.parse(localStorage.getItem(key) ?? 'null') ?? {} : {}
    } catch { return {} }
  })
  const [timeLeft, setTimeLeft] = useState(initialSecs)

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
  const integrityArmedRef = useRef(false)
  const finalizingRef = useRef(false)
  const fullscreenRequiredRef = useRef(false)

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
    localStorage.removeItem(`sb_answers_${id}`)
    localStorage.removeItem(`sb_timer_${id}`)
    localStorage.removeItem(`sb_integrity_active_${id}`)
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
      setQuestions(res.data.questions || [])

      const answerKey = `sb_answers_${id}`
      let restoredAnswers = {}
      try { restoredAnswers = JSON.parse(localStorage.getItem(answerKey) || '{}') || {} } catch { /* ignore malformed autosave */ }
      setAnswers(restoredAnswers)
      answersRef.current = restoredAnswers

      const secs = res.data.time_limit_sec ?? activeInfo.duration_minutes * 60
      setInitialSecs(secs)
      const saved = parseInt(localStorage.getItem(`sb_timer_${id}`), 10)
      const timer = isNaN(saved) || saved <= 0 ? secs : saved
      localStorage.setItem(`sb_timer_${id}`, timer)
      localStorage.setItem(`sb_integrity_active_${id}`, JSON.stringify({
        response_id: res.data.response_id,
        started_at: res.data.started_at,
      }))
      setTimeLeft(timer)
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
      invalidateCache('/api/assessments/active/')
      invalidateCache('/api/students/me/')
      invalidateCache('/api/student/results/')
      updateCachedAttemptStatus('stopped')
      await leaveFullscreen()
      setStoppedAttempt({
        reason,
        detail,
        reasonDisplay: res.data.stopped_reason_display || reasonText,
        saving: false,
        saveError: false,
      })
    } catch (err) {
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

  // If a page was closed or refreshed before its keepalive request completed,
  // the durable local marker finalizes it on the next visit.
  useEffect(() => {
    if (!activeInfo?.id || started || stoppedAttempt) return
    if (activeInfo.attempt_status === 'stopped') {
      clearAttemptStorage(activeInfo.id)
      return
    }
    const markerKey = `sb_integrity_active_${activeInfo.id}`
    let marker = null
    try { marker = JSON.parse(localStorage.getItem(markerKey)) } catch { /* ignore malformed marker */ }
    if (!marker) return

    let savedAnswers = {}
    try { savedAnswers = JSON.parse(localStorage.getItem(`sb_answers_${activeInfo.id}`) || '{}') || {} } catch { /* ignore malformed autosave */ }
    setAssessmentId(activeInfo.id)
    assessmentIdRef.current = activeInfo.id
    setResponseId(marker.response_id)
    responseIdRef.current = marker.response_id
    setAnswers(savedAnswers)
    answersRef.current = savedAnswers
    integrityArmedRef.current = true
    submitIntegrityStop('page_closed', 'Recovered after the assessment page was left')
  }, [activeInfo]) // eslint-disable-line react-hooks/exhaustive-deps

  // Integrity listeners are active only while questions are live.
  useEffect(() => {
    if (!started || submitting || stoppedAttempt) return

    const onVisibilityChange = () => {
      if (document.hidden) submitIntegrityStop('tab_hidden')
    }
    const onBlur = () => {
      setTimeout(() => {
        if (!document.hidden && !document.hasFocus()) submitIntegrityStop('window_lost_focus')
      }, 50)
    }
    const onFullscreenChange = () => {
      if (fullscreenRequiredRef.current && !getFullscreenElement()) {
        submitIntegrityStop('fullscreen_exited')
      }
    }
    const onKeyDown = event => {
      const key = event.key.toLowerCase()
      const modifier = event.ctrlKey || event.metaKey
      let shortcut = ''
      if (event.key === 'F12') shortcut = 'F12'
      else if (event.key === 'F5') shortcut = 'F5'
      else if (modifier && event.shiftKey && ['i', 'j', 'c'].includes(key)) shortcut = `${event.metaKey ? 'Meta' : 'Ctrl'}+Shift+${key.toUpperCase()}`
      else if (modifier && ['c', 'v', 'x', 'p', 's', 'f', 'r'].includes(key)) shortcut = `${event.metaKey ? 'Meta' : 'Ctrl'}+${key.toUpperCase()}`
      if (!shortcut) return
      event.preventDefault()
      event.stopPropagation()
      submitIntegrityStop('restricted_shortcut', shortcut)
    }
    const onContextMenu = event => event.preventDefault()
    const onPageExit = () => submitIntegrityStop('page_closed', '', { unloading: true })
    const onPopState = () => submitIntegrityStop('page_closed')

    document.addEventListener('visibilitychange', onVisibilityChange)
    window.addEventListener('blur', onBlur)
    document.addEventListener('fullscreenchange', onFullscreenChange)
    document.addEventListener('webkitfullscreenchange', onFullscreenChange)
    window.addEventListener('keydown', onKeyDown, true)
    document.addEventListener('contextmenu', onContextMenu)
    window.addEventListener('beforeunload', onPageExit)
    window.addEventListener('pagehide', onPageExit)
    window.addEventListener('popstate', onPopState)

    return () => {
      document.removeEventListener('visibilitychange', onVisibilityChange)
      window.removeEventListener('blur', onBlur)
      document.removeEventListener('fullscreenchange', onFullscreenChange)
      document.removeEventListener('webkitfullscreenchange', onFullscreenChange)
      window.removeEventListener('keydown', onKeyDown, true)
      document.removeEventListener('contextmenu', onContextMenu)
      window.removeEventListener('beforeunload', onPageExit)
      window.removeEventListener('pagehide', onPageExit)
      window.removeEventListener('popstate', onPopState)
    }
  }, [started, submitting, stoppedAttempt]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Countdown timer ────────────────────────────────────────────
  useEffect(() => {
    if (!started || submitting) return
    const interval = setInterval(() => {
      setTimeLeft(prev => {
        const next = prev - 1
        if (timerKey) localStorage.setItem(timerKey, next)
        if (next === WARN_AT_SECS && !warningShown.current) {
          warningShown.current = true
          setShowWarning(true)
        }
        if (next <= 0) {
          clearInterval(interval)
          handleSubmit()
          return 0
        }
        return next
      })
    }, 1000)
    return () => clearInterval(interval)
  }, [started, submitting]) // eslint-disable-line

  // ── Answer selection ───────────────────────────────────────────
  function selectChoice(questionId, choiceId) {
    const updated = { ...answers, [questionId]: { selected_choice_id: choiceId, text_answer: '' } }
    answersRef.current = updated
    setAnswers(updated)
    if (storageKey) localStorage.setItem(storageKey, JSON.stringify(updated))
  }

  function setIdentificationText(questionId, text) {
    setIdentText(prev => ({ ...prev, [questionId]: text }))
    const updated = { ...answers, [questionId]: { selected_choice_id: null, text_answer: text } }
    answersRef.current = updated
    setAnswers(updated)
    if (storageKey) localStorage.setItem(storageKey, JSON.stringify(updated))
  }

  // ── Submit ─────────────────────────────────────────────────────
  async function handleSubmit() {
    if (finalizingRef.current) return
    finalizingRef.current = true
    integrityArmedRef.current = false
    setShowConfirm(false)
    setShowWarning(false)
    setSubmitting(true)

    const answersArray = answersArrayFrom()

    try {
      const res = await api.post(`/api/assessments/${assessmentId}/submit/`, {
        answers:     answersArray,
        response_id: responseId,
      })

      // Cleanup local storage
      clearAttemptStorage(assessmentId)

      // Invalidate results cache so the next page fetches fresh data from DB
      invalidateCache('/api/student/results/')
      invalidateCache('/api/assessments/active/')
      invalidateCache('/api/students/me/')

      // Update cached user so dashboard shows "submitted" instantly
      const cached = (() => { try { return JSON.parse(localStorage.getItem('sb-user')) } catch { return null } })()
      if (cached) localStorage.setItem('sb-user', JSON.stringify({ ...cached, has_submitted: true, retake_allowed: false }))

      await leaveFullscreen()

      // Build reviewData — enrich questions with correct answers from submit response
      const correctAnswers = res.data.correct_answers ?? {}
      const enrichedQuestions = questions.map(q => {
        const correct = correctAnswers[String(q.id)] ?? correctAnswers[q.id]
        if (!correct) return { ...q }
        if (correct.type === 'identification') {
          return { ...q, correct_text: correct.text }
        }
        return {
          ...q,
          choices: (q.choices || []).map(c => ({
            ...c,
            is_correct: c.id === correct.id,
          })),
        }
      })

      const reviewData = {
        questions: enrichedQuestions,
        answers,
      }

      setTimeout(() =>
        navigate('/student/results', {
          state: {
            scores:          res.data.scores,
            recommendations: res.data.recommendations,
            reviewData,
          },
        })
      , 800)
    } catch (err) {
      finalizingRef.current = false
      integrityArmedRef.current = true
      setSubmitting(false)
      const msg = err.response?.data?.error || 'Submission failed. Please try again.'
      alert(msg)
    }
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
          Our system is scoring your responses and finding your best company matches. This may take a few seconds.
        </p>
      </div>
      <div className="flex gap-1.5">
        {[0,1,2].map(i => (
          <div key={i} className="w-2 h-2 rounded-full bg-green-500 animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />
        ))}
      </div>
    </div>
  )
  if (checkingActive)             return <AssessmentLoading />
  if (activeError)                return <AssessmentError message={activeError} />
  if (activeInfo?.attempt_status === 'stopped' && !activeInfo?.retake_allowed) {
    return <AssessmentStopped reason={activeInfo.stopped_reason_display} />
  }
  if (stoppedAttempt) return (
    <AssessmentStopped
      reason={stoppedAttempt.reasonDisplay}
      saving={stoppedAttempt.saving}
      saveError={stoppedAttempt.saveError}
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

      <div className="bg-white dark:bg-gray-900 border-b border-gray-100 dark:border-gray-800 px-4 sm:px-6 h-14 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <img src="/SB-logov1.png" alt="SkillBridge" className="w-7 h-7 rounded-md object-cover" />
          <span className="text-sm font-semibold text-gray-900 dark:text-white">SkillBridge</span>
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
          <div className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl font-mono font-bold text-sm transition-colors ${timerPillClass} ${isCritical ? 'animate-pulse' : ''}`}>
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
                <span className="inline-block bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300 text-xs font-semibold px-3 py-1 rounded-full mb-4">
                  {question.category || question.skill_category || 'General'}
                </span>

                <h2 className="text-base sm:text-lg font-bold text-gray-900 dark:text-white mb-5 sm:mb-6 leading-snug">
                  {question.question_text || question.text}
                </h2>

                {/* MCQ / True-False choices */}
                {question.question_type !== 'identification' && (
                  <div className="flex flex-col gap-2.5 sm:gap-3 mb-6 sm:mb-8">
                    {(question.choices || []).map((choice, idx) => {
                      const selected = answers[question.id]?.selected_choice_id === choice.id
                      return (
                        <button
                          key={choice.id}
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
                          <p className="text-xs text-gray-400 dark:text-gray-500 mb-0.5">Q{i + 1} · {q.category || q.skill_category || 'General'} · {isIdent ? 'Identification' : q.question_type === 'truefalse' ? 'True/False' : 'MCQ'}</p>
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
