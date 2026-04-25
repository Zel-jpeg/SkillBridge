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
//   - Review screen with Edit per question
//   - Confirmation modal before final submit

import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import NavBar from '../../components/NavBar'
import api from '../../api/axios'
import { useApi } from '../../hooks/useApi'

const WARN_AT_SECS = 5 * 60

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

  // ── Step 2: Start the assessment (record started_at on server) ─
  const [questions,    setQuestions]    = useState([])
  const [responseId,   setResponseId]   = useState(null)
  const [assessmentId, setAssessmentId] = useState(null)
  const [startError,   setStartError]   = useState(null)
  const [starting,     setStarting]     = useState(false)
  const [started,      setStarted]      = useState(false)
  const [initialSecs,  setInitialSecs]  = useState(3600) // fallback 60 min

  useEffect(() => {
    if (!activeInfo?.id || started || starting) return
    setStarting(true)
    setAssessmentId(activeInfo.id)

    api.post(`/api/assessments/${activeInfo.id}/start/`)
      .then(res => {
        setResponseId(res.data.response_id)
        setQuestions(res.data.questions || [])
        const secs = res.data.time_limit_sec ?? activeInfo.duration_minutes * 60
        setInitialSecs(secs)

        // Only reset timer if no local save exists for this assessment
        const timerKey = `sb_timer_${activeInfo.id}`
        const saved    = parseInt(localStorage.getItem(timerKey), 10)
        if (isNaN(saved) || saved <= 0) {
          localStorage.setItem(timerKey, secs)
          setTimeLeft(secs)
        }
        setStarted(true)
      })
      .catch(err => {
        setStartError(err.response?.data?.error || 'Failed to start assessment')
      })
      .finally(() => setStarting(false))
  }, [activeInfo]) // eslint-disable-line

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

  const [current,     setCurrent]     = useState(0)
  const [showConfirm, setShowConfirm] = useState(false)
  const [showWarning, setShowWarning] = useState(false)
  const [submitting,  setSubmitting]  = useState(false)
  const [identText,   setIdentText]   = useState({}) // { [questionId]: string }
  const warningShown = useRef(false)

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
    setAnswers(updated)
    if (storageKey) localStorage.setItem(storageKey, JSON.stringify(updated))
  }

  function setIdentificationText(questionId, text) {
    setIdentText(prev => ({ ...prev, [questionId]: text }))
    const updated = { ...answers, [questionId]: { selected_choice_id: null, text_answer: text } }
    setAnswers(updated)
    if (storageKey) localStorage.setItem(storageKey, JSON.stringify(updated))
  }

  // ── Submit ─────────────────────────────────────────────────────
  async function handleSubmit() {
    setShowConfirm(false)
    setShowWarning(false)
    setSubmitting(true)

    const answersArray = Object.entries(answers).map(([qId, ans]) => ({
      question_id:        parseInt(qId, 10),
      selected_choice_id: ans.selected_choice_id ?? null,
      text_answer:        ans.text_answer ?? '',
    }))

    try {
      const res = await api.post(`/api/assessments/${assessmentId}/submit/`, {
        answers:     answersArray,
        response_id: responseId,
      })

      // Cleanup local storage
      if (storageKey) localStorage.removeItem(storageKey)
      if (timerKey)   localStorage.removeItem(timerKey)

      // Update cached user so dashboard shows "submitted" instantly
      const cached = (() => { try { return JSON.parse(localStorage.getItem('sb-user')) } catch { return null } })()
      if (cached) localStorage.setItem('sb-user', JSON.stringify({ ...cached, has_submitted: true, retake_allowed: false }))

      // Build reviewData — enrich questions with correct answers from submit response
      // (backend only exposes is_correct post-submit for security)
      const correctAnswers = res.data.correct_answers ?? {}
      const enrichedQuestions = questions.map(q => {
        const correct = correctAnswers[String(q.id)] ?? correctAnswers[q.id]
        if (!correct) return { ...q }
        if (correct.type === 'identification') {
          return { ...q, correct_text: correct.text }
        }
        // MCQ / True-False: mark the correct choice
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
        answers,  // { [questionId]: { selected_choice_id, text_answer } }
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
  if (checkingActive || starting) return <AssessmentLoading />
  if (activeError)                return <AssessmentError message={activeError} />
  if (startError)                 return <AssessmentError message={startError} />
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

      <NavBar student={navStudent} />

      {/* Sub-bar: question counter + timer */}
      <div className="bg-white dark:bg-gray-900 border-b border-gray-100 dark:border-gray-800 px-4 sm:px-6 py-2.5 flex items-center justify-between gap-3">
        <span className="text-xs text-gray-400 dark:text-gray-500 shrink-0">
          {!started ? 'Loading…' : isReview ? 'Review answers' : `Q ${current + 1} / ${TOTAL}`}
        </span>

        {/* Timer */}
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

        <span className="text-xs text-gray-400 dark:text-gray-500 shrink-0">
          {started ? `${answered}/${TOTAL} answered` : ''}
        </span>
      </div>

      {/* Progress bar */}
      <div className="h-1 bg-gray-100 dark:bg-gray-800">
        <div className="h-full bg-green-500 transition-all duration-500" style={{ width: `${progressPct}%` }} />
      </div>

      <main className="flex-1 flex justify-center px-4 sm:px-6 py-6 sm:py-10">
        <div className="w-full max-w-lg">

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
      </main>

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