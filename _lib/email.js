import crypto from 'node:crypto'
import { Resend } from 'resend'

function getClient() {
  return new Resend(process.env.RESEND_API_KEY)
}

const FROM = process.env.RESEND_FROM_EMAIL || 'V&A Hire <info@vandahire.com>'
const REPLY_TO = process.env.RESEND_REPLY_TO || 'info@vassoc.com'
const SITE_URL = 'https://vandahire.com'
const BUSINESS = 'Varist & Associates of Georgia LLC · 470 16th Street NW, Unit 2024, Atlanta, GA 30363'

// ── Unsubscribe token (HMAC so links can't be forged for arbitrary addresses) ──
function unsubSecret() {
  return process.env.UNSUB_SECRET || process.env.W9_ENCRYPTION_KEY || 'vanda-unsub-fallback'
}
export function makeUnsubToken(email) {
  const e = String(email || '').toLowerCase()
  const sig = crypto.createHmac('sha256', unsubSecret()).update(e).digest('hex').slice(0, 16)
  return `${Buffer.from(e).toString('base64url')}.${sig}`
}
export function readUnsubToken(token) {
  try {
    const [b64, sig] = String(token).split('.')
    const email = Buffer.from(b64, 'base64url').toString('utf8')
    const expect = crypto.createHmac('sha256', unsubSecret()).update(email).digest('hex').slice(0, 16)
    return sig === expect ? email : null
  } catch { return null }
}

// ── Branded HTML wrapper ──────────────────────────────────────────────────────
export function brandedEmail(bodyHtml, { unsubscribeUrl } = {}) {
  return `<!doctype html><html><body style="margin:0;padding:0;background:#0a0a0a;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#0a0a0a;padding:24px 0;">
    <tr><td align="center">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#141414;border:1px solid #1e1e1e;border-radius:14px;overflow:hidden;">
        <tr><td style="padding:22px 28px;border-bottom:1px solid #1e1e1e;">
          <span style="font-family:Arial,Helvetica,sans-serif;font-size:18px;font-weight:800;color:#ffffff;letter-spacing:-0.5px;">V&amp;A Hire</span>
        </td></tr>
        <tr><td style="padding:28px;font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.6;color:#dddddd;">
          ${bodyHtml}
        </td></tr>
        <tr><td style="padding:20px 28px;border-top:1px solid #1e1e1e;font-family:Arial,Helvetica,sans-serif;font-size:11px;line-height:1.6;color:#777777;">
          ${BUSINESS}<br/>
          ${unsubscribeUrl ? `<a href="${unsubscribeUrl}" style="color:#93b3f3;">Unsubscribe from these emails</a> · ` : ''}<a href="${SITE_URL}/privacy" style="color:#93b3f3;">Privacy</a>
        </td></tr>
      </table>
    </td></tr>
  </table></body></html>`
}

// ── Suppression check (requires a supabase client from the caller) ─────────────
export async function isEmailSuppressed(supabase, email) {
  if (!email) return false
  try {
    const { data } = await supabase.from('email_suppressions').select('email').eq('email', String(email).toLowerCase()).maybeSingle()
    return !!data
  } catch { return false }
}

// ── Send ──────────────────────────────────────────────────────────────────────
// opts.branded   → wrap in the branded template
// opts.unsubscribeEmail → add an unsubscribe footer link for this recipient
export async function sendEmail({ to, subject, html, text, branded = false, unsubscribeEmail = null, attachments = null }) {
  const resend = getClient()
  let finalHtml = html
  if (branded || unsubscribeEmail) {
    const unsubscribeUrl = unsubscribeEmail ? `${SITE_URL}/unsubscribe?t=${makeUnsubToken(unsubscribeEmail)}` : null
    finalHtml = brandedEmail(html, { unsubscribeUrl })
  }
  const payload = { from: FROM, reply_to: REPLY_TO, to, subject, html: finalHtml, text }
  if (attachments && attachments.length) payload.attachments = attachments
  if (unsubscribeEmail) {
    // One-click unsubscribe header (Gmail/Apple honor this)
    payload.headers = { 'List-Unsubscribe': `<${SITE_URL}/unsubscribe?t=${makeUnsubToken(unsubscribeEmail)}>`, 'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click' }
  }
  return resend.emails.send(payload)
}
