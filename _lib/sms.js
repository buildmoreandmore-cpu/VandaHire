import twilio from 'twilio'

// SMS sender. Prefers RingCentral when configured; falls back to Twilio so the
// switch is safe to deploy before RingCentral env vars are set.
// Public API is unchanged: sendSms(to, body).

// ─── RingCentral ─────────────────────────────────────────────────────────────
const RC_SERVER = process.env.RINGCENTRAL_SERVER_URL || 'https://platform.ringcentral.com'

// Cache the OAuth token across warm serverless invocations.
let rcToken = null // { access_token, expires_at }

async function getRingCentralToken() {
  const now = Date.now()
  if (rcToken && rcToken.expires_at > now + 60000) return rcToken.access_token

  const clientId = process.env.RINGCENTRAL_CLIENT_ID
  const clientSecret = process.env.RINGCENTRAL_CLIENT_SECRET
  const jwt = process.env.RINGCENTRAL_JWT
  const basic = Buffer.from(`${clientId}:${clientSecret}`).toString('base64')

  const res = await fetch(`${RC_SERVER}/restapi/oauth/token`, {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${basic}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: jwt,
    }),
  })
  if (!res.ok) {
    const t = await res.text().catch(() => '')
    throw new Error(`RingCentral auth failed (${res.status}): ${t.slice(0, 200)}`)
  }
  const data = await res.json()
  rcToken = { access_token: data.access_token, expires_at: now + (data.expires_in || 3600) * 1000 }
  return rcToken.access_token
}

async function sendViaRingCentral(normalized, body, fromOverride) {
  const token = await getRingCentralToken()
  const from = fromOverride || process.env.RINGCENTRAL_FROM_NUMBER

  // High-Volume A2P SMS endpoint for bulk (set RINGCENTRAL_A2P=true once the
  // A2P campaign is approved); otherwise the standard per-extension endpoint.
  const useA2p = String(process.env.RINGCENTRAL_A2P || '').toLowerCase() === 'true'
  const url = useA2p
    ? `${RC_SERVER}/restapi/v1.0/account/~/a2p-sms/messages`
    : `${RC_SERVER}/restapi/v1.0/account/~/extension/~/sms`
  const payload = useA2p
    ? { from, to: [normalized], text: body }
    : { from: { phoneNumber: from }, to: [{ phoneNumber: normalized }], text: body }

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  if (!res.ok) {
    const t = await res.text().catch(() => '')
    throw new Error(`RingCentral SMS failed (${res.status}): ${t.slice(0, 200)}`)
  }
  return res.json()
}

// ─── Twilio (fallback) ───────────────────────────────────────────────────────
function getTwilioClient() {
  const accountSid = process.env.TWILIO_ACCOUNT_SID
  const apiKeySid = process.env.TWILIO_API_KEY_SID
  const apiKeySecret = process.env.TWILIO_API_KEY_SECRET
  if (apiKeySid && apiKeySecret && accountSid) {
    return twilio(apiKeySid, apiKeySecret, { accountSid })
  }
  return twilio(accountSid, process.env.TWILIO_AUTH_TOKEN)
}

async function sendViaTwilio(normalized, body, fromOverride) {
  const client = getTwilioClient()
  const messagingServiceSid = process.env.TWILIO_MESSAGING_SERVICE_SID
  const from = fromOverride || process.env.TWILIO_FROM_NUMBER
  // A specific from-number takes precedence over the messaging service.
  const opts = (!fromOverride && messagingServiceSid)
    ? { messagingServiceSid, to: normalized, body }
    : { from, to: normalized, body }
  return client.messages.create(opts)
}

// ─── Public API ──────────────────────────────────────────────────────────────
// `from` (optional): E.164 number to send from — e.g. an event's assigned line.
// Falls back to RINGCENTRAL_FROM_NUMBER / TWILIO_FROM_NUMBER when omitted.
export async function sendSms(to, body, from) {
  // Normalize phone: strip formatting, ensure +1
  const digits = to.replace(/\D/g, '')
  const normalized = digits.startsWith('1') ? `+${digits}` : `+1${digits}`
  const fromNorm = from ? (String(from).startsWith('+') ? from : `+${String(from).replace(/\D/g, '')}`) : undefined

  const rcConfigured =
    process.env.RINGCENTRAL_CLIENT_ID &&
    process.env.RINGCENTRAL_CLIENT_SECRET &&
    process.env.RINGCENTRAL_JWT &&
    process.env.RINGCENTRAL_FROM_NUMBER

  if (rcConfigured) {
    try {
      return await sendViaRingCentral(normalized, body, fromNorm)
    } catch (err) {
      // If a per-event line can't be sent from (e.g. it was reassigned to another
      // user's extension — MSG-304 "doesn't belong to extension"), fall back to the
      // default line instead of failing. Once High Volume SMS is enabled, the
      // per-line send will succeed and this fallback stops triggering.
      if (fromNorm && /MSG-304|doesn't belong to extension|FeatureNotAvailable/i.test(err.message || '')) {
        return await sendViaRingCentral(normalized, body, undefined)
      }
      throw err
    }
  }
  return sendViaTwilio(normalized, body, fromNorm)
}
