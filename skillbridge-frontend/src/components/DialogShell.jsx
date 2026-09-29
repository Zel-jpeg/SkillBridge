import { useEffect, useId, useRef } from 'react'
import { createPortal } from 'react-dom'
import { XIcon } from './Icons'
import { useSession } from '../context/SessionContext'
import './studentDetail.css'

// Nested dialogs share the lock; closing a confirmation must not unlock its parent.
let lockCount = 0
let originalOverflow
let originalPadding

function lockBody() {
  if (lockCount++ === 0) {
    originalOverflow = document.body.style.overflow
    originalPadding = document.body.style.paddingRight
    const gap = window.innerWidth - document.documentElement.clientWidth
    if (gap > 0) document.body.style.paddingRight = `${parseFloat(getComputedStyle(document.body).paddingRight) + gap}px`
    document.body.style.overflow = 'hidden'
  }
  return () => {
    if (--lockCount === 0) {
      document.body.style.overflow = originalOverflow
      document.body.style.paddingRight = originalPadding
    }
  }
}

/** Native top-layer modality supplies inert background, focus trapping and nested Escape handling. */
export default function DialogShell({ title, description, avatar, headerDetails, children, footer, onClose, size = 'detail', closeLabel = 'Close details' }) {
  const { expired } = useSession()
  const dialog = useRef(null)
  const backdropStart = useRef(false)
  const id = useId()
  useEffect(() => {
    if (expired) return
    const node = dialog.current
    const opener = document.activeElement
    const unlock = lockBody()
    node.showModal()
    return () => {
      node.close()
      unlock()
      // Native restoration covers normal closure. Handle React unmounts too.
      queueMicrotask(() => {
        const top = [...document.querySelectorAll('dialog[open]')].at(-1)
        if (opener?.isConnected && (!top || top.contains(opener))) opener.focus({ preventScroll: true })
      })
    }
  }, [expired])

  function outside(event) {
    const rect = dialog.current.getBoundingClientRect()
    return event.target === dialog.current && (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom)
  }

  function trapTab(event) {
    // Portal events may bubble through a parent dialog in React's tree.
    if (event.key !== 'Tab' || event.target.closest('dialog') !== event.currentTarget) return
    const controls = [...event.currentTarget.querySelectorAll('button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), a[href], [tabindex="0"]')]
      .filter(node => node.tabIndex >= 0 && node.getClientRects().length > 0)
    const first = controls[0]
    const last = controls.at(-1)
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault()
      last?.focus()
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault()
      first?.focus()
    }
  }

  // A native top-layer dialog must not obscure the existing session-expiry flow.
  if (expired) return null

  return createPortal(<dialog ref={dialog} className={`sb-detail-dialog sb-detail-dialog--${size}`}
    aria-modal="true" aria-labelledby={`${id}-title`} aria-describedby={`${id}-description`}
    onCancel={event => { event.preventDefault(); event.stopPropagation(); onClose() }} onKeyDown={trapTab}
    onPointerDown={event => { backdropStart.current = outside(event) }}
    onPointerCancel={() => { backdropStart.current = false }}
    onClick={event => {
      if (backdropStart.current && outside(event)) onClose()
      backdropStart.current = false
    }}>
    <header className="sb-detail-header">
      {avatar}
      <div className="min-w-0 flex-1">
        <h2 id={`${id}-title`} className="text-base font-bold text-gray-900 dark:text-white">{title}</h2>
        <p id={`${id}-description`} className={size === 'confirm' ? 'mt-2 text-sm leading-relaxed text-gray-600 dark:text-gray-300' : 'sr-only'}>{description}</p>
        {headerDetails}
      </div>
      <button type="button" className="sb-detail-close" aria-label={closeLabel} title={closeLabel} onClick={onClose}><XIcon size={20} /></button>
    </header>
    {children}
    {footer && <footer className="sb-detail-footer">{footer}</footer>}
  </dialog>, document.body)
}
