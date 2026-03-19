import Stripe from 'stripe'
import { createClient } from '@supabase/supabase-js'
import { checkAdmin } from '../_lib/auth.js'

// Disable body parser globally — we handle raw body for webhook manually
export const config = {
  api: { bodyParser: false },
}

function buffer(readable) {
  return new Promise((resolve, reject) => {
    const chunks = []
    readable.on('data', (chunk) => chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk))
    readable.on('end', () => resolve(Buffer.concat(chunks)))
    readable.on('error', reject)
  })
}

// Served at /api/stripe-checkout and /api/stripe-webhook via rewrites
// action = 'checkout' | 'webhook'
export default async function handler(req, res) {
  const { action } = req.query
  const stripeKey = process.env.STRIPE_SECRET_KEY

  if (!stripeKey) return res.status(500).json({ error: 'Stripe not configured' })

  const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)

  // ── POST /api/stripe-checkout ─────────────────────────────────────────────
  if (action === 'checkout') {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

    const auth = checkAdmin(req)
    if (!auth.ok) return res.status(auth.status).json({ error: auth.error })

    // Parse JSON manually since bodyParser is off
    const rawBody = await buffer(req)
    const body = JSON.parse(rawBody.toString())
    const { event_id } = body

    if (!event_id) return res.status(400).json({ error: 'event_id is required' })

    const appUrl = process.env.VITE_APP_URL || 'https://joinvanda.co'

    const { data: event, error: fetchErr } = await supabase.from('events').select('*').eq('id', event_id).single()
    if (fetchErr || !event) return res.status(404).json({ error: 'Event not found' })

    if (event.stripe_payment_url && event.payment_status !== 'paid') {
      return res.status(200).json({ checkout_url: event.stripe_payment_url, session_id: event.stripe_checkout_session_id, already_exists: true })
    }
    if (event.payment_status === 'paid') return res.status(400).json({ error: 'Service fee already paid' })

    const amount = event.total_bill_amount
    if (!amount || parseFloat(amount) <= 0) return res.status(400).json({ error: 'Set a total bill amount before generating a payment link' })

    const stripe = new Stripe(stripeKey)
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      payment_method_types: ['card'],
      line_items: [{ price_data: { currency: 'usd', unit_amount: Math.round(parseFloat(amount) * 100), product_data: { name: `Vandahire Service Fee — ${event.title}`, description: `Event: ${event.title} on ${event.event_date}.` } }, quantity: 1 }],
      metadata: { event_id: event.id, event_title: event.title },
      success_url: `${appUrl}/admin?payment=success&event=${event.id}`,
      cancel_url: `${appUrl}/admin?payment=cancelled&event=${event.id}`,
    })

    await supabase.from('events').update({ stripe_checkout_session_id: session.id, stripe_payment_url: session.url, invoice_status: 'sent', updated_at: new Date().toISOString() }).eq('id', event_id)

    return res.status(200).json({ checkout_url: session.url, session_id: session.id })
  }

  // ── POST /api/stripe-webhook ──────────────────────────────────────────────
  if (action === 'webhook') {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET
    if (!webhookSecret) return res.status(500).json({ error: 'Webhook not configured' })

    const stripe = new Stripe(stripeKey)
    const sig = req.headers['stripe-signature']
    let stripeEvent

    try {
      const rawBody = await buffer(req)
      stripeEvent = stripe.webhooks.constructEvent(rawBody, sig, webhookSecret)
    } catch (err) {
      console.error('[stripe/webhook] Signature failed:', err.message)
      return res.status(400).json({ error: 'Webhook signature verification failed' })
    }

    if (stripeEvent.type !== 'checkout.session.completed') return res.status(200).json({ received: true })

    const session = stripeEvent.data.object
    const eventId = session.metadata?.event_id
    if (!eventId) return res.status(200).json({ received: true })

    const { data: currentEvent } = await supabase.from('events').select('status').eq('id', eventId).single()
    const updates = { stripe_payment_id: session.payment_intent, stripe_paid_at: new Date().toISOString(), invoice_status: 'paid', payment_status: 'paid', updated_at: new Date().toISOString() }
    if (currentEvent && ['approved', 'awaiting_payment', 'pending'].includes(currentEvent.status)) updates.status = 'staffing'

    const { error } = await supabase.from('events').update(updates).eq('id', eventId)
    if (error) { console.error('[stripe/webhook] DB update failed:', error); return res.status(500).json({ error: 'Database update failed' }) }

    return res.status(200).json({ received: true })
  }

  return res.status(404).json({ error: 'Unknown stripe action' })
}
