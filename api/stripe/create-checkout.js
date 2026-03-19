import Stripe from 'stripe'
import { createClient } from '@supabase/supabase-js'
import { checkAdmin } from '../admin/_auth.js'

// POST — Create a Stripe Checkout Session for the Vandahire service fee on an event
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const auth = checkAdmin(req)
  if (!auth.ok) return res.status(auth.status).json({ error: auth.error })

  const { event_id } = req.body
  if (!event_id) {
    return res.status(400).json({ error: 'event_id is required' })
  }

  const stripeKey = process.env.STRIPE_SECRET_KEY
  if (!stripeKey) {
    return res.status(500).json({ error: 'Stripe is not configured' })
  }

  const appUrl = process.env.VITE_APP_URL || 'http://localhost:5173'

  const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
  )

  try {
    // Fetch the event
    const { data: event, error: fetchErr } = await supabase
      .from('events')
      .select('*')
      .eq('id', event_id)
      .single()

    if (fetchErr || !event) {
      return res.status(404).json({ error: 'Event not found' })
    }

    // If a checkout session already exists and has a URL, return it
    if (event.stripe_payment_url && event.payment_status !== 'paid') {
      return res.status(200).json({
        checkout_url: event.stripe_payment_url,
        session_id: event.stripe_checkout_session_id,
        already_exists: true,
      })
    }

    if (event.payment_status === 'paid') {
      return res.status(400).json({ error: 'Service fee already paid' })
    }

    // Calculate amount — use total_bill_amount if set, otherwise require it
    const amount = event.total_bill_amount
    if (!amount || parseFloat(amount) <= 0) {
      return res.status(400).json({ error: 'Set a total bill amount before generating a payment link' })
    }

    const amountCents = Math.round(parseFloat(amount) * 100)

    const stripe = new Stripe(stripeKey)

    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: 'usd',
            unit_amount: amountCents,
            product_data: {
              name: `Vandahire Service Fee — ${event.title}`,
              description: `Event: ${event.title} on ${event.event_date}. Organizer: ${event.organizer}.`,
            },
          },
          quantity: 1,
        },
      ],
      metadata: {
        event_id: event.id,
        event_title: event.title,
      },
      success_url: `${appUrl}/admin?payment=success&event=${event.id}`,
      cancel_url: `${appUrl}/admin?payment=cancelled&event=${event.id}`,
    })

    // Store checkout session info on the event
    const { error: updateErr } = await supabase
      .from('events')
      .update({
        stripe_checkout_session_id: session.id,
        stripe_payment_url: session.url,
        invoice_status: 'sent',
        updated_at: new Date().toISOString(),
      })
      .eq('id', event_id)

    if (updateErr) {
      console.error('[stripe/create-checkout] Failed to update event:', updateErr)
    }

    return res.status(200).json({
      checkout_url: session.url,
      session_id: session.id,
    })
  } catch (err) {
    console.error('[stripe/create-checkout] Error:', err)
    return res.status(500).json({ error: 'Failed to create checkout session' })
  }
}
