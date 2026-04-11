// src/pages/student/StudentAssessment.jsx
//
// Features:
//   - One question at a time
//   - Instructor-set countdown timer (auto-submits at 0, warns at 5 min)
//   - Answers autosaved to localStorage on every pick — survives refresh/disconnect
//   - Review screen with Edit per question
//   - Confirmation modal before final submit
//   - On submit: passes { questions, answers } via router state → StudentResults Answer Review
//
// TODO Week 4: replace DUMMY_* with real API data
//   GET  /api/assessments/active/   → { id, title, duration_minutes, questions }
//   POST /api/assessments/submit/   → { assessment_id, answers: { q_id: choice_id } }
//   API response will include correct answers per question after submission

import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import NavBar from '../../components/NavBar'

// ================================================================
// DUMMY DATA — replace with API in Week 4
// ================================================================
const STUDENT = {
  name:      'David Rey Bali-os',
  initials:  'DR',
  studentId: '2023-01031',
  course:    'BSIT',
}

const ASSESSMENT_ID  = 'assessment_1'
const DURATION_MINS  = 60
const WARN_AT_SECS   = 5 * 60

const DUMMY_QUESTIONS = [
  {
    id: 1,
    text: 'Which HTML tag is used to link an external CSS stylesheet?',
    skill_category: 'Web Development',
    correct: 'b',                          // ← added: correct answer choice id
    choices: [
      { id: 'a', text: '<style>' },
      { id: 'b', text: '<link>' },
      { id: 'c', text: '<css>' },
      { id: 'd', text: '<script>' },
    ],
  },
  {
    id: 2,
    text: 'What does SQL stand for?',
    skill_category: 'Database',
    correct: 'a',
    choices: [
      { id: 'a', text: 'Structured Query Language' },
      { id: 'b', text: 'Simple Question Language' },
      { id: 'c', text: 'Sequential Query Logic' },
      { id: 'd', text: 'System Query Layer' },
    ],
  },
  {
    id: 3,
    text: 'Which layer of the OSI model is responsible for routing?',
    skill_category: 'Networking',
    correct: 'c',
    choices: [
      { id: 'a', text: 'Data Link Layer' },
      { id: 'b', text: 'Transport Layer' },
      { id: 'c', text: 'Network Layer' },
      { id: 'd', text: 'Session Layer' },
    ],
  },
  {
    id: 4,
    text: 'In Python, which keyword is used to define a function?',
    skill_category: 'Backend',
    correct: 'c',
    choices: [
      { id: 'a', text: 'function' },
      { id: 'b', text: 'define' },
      { id: 'c', text: 'def' },
      { id: 'd', text: 'func' },
    ],
  },
  {
    id: 5,
    text: 'Which color model is used for screen/digital design?',
    skill_category: 'Design',
    correct: 'b',
    choices: [
      { id: 'a', text: 'CMYK' },
      { id: 'b', text: 'RGB' },
      { id: 'c', text: 'Pantone' },
      { id: 'd', text: 'HSL only' },
    ],
  },
]
// ================================================================

const TOTAL       = DUMMY_QUESTIONS.length
const STORAGE_KEY = `sb_answers_${ASSESSMENT_ID}`
const TIMER_KEY   = `sb_timer_${ASSESSMENT_ID}`

function formatTime(secs) {
  const m = Math.floor(secs / 60).toString().padStart(2, '0')
  const s = (secs % 60).toString().padStart(2, '0')
  return `${m}:${s}`
}

export default function StudentAssessment() {
  const navigate = useNavigate()

  const [answers, setAnswers] = useState(() => {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) ?? {} }
    catch { return {} }
  })

  const [timeLeft, setTimeLeft] = useState(() => {
    const saved = parseInt(localStorage.getItem(TIMER_KEY), 10)
    return !isNaN(saved) && saved > 0 ? saved : DURATION_MINS * 60
  })

  const [current,     setCurrent]     = useState(0)
  const [showConfirm, setShowConfirm] = useState(false)
  const [showWarning, setShowWarning] = useState(false)
  const [submitting,  setSubmitting]  = useState(false)
  const warningShown = useRef(false)

  const isReview = current === TOTAL
  const question = DUMMY_QUESTIONS[current]
  const answered = Object.keys(answers).length

  // Countdown
  useEffect(() => {
    if (submitting) return
    const interval = setInterval(() => {
      setTimeLeft(prev => {
        const next = prev - 1
        localStorage.setItem(TIMER_KEY, next)
        if (next === WARN_AT_SECS && !warningShown.current) {
          warningShown.current = true
          setShowWarning(true)
        }
        if (next <= 0) {
          clearInterval(interval)
          submitAssessment()
          return 0
        }
        return next
      })
    }, 1000)
    return () => clearInterval(interval)
  }, [submitting])

  function selectAnswer(questionId, choiceId) {
    const updated = { ...answers, [questionId]: choiceId }
    setAnswers(updated)
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated))
  }

  function submitAssessment() {
    setShowConfirm(false)
    setShowWarning(false)
    setSubmitting(true)
    // TODO Week 4: POST { assessment_id: ASSESSMENT_ID, answers } to API
    // The API will return correct answers in the response — pass those instead of
    // DUMMY_QUESTIONS so students never see correct answers before submitting.
    localStorage.removeItem(STORAGE_KEY)
    localStorage.removeItem(TIMER_KEY)
    localStorage.setItem('sb_assessment_done', 'true')
    setTimeout(() =>
      navigate('/student/results', {
        state: {
          // Pass snapshot of questions (with correct answers) + student's answers
          // so StudentResults can render the Answer Review section.
          // Week 4: replace DUMMY_QUESTIONS with the API response payload.
          reviewData: {
            questions: DUMMY_QUESTIONS,
            answers,                    // { [question_id]: chosen_choice_id }
          },
        },
      })
    , 1200)
  }

  // Timer urgency levels
  const isCritical = timeLeft <= WARN_AT_SECS           // ≤ 5 min  → red
  const isWarning  = timeLeft <= WARN_AT_SECS * 2       // ≤ 10 min → amber

  // Timer pill styles — prominent, color-coded badge
  const timerPillClass = isCritical
    ? 'bg-red-500 text-white shadow-red-200 dark:shadow-red-900 shadow-md'
    : isWarning
    ? 'bg-amber-500 text-white shadow-amber-200 dark:shadow-amber-900 shadow-md'
    : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-200'

  const progressPct = isReview ? 100 : Math.round((current / TOTAL) * 100)

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex flex-col relative">

      <NavBar student={STUDENT} />

      {/* Retake Banner (Mock) */}
      {true && ( // Replace with actual isRetake check from API
        <div className="bg-blue-600 text-white text-xs sm:text-sm font-medium py-2 px-4 text-center shadow-sm relative z-10 flex items-center justify-center gap-2">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M23 4v6h-6"/><path d="M1 20v-6h6"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg>
          This is an official assessment retake. Your new score will replace the old one.
        </div>
      )}

      {/* Sub-bar: question counter + timer */}
      <div className="bg-white dark:bg-gray-900 border-b border-gray-100 dark:border-gray-800 px-4 sm:px-6 py-2.5 flex items-center justify-between gap-3">
        <span className="text-xs text-gray-400 dark:text-gray-500 shrink-0">
          {isReview ? 'Review answers' : `Q ${current + 1} / ${TOTAL}`}
        </span>

        {/* ── Prominent Timer Pill ── */}
        <div className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl font-mono font-bold text-sm transition-colors ${timerPillClass} ${isCritical ? 'animate-pulse' : ''}`}>
          {/* Clock icon */}
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" className="shrink-0">
            <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2.2"/>
            <path d="M12 7v5l3 3" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"/>
          </svg>
          {formatTime(timeLeft)}
          {isCritical && (
            <span className="text-xs font-semibold opacity-90 hidden sm:inline">Low!</span>
          )}
        </div>

        {/* Answered counter */}
        <span className="text-xs text-gray-400 dark:text-gray-500 shrink-0">
          {answered}/{TOTAL} answered
        </span>
      </div>

      {/* Progress bar */}
      <div className="h-1 bg-gray-100 dark:bg-gray-800">
        <div
          className="h-full bg-green-500 transition-all duration-500"
          style={{ width: `${progressPct}%` }}
        />
      </div>

      <main className="flex-1 flex justify-center px-4 sm:px-6 py-6 sm:py-10">
        <div className="w-full max-w-lg">

          {/* QUESTION */}
          {!isReview && (
            <div>
              <span className="inline-block bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300 text-xs font-semibold px-3 py-1 rounded-full mb-4">
                {question.skill_category}
              </span>
              <h2 className="text-base sm:text-lg font-bold text-gray-900 dark:text-white mb-5 sm:mb-6 leading-snug">
                {question.text}
              </h2>
              <div className="flex flex-col gap-2.5 sm:gap-3 mb-6 sm:mb-8">
                {question.choices.map(choice => {
                  const selected = answers[question.id] === choice.id
                  return (
                    <button
                      key={choice.id}
                      onClick={() => selectAnswer(question.id, choice.id)}
                      className={`w-full text-left px-4 sm:px-5 py-3.5 sm:py-4 rounded-xl border text-sm transition-all active:scale-[0.99]
                        ${selected
                          ? 'bg-green-50 dark:bg-green-950 border-green-500 text-green-800 dark:text-green-200 font-medium'
                          : 'bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:border-green-300 dark:hover:border-green-700'
                        }`}
                    >
                      <span className={`inline-flex items-center justify-center w-5 h-5 rounded-full border mr-3 text-xs shrink-0
                        ${selected ? 'bg-green-500 border-green-500 text-white' : 'border-gray-300 dark:border-gray-600 text-gray-400'}`}>
                        {choice.id.toUpperCase()}
                      </span>
                      {choice.text}
                    </button>
                  )
                })}
              </div>
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
                  disabled={!answers[question.id]}
                  className={`flex-1 py-3.5 rounded-xl text-sm font-semibold transition-colors
                    ${answers[question.id]
                      ? 'bg-green-600 text-white hover:bg-green-700 active:bg-green-800'
                      : 'bg-gray-100 dark:bg-gray-800 text-gray-400 cursor-not-allowed'}`}
                >
                  {current === TOTAL - 1 ? 'Review answers' : 'Next →'}
                </button>
              </div>
              {!answers[question.id] && (
                <p className="text-center text-xs text-gray-400 dark:text-gray-600 mt-3">Select an answer to continue</p>
              )}
              <p className="text-center text-xs text-gray-300 dark:text-gray-700 mt-4">
                Your answers are saved automatically
              </p>
            </div>
          )}

          {/* REVIEW */}
          {isReview && (
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
                {DUMMY_QUESTIONS.map((q, i) => {
                  const choiceId   = answers[q.id]
                  const choiceText = q.choices.find(c => c.id === choiceId)?.text
                  return (
                    <div key={q.id} className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-xl px-4 py-3 flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <p className="text-xs text-gray-400 dark:text-gray-500 mb-0.5">Q{i + 1} · {q.skill_category}</p>
                        <p className="text-sm text-gray-700 dark:text-gray-300 line-clamp-2">{q.text}</p>
                        {choiceText
                          ? <p className="text-xs text-green-600 dark:text-green-400 font-medium mt-1">{choiceText}</p>
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
              You answered <span className="font-semibold text-gray-700 dark:text-gray-200">{answered} of {TOTAL}</span> questions. Once submitted, you cannot change your answers.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowConfirm(false)}
                className="flex-1 py-3.5 rounded-xl border border-gray-200 dark:border-gray-700 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
              >
                Go back
              </button>
              <button
                onClick={submitAssessment}
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
          <p className="text-sm text-gray-500 dark:text-gray-400">Submitting your answers…</p>
        </div>
      )}
    </div>
  )
}