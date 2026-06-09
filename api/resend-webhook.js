import { createClient } from '@supabase/supabase-js'

// Receives Resend email events (delivered / opened / clicked / bounced / etc.)
// Secured by a shared key in the URL (?key=...), set as RESEND_WEBHOOK_KEY.

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' })

  const expected = process.env.RESEND_WEBHOOK_KEY
  if (expected && req.query.key !== expected) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  const evt = req.body || {}
  const type = String(evt.type || '').replace(/^email\./, '')
  const data = evt.data || {}
  const to = Array.isArray(data.to) ? data.to[0] : data.to
  if (!type || !to) return res.status(200).json({ ignored: true })

  const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
  try {
    await supabase.from('email_events').insert({
      resend_id: data.email_id || null,
      email: String(to).toLowerCase(),
      type,
      subject: data.subject || null,
      meta: data,
    })
  } catch (e) {
    console.error('[resend-webhook] insert failed:', e.message)
  }
  return res.status(200).json({ received: true })
}
