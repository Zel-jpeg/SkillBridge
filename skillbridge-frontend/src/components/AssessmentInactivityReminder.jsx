import { useEffect, useRef, useState } from 'react'
import { ClockIcon } from './Icons'

const REMIND_AFTER_MS = 5 * 60 * 1000
const activityEvents = ['pointermove', 'pointerdown', 'keydown', 'touchstart', 'scroll', 'wheel', 'input']

/** A local reading check-in, independent of attempt timing and integrity signals. */
export default function AssessmentInactivityReminder() {
  const [visible, setVisible] = useState(false)
  const acknowledge = useRef(() => {})

  useEffect(() => {
    let lastActivity = performance.now()
    let shown = false
    let timeout
    function check() {
      const remaining = REMIND_AFTER_MS - (performance.now() - lastActivity)
      if (remaining > 0) { timeout = setTimeout(check, remaining); return }
      // The interruption flow owns hidden/unfocused pages, never this reminder.
      if (document.hidden || !document.hasFocus()) { timeout = setTimeout(check, 1000); return }
      shown = true
      setVisible(true)
    }
    function resume(event) {
      if (document.hidden || !document.hasFocus()) return
      lastActivity = performance.now()
      // Keep the Continue button reachable while the pointer is over the panel.
      if (event?.target?.closest?.('[data-assessment-inactivity-reminder]')) return
      if (shown) {
        shown = false
        setVisible(false)
        timeout = setTimeout(check, REMIND_AFTER_MS)
      }
    }
    acknowledge.current = () => resume()
    timeout = setTimeout(check, REMIND_AFTER_MS)
    const options = { capture: true, passive: true }
    for (const name of activityEvents) window.addEventListener(name, resume, options)
    return () => {
      clearTimeout(timeout)
      acknowledge.current = () => {}
      for (const name of activityEvents) window.removeEventListener(name, resume, options)
    }
  }, [])

  if (!visible) return null
  return <aside role="status" aria-live="polite" aria-atomic="true" data-assessment-inactivity-reminder
    className="fixed bottom-24 left-4 right-4 z-40 mx-auto max-w-sm rounded-2xl border border-green-200 bg-white p-5 text-gray-900 shadow-lg dark:border-green-800 dark:bg-gray-900 dark:text-gray-100 sm:left-auto sm:right-6 sm:w-96 lg:bottom-6">
    <div className="flex items-start gap-3"><span aria-hidden="true" className="rounded-lg bg-green-50 p-2 text-green-700 dark:bg-green-950 dark:text-green-300"><ClockIcon size={20} /></span>
      <div><h2 className="text-sm font-semibold">Are you still there?</h2><p className="mt-1 text-xs leading-relaxed text-gray-600 dark:text-gray-300">Your assessment timer is still running.</p></div>
    </div>
    <button type="button" onClick={() => acknowledge.current()} className="mt-4 min-h-11 w-full cursor-pointer rounded-xl bg-green-700 px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-green-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-green-600">Continue assessment</button>
  </aside>
}
