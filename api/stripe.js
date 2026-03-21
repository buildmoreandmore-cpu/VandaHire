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

    const appUrl = process.env.VITE_APP_URL || 'https://vandahire.com'

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
      line_items: [{ price_data: { currency: 'usd', unit_amount: Math.round(parseFloat(amount) * 100), product_data: { name: `V&A Hire Service Fee — ${event.title}`, description: `Event: ${event.title} on ${event.event_date}.` } }, quantity: 1 }],
      metadata: { event_id: event.id, event_title: event.title },
      success_url: `${appUrl}/admin?payment=success&event=${event.id}`,
      cancel_url: `${appUrl}/admin?payment=cancelled&event=${event.id}`,
    })

    await supabase.from('events').update({ stripe_checkout_session_id: session.id, stripe_payment_url: session.url, invoice_status: 'sent', updated_at: new Date().toISOString() }).eq('id', event_id)

    return res.status(200).json({ checkout_url: session.url, session_id: session.id })
  }

  // ── POST /api/stripe/deposit ────────────────────────────────────────────
  if (action === 'deposit') {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

    const auth = checkAdmin(req)
    if (!auth.ok) return res.status(auth.status).json({ error: auth.error })

    const rawBody = await buffer(req)
    const body = JSON.parse(rawBody.toString())
    const { event_id } = body
    if (!event_id) return res.status(400).json({ error: 'event_id required' })

    const appUrl = process.env.VITE_APP_URL || 'https://vandahire.com'
    const { data: event, error: fetchErr } = await supabase.from('events').select('*').eq('id', event_id).single()
    if (fetchErr || !event) return res.status(404).json({ error: 'Event not found' })

    const amount = parseFloat(event.deposit_amount) || 0
    if (amount <= 0) return res.status(400).json({ error: 'No deposit amount set. Generate a quote first.' })

    const stripe = new Stripe(stripeKey)
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      payment_method_types: ['card'],
      line_items: [{
        price_data: {
          currency: 'usd',
          unit_amount: Math.round(amount * 100),
          product_data: {
            name: `Deposit — ${event.title}`,
            description: `Deposit for ${event.title} on ${event.event_date}. Covers bench fees, labor, and roster hold.`,
          },
        },
        quantity: 1,
      }],
      metadata: { event_id: event.id, event_title: event.title, payment_type: 'deposit' },
      success_url: `${appUrl}/admin?payment=deposit_success&event=${event.id}`,
      cancel_url: `${appUrl}/admin?payment=cancelled&event=${event.id}`,
    })

    // Store payment record
    await supabase.from('payments').upsert({
      event_id,
      payment_type: 'deposit',
      amount,
      stripe_payment_intent_id: session.payment_intent,
      stripe_checkout_url: session.url,
      status: 'pending',
    }, { onConflict: 'event_id,payment_type', ignoreDuplicates: false }).catch(() => {
      // If no unique constraint, just insert
      return supabase.from('payments').insert({
        event_id,
        payment_type: 'deposit',
        amount,
        stripe_payment_intent_id: session.payment_intent,
        stripe_checkout_url: session.url,
        status: 'pending',
      })
    })

    await supabase.from('events').update({
      deposit_status: 'pending',
      updated_at: new Date().toISOString(),
    }).eq('id', event_id)

    return res.status(200).json({ checkout_url: session.url, session_id: session.id })
  }

  // ── POST /api/stripe/balance ──────────────────────────────────────────────
  if (action === 'balance') {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

    const auth = checkAdmin(req)
    if (!auth.ok) return res.status(auth.status).json({ error: auth.error })

    const rawBody = await buffer(req)
    const body = JSON.parse(rawBody.toString())
    const { event_id } = body
    if (!event_id) return res.status(400).json({ error: 'event_id required' })

    const appUrl = process.env.VITE_APP_URL || 'https://vandahire.com'
    const { data: event, error: fetchErr } = await supabase.from('events').select('*').eq('id', event_id).single()
    if (fetchErr || !event) return res.status(404).json({ error: 'Event not found' })

    const amount = parseFloat(event.balance_amount) || 0
    if (amount <= 0) return res.status(400).json({ error: 'No balance amount set' })

    const stripe = new Stripe(stripeKey)
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      payment_method_types: ['card'],
      line_items: [{
        price_data: {
          currency: 'usd',
          unit_amount: Math.round(amount * 100),
          product_data: {
            name: `Balance Due — ${event.title}`,
            description: `Remaining balance for ${event.title}. Net 15 terms.`,
          },
        },
        quantity: 1,
      }],
      metadata: { event_id: event.id, event_title: event.title, payment_type: 'balance' },
      success_url: `${appUrl}/admin?payment=balance_success&event=${event.id}`,
      cancel_url: `${appUrl}/admin?payment=cancelled&event=${event.id}`,
    })

    await supabase.from('payments').insert({
      event_id,
      payment_type: 'balance',
      amount,
      stripe_payment_intent_id: session.payment_intent,
      stripe_checkout_url: session.url,
      status: 'pending',
    })

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

    // Handle Stripe Connect account.updated webhook
    if (stripeEvent.type === 'account.updated') {
      const account = stripeEvent.data.object
      if (account.metadata?.worker_id) {
        // Update worker's stripe_connect_id if charges_enabled
        if (account.charges_enabled) {
          await supabase.from('applicants').update({
            stripe_connect_id: account.id,
            updated_at: new Date().toISOString(),
          }).eq('id', account.metadata.worker_id)
        }
      }
      return res.status(200).json({ received: true })
    }

    if (stripeEvent.type !== 'checkout.session.completed') return res.status(200).json({ received: true })

    const session = stripeEvent.data.object
    const eventId = session.metadata?.event_id
    if (!eventId) return res.status(200).json({ received: true })

    const paymentType = session.metadata?.payment_type // 'deposit', 'balance', or undefined (legacy)
    const { data: currentEvent } = await supabase.from('events').select('status, event_date').eq('id', eventId).single()
    const now = new Date().toISOString()

    if (paymentType === 'deposit') {
      // Deposit paid — update event, insert payment, set balance_due_date to event + 15 days (Net 15)
      const balanceDueDate = currentEvent?.event_date
        ? new Date(new Date(currentEvent.event_date + 'T00:00:00').getTime() + 15 * 86400000).toISOString().slice(0, 10)
        : null

      // Retrieve full session to get customer ID for future auto-charges
      let stripeCustomerId = null
      try {
        const fullSession = await stripe.checkout.sessions.retrieve(session.id, { expand: ['payment_intent'] })
        stripeCustomerId = fullSession.customer || fullSession.payment_intent?.customer || null
      } catch (e) { console.error('[stripe/webhook] Could not retrieve customer:', e.message) }

      const eventUpdates = {
        deposit_status: 'paid',
        stripe_payment_id: session.payment_intent,
        stripe_paid_at: now,
        balance_due_date: balanceDueDate,
        updated_at: now,
      }
      if (stripeCustomerId) eventUpdates.stripe_customer_id = stripeCustomerId
      // Auto-transition to staffing if deposit is paid
      if (currentEvent && ['approved', 'awaiting_payment', 'pending'].includes(currentEvent.status)) {
        eventUpdates.status = 'staffing'
        eventUpdates.payment_status = 'partial'
      }

      await supabase.from('events').update(eventUpdates).eq('id', eventId)

      // Update payment record
      await supabase.from('payments')
        .update({ status: 'succeeded', paid_at: now, stripe_payment_intent_id: session.payment_intent })
        .eq('event_id', eventId)
        .eq('payment_type', 'deposit')
        .eq('status', 'pending')

      // Send deposit confirmation email with signed agreement copy
      const { data: eventForEmail } = await supabase.from('events').select('title, contact_email, contact_name, event_date, deposit_amount, balance_amount, total_bill_amount, agreement_name, agreement_accepted_at, agreement_ip').eq('id', eventId).single()
      if (eventForEmail?.contact_email) {
        const { sendEmail } = await import('../_lib/email.js')
        const { getAgreementHtml, getSignedAgreementFooter } = await import('../_lib/agreement.js')
        try {
          const dep = parseFloat(eventForEmail.deposit_amount || 0)
          const bal = parseFloat(eventForEmail.balance_amount || 0)
          const total = parseFloat(eventForEmail.total_bill_amount || 0)
          const agreementHtml = getAgreementHtml({ deposit: dep, balance: bal, total })
          const signedFooter = eventForEmail.agreement_name
            ? getSignedAgreementFooter({ signerName: eventForEmail.agreement_name, signedAt: eventForEmail.agreement_accepted_at, ip: eventForEmail.agreement_ip })
            : ''
          await sendEmail({
            to: eventForEmail.contact_email,
            subject: `Deposit Received — ${eventForEmail.title}`,
            html: `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px">
              <h2 style="color:#ffffff">Deposit Confirmed</h2>
              <p>Hi ${eventForEmail.contact_name || 'there'},</p>
              <p>We've received your deposit of <strong>$${dep.toFixed(2)}</strong> for <strong>${eventForEmail.title}</strong>.</p>
              <table style="width:100%;border-collapse:collapse;margin:15px 0">
                <tr><td style="padding:10px;border-bottom:1px solid #eee;color:#666">Event Date</td><td style="padding:10px;border-bottom:1px solid #eee">${eventForEmail.event_date}</td></tr>
                <tr><td style="padding:10px;border-bottom:1px solid #eee;color:#666">Deposit Paid</td><td style="padding:10px;border-bottom:1px solid #eee;color:#ffffff;font-weight:bold">$${dep.toFixed(2)}</td></tr>
                <tr><td style="padding:10px;border-bottom:1px solid #eee;color:#666">Balance Due (Net 15)</td><td style="padding:10px;border-bottom:1px solid #eee;font-weight:bold">$${bal.toFixed(2)}${balanceDueDate ? ` by ${balanceDueDate}` : ''}</td></tr>
                <tr><td style="padding:10px;border-bottom:1px solid #eee;color:#666">Total</td><td style="padding:10px;border-bottom:1px solid #eee;font-weight:bold">$${total.toFixed(2)}</td></tr>
              </table>
              <p>We're now staffing your event. You'll receive updates as we assign crew members.</p>
              <h3 style="margin:24px 0 8px;color:#ffffff">Your Signed Service Agreement</h3>
              <p style="color:#888;font-size:13px">Below is a copy of the Service Agreement you accepted for your records.</p>
              ${signedFooter}
              ${agreementHtml}
              <p style="color:#888;font-size:12px;margin-top:30px;text-align:center">V&A Hire Staffing • vandahire.com</p>
            </div>`,
          })
        } catch (e) { console.error('[stripe/webhook] Deposit email failed:', e.message) }
      }

    } else if (paymentType === 'balance') {
      // Balance paid — mark event fully paid
      await supabase.from('events').update({
        payment_status: 'paid',
        invoice_status: 'paid',
        updated_at: now,
      }).eq('id', eventId)

      await supabase.from('payments')
        .update({ status: 'succeeded', paid_at: now, stripe_payment_intent_id: session.payment_intent })
        .eq('event_id', eventId)
        .eq('payment_type', 'balance')
        .eq('status', 'pending')

      // Auto-send final receipt to organizer
      const { data: eventForReceipt } = await supabase.from('events')
        .select('title, contact_email, contact_name, event_date, deposit_amount, balance_amount, total_bill_amount')
        .eq('id', eventId).single()
      if (eventForReceipt?.contact_email) {
        const { sendEmail } = await import('../_lib/email.js')
        try {
          const dep = parseFloat(eventForReceipt.deposit_amount || 0)
          const bal = parseFloat(eventForReceipt.balance_amount || 0)
          const total = parseFloat(eventForReceipt.total_bill_amount || 0)
          await sendEmail({
            to: eventForReceipt.contact_email,
            subject: `Payment Complete — Receipt for ${eventForReceipt.title}`,
            html: `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px">
              <h2 style="color:#ffffff">Payment Complete</h2>
              <p>Hi ${eventForReceipt.contact_name || 'there'},</p>
              <p>All payments for <strong>${eventForReceipt.title}</strong> have been received. Here's your receipt:</p>
              <table style="width:100%;border-collapse:collapse;margin:15px 0">
                <tr><td style="padding:10px;border-bottom:1px solid #eee">Deposit Paid</td><td style="padding:10px;border-bottom:1px solid #eee;text-align:right">$${dep.toFixed(2)}</td></tr>
                <tr><td style="padding:10px;border-bottom:1px solid #eee">Balance Paid</td><td style="padding:10px;border-bottom:1px solid #eee;text-align:right">$${bal.toFixed(2)}</td></tr>
                <tr style="font-size:18px;font-weight:bold"><td style="padding:12px;border-top:2px solid #333">Total Paid</td><td style="padding:12px;border-top:2px solid #333;text-align:right;color:#ffffff">$${total.toFixed(2)}</td></tr>
              </table>
              <p>Thank you for working with V&A Hire! We hope your event was a success.</p>
              <p style="color:#888;font-size:12px;margin-top:30px">V&A Hire Staffing • vandahire.com</p>
            </div>`,
          })
        } catch (e) { console.error('[stripe/webhook] Receipt email failed:', e.message) }
      }

    } else {
      // Legacy full-payment flow (original checkout behavior)
      const updates = { stripe_payment_id: session.payment_intent, stripe_paid_at: now, invoice_status: 'paid', payment_status: 'paid', updated_at: now }
      if (currentEvent && ['approved', 'awaiting_payment', 'pending'].includes(currentEvent.status)) updates.status = 'staffing'
      const { error } = await supabase.from('events').update(updates).eq('id', eventId)
      if (error) { console.error('[stripe/webhook] DB update failed:', error); return res.status(500).json({ error: 'Database update failed' }) }
    }

    return res.status(200).json({ received: true })
  }

  return res.status(404).json({ error: 'Unknown stripe action' })
}
