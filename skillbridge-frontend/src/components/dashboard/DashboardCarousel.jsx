import { useEffect, useId, useRef, useState } from 'react'
import { ChevronRightIcon } from '../Icons'
import './dashboardCarousel.css'

// Native scrolling keeps touch, trackpad and focus navigation intact. Controls
// reflect actual measured overflow, not an assumed viewport or number of cards.
export default function DashboardCarousel({ title, description, children, count, regionLabel }) {
  const id = useId(), track = useRef(null)
  const [position, setPosition] = useState({ from: 1, to: 0, back: false, next: false })
  useEffect(() => {
    const node = track.current
    function measure() {
      const bounds = node.getBoundingClientRect()
      const cards = [...node.children]
      const visible = cards.flatMap((card, index) => {
        const rect = card.getBoundingClientRect()
        return Math.min(rect.right, bounds.right) - Math.max(rect.left, bounds.left) >= rect.width * .8 ? [index + 1] : []
      })
      const next = { from: visible[0] || 1, to: visible.at(-1) || 0,
        back: node.scrollLeft > 2, next: node.scrollWidth - node.clientWidth - node.scrollLeft > 2 }
      setPosition(old => Object.keys(next).every(key => old[key] === next[key]) ? old : next)
    }
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(node)
    node.addEventListener('scroll', measure, { passive: true })
    return () => { observer.disconnect(); node.removeEventListener('scroll', measure) }
  }, [count])
  function scroll(direction) {
    const node = track.current
    node.scrollBy({ left: direction * node.clientWidth * .9,
      behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' })
  }
  return <section aria-label={regionLabel} aria-labelledby={regionLabel ? undefined : `${id}-title`} className="dashboard-carousel">
    <header className="dashboard-carousel-header">
      <div className="min-w-0"><div className="flex flex-wrap items-baseline gap-x-3 gap-y-1"><h2 id={`${id}-title`} className="text-sm font-semibold">{title}</h2>{count > 0 && <span className="text-xs text-gray-500 dark:text-gray-400">{position.to > 0 ? `Showing ${position.from}–${position.to} of ${count}` : `${count} ${count === 1 ? 'card' : 'cards'}`}</span>}</div>
        {description && <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">{description}</p>}</div>
      {(position.back || position.next) && <div className="flex shrink-0 gap-1">
        <button type="button" aria-label={`Previous ${title.toLowerCase()}`} aria-controls={id} disabled={!position.back} onClick={() => scroll(-1)} className="dashboard-carousel-arrow"><span className="rotate-180"><ChevronRightIcon size={17} /></span></button>
        <button type="button" aria-label={`Next ${title.toLowerCase()}`} aria-controls={id} disabled={!position.next} onClick={() => scroll(1)} className="dashboard-carousel-arrow"><ChevronRightIcon size={17} /></button>
      </div>}
    </header>
    <div className={`dashboard-carousel-viewport ${position.next ? 'has-next' : ''}`}>
      <ul ref={track} id={id} aria-label={`${title} cards`} tabIndex={count ? 0 : undefined} className="dashboard-carousel-track"
        onKeyDown={event => {
          if (event.target !== event.currentTarget) return
          if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') { event.preventDefault(); scroll(event.key === 'ArrowRight' ? 1 : -1) }
          if (event.key === 'Home' || event.key === 'End') { event.preventDefault(); track.current.scrollTo({ left: event.key === 'Home' ? 0 : track.current.scrollWidth }) }
        }}>{children}</ul>
    </div>
    {!count && <p className="rounded-xl border border-dashed border-gray-200 p-5 text-xs text-gray-500 dark:border-gray-700 dark:text-gray-400">No cards available in this scope yet.</p>}
  </section>
}
