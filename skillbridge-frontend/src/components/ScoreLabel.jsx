import { useEffect, useId, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

const explanations = {
  'Match': 'Sum of assessed required-category percentages divided by all required categories. Unassessed categories earn no demonstrated match credit and remain unassessed, not graded zero. Positions meeting every minimum rank first; then Match and supporting NLP/location decide order. NLP/location are excluded from this percentage. This is not a probability of being hired. Older saved calculations keep their own breakdown.',
  'Minimum requirements': 'Each required category is checked against its own minimum. A high average cannot cancel a below-minimum or unassessed category.',
  'Recommendation order': 'Positions are ordered by numerical requirement coverage, declared requirement-demand alignment, then supporting text similarity and location. Rank is not confidence or placement approval.',
  'Requirement coverage': 'Average capped attainment of the listed numerical minimums. 100% means these minimums are met, not 100% assessment grades or certainty of workplace suitability. Unassessed requirements stay explicit.',
  'NLP text similarity': 'Similarity between the student’s assessed category context required by this position and its position text. Contextual tags are not separately assessed skills; this percentage is not model accuracy or confidence.',
  'Location score': 'A supporting proximity score based on the saved locations. Positions outside your preferred area remain available.',
  'Legacy hybrid reference': 'Previous 60% category cosine, 25% text similarity and 15% location calculation. This reference does not determine assessment-led order.',
  'Best position match': 'The highest individual position match at this partner, not an average of its roles. Each position uses 60% category fit, 25% NLP fit, and 15% location fit.',
  'Hybrid match': 'Overall recommendation score computed from 60% category fit, 25% NLP fit, and 15% location fit.',
  'Category fit': 'How closely your assessment skill scores match the position’s required skill percentages.',
  'NLP fit': 'Text similarity between your generated competency profile and the position description using the selected NLP model.',
  'Location fit': 'How close you are to the partner location. Nearby partners receive a higher location score.',
}

// A portal keeps explanations visible inside cards, tables and scrollable modals.
export default function ScoreLabel({ label }) {
  const id = useId()
  const button = useRef(null)
  const tooltip = useRef(null)
  const timer = useRef(null)
  const pinned = useRef(false)
  const [position, setPosition] = useState(null)
  const [portalTarget, setPortalTarget] = useState(null)
  const open = Boolean(position)

  function close() {
    clearTimeout(timer.current)
    pinned.current = false
    setPosition(null)
  }
  function show() {
    clearTimeout(timer.current)
    const rect = button.current.getBoundingClientRect()
    setPortalTarget(button.current.closest('dialog') || document.body)
    const width = Math.min(288, window.innerWidth - 24)
    const above = rect.bottom + 140 > window.innerHeight
    setPosition({ left: Math.max(12, Math.min(rect.left, window.innerWidth - width - 12)),
      width, ...(above ? { bottom: window.innerHeight - rect.top + 8 } : { top: rect.bottom + 8 }) })
  }
  function leave() {
    if (!pinned.current) timer.current = setTimeout(() => setPosition(null), 150)
  }
  useEffect(() => {
    if (!open) return
    function outside(event) {
      if (!button.current?.contains(event.target) && !tooltip.current?.contains(event.target)) close()
    }
    function escape(event) { if (event.key === 'Escape') close() }
    document.addEventListener('pointerdown', outside)
    document.addEventListener('keydown', escape)
    window.addEventListener('resize', close)
    window.addEventListener('scroll', close, true)
    return () => {
      clearTimeout(timer.current)
      document.removeEventListener('pointerdown', outside)
      document.removeEventListener('keydown', escape)
      window.removeEventListener('resize', close)
      window.removeEventListener('scroll', close, true)
    }
  }, [open])

  return <>
    <button ref={button} type="button" aria-label={`${label}: explanation`}
      aria-expanded={Boolean(position)} aria-describedby={position ? id : undefined}
      onMouseEnter={show} onMouseLeave={leave} onFocus={show} onBlur={close}
      onClick={event => { event.stopPropagation(); if (pinned.current) close(); else { pinned.current = true; show() } }}
      className="inline-flex items-center gap-1 cursor-help rounded-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-green-600">
      {label}<span aria-hidden="true" className="text-[10px] opacity-60">ⓘ</span>
    </button>
    {position && createPortal(<span ref={tooltip} id={id} role="tooltip"
      onMouseEnter={() => clearTimeout(timer.current)} onMouseLeave={leave}
      style={position} className="fixed z-[1000] rounded-xl bg-gray-900 px-3 py-2.5 text-left text-xs font-normal leading-relaxed text-white shadow-xl border border-gray-700">
      {explanations[label]}
    </span>, portalTarget || document.body)}
  </>
}
