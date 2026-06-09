import twilio from 'twilio'

function getClient() {
  return twilio(
    process.env.TWILIO_ACCOUNT_SID,
    process.env.TWILIO_AUTH_TOKEN,
  )
}

export async function sendSms(to, body) {
  const client = getClient()

  // Normalize phone: strip formatting, ensure +1
  const digits = to.replace(/\D/g, '')
  const normalized = digits.startsWith('1') ? `+${digits}` : `+1${digits}`

  // Prefer a Messaging Service (number pool + A2P/opt-out compliance) when
  // configured; otherwise fall back to a single from-number.
  const messagingServiceSid = process.env.TWILIO_MESSAGING_SERVICE_SID
  const from = process.env.TWILIO_FROM_NUMBER

  const opts = messagingServiceSid
    ? { messagingServiceSid, to: normalized, body }
    : { from, to: normalized, body }

  return client.messages.create(opts)
}
