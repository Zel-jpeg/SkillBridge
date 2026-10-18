// One refresh exchange per authenticated session. Request replay is handled only
// for explicit authentication 401 responses by the shared Axios interceptor.
export function createSessionRenewal({ read, exchange, accept, expired }) {
  let flight = null
  const same = (left, right) => left?.id === right?.id && left?.refresh === right?.refresh
  function changed() {
    return Object.assign(new Error('Authenticated session changed'), { code: 'ERR_CANCELED', __CANCEL__: true })
  }
  async function renew(snapshot = read()) {
    const current = read()
    if (!snapshot?.id || !same(current, snapshot)) throw changed()
    if (current.token !== snapshot.token && current.token) return current.token
    if (flight && same(flight.snapshot, snapshot)) return flight.promise
    const operation = { snapshot }
    operation.promise = Promise.resolve().then(async () => {
      try {
        if (!snapshot.refresh) throw Object.assign(new Error('Refresh token unavailable'), { response: { status: 401 } })
        const response = await exchange(snapshot.refresh)
        const latest = read()
        if (!same(latest, snapshot)) throw changed()
        if (latest.token !== snapshot.token && latest.token) return latest.token
        if (typeof response?.access !== 'string' || !response.access) {
          throw Object.assign(new Error('Invalid renewal response'), { response: { status: 503 } })
        }
        accept(response.access, snapshot)
        return response.access
      } catch (error) {
        const latest = read()
        if (!same(latest, snapshot)) throw changed()
        if (latest.token !== snapshot.token && latest.token) return latest.token
        if ([401, 403].includes(error.response?.status)) expired(snapshot)
        throw error
      } finally {
        if (flight === operation) flight = null
      }
    })
    flight = operation
    return operation.promise
  }
  return { renew }
}

export function readBrowserSession(storage = globalThis.localStorage) {
  const token = storage.getItem('sb-token')
  let id = storage.getItem('sb-session-id')
  if (token && !id) {
    id = globalThis.crypto.randomUUID()
    storage.setItem('sb-session-id', id)
  }
  return { id: token ? id : null, token, refresh: storage.getItem('sb-refresh') }
}
