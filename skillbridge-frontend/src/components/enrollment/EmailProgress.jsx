import { useState } from 'react'
import { useApi } from '../../hooks/useApi'
import { emailProgressText } from '../../utils/emailProgress'
import { MailIcon } from '../Icons'

export function BatchEmailProgress({ batchId, onView }) {
  const url = batchId ? `/api/instructor/batches/${batchId}/email-progress/` : null
  const { data, error } = useApi(url, { skip: !batchId })
  if (!data?.groups?.length) return error ? <p role="status" className="text-xs text-gray-600 dark:text-gray-400">Email progress could not refresh. Open Enrollment emails to check.</p> : null
  return <EmailProgress groups={data.groups} compact onView={onView} stale={Boolean(error)} />
}

export default function EmailProgress({ groups = [], compact = false, onView, stale = false, initialGroupId = '' }) {
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
      <div className="min-w-0 flex-1"><h3 className="font-semibold text-gray-900 dark:text-white">{text.title}</h3>
        <p className="mt-1 text-gray-600 dark:text-gray-300">{group.source === 'enrollment' ? 'Enrollment' : 'Email request'} · {group.total} recipients · {new Intl.DateTimeFormat('en-PH', { timeZone: 'Asia/Manila', dateStyle: 'medium', timeStyle: 'short' }).format(new Date(group.created_at))}</p>
      </div>
      {compact && <button className="min-h-11 shrink-0 font-semibold text-green-800 underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-green-600 dark:text-green-300" onClick={() => onView?.(group.id)}>View progress</button>}
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
