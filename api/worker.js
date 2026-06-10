import crypto from 'crypto'
import { createClient } from '@supabase/supabase-js'
import webPush from 'web-push'
import { findByPhone } from '../_lib/phone.js'
import { hashPin, verifyPin, isLocked, createSession, verifySession, MAX_ATTEMPTS, LOCKOUT_MINUTES } from '../_lib/pin.js'
import { isWithinGeofence } from '../_lib/geo.js'
import { sendSms } from '../_lib/sms.js'
import { calculatePay } from '../_lib/pay.js'
import { sendEmail, readUnsubToken } from '../_lib/email.js'

function supabaseClient() {
  return createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
}

// Combined worker API: checkin + incidents
// Routed via query param: ?route=checkin or ?route=incidents
export default async function handler(req, res) {
  const route = req.query.route || 'checkin'
  const supabase = supabaseClient()

  try {
    if (route === 'incidents') return await handleIncidents(req, res, supabase)
    if (route === 'release') return await handleRelease(req, res, supabase)
    if (route === 'exit-reply') return await handleExitReply(req, res, supabase)
    if (route === 'verify-video') return await handleVerifyVideo(req, res, supabase)
    if (route === 'gps-ping') return await handleGpsPing(req, res, supabase)
    if (route === 'supervisor-dashboard') return await handleSupervisorDashboard(req, res, supabase)
    if (route === 'geofence-check') return await handleGeofenceCheck(req, res, supabase)
    if (route === 'accept-quote') return await handleAcceptQuote(req, res, supabase)
    if (route === 'connect-onboard') return await handleConnectOnboard(req, res, supabase)
    if (route === 'connect-dashboard') return await handleConnectDashboard(req, res, supabase)
    if (route === 'my-earnings') return await handleMyEarnings(req, res, supabase)
    if (route === 'client-survey') return await handleClientSurvey(req, res, supabase)
    if (route === 'my-crew-status') return await handleMyCrewStatus(req, res, supabase)
    if (route === 'w9') return await handleW9(req, res, supabase)
    if (route === 'bg-check') return await handleBgCheck(req, res, supabase)
    if (route === 'unsubscribe') return await handleUnsubscribe(req, res, supabase)
    if (route === 'resend-webhook') return await handleResendWebhook(req, res, supabase)
    if (route === 'geofence-reply') return await handleGeofenceReply(req, res, supabase)
    if (route === 'id-upload') return await handleIdUpload(req, res, supabase)
    if (route === 'push-subscribe') return await handlePushSubscribe(req, res, supabase)
    if (route === 'push-vapid-key') return await handlePushVapidKey(req, res)
    if (route === 'push-send') return await handlePushSend(req, res, supabase)
    if (route === 'push-notify-shift') return await handlePushNotifyShift(req, res, supabase)
    if (route === 'respond-invite') return await handleRespondInvite(req, res, supabase)
    if (route === 'pin-setup') return await handlePinSetup(req, res, supabase)
    if (route === 'pin-verify') return await handlePinVerify(req, res, supabase)
    if (route === 'pin-reset-request') return await handlePinResetRequest(req, res, supabase)
    if (route === 'pin-reset') return await handlePinReset(req, res, supabase)
    if (route === 'session-check') return await handleSessionCheck(req, res, supabase)
    return await handleCheckin(req, res, supabase)
  } catch (err) {
    console.error(`[worker/${route}] Error:`, err)
    return res.status(500).json({ error: 'Internal server error' })
  }
}

// ─── CHECK-IN / CHECK-OUT ─────────────────────────────────────────────────────

async function handleCheckin(req, res, supabase) {
  // GET — fetch worker's assignments with event geofence data
  if (req.method === 'GET') {
    const { phone } = req.query
    if (!phone) return res.status(400).json({ error: 'phone required' })

    const worker = await findByPhone(supabase, phone, 'id, first_name, last_name, phone, status, video_url, id_photo_url, w9_signed_at, bg_check_signed_at, bg_check_cleared, pin_hash')

    if (!worker) return res.status(404).json({ error: 'Worker not found' })
    if (!['approved', 'pending', 'needs_review'].includes(worker.status)) return res.status(403).json({ error: 'Not an approved worker' })

    const { data: assignments, error: aErr } = await supabase
      .from('assignments')
      .select('id, status, check_in_time, check_out_time, hours_tracked, is_supervisor, event_id, events ( id, title, event_date, start_time, end_time, location, city, pay_rate, latitude, longitude, geofence_radius_meters, service_tier )')
      .eq('worker_id', worker.id)
      .in('status', ['invited', 'confirmed', 'checked_in', 'completed'])
      .order('created_at', { ascending: false })

    if (aErr) return res.status(500).json({ error: 'Failed to load assignments' })

    const enriched = []
    for (const a of (assignments || [])) {
      const item = { ...a }
      if (a.is_supervisor) {
        const { data: crew } = await supabase
          .from('assignments')
          .select('id, status, check_in_time, check_out_time, hours_tracked, is_supervisor, worker_id, applicants ( id, first_name, last_name, phone, photo_url )')
          .eq('event_id', a.event_id)
          .in('status', ['invited', 'confirmed', 'checked_in', 'completed'])
          .order('is_supervisor', { ascending: false })
        item.crew = crew || []
      }
      enriched.push(item)
    }

    return res.status(200).json({
      worker: { id: worker.id, first_name: worker.first_name, last_name: worker.last_name, video_url: worker.video_url || null, id_photo_url: worker.id_photo_url || null, w9_signed_at: worker.w9_signed_at || null, bg_check_signed_at: worker.bg_check_signed_at || null, bg_check_cleared: worker.bg_check_cleared || false, has_pin: !!worker.pin_hash },
      assignments: enriched,
    })
  }

  // POST — check in or check out
  if (req.method === 'POST') {
    const { phone, event_id, action, latitude, longitude } = req.body

    if (!phone || !event_id || !action || latitude == null || longitude == null) {
      return res.status(400).json({ error: 'phone, event_id, action, latitude, longitude required' })
    }
    if (!['check_in', 'check_out'].includes(action)) {
      return res.status(400).json({ error: 'action must be check_in or check_out' })
    }

    const worker = await findByPhone(supabase, phone, 'id')
    if (!worker) return res.status(404).json({ error: 'Worker not found' })

    const expectedStatus = action === 'check_in' ? 'confirmed' : 'checked_in'
    const { data: assignment, error: aErr } = await supabase
      .from('assignments')
      .select('id, status, check_in_time')
      .eq('worker_id', worker.id)
      .eq('event_id', event_id)
      .eq('status', expectedStatus)
      .single()

    if (aErr || !assignment) {
      return res.status(404).json({ error: `No ${expectedStatus} assignment found` })
    }

    const { data: event, error: eErr } = await supabase
      .from('events')
      .select('latitude, longitude, geofence_radius_meters, geofence_active')
      .eq('id', event_id)
      .single()

    if (eErr || !event) return res.status(404).json({ error: 'Event not found' })

    if (event.geofence_active && event.latitude != null && event.longitude != null) {
      const radius = event.geofence_radius_meters || 200
      const acc = Math.min(parseFloat(req.body.accuracy) || 0, 150)
      const { distance } = isWithinGeofence(latitude, longitude, event.latitude, event.longitude, radius)
      if (distance > radius + acc) {
        return res.status(403).json({
          error: 'outside_geofence',
          distance,
          message: `You're ${distance}m from the venue. Move closer to ${action === 'check_in' ? 'check in' : 'check out'}.`,
        })
      }
    }

    const now = new Date().toISOString()

    if (action === 'check_in') {
      const { error } = await supabase
        .from('assignments')
        .update({
          status: 'checked_in',
          check_in_time: now,
          check_in_lat: latitude,
          check_in_lng: longitude,
          updated_at: now,
        })
        .eq('id', assignment.id)

      if (error) return res.status(500).json({ error: 'Failed to check in' })

      // Geofence-activation email to the worker (once, on check-in to a geofenced event).
      if (event.latitude != null && event.longitude != null) {
        try {
          const { sendEmail } = await import('../_lib/email.js')
          const { data: w } = await supabase.from('applicants').select('first_name, email').eq('id', worker.id).single()
          const { data: ev } = await supabase.from('events').select('title, location').eq('id', event_id).single()
          if (w?.email) {
            await sendEmail({
              to: w.email,
              subject: `Geofence active — ${ev?.title || 'your shift'}`,
              branded: true,
              html: `<h2 style="margin:0 0 12px">You're checked in — geofence is active</h2>
                <p>Hi ${w.first_name || 'there'}, your location tracking is now active for <strong>${ev?.title || 'your shift'}</strong>${ev?.location ? ` at ${ev.location}` : ''}.</p>
                <p>Please stay within the venue area for the duration of your shift. If you leave the area, your coordinator is automatically notified. Check out from My Shifts when your shift ends.</p>`,
            })
          }
        } catch (e) { console.error('[checkin] activation email failed:', e.message) }
      }

      return res.status(200).json({ success: true, action: 'check_in', time: now })
    }

    const checkInTime = new Date(assignment.check_in_time)
    const checkOutTime = new Date(now)
    const hoursTracked = ((checkOutTime - checkInTime) / 3600000).toFixed(2)

    // Get event details for scheduled hours + pay rate
    const { data: eventDetails } = await supabase
      .from('events')
      .select('title, location, start_time, end_time, pay_rate')
      .eq('id', event_id)
      .single()

    // Calculate scheduled hours from event start/end
    let scheduledHours = 0
    if (eventDetails?.start_time && eventDetails?.end_time) {
      const [sh, sm] = eventDetails.start_time.split(':').map(Number)
      const [eh, em] = eventDetails.end_time.split(':').map(Number)
      scheduledHours = (eh + em / 60) - (sh + sm / 60)
      if (scheduledHours < 0) scheduledHours += 24
    }

    // Get worker pay rate from assignment or event
    const { data: assignmentFull } = await supabase
      .from('assignments')
      .select('pay_rate')
      .eq('id', assignment.id)
      .single()
    const payRate = parseFloat(assignmentFull?.pay_rate) || parseFloat(eventDetails?.pay_rate) || 0

    // Calculate pay via rules engine
    const payResult = calculatePay({
      exit_reason: 'completed',
      hours_worked: parseFloat(hoursTracked),
      pay_rate: payRate,
      scheduled_hours: scheduledHours,
    })

    const { error } = await supabase
      .from('assignments')
      .update({
        status: 'completed',
        check_out_time: now,
        check_out_lat: latitude,
        check_out_lng: longitude,
        hours_tracked: parseFloat(hoursTracked),
        hours_worked: parseFloat(hoursTracked),
        payout_amount: payResult.pay_amount,
        updated_at: now,
      })
      .eq('id', assignment.id)

    if (error) return res.status(500).json({ error: 'Failed to check out' })

    // Create exit_record
    await supabase.from('exit_records').insert({
      event_id,
      worker_id: worker.id,
      assignment_id: assignment.id,
      exit_reason: 'completed',
      hours_worked: parseFloat(hoursTracked),
      scheduled_hours: scheduledHours,
      pay_rate: payRate,
      pay_amount: payResult.pay_amount,
      strikes_applied: payResult.strikes,
    }).catch(e => console.error('[worker/checkout] exit_record insert error:', e.message))

    // Send pay summary SMS
    if (eventDetails?.title) {
      const workerPhone = phone || digits
      try {
        await sendSms(workerPhone, `Your shift at ${eventDetails.title} is complete. Hours: ${hoursTracked}. Pay: $${payResult.pay_amount.toFixed(2)}.`)
      } catch (e) { console.error('[worker/checkout] SMS failed:', e.message) }
    }

    return res.status(200).json({ success: true, action: 'check_out', time: now, hours_tracked: hoursTracked, pay_amount: payResult.pay_amount })
  }

  return res.status(405).json({ error: 'Method not allowed' })
}

// ─── PIN AUTHENTICATION ──────────────────────────────────────────────────────

// Set up a new PIN (first time only, or after admin reset)
async function handlePinSetup(req, res, supabase) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { phone, pin } = req.body
  if (!phone || !pin) return res.status(400).json({ error: 'phone and pin required' })
  if (!/^\d{4}$/.test(pin)) return res.status(400).json({ error: 'PIN must be exactly 4 digits' })

  const worker = await findByPhone(supabase, phone, 'id, pin_hash')
  if (!worker) return res.status(404).json({ error: 'Worker not found' })
  if (worker.pin_hash) return res.status(400).json({ error: 'PIN already set. Contact admin to reset.' })

  const { error } = await supabase
    .from('applicants')
    .update({ pin_hash: hashPin(pin), pin_attempts: 0, pin_locked_until: null })
    .eq('id', worker.id)

  if (error) return res.status(500).json({ error: 'Failed to set PIN' })

  const token = createSession(worker.id)
  return res.status(200).json({ success: true, session: token })
}

// Verify PIN and return session token
async function handlePinVerify(req, res, supabase) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { phone, pin } = req.body
  if (!phone || !pin) return res.status(400).json({ error: 'phone and pin required' })

  const worker = await findByPhone(supabase, phone, 'id, pin_hash, pin_attempts, pin_locked_until')
  if (!worker) return res.status(404).json({ error: 'Worker not found' })

  // Check if PIN is set
  if (!worker.pin_hash) return res.status(200).json({ needs_setup: true })

  // Check lockout
  if (isLocked(worker)) {
    return res.status(429).json({ error: `Too many attempts. Try again in ${LOCKOUT_MINUTES} minutes.` })
  }

  // Verify PIN
  if (!verifyPin(pin, worker.pin_hash)) {
    const attempts = (worker.pin_attempts || 0) + 1
    const update = { pin_attempts: attempts }
    if (attempts >= MAX_ATTEMPTS) {
      update.pin_locked_until = new Date(Date.now() + LOCKOUT_MINUTES * 60 * 1000).toISOString()
    }
    await supabase.from('applicants').update(update).eq('id', worker.id)

    const remaining = MAX_ATTEMPTS - attempts
    if (remaining <= 0) {
      return res.status(429).json({ error: `Too many attempts. Account locked for ${LOCKOUT_MINUTES} minutes.` })
    }
    return res.status(401).json({ error: `Incorrect PIN. ${remaining} attempt${remaining > 1 ? 's' : ''} remaining.` })
  }

  // Success — reset attempts and return session
  await supabase.from('applicants').update({ pin_attempts: 0, pin_locked_until: null }).eq('id', worker.id)
  const token = createSession(worker.id)
  return res.status(200).json({ success: true, session: token })
}

// Verify an existing session token
async function handleSessionCheck(req, res, supabase) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { session, phone } = req.body
  if (!session || !phone) return res.status(400).json({ error: 'session and phone required' })

  const workerId = verifySession(session)
  if (!workerId) return res.status(401).json({ valid: false })

  // Confirm the session matches the phone
  const worker = await findByPhone(supabase, phone, 'id')
  if (!worker || worker.id !== workerId) return res.status(401).json({ valid: false })

  return res.status(200).json({ valid: true })
}

// Request PIN reset (sends email with reset token)
async function handlePinResetRequest(req, res, supabase) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { phone } = req.body
  if (!phone) return res.status(400).json({ error: 'phone required' })

  const worker = await findByPhone(supabase, phone, 'id, email, first_name')
  if (!worker) return res.status(404).json({ error: 'Worker not found' })
  if (!worker.email) return res.status(400).json({ error: 'No email on file. Contact admin to reset your PIN.' })

  // Generate a 6-digit reset code, store as pin_hash temporarily with a prefix
  const resetCode = String(Math.floor(100000 + Math.random() * 900000))
  const resetHash = 'RESET:' + hashPin(resetCode) + ':' + Date.now()

  await supabase.from('applicants').update({
    pin_locked_until: new Date(Date.now() + 30 * 60 * 1000).toISOString(), // 30 min expiry
  }).eq('id', worker.id)

  // Store reset code temporarily
  await supabase.from('applicants').update({
    pin_attempts: 0,
  }).eq('id', worker.id)

  // Send reset email
  try {
    await sendEmail({
      to: worker.email,
      subject: 'V&A Hire — PIN Reset Code',
      html: `
        <div style="background:#0a0a0a;padding:32px;font-family:sans-serif;color:#ccc">
          <h2 style="color:#fff;margin:0 0 16px">PIN Reset</h2>
          <p>Hey ${worker.first_name || 'there'},</p>
          <p>Your PIN reset code is:</p>
          <div style="background:#1a1a1a;border:1px solid #2a2a2a;border-radius:8px;padding:20px;text-align:center;margin:16px 0">
            <span style="font-size:32px;font-weight:bold;color:#fff;letter-spacing:8px">${resetCode}</span>
          </div>
          <p>This code expires in 30 minutes.</p>
          <p style="color:#666;font-size:12px;margin-top:24px">V&A Hire • vandahire.com</p>
        </div>`,
    })
  } catch (err) {
    console.error('[pin-reset] Email error:', err)
    return res.status(500).json({ error: 'Failed to send reset email' })
  }

  // Store the reset code hash in a way we can verify it
  // We'll use a special field - store as base64 in pin_locked_until comment
  await supabase.from('applicants').update({
    pin_hash: resetHash,
    pin_attempts: 0,
  }).eq('id', worker.id)

  return res.status(200).json({ success: true, message: 'Reset code sent to your email.' })
}

// Complete PIN reset with code + new PIN
async function handlePinReset(req, res, supabase) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { phone, code, new_pin } = req.body
  if (!phone || !code || !new_pin) return res.status(400).json({ error: 'phone, code, and new_pin required' })
  if (!/^\d{4}$/.test(new_pin)) return res.status(400).json({ error: 'PIN must be exactly 4 digits' })

  const worker = await findByPhone(supabase, phone, 'id, pin_hash')
  if (!worker) return res.status(404).json({ error: 'Worker not found' })

  // Verify the reset code
  if (!worker.pin_hash || !worker.pin_hash.startsWith('RESET:')) {
    return res.status(400).json({ error: 'No reset in progress. Request a new code.' })
  }

  const parts = worker.pin_hash.split(':')
  const storedHash = parts[1]
  const timestamp = parseInt(parts[2])

  // Check expiry (30 min)
  if (Date.now() - timestamp > 30 * 60 * 1000) {
    return res.status(400).json({ error: 'Reset code expired. Request a new one.' })
  }

  // Verify code
  if (hashPin(code) !== storedHash) {
    return res.status(401).json({ error: 'Invalid reset code.' })
  }

  // Set new PIN
  const { error } = await supabase.from('applicants').update({
    pin_hash: hashPin(new_pin),
    pin_attempts: 0,
    pin_locked_until: null,
  }).eq('id', worker.id)

  if (error) return res.status(500).json({ error: 'Failed to set new PIN' })

  const token = createSession(worker.id)
  return res.status(200).json({ success: true, session: token })
}

// ─── RESPOND TO INVITE (accept / decline) ────────────────────────────────────

async function handleRespondInvite(req, res, supabase) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { phone, assignment_id, response } = req.body
  if (!phone || !assignment_id || !['accept', 'decline'].includes(response)) {
    return res.status(400).json({ error: 'phone, assignment_id, and response (accept/decline) required' })
  }

  const worker = await findByPhone(supabase, phone, 'id')
  if (!worker) return res.status(404).json({ error: 'Worker not found' })

  // Verify the assignment belongs to this worker and is in invited status
  const { data: assignment, error: aErr } = await supabase
    .from('assignments')
    .select('id, status, event_id')
    .eq('id', assignment_id)
    .eq('worker_id', worker.id)
    .single()

  if (aErr || !assignment) return res.status(404).json({ error: 'Assignment not found' })
  if (assignment.status !== 'invited') return res.status(400).json({ error: `Cannot respond — shift is already ${assignment.status}` })

  const newStatus = response === 'accept' ? 'confirmed' : 'declined'

  const { error: updateErr } = await supabase
    .from('assignments')
    .update({ status: newStatus, updated_at: new Date().toISOString() })
    .eq('id', assignment_id)

  if (updateErr) return res.status(500).json({ error: 'Failed to update assignment' })

  return res.status(200).json({ success: true, status: newStatus })
}

// ─── INCIDENTS ────────────────────────────────────────────────────────────────

async function handleIncidents(req, res, supabase) {
  if (req.method === 'GET') {
    const { event_id } = req.query
    if (!event_id) return res.status(400).json({ error: 'event_id required' })

    const { data, error } = await supabase
      .from('incident_log')
      .select('id, created_at, incident_type, description, resolved, reporter_id, applicants ( first_name, last_name )')
      .eq('event_id', event_id)
      .order('created_at', { ascending: false })

    if (error) return res.status(500).json({ error: 'Failed to load incidents' })
    return res.status(200).json(data || [])
  }

  if (req.method === 'POST') {
    const { phone, event_id, incident_type, description } = req.body
    if (!phone || !event_id || !incident_type || !description) {
      return res.status(400).json({ error: 'phone, event_id, incident_type, description required' })
    }

    const worker = await findByPhone(supabase, phone, 'id')
    if (!worker) return res.status(404).json({ error: 'Worker not found' })

    const { data: assignment, error: aErr } = await supabase
      .from('assignments')
      .select('id, is_supervisor')
      .eq('worker_id', worker.id)
      .eq('event_id', event_id)
      .eq('is_supervisor', true)
      .single()

    if (aErr || !assignment) {
      return res.status(403).json({ error: 'Only the event supervisor can log incidents' })
    }

    const validTypes = ['worker_issue', 'client_request', 'venue_issue', 'no_show', 'early_departure', 'other']
    if (!validTypes.includes(incident_type)) {
      return res.status(400).json({ error: `Invalid incident_type. Must be one of: ${validTypes.join(', ')}` })
    }

    const { data, error } = await supabase
      .from('incident_log')
      .insert({
        event_id,
        reporter_id: worker.id,
        incident_type,
        description,
      })
      .select()
      .single()

    if (error) return res.status(500).json({ error: 'Failed to log incident' })

    // Auto-escalate: email admin + organizer
    try {
      const adminEmail = process.env.ADMIN_EMAIL || 'crew@vandahire.com'

      // Get event details + organizer email
      const { data: eventData } = await supabase
        .from('events')
        .select('title, contact_email, contact_name')
        .eq('id', event_id)
        .single()

      // Get reporter name
      const { data: reporter } = await supabase
        .from('applicants')
        .select('first_name, last_name')
        .eq('id', worker.id)
        .single()

      const reporterName = reporter ? `${reporter.first_name} ${reporter.last_name}`.trim() : 'Unknown'
      const eventTitle = eventData?.title || 'Unknown Event'
      const typeLabel = incident_type.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())

      const incidentHtml = `
        <div style="font-family:system-ui,sans-serif;max-width:600px;margin:0 auto;padding:32px;background:#0a0a0a;color:#fff;">
          <h2 style="color:#ff4444;">Incident Report</h2>
          <table style="width:100%;font-size:14px;margin:16px 0;">
            <tr><td style="color:#888;padding:8px 0;">Event</td><td style="color:#fff;font-weight:bold;">${eventTitle}</td></tr>
            <tr><td style="color:#888;padding:8px 0;">Type</td><td style="color:#fff;">${typeLabel}</td></tr>
            <tr><td style="color:#888;padding:8px 0;">Reported by</td><td style="color:#fff;">${reporterName} (Supervisor)</td></tr>
            <tr><td style="color:#888;padding:8px 0;">Description</td><td style="color:#ccc;">${description}</td></tr>
            <tr><td style="color:#888;padding:8px 0;">Time</td><td style="color:#ccc;">${new Date().toLocaleString('en-US', { timeZone: 'America/New_York' })}</td></tr>
          </table>
          <p style="color:#444;font-size:11px;margin-top:24px;">V&A Hire • Automated Incident Alert</p>
        </div>`

      // Email admin
      await sendEmail({
        to: adminEmail,
        subject: `Incident: ${typeLabel} — ${eventTitle}`,
        html: incidentHtml,
      })

      // Email organizer if available
      if (eventData?.contact_email) {
        await sendEmail({
          to: eventData.contact_email,
          subject: `Incident Report — ${eventTitle}`,
          html: incidentHtml,
        })
      }
    } catch (escalationErr) {
      console.error('[incidents] Escalation email failed:', escalationErr.message)
    }

    return res.status(200).json(data)
  }

  return res.status(405).json({ error: 'Method not allowed' })
}

// ─── RELEASE & REPLACE (supervisor-initiated) ────────────────────────────────

async function handleRelease(req, res, supabase) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { phone, event_id, assignment_id, release_reason } = req.body
  if (!phone || !event_id || !assignment_id || !release_reason) {
    return res.status(400).json({ error: 'phone, event_id, assignment_id, release_reason required' })
  }

  // 1. Verify the caller is the event supervisor
  const supervisor = await findByPhone(supabase, phone, 'id')
  if (!supervisor) return res.status(404).json({ error: 'Supervisor not found' })

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
  const { data: workerData } = await supabase.from('applicants').select('strikes').eq('id', releasedWorker.id).single()
  await supabase.from('applicants').update({ strikes: (workerData?.strikes || 0) + 1 }).eq('id', releasedWorker.id)

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
    // 5. Update bench assignment to called_in
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

    // 6. Send SMS to the bench worker
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

// ─── EXIT REPLY (worker responds to geofence exit text) ──────────────────────

async function handleExitReply(req, res, supabase) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { phone, event_id, reply } = req.body
  if (!phone || !event_id || !reply) {
    return res.status(400).json({ error: 'phone, event_id, reply required' })
  }

  const validReplies = ['break', 'done', 'emergency']
  if (!validReplies.includes(reply)) {
    return res.status(400).json({ error: `reply must be one of: ${validReplies.join(', ')}` })
  }

  const digits = phone.replace(/\D/g, '').slice(-10)

  // Find worker
  const worker = await findByPhone(supabase, phone, 'id')
  if (!worker) return res.status(404).json({ error: 'Worker not found' })

  // Find the open exit_record for this worker/event
  const { data: exitRecord, error: exErr } = await supabase
    .from('exit_records')
    .select('id, hours_worked, scheduled_hours, pay_rate, assignment_id')
    .eq('event_id', event_id)
    .eq('worker_id', worker.id)
    .is('worker_reply', null)
    .order('created_at', { ascending: false })
    .limit(1)
    .single()

  if (exErr || !exitRecord) {
    return res.status(404).json({ error: 'No pending exit record found' })
  }

  // Map reply to exit_reason
  const exitReasonMap = { break: 'break_return', done: 'done', emergency: 'emergency' }
  const exitReason = exitReasonMap[reply]

  // Recalculate pay with the new exit reason
  const payResult = calculatePay({
    exit_reason: exitReason,
    hours_worked: exitRecord.hours_worked,
    pay_rate: exitRecord.pay_rate,
    scheduled_hours: exitRecord.scheduled_hours,
  })

  // Update exit_record
  await supabase.from('exit_records').update({
    worker_reply: reply,
    worker_reply_at: new Date().toISOString(),
    exit_reason: exitReason,
    pay_amount: payResult.pay_amount,
    strikes_applied: payResult.strikes,
  }).eq('id', exitRecord.id)

  // Update assignment payout
  if (exitRecord.assignment_id) {
    await supabase.from('assignments').update({
      payout_amount: payResult.pay_amount,
      updated_at: new Date().toISOString(),
    }).eq('id', exitRecord.assignment_id)
  }

  // Apply strikes
  if (payResult.strikes > 0) {
    const { data: workerData } = await supabase.from('applicants').select('strikes').eq('id', worker.id).single()
    await supabase.from('applicants').update({
      strikes: (workerData?.strikes || 0) + payResult.strikes,
    }).eq('id', worker.id)
  }

  return res.status(200).json({
    success: true,
    exit_reason: exitReason,
    pay_amount: payResult.pay_amount,
    strikes: payResult.strikes,
  })
}

// ─── VIDEO VERIFICATION ────────────────────────────────────────────────────

async function handleVerifyVideo(req, res, supabase) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { phone, video_base64, mime_type } = req.body || {}
  if (!phone || !video_base64) return res.status(400).json({ error: 'phone and video_base64 required' })

  const digits = phone.replace(/\D/g, '').slice(-10)
  const { data: allWorkers, error: wErr } = await supabase
    .from('applicants')
    .select('id, first_name, email, phone, status')
  const worker = (allWorkers || []).find(w => w.phone && w.phone.replace(/\D/g, '').slice(-10) === digits) || null
  if (wErr || !worker) return res.status(404).json({ error: 'Worker not found' })

  // Upload video to Supabase Storage. iOS Safari records MP4, everything
  // else records WebM — pick the extension off the mime type the client sent.
  const videoBuffer = Buffer.from(video_base64, 'base64')
  const contentType = (mime_type || '').startsWith('video/mp4') ? 'video/mp4' : 'video/webm'
  const ext = contentType === 'video/mp4' ? 'mp4' : 'webm'
  const bucketName = 'applicant-photos'
  const fileName = `verification-videos/${worker.id}_${Date.now()}.${ext}`

  // Ensure bucket exists (create if missing)
  const { data: buckets } = await supabase.storage.listBuckets()
  if (!(buckets || []).find(b => b.name === bucketName)) {
    const { error: createErr } = await supabase.storage.createBucket(bucketName, { public: true })
    if (createErr) {
      console.error('[verify-video] Create bucket error:', createErr)
      return res.status(500).json({ error: 'Failed to create storage bucket' })
    }
  }

  const { error: uploadErr } = await supabase.storage
    .from(bucketName)
    .upload(fileName, videoBuffer, { contentType, upsert: true })

  if (uploadErr) {
    console.error('[verify-video] Upload error:', uploadErr)
    return res.status(500).json({ error: `Storage upload failed: ${uploadErr.message || 'unknown'}` })
  }

  const { data: urlData } = supabase.storage.from(bucketName).getPublicUrl(fileName)
  const finalVideoUrl = urlData.publicUrl

  // Update applicant with video URL
  await supabase.from('applicants').update({
    video_url: finalVideoUrl,
    video_submitted_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }).eq('id', worker.id)

  // Send onboarding follow-up email with remaining steps
  if (worker.email) {
    const { sendEmail } = await import('../_lib/email.js')
    try {
      // Check what's already completed
      const { data: fullWorker } = await supabase
        .from('applicants')
        .select('id_photo_url, w9_signed_at, bg_check_signed_at, bg_check_cleared')
        .eq('id', worker.id)
        .single()

      const hasId = !!fullWorker?.id_photo_url
      const hasW9 = !!fullWorker?.w9_signed_at
      const bgCleared = !!fullWorker?.bg_check_cleared
      const bgSent = !!fullWorker?.bg_check_signed_at
      const phoneDigits = phone.replace(/\D/g, '').slice(-10)

      const bgStepHtml = bgCleared
        ? `<div style="margin-bottom:8px;padding:12px 16px;background:#f0fdf4;border-radius:8px;color:#166534">✅ Background Check — Cleared</div>`
        : bgSent
        ? `<div style="margin-bottom:8px;padding:12px 16px;background:#fef3c7;border-radius:8px;color:#92400e">⏳ Background Check — Consent Sent, <a href="https://buy.stripe.com/9B65kEdmj7DV1dAdElefC00" style="color:#92400e;font-weight:600">Complete Payment →</a></div>`
        : `<div style="margin-bottom:8px;padding:12px 16px;background:#fef3c7;border-radius:8px;color:#92400e">⬜ Background Check — <a href="https://vandahire.com/bg-check/${phoneDigits}" style="color:#92400e;font-weight:600">Complete Now →</a></div>`

      const stepsHtml = `
        <div style="margin:20px 0">
          <p style="font-weight:600;margin-bottom:12px">Your onboarding checklist:</p>
          <div style="margin-bottom:8px;padding:12px 16px;background:#f0fdf4;border-radius:8px;color:#166534">
            ✅ Verification Video — Complete
          </div>
          <div style="margin-bottom:8px;padding:12px 16px;background:${hasId ? '#f0fdf4;color:#166534' : '#fef3c7;color:#92400e'};border-radius:8px">
            ${hasId ? '✅' : '⬜'} ID Photo Upload — ${hasId ? 'Complete' : '<a href="https://vandahire.com/id-upload/' + phoneDigits + '" style="color:#92400e;font-weight:600">Complete Now →</a>'}
          </div>
          <div style="margin-bottom:8px;padding:12px 16px;background:${hasW9 ? '#f0fdf4;color:#166534' : '#fef3c7;color:#92400e'};border-radius:8px">
            ${hasW9 ? '✅' : '⬜'} W-9 Tax Form — ${hasW9 ? 'Complete' : '<a href="https://vandahire.com/w9/' + phoneDigits + '" style="color:#92400e;font-weight:600">Complete Now →</a>'}
          </div>
          ${bgStepHtml}
        </div>`

      const allComplete = hasId && hasW9 && bgCleared
      const incompleteMsg = allComplete
        ? `<p style="color:#166534;font-weight:600">All steps complete! You're ready to be assigned to shifts.</p>`
        : `<p style="color:#92400e;font-weight:600">⚠️ You cannot be assigned to shifts until all 4 steps are completed.</p>
           <p style="color:#666">Please complete the remaining steps as soon as possible so we can get you on the schedule.</p>`

      await sendEmail({
        to: worker.email,
        subject: allComplete ? 'Onboarding Complete — V&A Hire' : 'Action Required: Complete Your Onboarding — V&A Hire',
        html: `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px">
          <h2 style="margin-bottom:4px">Video Received!</h2>
          <p>Hi ${worker.first_name},</p>
          <p>We've received your verification video. Our team will review it shortly.</p>
          ${stepsHtml}
          ${incompleteMsg}
          <p style="color:#888;font-size:12px;margin-top:30px">V&A Hire Staffing • vandahire.com</p>
        </div>`,
      })
    } catch (e) { console.error('[verify-video] Email failed:', e.message) }
  }

  return res.status(200).json({ success: true, video_url: finalVideoUrl })
}

// ─── GEOFENCE BACKGROUND CHECK ──────────────────────────────────────────────
// Mobile app calls this periodically to detect if worker left the venue

async function handleGeofenceCheck(req, res, supabase) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { phone, latitude, longitude, accuracy } = req.body
  if (!phone || !latitude || !longitude) return res.status(400).json({ error: 'phone, latitude, longitude required' })

  const digits = phone.replace(/\D/g, '').slice(-10)
  const worker = await findByPhone(supabase, phone, 'id, first_name, phone')
  if (!worker) return res.status(404).json({ error: 'Worker not found' })

  // Find active checked-in assignment
  const { data: assignment } = await supabase
    .from('assignments')
    .select('id, event_id, check_in_time, events ( id, title, location, latitude, longitude, geofence_radius_meters, geofence_active, start_time, end_time, event_date, pay_rate )')
    .eq('worker_id', worker.id)
    .eq('status', 'checked_in')
    .limit(1)
    .single()

  if (!assignment) return res.status(200).json({ status: 'no_active_shift' })

  // Store the latest ping so the coordinator's live geofence view has data.
  await supabase.from('assignments').update({
    last_ping_lat: latitude, last_ping_lng: longitude, last_ping_at: new Date().toISOString(),
  }).eq('id', assignment.id)

  const event = assignment.events
  if (!event?.geofence_active || !event?.latitude || !event?.longitude) return res.status(200).json({ status: 'no_geofence' })

  // Tolerate GPS accuracy: only treat as "outside" when the reported point is
  // beyond the radius even after subtracting its accuracy margin. This stops a
  // worker standing at the venue from being flagged due to GPS drift.
  const radius = parseFloat(event.geofence_radius_meters) || 200
  const acc = Math.min(parseFloat(accuracy) || 0, 150) // cap so a wild accuracy value can't disable exits
  const { distance } = isWithinGeofence(
    parseFloat(latitude), parseFloat(longitude),
    parseFloat(event.latitude), parseFloat(event.longitude),
    radius
  )
  const inside = distance <= radius + acc

  if (inside) {
    // Re-entry detection: stamp any open exit (left, not yet returned). The
    // update returns the rows it changed, so we only email on the actual
    // outside→inside transition — immediately, no cron.
    const { data: reentered } = await supabase.from('exit_records')
      .update({ reentered_at: new Date().toISOString() })
      .eq('assignment_id', assignment.id)
      .is('reentered_at', null)
      .select('id')
    if (reentered && reentered.length > 0) {
      const { sendEmail } = await import('../_lib/email.js')
      const opsEmail = process.env.GEOFENCE_ALERT_EMAIL || 'info@vassoc.com'
      const { data: we } = await supabase.from('applicants').select('email').eq('id', worker.id).single()
      if (we?.email) {
        try {
          await sendEmail({ to: we.email, subject: `Welcome back — ${event.title}`, branded: true,
            html: `<p>Hi ${worker.first_name || 'there'}, thanks for returning to ${event.title}${event.location ? ` at ${event.location}` : ''}. You're back inside the venue area — all good. Check out from <a href="https://vandahire.com/my-shifts">My Shifts</a> when your shift ends.</p>` })
        } catch (e) { console.error('[geofence-check] re-entry worker email failed:', e.message) }
      }
      try {
        await sendEmail({ to: opsEmail, subject: `Returned: ${worker.first_name} back at ${event.title}`, branded: true,
          html: `<p><strong>${worker.first_name}</strong> (${worker.phone || ''}) re-entered the geofence for <strong>${event.title}</strong>${event.location ? ` (${event.location})` : ''} and is back inside the venue area.</p>` })
      } catch (e) { console.error('[geofence-check] re-entry ops email failed:', e.message) }
    }
    return res.status(200).json({ status: 'inside_geofence' })
  }

  // Worker is outside geofence — check how many exit records exist (for escalation)
  const { data: exitRecords } = await supabase
    .from('exit_records')
    .select('id, worker_reply')
    .eq('assignment_id', assignment.id)
    .order('created_at', { ascending: false })

  const openExit = (exitRecords || []).find(e => !e.worker_reply)
  if (openExit) return res.status(200).json({ status: 'exit_already_recorded', exit_record_id: openExit.id })

  const warningCount = (exitRecords || []).length // previous exits = warnings issued

  // Create exit record
  const now = new Date()
  const checkInTime = assignment.check_in_time ? new Date(assignment.check_in_time) : now
  const hoursWorked = Math.round(((now - checkInTime) / 3600000) * 100) / 100

  let scheduledHours = 8
  if (event.start_time && event.end_time) {
    const [sh, sm] = event.start_time.split(':').map(Number)
    const [eh, em] = event.end_time.split(':').map(Number)
    scheduledHours = (eh + em / 60) - (sh + sm / 60)
    if (scheduledHours <= 0) scheduledHours += 24
  }

  const payRate = parseFloat(event.pay_rate?.replace(/[^0-9.]/g, '')) || 0

  const { data: exitRecord } = await supabase.from('exit_records').insert({
    event_id: event.id,
    worker_id: worker.id,
    assignment_id: assignment.id,
    exit_reason: 'no_response',
    hours_worked: hoursWorked,
    scheduled_hours: scheduledHours,
    pay_rate: payRate,
    exit_lat: latitude,
    exit_lng: longitude,
  }).select('id').single()

  // Send push notification to worker
  try {
    await sendPushToWorker(
      supabase, worker.id,
      warningCount === 0 ? 'Geofence Warning' : 'Final Warning — Return Now',
      warningCount === 0
        ? `You've left the ${event.title} venue. Please return to the event area.`
        : `This is your final warning. You are outside the event area for ${event.title}. Return immediately or your supervisor will be notified.`,
      '/my-shifts',
      'geofence-warning'
    )
  } catch (e) { console.error('[geofence-check] Push failed:', e.message) }

  const { sendEmail } = await import('../_lib/email.js')

  // Alert ops inbox (info@vassoc.com) that a worker left the geofence.
  const opsEmail = process.env.GEOFENCE_ALERT_EMAIL || 'info@vassoc.com'
  try {
    const dist = isWithinGeofence(parseFloat(latitude), parseFloat(longitude), parseFloat(event.latitude), parseFloat(event.longitude), parseFloat(event.geofence_radius_meters) || 150).distance
    const mapsLink = `https://maps.google.com/?q=${latitude},${longitude}`
    await sendEmail({
      to: opsEmail,
      subject: `Geofence exit: ${worker.first_name} left ${event.title}`,
      branded: true,
      html: `<h2 style="margin:0 0 12px">Worker left the geofence</h2>
        <p style="margin:0 0 12px"><strong>${worker.first_name}</strong> (${worker.phone || ''}) is outside the venue area for <strong>${event.title}</strong>.</p>
        <table style="font-size:14px;line-height:1.7">
          <tr><td style="color:#888;padding-right:16px">Event</td><td>${event.title} — ${event.location || ''}</td></tr>
          <tr><td style="color:#888;padding-right:16px">Distance from venue</td><td>${dist} m (radius ${event.geofence_radius_meters || 150} m)</td></tr>
          <tr><td style="color:#888;padding-right:16px">Worker location</td><td><a href="${mapsLink}">${latitude}, ${longitude}</a></td></tr>
          <tr><td style="color:#888;padding-right:16px">Warning #</td><td>${warningCount + 1}</td></tr>
          <tr><td style="color:#888;padding-right:16px">Time</td><td>${now.toLocaleString('en-US', { timeZone: 'America/New_York' })} ET</td></tr>
        </table>`,
    })
  } catch (e) { console.error('[geofence-check] Ops alert email failed:', e.message) }

  // Send email to worker
  const { data: workerEmail } = await supabase.from('applicants').select('email').eq('id', worker.id).single()
  if (workerEmail?.email) {
    try {
      await sendEmail({
        to: workerEmail.email,
        subject: warningCount === 0 ? `Warning: You've left the venue — ${event.title}` : `FINAL WARNING: Return to venue — ${event.title}`,
        html: `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px">
          <h2>${warningCount === 0 ? 'Geofence Warning' : '⚠️ Final Warning'} — ${event.title}</h2>
          <p>Hi ${worker.first_name},</p>
          <p>It looks like you've left the event venue at ${event.location}. Let us know what's going on:</p>
          <table role="presentation" cellspacing="0" cellpadding="0" style="margin:16px 0"><tr>
            <td style="padding-right:10px"><a href="https://vandahire.com/api/worker?route=geofence-reply&id=${exitRecord?.id}&reply=break" style="background:#1e1e1e;color:#fff;border:1px solid #444;padding:12px 22px;border-radius:8px;text-decoration:none;font-weight:600;display:inline-block">I'm on a break</a></td>
            <td><a href="https://vandahire.com/api/worker?route=geofence-reply&id=${exitRecord?.id}&reply=returning" style="background:#ffffff;color:#000;padding:12px 22px;border-radius:8px;text-decoration:none;font-weight:600;display:inline-block">I'm heading back now</a></td>
          </tr></table>
          ${warningCount > 0 ? '<p style="color:#ef4444;font-weight:600">This is your final warning. Your supervisor has been notified. Please return to the venue.</p>' : ''}
          <p style="color:#888;font-size:12px">When you return, we'll confirm you're back. V&A Hire Staffing • vandahire.com</p>
        </div>`,
      })
    } catch (e) { console.error('[geofence-check] Email failed:', e.message) }
  }

  // After first warning (warningCount >= 1), escalate to supervisor
  if (warningCount >= 1) {
    // Find supervisor for this event
    const { data: supAssignment } = await supabase
      .from('assignments')
      .select('worker_id, applicants ( id, first_name, email, phone )')
      .eq('event_id', event.id)
      .eq('is_supervisor', true)
      .in('status', ['confirmed', 'checked_in'])
      .limit(1)
      .single()

    if (supAssignment?.applicants) {
      const sup = supAssignment.applicants

      // Push notification to supervisor
      try {
        const { sendPushToWorker } = await import('../_lib/push.js')
        await sendPushToWorker(
          supabase, sup.id,
          'Crew Alert: Worker Left Venue',
          `${worker.first_name} has left the geofence for ${event.title} after multiple warnings. Action needed.`,
          '/supervisor',
          'supervisor-alert'
        )
      } catch (e) { console.error('[geofence-check] Supervisor push failed:', e.message) }

      // Email supervisor
      if (sup.email) {
        try {
          await sendEmail({
            to: sup.email,
            subject: `🚨 Crew Alert: ${worker.first_name} left venue — ${event.title}`,
            html: `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px">
              <h2 style="color:#ef4444">Crew Member Left Venue</h2>
              <p>Hi ${sup.first_name},</p>
              <p><strong>${worker.first_name}</strong> has left the geofence for <strong>${event.title}</strong> after receiving ${warningCount + 1} warning(s).</p>
              <p>Worker phone: <a href="tel:${worker.phone}">${worker.phone}</a></p>
              <p>Hours worked so far: ${hoursWorked}h</p>
              <p>Please take action — you can call the worker or release them from the Supervisor Portal.</p>
              <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin:12px 0"><tr><td style="background:#ffffff;border-radius:8px"><a href="https://vandahire.com/supervisor" target="_blank" style="background:#ffffff;color:#000000;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600;display:inline-block">Open Supervisor Portal</a></td></tr></table>
              <p style="color:#888;font-size:12px;margin-top:24px">V&A Hire • Auto-Alert</p>
            </div>`,
          })
        } catch (e) { console.error('[geofence-check] Supervisor email failed:', e.message) }
      }

      // SMS to supervisor
      try {
        await sendSms(sup.phone, `🚨 V&A Hire Alert: ${worker.first_name} has left the venue for ${event.title} after ${warningCount + 1} warnings. Call them: ${worker.phone}`)
      } catch (e) { console.error('[geofence-check] Supervisor SMS failed:', e.message) }
    }
  }

  return res.status(200).json({
    status: 'outside_geofence',
    exit_record_id: exitRecord?.id,
    warning_number: warningCount + 1,
    escalated_to_supervisor: warningCount >= 1,
    message: warningCount >= 1
      ? 'Final warning issued. Supervisor has been notified.'
      : 'First warning issued. Please return to the venue.',
  })
}

// ─── ACCEPT QUOTE & PAY DEPOSIT (public — organizer facing) ─────────────────

async function handleAcceptQuote(req, res, supabase) {
  // GET — fetch event + quote for organizer portal (by event_id or token)
  if (req.method === 'GET') {
    const { event_id, token, email } = req.query
    if (!event_id && !token) return res.status(400).json({ error: 'event_id or token required' })

    const selectFields = 'id, title, event_date, start_time, end_time, location, city, workers_needed, status, deposit_amount, balance_amount, total_bill_amount, deposit_status, payment_status, balance_due_date, agreement_accepted_at, deposit_checkout_url, stripe_payment_url, contact_email, organizer_token'

    let event
    if (token) {
      const { data } = await supabase.from('events').select(selectFields).eq('organizer_token', token).single()
      event = data
    } else {
      const { data } = await supabase.from('events').select(selectFields).eq('id', event_id).single()
      event = data
    }
    if (!event) return res.status(404).json({ error: 'Event not found' })

    // Verify email matches (basic security — only when email is provided)
    if (email && event.contact_email && email.toLowerCase() !== event.contact_email.toLowerCase()) {
      return res.status(403).json({ error: 'Email does not match event record' })
    }

    return res.status(200).json(event)
  }

  // POST — accept agreement + create Stripe deposit checkout
  if (req.method === 'POST') {
    const { event_id, signer_name, signer_email } = req.body
    if (!event_id || !signer_name) return res.status(400).json({ error: 'event_id and signer_name required' })

    const { data: event } = await supabase.from('events')
      .select('id, title, event_date, deposit_amount, deposit_status, contact_email, agreement_accepted_at, organizer_token')
      .eq('id', event_id).single()
    if (!event) return res.status(404).json({ error: 'Event not found' })

    const depositAmount = parseFloat(event.deposit_amount) || 0
    if (depositAmount <= 0) return res.status(400).json({ error: 'No deposit amount set' })
    if (event.deposit_status === 'paid') return res.status(400).json({ error: 'Deposit already paid' })

    // Record agreement acceptance
    const clientIp = req.headers['x-forwarded-for'] || req.headers['x-real-ip'] || 'unknown'
    await supabase.from('events').update({
      agreement_accepted_at: new Date().toISOString(),
      agreement_ip: typeof clientIp === 'string' ? clientIp.split(',')[0].trim() : 'unknown',
      agreement_name: signer_name,
      updated_at: new Date().toISOString(),
    }).eq('id', event_id)

    // Create Stripe checkout session for deposit
    const Stripe = (await import('stripe')).default
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY)
    const appUrl = process.env.VITE_APP_URL || 'https://vandahire.com'

    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      payment_method_types: ['card'],
      customer_email: signer_email || event.contact_email,
      line_items: [{
        price_data: {
          currency: 'usd',
          unit_amount: Math.round(depositAmount * 100),
          product_data: {
            name: `Deposit — ${event.title}`,
            description: `Staffing deposit for ${event.title} on ${event.event_date}. Balance due Net 15 after event.`,
          },
        },
        quantity: 1,
      }],
      metadata: { event_id: event.id, event_title: event.title, payment_type: 'deposit' },
      payment_intent_data: {
        setup_future_usage: 'off_session', // Save card for future Net 15 charge
      },
      success_url: event.organizer_token
        ? `${appUrl}/pay/${event.organizer_token}?payment=deposit_success`
        : `${appUrl}/organizer?payment=deposit_success&event=${event.id}`,
      cancel_url: event.organizer_token
        ? `${appUrl}/pay/${event.organizer_token}?payment=cancelled`
        : `${appUrl}/organizer?payment=cancelled&event=${event.id}`,
    })

    // Store checkout URL and payment record
    await supabase.from('events').update({
      deposit_checkout_url: session.url,
      deposit_status: 'pending',
      updated_at: new Date().toISOString(),
    }).eq('id', event_id)

    await supabase.from('payments').upsert({
      event_id,
      payment_type: 'deposit',
      amount: depositAmount,
      stripe_payment_intent_id: session.payment_intent,
      stripe_checkout_url: session.url,
      status: 'pending',
    }, { onConflict: 'event_id,payment_type', ignoreDuplicates: false }).catch(() => {
      return supabase.from('payments').insert({
        event_id,
        payment_type: 'deposit',
        amount: depositAmount,
        stripe_payment_intent_id: session.payment_intent,
        stripe_checkout_url: session.url,
        status: 'pending',
      })
    })

    return res.status(200).json({ checkout_url: session.url, session_id: session.id })
  }

  return res.status(405).json({ error: 'Method not allowed' })
}

// ─── STRIPE CONNECT ONBOARDING ─────────────────────────────────────────────

async function handleConnectOnboard(req, res, supabase) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { phone } = req.body
  if (!phone) return res.status(400).json({ error: 'phone required' })

  const digits = phone.replace(/\D/g, '').slice(-10)
  const worker = await findByPhone(supabase, phone, 'id, first_name, last_name, email, stripe_connect_id')

  if (!worker) return res.status(404).json({ error: 'Worker not found' })

  const Stripe = (await import('stripe')).default
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY)
  const appUrl = process.env.VITE_APP_URL || 'https://vandahire.com'

  // If worker already has a Connect account, return onboarding link to update
  if (worker.stripe_connect_id) {
    const link = await stripe.accountLinks.create({
      account: worker.stripe_connect_id,
      refresh_url: `${appUrl}/worker/${digits}`,
      return_url: `${appUrl}/worker/${digits}?connect=success`,
      type: 'account_onboarding',
    })
    return res.status(200).json({ onboarding_url: link.url, account_id: worker.stripe_connect_id })
  }

  // Create new Connect Express account
  const account = await stripe.accounts.create({
    type: 'express',
    country: 'US',
    email: worker.email,
    capabilities: { transfers: { requested: true } },
    business_type: 'individual',
    individual: {
      first_name: worker.first_name,
      last_name: worker.last_name,
      email: worker.email,
    },
    metadata: { worker_id: worker.id },
  })

  // Save to DB
  await supabase.from('applicants').update({
    stripe_connect_id: account.id,
    updated_at: new Date().toISOString(),
  }).eq('id', worker.id)

  // Create onboarding link
  const link = await stripe.accountLinks.create({
    account: account.id,
    refresh_url: `${appUrl}/worker/${digits}`,
    return_url: `${appUrl}/worker/${digits}?connect=success`,
    type: 'account_onboarding',
  })

  return res.status(200).json({ onboarding_url: link.url, account_id: account.id })
}

// ─── STRIPE CONNECT DASHBOARD ──────────────────────────────────────────────

async function handleConnectDashboard(req, res, supabase) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { phone } = req.body
  if (!phone) return res.status(400).json({ error: 'phone required' })

  const worker = await findByPhone(supabase, phone, 'id, stripe_connect_id')
  if (!worker) return res.status(404).json({ error: 'Worker not found' })
  if (!worker.stripe_connect_id) return res.status(400).json({ error: 'No Stripe Connect account. Set up direct deposit first.' })

  const Stripe = (await import('stripe')).default
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY)

  const loginLink = await stripe.accounts.createLoginLink(worker.stripe_connect_id)
  return res.status(200).json({ dashboard_url: loginLink.url })
}

// ─── MY EARNINGS ────────────────────────────────────────────────────────────

async function handleMyEarnings(req, res, supabase) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })

  const { phone } = req.query
  if (!phone) return res.status(400).json({ error: 'phone required' })

  const worker = await findByPhone(supabase, phone, 'id, first_name, last_name, stripe_connect_id, total_earnings, shifts_completed, reliability_score')
  if (!worker) return res.status(404).json({ error: 'Worker not found' })

  // Get payouts
  const { data: payouts } = await supabase
    .from('worker_payouts')
    .select('id, created_at, hours_worked, pay_rate, gross_amount, platform_fee, net_amount, status, paid_at, events ( title, event_date )')
    .eq('worker_id', worker.id)
    .order('created_at', { ascending: false })

  // Get upcoming shifts
  const today = new Date().toISOString().slice(0, 10)
  const { data: upcoming } = await supabase
    .from('assignments')
    .select('id, status, events ( title, event_date, start_time, end_time, location, city )')
    .eq('worker_id', worker.id)
    .in('status', ['invited', 'confirmed'])
    .gte('events.event_date', today)

  // Calculate earnings summary
  const allPayouts = payouts || []
  const totalEarned = allPayouts.filter(p => p.status === 'paid').reduce((sum, p) => sum + parseFloat(p.net_amount || 0), 0)
  const totalPending = allPayouts.filter(p => p.status === 'pending' || p.status === 'approved').reduce((sum, p) => sum + parseFloat(p.net_amount || 0), 0)

  const now = new Date()
  const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10)
  const thisMonthEarned = allPayouts
    .filter(p => p.status === 'paid' && p.paid_at && p.paid_at >= thisMonthStart)
    .reduce((sum, p) => sum + parseFloat(p.net_amount || 0), 0)

  // Determine reliability tier
  const { calculateReliabilityScore } = await import('../_lib/pay.js')
  const score = parseFloat(worker.reliability_score) || 5.0
  let tier = 'probation'
  if (score >= 4.5) tier = 'gold'
  else if (score >= 3.5) tier = 'silver'
  else if (score >= 2.5) tier = 'bronze'

  return res.status(200).json({
    worker: {
      id: worker.id,
      first_name: worker.first_name,
      last_name: worker.last_name,
      has_connect: !!worker.stripe_connect_id,
      total_earnings: totalEarned,
      shifts_completed: worker.shifts_completed || 0,
      reliability_score: score,
      reliability_tier: tier,
    },
    earnings: {
      total_earned: Math.round(totalEarned * 100) / 100,
      total_pending: Math.round(totalPending * 100) / 100,
      this_month: Math.round(thisMonthEarned * 100) / 100,
    },
    payouts: allPayouts,
    upcoming: (upcoming || []).filter(a => a.events),
  })
}

// ─── CLIENT SURVEY (public, token-authenticated) ────────────────────────────

async function handleClientSurvey(req, res, supabase) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { event_id, token, rating, feedback, would_rebook } = req.body
  if (!event_id || !token) return res.status(400).json({ error: 'event_id and token required' })
  if (!rating || rating < 1 || rating > 5) return res.status(400).json({ error: 'rating must be 1-5' })

  // Verify token matches the event
  const { data: event } = await supabase
    .from('events')
    .select('id, organizer_token, client_survey_at')
    .eq('id', event_id)
    .single()

  if (!event) return res.status(404).json({ error: 'Event not found' })
  if (event.organizer_token !== token) return res.status(403).json({ error: 'Invalid token' })
  if (event.client_survey_at) return res.status(400).json({ error: 'Survey already submitted' })

  await supabase.from('events').update({
    client_rating: parseInt(rating),
    client_feedback: feedback || '',
    client_would_rebook: would_rebook != null ? !!would_rebook : null,
    client_survey_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }).eq('id', event_id)

  return res.status(200).json({ success: true })
}

// ─── MY CREW STATUS (real-time polling for organizer/supervisor) ─────────────

async function handleMyCrewStatus(req, res, supabase) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })

  const { event_id, token } = req.query
  if (!event_id) return res.status(400).json({ error: 'event_id required' })

  // Authenticate via organizer token or phone
  if (token) {
    const { data: event } = await supabase
      .from('events')
      .select('id, organizer_token')
      .eq('id', event_id)
      .single()
    if (!event || event.organizer_token !== token) return res.status(403).json({ error: 'Invalid token' })
  }

  const { data: assignments } = await supabase
    .from('assignments')
    .select('id, status, check_in_time, check_out_time, hours_tracked, is_supervisor, check_in_lat, check_in_lng, applicants ( id, first_name, last_name, phone, photo_url )')
    .eq('event_id', event_id)
    .in('status', ['confirmed', 'checked_in', 'completed'])
    .order('is_supervisor', { ascending: false })

  const { data: event } = await supabase
    .from('events')
    .select('workers_needed, latitude, longitude, geofence_radius_meters')
    .eq('id', event_id)
    .single()

  const activeCount = (assignments || []).filter(a => ['confirmed', 'checked_in'].includes(a.status)).length
  const coveragePct = event?.workers_needed > 0 ? Math.round((activeCount / event.workers_needed) * 100) : 100

  return res.status(200).json({
    assignments: assignments || [],
    coverage: {
      active: activeCount,
      needed: event?.workers_needed || 0,
      percentage: coveragePct,
    },
    geofence: {
      latitude: event?.latitude,
      longitude: event?.longitude,
      radius: event?.geofence_radius_meters || 200,
    },
  })
}

// ─── W-9 TAX FORM ────────────────────────────────────────────────────────────

function encryptTin(tin) {
  const key = Buffer.from(process.env.W9_ENCRYPTION_KEY, 'hex')
  const iv = crypto.randomBytes(12)
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv)
  let encrypted = cipher.update(tin, 'utf8', 'hex')
  encrypted += cipher.final('hex')
  const tag = cipher.getAuthTag().toString('hex')
  return `${iv.toString('hex')}:${tag}:${encrypted}`
}

function decryptTin(encrypted) {
  const key = Buffer.from(process.env.W9_ENCRYPTION_KEY, 'hex')
  const [ivHex, tagHex, encHex] = encrypted.split(':')
  const iv = Buffer.from(ivHex, 'hex')
  const tag = Buffer.from(tagHex, 'hex')
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv)
  decipher.setAuthTag(tag)
  let decrypted = decipher.update(encHex, 'hex', 'utf8')
  decrypted += decipher.final('utf8')
  return decrypted
}

// ─── ID PHOTO UPLOAD ────────────────────────────────────────────────────────

async function handleIdUpload(req, res, supabase) {
  if (req.method === 'GET') {
    const { phone } = req.query
    if (!phone) return res.status(400).json({ error: 'phone required' })

    const worker = await findByPhone(supabase, phone, 'id, first_name, id_photo_url')
    if (!worker) return res.status(404).json({ error: 'Worker not found' })

    return res.status(200).json({
      first_name: worker.first_name,
      has_id_photo: !!worker.id_photo_url,
    })
  }

  if (req.method === 'POST') {
    const { phone, photo_base64 } = req.body
    if (!phone || !photo_base64) return res.status(400).json({ error: 'phone and photo_base64 required' })

    const digits = String(phone).replace(/\D/g, '').slice(-10)
    const worker = await findByPhone(supabase, phone, 'id, first_name, email, phone, id_photo_url, video_url, w9_signed_at, bg_check_signed_at, bg_check_cleared')

    if (!worker) return res.status(404).json({ error: 'Worker not found' })

    // Upload to Supabase Storage
    try {
      // Detect content type from data URL prefix
      const mimeMatch = photo_base64.match(/^data:(image\/\w+);base64,/)
      const contentType = mimeMatch ? mimeMatch[1] : 'image/jpeg'
      const ext = contentType === 'image/png' ? 'png' : contentType === 'image/webp' ? 'webp' : 'jpg'

      const base64Data = photo_base64.replace(/^data:image\/\w+;base64,/, '')
      const buffer = Buffer.from(base64Data, 'base64')
      const bucketName = 'applicant-photos'
      const filePath = `id-photos/${worker.id}.${ext}`

      // Ensure bucket exists (handle race condition gracefully)
      const { data: buckets } = await supabase.storage.listBuckets()
      if (!(buckets || []).find(b => b.name === bucketName)) {
        try {
          await supabase.storage.createBucket(bucketName, { public: true })
        } catch (bucketErr) {
          // Another request may have created it — ignore "already exists" errors
          if (!bucketErr.message?.includes('already exists')) throw bucketErr
        }
      }

      const { error: uploadError } = await supabase.storage
        .from(bucketName)
        .upload(filePath, buffer, {
          contentType,
          upsert: true,
        })

      if (uploadError) throw uploadError

      const { data: urlData } = supabase.storage
        .from(bucketName)
        .getPublicUrl(filePath)

      const idPhotoUrl = urlData.publicUrl

      await supabase.from('applicants').update({
        id_photo_url: idPhotoUrl,
        updated_at: new Date().toISOString(),
      }).eq('id', worker.id)

      // Notify admin
      const adminEmail = process.env.ADMIN_EMAIL || 'crew@vandahire.com'
      try {
        await sendEmail({
          to: adminEmail,
          subject: `ID Uploaded: Worker ${worker.id}`,
          html: `
            <div style="font-family:system-ui,sans-serif;max-width:600px;margin:0 auto;padding:32px;background:#0a0a0a;color:#fff;">
              <h2 style="color:#ffffff;">ID Photo Uploaded</h2>
              <p style="color:#ccc;">Phone: ${digits}</p>
              <p style="color:#ccc;">Worker ID: ${worker.id}</p>
              <p style="color:#ccc;">View in admin panel to verify.</p>
              <p style="color:#444;font-size:11px;margin-top:24px;">V&A Hire • Auto-Notification</p>
            </div>`,
        })
      } catch (e) {
        console.error('[id-upload] Admin notification failed:', e.message)
      }

      // Send onboarding checklist email to worker
      if (worker.email) {
        try {
          const hasVideo = !!worker.video_url
          const hasW9 = !!worker.w9_signed_at
          const bgCleared = !!worker.bg_check_cleared
          const bgSent = !!worker.bg_check_signed_at
          const allComplete = hasVideo && hasW9 && bgCleared

          const bgStepHtml = bgCleared
            ? `<div style="margin-bottom:8px;padding:12px 16px;background:#f0fdf4;border-radius:8px;color:#166534">✅ Background Check — Cleared</div>`
            : bgSent
            ? `<div style="margin-bottom:8px;padding:12px 16px;background:#fef3c7;border-radius:8px;color:#92400e">⏳ Background Check — Consent Sent, <a href="https://buy.stripe.com/9B65kEdmj7DV1dAdElefC00" style="color:#92400e;font-weight:600">Complete Payment →</a></div>`
            : `<div style="margin-bottom:8px;padding:12px 16px;background:#fef3c7;border-radius:8px;color:#92400e">⬜ Background Check — <a href="https://vandahire.com/bg-check/${digits}" style="color:#92400e;font-weight:600">Complete Now →</a></div>`

          const stepsHtml = `
            <div style="margin:20px 0">
              <p style="font-weight:600;margin-bottom:12px">Your onboarding checklist:</p>
              <div style="margin-bottom:8px;padding:12px 16px;background:${hasVideo ? '#f0fdf4;color:#166534' : '#fef3c7;color:#92400e'};border-radius:8px">
                ${hasVideo ? '✅' : '⬜'} Verification Video — ${hasVideo ? 'Complete' : '<a href="https://vandahire.com/verify" style="color:#92400e;font-weight:600">Complete Now →</a>'}
              </div>
              <div style="margin-bottom:8px;padding:12px 16px;background:#f0fdf4;border-radius:8px;color:#166534">
                ✅ ID Photo Upload — Complete
              </div>
              <div style="margin-bottom:8px;padding:12px 16px;background:${hasW9 ? '#f0fdf4;color:#166534' : '#fef3c7;color:#92400e'};border-radius:8px">
                ${hasW9 ? '✅' : '⬜'} W-9 Tax Form — ${hasW9 ? 'Complete' : '<a href="https://vandahire.com/w9/' + digits + '" style="color:#92400e;font-weight:600">Complete Now →</a>'}
              </div>
              ${bgStepHtml}
            </div>`

          const incompleteMsg = allComplete
            ? `<p style="color:#166534;font-weight:600">All steps complete! You're ready to be assigned to shifts.</p>`
            : `<p style="color:#92400e;font-weight:600">⚠️ You cannot be assigned to shifts until all 4 steps are completed.</p>`

          await sendEmail({
            to: worker.email,
            subject: allComplete ? 'Onboarding Complete — V&A Hire' : 'Action Required: Complete Your Onboarding — V&A Hire',
            html: `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px">
              <h2>ID Photo Received!</h2>
              <p>Hi ${worker.first_name},</p>
              <p>We've received your ID photo.</p>
              ${stepsHtml}
              ${incompleteMsg}
              <p style="color:#888;font-size:12px;margin-top:30px">V&A Hire Staffing • vandahire.com</p>
            </div>`,
          })
        } catch (e) { console.error('[id-upload] Onboarding email failed:', e.message) }
      }

      return res.status(200).json({ success: true, id_photo_url: idPhotoUrl })
    } catch (err) {
      console.error('[id-upload] Upload error:', err)
      return res.status(500).json({ error: `Upload failed: ${err?.message || 'unknown error'}` })
    }
  }

  return res.status(405).json({ error: 'Method not allowed' })
}

async function handleW9(req, res, supabase) {
  // GET — check W-9 status
  if (req.method === 'GET') {
    const { phone } = req.query
    if (!phone) return res.status(400).json({ error: 'phone required' })

    const worker = await findByPhone(supabase, phone, 'id, w9_signed_at, w9_legal_name, w9_tin_last4')
    if (!worker) return res.status(404).json({ error: 'Worker not found' })

    return res.status(200).json({
      has_w9: !!worker.w9_signed_at,
      w9_signed_at: worker.w9_signed_at,
      w9_legal_name: worker.w9_legal_name,
      w9_tin_last4: worker.w9_tin_last4,
    })
  }

  // POST — submit W-9
  if (req.method === 'POST') {
    const { phone, legal_name, business_name, tax_class, address, city, state, zip, tin, certification, signature_name } = req.body

    if (!phone || !legal_name || !tax_class || !address || !city || !state || !zip || !tin || !certification || !signature_name) {
      return res.status(400).json({ error: 'All required fields must be completed' })
    }

    const tinDigits = tin.replace(/\D/g, '')
    if (tinDigits.length !== 9) return res.status(400).json({ error: 'TIN must be exactly 9 digits' })
    if (!/^\d{5}$/.test(zip)) return res.status(400).json({ error: 'ZIP must be 5 digits' })

    const digits = phone.replace(/\D/g, '').slice(-10)
    const { data: allW } = await supabase
      .from('applicants')
      .select('id, first_name, email, phone, w9_signed_at, video_url, id_photo_url, bg_check_signed_at, bg_check_cleared')
    const worker = (allW || []).find(w => w.phone && w.phone.replace(/\D/g, '').slice(-10) === digits) || null

    if (!worker) return res.status(404).json({ error: 'Worker not found' })
    if (worker.w9_signed_at) return res.status(400).json({ error: 'W-9 already on file' })

    if (!process.env.W9_ENCRYPTION_KEY) {
      console.error('[w9] W9_ENCRYPTION_KEY not configured')
      return res.status(500).json({ error: 'Server configuration error' })
    }

    const clientIp = req.headers['x-forwarded-for'] || req.headers['x-real-ip'] || 'unknown'
    const now = new Date().toISOString()

    const { error: updateErr } = await supabase.from('applicants').update({
      w9_legal_name: legal_name,
      w9_business_name: business_name || null,
      w9_tax_class: tax_class,
      w9_address: address,
      w9_city: city,
      w9_state: state,
      w9_zip: zip,
      w9_tin_encrypted: encryptTin(tinDigits),
      w9_tin_last4: tinDigits.slice(-4),
      w9_signed_at: now,
      w9_ip: typeof clientIp === 'string' ? clientIp.split(',')[0].trim() : 'unknown',
      updated_at: now,
    }).eq('id', worker.id)

    if (updateErr) {
      console.error('[w9] Update failed:', updateErr)
      return res.status(500).json({ error: 'Failed to save W-9' })
    }

    // Email W-9 details to admin
    const adminEmail = process.env.ADMIN_EMAIL || 'crew@vandahire.com'
    try {
      await sendEmail({
        to: adminEmail,
        subject: `W-9 Submitted: ${legal_name}`,
        html: `
          <div style="font-family:system-ui,sans-serif;background:#0a0a0a;color:#fff;padding:32px;">
            <h2 style="color:#ffffff;margin:0 0 20px;">New W-9 Submission</h2>
            <table style="width:100%;border-collapse:collapse;font-size:14px;">
              <tr><td style="color:#888;padding:8px 12px 8px 0;border-bottom:1px solid #1e1e1e;">Legal Name</td><td style="color:#fff;padding:8px 0;border-bottom:1px solid #1e1e1e;"><strong>${legal_name}</strong></td></tr>
              ${business_name ? `<tr><td style="color:#888;padding:8px 12px 8px 0;border-bottom:1px solid #1e1e1e;">Business Name</td><td style="color:#fff;padding:8px 0;border-bottom:1px solid #1e1e1e;">${business_name}</td></tr>` : ''}
              <tr><td style="color:#888;padding:8px 12px 8px 0;border-bottom:1px solid #1e1e1e;">Tax Classification</td><td style="color:#fff;padding:8px 0;border-bottom:1px solid #1e1e1e;">${tax_class}</td></tr>
              <tr><td style="color:#888;padding:8px 12px 8px 0;border-bottom:1px solid #1e1e1e;">Address</td><td style="color:#fff;padding:8px 0;border-bottom:1px solid #1e1e1e;">${address}, ${city}, ${state} ${zip}</td></tr>
              <tr><td style="color:#888;padding:8px 12px 8px 0;border-bottom:1px solid #1e1e1e;">TIN (last 4)</td><td style="color:#fff;padding:8px 0;border-bottom:1px solid #1e1e1e;">***-**-${tinDigits.slice(-4)}</td></tr>
              <tr><td style="color:#888;padding:8px 12px 8px 0;border-bottom:1px solid #1e1e1e;">Phone</td><td style="color:#fff;padding:8px 0;border-bottom:1px solid #1e1e1e;">${digits}</td></tr>
              <tr><td style="color:#888;padding:8px 12px 8px 0;border-bottom:1px solid #1e1e1e;">Signature</td><td style="color:#fff;padding:8px 0;border-bottom:1px solid #1e1e1e;font-style:italic;">${signature_name}</td></tr>
              <tr><td style="color:#888;padding:8px 12px 8px 0;border-bottom:1px solid #1e1e1e;">Signed At</td><td style="color:#fff;padding:8px 0;border-bottom:1px solid #1e1e1e;">${now}</td></tr>
              <tr><td style="color:#888;padding:8px 12px 8px 0;">IP Address</td><td style="color:#fff;padding:8px 0;">${typeof clientIp === 'string' ? clientIp.split(',')[0].trim() : 'unknown'}</td></tr>
            </table>
            <p style="color:#444;font-size:11px;margin-top:24px;">V&A Hire — W-9 Auto-Notification</p>
          </div>
        `,
      })
    } catch (emailErr) {
      console.error('[w9] Email notification failed:', emailErr)
    }

    // Send onboarding checklist email to worker
    if (worker.email) {
      try {
        const hasVideo = !!worker.video_url
        const hasId = !!worker.id_photo_url
        const bgCleared = !!worker.bg_check_cleared
        const bgSent = !!worker.bg_check_signed_at
        const allComplete = hasVideo && hasId && bgCleared

        const bgStepHtml = bgCleared
          ? `<div style="margin-bottom:8px;padding:12px 16px;background:#f0fdf4;border-radius:8px;color:#166534">✅ Background Check — Cleared</div>`
          : bgSent
          ? `<div style="margin-bottom:8px;padding:12px 16px;background:#fef3c7;border-radius:8px;color:#92400e">⏳ Background Check — Consent Sent, <a href="https://buy.stripe.com/9B65kEdmj7DV1dAdElefC00" style="color:#92400e;font-weight:600">Complete Payment →</a></div>`
          : `<div style="margin-bottom:8px;padding:12px 16px;background:#fef3c7;border-radius:8px;color:#92400e">⬜ Background Check — <a href="https://vandahire.com/bg-check/${digits}" style="color:#92400e;font-weight:600">Complete Now →</a></div>`

        const stepsHtml = `
          <div style="margin:20px 0">
            <p style="font-weight:600;margin-bottom:12px">Your onboarding checklist:</p>
            <div style="margin-bottom:8px;padding:12px 16px;background:${hasVideo ? '#f0fdf4;color:#166534' : '#fef3c7;color:#92400e'};border-radius:8px">
              ${hasVideo ? '✅' : '⬜'} Verification Video — ${hasVideo ? 'Complete' : '<a href="https://vandahire.com/verify" style="color:#92400e;font-weight:600">Complete Now →</a>'}
            </div>
            <div style="margin-bottom:8px;padding:12px 16px;background:${hasId ? '#f0fdf4;color:#166534' : '#fef3c7;color:#92400e'};border-radius:8px">
              ${hasId ? '✅' : '⬜'} ID Photo Upload — ${hasId ? 'Complete' : '<a href="https://vandahire.com/id-upload/' + digits + '" style="color:#92400e;font-weight:600">Complete Now →</a>'}
            </div>
            <div style="margin-bottom:8px;padding:12px 16px;background:#f0fdf4;border-radius:8px;color:#166534">
              ✅ W-9 Tax Form — Complete
            </div>
            ${bgStepHtml}
          </div>`

        const incompleteMsg = allComplete
          ? `<p style="color:#166534;font-weight:600">All steps complete! You're ready to be assigned to shifts.</p>`
          : `<p style="color:#92400e;font-weight:600">⚠️ You cannot be assigned to shifts until all 4 steps are completed.</p>`

        await sendEmail({
          to: worker.email,
          subject: allComplete ? 'Onboarding Complete — V&A Hire' : 'Action Required: Complete Your Onboarding — V&A Hire',
          html: `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px">
            <h2>W-9 Received!</h2>
            <p>Hi ${worker.first_name},</p>
            <p>Your W-9 tax form has been securely submitted.</p>
            ${stepsHtml}
            ${incompleteMsg}
            <p style="color:#888;font-size:12px;margin-top:30px">V&A Hire Staffing • vandahire.com</p>
          </div>`,
        })
      } catch (e) { console.error('[w9] Onboarding email failed:', e.message) }
    }

    return res.status(200).json({ success: true, w9_signed_at: now })
  }

  return res.status(405).json({ error: 'Method not allowed' })
}

// ─── BACKGROUND CHECK ────────────────────────────────────────────────────────

// Sends the signed authorization to PCG Screening — called only after the
// worker confirms payment. Idempotent via bg_check_authorization_sent_at.
async function sendPcgAuthorization(supabase, workerId) {
  const { data: w, error } = await supabase.from('applicants')
    .select('id, first_name, last_name, email, phone, bg_check_legal_name, bg_check_address, bg_check_city, bg_check_state, bg_check_zip, bg_check_sex, bg_check_race, bg_check_dob, bg_check_ssn_encrypted, bg_check_consent_type, bg_check_signature_name, bg_check_signed_at, bg_check_paid_at, bg_check_authorization_sent_at')
    .eq('id', workerId).single()
  if (error || !w) { console.error('[pcg] worker not found'); return false }
  if (w.bg_check_authorization_sent_at) return true // already sent

  let ssn = ''
  try { ssn = decryptTin(w.bg_check_ssn_encrypted) } catch (e) { console.error('[pcg] SSN decrypt failed:', e.message); return false }
  const formattedSsn = ssn.length === 9 ? `${ssn.slice(0,3)}-${ssn.slice(3,5)}-${ssn.slice(5)}` : ssn
  const consentLabel = w.bg_check_consent_type === 'employment_duration' ? 'Duration of employment' : 'Valid for 90 days from signature'
  const digits = String(w.phone || '').replace(/\D/g, '').slice(-10)

  try {
    await sendEmail({
      to: 'info@pcgscreening.com',
      subject: `Background Check Authorization — ${w.bg_check_legal_name} — from V&A Hire`,
      html: `<div style="font-family:system-ui,sans-serif;max-width:620px;margin:0 auto;padding:32px;background:#ffffff;color:#333;">
        <div style="background:#0a0a0a;color:#fff;padding:16px 20px;border-radius:8px 8px 0 0;">
          <div style="font-size:18px;font-weight:800;">V&A Hire</div>
          <div style="font-size:12px;color:#bbb;">Requested by Varist &amp; Associates of Georgia LLC · 470 16th Street NW, Unit 2024, Atlanta, GA 30363 · info@vassoc.com</div>
        </div>
        <h2 style="color:#000;margin:20px 0 16px;border-bottom:2px solid #000;padding-bottom:12px;">Background Check Authorization — PAID</h2>
        <p style="color:#166534;font-weight:600;font-size:13px;margin:0 0 16px;">✓ Worker payment confirmed before submission.</p>
        <table style="width:100%;border-collapse:collapse;font-size:14px;">
          <tr><td style="color:#666;padding:8px 12px 8px 0;border-bottom:1px solid #eee;font-weight:600;">Full Legal Name</td><td style="padding:8px 0;border-bottom:1px solid #eee;"><strong>${w.bg_check_legal_name}</strong></td></tr>
          <tr><td style="color:#666;padding:8px 12px 8px 0;border-bottom:1px solid #eee;font-weight:600;">Current Address</td><td style="padding:8px 0;border-bottom:1px solid #eee;">${w.bg_check_address}, ${w.bg_check_city}, ${w.bg_check_state} ${w.bg_check_zip}</td></tr>
          <tr><td style="color:#666;padding:8px 12px 8px 0;border-bottom:1px solid #eee;font-weight:600;">Sex/Gender</td><td style="padding:8px 0;border-bottom:1px solid #eee;">${w.bg_check_sex}</td></tr>
          <tr><td style="color:#666;padding:8px 12px 8px 0;border-bottom:1px solid #eee;font-weight:600;">Race</td><td style="padding:8px 0;border-bottom:1px solid #eee;">${w.bg_check_race}</td></tr>
          <tr><td style="color:#666;padding:8px 12px 8px 0;border-bottom:1px solid #eee;font-weight:600;">Date of Birth</td><td style="padding:8px 0;border-bottom:1px solid #eee;">${w.bg_check_dob}</td></tr>
          <tr><td style="color:#666;padding:8px 12px 8px 0;border-bottom:1px solid #eee;font-weight:600;">Social Security Number</td><td style="padding:8px 0;border-bottom:1px solid #eee;">${formattedSsn}</td></tr>
          <tr><td style="color:#666;padding:8px 12px 8px 0;border-bottom:1px solid #eee;font-weight:600;">Purpose Code</td><td style="padding:8px 0;border-bottom:1px solid #eee;">E — Regular Employment/Housing/Volunteer</td></tr>
          <tr><td style="color:#666;padding:8px 12px 8px 0;border-bottom:1px solid #eee;font-weight:600;">Consent Type</td><td style="padding:8px 0;border-bottom:1px solid #eee;">${consentLabel}</td></tr>
          <tr><td style="color:#666;padding:8px 12px 8px 0;border-bottom:1px solid #eee;font-weight:600;">Signed By</td><td style="padding:8px 0;border-bottom:1px solid #eee;font-style:italic;">${w.bg_check_signature_name || w.bg_check_legal_name}</td></tr>
          <tr><td style="color:#666;padding:8px 12px 8px 0;border-bottom:1px solid #eee;font-weight:600;">Date Signed</td><td style="padding:8px 0;border-bottom:1px solid #eee;">${w.bg_check_signed_at}</td></tr>
        </table>
        <hr style="margin:24px 0;border:none;border-top:1px solid #ddd;">
        <p style="color:#888;font-size:12px;">Submitted via V&A Hire worker onboarding · Worker Phone: ${digits} · Worker Email: ${w.email || 'N/A'}</p>
      </div>`,
    })
  } catch (e) {
    console.error('[pcg] authorization email failed:', e.message)
    return false
  }

  await supabase.from('applicants').update({ bg_check_authorization_sent_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq('id', workerId)
  return true
}

async function handleBgCheck(req, res, supabase) {
  // GET — check bg check status
  if (req.method === 'GET') {
    const { phone } = req.query
    if (!phone) return res.status(400).json({ error: 'phone required' })

    const worker = await findByPhone(supabase, phone, 'id, first_name, last_name, bg_check_signed_at, bg_check_cleared, bg_check_ssn_last4')
    if (!worker) return res.status(404).json({ error: 'Worker not found' })

    return res.status(200).json({
      bg_check_signed_at: worker.bg_check_signed_at || null,
      bg_check_cleared: worker.bg_check_cleared || false,
      bg_check_ssn_last4: worker.bg_check_ssn_last4 || null,
      first_name: worker.first_name,
      last_name: worker.last_name,
    })
  }

  // POST with action=confirm_payment — worker confirms they paid PCG; only
  // then do we email the authorization to PCG (Option B payment gate).
  if (req.method === 'POST' && req.body?.action === 'confirm_payment') {
    const digits = String(req.body.phone || '').replace(/\D/g, '').slice(-10)
    if (!digits) return res.status(400).json({ error: 'phone required' })
    const worker = await findByPhone(supabase, digits, 'id, first_name, email, phone, bg_check_signed_at, bg_check_authorization_sent_at')
    if (!worker) return res.status(404).json({ error: 'Worker not found' })
    if (!worker.bg_check_signed_at) return res.status(400).json({ error: 'Complete and sign the consent form first.' })
    if (worker.bg_check_authorization_sent_at) {
      return res.status(200).json({ success: true, already_sent: true })
    }
    await supabase.from('applicants').update({ bg_check_paid_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq('id', worker.id)
    const sent = await sendPcgAuthorization(supabase, worker.id)
    if (!sent) return res.status(500).json({ error: 'Could not submit authorization to PCG. Please try again.' })
    return res.status(200).json({ success: true })
  }

  // POST — submit bg check consent
  if (req.method === 'POST') {
    const { phone, legal_name, address, city, state, zip, sex, race, dob, ssn, consent_type, signature_name } = req.body

    if (!phone || !legal_name || !address || !city || !state || !zip || !sex || !race || !dob || !ssn || !signature_name) {
      return res.status(400).json({ error: 'All required fields must be completed' })
    }

    const ssnDigits = ssn.replace(/\D/g, '')
    if (ssnDigits.length !== 9) return res.status(400).json({ error: 'SSN must be exactly 9 digits' })
    if (!/^\d{5}$/.test(zip)) return res.status(400).json({ error: 'ZIP must be 5 digits' })

    const digits = phone.replace(/\D/g, '').slice(-10)
    const { data: allW } = await supabase
      .from('applicants')
      .select('id, first_name, last_name, email, phone, bg_check_signed_at, video_url, id_photo_url, w9_signed_at')
    const worker = (allW || []).find(w => w.phone && w.phone.replace(/\D/g, '').slice(-10) === digits) || null

    if (!worker) return res.status(404).json({ error: 'Worker not found' })
    if (worker.bg_check_signed_at) return res.status(400).json({ error: 'Background check consent already on file' })

    if (!process.env.W9_ENCRYPTION_KEY) {
      console.error('[bg-check] W9_ENCRYPTION_KEY not configured')
      return res.status(500).json({ error: 'Server configuration error' })
    }

    const clientIp = req.headers['x-forwarded-for'] || req.headers['x-real-ip'] || 'unknown'
    const ip = typeof clientIp === 'string' ? clientIp.split(',')[0].trim() : 'unknown'
    const now = new Date().toISOString()

    const { error: updateErr } = await supabase.from('applicants').update({
      bg_check_legal_name: legal_name,
      bg_check_address: address,
      bg_check_city: city,
      bg_check_state: state,
      bg_check_zip: zip,
      bg_check_sex: sex,
      bg_check_race: race,
      bg_check_dob: dob,
      bg_check_ssn_encrypted: encryptTin(ssnDigits),
      bg_check_ssn_last4: ssnDigits.slice(-4),
      bg_check_consent_type: consent_type || '90_days',
      bg_check_signature_name: signature_name,
      bg_check_signed_at: now,
      bg_check_ip: ip,
      updated_at: now,
    }).eq('id', worker.id)

    if (updateErr) {
      console.error('[bg-check] Update failed:', updateErr)
      return res.status(500).json({ error: 'Failed to save background check consent' })
    }

    // NOTE: the PCG authorization email is NOT sent here. It is held until the
    // worker confirms payment (Option B) — see the confirm_payment branch above
    // and sendPcgAuthorization(). This guarantees PCG only receives paid checks.

    const consentLabel = consent_type === 'employment_duration' ? 'Duration of employment' : 'Valid for 90 days from signature'

    // Send admin notification
    const adminEmail = process.env.ADMIN_EMAIL || 'crew@vandahire.com'
    try {
      await sendEmail({
        to: adminEmail,
        subject: `Background Check Consent: ${legal_name}`,
        html: `
          <div style="font-family:system-ui,sans-serif;background:#0a0a0a;color:#fff;padding:32px;max-width:600px;">
            <h2 style="color:#ffffff;margin:0 0 20px;">New Background Check Consent</h2>
            <table style="width:100%;border-collapse:collapse;font-size:14px;">
              <tr><td style="color:#888;padding:8px 12px 8px 0;border-bottom:1px solid #1e1e1e;">Legal Name</td><td style="color:#fff;padding:8px 0;border-bottom:1px solid #1e1e1e;"><strong>${legal_name}</strong></td></tr>
              <tr><td style="color:#888;padding:8px 12px 8px 0;border-bottom:1px solid #1e1e1e;">Address</td><td style="color:#fff;padding:8px 0;border-bottom:1px solid #1e1e1e;">${address}, ${city}, ${state} ${zip}</td></tr>
              <tr><td style="color:#888;padding:8px 12px 8px 0;border-bottom:1px solid #1e1e1e;">SSN (last 4)</td><td style="color:#fff;padding:8px 0;border-bottom:1px solid #1e1e1e;">***-**-${ssnDigits.slice(-4)}</td></tr>
              <tr><td style="color:#888;padding:8px 12px 8px 0;border-bottom:1px solid #1e1e1e;">Phone</td><td style="color:#fff;padding:8px 0;border-bottom:1px solid #1e1e1e;">${digits}</td></tr>
              <tr><td style="color:#888;padding:8px 12px 8px 0;border-bottom:1px solid #1e1e1e;">Consent Type</td><td style="color:#fff;padding:8px 0;border-bottom:1px solid #1e1e1e;">${consentLabel}</td></tr>
              <tr><td style="color:#888;padding:8px 12px 8px 0;">Signed At</td><td style="color:#fff;padding:8px 0;">${now}</td></tr>
            </table>
            <p style="color:#888;font-size:12px;margin-top:16px;">Authorization is held until the worker confirms PCG payment, then auto-sent to info@pcgscreening.com.</p>
            <p style="color:#444;font-size:11px;margin-top:24px;">V&A Hire — Background Check Auto-Notification</p>
          </div>`,
      })
    } catch (e) {
      console.error('[bg-check] Admin email failed:', e.message)
    }

    // Send worker checklist email
    if (worker.email) {
      try {
        const hasVideo = !!worker.video_url
        const hasId = !!worker.id_photo_url
        const hasW9 = !!worker.w9_signed_at
        const allComplete = false // bg_check_cleared is always false at submission time

        const stepsHtml = `
          <div style="margin:20px 0">
            <p style="font-weight:600;margin-bottom:12px">Your onboarding checklist:</p>
            <div style="margin-bottom:8px;padding:12px 16px;background:${hasVideo ? '#f0fdf4;color:#166534' : '#fef3c7;color:#92400e'};border-radius:8px">
              ${hasVideo ? '✅' : '⬜'} Verification Video — ${hasVideo ? 'Complete' : '<a href="https://vandahire.com/verify" style="color:#92400e;font-weight:600">Complete Now →</a>'}
            </div>
            <div style="margin-bottom:8px;padding:12px 16px;background:${hasId ? '#f0fdf4;color:#166534' : '#fef3c7;color:#92400e'};border-radius:8px">
              ${hasId ? '✅' : '⬜'} ID Photo Upload — ${hasId ? 'Complete' : '<a href="https://vandahire.com/id-upload/' + digits + '" style="color:#92400e;font-weight:600">Complete Now →</a>'}
            </div>
            <div style="margin-bottom:8px;padding:12px 16px;background:${hasW9 ? '#f0fdf4;color:#166534' : '#fef3c7;color:#92400e'};border-radius:8px">
              ${hasW9 ? '✅' : '⬜'} W-9 Tax Form — ${hasW9 ? 'Complete' : '<a href="https://vandahire.com/w9/' + digits + '" style="color:#92400e;font-weight:600">Complete Now →</a>'}
            </div>
            <div style="margin-bottom:8px;padding:12px 16px;background:#fef3c7;border-radius:8px;color:#92400e">
              ⏳ Background Check — Consent Sent, <a href="https://buy.stripe.com/9B65kEdmj7DV1dAdElefC00" style="color:#92400e;font-weight:600">Complete Payment →</a>
            </div>
          </div>`

        const incompleteMsg = `<p style="color:#92400e;font-weight:600">⚠️ Please complete the background check payment to finalize your screening.</p>
          <p style="color:#666">Results are typically returned within 2–3 business days after payment.</p>`

        await sendEmail({
          to: worker.email,
          subject: 'Action Required: Complete Background Check Payment — V&A Hire',
          html: `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px">
            <h2>Background Check Consent Received!</h2>
            <p>Hi ${worker.first_name},</p>
            <p>Your background check consent is signed. <strong>Complete the payment below, then return to the bg-check page and confirm</strong> — your authorization is sent to PCG Screening Services only after payment.</p>
            <table role="presentation" cellspacing="0" cellpadding="0" border="0" align="center" style="margin:16px auto"><tr><td style="background:#ffffff;border-radius:8px"><a href="https://buy.stripe.com/9B65kEdmj7DV1dAdElefC00" target="_blank" style="background:#ffffff;color:#000000;padding:14px 32px;border-radius:8px;text-decoration:none;font-weight:bold;display:inline-block">Complete Payment &rarr;</a></td></tr></table>
            ${stepsHtml}
            ${incompleteMsg}
            <p style="color:#888;font-size:12px;margin-top:30px">V&A Hire Staffing • vandahire.com</p>
          </div>`,
        })
      } catch (e) { console.error('[bg-check] Worker email failed:', e.message) }
    }

    return res.status(200).json({
      success: true,
      bg_check_signed_at: now,
      payment_url: 'https://buy.stripe.com/9B65kEdmj7DV1dAdElefC00',
    })
  }

  return res.status(405).json({ error: 'Method not allowed' })
}

// ─── GPS PING — Workers send location every 30s while checked in ─────────────
async function handleGpsPing(req, res, supabase) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { phone, latitude, longitude } = req.body
  if (!phone || latitude == null || longitude == null) {
    return res.status(400).json({ error: 'phone, latitude, longitude required' })
  }

  const digits = phone.replace(/\D/g, '').slice(-10)
  const { data: allWorkers } = await supabase.from('applicants').select('id, phone')
  const worker = (allWorkers || []).find(w => w.phone && w.phone.replace(/\D/g, '').slice(-10) === digits)
  if (!worker) return res.status(404).json({ error: 'Worker not found' })

  // Find active checked-in assignment
  const { data: assignment } = await supabase
    .from('assignments')
    .select('id, event_id')
    .eq('worker_id', worker.id)
    .eq('status', 'checked_in')
    .limit(1)
    .single()

  if (!assignment) return res.status(200).json({ status: 'no_active_shift' })

  // Update last known location on the assignment
  await supabase.from('assignments').update({
    last_ping_lat: latitude,
    last_ping_lng: longitude,
    last_ping_at: new Date().toISOString(),
  }).eq('id', assignment.id)

  return res.status(200).json({ status: 'ok' })
}

// ─── SUPERVISOR DASHBOARD — Get event, crew GPS, bench for supervisor ────────
async function handleSupervisorDashboard(req, res, supabase) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })

  const { phone } = req.query
  if (!phone) return res.status(400).json({ error: 'phone required' })

  const digits = phone.replace(/\D/g, '').slice(-10)
  const { data: allWorkers } = await supabase.from('applicants').select('id, first_name, last_name, phone')
  const supervisor = (allWorkers || []).find(w => w.phone && w.phone.replace(/\D/g, '').slice(-10) === digits)
  if (!supervisor) return res.status(404).json({ error: 'Worker not found' })

  // Find supervisor assignment
  const { data: supAssignment } = await supabase
    .from('assignments')
    .select('id, event_id, status, events ( id, title, event_date, start_time, end_time, location, city, latitude, longitude, geofence_radius_meters, workers_needed, pay_rate, service_tier )')
    .eq('worker_id', supervisor.id)
    .eq('is_supervisor', true)
    .in('status', ['confirmed', 'checked_in', 'completed'])
    .order('created_at', { ascending: false })
    .limit(1)
    .single()

  if (!supAssignment) return res.status(404).json({ error: 'No supervisor assignment found. You must be assigned as a supervisor to access this portal.' })

  const event = supAssignment.events

  // Get all crew for this event
  const { data: crew } = await supabase
    .from('assignments')
    .select('id, status, is_supervisor, check_in_time, check_out_time, hours_tracked, last_ping_lat, last_ping_lng, last_ping_at, check_in_lat, check_in_lng, worker_id, applicants ( id, first_name, last_name, phone, photo_url )')
    .eq('event_id', event.id)
    .in('status', ['confirmed', 'checked_in', 'completed'])
    .order('is_supervisor', { ascending: false })

  // Get bench pool
  const { data: bench } = await supabase
    .from('bench_assignments')
    .select('id, status, tier, standby_fee, called_in_at, worker_id, applicants ( id, first_name, last_name, phone )')
    .eq('event_id', event.id)
    .in('status', ['standby', 'called_in'])
    .order('tier', { ascending: true })

  // Get incidents
  const { data: incidents } = await supabase
    .from('incidents')
    .select('*')
    .eq('event_id', event.id)
    .order('created_at', { ascending: false })

  return res.status(200).json({
    event,
    supervisor: { id: supervisor.id, first_name: supervisor.first_name, last_name: supervisor.last_name },
    crew: crew || [],
    bench: bench || [],
    incidents: incidents || [],
  })
}

// ─── PUSH NOTIFICATIONS ─────────────────────────────────────────────────────

function setupVapid() {
  webPush.setVapidDetails(
    'mailto:crew@vandahire.com',
    process.env.VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY
  )
}

async function sendPushToWorker(supabase, workerId, title, body, url, tag) {
  if (!process.env.VAPID_PUBLIC_KEY || !process.env.VAPID_PRIVATE_KEY) return
  setupVapid()
  const { data: sub } = await supabase
    .from('push_subscriptions')
    .select('subscription')
    .eq('worker_id', workerId)
    .single()
  if (!sub) return
  try {
    await webPush.sendNotification(
      JSON.parse(sub.subscription),
      JSON.stringify({ title, body: body || '', url: url || '/', tag: tag || 'general' })
    )
  } catch (err) {
    if (err.statusCode === 410 || err.statusCode === 404) {
      await supabase.from('push_subscriptions').delete().eq('worker_id', workerId)
    }
  }
}

async function handlePushVapidKey(req, res) {
  return res.status(200).json({ publicKey: process.env.VAPID_PUBLIC_KEY })
}

async function handlePushSubscribe(req, res, supabase) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })
  const { phone, subscription } = req.body
  if (!phone || !subscription) return res.status(400).json({ error: 'phone and subscription required' })

  const digits = phone.replace(/\D/g, '').slice(-10)
  const { data: allWorkers } = await supabase.from('applicants').select('id, phone')
  const worker = (allWorkers || []).find(w => w.phone && w.phone.replace(/\D/g, '').slice(-10) === digits)
  if (!worker) return res.status(404).json({ error: 'Worker not found' })

  const { error } = await supabase.from('push_subscriptions').upsert({
    worker_id: worker.id,
    subscription: JSON.stringify(subscription),
    updated_at: new Date().toISOString(),
  }, { onConflict: 'worker_id' })

  if (error) {
    console.error('[push] Subscribe error:', error)
    return res.status(500).json({ error: 'Failed to save subscription' })
  }
  return res.status(200).json({ success: true })
}

async function handlePushSend(req, res, supabase) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })
  const { worker_id, title, body, url, tag } = req.body
  if (!worker_id || !title) return res.status(400).json({ error: 'worker_id and title required' })
  setupVapid()
  const { data: sub } = await supabase
    .from('push_subscriptions')
    .select('subscription')
    .eq('worker_id', worker_id)
    .single()
  if (!sub) return res.status(404).json({ error: 'No push subscription for this worker' })
  try {
    await webPush.sendNotification(
      JSON.parse(sub.subscription),
      JSON.stringify({ title, body: body || '', url: url || '/', tag: tag || 'general' })
    )
    return res.status(200).json({ success: true })
  } catch (err) {
    if (err.statusCode === 410 || err.statusCode === 404) {
      await supabase.from('push_subscriptions').delete().eq('worker_id', worker_id)
      return res.status(410).json({ error: 'Subscription expired' })
    }
    console.error('[push] Send error:', err)
    return res.status(500).json({ error: 'Failed to send push' })
  }
}

async function handlePushNotifyShift(req, res, supabase) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })
  const auth = req.headers.authorization?.replace('Bearer ', '')
  if (auth !== process.env.VANDA_ADMIN_TOKEN) return res.status(401).json({ error: 'Unauthorized' })

  const { event_title, event_date, city } = req.body
  if (!event_title) return res.status(400).json({ error: 'event_title required' })
  setupVapid()

  const { data: subs } = await supabase.from('push_subscriptions').select('worker_id, subscription')
  if (!subs || subs.length === 0) return res.status(200).json({ sent: 0, message: 'No subscriptions found' })

  const workerIds = subs.map(s => s.worker_id)
  const { data: workers } = await supabase
    .from('applicants')
    .select('id, status, city')
    .in('id', workerIds)
    .eq('status', 'approved')
  const approvedIds = new Set((workers || []).map(w => w.id))

  let sent = 0, failed = 0
  for (const sub of subs) {
    if (!approvedIds.has(sub.worker_id)) continue
    try {
      await webPush.sendNotification(
        JSON.parse(sub.subscription),
        JSON.stringify({
          title: 'New Shift Available!',
          body: `${event_title}${event_date ? ` — ${event_date}` : ''}${city ? ` in ${city}` : ''}. Claim it now!`,
          url: '/shifts',
          tag: 'new-shift',
        })
      )
      sent++
    } catch (err) {
      if (err.statusCode === 410 || err.statusCode === 404) {
        await supabase.from('push_subscriptions').delete().eq('worker_id', sub.worker_id)
      }
      failed++
    }
  }
  return res.status(200).json({ sent, failed })
}

// ─── EMAIL UNSUBSCRIBE ───────────────────────────────────────────────────────
async function handleUnsubscribe(req, res, supabase) {
  const token = req.query.t || req.body?.t
  const email = readUnsubToken(token)
  const page = (title, msg) => `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title></head>
    <body style="margin:0;background:#0a0a0a;font-family:Arial,sans-serif;color:#ddd;display:flex;min-height:100vh;align-items:center;justify-content:center;">
      <div style="max-width:440px;padding:32px;text-align:center;">
        <div style="font-size:20px;font-weight:800;color:#fff;margin-bottom:16px;">V&amp;A Hire</div>
        <p style="font-size:15px;line-height:1.6;">${msg}</p>
      </div></body></html>`
  if (!email) {
    res.setHeader('Content-Type', 'text/html')
    return res.status(400).send(page('Invalid link', 'This unsubscribe link is invalid or expired.'))
  }
  try {
    await supabase.from('email_suppressions').upsert({ email: email.toLowerCase(), reason: 'unsubscribe' }, { onConflict: 'email' })
  } catch (e) {
    console.error('[unsubscribe] failed:', e.message)
  }
  res.setHeader('Content-Type', 'text/html')
  return res.status(200).send(page('Unsubscribed', `<strong style="color:#fff">${email}</strong> has been unsubscribed from V&A Hire emails. You'll no longer receive shift-offer or update emails. You can still receive SMS unless you reply STOP.`))
}

// ─── RESEND EMAIL EVENT WEBHOOK ──────────────────────────────────────────────
// Receives delivered/opened/clicked/bounced events; secured by ?key=.
async function handleResendWebhook(req, res, supabase) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' })
  const expected = process.env.RESEND_WEBHOOK_KEY
  if (expected && req.query.key !== expected) return res.status(401).json({ error: 'Unauthorized' })
  const evt = req.body || {}
  const type = String(evt.type || '').replace(/^email\./, '')
  const data = evt.data || {}
  const to = Array.isArray(data.to) ? data.to[0] : data.to
  if (!type || !to) return res.status(200).json({ ignored: true })
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

// ─── GEOFENCE EMAIL REPLY (worker clicks button in exit warning email) ───────
async function handleGeofenceReply(req, res, supabase) {
  const id = req.query.id
  const reply = req.query.reply
  const page = (title, msg) => `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title></head>
    <body style="margin:0;background:#0a0a0a;font-family:Arial,sans-serif;color:#ddd;display:flex;min-height:100vh;align-items:center;justify-content:center">
      <div style="max-width:440px;padding:32px;text-align:center">
        <div style="font-size:20px;font-weight:800;color:#fff;margin-bottom:16px">V&amp;A Hire</div>
        <p style="font-size:15px;line-height:1.6">${msg}</p>
      </div></body></html>`
  const valid = { break: "Got it — you're on a break", returning: "Thanks — see you back at the venue" }
  if (!id || !valid[reply]) {
    res.setHeader('Content-Type', 'text/html')
    return res.status(400).send(page('Invalid link', 'This link is invalid or expired.'))
  }
  try {
    await supabase.from('exit_records').update({ reply, reply_at: new Date().toISOString() }).eq('id', id)
  } catch (e) { console.error('[geofence-reply] update failed:', e.message) }
  res.setHeader('Content-Type', 'text/html')
  return res.status(200).send(page('Got it', `${valid[reply]}. Your coordinator has been notified. We'll confirm once you're back inside the venue area.`))
}
