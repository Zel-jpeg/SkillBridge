import { useEffect, useId, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

const explanations = {
  'Hybrid match': 'Overall recommendation score computed from 60% category fit, 25% NLP fit, and 15% location fit.',
  'Category fit': 'How closely your assessment skill scores match the position’s required skill percentages.',
  'NLP fit': 'Text similarity between your generated competency profile and the position description using the selected NLP model.',
  'Location fit': 'How close you are to the company location. Nearby companies receive a higher location score.',
}

// A portal keeps explanations visible inside cards, tables and scrollable modals.
export default function ScoreLabel({ label }) {
  const id = useId()
  const button = useRef(null)
  const tooltip = useRef(null)
  const timer = useRef(null)
  const pinned = useRef(false)
  const [position, setPosition] = useState(null)

  function close() {
    clearTimeout(timer.current)
    pinned.current = false
    setPosition(null)
  }
  function show() {
    clearTimeout(timer.current)
    const rect = button.current.getBoundingClientRect()
    const width = Math.min(288, window.innerWidth - 24)
    const above = rect.bottom + 140 > window.innerHeight
    setPosition({ left: Math.max(12, Math.min(rect.left, window.innerWidth - width - 12)),
      width, ...(above ? { bottom: window.innerHeight - rect.top + 8 } : { top: rect.bottom + 8 }) })
  }
  function leave() {
    if (!pinned.current) timer.current = setTimeout(() => setPosition(null), 150)
  }
  useEffect(() => {
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
  }, [])

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
    </span>, document.body)}
  </>
}
