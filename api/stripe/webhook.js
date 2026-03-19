import Stripe from 'stripe'
import { createClient } from '@supabase/supabase-js'

// Disable body parsing — Stripe needs the raw body for signature verification
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

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const stripeKey = process.env.STRIPE_SECRET_KEY
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET

  if (!stripeKey || !webhookSecret) {
    console.error('[stripe/webhook] Missing STRIPE_SECRET_KEY or STRIPE_WEBHOOK_SECRET')
    return res.status(500).json({ error: 'Stripe not configured' })
  }

  const stripe = new Stripe(stripeKey)
  const sig = req.headers['stripe-signature']

  let event
  try {
    const rawBody = await buffer(req)
    event = stripe.webhooks.constructEvent(rawBody, sig, webhookSecret)
  } catch (err) {
    console.error('[stripe/webhook] Signature verification failed:', err.message)
    return res.status(400).json({ error: 'Webhook signature verification failed' })
  }

  // Only handle checkout.session.completed
  if (event.type !== 'checkout.session.completed') {
    return res.status(200).json({ received: true })
  }

  const session = event.data.object
  const eventId = session.metadata?.event_id

  if (!eventId) {
    console.warn('[stripe/webhook] No event_id in session metadata')
    return res.status(200).json({ received: true })
  }

  const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
  )

  try {
    // Fetch current event to determine status transition
    const { data: currentEvent } = await supabase
      .from('events')
      .select('status')
      .eq('id', eventId)
      .single()

    const updates = {
      stripe_payment_id: session.payment_intent,
      stripe_paid_at: new Date().toISOString(),
      invoice_status: 'paid',
      payment_status: 'paid',
      updated_at: new Date().toISOString(),
    }

    // Move event forward if it's awaiting payment or just approved
    if (currentEvent && ['approved', 'awaiting_payment', 'pending'].includes(currentEvent.status)) {
      updates.status = 'staffing'
    }

    const { error } = await supabase
      .from('events')
      .update(updates)
      .eq('id', eventId)

    if (error) {
      console.error('[stripe/webhook] Failed to update event:', error)
      return res.status(500).json({ error: 'Database update failed' })
    }

    console.log(`[stripe/webhook] Event ${eventId} marked as paid, status → ${updates.status || '(unchanged)'}`)
    return res.status(200).json({ received: true })
  } catch (err) {
    console.error('[stripe/webhook] Error:', err)
    return res.status(500).json({ error: 'Internal error' })
  }
}
