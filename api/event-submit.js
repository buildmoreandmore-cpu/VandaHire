import { createClient } from '@supabase/supabase-js'
import { sendEmail } from '../_lib/email.js'
import { generateAutoQuote } from '../_lib/quote-engine.js'
import { calculateQuote } from '../_lib/pay.js'
import { getAgreementHtml } from '../_lib/agreement.js'

// Public endpoint — event holders submit staffing requests
// Served at /api/events/submit via vercel.json rewrite
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const {
    title, organizer, contact_name, contact_email, contact_phone,
    event_date, start_time, end_time, location, city,
    workers_needed, role_types, pay_rate, dress_code, notes,
    service_type, meeting_point, supervisor_name, supervisor_phone,
    briefing_required, briefing_date, briefing_time, briefing_location, briefing_slots,
    latitude, longitude,
  } = req.body

  const missing = []
  if (!title) missing.push('title')
  if (!organizer) missing.push('organizer')
  if (!contact_name) missing.push('contact_name')
  if (!contact_email) missing.push('contact_email')
  if (!contact_phone) missing.push('contact_phone')
  if (!event_date) missing.push('event_date')
  if (!start_time) missing.push('start_time')
  if (!end_time) missing.push('end_time')
  if (!location) missing.push('location')
  if (!city) missing.push('city')
  if (!workers_needed || workers_needed < 1) missing.push('workers_needed')
  if (missing.length > 0) return res.status(400).json({ error: `Missing required fields: ${missing.join(', ')}` })

  const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)

  // Generate unique organizer token for secure payment links
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789'
  let organizer_token = ''
  for (let i = 0; i < 12; i++) organizer_token += chars[Math.floor(Math.random() * chars.length)]

  try {
    const { data, error } = await supabase
      .from('events')
      .insert({
        title, organizer, contact_name, contact_email, contact_phone,
        event_date, start_time, end_time, location, city,
        workers_needed: parseInt(workers_needed, 10) || 1,
        role_types: role_types || [],
        pay_rate: pay_rate || '',
        dress_code: dress_code || '',
        notes: notes || '',
        status: 'pending',
        service_type: service_type || 'single_event',
        meeting_point: meeting_point || '',
        supervisor_name: supervisor_name || '',
        supervisor_phone: supervisor_phone || '',
        briefing_required: !!briefing_required,
        briefing_date: briefing_required && briefing_date ? briefing_date : null,
        briefing_time: briefing_required && briefing_time ? briefing_time : null,
        briefing_location: briefing_required ? (briefing_location || '') : '',
        briefing_slots: briefing_required ? (briefing_slots || []) : [],
        latitude: latitude || null,
        longitude: longitude || null,
        organizer_token,
      })
      .select('id, organizer_token')
      .single()

    if (error) throw error

    // Auto-generate quote using AI quote engine
    let autoQuoteData = null
    try {
      const eventData = {
        title, role_types: role_types || [], workers_needed: parseInt(workers_needed, 10) || 1,
        event_date, start_time, end_time, pay_rate: pay_rate || '', service_type: service_type || 'single_event',
      }
      const autoQuoteParams = generateAutoQuote(eventData)
      const quoteCalc = calculateQuote({
        worker_count: autoQuoteParams.worker_count,
        hours_estimated: autoQuoteParams.hours_estimated,
        bill_rate_per_hour: autoQuoteParams.bill_rate_per_hour,
        supervisor_fee: autoQuoteParams.supervisor_fee,
        bench_fee: autoQuoteParams.bench_fee,
        platform_fee: autoQuoteParams.platform_fee,
        roster_hold_fee: autoQuoteParams.roster_hold_fee,
      })

      // Balance due Net 15 after event
      const balanceDueDate = event_date
        ? new Date(new Date(event_date + 'T00:00:00').getTime() + 15 * 86400000).toISOString().slice(0, 10)
        : null

      const { data: quoteRecord } = await supabase.from('quotes').upsert({
        event_id: data.id,
        ...quoteCalc,
        status: 'draft',
      }, { onConflict: 'event_id' }).select().single()

      // Update event with financials
      await supabase.from('events').update({
        deposit_amount: quoteCalc.deposit_amount,
        balance_amount: quoteCalc.balance_amount,
        total_bill_amount: quoteCalc.total,
        balance_due_date: balanceDueDate,
        updated_at: new Date().toISOString(),
      }).eq('id', data.id)

      autoQuoteData = { ...quoteCalc, margin: autoQuoteParams.margin, margin_tier: autoQuoteParams.margin_tier, pay_rate: autoQuoteParams.pay_rate_per_hour }
    } catch (qErr) {
      console.error('[event-submit] Auto-quote error:', qErr)
    }

    // Auto-send confirmation email to organizer
    if (contact_email) {
      const formatDate = (d) => d ? new Date(d + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }) : ''
      const formatTime = (t) => { if (!t) return ''; const [h, m] = t.split(':'); const hr = parseInt(h, 10); return `${hr % 12 || 12}:${m} ${hr >= 12 ? 'PM' : 'AM'}` }
      try {
        await sendEmail({
          to: contact_email,
          subject: `Staffing Request Received — ${title}`,
          html: `
            <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px;background:#0a0a0a;color:#ffffff">
              <h2 style="color:#ffffff;border-bottom:3px solid #ffffff;padding-bottom:10px">Staffing Request Confirmed</h2>
              <p>Hi ${contact_name},</p>
              <p>We've received your staffing request and our team is reviewing it now. Here's a summary:</p>
              <table style="width:100%;border-collapse:collapse;margin:15px 0">
                <tr><td style="padding:8px;border-bottom:1px solid #eee;font-weight:bold;width:130px">Event</td><td style="padding:8px;border-bottom:1px solid #eee">${title}</td></tr>
                <tr><td style="padding:8px;border-bottom:1px solid #eee;font-weight:bold">Date</td><td style="padding:8px;border-bottom:1px solid #eee">${formatDate(event_date)}</td></tr>
                <tr><td style="padding:8px;border-bottom:1px solid #eee;font-weight:bold">Time</td><td style="padding:8px;border-bottom:1px solid #eee">${formatTime(start_time)} – ${formatTime(end_time)}</td></tr>
                <tr><td style="padding:8px;border-bottom:1px solid #eee;font-weight:bold">Location</td><td style="padding:8px;border-bottom:1px solid #eee">${location}, ${city}</td></tr>
                <tr><td style="padding:8px;border-bottom:1px solid #eee;font-weight:bold">Workers Needed</td><td style="padding:8px;border-bottom:1px solid #eee">${workers_needed}</td></tr>
              </table>
              ${autoQuoteData ? `
              <div style="background:#1a1a2e;color:#fff;padding:20px;border-radius:12px;margin:20px 0;text-align:center">
                <p style="margin:0;font-size:14px;color:#aaa">Estimated Staffing Fee</p>
                <p style="margin:8px 0;font-size:32px;font-weight:bold">$${autoQuoteData.total?.toFixed(2)}</p>
                <p style="margin:0;font-size:13px;color:#aaa">${autoQuoteData.worker_count} crew members • ${autoQuoteData.hours_estimated} hours</p>
                <div style="display:flex;justify-content:center;gap:24px;margin-top:12px">
                  <div><span style="color:#aaa;font-size:12px">Deposit</span><br><strong>$${autoQuoteData.deposit_amount?.toFixed(2)}</strong></div>
                  <div><span style="color:#aaa;font-size:12px">Balance (Net 15)</span><br><strong>$${autoQuoteData.balance_amount?.toFixed(2)}</strong></div>
                </div>
              </div>
              <p style="color:#888;font-size:13px;text-align:center">This is an estimated quote. Final pricing will be confirmed by your coordinator.</p>` : ''}
              <h3 style="color:#ffffff">What Happens Next?</h3>
              <ol>
                <li>Our coordinator reviews your request and finalizes the quote</li>
                <li>You'll receive a secure deposit payment link</li>
                <li>Once deposit is paid, we begin staffing your event</li>
                <li>Balance is due Net 15 after the event</li>
              </ol>
              <p>We typically respond within a few hours. If you have questions, just reply to this email.</p>
              ${autoQuoteData ? `
              <h3 style="color:#ffffff;margin-top:24px">Service Agreement</h3>
              <p style="color:#888;font-size:13px">Please review the V&A Hire Service Agreement below. You will formally accept it when you pay your deposit.</p>
              ${getAgreementHtml({ deposit: autoQuoteData.deposit_amount || 0, balance: autoQuoteData.balance_amount || 0, total: autoQuoteData.total || 0 })}` : ''}
              <p style="color:#888;font-size:12px;margin-top:30px">V&A Hire Staffing • vandahire.com</p>
            </div>`,
        })
      } catch (e) {
        console.error('[event-submit] Confirmation email failed:', e.message)
      }
    }

    return res.status(200).json({ success: true, eventId: data.id })
  } catch (err) {
    console.error('[event-submit] Insert error:', err)
    return res.status(500).json({ error: 'Failed to save event request' })
  }
}
