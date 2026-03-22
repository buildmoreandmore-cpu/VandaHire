import { createClient } from '@supabase/supabase-js'
import { sendEmail } from '../_lib/email.js'

// Single cron function — dispatches by ?job= parameter
// Vercel cron hits: /api/cron?job=shift-reminders, /api/cron?job=balance-reminders, etc.

function supabaseClient() {
  return createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
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

// ─── SHIFT REMINDERS ─────────────────────────────────────────────────────────
// Sends email reminders to confirmed workers 48hrs and 24hrs before their shift

async function shiftReminders(supabase) {
  const now = new Date()
  const in24h = new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
  const in48h = new Date(now.getTime() + 48 * 60 * 60 * 1000).toISOString().slice(0, 10)
  const in72h = new Date(now.getTime() + 72 * 60 * 60 * 1000).toISOString().slice(0, 10)

  const { sendSms } = await import('../_lib/sms.js').catch(() => ({ sendSms: null }))

  // Get assignments for events happening in next 24-72 hours
  const { data: assignments, error } = await supabase
    .from('assignments')
    .select('id, shift_sent_at, status, pay_rate, applicants ( first_name, last_name, email, phone ), events ( title, event_date, start_time, end_time, location, city, meeting_point, supervisor_name, dress_code )')
    .in('status', ['confirmed', 'invited'])
    .is('check_in_time', null)

  if (error) throw error
  if (!assignments?.length) return { sent: 0, sms_sent: 0, message: 'No upcoming assignments found' }

  let sent = 0, smsSent = 0
  for (const a of assignments) {
    const event = a.events
    const worker = a.applicants
    if (!event?.event_date) continue

    const eventDate = event.event_date
    const isIn24h = eventDate === in24h
    const isIn48h = eventDate === in48h
    const isIn72h = eventDate === in72h

    if (!isIn24h && !isIn48h && !isIn72h) continue

    // ── TEXT 1: 72h out — the offer SMS ──
    if (isIn72h && sendSms && worker?.phone) {
      const hours = event.start_time && event.end_time
        ? Math.round((new Date(`2000-01-01T${event.end_time}`) - new Date(`2000-01-01T${event.start_time}`)) / 3600000)
        : null
      const payEst = hours && a.pay_rate ? `$${(hours * parseFloat(a.pay_rate)).toFixed(0)}` : null
      try {
        await sendSms(worker.phone, `Vanda Hire: Event this ${formatDate(event.event_date).split(',')[0]}${hours ? `, ${hours}hrs` : ''}${payEst ? `, ${payEst}` : ''}. ${event.title}, ${event.city}. Reply YES to confirm your spot.`)
        smsSent++
      } catch (e) {
        console.error(`[cron/shift-reminders] 72h SMS failed for ${a.id}:`, e.message)
      }
    }

    // ── TEXT 2: 24h out — the prep details SMS ──
    if (isIn24h && sendSms && worker?.phone) {
      const dressCode = event.dress_code || 'all black'
      const supervisor = event.supervisor_name ? `Ask for ${event.supervisor_name}. ` : ''
      try {
        await sendSms(worker.phone, `Vanda Hire: Tomorrow's your shift. Arrive at ${formatTime(event.start_time)}, ${event.location}. ${supervisor}Dress code: ${dressCode}. Any questions? Reply here.`)
        smsSent++
      } catch (e) {
        console.error(`[cron/shift-reminders] 24h SMS failed for ${a.id}:`, e.message)
      }
    }

    // ── Email reminders (24h + 48h) ──
    if ((isIn24h || isIn48h) && worker?.email) {
      const urgency = isIn24h ? 'TOMORROW' : 'in 2 days'
      const subject = isIn24h
        ? `Reminder: Your shift is TOMORROW — ${event.title}`
        : `Upcoming Shift Reminder — ${event.title}`

      const html = `
        <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px">
          <h2 style="color:#ffffff">Shift Reminder — ${event.title}</h2>
          <p>Hi ${worker.first_name},</p>
          <p>Your shift is <strong>${urgency}</strong>!</p>
          <table style="width:100%;border-collapse:collapse;margin:15px 0">
            <tr><td style="padding:8px;border-bottom:1px solid #eee;font-weight:bold;width:120px">Date</td><td style="padding:8px;border-bottom:1px solid #eee">${formatDate(event.event_date)}</td></tr>
            <tr><td style="padding:8px;border-bottom:1px solid #eee;font-weight:bold">Time</td><td style="padding:8px;border-bottom:1px solid #eee">${formatTime(event.start_time)} – ${formatTime(event.end_time)}</td></tr>
            <tr><td style="padding:8px;border-bottom:1px solid #eee;font-weight:bold">Location</td><td style="padding:8px;border-bottom:1px solid #eee">${event.location}, ${event.city}</td></tr>
            ${event.meeting_point ? `<tr><td style="padding:8px;border-bottom:1px solid #eee;font-weight:bold">Meeting Point</td><td style="padding:8px;border-bottom:1px solid #eee">${event.meeting_point}</td></tr>` : ''}
          </table>
          <p>Please arrive 10 minutes early. If you can no longer make it, let us know ASAP.</p>
          <p style="color:#888;font-size:12px;margin-top:30px">V&A Hire • vandahire.com</p>
        </div>`

      try {
        await sendEmail({ to: worker.email, subject, html })
        sent++
      } catch (e) {
        console.error(`[cron/shift-reminders] Email failed for assignment ${a.id}:`, e.message)
      }
    }
  }

  return { sent, sms_sent: smsSent, message: `Sent ${sent} email(s), ${smsSent} SMS` }
}

// ─── BALANCE REMINDERS ───────────────────────────────────────────────────────
// Sends email reminders when balance is due (Net 15) — 5 days before, 2 days before, overdue

async function balanceReminders(supabase) {
  const today = new Date().toISOString().slice(0, 10)

  // Get events with unpaid balance
  const { data: events, error } = await supabase
    .from('events')
    .select('id, title, contact_email, contact_name, balance_amount, balance_due_date, deposit_status, payment_status, event_date')
    .eq('deposit_status', 'paid')
    .neq('payment_status', 'paid')
    .not('balance_due_date', 'is', null)
    .not('balance_amount', 'is', null)

  if (error) throw error
  if (!events?.length) return { sent: 0, message: 'No balance reminders needed' }

  const siteUrl = 'https://vandahire.com'
  let sent = 0

  for (const event of events) {
    if (!event.contact_email || !event.balance_due_date) continue

    const dueDate = new Date(event.balance_due_date + 'T00:00:00')
    const todayDate = new Date(today + 'T00:00:00')
    const daysUntilDue = Math.floor((dueDate - todayDate) / 86400000)

    let subject, urgencyMsg
    if (daysUntilDue === 5) {
      subject = `Balance Due in 5 Days — ${event.title}`
      urgencyMsg = 'Your balance payment is due in <strong>5 days</strong>.'
    } else if (daysUntilDue === 2) {
      subject = `Balance Due in 2 Days — ${event.title}`
      urgencyMsg = 'Your balance payment is due in <strong>2 days</strong>. Please make your payment soon to avoid any service disruptions.'
    } else if (daysUntilDue === 0) {
      subject = `Balance Due TODAY — ${event.title}`
      urgencyMsg = 'Your balance payment is <strong>due today</strong>. Please pay immediately.'
    } else if (daysUntilDue === -1) {
      subject = `OVERDUE: Balance Payment — ${event.title}`
      urgencyMsg = 'Your balance payment is <strong>overdue</strong>. Please pay immediately to avoid late fees.'
    } else if (daysUntilDue === -7) {
      subject = `FINAL NOTICE: Overdue Balance — ${event.title}`
      urgencyMsg = 'Your balance payment is <strong>7 days overdue</strong>. This is your final notice before escalation.'
    } else {
      continue // Not a reminder day
    }

    // Auto-mark as overdue
    if (daysUntilDue < 0) {
      await supabase.from('events').update({
        invoice_status: 'overdue',
        updated_at: new Date().toISOString(),
      }).eq('id', event.id)
    }

    const balance = parseFloat(event.balance_amount) || 0
    const html = `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px">
        <h2 style="color:#ffffff">Balance Payment ${daysUntilDue < 0 ? '— OVERDUE' : 'Reminder'}</h2>
        <p>Hi ${event.contact_name || 'there'},</p>
        <p>${urgencyMsg}</p>
        <table style="width:100%;border-collapse:collapse;margin:15px 0">
          <tr><td style="padding:8px;border-bottom:1px solid #eee;font-weight:bold">Event</td><td style="padding:8px;border-bottom:1px solid #eee">${event.title}</td></tr>
          <tr><td style="padding:8px;border-bottom:1px solid #eee;font-weight:bold">Balance Due</td><td style="padding:8px;border-bottom:1px solid #eee;font-size:18px;color:#e94560"><strong>$${balance.toFixed(2)}</strong></td></tr>
          <tr><td style="padding:8px;border-bottom:1px solid #eee;font-weight:bold">Due Date</td><td style="padding:8px;border-bottom:1px solid #eee">${formatDate(event.balance_due_date)}</td></tr>
        </table>
        <p>To make your payment, please contact us or use the payment link provided by your coordinator.</p>
        <p style="color:#888;font-size:12px;margin-top:30px">V&A Hire Staffing • vandahire.com</p>
      </div>`

    try {
      await sendEmail({ to: event.contact_email, subject, html })
      sent++
    } catch (e) {
      console.error(`[cron/balance-reminders] Email failed for event ${event.id}:`, e.message)
    }
  }

  return { sent, message: `Sent ${sent} balance reminder(s)` }
}

// ─── POST-EVENT AUTOMATION ───────────────────────────────────────────────────
// Auto-send surveys, auto-approve payouts for clean exits

async function postEvent(supabase) {
  const now = new Date()
  const { sendSms } = await import('../_lib/sms.js').catch(() => ({ sendSms: null }))
  // Look for events that ended today or yesterday (event_date is in the past, within 2 days)
  const twoDaysAgo = new Date(now.getTime() - 2 * 86400000).toISOString().slice(0, 10)
  const today = now.toISOString().slice(0, 10)

  const { data: events, error: evErr } = await supabase
    .from('events')
    .select('id, title, event_date, end_time, status')
    .in('status', ['confirmed', 'staffing'])
    .gte('event_date', twoDaysAgo)
    .lte('event_date', today)

  if (evErr) throw evErr
  if (!events?.length) return { surveys_sent: 0, payouts_approved: 0 }

  let surveysSent = 0
  let payoutsApproved = 0

  for (const event of events) {
    // Check if event has ended (compare end_time with current time)
    if (event.event_date === today && event.end_time) {
      const [h, m] = event.end_time.split(':')
      const endTime = new Date(today + 'T00:00:00')
      endTime.setHours(parseInt(h), parseInt(m))
      // Add 1 hour buffer after event ends
      if (now < new Date(endTime.getTime() + 60 * 60 * 1000)) continue
    }

    // Get completed assignments without surveys sent
    const { data: assignments } = await supabase
      .from('assignments')
      .select('id, worker_id, event_id, status, payout_amount, payout_status, survey_sent_at, applicants ( first_name, email, phone ), events ( title )')
      .eq('event_id', event.id)
      .in('status', ['completed', 'checked_in'])

    for (const a of (assignments || [])) {
      // Auto-send survey if not sent yet
      if (!a.survey_sent_at && a.applicants?.email) {
        // Create survey record
        const { data: survey } = await supabase.from('surveys')
          .upsert({ assignment_id: a.id, event_id: a.event_id, worker_id: a.worker_id }, { onConflict: 'assignment_id' })
          .select('token')
          .single()

        if (survey) {
          const surveyUrl = `https://vandahire.com/survey/${survey.token}`
          try {
            await sendEmail({
              to: a.applicants.email,
              subject: `How was your shift? — ${event.title}`,
              html: `
                <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px">
                  <h2>Thanks for working ${event.title}!</h2>
                  <p>Hi ${a.applicants.first_name},</p>
                  <p>We'd love to hear about your experience. It takes less than 2 minutes.</p>
                  <p style="text-align:center;margin:20px 0"><a href="${surveyUrl}" style="background:#ffffff;color:#000;padding:12px 24px;border-radius:6px;text-decoration:none;font-weight:bold">Complete Your Survey</a></p>
                  <p style="color:#888;font-size:12px">V&A Hire Staffing • vandahire.com</p>
                </div>`,
            })
            await supabase.from('assignments').update({ survey_sent_at: new Date().toISOString() }).eq('id', a.id)
            surveysSent++
          } catch (e) {
            console.error(`[cron/post-event] Survey email failed for ${a.id}:`, e.message)
          }

          // TEXT 3: Post-shift SMS — feels human, opens feedback loop
          if (sendSms && a.applicants?.phone) {
            try {
              await sendSms(a.applicants.phone, `Vanda Hire: Hope it went well tonight, ${a.applicants.first_name}. You showed up — that's everything. Reply with any feedback or just let us know how it went.`)
            } catch (e) {
              console.error(`[cron/post-event] Post-shift SMS failed for ${a.id}:`, e.message)
            }
          }
        }
      }

      // Auto-approve payouts for clean exits (no disputes)
      if (a.payout_amount > 0 && a.payout_status === 'pending') {
        // Check if there's a disputed exit record
        const { data: exitRecord } = await supabase
          .from('exit_records')
          .select('disputed')
          .eq('assignment_id', a.id)
          .single()

        if (!exitRecord?.disputed) {
          await supabase.from('assignments').update({
            payout_status: 'approved',
            updated_at: new Date().toISOString(),
          }).eq('id', a.id)
          payoutsApproved++
        }
      }
    }

    // Mark event as completed if all assignments are done
    const { data: remaining } = await supabase
      .from('assignments')
      .select('id')
      .eq('event_id', event.id)
      .in('status', ['invited', 'confirmed', 'checked_in'])

    if (!remaining?.length) {
      await supabase.from('events').update({
        status: 'completed',
        updated_at: new Date().toISOString(),
      }).eq('id', event.id)
    }
  }

  return { surveys_sent: surveysSent, payouts_approved: payoutsApproved }
}

// ─── AUTO-STAFFING ───────────────────────────────────────────────────────────
// Auto-assign top-scored workers when event moves to staffing and has no assignments yet
// Also auto-sends shift details to newly confirmed workers

async function autoStaffing(supabase) {
  // Find events in "staffing" status with fewer assignments than workers_needed
  const { data: events, error } = await supabase
    .from('events')
    .select('id, title, city, role_types, event_date, start_time, end_time, workers_needed, pay_rate, location, meeting_point, supervisor_name, supervisor_phone, dress_code')
    .eq('status', 'staffing')
    .gte('event_date', new Date().toISOString().slice(0, 10))

  if (error) throw error
  if (!events?.length) return { events_processed: 0, auto_assigned: 0, shifts_sent: 0 }

  let autoAssigned = 0
  let shiftsSent = 0

  for (const event of events) {
    // Count current assignments
    const { data: currentAssignments } = await supabase
      .from('assignments')
      .select('id, status, worker_id, shift_sent_at, applicants ( first_name, email, phone )')
      .eq('event_id', event.id)
      .in('status', ['invited', 'confirmed', 'checked_in', 'completed'])

    const assignedCount = (currentAssignments || []).length
    const needed = event.workers_needed || 0

    if (assignedCount < needed) {
      // Need more workers — auto-suggest and assign
      const assignedIds = new Set((currentAssignments || []).map(a => a.worker_id))

      // Also exclude bench workers
      const { data: benchWorkers } = await supabase
        .from('bench_assignments')
        .select('worker_id')
        .eq('event_id', event.id)
      const benchIds = new Set((benchWorkers || []).map(b => b.worker_id))

      const { data: workers } = await supabase
        .from('applicants')
        .select('id, first_name, last_name, city, roles, availability, has_transportation, short_notice, score_breakdown, email, phone')
        .eq('status', 'approved')

      const eventDay = new Date(event.event_date + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase()
      const eventRoles = (event.role_types || []).map(r => r.toLowerCase())

      const scored = (workers || [])
        .filter(w => !assignedIds.has(w.id) && !benchIds.has(w.id))
        .map(w => {
          let score = 0
          if (w.city && event.city && w.city.toLowerCase().includes(event.city.toLowerCase())) score += 30
          const workerRoles = (w.roles || []).map(r => r.toLowerCase())
          const roleOverlap = eventRoles.filter(r => workerRoles.some(wr => wr.includes(r) || r.includes(wr))).length
          score += roleOverlap * 15
          const avail = (w.availability || []).map(a => a.toLowerCase())
          if (avail.some(a => a.includes(eventDay) || a === 'any' || a === 'flexible')) score += 10
          if (w.has_transportation === 'Yes') score += 10
          if (w.short_notice === 'Yes') score += 5
          if (w.score_breakdown?.decision === 'qualified') score += 10
          return { ...w, match_score: score }
        })
        .filter(w => w.match_score >= 30) // Only assign workers with decent match score
        .sort((a, b) => b.match_score - a.match_score)
        .slice(0, needed - assignedCount)

      // Create assignments for top matches
      const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789'
      for (const w of scored) {
        let token = ''
        for (let i = 0; i < 24; i++) token += chars[Math.floor(Math.random() * chars.length)]

        const { error: insertErr } = await supabase.from('assignments').insert({
          event_id: event.id,
          worker_id: w.id,
          status: 'invited',
          confirmation_token: token,
        })
        if (!insertErr) {
          autoAssigned++
          // Send shift invitation email
          if (w.email) {
            const confirmUrl = `https://vandahire.com/confirm/${token}`
            try {
              await sendEmail({
                to: w.email,
                subject: `New Shift Available — ${event.title}`,
                html: `
                  <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px">
                    <h2 style="color:#ffffff">You've Been Matched to a Shift!</h2>
                    <p>Hi ${w.first_name},</p>
                    <p>We have a shift that matches your profile:</p>
                    <table style="width:100%;border-collapse:collapse;margin:15px 0">
                      <tr><td style="padding:8px;border-bottom:1px solid #eee;font-weight:bold">Event</td><td style="padding:8px;border-bottom:1px solid #eee">${event.title}</td></tr>
                      <tr><td style="padding:8px;border-bottom:1px solid #eee;font-weight:bold">Date</td><td style="padding:8px;border-bottom:1px solid #eee">${formatDate(event.event_date)}</td></tr>
                      <tr><td style="padding:8px;border-bottom:1px solid #eee;font-weight:bold">Time</td><td style="padding:8px;border-bottom:1px solid #eee">${formatTime(event.start_time)} – ${formatTime(event.end_time)}</td></tr>
                      <tr><td style="padding:8px;border-bottom:1px solid #eee;font-weight:bold">Location</td><td style="padding:8px;border-bottom:1px solid #eee">${event.location}, ${event.city}</td></tr>
                      ${event.pay_rate ? `<tr><td style="padding:8px;border-bottom:1px solid #eee;font-weight:bold">Pay</td><td style="padding:8px;border-bottom:1px solid #eee">${event.pay_rate}</td></tr>` : ''}
                    </table>
                    <p style="text-align:center;margin:20px 0"><a href="${confirmUrl}" style="background:#ffffff;color:#000;padding:12px 24px;border-radius:6px;text-decoration:none;font-weight:bold">Confirm This Shift</a></p>
                    <p style="color:#888;font-size:12px">V&A Hire Staffing • vandahire.com</p>
                  </div>`,
              })
            } catch (e) {
              console.error(`[cron/auto-staffing] Invite email failed for ${w.id}:`, e.message)
            }
          }
        }
      }
    }

    // Auto-send shift details to confirmed workers who haven't received them yet
    for (const a of (currentAssignments || [])) {
      if (a.status === 'confirmed' && !a.shift_sent_at && a.applicants?.email) {
        try {
          await sendEmail({
            to: a.applicants.email,
            subject: `Your Shift Details — ${event.title}`,
            html: `
              <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px">
                <h2>Your Shift Details — ${event.title}</h2>
                <p>Hi ${a.applicants.first_name},</p>
                <p>Here are your confirmed shift details:</p>
                <table style="width:100%;border-collapse:collapse;margin:15px 0">
                  <tr><td style="padding:8px;border-bottom:1px solid #eee;font-weight:bold">Date</td><td style="padding:8px;border-bottom:1px solid #eee">${formatDate(event.event_date)}</td></tr>
                  <tr><td style="padding:8px;border-bottom:1px solid #eee;font-weight:bold">Time</td><td style="padding:8px;border-bottom:1px solid #eee">${formatTime(event.start_time)} – ${formatTime(event.end_time)}</td></tr>
                  <tr><td style="padding:8px;border-bottom:1px solid #eee;font-weight:bold">Location</td><td style="padding:8px;border-bottom:1px solid #eee">${event.location}, ${event.city}</td></tr>
                  ${event.meeting_point ? `<tr><td style="padding:8px;border-bottom:1px solid #eee;font-weight:bold">Meeting Point</td><td style="padding:8px;border-bottom:1px solid #eee">${event.meeting_point}</td></tr>` : ''}
                  ${event.supervisor_name ? `<tr><td style="padding:8px;border-bottom:1px solid #eee;font-weight:bold">Supervisor</td><td style="padding:8px;border-bottom:1px solid #eee">${event.supervisor_name}${event.supervisor_phone ? ` • ${event.supervisor_phone}` : ''}</td></tr>` : ''}
                  ${event.pay_rate ? `<tr><td style="padding:8px;border-bottom:1px solid #eee;font-weight:bold">Pay</td><td style="padding:8px;border-bottom:1px solid #eee">${event.pay_rate}</td></tr>` : ''}
                  ${event.dress_code ? `<tr><td style="padding:8px;border-bottom:1px solid #eee;font-weight:bold">Dress Code</td><td style="padding:8px;border-bottom:1px solid #eee">${event.dress_code}</td></tr>` : ''}
                </table>
                <p>Please arrive 10 minutes early.</p>
                <p style="color:#888;font-size:12px">V&A Hire Staffing • vandahire.com</p>
              </div>`,
          })
          await supabase.from('assignments').update({ shift_sent_at: new Date().toISOString() }).eq('id', a.id)
          shiftsSent++
        } catch (e) {
          console.error(`[cron/auto-staffing] Shift details email failed for ${a.id}:`, e.message)
        }
      }
    }
  }

  return { events_processed: events.length, auto_assigned: autoAssigned, shifts_sent: shiftsSent }
}

// ─── AUTO-REVIEW TIMEOUT ─────────────────────────────────────────────────────
// Auto-decide needs_review applicants after 3 days

async function autoReviewTimeout(supabase) {
  const twelveHoursAgo = new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString()

  // Pick up both 'pending' and 'needs_review' applicants older than 12 hours
  const { data: staleApplicants, error } = await supabase
    .from('applicants')
    .select('id, first_name, email, score_breakdown, created_at')
    .in('status', ['pending', 'needs_review'])
    .lt('created_at', twelveHoursAgo)

  if (error) throw error
  if (!staleApplicants?.length) return { processed: 0 }

  let approved = 0, rejected = 0
  for (const applicant of staleApplicants) {
    // Use the stored score to decide: qualified (6+) → approved, not_a_fit (0-2) → rejected
    const score = applicant.score_breakdown?.score
    const decision = applicant.score_breakdown?.decision
    let newStatus
    if (decision === 'qualified' || (typeof score === 'number' && score >= 6)) {
      newStatus = 'approved'
    } else if (decision === 'not_a_fit' || (typeof score === 'number' && score <= 2)) {
      newStatus = 'rejected'
    } else {
      // needs_review with middling score — approve to keep pipeline moving
      newStatus = 'approved'
    }

    await supabase.from('applicants').update({
      status: newStatus,
      updated_at: new Date().toISOString(),
    }).eq('id', applicant.id)

    if (newStatus === 'approved') {
      approved++
      if (applicant.email) {
        try {
          await sendEmail({
            to: applicant.email,
            subject: 'You\'re Approved! Complete Your Verification — V&A Hire',
            html: `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px">
              <h2 style="color:#ffffff">Welcome to V&A Hire, ${applicant.first_name}!</h2>
              <p>Your application has been approved! Complete your verification video to start claiming shifts:</p>
              <p style="text-align:center;margin:20px 0"><a href="https://vandahire.com/verify" style="background:#ffffff;color:#000;padding:14px 28px;border-radius:8px;text-decoration:none;font-weight:bold;display:inline-block">Record Verification Video</a></p>
              <p style="color:#888;font-size:12px">V&A Hire Staffing • vandahire.com</p>
            </div>`,
          })
        } catch (e) { console.error(`[cron/auto-review] Email failed:`, e.message) }
      }
    } else {
      rejected++
      if (applicant.email) {
        try {
          await sendEmail({
            to: applicant.email,
            subject: 'Your V&A Hire Application',
            html: `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px">
              <h2>Thanks for applying, ${applicant.first_name}.</h2>
              <p>We've reviewed your application and unfortunately we're not a fit at this time.</p>
              <p style="color:#888;font-size:12px">V&A Hire Staffing • vandahire.com</p>
            </div>`,
          })
        } catch (e) { console.error(`[cron/auto-review] Email failed:`, e.message) }
      }
    }
  }

  return { processed: staleApplicants.length, approved, rejected }
}

// ─── SURVEY FOLLOW-UP ────────────────────────────────────────────────────────
// Re-send survey to workers who haven't completed it after 24 hours

async function surveyFollowUp(supabase) {
  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()

  const { data: pendingSurveys, error } = await supabase
    .from('surveys')
    .select('id, token, assignment_id, worker_id, event_id, submitted_at, applicants ( first_name, email ), events ( title )')
    .is('submitted_at', null)
    .lt('created_at', oneDayAgo)

  if (error) throw error
  if (!pendingSurveys?.length) return { sent: 0 }

  let sent = 0
  for (const survey of pendingSurveys) {
    if (!survey.applicants?.email) continue
    const surveyUrl = `https://vandahire.com/survey/${survey.token}`
    try {
      await sendEmail({
        to: survey.applicants.email,
        subject: `Reminder: Share your feedback — ${survey.events?.title || 'Recent Shift'}`,
        html: `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px">
          <h2>We'd still love your feedback!</h2>
          <p>Hi ${survey.applicants.first_name},</p>
          <p>You haven't completed your survey for <strong>${survey.events?.title || 'your recent shift'}</strong> yet. It only takes 2 minutes:</p>
          <p style="text-align:center;margin:20px 0"><a href="${surveyUrl}" style="background:#ffffff;color:#000;padding:12px 24px;border-radius:6px;text-decoration:none;font-weight:bold">Complete Survey</a></p>
          <p style="color:#888;font-size:12px">V&A Hire Staffing • vandahire.com</p>
        </div>`,
      })
      sent++
    } catch (e) { console.error(`[cron/survey-followup] Email failed:`, e.message) }
  }

  return { sent }
}

// ─── AUTO BALANCE LINK ───────────────────────────────────────────────────────
// Auto-generate and send Stripe balance payment link when balance is approaching due

async function autoBalanceLink(supabase) {
  const today = new Date().toISOString().slice(0, 10)
  const fiveDaysOut = new Date(Date.now() + 5 * 86400000).toISOString().slice(0, 10)

  const { data: events, error } = await supabase
    .from('events')
    .select('id, title, contact_email, contact_name, balance_amount, balance_due_date, deposit_status, payment_status')
    .eq('deposit_status', 'paid')
    .neq('payment_status', 'paid')
    .not('balance_due_date', 'is', null)
    .lte('balance_due_date', fiveDaysOut)

  if (error) throw error
  if (!events?.length) return { sent: 0 }

  let sent = 0
  for (const event of events) {
    if (!event.contact_email) continue

    // Check if we already have a pending balance payment with a checkout URL
    const { data: existingPayment } = await supabase
      .from('payments')
      .select('stripe_checkout_url')
      .eq('event_id', event.id)
      .eq('payment_type', 'balance')
      .single()

    if (existingPayment?.stripe_checkout_url) {
      // Already has a link, include it in reminder
      const balance = parseFloat(event.balance_amount) || 0
      try {
        await sendEmail({
          to: event.contact_email,
          subject: `Pay Your Balance — ${event.title}`,
          html: `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px">
            <h2>Balance Payment Due</h2>
            <p>Hi ${event.contact_name || 'there'},</p>
            <p>Your balance of <strong>$${balance.toFixed(2)}</strong> for ${event.title} is due by ${formatDate(event.balance_due_date)}.</p>
            <p style="text-align:center;margin:20px 0"><a href="${existingPayment.stripe_checkout_url}" style="background:#ffffff;color:#000;padding:14px 28px;border-radius:8px;text-decoration:none;font-weight:bold;font-size:16px;display:inline-block">Pay Balance Now</a></p>
            <p style="color:#888;font-size:12px">V&A Hire Staffing • vandahire.com</p>
          </div>`,
        })
        sent++
      } catch (e) { console.error(`[cron/auto-balance-link] Email failed:`, e.message) }
    }
  }

  return { sent }
}

// ─── LATE FEES ───────────────────────────────────────────────────────────────
// Auto-assess late fees on overdue balances (2% per week overdue, capped at 10%)

async function lateFees(supabase) {
  const today = new Date().toISOString().slice(0, 10)

  const { data: overdueEvents, error } = await supabase
    .from('events')
    .select('id, title, contact_email, contact_name, balance_amount, balance_due_date, payment_status, invoice_status')
    .eq('deposit_status', 'paid')
    .neq('payment_status', 'paid')
    .not('balance_due_date', 'is', null)
    .lt('balance_due_date', today)

  if (error) throw error
  if (!overdueEvents?.length) return { assessed: 0 }

  let assessed = 0
  for (const event of overdueEvents) {
    const dueDate = new Date(event.balance_due_date + 'T00:00:00')
    const todayDate = new Date(today + 'T00:00:00')
    const daysOverdue = Math.floor((todayDate - dueDate) / 86400000)
    const weeksOverdue = Math.floor(daysOverdue / 7)

    if (weeksOverdue < 1) continue // No late fee in first week

    const balance = parseFloat(event.balance_amount) || 0
    const lateFeeRate = Math.min(weeksOverdue * 0.02, 0.10) // 2% per week, max 10%
    const lateFeeAmount = Math.round(balance * lateFeeRate * 100) / 100

    // Update event with overdue status
    await supabase.from('events').update({
      invoice_status: 'overdue',
      updated_at: new Date().toISOString(),
    }).eq('id', event.id)

    // Only send late fee notice on week boundaries (7, 14, 21, 28 days)
    if (daysOverdue % 7 === 0 && event.contact_email) {
      try {
        await sendEmail({
          to: event.contact_email,
          subject: `OVERDUE: Late Fee Notice — ${event.title}`,
          html: `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px">
            <h2 style="color:#e94560">Late Fee Notice</h2>
            <p>Hi ${event.contact_name || 'there'},</p>
            <p>Your balance for <strong>${event.title}</strong> is now <strong>${daysOverdue} days overdue</strong>.</p>
            <table style="width:100%;border-collapse:collapse;margin:15px 0">
              <tr><td style="padding:8px;border-bottom:1px solid #eee">Original Balance</td><td style="padding:8px;border-bottom:1px solid #eee;text-align:right">$${balance.toFixed(2)}</td></tr>
              <tr><td style="padding:8px;border-bottom:1px solid #eee">Late Fee (${Math.round(lateFeeRate * 100)}%)</td><td style="padding:8px;border-bottom:1px solid #eee;text-align:right;color:#e94560">$${lateFeeAmount.toFixed(2)}</td></tr>
              <tr style="font-weight:bold"><td style="padding:10px">Total Due</td><td style="padding:10px;text-align:right">$${(balance + lateFeeAmount).toFixed(2)}</td></tr>
            </table>
            <p>Please pay immediately to avoid further fees. Late fees are assessed at 2% per week, capped at 10%.</p>
            <p style="color:#888;font-size:12px;margin-top:30px">V&A Hire Staffing • vandahire.com</p>
          </div>`,
        })
      } catch (e) { console.error(`[cron/late-fees] Email failed:`, e.message) }
    }

    assessed++
  }

  return { assessed }
}

// ─── AUTO BENCH ASSIGNMENT ───────────────────────────────────────────────────
// Auto-populate bench pool for upcoming events that don't have bench workers yet

async function autoBenchAssignment(supabase) {
  const tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 10)
  const nextWeek = new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10)

  const { data: events, error } = await supabase
    .from('events')
    .select('id, city, role_types, workers_needed, event_date, start_time, end_time, bench_pool_size')
    .in('status', ['staffing', 'confirmed'])
    .gte('event_date', tomorrow)
    .lte('event_date', nextWeek)

  if (error) throw error
  if (!events?.length) return { events_processed: 0, bench_added: 0 }

  let benchAdded = 0
  for (const event of events) {
    // Check if bench already has workers
    const { data: existingBench } = await supabase
      .from('bench_assignments')
      .select('id')
      .eq('event_id', event.id)

    const benchSize = event.bench_pool_size || Math.max(1, Math.ceil((event.workers_needed || 1) * 0.2))
    if ((existingBench || []).length >= benchSize) continue

    // Get assigned worker IDs to exclude
    const { data: assignments } = await supabase.from('assignments').select('worker_id').eq('event_id', event.id)
    const assignedIds = new Set([
      ...((assignments || []).map(a => a.worker_id)),
      ...((existingBench || []).map(b => b.worker_id)),
    ])

    // Find available workers in same city
    const { data: workers } = await supabase
      .from('applicants')
      .select('id, city, roles, availability_windows')
      .eq('status', 'approved')
      .ilike('city', `%${event.city}%`)

    const available = (workers || [])
      .filter(w => !assignedIds.has(w.id))
      .slice(0, benchSize - (existingBench || []).length)

    for (const w of available) {
      const { error: insertErr } = await supabase.from('bench_assignments').insert({
        event_id: event.id,
        worker_id: w.id,
        tier: 1,
        standby_fee: 25,
        status: 'standby',
      })
      if (!insertErr) benchAdded++
    }
  }

  return { events_processed: events.length, bench_added: benchAdded }
}

// ─── BRIEFING REMINDERS ──────────────────────────────────────────────────────
// Send briefing reminders to workers with upcoming briefings

async function briefingReminders(supabase) {
  const tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 10)

  const { data: events, error } = await supabase
    .from('events')
    .select('id, title, briefing_required, briefing_date, briefing_time, briefing_location')
    .eq('briefing_required', true)
    .eq('briefing_date', tomorrow)

  if (error) throw error
  if (!events?.length) return { sent: 0 }

  let sent = 0
  for (const event of events) {
    const { data: assignments } = await supabase
      .from('assignments')
      .select('id, applicants ( first_name, email )')
      .eq('event_id', event.id)
      .in('status', ['invited', 'confirmed'])

    for (const a of (assignments || [])) {
      if (!a.applicants?.email) continue
      try {
        await sendEmail({
          to: a.applicants.email,
          subject: `Briefing Tomorrow — ${event.title}`,
          html: `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px">
            <h2>Briefing Reminder</h2>
            <p>Hi ${a.applicants.first_name},</p>
            <p>You have a <strong>mandatory briefing tomorrow</strong> for ${event.title}.</p>
            ${event.briefing_time ? `<p><strong>Time:</strong> ${formatTime(event.briefing_time)}</p>` : ''}
            ${event.briefing_location ? `<p><strong>Location:</strong> ${event.briefing_location}</p>` : ''}
            <p>Please be on time. This briefing covers important event details.</p>
            <p style="color:#888;font-size:12px">V&A Hire Staffing • vandahire.com</p>
          </div>`,
        })
        sent++
      } catch (e) { console.error(`[cron/briefing] Email failed:`, e.message) }
    }
  }

  return { sent }
}

// ─── AUTO-CHARGE BALANCE ─────────────────────────────────────────────────
// Auto-charge saved cards for Net 15 balance on or after the due date

async function autoChargeBalance(supabase) {
  const today = new Date().toISOString().slice(0, 10)

  // Find events where deposit is paid, balance is NOT paid, card is saved, and due date has arrived
  const { data: events, error } = await supabase
    .from('events')
    .select('id, title, contact_email, contact_name, balance_amount, balance_due_date, deposit_status, payment_status, stripe_customer_id')
    .eq('deposit_status', 'paid')
    .neq('payment_status', 'paid')
    .not('stripe_customer_id', 'is', null)
    .not('balance_amount', 'is', null)
    .lte('balance_due_date', today)

  if (error) throw error
  if (!events?.length) return { charged: 0, failed: 0, skipped: 0, message: 'No balances due for auto-charge' }

  const Stripe = (await import('stripe')).default
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY)

  let charged = 0, failed = 0, skipped = 0

  for (const event of events) {
    const balance = parseFloat(event.balance_amount) || 0
    if (balance <= 0) { skipped++; continue }

    // Check if we already attempted a charge for this balance today
    const { data: existingPayment } = await supabase
      .from('payments')
      .select('id, status')
      .eq('event_id', event.id)
      .eq('payment_type', 'balance')
      .in('status', ['succeeded', 'processing'])
      .limit(1)
      .single()

    if (existingPayment) { skipped++; continue }

    try {
      // Get saved payment methods for this customer
      const paymentMethods = await stripe.paymentMethods.list({
        customer: event.stripe_customer_id,
        type: 'card',
      })

      if (!paymentMethods.data.length) {
        console.error(`[cron/auto-charge] No saved card for event ${event.id} customer ${event.stripe_customer_id}`)
        // Send manual payment link instead
        if (event.contact_email) {
          await sendEmail({
            to: event.contact_email,
            subject: `Balance Due — ${event.title}`,
            html: `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px">
              <h2>Balance Payment Due</h2>
              <p>Hi ${event.contact_name || 'there'},</p>
              <p>Your balance of <strong>$${balance.toFixed(2)}</strong> for ${event.title} is now due.</p>
              <p>We were unable to charge your card on file. Please visit your event portal to make payment:</p>
              <p style="text-align:center;margin:20px 0"><a href="https://vandahire.com/organizer" style="background:#ffffff;color:#000;padding:14px 28px;border-radius:8px;text-decoration:none;font-weight:bold">Pay Balance Now</a></p>
              <p style="color:#888;font-size:12px">V&A Hire Staffing • vandahire.com</p>
            </div>`,
          })
        }
        failed++
        continue
      }

      const paymentMethod = paymentMethods.data[0]

      // Create and confirm PaymentIntent off-session
      const paymentIntent = await stripe.paymentIntents.create({
        amount: Math.round(balance * 100),
        currency: 'usd',
        customer: event.stripe_customer_id,
        payment_method: paymentMethod.id,
        off_session: true,
        confirm: true,
        description: `Balance — ${event.title}`,
        metadata: { event_id: event.id, event_title: event.title, payment_type: 'balance' },
      })

      if (paymentIntent.status === 'succeeded') {
        // Update event
        await supabase.from('events').update({
          payment_status: 'paid',
          invoice_status: 'paid',
          updated_at: new Date().toISOString(),
        }).eq('id', event.id)

        // Record payment
        await supabase.from('payments').insert({
          event_id: event.id,
          payment_type: 'balance',
          amount: balance,
          stripe_payment_intent_id: paymentIntent.id,
          status: 'succeeded',
          paid_at: new Date().toISOString(),
        })

        // Send receipt
        if (event.contact_email) {
          try {
            await sendEmail({
              to: event.contact_email,
              subject: `Balance Charged — Receipt for ${event.title}`,
              html: `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px">
                <h2 style="color:#ffffff">Balance Payment Processed</h2>
                <p>Hi ${event.contact_name || 'there'},</p>
                <p>Per the service agreement you signed, we've charged your card on file for the remaining balance on <strong>${event.title}</strong>.</p>
                <table style="width:100%;border-collapse:collapse;margin:15px 0">
                  <tr><td style="padding:10px;border-bottom:1px solid #eee">Balance Charged</td><td style="padding:10px;border-bottom:1px solid #eee;text-align:right;font-size:18px;font-weight:bold">$${balance.toFixed(2)}</td></tr>
                  <tr><td style="padding:10px;border-bottom:1px solid #eee">Card</td><td style="padding:10px;border-bottom:1px solid #eee;text-align:right">•••• ${paymentMethod.card?.last4 || '****'}</td></tr>
                </table>
                <p>Thank you for working with V&A Hire!</p>
                <p style="color:#888;font-size:12px;margin-top:30px">V&A Hire Staffing • vandahire.com</p>
              </div>`,
            })
          } catch (e) { console.error(`[cron/auto-charge] Receipt email failed:`, e.message) }
        }

        charged++
      } else {
        // Payment requires additional action (3D Secure, etc.) — fall back to manual
        console.error(`[cron/auto-charge] PaymentIntent ${paymentIntent.id} status: ${paymentIntent.status}`)
        await supabase.from('payments').insert({
          event_id: event.id,
          payment_type: 'balance',
          amount: balance,
          stripe_payment_intent_id: paymentIntent.id,
          status: 'pending',
        })

        if (event.contact_email) {
          await sendEmail({
            to: event.contact_email,
            subject: `Action Required: Balance Payment — ${event.title}`,
            html: `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px">
              <h2>Balance Payment Requires Action</h2>
              <p>Hi ${event.contact_name || 'there'},</p>
              <p>We attempted to charge your card for the balance of <strong>$${balance.toFixed(2)}</strong> on ${event.title}, but your bank requires additional verification.</p>
              <p>Please visit the organizer portal to complete payment:</p>
              <p style="text-align:center;margin:20px 0"><a href="https://vandahire.com/organizer" style="background:#ffffff;color:#000;padding:14px 28px;border-radius:8px;text-decoration:none;font-weight:bold">Complete Payment</a></p>
              <p style="color:#888;font-size:12px">V&A Hire Staffing • vandahire.com</p>
            </div>`,
          })
        }
        failed++
      }
    } catch (stripeErr) {
      console.error(`[cron/auto-charge] Stripe error for event ${event.id}:`, stripeErr.message)

      // Record failed attempt
      await supabase.from('payments').insert({
        event_id: event.id,
        payment_type: 'balance',
        amount: balance,
        status: 'failed',
      }).catch(() => {})

      // Notify organizer of failed charge
      if (event.contact_email) {
        try {
          await sendEmail({
            to: event.contact_email,
            subject: `Payment Failed: Balance Due — ${event.title}`,
            html: `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px">
              <h2 style="color:#e94560">Payment Failed</h2>
              <p>Hi ${event.contact_name || 'there'},</p>
              <p>We were unable to charge your card on file for the balance of <strong>$${balance.toFixed(2)}</strong> on ${event.title}.</p>
              <p>Please update your payment method or pay manually to avoid late fees:</p>
              <p style="text-align:center;margin:20px 0"><a href="https://vandahire.com/organizer" style="background:#ffffff;color:#000;padding:14px 28px;border-radius:8px;text-decoration:none;font-weight:bold">Pay Balance Now</a></p>
              <p style="color:#888;font-size:12px">V&A Hire Staffing • vandahire.com</p>
            </div>`,
          })
        } catch (e) { console.error(`[cron/auto-charge] Failure email failed:`, e.message) }
      }
      failed++
    }
  }

  return { charged, failed, skipped }
}

// ─── W-9 REMINDERS ──────────────────────────────────────────────────────────
// Sends email + SMS reminders to approved workers who haven't signed their W-9
// Day 3, Day 7, Day 14 after approval

async function w9Reminders(supabase) {
  const now = new Date()
  const threeDaysAgo = new Date(now.getTime() - 3 * 86400000).toISOString()
  const sevenDaysAgo = new Date(now.getTime() - 7 * 86400000).toISOString()
  const fourteenDaysAgo = new Date(now.getTime() - 14 * 86400000).toISOString()

  // Workers approved but no W-9 signed
  const { data: workers, error } = await supabase
    .from('applicants')
    .select('id, first_name, email, phone, status, approved_at, updated_at, w9_signed_at, w9_reminder_count')
    .eq('status', 'approved')
    .is('w9_signed_at', null)

  if (error) throw error
  if (!workers?.length) return { sent: 0, sms_sent: 0, message: 'No W-9 reminders needed' }

  let sent = 0, smsSent = 0

  for (const w of workers) {
    const approvedDate = new Date(w.approved_at || w.updated_at)
    const daysSinceApproval = Math.floor((now - approvedDate) / 86400000)
    const reminderCount = w.w9_reminder_count || 0

    // Determine if we should send based on timing + previous reminders
    let shouldSend = false
    let urgency = ''

    if (daysSinceApproval >= 14 && reminderCount < 3) {
      shouldSend = true
      urgency = 'final'
    } else if (daysSinceApproval >= 7 && reminderCount < 2) {
      shouldSend = true
      urgency = 'second'
    } else if (daysSinceApproval >= 3 && reminderCount < 1) {
      shouldSend = true
      urgency = 'first'
    }

    if (!shouldSend) continue

    const w9Url = `https://vandahire.com/w9/${(w.phone || '').replace(/\D/g, '')}`

    // Send email
    if (w.email) {
      const subject = urgency === 'final'
        ? `Final Reminder: Complete Your W-9 — V&A Hire`
        : urgency === 'second'
        ? `Reminder: Your W-9 Is Still Needed — V&A Hire`
        : `Complete Your W-9 to Start Claiming Shifts — V&A Hire`

      const urgencyText = urgency === 'final'
        ? 'This is your <strong>final reminder</strong>. You will not be able to claim any shifts until your W-9 is on file.'
        : urgency === 'second'
        ? 'You still haven\'t completed your W-9 form. Shifts are filling up — don\'t miss out.'
        : 'You\'re approved! One last step before you can start claiming shifts: complete your W-9 tax form.'

      try {
        await sendEmail({
          to: w.email,
          subject,
          html: `
            <div style="font-family:system-ui,sans-serif;max-width:600px;margin:0 auto;padding:32px;background:#0a0a0a;color:#fff;">
              <h2 style="color:#ffffff;margin:0 0 16px;">Complete Your W-9, ${w.first_name}</h2>
              <p style="color:#ccc;line-height:1.6;">${urgencyText}</p>
              <p style="text-align:center;margin:24px 0;">
                <a href="${w9Url}" style="background:#ffffff;color:#000;padding:14px 32px;border-radius:8px;text-decoration:none;font-weight:bold;display:inline-block;">Complete W-9 Now →</a>
              </p>
              <p style="color:#666;font-size:12px;">Takes less than 2 minutes. Your information is encrypted and secure.</p>
              <p style="color:#444;font-size:11px;margin-top:24px;">V&A Hire • vandahire.com</p>
            </div>`,
        })
        sent++
      } catch (e) {
        console.error(`[cron/w9-reminders] Email failed for ${w.id}:`, e.message)
      }
    }

    // Send SMS on 7-day and 14-day reminders
    if (w.phone && (urgency === 'second' || urgency === 'final')) {
      try {
        const { sendSms } = await import('../_lib/sms.js')
        await sendSms(w.phone, `V&A Hire: Your W-9 is still needed before you can claim shifts. Complete it here: ${w9Url}`)
        smsSent++
      } catch (e) {
        console.error(`[cron/w9-reminders] SMS failed for ${w.id}:`, e.message)
      }
    }

    // Update reminder count
    await supabase.from('applicants').update({
      w9_reminder_count: reminderCount + 1,
      updated_at: now.toISOString(),
    }).eq('id', w.id)
  }

  return { sent, sms_sent: smsSent, message: `Sent ${sent} email(s), ${smsSent} SMS` }
}

// ─── NO-SHOW AUTO-DETECTION ─────────────────────────────────────────────────
// 30 min after event start, mark workers who haven't checked in as no-shows

async function detectNoShows(supabase) {
  const now = new Date()
  const today = now.toISOString().slice(0, 10)

  // Find today's events
  const { data: events, error } = await supabase
    .from('events')
    .select('id, title, event_date, start_time, contact_email, contact_name')
    .eq('event_date', today)
    .in('status', ['confirmed', 'staffing'])

  if (error) throw error
  if (!events?.length) return { no_shows: 0 }

  let noShows = 0
  const adminEmail = process.env.ADMIN_EMAIL || 'crew@vandahire.com'

  for (const event of events) {
    if (!event.start_time) continue

    // Check if 30 min past start time
    const [h, m] = event.start_time.split(':')
    const eventStart = new Date(`${today}T${event.start_time}:00`)
    const threshold = new Date(eventStart.getTime() + 30 * 60 * 1000)

    if (now < threshold) continue // Not yet 30 min past start

    // Find confirmed workers who haven't checked in
    const { data: missing } = await supabase
      .from('assignments')
      .select('id, worker_id, status, check_in_time, applicants ( first_name, last_name, email, phone )')
      .eq('event_id', event.id)
      .eq('status', 'confirmed')
      .is('check_in_time', null)

    if (!missing?.length) continue

    const noShowNames = []
    for (const a of missing) {
      // Mark as no_show
      await supabase.from('assignments').update({
        status: 'no_show',
        updated_at: now.toISOString(),
      }).eq('id', a.id)

      noShowNames.push(`${a.applicants?.first_name || ''} ${a.applicants?.last_name || ''}`.trim())

      // Add strike to worker
      const { data: worker } = await supabase
        .from('applicants')
        .select('id, strikes')
        .eq('id', a.worker_id)
        .single()

      if (worker) {
        await supabase.from('applicants').update({
          strikes: (worker.strikes || 0) + 1,
          updated_at: now.toISOString(),
        }).eq('id', worker.id)
      }

      // Notify worker
      if (a.applicants?.email) {
        try {
          await sendEmail({
            to: a.applicants.email,
            subject: `Missed Shift: ${event.title} — V&A Hire`,
            html: `
              <div style="font-family:system-ui,sans-serif;max-width:600px;margin:0 auto;padding:32px;background:#0a0a0a;color:#fff;">
                <h2 style="color:#ff4444;">Missed Shift</h2>
                <p style="color:#ccc;">Hi ${a.applicants.first_name},</p>
                <p style="color:#ccc;">You were confirmed for <strong>${event.title}</strong> today but did not check in. This has been recorded as a no-show.</p>
                <p style="color:#ccc;">Repeated no-shows may affect your eligibility for future shifts.</p>
                <p style="color:#888;font-size:12px;">If this was an error, contact us at (404) 861-7794.</p>
                <p style="color:#444;font-size:11px;margin-top:24px;">V&A Hire • vandahire.com</p>
              </div>`,
          })
        } catch (e) {
          console.error(`[cron/no-shows] Worker email failed:`, e.message)
        }
      }

      noShows++
    }

    // Notify organizer
    if (event.contact_email && noShowNames.length) {
      try {
        await sendEmail({
          to: event.contact_email,
          subject: `Crew Update: ${noShowNames.length} No-Show(s) — ${event.title}`,
          html: `
            <div style="font-family:system-ui,sans-serif;max-width:600px;margin:0 auto;padding:32px;background:#0a0a0a;color:#fff;">
              <h2 style="color:#ffffff;">Crew Update</h2>
              <p style="color:#ccc;">Hi ${event.contact_name || 'there'},</p>
              <p style="color:#ccc;">${noShowNames.length} worker(s) did not check in for <strong>${event.title}</strong>:</p>
              <ul style="color:#ccc;">${noShowNames.map(n => `<li>${n}</li>`).join('')}</ul>
              <p style="color:#ccc;">We're working to dispatch replacement crew from our bench pool. We'll update you shortly.</p>
              <p style="color:#444;font-size:11px;margin-top:24px;">V&A Hire • vandahire.com</p>
            </div>`,
        })
      } catch (e) {
        console.error(`[cron/no-shows] Organizer email failed:`, e.message)
      }
    }

    // Alert admin
    if (noShowNames.length) {
      try {
        await sendEmail({
          to: adminEmail,
          subject: `⚠ ${noShowNames.length} No-Show(s) — ${event.title}`,
          html: `
            <div style="font-family:system-ui,sans-serif;max-width:600px;margin:0 auto;padding:32px;background:#0a0a0a;color:#fff;">
              <h2 style="color:#ff4444;">No-Show Alert</h2>
              <p style="color:#ccc;"><strong>${event.title}</strong> — ${noShowNames.length} worker(s) didn't check in:</p>
              <ul style="color:#ccc;">${noShowNames.map(n => `<li>${n}</li>`).join('')}</ul>
              <p style="color:#ccc;">Workers have been marked as no-show with a strike. Consider dispatching bench replacements.</p>
              <p style="color:#444;font-size:11px;margin-top:24px;">V&A Hire • vandahire.com</p>
            </div>`,
        })
      } catch (e) {
        console.error(`[cron/no-shows] Admin email failed:`, e.message)
      }
    }
  }

  return { no_shows: noShows }
}

// ─── POST-EVENT ORGANIZER SUMMARY ───────────────────────────────────────────
// Day after event, email organizer with crew performance + cost breakdown

async function postEventOrganizerSummary(supabase) {
  const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10)

  const { data: events, error } = await supabase
    .from('events')
    .select('id, title, event_date, contact_email, contact_name, location, city, workers_needed, total_bill, deposit_amount, balance_amount')
    .eq('event_date', yesterday)
    .in('status', ['completed', 'confirmed'])

  if (error) throw error
  if (!events?.length) return { sent: 0 }

  let sent = 0

  for (const event of events) {
    if (!event.contact_email) continue

    // Get assignments with worker details
    const { data: assignments } = await supabase
      .from('assignments')
      .select('id, status, check_in_time, check_out_time, hours_worked, payout_amount, applicants ( first_name, last_name )')
      .eq('event_id', event.id)

    const completed = (assignments || []).filter(a => ['completed', 'checked_in'].includes(a.status))
    const noShows = (assignments || []).filter(a => a.status === 'no_show')
    const totalHours = completed.reduce((sum, a) => sum + (a.hours_worked || 0), 0)

    const crewRows = completed.map(a => `
      <tr>
        <td style="padding:8px;border-bottom:1px solid #1e1e1e;color:#fff;">${a.applicants?.first_name || ''} ${a.applicants?.last_name || ''}</td>
        <td style="padding:8px;border-bottom:1px solid #1e1e1e;color:#ccc;">${(a.hours_worked || 0).toFixed(1)}h</td>
        <td style="padding:8px;border-bottom:1px solid #1e1e1e;color:#ccc;">${a.check_in_time ? new Date(a.check_in_time).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }) : '—'}</td>
        <td style="padding:8px;border-bottom:1px solid #1e1e1e;color:#ccc;">${a.check_out_time ? new Date(a.check_out_time).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }) : '—'}</td>
      </tr>
    `).join('')

    const totalBill = parseFloat(event.total_bill) || 0
    const deposit = parseFloat(event.deposit_amount) || 0
    const balance = parseFloat(event.balance_amount) || 0

    try {
      await sendEmail({
        to: event.contact_email,
        subject: `Event Summary: ${event.title} — V&A Hire`,
        html: `
          <div style="font-family:system-ui,sans-serif;max-width:600px;margin:0 auto;padding:32px;background:#0a0a0a;color:#fff;">
            <h2 style="color:#ffffff;">Event Summary</h2>
            <p style="color:#ccc;">Hi ${event.contact_name || 'there'},</p>
            <p style="color:#ccc;">Here's your crew report for <strong>${event.title}</strong> on ${formatDate(event.event_date)}.</p>

            <div style="background:#141414;border:1px solid #1e1e1e;border-radius:8px;padding:16px;margin:20px 0;">
              <table style="width:100%;font-size:14px;">
                <tr><td style="color:#888;padding:4px 0;">Workers showed up</td><td style="color:#fff;text-align:right;font-weight:bold;">${completed.length}</td></tr>
                ${noShows.length ? `<tr><td style="color:#888;padding:4px 0;">No-shows</td><td style="color:#ff4444;text-align:right;font-weight:bold;">${noShows.length}</td></tr>` : ''}
                <tr><td style="color:#888;padding:4px 0;">Total hours worked</td><td style="color:#fff;text-align:right;font-weight:bold;">${totalHours.toFixed(1)}</td></tr>
                <tr><td style="color:#888;padding:4px 0;">Total bill</td><td style="color:#fff;text-align:right;font-weight:bold;">$${totalBill.toFixed(2)}</td></tr>
              </table>
            </div>

            ${crewRows ? `
            <h3 style="color:#fff;font-size:14px;margin:24px 0 8px;">Crew Breakdown</h3>
            <table style="width:100%;border-collapse:collapse;font-size:13px;">
              <tr><th style="text-align:left;padding:8px;border-bottom:1px solid #333;color:#888;">Worker</th><th style="text-align:left;padding:8px;border-bottom:1px solid #333;color:#888;">Hours</th><th style="text-align:left;padding:8px;border-bottom:1px solid #333;color:#888;">In</th><th style="text-align:left;padding:8px;border-bottom:1px solid #333;color:#888;">Out</th></tr>
              ${crewRows}
            </table>` : ''}

            <p style="text-align:center;margin:32px 0 16px;">
              <a href="https://vandahire.com/events" style="background:#ffffff;color:#000;padding:14px 32px;border-radius:8px;text-decoration:none;font-weight:bold;display:inline-block;">Book Another Event →</a>
            </p>

            <p style="color:#888;font-size:12px;">Thank you for choosing V&A Hire. Questions? Call (404) 861-7794.</p>
            <p style="color:#444;font-size:11px;margin-top:16px;">V&A Hire • vandahire.com</p>
          </div>`,
      })
      sent++
    } catch (e) {
      console.error(`[cron/organizer-summary] Email failed for event ${event.id}:`, e.message)
    }
  }

  return { sent, message: `Sent ${sent} organizer summary email(s)` }
}

// ─── CREW SHORTFALL ESCALATION ──────────────────────────────────────────────
// 48h before event, if still short on workers, alert admin via email + SMS

async function crewShortfallEscalation(supabase) {
  const twoDaysOut = new Date(Date.now() + 2 * 86400000).toISOString().slice(0, 10)

  const { data: events, error } = await supabase
    .from('events')
    .select('id, title, event_date, start_time, city, workers_needed, contact_name')
    .eq('event_date', twoDaysOut)
    .in('status', ['staffing', 'confirmed'])

  if (error) throw error
  if (!events?.length) return { escalated: 0 }

  const adminEmail = process.env.ADMIN_EMAIL || 'crew@vandahire.com'
  let escalated = 0

  for (const event of events) {
    const needed = event.workers_needed || 0
    if (!needed) continue

    // Count confirmed workers
    const { data: assignments } = await supabase
      .from('assignments')
      .select('id')
      .eq('event_id', event.id)
      .in('status', ['confirmed', 'checked_in'])

    const confirmed = (assignments || []).length
    const shortfall = needed - confirmed

    if (shortfall <= 0) continue

    // Email admin
    try {
      await sendEmail({
        to: adminEmail,
        subject: `⚠ Crew Shortfall: ${event.title} in 48 Hours (Need ${shortfall} More)`,
        html: `
          <div style="font-family:system-ui,sans-serif;max-width:600px;margin:0 auto;padding:32px;background:#0a0a0a;color:#fff;">
            <h2 style="color:#ff4444;">Crew Shortfall Alert</h2>
            <table style="width:100%;font-size:14px;margin:16px 0;">
              <tr><td style="color:#888;padding:8px 0;">Event</td><td style="color:#fff;font-weight:bold;">${event.title}</td></tr>
              <tr><td style="color:#888;padding:8px 0;">Date</td><td style="color:#fff;">${formatDate(event.event_date)} at ${formatTime(event.start_time)}</td></tr>
              <tr><td style="color:#888;padding:8px 0;">City</td><td style="color:#fff;">${event.city}</td></tr>
              <tr><td style="color:#888;padding:8px 0;">Workers needed</td><td style="color:#fff;">${needed}</td></tr>
              <tr><td style="color:#888;padding:8px 0;">Workers confirmed</td><td style="color:#fff;">${confirmed}</td></tr>
              <tr><td style="color:#888;padding:8px 0;">Shortfall</td><td style="color:#ff4444;font-weight:bold;font-size:18px;">${shortfall}</td></tr>
            </table>
            <p style="color:#ccc;">Action needed: dispatch bench workers, post to open shifts, or contact approved workers in ${event.city}.</p>
            <p style="color:#444;font-size:11px;margin-top:24px;">V&A Hire • Automated Escalation</p>
          </div>`,
      })
    } catch (e) {
      console.error(`[cron/shortfall] Email failed:`, e.message)
    }

    // SMS alert to admin
    try {
      const adminPhone = process.env.ADMIN_PHONE
      if (adminPhone) {
        const { sendSms } = await import('../_lib/sms.js')
        await sendSms(adminPhone, `V&A ALERT: ${event.title} in 48hrs — need ${shortfall} more workers (${confirmed}/${needed} confirmed). Check admin panel.`)
      }
    } catch (e) {
      console.error(`[cron/shortfall] SMS failed:`, e.message)
    }

    escalated++
  }

  return { escalated, message: `${escalated} event(s) with crew shortfall` }
}

// ─── POST-EVENT INVOICE + CLIENT SURVEY ─────────────────────────────────────
// Auto-sends invoice email with line items + client satisfaction survey after event ends

async function postEventInvoice(supabase) {
  const now = new Date()
  const yesterday = new Date(now.getTime() - 86400000).toISOString().slice(0, 10)
  const today = now.toISOString().slice(0, 10)

  // Find completed events that haven't had invoice sent yet
  const { data: events, error } = await supabase
    .from('events')
    .select('id, title, event_date, start_time, end_time, location, city, contact_email, contact_name, workers_needed, deposit_amount, balance_amount, total_bill_amount, payment_status, organizer_token, invoice_status')
    .eq('status', 'completed')
    .eq('invoice_status', 'not_sent')
    .gte('event_date', yesterday)
    .lte('event_date', today)

  if (error) throw error
  if (!events?.length) return { invoices_sent: 0, surveys_sent: 0 }

  let invoicesSent = 0
  let surveysSent = 0
  const siteUrl = 'https://vandahire.com'

  for (const event of events) {
    if (!event.contact_email) continue

    // Get assignment details for invoice line items
    const { data: assignments } = await supabase
      .from('assignments')
      .select('id, hours_worked, pay_rate, payout_amount, applicants ( first_name, last_name )')
      .eq('event_id', event.id)
      .eq('status', 'completed')

    const workers = (assignments || []).map(a => ({
      name: `${a.applicants?.first_name || ''} ${a.applicants?.last_name || ''}`.trim(),
      hours: parseFloat(a.hours_worked) || 0,
    }))
    const totalHours = workers.reduce((sum, w) => sum + w.hours, 0)

    const deposit = parseFloat(event.deposit_amount) || 0
    const balance = parseFloat(event.balance_amount) || 0
    const total = parseFloat(event.total_bill_amount) || 0
    const balancePaid = event.payment_status === 'paid'

    const payUrl = event.organizer_token ? `${siteUrl}/pay/${event.organizer_token}` : `${siteUrl}/organizer`
    const surveyUrl = event.organizer_token ? `${siteUrl}/pay/${event.organizer_token}?survey=true` : '#'

    // Build worker line items HTML
    const workerRows = workers.map(w =>
      `<tr><td style="padding:6px 8px;border-bottom:1px solid #1e1e1e;color:#ccc">${w.name}</td><td style="padding:6px 8px;border-bottom:1px solid #1e1e1e;color:#ccc;text-align:right">${w.hours.toFixed(1)}h</td></tr>`
    ).join('')

    try {
      await sendEmail({
        to: event.contact_email,
        subject: `Invoice — ${event.title}`,
        html: `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px;background:#0a0a0a;color:#ffffff">
          <h2 style="color:#ffffff;border-bottom:3px solid #ffffff;padding-bottom:10px;font-family:'Syne',sans-serif">Event Invoice</h2>
          <p>Hi ${event.contact_name || 'there'},</p>
          <p>Thank you for working with V&A Hire! Here's your post-event invoice for <strong>${event.title}</strong>.</p>

          <table style="width:100%;border-collapse:collapse;margin:15px 0">
            <tr><td style="padding:8px;border-bottom:1px solid #1e1e1e;color:#888">Event Date</td><td style="padding:8px;border-bottom:1px solid #1e1e1e">${formatDate(event.event_date)}</td></tr>
            <tr><td style="padding:8px;border-bottom:1px solid #1e1e1e;color:#888">Time</td><td style="padding:8px;border-bottom:1px solid #1e1e1e">${formatTime(event.start_time)} – ${formatTime(event.end_time)}</td></tr>
            <tr><td style="padding:8px;border-bottom:1px solid #1e1e1e;color:#888">Location</td><td style="padding:8px;border-bottom:1px solid #1e1e1e">${event.location}, ${event.city}</td></tr>
            <tr><td style="padding:8px;border-bottom:1px solid #1e1e1e;color:#888">Workers</td><td style="padding:8px;border-bottom:1px solid #1e1e1e">${workers.length} crew members</td></tr>
            <tr><td style="padding:8px;border-bottom:1px solid #1e1e1e;color:#888">Total Hours</td><td style="padding:8px;border-bottom:1px solid #1e1e1e">${totalHours.toFixed(1)}h</td></tr>
          </table>

          ${workerRows ? `<h3 style="color:#ffffff;font-size:14px;margin:20px 0 8px">Crew Summary</h3>
          <table style="width:100%;border-collapse:collapse">${workerRows}</table>` : ''}

          <div style="background:#141414;border:1px solid #1e1e1e;border-radius:12px;padding:20px;margin:20px 0">
            <table style="width:100%;border-collapse:collapse">
              <tr><td style="padding:8px;color:#888">Deposit Paid</td><td style="padding:8px;text-align:right;color:#ffffff">$${deposit.toFixed(2)}</td></tr>
              <tr><td style="padding:8px;color:#888">Balance ${balancePaid ? 'Paid' : 'Due'}</td><td style="padding:8px;text-align:right;${balancePaid ? 'color:#ffffff' : 'font-weight:bold;color:#fff'}">${balancePaid ? '' : ''}$${balance.toFixed(2)}</td></tr>
              <tr style="font-size:18px;font-weight:bold"><td style="padding:10px;border-top:2px solid #ffffff">Total</td><td style="padding:10px;border-top:2px solid #ffffff;text-align:right;color:#ffffff">$${total.toFixed(2)}</td></tr>
            </table>
          </div>

          ${!balancePaid ? `<p style="text-align:center;margin:20px 0"><a href="${payUrl}" style="background:#ffffff;color:#000;padding:14px 28px;border-radius:8px;text-decoration:none;font-weight:bold;font-size:16px;display:inline-block">Pay Balance — $${balance.toFixed(2)}</a></p>` : ''}

          <div style="background:#141414;border:1px solid #1e1e1e;border-radius:12px;padding:16px;margin:20px 0;text-align:center">
            <p style="margin:0 0 8px;color:#888;font-size:14px">How was your experience?</p>
            <p style="margin:0"><a href="${surveyUrl}" style="color:#ffffff;font-weight:bold;text-decoration:none;font-size:16px">Share Your Feedback →</a></p>
          </div>

          <p style="color:#888;font-size:12px;margin-top:30px;text-align:center">V&A Hire Staffing • vandahire.com</p>
        </div>`,
      })

      // Mark invoice as sent
      await supabase.from('events').update({
        invoice_status: 'sent',
        updated_at: new Date().toISOString(),
      }).eq('id', event.id)

      invoicesSent++
    } catch (e) {
      console.error(`[cron/post-event-invoice] Email failed for event ${event.id}:`, e.message)
    }
  }

  return { invoices_sent: invoicesSent }
}

// ─── MONTHLY NEWSLETTER ─────────────────────────────────────────────────────
// Sends a monthly "What's Coming" email to all approved workers
// Upcoming events, worker spotlight, shift tips

async function monthlyNewsletter(supabase) {
  const now = new Date()

  // Only run on the 1st of each month
  if (now.getDate() !== 1) return { sent: 0, message: 'Not the 1st — skipping newsletter' }

  // Get upcoming events for the next 30 days
  const today = now.toISOString().slice(0, 10)
  const thirtyDaysOut = new Date(now.getTime() + 30 * 86400000).toISOString().slice(0, 10)

  const { data: upcomingEvents } = await supabase
    .from('events')
    .select('id, title, event_date, start_time, end_time, city, location, workers_needed, pay_rate')
    .in('status', ['staffing', 'confirmed', 'pending'])
    .gte('event_date', today)
    .lte('event_date', thirtyDaysOut)
    .order('event_date', { ascending: true })
    .limit(5)

  // Get a worker spotlight — someone who completed the most shifts last month
  const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString().slice(0, 10)
  const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0).toISOString().slice(0, 10)

  const { data: topWorkers } = await supabase
    .from('assignments')
    .select('worker_id, applicants ( first_name, last_name, city )')
    .eq('status', 'completed')
    .gte('created_at', lastMonthStart)
    .lte('created_at', lastMonthEnd)

  // Count shifts per worker
  const shiftCounts = {}
  for (const a of (topWorkers || [])) {
    if (!a.worker_id) continue
    if (!shiftCounts[a.worker_id]) shiftCounts[a.worker_id] = { count: 0, worker: a.applicants }
    shiftCounts[a.worker_id].count++
  }

  const spotlight = Object.values(shiftCounts).sort((a, b) => b.count - a.count)[0] || null

  // Build event list HTML
  const eventListHtml = (upcomingEvents || []).length > 0
    ? (upcomingEvents || []).map(e => `
        <tr>
          <td style="padding:10px;border-bottom:1px solid #1e1e1e;color:#fff;font-weight:bold;">${e.title}</td>
          <td style="padding:10px;border-bottom:1px solid #1e1e1e;color:#ccc;">${formatDate(e.event_date)}</td>
          <td style="padding:10px;border-bottom:1px solid #1e1e1e;color:#ccc;">${e.city}</td>
        </tr>`).join('')
    : '<tr><td colspan="3" style="padding:16px;color:#888;text-align:center;">No events posted yet — check back soon!</td></tr>'

  // Build spotlight HTML
  const spotlightHtml = spotlight
    ? `<div style="background:#141414;border:1px solid #1e1e1e;border-radius:8px;padding:20px;margin:24px 0;">
        <p style="color:#888;font-size:11px;text-transform:uppercase;letter-spacing:1px;margin:0 0 8px;">Worker Spotlight</p>
        <p style="color:#fff;font-size:16px;font-weight:bold;margin:0 0 4px;">${spotlight.worker?.first_name} ${(spotlight.worker?.last_name || '').charAt(0)}.</p>
        <p style="color:#ccc;font-size:13px;margin:0;">${spotlight.count} shifts completed last month${spotlight.worker?.city ? ` in ${spotlight.worker.city}` : ''}. Showing up and getting it done.</p>
      </div>`
    : ''

  // Tips — rotate monthly
  const tips = [
    'Complete your W-9 early to claim shifts faster. Workers with W-9s on file get first access.',
    'Set your availability to "Short Notice" — last-minute events often pay more.',
    'Arrive 10 minutes early to every shift. Coordinators notice, and it leads to more invites.',
    'Fill out your post-shift survey. Workers who give feedback get prioritized for premium events.',
    'Add multiple roles to your profile. The more roles you can fill, the more shifts you\'ll see.',
    'Keep your phone on for event day. Supervisors may need to reach you for last-minute changes.',
    'Dress code matters. Showing up in the right gear shows professionalism and gets you repeat shifts.',
    'Tell a friend about Vanda Hire. When they sign up, you both move up the priority list.',
    'Check the shifts page weekly. New events drop every week and fill up fast.',
    'Update your city if you move. We match you to events near you, so accuracy helps.',
    'Respond to shift invites quickly. The first workers to confirm get locked in.',
    'Track your earnings in the app. Knowing your numbers helps you plan and stay motivated.',
  ]
  const tipOfMonth = tips[now.getMonth() % tips.length]

  // Get all approved workers with email
  const { data: workers, error } = await supabase
    .from('applicants')
    .select('id, first_name, email')
    .eq('status', 'approved')
    .not('email', 'is', null)

  if (error) throw error
  if (!workers?.length) return { sent: 0, message: 'No approved workers to email' }

  const monthName = now.toLocaleString('en-US', { month: 'long', year: 'numeric' })
  let sent = 0

  for (const w of workers) {
    if (!w.email) continue

    try {
      await sendEmail({
        to: w.email,
        subject: `What's Coming — Vanda Hire ${monthName}`,
        html: `
          <div style="font-family:system-ui,sans-serif;max-width:600px;margin:0 auto;padding:32px;background:#0a0a0a;color:#fff;">
            <h2 style="color:#ffffff;margin:0 0 4px;">What's Coming</h2>
            <p style="color:#888;font-size:13px;margin:0 0 24px;">Vanda Hire • ${monthName}</p>

            <p style="color:#ccc;line-height:1.6;">Hey ${w.first_name},</p>
            <p style="color:#ccc;line-height:1.6;">Here's what's happening this month on Vanda Hire.</p>

            <h3 style="color:#fff;font-size:14px;margin:24px 0 8px;">Upcoming Events</h3>
            <table style="width:100%;border-collapse:collapse;font-size:13px;">
              <tr><th style="text-align:left;padding:8px;border-bottom:1px solid #333;color:#888;">Event</th><th style="text-align:left;padding:8px;border-bottom:1px solid #333;color:#888;">Date</th><th style="text-align:left;padding:8px;border-bottom:1px solid #333;color:#888;">City</th></tr>
              ${eventListHtml}
            </table>
            <p style="text-align:center;margin:20px 0;">
              <a href="https://vandahire.com/shifts" style="background:#ffffff;color:#000;padding:12px 28px;border-radius:8px;text-decoration:none;font-weight:bold;display:inline-block;">Browse All Shifts →</a>
            </p>

            ${spotlightHtml}

            <div style="background:#141414;border:1px solid #1e1e1e;border-radius:8px;padding:20px;margin:24px 0;">
              <p style="color:#888;font-size:11px;text-transform:uppercase;letter-spacing:1px;margin:0 0 8px;">Shift Tip</p>
              <p style="color:#ccc;font-size:13px;line-height:1.6;margin:0;">${tipOfMonth}</p>
            </div>

            <p style="color:#666;font-size:12px;line-height:1.6;margin-top:32px;">Questions? Call us at (404) 861-7794 or reply to this email.</p>
            <p style="color:#444;font-size:11px;margin-top:16px;">V&A Hire • Varist & Associates of GA LLC • vandahire.com</p>
          </div>`,
      })
      sent++
    } catch (e) {
      console.error(`[cron/newsletter] Email failed for ${w.id}:`, e.message)
    }
  }

  return { sent, message: `Sent ${sent} newsletter email(s)` }
}

// ─── DISPATCHER ──────────────────────────────────────────────────────────────

export default async function handler(req, res) {
  // Verify cron secret (Vercel sets CRON_SECRET automatically for cron jobs)
  const authHeader = req.headers['authorization']
  const cronSecret = process.env.CRON_SECRET
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  const job = req.query.job || req.query.action
  if (!job) return res.status(400).json({ error: 'job parameter required' })

  const supabase = supabaseClient()

  try {
    switch (job) {
      case 'shift-reminders':
        return res.status(200).json(await shiftReminders(supabase))
      case 'balance-reminders':
        return res.status(200).json(await balanceReminders(supabase))
      case 'post-event':
        return res.status(200).json(await postEvent(supabase))
      case 'auto-staffing':
        return res.status(200).json(await autoStaffing(supabase))
      case 'auto-review':
        return res.status(200).json(await autoReviewTimeout(supabase))
      case 'survey-followup':
        return res.status(200).json(await surveyFollowUp(supabase))
      case 'auto-balance-link':
        return res.status(200).json(await autoBalanceLink(supabase))
      case 'late-fees':
        return res.status(200).json(await lateFees(supabase))
      case 'auto-bench':
        return res.status(200).json(await autoBenchAssignment(supabase))
      case 'briefing-reminders':
        return res.status(200).json(await briefingReminders(supabase))
      case 'auto-charge-balance':
        return res.status(200).json(await autoChargeBalance(supabase))
      case 'post-event-invoice':
        return res.status(200).json(await postEventInvoice(supabase))
      case 'w9-reminders':
        return res.status(200).json(await w9Reminders(supabase))
      case 'no-shows':
        return res.status(200).json(await detectNoShows(supabase))
      case 'organizer-summary':
        return res.status(200).json(await postEventOrganizerSummary(supabase))
      case 'crew-shortfall':
        return res.status(200).json(await crewShortfallEscalation(supabase))
      case 'newsletter':
        return res.status(200).json(await monthlyNewsletter(supabase))
      case 'all': {
        // Run all jobs — daily cron
        const results = {}
        results.auto_review = await autoReviewTimeout(supabase)
        results.shift_reminders = await shiftReminders(supabase)
        results.balance_reminders = await balanceReminders(supabase)
        results.auto_balance_link = await autoBalanceLink(supabase)
        results.late_fees = await lateFees(supabase)
        results.post_event = await postEvent(supabase)
        results.post_event_invoice = await postEventInvoice(supabase)
        results.survey_followup = await surveyFollowUp(supabase)
        results.auto_staffing = await autoStaffing(supabase)
        results.auto_bench = await autoBenchAssignment(supabase)
        results.briefing_reminders = await briefingReminders(supabase)
        results.auto_charge_balance = await autoChargeBalance(supabase)
        results.w9_reminders = await w9Reminders(supabase)
        results.no_shows = await detectNoShows(supabase)
        results.organizer_summary = await postEventOrganizerSummary(supabase)
        results.crew_shortfall = await crewShortfallEscalation(supabase)
        results.newsletter = await monthlyNewsletter(supabase)
        return res.status(200).json(results)
      }
      default:
        return res.status(400).json({ error: `Unknown job: ${job}` })
    }
  } catch (err) {
    console.error(`[cron/${job}] Error:`, err)
    return res.status(500).json({ error: 'Cron job failed', details: err.message })
  }
}
