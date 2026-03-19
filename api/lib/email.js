import { Resend } from 'resend'

function getClient() {
  return new Resend(process.env.RESEND_API_KEY)
}

const FROM = process.env.RESEND_FROM_EMAIL || 'crew@joinvanda.co'

export async function sendEmail({ to, subject, html, text }) {
  const resend = getClient()
  return resend.emails.send({
    from: FROM,
    to,
    subject,
    html,
    text,
  })
}
