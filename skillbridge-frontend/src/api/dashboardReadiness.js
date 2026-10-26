export const DASHBOARD_READY_BUDGET_MS = 1500

// Bound the sign-in handoff, not the requests themselves: a slow request is
// adopted by the mounted dashboard rather than aborted and started again.
export function waitForDashboard({ loadCode, loadData, isCurrent = () => true, signal,
  budgetMs = DASHBOARD_READY_BUDGET_MS, setTimer = setTimeout, clearTimer = clearTimeout }) {
  return new Promise(resolve => {
    if (signal?.aborted || !isCurrent()) { resolve({ reason: 'cancelled' }); return }
    let done = false, timer
    function finish(reason) {
      if (done) return
      done = true
      if (timer !== undefined) clearTimer(timer)
      signal?.removeEventListener('abort', cancel)
      resolve({ reason: signal?.aborted || !isCurrent() ? 'cancelled' : reason })
    }
    function cancel() { finish('cancelled') }
    signal?.addEventListener('abort', cancel, { once: true })
    timer = setTimer(() => finish('timeout'), budgetMs)
    // Start both independent paths without making code download gate the GETs.
    const start = action => { try { return Promise.resolve(action()) } catch (error) { return Promise.reject(error) } }
    Promise.allSettled([start(loadCode), start(loadData)]).then(results => {
      finish(results.some(result => result.status === 'rejected') ? 'partial' : 'ready')
    })
  })
}
