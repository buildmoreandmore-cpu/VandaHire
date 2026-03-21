import crypto from 'crypto'
import { createClient } from '@supabase/supabase-js'
import { isWithinGeofence } from '../_lib/geo.js'
import { sendSms } from '../_lib/sms.js'
import { calculatePay } from '../_lib/pay.js'

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
    if (route === 'geofence-check') return await handleGeofenceCheck(req, res, supabase)
    if (route === 'accept-quote') return await handleAcceptQuote(req, res, supabase)
    if (route === 'connect-onboard') return await handleConnectOnboard(req, res, supabase)
    if (route === 'connect-dashboard') return await handleConnectDashboard(req, res, supabase)
    if (route === 'my-earnings') return await handleMyEarnings(req, res, supabase)
    if (route === 'client-survey') return await handleClientSurvey(req, res, supabase)
    if (route === 'my-crew-status') return await handleMyCrewStatus(req, res, supabase)
    if (route === 'w9') return await handleW9(req, res, supabase)
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

    const digits = phone.replace(/\D/g, '')

    const { data: worker, error: wErr } = await supabase
      .from('applicants')
      .select('id, first_name, last_name, phone, status')
      .or(`phone.eq.${digits},phone.eq.+1${digits}`)
      .limit(1)
      .single()

    if (wErr || !worker) return res.status(404).json({ error: 'Worker not found' })
    if (worker.status !== 'approved') return res.status(403).json({ error: 'Not an approved worker' })

    const { data: assignments, error: aErr } = await supabase
      .from('assignments')
      .select('id, status, check_in_time, check_out_time, hours_tracked, is_supervisor, event_id, events ( id, title, event_date, start_time, end_time, location, city, pay_rate, latitude, longitude, geofence_radius_meters, service_tier )')
      .eq('worker_id', worker.id)
      .in('status', ['confirmed', 'checked_in', 'completed'])
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
          .in('status', ['confirmed', 'checked_in', 'completed'])
          .order('is_supervisor', { ascending: false })
        item.crew = crew || []
      }
      enriched.push(item)
    }

    return res.status(200).json({
      worker: { id: worker.id, first_name: worker.first_name, last_name: worker.last_name },
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

    const digits = phone.replace(/\D/g, '')

    const { data: worker, error: wErr } = await supabase
      .from('applicants')
      .select('id')
      .or(`phone.eq.${digits},phone.eq.+1${digits}`)
      .limit(1)
      .single()

    if (wErr || !worker) return res.status(404).json({ error: 'Worker not found' })

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
      .select('latitude, longitude, geofence_radius_meters')
      .eq('id', event_id)
      .single()

    if (eErr || !event) return res.status(404).json({ error: 'Event not found' })

    if (event.latitude != null && event.longitude != null) {
      const { within, distance } = isWithinGeofence(
        latitude, longitude,
        event.latitude, event.longitude,
        event.geofence_radius_meters || 200
      )
      if (!within) {
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

    const digits = phone.replace(/\D/g, '')

    const { data: worker, error: wErr } = await supabase
      .from('applicants')
      .select('id')
      .or(`phone.eq.${digits},phone.eq.+1${digits}`)
      .limit(1)
      .single()

    if (wErr || !worker) return res.status(404).json({ error: 'Worker not found' })

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

  const digits = phone.replace(/\D/g, '')

  // Find worker
  const { data: worker, error: wErr } = await supabase
    .from('applicants')
    .select('id')
    .or(`phone.eq.${digits},phone.eq.+1${digits}`)
    .limit(1)
    .single()
  if (wErr || !worker) return res.status(404).json({ error: 'Worker not found' })

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

  const { phone, video_base64 } = req.body
  if (!phone || !video_base64) return res.status(400).json({ error: 'phone and video_base64 required' })

  const digits = phone.replace(/\D/g, '')
  const { data: worker, error: wErr } = await supabase
    .from('applicants')
    .select('id, first_name, email, status')
    .or(`phone.eq.${digits},phone.eq.+1${digits}`)
    .limit(1)
    .single()
  if (wErr || !worker) return res.status(404).json({ error: 'Worker not found' })

  // Upload video to Supabase storage
  const videoBuffer = Buffer.from(video_base64, 'base64')
  const fileName = `verification-videos/${worker.id}_${Date.now()}.webm`

  const { error: uploadErr } = await supabase.storage
    .from('applicant-photos')
    .upload(fileName, videoBuffer, { contentType: 'video/webm', upsert: true })

  if (uploadErr) {
    console.error('[verify-video] Upload error:', uploadErr)
    return res.status(500).json({ error: 'Failed to upload video' })
  }

  const { data: urlData } = supabase.storage.from('applicant-photos').getPublicUrl(fileName)

  // Update applicant with video URL
  await supabase.from('applicants').update({
    video_url: urlData.publicUrl,
    video_submitted_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }).eq('id', worker.id)

  // Send confirmation email
  if (worker.email) {
    const { sendEmail } = await import('../_lib/email.js')
    try {
      await sendEmail({
        to: worker.email,
        subject: 'Verification Video Received — V&A Workforce',
        html: `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px">
          <h2>Video Received!</h2>
          <p>Hi ${worker.first_name},</p>
          <p>We've received your verification video. Our team will review it shortly.</p>
          <p>Once verified, you'll be able to start claiming shifts. We'll send you an email when you're all set.</p>
          <p style="color:#888;font-size:12px;margin-top:30px">V&A Workforce Staffing • vandahire.com</p>
        </div>`,
      })
    } catch (e) { console.error('[verify-video] Email failed:', e.message) }
  }

  return res.status(200).json({ success: true, video_url: urlData.publicUrl })
}

// ─── GEOFENCE BACKGROUND CHECK ──────────────────────────────────────────────
// Mobile app calls this periodically to detect if worker left the venue

async function handleGeofenceCheck(req, res, supabase) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { phone, latitude, longitude } = req.body
  if (!phone || !latitude || !longitude) return res.status(400).json({ error: 'phone, latitude, longitude required' })

  const digits = phone.replace(/\D/g, '')
  const { data: worker } = await supabase
    .from('applicants')
    .select('id, first_name, phone')
    .or(`phone.eq.${digits},phone.eq.+1${digits}`)
    .limit(1)
    .single()
  if (!worker) return res.status(404).json({ error: 'Worker not found' })

  // Find active checked-in assignment
  const { data: assignment } = await supabase
    .from('assignments')
    .select('id, event_id, events ( id, title, location, latitude, longitude, geofence_radius_meters, start_time, end_time, event_date, pay_rate )')
    .eq('worker_id', worker.id)
    .eq('status', 'checked_in')
    .limit(1)
    .single()

  if (!assignment) return res.status(200).json({ status: 'no_active_shift' })

  const event = assignment.events
  if (!event?.latitude || !event?.longitude) return res.status(200).json({ status: 'no_geofence' })

  const inside = isWithinGeofence(
    parseFloat(latitude), parseFloat(longitude),
    parseFloat(event.latitude), parseFloat(event.longitude),
    parseFloat(event.geofence_radius_meters) || 150
  )

  if (inside) return res.status(200).json({ status: 'inside_geofence' })

  // Worker is outside geofence — check if we already have an open exit record
  const { data: existingExit } = await supabase
    .from('exit_records')
    .select('id')
    .eq('assignment_id', assignment.id)
    .is('worker_reply', null)
    .limit(1)
    .single()

  if (existingExit) return res.status(200).json({ status: 'exit_already_recorded', exit_record_id: existingExit.id })

  // Create exit record and send notification
  const now = new Date()
  const checkInTime = assignment.check_in_time ? new Date(assignment.check_in_time) : now
  const hoursWorked = Math.round(((now - checkInTime) / 3600000) * 100) / 100

  // Calculate scheduled hours
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

  // Send exit notification email (SMS when Twilio is set up)
  if (worker.phone) {
    const { sendEmail } = await import('../_lib/email.js')
    const { data: workerEmail } = await supabase.from('applicants').select('email').eq('id', worker.id).single()
    if (workerEmail?.email) {
      try {
        await sendEmail({
          to: workerEmail.email,
          subject: `Did you leave? — ${event.title}`,
          html: `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px">
            <h2 style="color:#ffffff">Geofence Alert — ${event.title}</h2>
            <p>Hi ${worker.first_name},</p>
            <p>It looks like you've left the event venue at ${event.location}. Please let us know what happened:</p>
            <ul>
              <li><strong>On a break?</strong> — Head back to the venue when ready</li>
              <li><strong>Done for the day?</strong> — Contact your supervisor</li>
              <li><strong>Emergency?</strong> — Take care of yourself, we understand</li>
            </ul>
            <p>Please reply to this email or contact your supervisor.</p>
            <p style="color:#888;font-size:12px">V&A Workforce Staffing • vandahire.com</p>
          </div>`,
        })
      } catch (e) { console.error('[geofence-check] Email failed:', e.message) }
    }
  }

  return res.status(200).json({
    status: 'outside_geofence',
    exit_record_id: exitRecord?.id,
    message: 'Worker has left the geofence. Notification sent.',
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

  const digits = phone.replace(/\D/g, '')
  const { data: worker } = await supabase
    .from('applicants')
    .select('id, first_name, last_name, email, stripe_connect_id')
    .or(`phone.eq.${digits},phone.eq.+1${digits}`)
    .limit(1)
    .single()

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

  const digits = phone.replace(/\D/g, '')
  const { data: worker } = await supabase
    .from('applicants')
    .select('id, stripe_connect_id')
    .or(`phone.eq.${digits},phone.eq.+1${digits}`)
    .limit(1)
    .single()

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

  const digits = phone.replace(/\D/g, '')
  const { data: worker } = await supabase
    .from('applicants')
    .select('id, first_name, last_name, stripe_connect_id, total_earnings, shifts_completed, reliability_score')
    .or(`phone.eq.${digits},phone.eq.+1${digits}`)
    .limit(1)
    .single()

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

async function handleW9(req, res, supabase) {
  // GET — check W-9 status
  if (req.method === 'GET') {
    const { phone } = req.query
    if (!phone) return res.status(400).json({ error: 'phone required' })

    const digits = phone.replace(/\D/g, '')
    const { data: worker } = await supabase
      .from('applicants')
      .select('id, w9_signed_at, w9_legal_name, w9_tin_last4')
      .or(`phone.eq.${digits},phone.eq.+1${digits}`)
      .limit(1)
      .single()

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

    const digits = phone.replace(/\D/g, '')
    const { data: worker } = await supabase
      .from('applicants')
      .select('id, w9_signed_at')
      .or(`phone.eq.${digits},phone.eq.+1${digits}`)
      .limit(1)
      .single()

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

    return res.status(200).json({ success: true, w9_signed_at: now })
  }

  return res.status(405).json({ error: 'Method not allowed' })
}
