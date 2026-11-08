import { RealtimeClient } from '@supabase/realtime-js'

// Imported only by the explicitly enabled pilot. The client receives no Django
// credentials and has no application Data API or Storage client attached.
export function openSupabaseRealtime(ticket, handlers, Client = RealtimeClient) {
  const client = new Client(ticket.url.replace(/^https:/, 'wss:'), {
    params: { apikey: ticket.publishable_key },
    timeout: 8000,
    sessionStorage: { getItem: () => null, setItem() {}, removeItem() {} },
  })
  let closed = false
  let channel = null
  Promise.resolve(client.setAuth(ticket.token)).then(() => {
    if (closed) return
    channel = client.channel(ticket.topic, { config: { private: true, broadcast: { self: false, ack: false } } })
    channel.on('broadcast', { event: ticket.event }, ({ payload }) => {
      if (!closed) handlers.message(payload)
    }).subscribe(status => {
      if (!closed) handlers.status(status)
    })
  }).catch(() => { if (!closed) handlers.status('CHANNEL_ERROR') })
  return {
    async close() {
      if (closed) return
      closed = true
      try {
        await client.disconnect(1000, 'Pilot closed')
      } catch { /* All late callbacks are already disabled. */ }
      try {
        channel?.teardown()
      } catch { /* A provider teardown failure must not block fallback or logout. */ }
    },
  }
}
