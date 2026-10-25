import { useEffect, useState } from 'react'
import { invalidateCache, useApi } from '../../hooks/useApi'
import { studentNotifications } from '../../utils/studentNotifications'
import { NotificationDropdown } from './NotificationMenu'

export default function StudentNotificationMenu(props) {
  const profile = useApi('/api/students/me/')
  const hasBatch = Boolean(profile.data?.batch)
  const assessments = useApi('/api/assessments/', { skip: !hasBatch })
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    function tick() { if (document.visibilityState === 'visible') setNow(Date.now()) }
    // A display clock only: API refresh still uses the existing shared cache/SSE.
    const timer = window.setInterval(tick, 30_000)
    document.addEventListener('visibilitychange', tick)
    return () => { window.clearInterval(timer); document.removeEventListener('visibilitychange', tick) }
  }, [])
  const error = profile.error || (hasBatch ? assessments.error : null)
  const ready = Boolean(profile.data && (!hasBatch || assessments.data)) || Boolean(error && profile.data)
  const entries = studentNotifications(assessments.data?.assessments ?? [], profile.data, now)
  return <NotificationDropdown {...props} entries={entries} ready={ready} error={error}
    loading={profile.loading || (hasBatch && assessments.loading)}
    onRetry={() => { invalidateCache('/api/students/me/'); if (hasBatch) invalidateCache('/api/assessments/') }}
    subtitle="Your assessments and OJT placement" badgeUnit="notifications"
    emptyDescription={profile.data?.batch ? 'No current assessment reminders or approved placement updates.' : 'No current reminders. Your coordinator can help with batch enrollment.'}
    footerText="Deadline reminders update as time passes and clear after submission. Retake access and approved placement reflect your current records." />
}
