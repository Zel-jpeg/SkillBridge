// src/hooks/admin/useAdminNotifications.js
//
// Data hook for AdminNotifications.
// Currently wraps local dummy data — swap to real API when backend endpoint is ready:
//   GET  /api/notifications/          → list
//   PATCH /api/notifications/:id/read/  → mark one read
//   PATCH /api/notifications/read-all/ → mark all read

import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'

// ── Notification type → icon + colour config ──────────────────────
// UserPlusIcon, BuildingIcon, etc. are rendered inline in the page
// since they're page-specific enough not to pollute Icons.jsx
export const TYPE_CONFIG = {
  instructor_added:     { iconKey: 'user-plus', bg: 'bg-blue-50 dark:bg-blue-950',    icon: 'text-blue-600 dark:text-blue-400'    },
  assessment_submitted: { iconKey: 'clipboard', bg: 'bg-green-50 dark:bg-green-950',  icon: 'text-green-600 dark:text-green-400'  },
  company_registered:   { iconKey: 'building',  bg: 'bg-violet-50 dark:bg-violet-950',icon: 'text-violet-600 dark:text-violet-400' },
  retake_allowed:       { iconKey: 'refresh',   bg: 'bg-amber-50 dark:bg-amber-950',  icon: 'text-amber-600 dark:text-amber-400'  },
  system_update:        { iconKey: 'zap',       bg: 'bg-gray-100 dark:bg-gray-800',   icon: 'text-gray-500 dark:text-gray-400'    },
}

// ── Static dummy data — replace with useApi('/api/notifications/') ──
const DUMMY_NOTIFICATIONS = [
  { id: 1, type: 'instructor_added',     title: 'New Instructor Request', body: 'Alice Walker has requested instructor access and is pending approval.', link: '/admin/users', is_read: false, created_at: '2026-04-10T10:32:00Z' },
  { id: 2, type: 'assessment_submitted', title: 'Assessment Submitted',   body: 'Elmar Patalinghug (2023-01094) has completed the BSIT Skills Assessment.', link: '/admin/users', is_read: false, created_at: '2026-04-10T09:15:00Z' },
  { id: 3, type: 'company_registered',   title: 'Azeus Systems Registered', body: 'A new company profile was created for Azeus Systems Philippines.', link: '/admin/companies', is_read: false, created_at: '2026-04-10T08:00:00Z' },
  { id: 4, type: 'retake_allowed',       title: 'Retake Enabled',         body: 'Ma. Lourdes Reyes allowed a retake for Sheila Abella (2023-01122).', link: '/admin/users', is_read: true, created_at: '2026-04-09T14:55:00Z' },
  { id: 5, type: 'company_registered',   title: 'New Company Added',      body: 'Accenture CDO has been added to the company roster with 5 open positions.', link: '/admin/companies', is_read: true, created_at: '2026-04-09T11:20:00Z' },
  { id: 6, type: 'assessment_submitted', title: 'Assessment Submitted',   body: 'Jonalyn Caballero (2023-01089) has completed the BSIS Skills Assessment.', link: '/admin/users', is_read: true, created_at: '2026-04-08T16:40:00Z' },
  { id: 7, type: 'system_update',        title: 'System Update',          body: 'Assessment matching engine updated to v2.0. Cosine similarity weights recalibrated.', link: '/admin/dashboard', is_read: true, created_at: '2026-04-08T08:00:00Z' },
]

export function relativeTime(iso) {
  const diff = Math.floor((Date.now() - new Date(iso)) / 1000)
  if (diff < 60)    return 'Just now'
  if (diff < 3600)  return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  return `${Math.floor(diff / 86400)}d ago`
}

export function useAdminNotifications() {
  const navigate = useNavigate()
  const [notifications, setNotifications] = useState(DUMMY_NOTIFICATIONS)
  const [filter,        setFilter]        = useState('all')

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

  const tabs = [
    { key: 'all',    label: 'All',    count: notifications.length },
    { key: 'unread', label: 'Unread', count: unreadCount },
    { key: 'read',   label: 'Read',   count: notifications.length - unreadCount },
  ]

  return { notifications, filtered, filter, setFilter, tabs, unreadCount, markRead, markAllRead, handleClick, TYPE_CONFIG, relativeTime }
}
