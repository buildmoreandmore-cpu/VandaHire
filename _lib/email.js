import { Resend } from 'resend'

function getClient() {
  return new Resend(process.env.RESEND_API_KEY)
}

const FROM = process.env.RESEND_FROM_EMAIL || 'crew@vandahire.com'
const REPLY_TO = process.env.RESEND_REPLY_TO || 'crew@vandahire.com'

export async function sendEmail({ to, subject, html, text }) {
  const resend = getClient()
  return resend.emails.send({
    from: FROM,
    reply_to: REPLY_TO,
    to,
    subject,
    html,
    text,
  })
}
