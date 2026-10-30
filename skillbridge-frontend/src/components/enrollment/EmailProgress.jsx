import { useCallback, useEffect, useState, useSyncExternalStore } from 'react'
import { useApi } from '../../hooks/useApi'
import { queryStore } from '../../api/queryStore'
import { emailProgressText } from '../../utils/emailProgress'
import { dismissedEmailGroups, emailProgressDismissalKey, rememberDismissedEmailGroup } from '../../utils/emailProgressDismissal'
import { MailIcon, XIcon } from '../Icons'

export function BatchEmailProgress({ batchId, onView, paused = false }) {
  const url = batchId ? `/api/instructor/batches/${batchId}/email-progress/` : null
  const { data, error } = useApi(url, { skip: !batchId })
  // Transient background failures retain cached data without a useApi error message.
  useSyncExternalStore(queryStore.observe, queryStore.revision)
  const stale = Boolean(error || queryStore.error(url))
  let storage
  try { storage = window.localStorage } catch { /* Private browser settings can block storage. */ }
  const owner = emailProgressDismissalKey(storage)
  if (!data?.groups?.length) return stale ? <p role="status" className="text-xs text-gray-600 dark:text-gray-400">Email progress could not refresh. Open Enrollment emails to check.</p> : null
  const group = data.groups[0]
  return <CompactEmailProgress key={`${owner}:${group.id}`} group={group} onView={onView} stale={stale} paused={paused} storage={storage} owner={owner} />
}

function CompactEmailProgress({ group, onView, stale, paused, storage, owner }) {
  const [dismissed, setDismissed] = useState(() => dismissedEmailGroups(storage, owner).includes(group.id))
  const [hovered, setHovered] = useState(false)
  const [focused, setFocused] = useState(false)
  const [hidden, setHidden] = useState(document.hidden)
  const delivered = group.state === 'delivered'
  const canDismiss = delivered && !stale
  const dismiss = useCallback(() => {
    rememberDismissedEmailGroup(storage, owner, group.id)
    setDismissed(true)
  }, [group.id, owner, storage])

  useEffect(() => {
    const visibility = () => setHidden(document.hidden)
    document.addEventListener('visibilitychange', visibility)
    return () => document.removeEventListener('visibilitychange', visibility)
  }, [])

  useEffect(() => {
    if (!canDismiss || dismissed || paused || hovered || focused || hidden) return
    const timeout = window.setTimeout(dismiss, 10_000)
    return () => window.clearTimeout(timeout)
  }, [canDismiss, dismiss, dismissed, paused, hovered, focused, hidden])

  // A later failed/uncertain refresh must remain visible even after success was dismissed.
  if (canDismiss && dismissed) return null
  return <div onPointerEnter={event => { if (event.pointerType !== 'touch') setHovered(true) }} onPointerLeave={() => setHovered(false)}
    onFocusCapture={() => setFocused(true)} onBlurCapture={event => { if (!event.currentTarget.contains(event.relatedTarget)) setFocused(false) }}>
    <EmailProgress groups={[group]} compact onView={onView} stale={stale} onDismiss={canDismiss ? dismiss : undefined} />
  </div>
}

export default function EmailProgress({ groups = [], compact = false, onView, onDismiss, stale = false, initialGroupId = '' }) {
  const [selected, setSelected] = useState(initialGroupId)
  const group = groups.find(item => item.id === selected) || groups[0]
  if (!group) return null
  const text = emailProgressText(group)
  const percent = Math.round(group.submitted / group.total * 100)
  const tone = text.tone === 'warning' ? 'border-amber-200 bg-amber-50/70 dark:border-amber-900 dark:bg-amber-950/30'
    : text.tone === 'success' ? 'border-green-200 bg-green-50/70 dark:border-green-900 dark:bg-green-950/30'
      : 'border-gray-200 bg-gray-50/70 dark:border-gray-700 dark:bg-gray-800/40'
  return <section aria-label="Enrollment email progress" className={`rounded-xl border p-4 text-xs ${tone}`}>
    <div className={`flex gap-3 ${compact ? 'flex-wrap items-center' : 'items-start'}`}>
      <span aria-hidden="true" className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-white text-green-700 dark:bg-gray-900 dark:text-green-300"><MailIcon size={20} /></span>
      <div className={compact ? 'min-w-0 flex-[1_1_10rem]' : 'min-w-0 flex-1'}><h3 className="font-semibold text-gray-900 dark:text-white">{text.title}</h3>
        <p className="mt-1 text-gray-600 dark:text-gray-300">{group.source === 'enrollment' ? 'Enrollment' : 'Email request'} · {group.total} recipients · {new Intl.DateTimeFormat('en-PH', { timeZone: 'Asia/Manila', dateStyle: 'medium', timeStyle: 'short' }).format(new Date(group.created_at))}</p>
      </div>
      {compact && <button className="ml-auto min-h-11 shrink-0 font-semibold text-green-800 underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-green-600 dark:text-green-300" onClick={() => onView?.(group.id)}>View progress</button>}
      {compact && onDismiss && <button type="button" aria-label="Dismiss delivered email confirmation" onClick={onDismiss}
        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-green-800 transition-colors hover:bg-green-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-green-600 dark:text-green-300 dark:hover:bg-green-900/50 dark:focus-visible:outline-green-400">
        <span aria-hidden="true"><XIcon size={16} /></span>
      </button>}
    </div>
    {!compact && groups.length > 1 && <label className="mt-3 block text-gray-600 dark:text-gray-300">Email sending group<select aria-label="Email sending group" className="mt-1 min-h-11 w-full rounded-lg border border-gray-300 bg-white px-3 text-xs dark:border-gray-600 dark:bg-gray-900" value={group.id} onChange={event => setSelected(event.target.value)}>
      {groups.map(item => <option key={item.id} value={item.id}>{item.source === 'enrollment' ? 'Enrollment' : 'Email request'} · {item.total} recipients · {new Date(item.created_at).toLocaleString('en-PH', { timeZone: 'Asia/Manila' })}</option>)}
    </select></label>}
    <div className="mt-3"><p className="font-semibold text-gray-900 dark:text-white">{group.submitted} of {group.total} emails submitted <span className="float-right font-normal text-gray-600 dark:text-gray-300">{percent}%</span></p>
      <div role="progressbar" aria-label="Emails submitted" aria-valuemin={0} aria-valuemax={group.total} aria-valuenow={group.submitted} aria-valuetext={`${group.submitted} of ${group.total} emails submitted; delivery is separate`} className="mt-2 h-1.5 overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700"><div className="h-full rounded-full bg-green-600" style={{ width: `${percent}%` }} /></div>
      <p className="mt-2 leading-5 text-gray-600 dark:text-gray-300">{text.detail}</p>
      {group.state !== 'delivered' && <p className="mt-1 text-gray-600 dark:text-gray-400">Submitted does not mean delivered. You can keep working.</p>}
      {stale && <p role="status" className="mt-2 text-amber-800 dark:text-amber-200">Progress could not refresh. Showing the last saved status.</p>}
    </div>
  </section>
}
