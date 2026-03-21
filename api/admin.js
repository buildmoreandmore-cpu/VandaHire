import { createClient } from '@supabase/supabase-js'
import { checkAdmin } from '../_lib/auth.js'
import { sendSms } from '../_lib/sms.js'
import { sendEmail } from '../_lib/email.js'
import { calculatePay, calculateRefund, calculateQuote } from '../_lib/pay.js'
import { getAgreementHtml } from '../_lib/agreement.js'

function supabaseClient() {
  return createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
}

function generateToken() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789'
  let token = ''
  for (let i = 0; i < 24; i++) token += chars[Math.floor(Math.random() * chars.length)]
  return token
}

function formatDate(d) {
  return d ? new Date(d + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }) : ''
}

function formatTime(t) {
  if (!t) return ''
  const [h, m] = t.split(':')
  const hour = parseInt(h, 10)
  return `${hour % 12 || 12}:${m} ${hour >= 12 ? 'PM' : 'AM'}`
}

async function handleStats(req, res, supabase) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })

  const now = new Date()
  const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10)
  const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString().slice(0, 10)
  const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0).toISOString().slice(0, 10)

  const [applicants, events, assignments, surveys] = await Promise.all([
    supabase.from('applicants').select('status'),
    supabase.from('events').select('id, status, total_bill_amount, invoice_status, payment_status, event_date, workers_needed'),
    supabase.from('assignments').select('status, payout_amount, payout_status'),
    supabase.from('surveys').select('worker_id, rating').not('submitted_at', 'is', null),
  ])
  if (applicants.error) throw applicants.error
  if (events.error) throw events.error
  if (assignments.error) throw assignments.error

  const countBy = (rows, field) => {
    const counts = {}
    for (const row of rows) { const val = row[field] || 'unknown'; counts[val] = (counts[val] || 0) + 1 }
    return counts
  }

  let totalBilled = 0, totalPaidByClients = 0, totalOutstanding = 0
  for (const ev of events.data) {
    const amt = parseFloat(ev.total_bill_amount) || 0
    totalBilled += amt
    if (ev.payment_status === 'paid') totalPaidByClients += amt
    else totalOutstanding += amt
  }

  let totalPayouts = 0, totalPayoutsPaid = 0, totalPayoutsPending = 0
  for (const a of assignments.data) {
    const amt = parseFloat(a.payout_amount) || 0
    totalPayouts += amt
    if (a.payout_status === 'paid') totalPayoutsPaid += amt
    else totalPayoutsPending += amt
  }

  // Worker analytics
  const totalApproved = applicants.data.filter(a => a.status === 'approved').length
  const surveyRatings = (surveys.data || []).map(s => s.rating).filter(r => r != null)
  const avgRating = surveyRatings.length > 0
    ? Math.round((surveyRatings.reduce((sum, r) => sum + r, 0) / surveyRatings.length) * 10) / 10
    : null

  // Workers with shifts this month (from assignments with event this month)
  const eventsThisMonth = events.data.filter(e => e.event_date >= thisMonthStart)
  const eventsLastMonth = events.data.filter(e => e.event_date >= lastMonthStart && e.event_date <= lastMonthEnd)
  const completedEvents = events.data.filter(e => e.status === 'completed')
  const completionRate = events.data.length > 0
    ? Math.round((completedEvents.length / events.data.length) * 100)
    : 0
  const totalWorkersNeeded = events.data.reduce((sum, e) => sum + (e.workers_needed || 0), 0)
  const avgCrewSize = events.data.length > 0
    ? Math.round((totalWorkersNeeded / events.data.length) * 10) / 10
    : 0

  return res.status(200).json({
    applicants: { total: applicants.data.length, by_status: countBy(applicants.data, 'status') },
    events: {
      total: events.data.length,
      by_status: countBy(events.data, 'status'),
      by_invoice_status: countBy(events.data, 'invoice_status'),
      by_payment_status: countBy(events.data, 'payment_status'),
      this_month: eventsThisMonth.length,
      last_month: eventsLastMonth.length,
      completion_rate: completionRate,
      avg_crew_size: avgCrewSize,
    },
    assignments: { total: assignments.data.length, by_status: countBy(assignments.data, 'status'), by_payout_status: countBy(assignments.data, 'payout_status') },
    financials: { total_billed: totalBilled, client_paid: totalPaidByClients, client_outstanding: totalOutstanding, total_payouts: totalPayouts, payouts_paid: totalPayoutsPaid, payouts_pending: totalPayoutsPending },
    workers: { total_approved: totalApproved, avg_rating: avgRating },
  })
}

async function handleApplicants(req, res, supabase) {
  if (req.method === 'GET') {
    let query = supabase.from('applicants').select('id, created_at, first_name, last_name, email, phone, city, zip, roles, availability, experience_types, availability_windows, has_transportation, short_notice, notes, photo_url, score_breakdown, status').order('created_at', { ascending: false })
    const { status } = req.query
    if (status && status !== 'all') query = query.eq('status', status)
    const { data, error } = await query
    if (error) throw error

    // Fetch survey data to compute per-worker ratings
    const { data: surveyData } = await supabase
      .from('surveys')
      .select('worker_id, rating, would_work_again')
      .not('submitted_at', 'is', null)

    // Build a map of worker_id → rating stats
    const ratingMap = {}
    for (const s of (surveyData || [])) {
      if (!s.worker_id) continue
      if (!ratingMap[s.worker_id]) ratingMap[s.worker_id] = { ratings: [], would_work_again: [] }
      if (s.rating != null) ratingMap[s.worker_id].ratings.push(s.rating)
      if (s.would_work_again != null) ratingMap[s.worker_id].would_work_again.push(s.would_work_again)
    }

    // Merge rating info into each applicant
    const enriched = data.map(a => {
      const r = ratingMap[a.id]
      if (!r || r.ratings.length === 0) return { ...a, avg_rating: null, total_shifts: 0, would_hire_again_pct: null }
      const avg_rating = r.ratings.reduce((sum, v) => sum + v, 0) / r.ratings.length
      const would_hire_again_pct = r.would_work_again.length > 0
        ? Math.round((r.would_work_again.filter(Boolean).length / r.would_work_again.length) * 100)
        : null
      return { ...a, avg_rating: Math.round(avg_rating * 10) / 10, total_shifts: r.ratings.length, would_hire_again_pct }
    })

    return res.status(200).json(enriched)
  }
  if (req.method === 'PATCH') {
    const { id, status, video_verified } = req.body
    if (!id) return res.status(400).json({ error: 'id required' })
    const updates = { updated_at: new Date().toISOString() }
    if (status) {
      const valid = ['pending', 'qualified', 'needs_review', 'not_a_fit', 'approved', 'rejected']
      if (!valid.includes(status)) return res.status(400).json({ error: `Invalid status` })
      updates.status = status
    }
    if (video_verified !== undefined) updates.video_verified = video_verified
    const { data, error } = await supabase.from('applicants').update(updates).eq('id', id).select().single()
    if (error) throw error

    // Auto-send email on status change
    if (status === 'approved' && data.email) {
      try {
        const verifyUrl = 'https://vandahire.com/verify'
        await sendEmail({
          to: data.email,
          subject: 'You\'re Approved! Complete Your Verification — V&A Hire',
          html: `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px">
            <h2 style="color:#ffffff;border-bottom:3px solid #ffffff;padding-bottom:10px">Welcome to V&A Hire, ${data.first_name}!</h2>
            <p>Great news — your application has been approved!</p>
            <p>To complete your profile and start claiming shifts, you need to <strong>record a short verification video</strong>. This ensures the safety of our team and clients.</p>
            <h3>What you'll do:</h3>
            <ol>
              <li>Say your full name and tell us why you want to work with V&A Hire</li>
              <li>Describe a recent work experience where you solved a problem</li>
            </ol>
            <p>It takes less than 2 minutes:</p>
            <p style="text-align:center;margin:20px 0"><a href="${verifyUrl}" style="background:#ffffff;color:#000;padding:14px 28px;border-radius:8px;text-decoration:none;font-weight:bold;font-size:16px;display:inline-block">Record Verification Video</a></p>
            <p style="color:#888;font-size:14px">Once your video is reviewed, you'll receive a confirmation email and can start claiming shifts immediately.</p>
            <p style="color:#888;font-size:12px;margin-top:30px">V&A Hire Staffing • vandahire.com</p>
          </div>`,
        })
      } catch (e) { console.error('[admin/applicants] Approval email failed:', e.message) }
    } else if (status === 'rejected' && data.email) {
      try {
        await sendEmail({
          to: data.email,
          subject: 'Your V&A Hire Application',
          html: `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px">
            <h2>Thanks for applying, ${data.first_name}.</h2>
            <p>We've reviewed your application and unfortunately we're not a fit at this time.</p>
            <p>We appreciate your interest and the time you took to apply. We occasionally re-open applications, so feel free to check back in the future.</p>
            <p style="color:#888;font-size:12px;margin-top:30px">V&A Hire Staffing • vandahire.com</p>
          </div>`,
        })
      } catch (e) { console.error('[admin/applicants] Rejection email failed:', e.message) }
    } else if (video_verified === true && data.email) {
      try {
        await sendEmail({
          to: data.email,
          subject: 'You\'re Verified! Start Claiming Shifts — V&A Hire',
          html: `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px">
            <h2 style="color:#ffffff">You're Verified!</h2>
            <p>Hi ${data.first_name},</p>
            <p>Your verification video has been reviewed and approved.</p>
            <p style="font-weight:bold;margin:20px 0 8px">Two quick steps before you can claim shifts:</p>
            <table style="width:100%;margin:16px 0;" cellpadding="0" cellspacing="0">
              <tr><td style="padding:8px 0;text-align:center;">
                <span style="display:inline-block;background:#333;color:#fff;width:28px;height:28px;line-height:28px;border-radius:50%;font-weight:bold;font-size:14px;text-align:center;">1</span>
                <span style="color:#ccc;font-size:14px;margin-left:8px;">Upload your government-issued ID</span>
              </td></tr>
              <tr><td style="padding:4px 0 16px;text-align:center;">
                <a href="https://vandahire.com/id-upload/${encodeURIComponent(data.phone)}" style="background:#ffffff;color:#000;padding:14px 28px;border-radius:8px;text-decoration:none;font-weight:bold;display:inline-block;">Upload ID →</a>
              </td></tr>
              <tr><td style="padding:8px 0;text-align:center;">
                <span style="display:inline-block;background:#333;color:#fff;width:28px;height:28px;line-height:28px;border-radius:50%;font-weight:bold;font-size:14px;text-align:center;">2</span>
                <span style="color:#ccc;font-size:14px;margin-left:8px;">Complete your W-9 tax form</span>
              </td></tr>
              <tr><td style="padding:4px 0 16px;text-align:center;">
                <a href="https://vandahire.com/w9/${encodeURIComponent(data.phone)}" style="background:#141414;color:#fff;padding:14px 28px;border-radius:8px;text-decoration:none;font-weight:bold;display:inline-block;border:1px solid #333;">Complete W-9 →</a>
              </td></tr>
            </table>
            <p style="color:#888;font-size:13px;">Both steps take less than 2 minutes total. Once complete, you can start claiming shifts immediately.</p>
            <p style="text-align:center;margin:12px 0"><a href="https://vandahire.com/shifts" style="color:#ffffff;text-decoration:none;font-weight:600;font-size:14px">Browse Available Shifts →</a></p>
            <p style="color:#888;font-size:12px;margin-top:30px">V&amp;A Workforce Staffing • vandahire.com</p>
          </div>`,
        })
      } catch (e) { console.error('[admin/applicants] Verified email failed:', e.message) }
    }

    return res.status(200).json(data)
  }
  return res.status(405).json({ error: 'Method not allowed' })
}

async function handleEvents(req, res, supabase) {
  if (req.method === 'GET') {
    let query = supabase.from('events').select('*').order('event_date', { ascending: true })
    const { status } = req.query
    if (status && status !== 'all') query = query.eq('status', status)
    const { data, error } = await query
    if (error) throw error
    return res.status(200).json(data)
  }
  if (req.method === 'PATCH') {
    const { id, status, bill_rate, total_bill_amount, invoice_status, payment_status, latitude, longitude, geofence_radius_meters } = req.body
    if (!id) return res.status(400).json({ error: 'id required' })
    const updates = { updated_at: new Date().toISOString() }
    const validStatuses = ['pending', 'approved', 'awaiting_payment', 'staffing', 'confirmed', 'completed', 'cancelled']
    const validInvoice = ['not_sent', 'sent', 'paid', 'overdue']
    const validPayment = ['unpaid', 'partial', 'paid']
    if (status !== undefined) { if (!validStatuses.includes(status)) return res.status(400).json({ error: 'Invalid status' }); updates.status = status }
    if (bill_rate !== undefined) updates.bill_rate = bill_rate
    if (total_bill_amount !== undefined) updates.total_bill_amount = total_bill_amount
    const { bench_coverage_threshold, bench_pool_size } = req.body
    if (bench_coverage_threshold !== undefined) updates.bench_coverage_threshold = bench_coverage_threshold
    if (bench_pool_size !== undefined) updates.bench_pool_size = bench_pool_size
    if (invoice_status !== undefined) { if (!validInvoice.includes(invoice_status)) return res.status(400).json({ error: 'Invalid invoice_status' }); updates.invoice_status = invoice_status }
    if (payment_status !== undefined) { if (!validPayment.includes(payment_status)) return res.status(400).json({ error: 'Invalid payment_status' }); updates.payment_status = payment_status }
    if (latitude !== undefined) updates.latitude = latitude
    if (longitude !== undefined) updates.longitude = longitude
    if (geofence_radius_meters !== undefined) updates.geofence_radius_meters = geofence_radius_meters
    const { deposit_amount, balance_amount, deposit_status, balance_due_date, client_tier } = req.body
    if (deposit_amount !== undefined) updates.deposit_amount = deposit_amount
    if (balance_amount !== undefined) updates.balance_amount = balance_amount
    if (deposit_status !== undefined) updates.deposit_status = deposit_status
    if (balance_due_date !== undefined) updates.balance_due_date = balance_due_date
    if (client_tier !== undefined) updates.client_tier = client_tier
    const validServiceTiers = ['labor_supply', 'managed_labor']
    const { service_tier } = req.body
    if (service_tier !== undefined) { if (!validServiceTiers.includes(service_tier)) return res.status(400).json({ error: 'Invalid service_tier' }); updates.service_tier = service_tier }
    if (Object.keys(updates).length === 1) return res.status(400).json({ error: 'No fields to update' })
    const { data, error } = await supabase.from('events').update(updates).eq('id', id).select().single()
    if (error) throw error
    // Auto-notify matching workers when event moves to staffing
    if (updates.status === 'staffing') {
      try {
        const { sendSms } = await import('../_lib/sms.js')
        const { data: workers } = await supabase.from('applicants')
          .select('id, first_name, phone')
          .eq('status', 'approved')
          .ilike('city', `%${data.city}%`)
        const siteUrl = process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'https://vandahire.com'
        const shortDate = data.event_date ? new Date(data.event_date + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }) : ''
        let notified = 0
        for (const w of (workers || [])) {
          if (!w.phone) continue
          try {
            await sendSms(w.phone, `Hey ${w.first_name}! New shift in ${data.city}: ${data.title} on ${shortDate}. Claim it: ${siteUrl}/shifts`)
            notified++
          } catch (e) { console.error(`Auto-notify SMS failed for ${w.id}:`, e.message) }
        }
        console.log(`[admin/events] Auto-notified ${notified} workers for event ${data.id}`)
      } catch (e) { console.error('[admin/events] Auto-notify error:', e) }
    }
    return res.status(200).json(data)
  }
  return res.status(405).json({ error: 'Method not allowed' })
}

async function handleAssignments(req, res, supabase) {
  if (req.method === 'GET') {
    let query = supabase.from('assignments').select('id, created_at, updated_at, status, notes, event_id, worker_id, pay_rate, hours_worked, payout_amount, payout_status, confirmation_token, shift_sent_at, survey_sent_at, briefing_slot, briefing_confirmed, check_in_time, check_out_time, check_in_lat, check_in_lng, check_out_lat, check_out_lng, hours_tracked, is_supervisor, events ( id, title, event_date, start_time, end_time, city, status, bill_rate, service_tier ), applicants ( id, first_name, last_name, email, phone, city, photo_url, status )').order('created_at', { ascending: false })
    if (req.query.event_id) query = query.eq('event_id', req.query.event_id)
    if (req.query.worker_id) query = query.eq('worker_id', req.query.worker_id)
    const { data, error } = await query
    if (error) throw error
    return res.status(200).json(data)
  }
  if (req.method === 'POST') {
    const { event_id, worker_ids } = req.body
    if (!event_id || !worker_ids?.length) return res.status(400).json({ error: 'event_id and worker_ids[] required' })
    const rows = worker_ids.map(worker_id => ({ event_id, worker_id, status: 'invited', confirmation_token: generateToken() }))
    const { data, error } = await supabase.from('assignments').upsert(rows, { onConflict: 'event_id,worker_id', ignoreDuplicates: true }).select()
    if (error) throw error

    // Auto-confirm event when fully staffed
    await autoConfirmIfFullyStaffed(supabase, event_id)

    return res.status(200).json({ created: data.length, assignments: data })
  }
  if (req.method === 'PATCH') {
    const { id, status, pay_rate, hours_worked, payout_amount, payout_status, notes, is_supervisor } = req.body
    if (!id) return res.status(400).json({ error: 'id required' })
    const validStatuses = ['invited', 'confirmed', 'declined', 'checked_in', 'completed', 'cancelled']
    const validPayout = ['pending', 'approved', 'paid']
    const updates = { updated_at: new Date().toISOString() }
    if (status !== undefined) { if (!validStatuses.includes(status)) return res.status(400).json({ error: 'Invalid status' }); updates.status = status }
    if (pay_rate !== undefined) updates.pay_rate = pay_rate
    if (hours_worked !== undefined) updates.hours_worked = hours_worked
    if (payout_amount !== undefined) updates.payout_amount = payout_amount
    if (payout_status !== undefined) { if (!validPayout.includes(payout_status)) return res.status(400).json({ error: 'Invalid payout_status' }); updates.payout_status = payout_status }
    if (notes !== undefined) updates.notes = notes
    if (is_supervisor !== undefined) updates.is_supervisor = is_supervisor
    if (Object.keys(updates).length === 1) return res.status(400).json({ error: 'No fields to update' })
    const { data, error } = await supabase.from('assignments').update(updates).eq('id', id).select('*, applicants ( first_name, last_name, email, phone ), events ( title, event_date, start_time, end_time, location, city, meeting_point, supervisor_name, supervisor_phone, pay_rate, dress_code )').single()
    if (error) throw error

    // Auto-confirm event when fully staffed
    if (updates.status === 'confirmed' || updates.status === 'invited') {
      await autoConfirmIfFullyStaffed(supabase, data.event_id)
    }

    // Auto-send shift details when assignment is confirmed
    if (updates.status === 'confirmed' && !data.shift_sent_at) {
      const worker = data.applicants
      const event = data.events
      if (worker?.email && event) {
        try {
          await sendEmail({
            to: worker.email,
            subject: `Shift Confirmed — ${event.title}`,
            html: `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px"><h2>Shift Confirmed — ${event.title}</h2><p>Hi ${worker.first_name},</p><p>Your shift has been confirmed! Here are your details:</p><table style="width:100%;border-collapse:collapse;margin:15px 0"><tr><td style="padding:8px;border-bottom:1px solid #eee;font-weight:bold">Date</td><td style="padding:8px;border-bottom:1px solid #eee">${formatDate(event.event_date)}</td></tr><tr><td style="padding:8px;border-bottom:1px solid #eee;font-weight:bold">Time</td><td style="padding:8px;border-bottom:1px solid #eee">${formatTime(event.start_time)} – ${formatTime(event.end_time)}</td></tr><tr><td style="padding:8px;border-bottom:1px solid #eee;font-weight:bold">Location</td><td style="padding:8px;border-bottom:1px solid #eee">${event.location}, ${event.city}</td></tr>${event.meeting_point ? `<tr><td style="padding:8px;border-bottom:1px solid #eee;font-weight:bold">Meeting Point</td><td style="padding:8px;border-bottom:1px solid #eee">${event.meeting_point}</td></tr>` : ''}${event.supervisor_name ? `<tr><td style="padding:8px;border-bottom:1px solid #eee;font-weight:bold">Supervisor</td><td style="padding:8px;border-bottom:1px solid #eee">${event.supervisor_name}${event.supervisor_phone ? ` • ${event.supervisor_phone}` : ''}</td></tr>` : ''}${event.dress_code ? `<tr><td style="padding:8px;border-bottom:1px solid #eee;font-weight:bold">Dress Code</td><td style="padding:8px;border-bottom:1px solid #eee">${event.dress_code}</td></tr>` : ''}</table><p>Please arrive 10 minutes early.</p><p style="color:#888;font-size:12px">V&A Hire Staffing • vandahire.com</p></div>`,
          })
          await supabase.from('assignments').update({ shift_sent_at: new Date().toISOString() }).eq('id', id)
        } catch (e) { console.error(`[admin/assignments] Auto shift email failed:`, e.message) }
      }
    }

    return res.status(200).json(data)
  }
  if (req.method === 'DELETE') {
    const { id } = req.body
    if (!id) return res.status(400).json({ error: 'id required' })
    const { error } = await supabase.from('assignments').delete().eq('id', id)
    if (error) throw error
    return res.status(200).json({ success: true })
  }
  return res.status(405).json({ error: 'Method not allowed' })
}

async function handleSurveys(req, res, supabase) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })
  const { data, error } = await supabase.from('surveys').select('id, submitted_at, showed_up, rating, would_work_again, issues, feedback, events ( id, title, event_date, city ), applicants ( first_name, last_name, phone )').order('submitted_at', { ascending: false })
  if (error) throw error
  return res.status(200).json(data || [])
}

async function handleSendShift(req, res, supabase) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })
  const { assignment_id } = req.body
  if (!assignment_id) return res.status(400).json({ error: 'assignment_id required' })

  const { data: assignment, error } = await supabase.from('assignments').select('id, applicants ( first_name, last_name, phone, email ), events ( title, event_date, start_time, end_time, location, city, meeting_point, supervisor_name, supervisor_phone, pay_rate, dress_code )').eq('id', assignment_id).single()
  if (error || !assignment) return res.status(404).json({ error: 'Assignment not found' })

  const worker = assignment.applicants
  const event = assignment.events

  const smsBody = [
    `Hi ${worker.first_name}! Your shift details for ${event.title}:`,
    `Date: ${formatDate(event.event_date)} · ${formatTime(event.start_time)} – ${formatTime(event.end_time)}`,
    `Location: ${event.location}, ${event.city}`,
    event.meeting_point ? `Meeting point: ${event.meeting_point}` : '',
    event.supervisor_name ? `Supervisor: ${event.supervisor_name}${event.supervisor_phone ? ` (${event.supervisor_phone})` : ''}` : '',
    event.pay_rate ? `Pay: ${event.pay_rate}` : '',
    event.dress_code ? `Dress code: ${event.dress_code}` : '',
    `Questions? Call (404) 861-7794`,
  ].filter(Boolean).join('\n')

  const emailHtml = `<h2>Your Shift Details — ${event.title}</h2><p><strong>Date:</strong> ${formatDate(event.event_date)}</p><p><strong>Time:</strong> ${formatTime(event.start_time)} – ${formatTime(event.end_time)}</p><p><strong>Location:</strong> ${event.location}, ${event.city}</p>${event.meeting_point ? `<p><strong>Meeting Point:</strong> ${event.meeting_point}</p>` : ''}${event.supervisor_name ? `<p><strong>Supervisor:</strong> ${event.supervisor_name}${event.supervisor_phone ? ` · ${event.supervisor_phone}` : ''}</p>` : ''}${event.pay_rate ? `<p><strong>Pay Rate:</strong> ${event.pay_rate}</p>` : ''}${event.dress_code ? `<p><strong>Dress Code:</strong> ${event.dress_code}</p>` : ''}`

  const results = await Promise.allSettled([
    worker.phone ? sendSms(worker.phone, smsBody) : Promise.resolve(),
    worker.email ? sendEmail({ to: worker.email, subject: `Your Shift: ${event.title}`, html: emailHtml }) : Promise.resolve(),
  ])

  await supabase.from('assignments').update({ shift_sent_at: new Date().toISOString() }).eq('id', assignment_id)
  const errors = results.filter(r => r.status === 'rejected').map(r => r.reason?.message)
  return res.status(200).json({ success: true, errors: errors.length ? errors : undefined })
}

async function handleSendSurvey(req, res, supabase) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })
  const { assignment_id } = req.body
  if (!assignment_id) return res.status(400).json({ error: 'assignment_id required' })

  const { data: assignment, error } = await supabase.from('assignments').select('id, event_id, worker_id, applicants ( first_name, phone, email ), events ( title )').eq('id', assignment_id).single()
  if (error || !assignment) return res.status(404).json({ error: 'Assignment not found' })

  const { data: survey, error: surveyError } = await supabase.from('surveys').upsert({ assignment_id, event_id: assignment.event_id, worker_id: assignment.worker_id }, { onConflict: 'assignment_id' }).select('token').single()
  if (surveyError) throw surveyError

  const baseUrl = process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'https://vandahire.com'
  const surveyUrl = `${baseUrl}/survey/${survey.token}`
  const worker = assignment.applicants
  const eventTitle = assignment.events?.title

  await Promise.allSettled([
    worker.phone ? sendSms(worker.phone, `Hi ${worker.first_name}! Thanks for working ${eventTitle}. Share your feedback: ${surveyUrl}`) : Promise.resolve(),
    worker.email ? sendEmail({ to: worker.email, subject: `How was your shift? — ${eventTitle}`, html: `<h2>How was your shift? — ${eventTitle}</h2><p>Hi ${worker.first_name},</p><p><a href="${surveyUrl}">Complete Your Survey →</a></p>` }) : Promise.resolve(),
  ])

  await supabase.from('assignments').update({ survey_sent_at: new Date().toISOString() }).eq('id', assignment_id)
  return res.status(200).json({ success: true, survey_url: surveyUrl })
}

async function handleNotifyWorkers(req, res, supabase) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })
  const { event_id } = req.body
  if (!event_id) return res.status(400).json({ error: 'event_id required' })

  const { data: event, error: eventError } = await supabase.from('events').select('id, title, event_date, start_time, city').eq('id', event_id).single()
  if (eventError || !event) return res.status(404).json({ error: 'Event not found' })

  const { data: workers, error: workerError } = await supabase.from('applicants').select('id, first_name, phone').eq('status', 'approved').ilike('city', `%${event.city}%`)
  if (workerError) throw workerError
  if (!workers || workers.length === 0) return res.status(200).json({ success: true, sent: 0, message: 'No approved workers found in that city' })

  const siteUrl = process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'https://vandahire.com'
  const shortDate = (d) => d ? new Date(d + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }) : ''

  let sent = 0
  for (const worker of workers) {
    if (!worker.phone) continue
    try {
      await sendSms(worker.phone, `Hey ${worker.first_name}! New shift in ${event.city}: ${event.title} on ${shortDate(event.event_date)}. Claim it: ${siteUrl}/shifts`)
      sent++
    } catch (e) {
      console.error(`SMS failed for ${worker.id}:`, e.message)
    }
  }
  return res.status(200).json({ success: true, sent, total: workers.length })
}

async function handleIncidents(req, res, supabase) {
  if (req.method === 'GET') {
    const { event_id } = req.query
    let query = supabase.from('incident_log').select('id, created_at, event_id, reporter_id, incident_type, description, resolved, applicants ( first_name, last_name ), events ( title )').order('created_at', { ascending: false })
    if (event_id) query = query.eq('event_id', event_id)
    const { data, error } = await query
    if (error) throw error
    return res.status(200).json(data || [])
  }
  if (req.method === 'PATCH') {
    const { id, resolved } = req.body
    if (!id) return res.status(400).json({ error: 'id required' })
    const { data, error } = await supabase.from('incident_log').update({ resolved }).eq('id', id).select().single()
    if (error) throw error
    return res.status(200).json(data)
  }
  return res.status(405).json({ error: 'Method not allowed' })
}

async function handleSuggestWorkers(req, res, supabase) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })
  const { event_id } = req.query
  if (!event_id) return res.status(400).json({ error: 'event_id required' })

  // Get event details
  const { data: event, error: evErr } = await supabase.from('events').select('id, city, role_types, event_date, start_time, end_time').eq('id', event_id).single()
  if (evErr || !event) return res.status(404).json({ error: 'Event not found' })

  // Get already assigned worker IDs
  const { data: existing } = await supabase.from('assignments').select('worker_id').eq('event_id', event_id)
  const assignedIds = new Set((existing || []).map(a => a.worker_id))

  // Get all approved workers
  const { data: workers, error: wErr } = await supabase.from('applicants')
    .select('id, first_name, last_name, city, zip, roles, availability, availability_windows, has_transportation, short_notice, phone, photo_url, score_breakdown')
    .eq('status', 'approved')
  if (wErr) throw wErr

  // Score each worker for this event
  const eventDay = new Date(event.event_date + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase()
  const eventRoles = (event.role_types || []).map(r => r.toLowerCase())

  const scored = (workers || [])
    .filter(w => !assignedIds.has(w.id))
    .filter(w => isAvailableForEvent(w.availability_windows, event.event_date, event.start_time, event.end_time))
    .map(w => {
      let score = 0
      // City match (case-insensitive partial)
      if (w.city && event.city && w.city.toLowerCase().includes(event.city.toLowerCase())) score += 30
      // Role overlap
      const workerRoles = (w.roles || []).map(r => r.toLowerCase())
      const roleOverlap = eventRoles.filter(r => workerRoles.some(wr => wr.includes(r) || r.includes(wr))).length
      score += roleOverlap * 15
      // Availability day match
      const avail = (w.availability || []).map(a => a.toLowerCase())
      if (avail.some(a => a.includes(eventDay) || a === 'any' || a === 'flexible')) score += 10
      // Transportation
      if (w.has_transportation === 'Yes') score += 10
      // Short notice
      if (w.short_notice === 'Yes') score += 5
      // AI score bonus
      if (w.score_breakdown?.decision === 'qualified') score += 10
      return { ...w, match_score: score }
    })
    .sort((a, b) => b.match_score - a.match_score)
    .slice(0, 20) // top 20 suggestions

  return res.status(200).json(scored)
}

// ─── BENCH POOL ──────────────────────────────────────────────────────────────

async function handleBench(req, res, supabase) {
  if (req.method === 'GET') {
    const { event_id } = req.query
    if (!event_id) return res.status(400).json({ error: 'event_id required' })
    const { data, error } = await supabase
      .from('bench_assignments')
      .select('id, created_at, updated_at, event_id, worker_id, status, tier, standby_fee, notes, called_in_at, released_worker_id, applicants ( first_name, last_name, phone, city, photo_url )')
      .eq('event_id', event_id)
      .order('tier', { ascending: true })
      .order('created_at', { ascending: true })
    if (error) throw error
    return res.status(200).json(data || [])
  }

  if (req.method === 'POST') {
    const { event_id, worker_ids, tier = 1, standby_fee = 25.00 } = req.body
    if (!event_id || !worker_ids?.length) return res.status(400).json({ error: 'event_id and worker_ids[] required' })
    const rows = worker_ids.map(worker_id => ({ event_id, worker_id, tier, standby_fee, status: 'standby' }))
    const { data, error } = await supabase
      .from('bench_assignments')
      .upsert(rows, { onConflict: 'event_id,worker_id' })
      .select()
    if (error) throw error
    return res.status(200).json({ created: data.length, bench_assignments: data })
  }

  if (req.method === 'PATCH') {
    const { id, status, notes } = req.body
    if (!id) return res.status(400).json({ error: 'id required' })
    const validStatuses = ['standby', 'called_in', 'confirmed', 'declined', 'cancelled']
    const updates = { updated_at: new Date().toISOString() }
    if (status !== undefined) {
      if (!validStatuses.includes(status)) return res.status(400).json({ error: `Invalid status. Must be one of: ${validStatuses.join(', ')}` })
      updates.status = status
    }
    if (notes !== undefined) updates.notes = notes
    if (Object.keys(updates).length === 1) return res.status(400).json({ error: 'No fields to update' })
    const { data, error } = await supabase.from('bench_assignments').update(updates).eq('id', id).select().single()
    if (error) throw error
    return res.status(200).json(data)
  }

  if (req.method === 'DELETE') {
    const { id } = req.body
    if (!id) return res.status(400).json({ error: 'id required' })
    const { error } = await supabase.from('bench_assignments').delete().eq('id', id)
    if (error) throw error
    return res.status(200).json({ success: true })
  }

  return res.status(405).json({ error: 'Method not allowed' })
}

// ─── RELEASE & REPLACE ──────────────────────────────────────────────────────

async function handleRelease(req, res, supabase) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { event_id, assignment_id, release_reason, phone } = req.body
  if (!event_id || !assignment_id || !release_reason || !phone) {
    return res.status(400).json({ error: 'event_id, assignment_id, release_reason, phone required' })
  }

  const digits = phone.replace(/\D/g, '')

  // 1. Verify the caller is the event supervisor
  const { data: supervisor, error: supErr } = await supabase
    .from('applicants')
    .select('id')
    .or(`phone.eq.${digits},phone.eq.+1${digits}`)
    .limit(1)
    .single()
  if (supErr || !supervisor) return res.status(404).json({ error: 'Supervisor not found' })

  const { data: supAssignment, error: supAErr } = await supabase
    .from('assignments')
    .select('id, is_supervisor')
    .eq('worker_id', supervisor.id)
    .eq('event_id', event_id)
    .eq('is_supervisor', true)
    .single()
  if (supAErr || !supAssignment) return res.status(403).json({ error: 'Only the event supervisor can release workers' })

  // 2. Cancel the released worker's assignment
  const { data: releasedAssignment, error: relErr } = await supabase
    .from('assignments')
    .update({ status: 'cancelled', notes: release_reason, updated_at: new Date().toISOString() })
    .eq('id', assignment_id)
    .select('id, worker_id, applicants ( id, first_name, last_name, phone )')
    .single()
  if (relErr || !releasedAssignment) return res.status(404).json({ error: 'Assignment not found' })

  const releasedWorker = releasedAssignment.applicants

  // 3. Increment strikes on the released worker
  const { error: strikeErr } = await supabase.rpc('increment_strikes', { worker_id: releasedWorker.id }).catch(() => null)
  // Fallback: manual increment if RPC doesn't exist
  if (strikeErr) {
    const { data: workerData } = await supabase.from('applicants').select('strikes').eq('id', releasedWorker.id).single()
    await supabase.from('applicants').update({ strikes: (workerData?.strikes || 0) + 1 }).eq('id', releasedWorker.id)
  }

  // 4. Auto-dispatch: find first standby bench worker
  const { data: benchWorker } = await supabase
    .from('bench_assignments')
    .select('id, worker_id, applicants ( id, first_name, last_name, phone )')
    .eq('event_id', event_id)
    .eq('status', 'standby')
    .order('tier', { ascending: true })
    .order('created_at', { ascending: true })
    .limit(1)
    .single()

  let replacementWorker = null
  if (benchWorker) {
    // 5. Update bench assignment
    await supabase
      .from('bench_assignments')
      .update({
        status: 'called_in',
        called_in_at: new Date().toISOString(),
        released_worker_id: releasedWorker.id,
        updated_at: new Date().toISOString(),
      })
      .eq('id', benchWorker.id)

    replacementWorker = benchWorker.applicants

    // 6. Send SMS to bench worker
    const { data: eventForSms } = await supabase.from('events').select('title, location').eq('id', event_id).single()
    if (replacementWorker?.phone && eventForSms) {
      try {
        await sendSms(replacementWorker.phone, `URGENT: You've been called in for ${eventForSms.title} at ${eventForSms.location}. Report ASAP. Reply YES to confirm.`)
      } catch (e) { console.error(`[release] SMS failed for bench worker ${replacementWorker.id}:`, e.message) }
    }
  }

  // 7. Check coverage and auto-escalate if needed
  const { data: eventData } = await supabase.from('events').select('id, workers_needed, bench_coverage_threshold').eq('id', event_id).single()
  const { data: activeAssignments } = await supabase
    .from('assignments')
    .select('id')
    .eq('event_id', event_id)
    .in('status', ['confirmed', 'checked_in'])
  const activeCount = (activeAssignments || []).length
  const coveragePct = eventData?.workers_needed > 0 ? Math.round((activeCount / eventData.workers_needed) * 100) : 100
  const threshold = parseFloat(eventData?.bench_coverage_threshold) || 80
  const belowThreshold = coveragePct < threshold

  if (belowThreshold) {
    // Auto-escalate: call in ALL remaining standby bench workers
    const { data: remainingBench } = await supabase
      .from('bench_assignments')
      .select('id, worker_id, applicants ( id, first_name, phone )')
      .eq('event_id', event_id)
      .eq('status', 'standby')

    const { data: escalationEvent } = await supabase.from('events').select('title, location').eq('id', event_id).single()
    for (const b of (remainingBench || [])) {
      await supabase.from('bench_assignments').update({
        status: 'called_in',
        called_in_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }).eq('id', b.id)
      if (b.applicants?.phone && escalationEvent) {
        try {
          await sendSms(b.applicants.phone, `URGENT: You've been called in for ${escalationEvent.title} at ${escalationEvent.location}. Report ASAP. Reply YES to confirm.`)
        } catch (e) { console.error(`[release] Escalation SMS failed for ${b.worker_id}:`, e.message) }
      }
    }
  }

  return res.status(200).json({
    success: true,
    released_worker: { id: releasedWorker.id, name: `${releasedWorker.first_name} ${releasedWorker.last_name}` },
    replacement_worker: replacementWorker ? { id: replacementWorker.id, name: `${replacementWorker.first_name} ${replacementWorker.last_name}` } : null,
    coverage_pct: coveragePct,
    below_threshold: belowThreshold,
  })
}

// ─── BENCH DISPATCH ─────────────────────────────────────────────────────────

async function handleBenchDispatch(req, res, supabase) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { event_id, tier } = req.body
  if (!event_id || !tier) return res.status(400).json({ error: 'event_id and tier required' })

  const { data: event, error: evErr } = await supabase.from('events').select('id, title, location, city, workers_needed, pay_rate').eq('id', event_id).single()
  if (evErr || !event) return res.status(404).json({ error: 'Event not found' })

  if (tier === 1) {
    // Tier 1: Call in all standby bench workers for this event
    const { data: benchWorkers } = await supabase
      .from('bench_assignments')
      .select('id, worker_id, applicants ( id, first_name, phone )')
      .eq('event_id', event_id)
      .eq('status', 'standby')

    let dispatched = 0
    for (const b of (benchWorkers || [])) {
      await supabase.from('bench_assignments').update({
        status: 'called_in',
        called_in_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }).eq('id', b.id)
      if (b.applicants?.phone) {
        try {
          await sendSms(b.applicants.phone, `URGENT: You've been called in for ${event.title} at ${event.location}. Report ASAP. Reply YES to confirm.`)
          dispatched++
        } catch (e) { console.error(`[bench-dispatch] SMS failed for ${b.worker_id}:`, e.message) }
      }
    }
    return res.status(200).json({ success: true, tier: 1, dispatched })
  }

  if (tier === 2) {
    // Tier 2: Auto-assign from available approved workers in same city
    const { data: existingAssignments } = await supabase.from('assignments').select('worker_id').eq('event_id', event_id)
    const { data: existingBench } = await supabase.from('bench_assignments').select('worker_id').eq('event_id', event_id)
    const excludeIds = new Set([
      ...((existingAssignments || []).map(a => a.worker_id)),
      ...((existingBench || []).map(b => b.worker_id)),
    ])

    const { data: workers } = await supabase
      .from('applicants')
      .select('id, first_name, last_name, phone')
      .eq('status', 'approved')
      .ilike('city', `%${event.city}%`)

    const available = (workers || []).filter(w => !excludeIds.has(w.id))
    let assigned = 0
    for (const w of available) {
      const { error } = await supabase.from('assignments').insert({
        event_id,
        worker_id: w.id,
        status: 'invited',
        confirmation_token: generateToken(),
      })
      if (!error) {
        assigned++
        if (w.phone) {
          try {
            await sendSms(w.phone, `URGENT: ${event.title} needs staff at ${event.location}. Can you report ASAP? Reply YES to confirm.`)
          } catch (e) { console.error(`[bench-dispatch] Tier 2 SMS failed for ${w.id}:`, e.message) }
        }
      }
    }
    return res.status(200).json({ success: true, tier: 2, assigned })
  }

  if (tier === 3) {
    // Tier 3: Emergency all-call — SMS blast to ALL approved workers with urgency bonus
    const { data: allWorkers } = await supabase
      .from('applicants')
      .select('id, first_name, phone')
      .eq('status', 'approved')

    let blasted = 0
    for (const w of (allWorkers || [])) {
      if (!w.phone) continue
      try {
        await sendSms(w.phone, `EMERGENCY STAFFING: ${event.title} at ${event.location} needs help NOW. 15% urgency bonus! Reply YES or call us ASAP.`)
        blasted++
      } catch (e) { console.error(`[bench-dispatch] Tier 3 SMS failed for ${w.id}:`, e.message) }
    }
    return res.status(200).json({ success: true, tier: 3, blasted })
  }

  return res.status(400).json({ error: 'Invalid tier. Must be 1, 2, or 3' })
}

// ─── QUOTES ─────────────────────────────────────────────────────────────────

async function handleQuotes(req, res, supabase) {
  if (req.method === 'GET') {
    const { event_id } = req.query
    if (!event_id) return res.status(400).json({ error: 'event_id required' })
    const { data, error } = await supabase.from('quotes').select('*').eq('event_id', event_id).single()
    if (error && error.code !== 'PGRST116') throw error
    return res.status(200).json(data || null)
  }

  if (req.method === 'POST') {
    const { event_id, worker_count, hours_estimated, bill_rate_per_hour, supervisor_fee, bench_fee, platform_fee, roster_hold_fee } = req.body
    if (!event_id || !worker_count || !hours_estimated || !bill_rate_per_hour) {
      return res.status(400).json({ error: 'event_id, worker_count, hours_estimated, bill_rate_per_hour required' })
    }

    const quote = calculateQuote({ worker_count, hours_estimated, bill_rate_per_hour, supervisor_fee, bench_fee, platform_fee, roster_hold_fee })

    // Get event date for balance_due_date (Net 15)
    const { data: event } = await supabase.from('events').select('event_date').eq('id', event_id).single()
    const balanceDueDate = event?.event_date
      ? new Date(new Date(event.event_date + 'T00:00:00').getTime() + 15 * 86400000).toISOString().slice(0, 10)
      : null

    const { data, error } = await supabase.from('quotes').upsert({
      event_id,
      ...quote,
      status: 'draft',
    }, { onConflict: 'event_id' }).select().single()
    if (error) throw error

    // Update event with deposit/balance amounts
    await supabase.from('events').update({
      deposit_amount: quote.deposit_amount,
      balance_amount: quote.balance_amount,
      total_bill_amount: quote.total,
      balance_due_date: balanceDueDate,
      updated_at: new Date().toISOString(),
    }).eq('id', event_id)

    // Auto-send simplified quote email to organizer with payment link + full agreement
    const { data: eventForEmail } = await supabase.from('events').select('id, title, contact_email, contact_name, event_date, start_time, end_time, location, city, workers_needed, organizer_token').eq('id', event_id).single()
    if (eventForEmail?.contact_email) {
      const payUrl = eventForEmail.organizer_token
        ? `https://vandahire.com/pay/${eventForEmail.organizer_token}`
        : `https://vandahire.com/organizer?event=${eventForEmail.id}&action=pay`
      const agreementHtml = getAgreementHtml({ deposit: quote.deposit_amount, balance: quote.balance_amount, total: quote.total })
      try {
        await sendEmail({
          to: eventForEmail.contact_email,
          subject: `Your Staffing Quote — ${eventForEmail.title}`,
          html: `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px">
            <h2 style="color:#ffffff;border-bottom:3px solid #ffffff;padding-bottom:10px">Your Staffing Quote</h2>
            <p>Hi ${eventForEmail.contact_name || 'there'},</p>
            <p>Your quote for <strong>${eventForEmail.title}</strong> is ready.</p>
            <table style="width:100%;border-collapse:collapse;margin:15px 0">
              <tr><td style="padding:10px;border-bottom:1px solid #eee;color:#666">Event</td><td style="padding:10px;border-bottom:1px solid #eee;font-weight:bold">${eventForEmail.title}</td></tr>
              <tr><td style="padding:10px;border-bottom:1px solid #eee;color:#666">Date</td><td style="padding:10px;border-bottom:1px solid #eee">${formatDate(eventForEmail.event_date)}</td></tr>
              <tr><td style="padding:10px;border-bottom:1px solid #eee;color:#666">Location</td><td style="padding:10px;border-bottom:1px solid #eee">${eventForEmail.location}, ${eventForEmail.city}</td></tr>
              <tr><td style="padding:10px;border-bottom:1px solid #eee;color:#666">Staff</td><td style="padding:10px;border-bottom:1px solid #eee">${quote.worker_count} crew members</td></tr>
            </table>
            <div style="background:#1a1a2e;color:#fff;padding:20px;border-radius:12px;margin:20px 0;text-align:center">
              <p style="margin:0;font-size:14px;color:#aaa">Staffing Fee</p>
              <p style="margin:8px 0;font-size:32px;font-weight:bold">$${quote.total.toFixed(2)}</p>
              <div style="display:flex;justify-content:center;gap:24px;margin-top:12px">
                <div><span style="color:#aaa;font-size:12px">Deposit Due Now</span><br><strong style="font-size:18px">$${quote.deposit_amount.toFixed(2)}</strong></div>
                <div><span style="color:#aaa;font-size:12px">Balance (Net 15)</span><br><strong style="font-size:18px">$${quote.balance_amount.toFixed(2)}</strong></div>
              </div>
            </div>
            <p style="text-align:center;margin:24px 0"><a href="${payUrl}" style="background:#ffffff;color:#000;padding:16px 32px;border-radius:8px;text-decoration:none;font-weight:bold;font-size:16px;display:inline-block">Review & Pay Deposit</a></p>
            <p style="color:#888;font-size:13px;text-align:center;margin-bottom:8px">Please review the Service Agreement below. You will formally accept it when you pay your deposit.</p>
            ${agreementHtml}
            <p style="color:#888;font-size:12px;margin-top:30px;text-align:center">V&A Hire Staffing • vandahire.com</p>
          </div>`,
        })
        // Auto-mark quote as sent
        await supabase.from('quotes').update({ status: 'sent', updated_at: new Date().toISOString() }).eq('id', data.id)
      } catch (e) { console.error('[admin/quotes] Quote email failed:', e.message) }
    }

    return res.status(200).json(data)
  }

  if (req.method === 'PATCH') {
    const { id, status } = req.body
    if (!id) return res.status(400).json({ error: 'id required' })
    const validStatuses = ['draft', 'sent', 'accepted', 'expired']
    if (status && !validStatuses.includes(status)) return res.status(400).json({ error: 'Invalid status' })
    const updates = { updated_at: new Date().toISOString() }
    if (status) {
      updates.status = status
      if (status === 'accepted') updates.accepted_at = new Date().toISOString()
    }
    const { data, error } = await supabase.from('quotes').update(updates).eq('id', id).select().single()
    if (error) throw error
    return res.status(200).json(data)
  }

  return res.status(405).json({ error: 'Method not allowed' })
}

// ─── PAYMENTS ───────────────────────────────────────────────────────────────

async function handlePayments(req, res, supabase) {
  if (req.method === 'GET') {
    const { event_id } = req.query
    if (!event_id) return res.status(400).json({ error: 'event_id required' })
    const { data, error } = await supabase.from('payments').select('*').eq('event_id', event_id).order('created_at', { ascending: false })
    if (error) throw error
    return res.status(200).json(data || [])
  }

  if (req.method === 'POST') {
    const { event_id, payment_type } = req.body
    if (!event_id || !payment_type) return res.status(400).json({ error: 'event_id and payment_type required' })
    const validTypes = ['deposit', 'balance', 'full_prepay', 'refund']
    if (!validTypes.includes(payment_type)) return res.status(400).json({ error: 'Invalid payment_type' })

    const { data: event } = await supabase.from('events').select('deposit_amount, balance_amount, total_bill_amount').eq('id', event_id).single()
    if (!event) return res.status(404).json({ error: 'Event not found' })

    let amount
    if (payment_type === 'deposit') amount = parseFloat(event.deposit_amount) || 0
    else if (payment_type === 'balance') amount = parseFloat(event.balance_amount) || 0
    else if (payment_type === 'full_prepay') amount = parseFloat(event.total_bill_amount) || 0
    else return res.status(400).json({ error: 'Cannot create refund payment directly' })

    if (amount <= 0) return res.status(400).json({ error: `No ${payment_type} amount set on event` })

    const { data, error } = await supabase.from('payments').insert({
      event_id,
      payment_type,
      amount,
      status: 'pending',
    }).select().single()
    if (error) throw error
    return res.status(200).json(data)
  }

  return res.status(405).json({ error: 'Method not allowed' })
}

// ─── EXIT RECORDS ───────────────────────────────────────────────────────────

async function handleExitRecords(req, res, supabase) {
  if (req.method === 'GET') {
    const { event_id, worker_id } = req.query
    let query = supabase.from('exit_records').select('*, applicants ( first_name, last_name, phone ), events ( title )').order('created_at', { ascending: false })
    if (event_id) query = query.eq('event_id', event_id)
    if (worker_id) query = query.eq('worker_id', worker_id)
    const { data, error } = await query
    if (error) throw error
    return res.status(200).json(data || [])
  }

  if (req.method === 'PATCH') {
    const { id, exit_reason, disputed, dispute_notes } = req.body
    if (!id) return res.status(400).json({ error: 'id required' })

    const updates = { updated_at: new Date().toISOString() }
    if (disputed !== undefined) updates.disputed = disputed
    if (dispute_notes !== undefined) updates.dispute_notes = dispute_notes

    // If exit_reason changed, recalculate pay
    if (exit_reason !== undefined) {
      updates.exit_reason = exit_reason
      const { data: record } = await supabase.from('exit_records').select('hours_worked, scheduled_hours, pay_rate, assignment_id, worker_id').eq('id', id).single()
      if (record) {
        const payResult = calculatePay({
          exit_reason,
          hours_worked: record.hours_worked,
          pay_rate: record.pay_rate,
          scheduled_hours: record.scheduled_hours,
        })
        updates.pay_amount = payResult.pay_amount
        updates.strikes_applied = payResult.strikes

        // Update assignment payout
        if (record.assignment_id) {
          await supabase.from('assignments').update({
            payout_amount: payResult.pay_amount,
            updated_at: new Date().toISOString(),
          }).eq('id', record.assignment_id)
        }

        // Update worker strikes
        if (payResult.strikes > 0) {
          const { data: workerData } = await supabase.from('applicants').select('strikes').eq('id', record.worker_id).single()
          await supabase.from('applicants').update({
            strikes: (workerData?.strikes || 0) + payResult.strikes,
          }).eq('id', record.worker_id)
        }
      }
    }

    const { data, error } = await supabase.from('exit_records').update(updates).eq('id', id).select().single()
    if (error) throw error
    return res.status(200).json(data)
  }

  return res.status(405).json({ error: 'Method not allowed' })
}

// ─── CANCELLATION ───────────────────────────────────────────────────────────

async function handleCancellation(req, res, supabase) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { event_id, reason } = req.body
  if (!event_id) return res.status(400).json({ error: 'event_id required' })

  const { data: event, error: evErr } = await supabase.from('events').select('*').eq('id', event_id).single()
  if (evErr || !event) return res.status(404).json({ error: 'Event not found' })

  // Calculate days until event
  const eventDate = new Date(event.event_date + 'T00:00:00')
  const now = new Date()
  const daysBefore = Math.floor((eventDate - now) / 86400000)

  // Calculate refund
  const depositPaid = parseFloat(event.deposit_amount) || 0
  const refundResult = depositPaid > 0 && event.deposit_status === 'paid'
    ? calculateRefund({ deposit_amount: depositPaid, days_before_event: daysBefore })
    : { refund_amount: 0, refund_pct: 0, reason: 'No deposit paid' }

  // If deposit was paid and refund > 0, create refund payment record
  if (refundResult.refund_amount > 0) {
    await supabase.from('payments').insert({
      event_id,
      payment_type: 'refund',
      amount: refundResult.refund_amount,
      status: 'pending',
      refund_amount: refundResult.refund_amount,
      refund_reason: reason || refundResult.reason,
    })

    // Issue Stripe refund if we have a payment intent
    if (event.stripe_payment_id) {
      // Note: actual Stripe refund is handled via stripe.js
      // This records the intent; admin processes via Stripe dashboard or API
    }
  }

  // Cancel the event
  await supabase.from('events').update({
    status: 'cancelled',
    updated_at: new Date().toISOString(),
  }).eq('id', event_id)

  // Cancel all active assignments and notify workers
  const { data: activeAssignmentsForCancel } = await supabase
    .from('assignments')
    .select('id, applicants ( first_name, email )')
    .eq('event_id', event_id)
    .in('status', ['invited', 'confirmed', 'checked_in'])

  await supabase.from('assignments').update({
    status: 'cancelled',
    updated_at: new Date().toISOString(),
  }).eq('event_id', event_id).in('status', ['invited', 'confirmed', 'checked_in'])

  // Email all affected workers
  for (const a of (activeAssignmentsForCancel || [])) {
    if (a.applicants?.email) {
      try {
        await sendEmail({
          to: a.applicants.email,
          subject: `Shift Cancelled — ${event.title}`,
          html: `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px">
            <h2 style="color:#e94560">Shift Cancelled</h2>
            <p>Hi ${a.applicants.first_name},</p>
            <p>Unfortunately, the shift for <strong>${event.title}</strong> on ${event.event_date} has been cancelled.</p>
            ${reason ? `<p>Reason: ${reason}</p>` : ''}
            <p>We apologize for the inconvenience. Check for other available shifts:</p>
            <p><a href="https://vandahire.com/shifts" style="background:#ffffff;color:#000;padding:10px 20px;border-radius:6px;text-decoration:none;font-weight:600;display:inline-block">Browse Shifts</a></p>
            <p style="color:#888;font-size:12px;margin-top:30px">V&A Hire Staffing • vandahire.com</p>
          </div>`,
        })
      } catch (e) { console.error(`[cancellation] Worker email failed for ${a.id}:`, e.message) }
    }
  }

  // Send cancellation email to organizer
  if (event.contact_email) {
    try {
      await sendEmail({
        to: event.contact_email,
        subject: `Event Cancelled: ${event.title}`,
        html: `<h2>Event Cancellation Confirmation</h2>
          <p>Your event <strong>${event.title}</strong> on ${event.event_date} has been cancelled.</p>
          ${refundResult.refund_amount > 0
            ? `<p>Refund: <strong>$${refundResult.refund_amount.toFixed(2)}</strong> (${refundResult.refund_pct}% — ${refundResult.reason})</p>`
            : `<p>${refundResult.reason}</p>`}
          ${reason ? `<p>Reason: ${reason}</p>` : ''}
          <p>Questions? Call (404) 861-7794</p>`,
      })
    } catch (e) { console.error('[admin/cancellation] Email failed:', e.message) }
  }

  return res.status(200).json({
    success: true,
    event_id,
    refund: refundResult,
    days_before: daysBefore,
  })
}

// ─── HELPERS ─────────────────────────────────────────────────────────────────

async function autoConfirmIfFullyStaffed(supabase, eventId) {
  try {
    const { data: event } = await supabase.from('events').select('id, status, workers_needed, title, contact_email, contact_name').eq('id', eventId).single()
    if (!event || !['staffing'].includes(event.status)) return

    const { data: assignments } = await supabase
      .from('assignments')
      .select('id')
      .eq('event_id', eventId)
      .in('status', ['invited', 'confirmed', 'checked_in'])

    const count = (assignments || []).length
    if (count >= (event.workers_needed || 1)) {
      await supabase.from('events').update({
        status: 'confirmed',
        updated_at: new Date().toISOString(),
      }).eq('id', eventId)

      // Notify organizer
      if (event.contact_email) {
        try {
          await sendEmail({
            to: event.contact_email,
            subject: `Your Event is Fully Staffed — ${event.title}`,
            html: `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px">
              <h2 style="color:#ffffff">Fully Staffed!</h2>
              <p>Hi ${event.contact_name || 'there'},</p>
              <p>Great news — your event <strong>${event.title}</strong> is now fully staffed with ${count} crew members.</p>
              <p>Your team has been notified with their shift details. A supervisor will be assigned to oversee the crew on event day.</p>
              <p style="color:#888;font-size:12px;margin-top:30px">V&A Hire Staffing • vandahire.com</p>
            </div>`,
          })
        } catch (e) { console.error('[auto-confirm] Email failed:', e.message) }
      }
    }
  } catch (e) { console.error('[auto-confirm] Error:', e) }
}

/**
 * Parse availability_windows and check if worker is available for given event day/time
 * Windows format: ["Monday 9am-5pm", "Wednesday 6pm-11pm", "Any"]
 */
function isAvailableForEvent(availabilityWindows, eventDate, startTime, endTime) {
  if (!availabilityWindows?.length) return true // No windows = available anytime
  const windows = availabilityWindows.map(w => w.toLowerCase())
  if (windows.some(w => w === 'any' || w === 'flexible' || w === 'anytime')) return true

  const eventDay = new Date(eventDate + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase()

  // Parse event start/end hours
  const eventStart = parseTimeToHours(startTime)
  const eventEnd = parseTimeToHours(endTime)

  for (const window of windows) {
    // Match patterns like "monday 9am-5pm", "saturday 6pm-11pm", "weekends"
    if (window.includes('weekday') && ['monday','tuesday','wednesday','thursday','friday'].includes(eventDay)) return true
    if (window.includes('weekend') && ['saturday','sunday'].includes(eventDay)) return true

    if (window.includes(eventDay)) {
      // Try to parse time range
      const timeMatch = window.match(/(\d{1,2}(?::\d{2})?\s*(?:am|pm))\s*[-–]\s*(\d{1,2}(?::\d{2})?\s*(?:am|pm))/)
      if (!timeMatch) return true // Day matches but no time restriction

      const windowStart = parseAmPmToHours(timeMatch[1])
      const windowEnd = parseAmPmToHours(timeMatch[2])
      if (eventStart >= windowStart && eventEnd <= windowEnd) return true
    }
  }
  return false
}

function parseTimeToHours(t) {
  if (!t) return 0
  const [h, m] = t.split(':').map(Number)
  return h + (m || 0) / 60
}

function parseAmPmToHours(s) {
  const cleaned = s.trim().toLowerCase()
  const isPm = cleaned.includes('pm')
  const num = cleaned.replace(/[^0-9:]/g, '')
  const parts = num.split(':')
  let h = parseInt(parts[0]) || 0
  const m = parseInt(parts[1]) || 0
  if (isPm && h < 12) h += 12
  if (!isPm && h === 12) h = 0
  return h + m / 60
}

// ─── PAYOUTS (Stripe Connect transfers to workers) ─────────────────────────

async function handlePayouts(req, res, supabase) {
  // GET — list payouts for an event
  if (req.method === 'GET') {
    const { event_id } = req.query
    if (!event_id) return res.status(400).json({ error: 'event_id required' })

    const { data, error } = await supabase
      .from('worker_payouts')
      .select('*, applicants ( first_name, last_name, phone, stripe_connect_id )')
      .eq('event_id', event_id)
      .order('created_at', { ascending: false })

    if (error) throw error
    return res.status(200).json(data || [])
  }

  // POST — process payouts for all completed assignments on an event
  if (req.method === 'POST') {
    const { event_id } = req.body
    if (!event_id) return res.status(400).json({ error: 'event_id required' })

    // Get completed assignments with payout amounts
    const { data: assignments } = await supabase
      .from('assignments')
      .select('id, worker_id, hours_worked, pay_rate, payout_amount, payout_status, applicants ( id, first_name, last_name, stripe_connect_id, total_earnings, shifts_completed )')
      .eq('event_id', event_id)
      .eq('status', 'completed')
      .in('payout_status', ['pending', 'approved'])

    if (!assignments?.length) return res.status(400).json({ error: 'No completed assignments to pay out' })

    const Stripe = (await import('stripe')).default
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY)

    const results = []
    for (const a of assignments) {
      const grossAmount = parseFloat(a.payout_amount) || 0
      if (grossAmount <= 0) continue

      // Platform fee: 5% of gross
      const platformFee = Math.round(grossAmount * 0.05 * 100) / 100
      const netAmount = Math.round((grossAmount - platformFee) * 100) / 100

      // Check if payout already exists
      const { data: existing } = await supabase
        .from('worker_payouts')
        .select('id')
        .eq('assignment_id', a.id)
        .single()
      if (existing) { results.push({ worker_id: a.worker_id, status: 'already_exists' }); continue }

      let stripeTransferId = null
      let payoutStatus = 'approved'

      // If worker has Stripe Connect, create transfer
      if (a.applicants?.stripe_connect_id) {
        try {
          const transfer = await stripe.transfers.create({
            amount: Math.round(netAmount * 100),
            currency: 'usd',
            destination: a.applicants.stripe_connect_id,
            description: `Payout for event ${event_id}`,
            metadata: { event_id, worker_id: a.worker_id, assignment_id: a.id },
          })
          stripeTransferId = transfer.id
          payoutStatus = 'paid'
        } catch (stripeErr) {
          console.error(`[admin/payouts] Stripe transfer failed for worker ${a.worker_id}:`, stripeErr.message)
          payoutStatus = 'failed'
        }
      }

      // Insert payout record
      await supabase.from('worker_payouts').insert({
        worker_id: a.worker_id,
        event_id,
        assignment_id: a.id,
        hours_worked: parseFloat(a.hours_worked) || 0,
        pay_rate: parseFloat(a.pay_rate) || 0,
        gross_amount: grossAmount,
        platform_fee: platformFee,
        net_amount: netAmount,
        stripe_transfer_id: stripeTransferId,
        status: payoutStatus,
        paid_at: payoutStatus === 'paid' ? new Date().toISOString() : null,
      })

      // Update assignment payout status
      await supabase.from('assignments').update({
        payout_status: payoutStatus,
        updated_at: new Date().toISOString(),
      }).eq('id', a.id)

      // Update worker totals
      if (payoutStatus === 'paid') {
        const prevEarnings = parseFloat(a.applicants?.total_earnings) || 0
        const prevShifts = parseInt(a.applicants?.shifts_completed) || 0
        await supabase.from('applicants').update({
          total_earnings: Math.round((prevEarnings + netAmount) * 100) / 100,
          shifts_completed: prevShifts + 1,
          updated_at: new Date().toISOString(),
        }).eq('id', a.worker_id)
      }

      results.push({ worker_id: a.worker_id, net_amount: netAmount, status: payoutStatus, stripe_transfer_id: stripeTransferId })
    }

    return res.status(200).json({ success: true, payouts: results })
  }

  return res.status(405).json({ error: 'Method not allowed' })
}

// ─── dispatcher ───────────────────────────────────────────────────────────────

export default async function handler(req, res) {
  const auth = checkAdmin(req)
  if (!auth.ok) return res.status(auth.status).json({ error: auth.error })

  // action comes from the rewrite: /api/admin/:action → /api/admin?action=:action
  const { action } = req.query
  const supabase = supabaseClient()

  try {
    switch (action) {
      case 'stats': return await handleStats(req, res, supabase)
      case 'applicants': return await handleApplicants(req, res, supabase)
      case 'events': return await handleEvents(req, res, supabase)
      case 'assignments': return await handleAssignments(req, res, supabase)
      case 'surveys': return await handleSurveys(req, res, supabase)
      case 'send-shift': return await handleSendShift(req, res, supabase)
      case 'send-survey': return await handleSendSurvey(req, res, supabase)
      case 'notify-workers': return await handleNotifyWorkers(req, res, supabase)
      case 'incidents': return await handleIncidents(req, res, supabase)
      case 'suggest-workers': return await handleSuggestWorkers(req, res, supabase)
      case 'bench': return await handleBench(req, res, supabase)
      case 'release': return await handleRelease(req, res, supabase)
      case 'bench-dispatch': return await handleBenchDispatch(req, res, supabase)
      case 'quotes': return await handleQuotes(req, res, supabase)
      case 'payments': return await handlePayments(req, res, supabase)
      case 'exit-records': return await handleExitRecords(req, res, supabase)
      case 'cancellation': return await handleCancellation(req, res, supabase)
      case 'payouts': return await handlePayouts(req, res, supabase)
      default: return res.status(404).json({ error: `Unknown admin action: ${action}` })
    }
  } catch (err) {
    console.error(`[admin/${action}] Error:`, err)
    return res.status(500).json({ error: 'Internal server error' })
  }
}
