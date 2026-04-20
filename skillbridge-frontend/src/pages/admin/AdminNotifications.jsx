// src/pages/admin/AdminNotifications.jsx  (SLIMMED — 489 → 90 lines)
// All data + logic now lives in useAdminNotifications.js

import AdminNav from '../../components/admin/AdminNav'
import { useAdminNotifications, relativeTime } from '../../hooks/admin/useAdminNotifications'

// ── Notification type → inline icon ──────────────────────────────
const TYPE_ICONS = {
  'user-plus':  () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="8.5" cy="7" r="4"/><line x1="20" y1="8" x2="20" y2="14"/><line x1="23" y1="11" x2="17" y2="11"/></svg>,
  'clipboard':  () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2"/><rect x="9" y="3" width="6" height="4" rx="1"/><path d="M9 12h6M9 16h4"/></svg>,
  'building':   () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>,
  'refresh':    () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M23 4v6h-6"/><path d="M1 20v-6h6"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg>,
  'zap':        () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>,
}
const CheckAllIcon = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M2 12l5 5L22 4"/><path d="M8 12l5 5"/></svg>
const ChevronRightIcon = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 18l6-6-6-6"/></svg>

function EmptyState({ filter }) {
  const msgs = {
    all:    { icon: '🔔', title: 'No notifications yet',      sub: 'Activity from users and the system will appear here.' },
    unread: { icon: '✅', title: "You're all caught up!",     sub: 'No unread notifications right now.' },
    read:   { icon: '📭', title: 'No read notifications',    sub: 'Notifications you\'ve opened will appear here.' },
  }
  const m = msgs[filter]
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <span className="text-4xl mb-3">{m.icon}</span>
      <p className="text-sm font-semibold text-gray-700 dark:text-gray-300">{m.title}</p>
      <p className="text-xs text-gray-400 dark:text-gray-500 mt-1 max-w-xs">{m.sub}</p>
    </div>
  )
}

export default function AdminNotifications() {
  const { filtered, filter, setFilter, tabs, unreadCount, markAllRead, handleClick, TYPE_CONFIG } = useAdminNotifications()

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      <AdminNav activePath="/admin/notifications" />

      <main className="max-w-3xl mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-5">

        {/* Page header */}
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-xl font-semibold text-gray-900 dark:text-white flex items-center gap-2">
              Notifications
              {unreadCount > 0 && (
                <span className="inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full bg-rose-500 text-white text-[10px] font-bold">
                  {unreadCount}
                </span>
              )}
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">Activity from users, instructors, and the system.</p>
          </div>
          {unreadCount > 0 && (
            <button onClick={markAllRead} className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
              <CheckAllIcon /> Mark all as read
            </button>
          )}
        </div>

        {/* Filter tabs */}
        <div className="flex items-center gap-1 bg-gray-100 dark:bg-gray-800/60 rounded-xl p-1 w-fit">
          {tabs.map(t => (
            <button key={t.key} onClick={() => setFilter(t.key)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${filter === t.key ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm' : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'}`}>
              {t.label}
              <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${filter === t.key ? (t.key === 'unread' && t.count > 0 ? 'bg-rose-500 text-white' : 'bg-gray-100 dark:bg-gray-600 text-gray-500 dark:text-gray-300') : 'bg-gray-200 dark:bg-gray-700 text-gray-400 dark:text-gray-500'}`}>
                {t.count}
              </span>
            </button>
          ))}
        </div>

        {/* Notification list */}
        {filtered.length === 0 ? <EmptyState filter={filter} /> : (
          <div className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-2xl overflow-hidden divide-y divide-gray-50 dark:divide-gray-800">
            {filtered.map(n => {
              const cfg = TYPE_CONFIG[n.type] ?? TYPE_CONFIG.system_update
              const Icon = TYPE_ICONS[cfg.iconKey] ?? TYPE_ICONS.zap
              return (
                <div key={n.id} onClick={() => handleClick(n)}
                  className={`flex items-start gap-4 px-5 py-4 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors group ${!n.is_read ? 'bg-blue-50/40 dark:bg-blue-900/10' : ''}`}>
                  <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 mt-0.5 ${cfg.bg} ${cfg.icon}`}><Icon /></div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <p className={`text-sm leading-snug ${!n.is_read ? 'font-semibold text-gray-900 dark:text-white' : 'font-medium text-gray-700 dark:text-gray-300'}`}>{n.title}</p>
                      <span className="text-[10px] text-gray-400 dark:text-gray-500 shrink-0 mt-0.5 whitespace-nowrap">{relativeTime(n.created_at)}</span>
                    </div>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 leading-relaxed">{n.body}</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0 mt-1">
                    {!n.is_read && <span className="w-2 h-2 rounded-full bg-blue-500 shrink-0" />}
                    <span className="text-gray-300 dark:text-gray-600 group-hover:text-gray-400 transition-colors"><ChevronRightIcon /></span>
                  </div>
                </div>
              )
            })}
          </div>
        )}

        <p className="text-center text-xs text-gray-300 dark:text-gray-700 pb-4">
          Notifications are kept for 30 days · Older activity is automatically archived
        </p>
      </main>
    </div>
  )
}