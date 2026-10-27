import { useEffect, useRef, useState } from 'react'
import api from '../../api/axios'

/** Browser signals describe interruptions, not their cause. Server keeps time/policy. */
export function useAssessmentInterruptions({ active, assessmentId, responseId, identity, markerKey, seed, answers, requireFullscreen, fullscreenElement, enterFullscreen, onStop, onTiming, onWarning }) {
  const [interruption, setInterruption] = useState(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const actions = useRef({})
  const latest = useRef({})
  useEffect(() => { latest.current = { answers, requireFullscreen, fullscreenElement, enterFullscreen, onStop, onTiming, onWarning } })
  useEffect(() => {
    if (!active || !assessmentId || !identity) return
    let alive = true, event = null, pending = Promise.resolve(), revision = Date.now(), restored = false, recovering = false, inFlight = 0
    const url = `/api/assessments/${assessmentId}/interruption/`
    const payload = extra => ({ response_id: responseId, attempt_started_at: identity,
      answers: latest.current.answers(), revision: revision = Math.max(revision + 1, Date.now()), ...extra })
    function store() {
      try {
        const marker = JSON.parse(localStorage.getItem(markerKey) || '{}')
        localStorage.setItem(markerKey, JSON.stringify({ ...marker, interruption: event }))
      } catch { /* server draft and existing local answers still protect recovery */ }
    }
    function send(data) {
      inFlight += 1
      const request = pending.catch(() => {}).then(() => api.post(url, data)).finally(() => { inFlight -= 1 })
      pending = request
      return request
    }
    function begin(reason) {
      if (!alive) return
      if (!event) event = { id: crypto.randomUUID(), since: Date.now(), reasons: [reason] }
      else if (!event.reasons.includes(reason)) event.reasons.push(reason)
      store(); setInterruption({ ...event }); setError('')
      send(payload({ action: 'begin', event_id: event.id, reason })).then(({ data }) => {
        if (!alive || !event) return
        if (data.open_event?.id) { event.id = data.open_event.id; store() }
        if (data.review_required) latest.current.onStop('interruption_review')
      }).catch(() => {
        if (alive) setError('The interruption could not be synchronized. Your answers remain on this device. Retry recovery when connected.')
      })
    }
    async function recover(automatic = false) {
      if (!event || !alive || recovering || document.hidden || !document.hasFocus()) return
      recovering = true
      if (latest.current.requireFullscreen() && !latest.current.fullscreenElement()) {
        if (automatic) { recovering = false; return }
        try { await latest.current.enterFullscreen() } catch { recovering = false; setError('Restore fullscreen to continue.'); return }
      }
      const current = event
      setBusy(true); setError('')
      try {
        // Repeating begin is idempotent and also repairs an offline/failed begin.
        await send(payload({ action: 'begin', event_id: current.id, reason: current.reasons[0] }))
        const { data } = await send(payload({ action: 'recover', event_id: current.id }))
        if (!alive || event !== current) return
        latest.current.onTiming(data)
        event = null; store(); setInterruption(null)
        if (data.review_required || Date.now() - current.since >= 60000) latest.current.onStop('interruption_review')
        else if ((Date.now() - current.since) >= 2000) latest.current.onWarning('Interruption recorded. Your timer continued; your answers were preserved.')
      } catch { if (alive) setError('Recovery could not be confirmed. Check your connection and retry. Your answers are kept on this device.') }
      finally { recovering = false; if (alive) setBusy(false) }
    }
    actions.current = { recover }
    const onBlur = () => begin('window_lost_focus')
    const onVisibility = () => { if (document.hidden) begin('tab_hidden') }
    const onFullscreen = () => { if (latest.current.requireFullscreen() && !latest.current.fullscreenElement()) begin('fullscreen_exited') }
    const onKey = keyboard => {
      const key = keyboard.key.toLowerCase(), modifier = keyboard.ctrlKey || keyboard.metaKey
      if (keyboard.key === 'F12' || keyboard.key === 'F5' ||
          (modifier && ['c', 'v', 'x', 'p', 's', 'f', 'r'].includes(key)) ||
          (modifier && keyboard.shiftKey && ['i', 'j', 'c'].includes(key))) {
        keyboard.preventDefault(); keyboard.stopPropagation()
        latest.current.onWarning('That shortcut is unavailable during the assessment. Your attempt can continue.')
      }
    }
    const preventContext = context => context.preventDefault()
    const onExit = () => {
      if (!event) event = { id: crypto.randomUUID(), since: Date.now(), reasons: ['page_closed'] }
      store()
      const data = payload({ action: 'begin', event_id: event.id, reason: 'page_closed' })
      // Best effort only; durable local state and server recovery do not rely on unload delivery.
      fetch(new URL(url, api.defaults.baseURL || location.origin), { method: 'POST', keepalive: true,
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('sb-token')}` }, body: JSON.stringify(data) }).catch(() => {})
    }
    const tick = () => {
      if (!event) return
      const elapsed = Date.now() - event.since
      setInterruption({ ...event, elapsed: Math.floor(elapsed / 1000) })
      if (!document.hidden && document.hasFocus() && elapsed < 2000 && event.reasons.every(reason => reason === 'window_lost_focus')) recover(true)
    }
    const draft = () => { if (!event && inFlight === 0) send(payload({ action: 'draft' })).catch(() => {}) }
    const timer = setInterval(tick, 500), autosave = setInterval(draft, 15000)
    document.addEventListener('visibilitychange', onVisibility)
    window.addEventListener('blur', onBlur)
    document.addEventListener('fullscreenchange', onFullscreen)
    document.addEventListener('webkitfullscreenchange', onFullscreen)
    window.addEventListener('keydown', onKey, true)
    document.addEventListener('contextmenu', preventContext)
    window.addEventListener('pagehide', onExit)
    window.addEventListener('popstate', onExit)
    // On a reload, recover the same attempt rather than treating it as a new one.
    let local
    try { local = JSON.parse(localStorage.getItem(markerKey) || '{}').interruption } catch { /* no local marker */ }
    if (seed?.open_event) {
      event = { id: seed.open_event.id, since: Date.now() - Math.max(0, seed.open_seconds || 0) * 1000, reasons: seed.open_event.reasons }
      restored = true
    } else if (local?.id) { event = local; restored = true }
    if (restored) { store(); setInterruption({ ...event }); begin(event.reasons[0]) }
    else if (document.hidden) begin('tab_hidden')
    else if (!document.hasFocus()) begin('window_lost_focus')
    else if (latest.current.requireFullscreen() && !latest.current.fullscreenElement()) begin('fullscreen_exited')
    return () => {
      alive = false; clearInterval(timer); clearInterval(autosave); actions.current = {}
      document.removeEventListener('visibilitychange', onVisibility); window.removeEventListener('blur', onBlur)
      document.removeEventListener('fullscreenchange', onFullscreen); document.removeEventListener('webkitfullscreenchange', onFullscreen)
      window.removeEventListener('keydown', onKey, true); document.removeEventListener('contextmenu', preventContext)
      window.removeEventListener('pagehide', onExit); window.removeEventListener('popstate', onExit)
    }
  }, [active, assessmentId, responseId, identity, markerKey, seed])
  return { interruption, busy, error, recover: () => actions.current.recover?.() }
}
