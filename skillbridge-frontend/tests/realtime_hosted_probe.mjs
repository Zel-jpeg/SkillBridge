// Opt-in hosted acceptance. Reads only process variables supplied by the operator.
import { createPrivateKey, randomBytes, randomUUID, sign } from 'node:crypto'
import process from 'node:process'
import { RealtimeClient } from '@supabase/realtime-js'

const { SUPABASE_REALTIME_URL, SUPABASE_REALTIME_PUBLISHABLE_KEY: publicKey,
  SUPABASE_REALTIME_PUBLISH_KEY: publishKey, SUPABASE_REALTIME_SIGNING_KEY: pem,
  SUPABASE_REALTIME_SIGNING_KID: kid } = process.env
const origin = SUPABASE_REALTIME_URL?.replace(/\/$/, '').replace(/\/realtime\/v1$/, '')
const event = 'refresh'
const results = []

function check(name, passed, status) {
  results.push({ name, passed, ...(status === undefined ? {} : { status }) })
  if (!passed) throw new Error('Probe check failed')
}

function topic() {
  return `sb-pilot:${randomBytes(32).toString('hex')}`
}

function ticket(key, channel, expiresIn = 60) {
  const encode = value => Buffer.from(JSON.stringify(value)).toString('base64url')
  const now = Math.floor(Date.now() / 1000)
  const claims = { role: 'sb_realtime_receiver', sub: randomUUID(), jti: randomUUID(),
    iat: now, exp: now + expiresIn, sb_topic: channel }
  const input = `${encode({ alg: 'ES256', typ: 'JWT', kid })}.${encode(claims)}`
  const signature = sign('sha256', Buffer.from(input), { key, dsaEncoding: 'ieee-p1363' })
  return `${input}.${signature.toString('base64url')}`
}

async function withChannel(channelTopic, token, onMessage, verify) {
  const client = new RealtimeClient(`${origin.replace('https:', 'wss:')}/realtime/v1`, {
    params: { apikey: publicKey }, timeout: 4000, reconnectAfterMs: () => 60_000,
  })
  const channel = client.channel(channelTopic, { config: { private: true } })
  try {
    if (token) await client.setAuth(token)
    if (onMessage) channel.on('broadcast', { event }, ({ payload }) => onMessage(payload))
    const status = await new Promise(resolve => {
      const deadline = setTimeout(() => resolve('TIMEOUT'), 5000)
      channel.subscribe((state, error) => {
        if (!['SUBSCRIBED', 'CHANNEL_ERROR', 'TIMED_OUT', 'CLOSED'].includes(state)) return
        clearTimeout(deadline)
        const denied = state === 'CHANNEL_ERROR' && /unauthori[sz]ed|permission|expired|invalid jwt|invalid token/i.test(error?.message || '')
        resolve(denied ? 'DENIED' : state)
      })
    })
    await verify(status)
  } finally {
    await client.disconnect(1000, 'Probe finished')
    channel.teardown()
  }
}

async function request(path, { apiKey = publicKey, token, body } = {}) {
  const response = await fetch(`${origin}${path}`, {
    method: body ? 'POST' : 'GET',
    headers: { apikey: apiKey, ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(body ? { 'Content-Type': 'application/json' } : {}) },
    body: body ? JSON.stringify(body) : undefined,
    redirect: 'error', signal: AbortSignal.timeout(6000),
  })
  await response.body?.cancel()
  return response.status
}

async function run() {
  check('explicit SkillBridge hosted target and required credentials',
    origin === 'https://xlkyxnljcvpkdwnqaskc.supabase.co' &&
    /^sb_publishable_[A-Za-z0-9_-]+$/.test(publicKey || '') &&
    /^sb_secret_[A-Za-z0-9_-]+$/.test(publishKey || '') && Boolean(pem && kid))
  const key = createPrivateKey(pem.replaceAll('\\n', '\n'))
  check('P-256 signing key', key.asymmetricKeyType === 'ec' && key.asymmetricKeyDetails.namedCurve === 'prime256v1')
  const own = topic()
  const marker = randomUUID()
  const endpoint = `/realtime/v1/api/broadcast/${encodeURIComponent(own)}/events/${event}?private=true`
  let delivered = false
  await withChannel(own, ticket(key, own), payload => { if (payload?.event_id === marker) delivered = true }, async status => {
    check('receiver can join its own private topic', status === 'SUBSCRIBED', status)
    const body = { type: 'data_changed', topics: ['results'], event_id: marker }
    const denied = await request(endpoint, { token: ticket(key, own), body: { ...body, event_id: randomUUID() } })
    check('receiver cannot publish', [401, 403].includes(denied), denied)
    const published = await request(endpoint, { apiKey: publishKey, body })
    check('backend publisher accepted', published === 202, published)
    const deadline = Date.now() + 4000
    while (!delivered && Date.now() < deadline) await new Promise(resolve => setTimeout(resolve, 50))
    check('synthetic marker received', delivered)
  })

  for (const [name, channel, token] of [
    ['foreign topic denied', topic(), ticket(key, own)],
    ['expired ticket denied', own, ticket(key, own, -60)],
    ['public-key-only client denied', own, null],
  ]) await withChannel(channel, token, null, status => check(name, status === 'DENIED', status))

  const tableStatus = await request('/rest/v1/api_assessment?select=id&limit=0', { token: ticket(key, own) })
  check('application Data API denies the receiver', [401, 403].includes(tableStatus), tableStatus)
  const storageStatus = await request('/storage/v1/object/list/retake-evidence', {
    token: ticket(key, own), body: { prefix: `synthetic-probe-${marker}`, limit: 1 },
  })
  check('private Storage denies the receiver', [401, 403].includes(storageStatus), storageStatus)
}

try {
  await run()
} catch {
  // Provider errors may contain credentials. Report only the named checks and statuses.
  process.exitCode = 1
} finally {
  console.log(JSON.stringify({ passed: process.exitCode !== 1, results }, null, 2))
}
