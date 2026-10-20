import { createContext, useContext, useState, useCallback, useRef, useEffect, useMemo } from 'react'
import { createPortal } from 'react-dom'

const ToastContext = createContext(null)
const TYPES = { success: 'Success', error: 'Error', warning: 'Warning', info: 'Information' }

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([])
  const idRef = useRef(0)

  // Call after a confirmed action. Keep recovery guidance inline where needed.
  const showToast = useCallback((message, type = 'success', duration) => {
    if (typeof message !== 'string' || !message.trim()) return
    const kind = Object.hasOwn(TYPES, type) ? type : 'info'
    const timeout = Number.isFinite(duration) && duration > 0 ? duration : kind === 'error' ? 8000 : 5000
    const toast = { id: ++idRef.current, message: message.trim(), type: kind, duration: timeout }
    setToasts(previous => previous.some(item => item.message === toast.message && item.type === kind)
      ? previous : [...previous, toast])
  }, [])
  const dismiss = useCallback(id => setToasts(previous => previous.filter(item => item.id !== id)), [])
  const value = useMemo(() => ({ showToast }), [showToast])

  return <ToastContext.Provider value={value}>
    {children}
    <ToastViewport toasts={toasts} onDismiss={dismiss} />
  </ToastContext.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export function useToast() {
  const context = useContext(ToastContext)
  if (!context) throw new Error('useToast must be used inside <ToastProvider>')
  return context
}

function ToastViewport({ toasts, onDismiss }) {
  const [host] = useState(() => {
    const element = document.createElement('div')
    element.className = 'sb-toast-viewport'
    element.setAttribute('popover', 'manual')
    element.setAttribute('aria-label', 'Notifications')
    return element
  })
  const [hidden, setHidden] = useState(document.hidden)
  const active = toasts.length > 0

  useEffect(() => {
    const visibility = () => setHidden(document.hidden)
    document.addEventListener('visibilitychange', visibility)
    return () => document.removeEventListener('visibilitychange', visibility)
  }, [])

  useEffect(() => mountViewport(host, active), [active, host])

  return createPortal(<>
    {/* Queued messages begin their countdown only when visible. */}
    {toasts.slice(0, 3).map(toast => <Toast key={toast.id} toast={toast} hidden={hidden} onDismiss={onDismiss} />)}
  </>, host)
}

// The host is an imperative DOM container, separate from React's toast state.
function mountViewport(host, active) {
  if (!active) {
    host.dataset.active = 'false'
    document.body.appendChild(host)
    return () => host.remove()
  }
  function position() {
    const dialogs = [...document.querySelectorAll('dialog[open]')]
    const parent = dialogs.at(-1) || document.fullscreenElement || document.body
    if (host.parentNode !== parent) {
      host.hidePopover?.()
      parent.appendChild(host)
    }
    host.dataset.active = String(active)
    if (active && typeof host.showPopover === 'function' && !host.matches(':popover-open')) host.showPopover()
    if (!active) host.hidePopover?.()
  }
  position()
  const observer = new MutationObserver(position)
  observer.observe(document.body, { subtree: true, childList: true, attributes: true, attributeFilter: ['open'] })
  document.addEventListener('fullscreenchange', position)
  return () => {
    observer.disconnect()
    document.removeEventListener('fullscreenchange', position)
    host.remove()
  }
}

function Toast({ toast, hidden, onDismiss }) {
  const timer = useRef(null)
  const animation = useRef(null)
  const [hovered, setHovered] = useState(false)
  const [focused, setFocused] = useState(false)
  const [touching, setTouching] = useState(false)
  const paused = hovered || focused || touching || hidden

  useEffect(() => {
    // Script-created animations retain their playhead when the portal moves
    // between native dialog layers; CSS animations restart on DOM reparenting.
    const clock = timer.current.animate([{ transform: 'scaleX(1)' }, { transform: 'scaleX(0)' }], {
      duration: toast.duration, easing: 'linear', fill: 'forwards',
    })
    animation.current = clock
    clock.onfinish = () => onDismiss(toast.id)
    return () => { clock.onfinish = null; clock.cancel() }
  }, [toast.id, toast.duration, onDismiss])

  useEffect(() => {
    if (paused) animation.current?.pause()
    else animation.current?.play()
  }, [paused])

  return <div className={`sb-toast sb-toast-${toast.type}`} data-paused={paused}
    onPointerEnter={event => { if (event.pointerType !== 'touch') setHovered(true) }}
    onPointerLeave={() => setHovered(false)}
    onPointerDown={event => { if (event.pointerType === 'touch' && !event.target.closest('button')) { event.currentTarget.setPointerCapture(event.pointerId); setTouching(true) } }}
    onPointerUp={() => setTouching(false)} onPointerCancel={() => setTouching(false)}
    onFocusCapture={() => setFocused(true)}
    onBlurCapture={event => { if (!event.currentTarget.contains(event.relatedTarget)) setFocused(false) }}>
    <span className="sb-toast-icon" aria-hidden="true">
      <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
        <circle cx="12" cy="12" r="11" />
        {toast.type === 'success'
          ? <path d="m7 12 3.2 3.2L17 8.5" fill="none" stroke="var(--sb-toast-surface)" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
          : <path d={toast.type === 'error' ? 'm8.5 8.5 7 7m0-7-7 7' : 'M12 6.5v6M12 16.5v.1'} stroke="var(--sb-toast-surface)" strokeWidth="2.2" strokeLinecap="round" />}
      </svg>
    </span>
    <p className="sb-toast-message" role={toast.type === 'error' ? 'alert' : 'status'} aria-atomic="true">
      <span className="sr-only">{TYPES[toast.type]}: </span>{toast.message}
    </p>
    <button type="button" className="sb-toast-close" aria-label="Dismiss notification" onClick={() => onDismiss(toast.id)}>
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18" /></svg>
    </button>
    <div className="sb-toast-track" aria-hidden="true"><div ref={timer} className="sb-toast-timer" /></div>
  </div>
}
