// Shared RingCentral client for contacts + webhook subscriptions.
// Auth mirrors _lib/sms.js (JWT bearer OAuth), token cached across warm invokes.

const RC_SERVER = process.env.RINGCENTRAL_SERVER_URL || 'https://platform.ringcentral.com'
const SMS_EVENT_FILTER = '/restapi/v1.0/account/~/extension/~/message-store/instant?type=SMS'

let rcToken = null // { access_token, expires_at }

export function ringCentralConfigured() {
  return !!(process.env.RINGCENTRAL_CLIENT_ID && process.env.RINGCENTRAL_CLIENT_SECRET &&
    process.env.RINGCENTRAL_JWT && process.env.RINGCENTRAL_FROM_NUMBER)
}

export async function getRingCentralToken() {
  const now = Date.now()
  if (rcToken && rcToken.expires_at > now + 60000) return rcToken.access_token
  const basic = Buffer.from(`${process.env.RINGCENTRAL_CLIENT_ID}:${process.env.RINGCENTRAL_CLIENT_SECRET}`).toString('base64')
  const res = await fetch(`${RC_SERVER}/restapi/oauth/token`, {
    method: 'POST',
    headers: { 'Authorization': `Basic ${basic}`, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: process.env.RINGCENTRAL_JWT }),
  })
  if (!res.ok) throw new Error(`RingCentral auth failed (${res.status}): ${(await res.text().catch(() => '')).slice(0, 200)}`)
  const data = await res.json()
  rcToken = { access_token: data.access_token, expires_at: now + (data.expires_in || 3600) * 1000 }
  return rcToken.access_token
}

async function rcFetch(path, opts = {}) {
  const token = await getRingCentralToken()
  return fetch(`${RC_SERVER}${path}`, {
    ...opts,
    headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json', ...(opts.headers || {}) },
  })
}

// Create a personal address-book contact so inbound texts show the worker's name.
// `company` tags the contact (e.g. the event name) so a whole crew is findable
// together in RingCentral by searching/sorting on that company label.
export async function createRingCentralContact({ firstName, lastName, phone, company }) {
  const body = { firstName: firstName || 'Worker', lastName: lastName || '', mobilePhone: phone }
  if (company) body.company = String(company).slice(0, 64)
  const res = await rcFetch('/restapi/v1.0/account/~/extension/~/address-book/contact', {
    method: 'POST',
    body: JSON.stringify(body),
  })
  if (!res.ok) throw new Error(`RC contact create (${res.status}): ${(await res.text().catch(() => '')).slice(0, 200)}`)
  return res.json()
}

// List active webhook subscriptions (to avoid creating duplicates).
export async function listSubscriptions() {
  const res = await rcFetch('/restapi/v1.0/subscription')
  if (!res.ok) throw new Error(`RC list subscriptions (${res.status})`)
  const data = await res.json()
  return data.records || []
}

// Ensure exactly one active inbound-SMS webhook subscription pointing at our URL.
// Recreates if missing/expiring. Called once manually and kept alive by the daily cron.
export async function ensureSmsSubscription(webhookUrl) {
  const subs = await listSubscriptions().catch(() => [])
  const now = Date.now()
  const match = subs.find(s =>
    s.deliveryMode?.address === webhookUrl &&
    (s.eventFilters || []).some(f => f.includes('message-store') && f.includes('SMS')) &&
    s.status === 'Active' &&
    (!s.expirationTime || new Date(s.expirationTime).getTime() > now + 24 * 3600 * 1000) // >24h left
  )
  if (match) return { created: false, id: match.id, expirationTime: match.expirationTime }

  const res = await rcFetch('/restapi/v1.0/subscription', {
    method: 'POST',
    body: JSON.stringify({
      eventFilters: [SMS_EVENT_FILTER],
      deliveryMode: { transportType: 'WebHook', address: webhookUrl },
      expiresIn: 630720000, // max; renewed by cron regardless
    }),
  })
  if (!res.ok) throw new Error(`RC create subscription (${res.status}): ${(await res.text().catch(() => '')).slice(0, 200)}`)
  const created = await res.json()
  return { created: true, id: created.id, expirationTime: created.expirationTime }
}
