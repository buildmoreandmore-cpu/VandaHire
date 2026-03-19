import { createClient } from '@supabase/supabase-js'
import { checkAdmin } from '../_lib/auth.js'
import { sendSms } from '../_lib/sms.js'
import { sendEmail } from '../_lib/email.js'

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

  const [applicants, events, assignments] = await Promise.all([
    supabase.from('applicants').select('status'),
    supabase.from('events').select('status, total_bill_amount, invoice_status, payment_status'),
    supabase.from('assignments').select('status, payout_amount, payout_status'),
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

  return res.status(200).json({
    applicants: { total: applicants.data.length, by_status: countBy(applicants.data, 'status') },
    events: { total: events.data.length, by_status: countBy(events.data, 'status'), by_invoice_status: countBy(events.data, 'invoice_status'), by_payment_status: countBy(events.data, 'payment_status') },
    assignments: { total: assignments.data.length, by_status: countBy(assignments.data, 'status'), by_payout_status: countBy(assignments.data, 'payout_status') },
    financials: { total_billed: totalBilled, client_paid: totalPaidByClients, client_outstanding: totalOutstanding, total_payouts: totalPayouts, payouts_paid: totalPayoutsPaid, payouts_pending: totalPayoutsPending },
  })
}

async function handleApplicants(req, res, supabase) {
  if (req.method === 'GET') {
    let query = supabase.from('applicants').select('id, created_at, first_name, last_name, email, phone, city, zip, roles, availability, experience_types, availability_windows, has_transportation, short_notice, notes, photo_url, score_breakdown, status').order('created_at', { ascending: false })
    const { status } = req.query
    if (status && status !== 'all') query = query.eq('status', status)
    const { data, error } = await query
    if (error) throw error
    return res.status(200).json(data)
  }
  if (req.method === 'PATCH') {
    const { id, status } = req.body
    if (!id || !status) return res.status(400).json({ error: 'id and status required' })
    const valid = ['pending', 'qualified', 'needs_review', 'not_a_fit', 'approved', 'rejected']
    if (!valid.includes(status)) return res.status(400).json({ error: `Invalid status` })
    const { data, error } = await supabase.from('applicants').update({ status, updated_at: new Date().toISOString() }).eq('id', id).select().single()
    if (error) throw error
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
    const { id, status, bill_rate, total_bill_amount, invoice_status, payment_status } = req.body
    if (!id) return res.status(400).json({ error: 'id required' })
    const updates = { updated_at: new Date().toISOString() }
    const validStatuses = ['pending', 'approved', 'awaiting_payment', 'staffing', 'confirmed', 'completed', 'cancelled']
    const validInvoice = ['not_sent', 'sent', 'paid', 'overdue']
    const validPayment = ['unpaid', 'partial', 'paid']
    if (status !== undefined) { if (!validStatuses.includes(status)) return res.status(400).json({ error: 'Invalid status' }); updates.status = status }
    if (bill_rate !== undefined) updates.bill_rate = bill_rate
    if (total_bill_amount !== undefined) updates.total_bill_amount = total_bill_amount
    if (invoice_status !== undefined) { if (!validInvoice.includes(invoice_status)) return res.status(400).json({ error: 'Invalid invoice_status' }); updates.invoice_status = invoice_status }
    if (payment_status !== undefined) { if (!validPayment.includes(payment_status)) return res.status(400).json({ error: 'Invalid payment_status' }); updates.payment_status = payment_status }
    if (Object.keys(updates).length === 1) return res.status(400).json({ error: 'No fields to update' })
    const { data, error } = await supabase.from('events').update(updates).eq('id', id).select().single()
    if (error) throw error
    return res.status(200).json(data)
  }
  return res.status(405).json({ error: 'Method not allowed' })
}

async function handleAssignments(req, res, supabase) {
  if (req.method === 'GET') {
    let query = supabase.from('assignments').select('id, created_at, updated_at, status, notes, event_id, worker_id, pay_rate, hours_worked, payout_amount, payout_status, confirmation_token, shift_sent_at, survey_sent_at, briefing_slot, briefing_confirmed, events ( id, title, event_date, start_time, end_time, city, status, bill_rate ), applicants ( id, first_name, last_name, email, phone, city, photo_url, status )').order('created_at', { ascending: false })
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
    return res.status(200).json({ created: data.length, assignments: data })
  }
  if (req.method === 'PATCH') {
    const { id, status, pay_rate, hours_worked, payout_amount, payout_status, notes } = req.body
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
    if (Object.keys(updates).length === 1) return res.status(400).json({ error: 'No fields to update' })
    const { data, error } = await supabase.from('assignments').update(updates).eq('id', id).select().single()
    if (error) throw error
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
    `Questions? Email crew@joinvanda.co`,
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

  const baseUrl = process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'https://joinvanda.co'
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

  const siteUrl = process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'https://joinvanda.co'
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
      default: return res.status(404).json({ error: `Unknown admin action: ${action}` })
    }
  } catch (err) {
    console.error(`[admin/${action}] Error:`, err)
    return res.status(500).json({ error: 'Internal server error' })
  }
}
