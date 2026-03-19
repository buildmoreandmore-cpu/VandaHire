import twilio from 'twilio'

function getClient() {
  return twilio(
    process.env.TWILIO_ACCOUNT_SID,
    process.env.TWILIO_AUTH_TOKEN,
  )
}

export async function sendSms(to, body) {
  const client = getClient()
  const from = process.env.TWILIO_FROM_NUMBER

  // Normalize phone: strip formatting, ensure +1
  const digits = to.replace(/\D/g, '')
  const normalized = digits.startsWith('1') ? `+${digits}` : `+1${digits}`

  return client.messages.create({ from, to: normalized, body })
}
