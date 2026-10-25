import { useEffect, useId, useRef } from 'react'
import { Link } from 'react-router-dom'
import { invalidateCache, useApi } from '../../hooks/useApi'
import { ANALYTICS_URL } from '../../utils/analytics'
import { managementNotifications } from '../../utils/notifications'
import { BellIcon, BriefcaseIcon, CheckCircleIcon, ChevronRightIcon, ClockIcon, UserIcon, WarnIcon, XIcon } from '../Icons'
import './notificationMenu.css'

const icons = { assessment: WarnIcon, placement: BriefcaseIcon, approval: UserIcon, deadline: ClockIcon, retake: CheckCircleIcon, results: CheckCircleIcon }

export default function NotificationMenu({ role, ...props }) {
  const { data, loading, error } = useApi(ANALYTICS_URL)
  const entries = managementNotifications(data, role)
  return <NotificationDropdown {...props} entries={entries} ready={Boolean(data)} loading={loading} error={error} onRetry={() => invalidateCache(ANALYTICS_URL)} />
}

export function NotificationDropdown({ entries, ready, loading, error, onRetry, open, onToggle, onClose,
  subtitle = 'Active batches · Current reminders', badgeUnit = 'reminder groups',
  emptyDescription = 'No current reminders in your active batch scope.',
  footerText = 'The badge counts reminder groups. Student counts can overlap. Reminders clear when the underlying issue is resolved.' }) {
  const root = useRef(null)
  const trigger = useRef(null)
  const id = useId()
  useEffect(() => {
    if (!open) return
    function outside(event) { if (!root.current?.contains(event.target)) onClose() }
    function key(event) {
      if (event.key === 'Escape') { event.preventDefault(); onClose(); trigger.current?.focus() }
    }
    document.addEventListener('pointerdown', outside)
    document.addEventListener('keydown', key)
    return () => {
      document.removeEventListener('pointerdown', outside)
      document.removeEventListener('keydown', key)
    }
  }, [open, onClose])

  function closeAndFocus() { onClose(); trigger.current?.focus() }
  return <div className="sb-notifications" ref={root} onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget)) onClose() }}>
    <button type="button" ref={trigger} className="sb-notification-trigger" onClick={onToggle}
      aria-label={`Open notifications${entries.length ? `, ${entries.length} ${badgeUnit}` : ''}`} aria-expanded={open} aria-controls={id}>
      <span aria-hidden="true"><BellIcon size={21} /></span>
      {entries.length > 0 && <span className="sb-notification-badge" aria-hidden="true">{entries.length > 99 ? '99+' : entries.length}</span>}
    </button>
    {open && <section id={id} className="sb-notification-panel" aria-labelledby={`${id}-title`}>
      <header><div><h2 id={`${id}-title`}>Notifications</h2><p>{subtitle}</p></div><button type="button" aria-label="Close notifications" onClick={closeAndFocus}><XIcon size={18} /></button></header>
      {error && <div className="sb-notification-state" role="status"><p>Reminders could not refresh. {ready ? 'Showing the last available reminders.' : 'Try again shortly.'}</p><button type="button" className="sb-notification-retry" onClick={onRetry}>Retry reminders</button></div>}
      {!ready ? <p className="sb-notification-state" role="status">{loading ? 'Loading reminders…' : error ? 'Reminders are unavailable.' : 'Reminders are not available yet.'}</p>
        : entries.length ? <ul className="sb-notification-list">{entries.map(entry => {
          const Icon = icons[entry.kind]
          return <li key={entry.id}><Link to={entry.to} onClick={onClose} className={`sb-notification-card ${entry.urgent ? 'sb-notification-card--urgent' : ''}`}>
            <span className={`sb-notification-icon sb-notification-icon--${entry.kind}`} aria-hidden="true"><Icon size={18} /></span>
            <span className="sb-notification-content"><span className="sb-notification-title">{entry.title}{entry.count != null && <span>{entry.count}</span>}</span><span className="sb-notification-description">{entry.description}</span></span>
            <span aria-hidden="true"><ChevronRightIcon size={16} /></span>
          </Link></li>
        })}</ul> : <div className="sb-notification-state"><span aria-hidden="true"><BellIcon size={27} /></span><strong>{error ? 'No reminders in the last available data' : "You're all caught up"}</strong><p>{error ? 'Retry to check the current reminders.' : emptyDescription}</p></div>}
      {ready && entries.length > 0 && <footer>{footerText}</footer>}
    </section>}
  </div>
}
