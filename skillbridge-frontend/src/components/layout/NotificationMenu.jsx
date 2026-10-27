import { useEffect, useId, useRef } from 'react'
import { Link } from 'react-router-dom'
import { invalidateCache, useApi } from '../../hooks/useApi'
import { ANALYTICS_URL } from '../../utils/analytics'
import { managementNotifications } from '../../utils/notifications'
import { NOTIFICATION_LABELS, notificationSeverity, unreadSeverity } from '../../utils/notificationReadState'
import { useNotificationReads } from '../../hooks/useNotificationReads'
import { BellIcon, BriefcaseIcon, CheckCircleIcon, ChevronRightIcon, ClockIcon, UserIcon, WarnIcon, XIcon } from '../Icons'
import './notificationMenu.css'

const icons = { assessment: WarnIcon, placement: BriefcaseIcon, approval: UserIcon, deadline: ClockIcon, retake: CheckCircleIcon, results: CheckCircleIcon }

export default function NotificationMenu({ role, ...props }) {
  const { data, loading, error } = useApi(ANALYTICS_URL)
  const entries = managementNotifications(data, role)
  return <NotificationDropdown {...props} entries={entries} ready={Boolean(data)} loading={loading} error={error} onRetry={() => invalidateCache(ANALYTICS_URL)} />
}

export function NotificationDropdown({ entries, ready, loading, error, onRetry, open, onToggle, onClose,
  subtitle = 'Active batches · Current reminders', badgeUnit = 'updates',
  emptyDescription = 'No current reminders in your active batch scope.',
  footerText = 'Student counts can overlap. Read reminders stay here until the underlying issue is resolved.' }) {
  const root = useRef(null)
  const trigger = useRef(null)
  const id = useId()
  const { isRead, unread, markRead } = useNotificationReads(entries)
  const badgeSeverity = unreadSeverity(unread)
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
      aria-label={`Open notifications, ${unread.length} unread ${badgeUnit}`} aria-expanded={open} aria-controls={id}>
      <span aria-hidden="true"><BellIcon size={21} /></span>
      {unread.length > 0 && <span className={`sb-notification-badge sb-notification-badge--${badgeSeverity}`} aria-hidden="true">{unread.length > 99 ? '99+' : unread.length}</span>}
    </button>
    {open && <section id={id} className="sb-notification-panel" aria-labelledby={`${id}-title`}>
      <header><div><h2 id={`${id}-title`}>Notifications</h2><p>{subtitle}</p></div><button type="button" aria-label="Close notifications" onClick={closeAndFocus}><XIcon size={18} /></button></header>
      {ready && entries.length > 0 && <div className="sb-notification-toolbar"><span role="status">{unread.length} unread · {entries.length} current</span><button type="button" onClick={() => { if (unread.length) markRead(entries) }} aria-disabled={!unread.length}>Mark all as read</button></div>}
      {error && <div className="sb-notification-state" role="status"><p>Reminders could not refresh. {ready ? 'Showing the last available reminders.' : 'Try again shortly.'}</p><button type="button" className="sb-notification-retry" onClick={onRetry}>Retry reminders</button></div>}
      {!ready ? <p className="sb-notification-state" role="status">{loading ? 'Loading reminders…' : error ? 'Reminders are unavailable.' : 'Reminders are not available yet.'}</p>
        : entries.length ? <ul className="sb-notification-list">{entries.map(entry => {
          const Icon = icons[entry.kind]
          const severity = notificationSeverity(entry)
          const read = isRead(entry)
          return <li key={entry.id}><Link to={entry.to} onClick={() => { markRead([entry]); onClose() }} onAuxClick={event => { if (event.button === 1) markRead([entry]) }} className={`sb-notification-card sb-notification-card--${severity} ${read ? 'is-read' : 'is-unread'}`}>
            <span className={`sb-notification-icon sb-notification-icon--${severity}`} aria-hidden="true"><Icon size={18} /></span>
            <span className="sb-notification-content"><span className="sb-notification-title">{entry.title}{entry.count != null && <span>{entry.count}</span>}</span><span className="sb-notification-description">{entry.description}</span><span className="sb-notification-meta">{NOTIFICATION_LABELS[severity]} · {read ? 'Read' : 'Unread'}</span></span>
            <span aria-hidden="true"><ChevronRightIcon size={16} /></span>
          </Link></li>
        })}</ul> : <div className="sb-notification-state"><span aria-hidden="true"><BellIcon size={27} /></span><strong>{error ? 'No reminders in the last available data' : "You're all caught up"}</strong><p>{error ? 'Retry to check the current reminders.' : emptyDescription}</p></div>}
      {ready && entries.length > 0 && <footer>The badge counts unread updates. Read status is saved in this browser. {footerText}</footer>}
    </section>}
  </div>
}
