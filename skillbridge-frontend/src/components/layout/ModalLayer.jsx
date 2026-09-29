import { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'

// One listener and scroll lock per visible dialog; restored on close/unmount.
export default function ModalLayer({ children, labelId, label, onClose, restoreRef, className = '' }) {
  const ref = useRef(null)
  useEffect(() => {
    const root = document.getElementById('root')
    const wasInert = root?.inert
    const previousOverflow = document.body.style.overflow
    const previousPadding = document.body.style.paddingRight
    const scrollbar = window.innerWidth - document.documentElement.clientWidth
    const returnTarget = restoreRef?.current ?? document.activeElement
    document.body.style.overflow = 'hidden'
    if (scrollbar > 0) document.body.style.paddingRight = `${scrollbar}px`
    if (root) root.inert = true
    const dialog = ref.current
    const focusable = () => [...dialog.querySelectorAll('a[href], button:not([disabled]), input:not([disabled]), [tabindex="0"]')].filter(node => node.getClientRects().length)
    const initialFocus = focusable()[0] ?? dialog
    initialFocus.focus()
    function onKey(event) {
      if (event.key === 'Escape') { event.preventDefault(); onClose(); return }
      if (event.key !== 'Tab') return
      const nodes = focusable()
      const first = nodes[0]
      const last = nodes.at(-1)
      if (!first) { event.preventDefault(); dialog.focus() }
      else if (event.shiftKey && (document.activeElement === first || document.activeElement === dialog)) { event.preventDefault(); last.focus() }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus() }
    }
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = previousOverflow
      document.body.style.paddingRight = previousPadding
      if (root) root.inert = wasInert
      if (returnTarget?.isConnected) returnTarget.focus()
    }
  }, [onClose, restoreRef])

  return createPortal(
    <div className={`sb-modal-layer ${className}`} onClick={event => { if (event.target === event.currentTarget) onClose() }}>
      <div ref={ref} role="dialog" aria-modal="true" aria-labelledby={labelId} aria-label={label} tabIndex={-1} className="sb-modal-surface">
        {children}
      </div>
    </div>, document.body,
  )
}
