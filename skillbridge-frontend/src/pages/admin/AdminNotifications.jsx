// src/pages/admin/AdminNotifications.jsx
//
// Shows all notifications for the logged-in admin.
// Features:
//   1. Filter tabs: All | Unread | Read
//   2. "Mark all as read" button
//   3. Click any row → navigate to linked page + mark as read
//   4. Unread rows have a blue tint + bold title
//   5. Empty state per filter tab
//
// TODO Week 3–4: replace DUMMY_NOTIFICATIONS with real API data
//   GET    /api/notifications/           → list for logged-in user (ordered by created_at DESC)
//   PATCH  /api/notifications/:id/read/  → mark one as read
//   PATCH  /api/notifications/read-all/  → mark all as read

import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'

// ── Icons ─────────────────────────────────────────────────────────
const MenuIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
    <path d="M3 12h18M3 6h18M3 18h18"/>
  </svg>
)
const XIcon = ({ size = 14 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
    <path d="M18 6L6 18M6 6l12 12"/>
  </svg>
)
const BellIcon = ({ size = 18 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
    <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
  </svg>
)
const UserPlusIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="8.5" cy="7" r="4"/>
    <line x1="20" y1="8" x2="20" y2="14"/><line x1="23" y1="11" x2="17" y2="11"/>
  </svg>
)
const BuildingIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
    <polyline points="9 22 9 12 15 12 15 22"/>
  </svg>
)
const ClipboardIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2"/>
    <rect x="9" y="3" width="6" height="4" rx="1"/>
    <path d="M9 12h6M9 16h4"/>
  </svg>
)
const RefreshIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M23 4v6h-6"/><path d="M1 20v-6h6"/>
    <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>
  </svg>
)
const ZapIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
  </svg>
)
const CheckAllIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M2 12l5 5L22 4"/><path d="M8 12l5 5"/>
  </svg>
)
const ChevronRightIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M9 18l6-6-6-6"/>
  </svg>
)

// ── Dummy data — replace with GET /api/notifications/ in Week 3–4 ──
const ADMIN = { name: 'System Administrator', initials: 'SA' }

const DUMMY_NOTIFICATIONS = [
  {
    id: 1,
    type: 'instructor_added',
    title: 'New Instructor Request',
    body: 'Alice Walker has requested instructor access and is pending approval.',
    link: '/admin/users',
    is_read: false,
    created_at: '2026-04-10T10:32:00Z',
  },
  {
    id: 2,
    type: 'assessment_submitted',
    title: 'Assessment Submitted',
    body: 'Elmar Patalinghug (2023-01094) has completed the BSIT Skills Assessment.',
    link: '/admin/users',
    is_read: false,
    created_at: '2026-04-10T09:15:00Z',
  },
  {
    id: 3,
    type: 'company_registered',
    title: 'Azeus Systems Registered',
    body: 'A new company profile was created for Azeus Systems Philippines.',
    link: '/admin/companies',
    is_read: false,
    created_at: '2026-04-10T08:00:00Z',
  },
  {
    id: 4,
    type: 'retake_allowed',
    title: 'Retake Enabled',
    body: 'Ma. Lourdes Reyes allowed a retake for Sheila Abella (2023-01122).',
    link: '/admin/users',
    is_read: true,
    created_at: '2026-04-09T14:55:00Z',
  },
  {
    id: 5,
    type: 'company_registered',
    title: 'New Company Added',
    body: 'Accenture CDO has been added to the company roster with 5 open positions.',
    link: '/admin/companies',
    is_read: true,
    created_at: '2026-04-09T11:20:00Z',
  },
  {
    id: 6,
    type: 'assessment_submitted',
    title: 'Assessment Submitted',
    body: 'Jonalyn Caballero (2023-01089) has completed the BSIS Skills Assessment.',
    link: '/admin/users',
    is_read: true,
    created_at: '2026-04-08T16:40:00Z',
  },
  {
    id: 7,
    type: 'system_update',
    title: 'System Update',
    body: 'Assessment matching engine updated to v2.0. Cosine similarity weights recalibrated.',
    link: '/admin/dashboard',
    is_read: true,
    created_at: '2026-04-08T08:00:00Z',
  },
]

// ── Notification type config ──────────────────────────────────────
const TYPE_CONFIG = {
  instructor_added:    { Icon: UserPlusIcon,  bg: 'bg-blue-50 dark:bg-blue-950',    icon: 'text-blue-600 dark:text-blue-400'   },
  assessment_submitted:{ Icon: ClipboardIcon, bg: 'bg-green-50 dark:bg-green-950',  icon: 'text-green-600 dark:text-green-400' },
  company_registered:  { Icon: BuildingIcon,  bg: 'bg-violet-50 dark:bg-violet-950',icon: 'text-violet-600 dark:text-violet-400'},
  retake_allowed:      { Icon: RefreshIcon,   bg: 'bg-amber-50 dark:bg-amber-950',  icon: 'text-amber-600 dark:text-amber-400' },
  system_update:       { Icon: ZapIcon,       bg: 'bg-gray-100 dark:bg-gray-800',   icon: 'text-gray-500 dark:text-gray-400'   },
}

// ── Relative time helper ──────────────────────────────────────────
function relativeTime(iso) {
  const diff = Math.floor((Date.now() - new Date(iso)) / 1000)
  if (diff < 60)   return 'Just now'
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400)return `${Math.floor(diff / 3600)}h ago`
  return `${Math.floor(diff / 86400)}d ago`
}

// ── Admin Nav (identical to AdminDashboard / AdminCompanies) ──────
function AdminNav({ admin }) {
  const navigate = useNavigate()
  const [open,      setOpen]      = useState(false)
  const [notifOpen, setNotifOpen] = useState(false)
  const [mobile,    setMobile]    = useState(false)
  const [dark,      setDark]      = useState(() => localStorage.getItem('sb-theme') === 'dark')

  function toggleDark() {
    const next = !dark; setDark(next)
    document.documentElement.classList.toggle('dark', next)
    localStorage.setItem('sb-theme', next ? 'dark' : 'light')
  }

  function go(path) {
    navigate(path)
    setMobile(false)
    setOpen(false)
  }

  const links = [
    { label: 'Dashboard', path: '/admin/dashboard' },
    { label: 'Companies', path: '/admin/companies' },
    { label: 'Users',     path: '/admin/users'     },
    // Notifications is not a top-level nav link — accessed via bell icon
  ]

  return (
    <>
      <nav className="bg-white dark:bg-gray-900 border-b border-gray-100 dark:border-gray-800 px-4 sm:px-6 h-14 flex items-center justify-between sticky top-0 z-10">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 bg-green-600 rounded-lg flex items-center justify-center shrink-0">
            <svg width="16" height="16" viewBox="0 0 26 26" fill="none">
              <path d="M3 18 Q3 10 13 10 Q23 10 23 18" stroke="white" strokeWidth="2.2" strokeLinecap="round"/>
              <path d="M7 18 L7 14M13 18 L13 12M19 18 L19 14" stroke="white" strokeWidth="2.2" strokeLinecap="round"/>
              <circle cx="7" cy="8" r="2.5" fill="white" opacity="0.85"/>
              <circle cx="19" cy="8" r="2.5" fill="white" opacity="0.85"/>
            </svg>
          </div>
          <span className="text-sm font-semibold text-gray-900 dark:text-white">SkillBridge</span>
          <span className="hidden sm:inline text-gray-300 dark:text-gray-700">/</span>
          <span className="hidden sm:inline text-sm text-gray-500 dark:text-gray-400">Admin</span>
        </div>

        {/* Desktop nav links */}
        <div className="hidden md:flex items-center gap-1">
          {links.map(l => (
            <button key={l.label} onClick={() => go(l.path)}
              className="px-3 py-1.5 rounded-lg text-sm transition-colors text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-50 dark:hover:bg-gray-800">
              {l.label}
            </button>
          ))}
        </div>

        {/* Right side */}
        <div className="flex items-center gap-2">

          {/* Notification bell — links back to this page */}
          <div className="relative hidden sm:block">
            <button onClick={() => { setNotifOpen(p => !p); setOpen(false) }} className="relative p-1.5 rounded-full text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
              <BellIcon />
              <span className="absolute top-1 right-1.5 w-2 h-2 bg-rose-500 rounded-full border-2 border-white dark:border-gray-900 pointer-events-none"></span>
            </button>
            {notifOpen && (
              <div className="absolute right-0 mt-2 w-72 bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-2xl shadow-lg overflow-hidden z-20">
                <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-800 flex justify-between items-center">
                  <p className="text-sm font-bold text-gray-900 dark:text-white">Notifications</p>
                  <span className="text-[10px] uppercase font-bold text-gray-400">3 New</span>
                </div>
                <div className="max-h-64 overflow-y-auto">
                  <div onClick={() => { go('/admin/users'); setNotifOpen(false) }} className="px-4 py-3 border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/50 cursor-pointer flex gap-3 transition-colors bg-blue-50/30 dark:bg-blue-900/10">
                    <div className="mt-0.5 w-2 h-2 bg-blue-500 rounded-full shrink-0"></div>
                    <div>
                      <p className="text-sm font-semibold text-gray-900 dark:text-white leading-snug">New Instructor Request</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Alice Walker has requested instructor access.</p>
                      <p className="text-[10px] text-gray-400 mt-1">2 mins ago</p>
                    </div>
                  </div>
                  <div onClick={() => { go('/admin/companies'); setNotifOpen(false) }} className="px-4 py-3 border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/50 cursor-pointer flex gap-3 transition-colors">
                    <div className="mt-0.5 w-2 h-2 bg-gray-200 dark:bg-gray-700 rounded-full shrink-0"></div>
                    <div>
                      <p className="text-sm font-semibold text-gray-900 dark:text-white leading-snug">Azeus Systems Registered</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">A new company profile was created.</p>
                      <p className="text-[10px] text-gray-400 mt-1">1 hour ago</p>
                    </div>
                  </div>
                  <div className="px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-800/50 cursor-pointer flex gap-3 transition-colors">
                    <div className="mt-0.5 w-2 h-2 bg-gray-200 dark:bg-gray-700 rounded-full shrink-0"></div>
                    <div>
                      <p className="text-sm font-semibold text-gray-900 dark:text-white leading-snug">System Update</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Assessment matching engine updated to v2.0.</p>
                      <p className="text-[10px] text-gray-400 mt-1">1 day ago</p>
                    </div>
                  </div>
                </div>
                <div className="px-4 py-2 bg-gray-50 dark:bg-gray-800/50 text-center border-t border-gray-100 dark:border-gray-800">
                  <button onClick={() => { go('/admin/notifications'); setNotifOpen(false) }} className="text-xs font-semibold text-blue-600 hover:text-blue-700 dark:text-blue-400">View All activity</button>
                </div>
              </div>
            )}
          </div>

          {/* Hamburger */}
          <button
            onClick={() => setMobile(p => !p)}
            className="md:hidden p-2 rounded-lg text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 active:bg-gray-200 dark:active:bg-gray-700 transition-colors"
            aria-label="Toggle menu"
          >
            {mobile ? <XIcon size={20} /> : <MenuIcon />}
          </button>

          {/* Avatar dropdown */}
          <div className="relative ml-1">
            <button
              onClick={() => { setOpen(p => !p); setNotifOpen(false) }}
              className="w-8 h-8 rounded-full bg-rose-100 dark:bg-rose-900 flex items-center justify-center text-xs font-semibold text-rose-700 dark:text-rose-300 hover:ring-2 hover:ring-rose-400 transition-all"
            >
              {admin.initials}
            </button>
            {open && (
              <div className="absolute right-0 mt-2 w-56 bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-2xl shadow-xl overflow-hidden z-40">
                <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-800">
                  <p className="text-sm font-semibold text-gray-900 dark:text-white truncate">{admin.name}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">Administrator</p>
                </div>
                <div className="px-4 py-3 flex items-center justify-between border-b border-gray-100 dark:border-gray-800">
                  <span className="text-sm text-gray-700 dark:text-gray-300">{dark ? 'Dark mode' : 'Light mode'}</span>
                  <button onClick={toggleDark}
                    className={`relative w-9 h-5 rounded-full transition-colors ${dark ? 'bg-green-600' : 'bg-gray-200'}`}>
                    <span className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${dark ? 'translate-x-4' : 'translate-x-0'}`} />
                  </button>
                </div>
                <button onClick={() => go('/login')}
                  className="w-full text-left px-4 py-3 text-sm text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950 transition-colors">
                  Sign out
                </button>
              </div>
            )}
          </div>
        </div>
      </nav>

      {/* Mobile slide-down menu */}
      {mobile && (
        <div className="md:hidden bg-white dark:bg-gray-900 border-b border-gray-100 dark:border-gray-800 shadow-sm">
          <div className="px-4 py-3 flex flex-col gap-1">
            {links.map(l => (
              <button key={l.label} onClick={() => go(l.path)}
                className="w-full text-left px-3 py-2.5 rounded-xl text-sm transition-colors text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-50 dark:hover:bg-gray-800">
                {l.label}
              </button>
            ))}
          </div>
        </div>
      )}
    </>
  )
}

// ── Empty state ────────────────────────────────────────────────────
function EmptyState({ filter }) {
  const msgs = {
    all:    { icon: '🔔', title: 'No notifications yet', sub: 'Activity from users and the system will appear here.' },
    unread: { icon: '✅', title: 'You\'re all caught up!', sub: 'No unread notifications right now.' },
    read:   { icon: '📭', title: 'No read notifications', sub: 'Notifications you\'ve opened will appear here.' },
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

// ── Main Component ────────────────────────────────────────────────
export default function AdminNotifications() {
  const navigate = useNavigate()

  const [notifications, setNotifications] = useState(DUMMY_NOTIFICATIONS)
  const [filter, setFilter] = useState('all') // 'all' | 'unread' | 'read'

  const unreadCount = notifications.filter(n => !n.is_read).length

  const filtered = useMemo(() => {
    if (filter === 'unread') return notifications.filter(n => !n.is_read)
    if (filter === 'read')   return notifications.filter(n =>  n.is_read)
    return notifications
  }, [notifications, filter])

  function markRead(id) {
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n))
  }

  function markAllRead() {
    setNotifications(prev => prev.map(n => ({ ...n, is_read: true })))
  }

  function handleClick(notif) {
    markRead(notif.id)
    navigate(notif.link)
  }

  const TABS = [
    { key: 'all',    label: 'All',    count: notifications.length },
    { key: 'unread', label: 'Unread', count: unreadCount },
    { key: 'read',   label: 'Read',   count: notifications.length - unreadCount },
  ]

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      <AdminNav admin={ADMIN} />

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
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
              Activity from users, instructors, and the system.
            </p>
          </div>

          {unreadCount > 0 && (
            <button
              onClick={markAllRead}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 active:bg-gray-200 transition-colors"
            >
              <CheckAllIcon />
              Mark all as read
            </button>
          )}
        </div>

        {/* Filter tabs */}
        <div className="flex items-center gap-1 bg-gray-100 dark:bg-gray-800/60 rounded-xl p-1 w-fit">
          {TABS.map(t => (
            <button
              key={t.key}
              onClick={() => setFilter(t.key)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors
                ${filter === t.key
                  ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm'
                  : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'}`}
            >
              {t.label}
              <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full
                ${filter === t.key
                  ? t.key === 'unread' && t.count > 0
                    ? 'bg-rose-500 text-white'
                    : 'bg-gray-100 dark:bg-gray-600 text-gray-500 dark:text-gray-300'
                  : 'bg-gray-200 dark:bg-gray-700 text-gray-400 dark:text-gray-500'}`}>
                {t.count}
              </span>
            </button>
          ))}
        </div>

        {/* Notification list */}
        {filtered.length === 0 ? (
          <EmptyState filter={filter} />
        ) : (
          <div className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-2xl overflow-hidden divide-y divide-gray-50 dark:divide-gray-800">
            {filtered.map(n => {
              const cfg = TYPE_CONFIG[n.type] ?? TYPE_CONFIG.system_update
              const { Icon } = cfg
              return (
                <div
                  key={n.id}
                  onClick={() => handleClick(n)}
                  className={`flex items-start gap-4 px-5 py-4 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors group
                    ${!n.is_read ? 'bg-blue-50/40 dark:bg-blue-900/10' : ''}`}
                >
                  {/* Type icon */}
                  <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 mt-0.5 ${cfg.bg} ${cfg.icon}`}>
                    <Icon />
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <p className={`text-sm leading-snug ${!n.is_read ? 'font-semibold text-gray-900 dark:text-white' : 'font-medium text-gray-700 dark:text-gray-300'}`}>
                        {n.title}
                      </p>
                      <span className="text-[10px] text-gray-400 dark:text-gray-500 shrink-0 mt-0.5 whitespace-nowrap">
                        {relativeTime(n.created_at)}
                      </span>
                    </div>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 leading-relaxed">
                      {n.body}
                    </p>
                  </div>

                  {/* Unread dot + chevron */}
                  <div className="flex items-center gap-2 shrink-0 mt-1">
                    {!n.is_read && (
                      <span className="w-2 h-2 rounded-full bg-blue-500 shrink-0" />
                    )}
                    <span className="text-gray-300 dark:text-gray-600 group-hover:text-gray-400 dark:group-hover:text-gray-500 transition-colors">
                      <ChevronRightIcon />
                    </span>
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* Footer note */}
        <p className="text-center text-xs text-gray-300 dark:text-gray-700 pb-4">
          Notifications are kept for 30 days · Older activity is automatically archived
        </p>

      </main>
    </div>
  )
}