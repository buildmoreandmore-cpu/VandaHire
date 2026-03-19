import { createClient } from '@supabase/supabase-js'
import { isWithinGeofence } from '../_lib/geo.js'

function supabaseClient() {
  return createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
}

export default async function handler(req, res) {
  const supabase = supabaseClient()

  // GET — fetch worker's assignments with event geofence data
  if (req.method === 'GET') {
    const { phone } = req.query
    if (!phone) return res.status(400).json({ error: 'phone required' })

    const digits = phone.replace(/\D/g, '')

    // Find worker by phone
    const { data: worker, error: wErr } = await supabase
      .from('applicants')
      .select('id, first_name, last_name, phone, status')
      .or(`phone.eq.${digits},phone.eq.+1${digits}`)
      .limit(1)
      .single()

    if (wErr || !worker) return res.status(404).json({ error: 'Worker not found' })
    if (worker.status !== 'approved') return res.status(403).json({ error: 'Not an approved worker' })

    // Get confirmed/checked_in assignments with event data
    const { data: assignments, error: aErr } = await supabase
      .from('assignments')
      .select('id, status, check_in_time, check_out_time, hours_tracked, is_supervisor, event_id, events ( id, title, event_date, start_time, end_time, location, city, pay_rate, latitude, longitude, geofence_radius_meters, service_tier )')
      .eq('worker_id', worker.id)
      .in('status', ['confirmed', 'checked_in', 'completed'])
      .order('created_at', { ascending: false })

    if (aErr) return res.status(500).json({ error: 'Failed to load assignments' })

    // For supervisor assignments, include the crew roster
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

    // Find worker
    const { data: worker, error: wErr } = await supabase
      .from('applicants')
      .select('id')
      .or(`phone.eq.${digits},phone.eq.+1${digits}`)
      .limit(1)
      .single()

    if (wErr || !worker) return res.status(404).json({ error: 'Worker not found' })

    // Find assignment
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

    // Fetch event geofence
    const { data: event, error: eErr } = await supabase
      .from('events')
      .select('latitude, longitude, geofence_radius_meters')
      .eq('id', event_id)
      .single()

    if (eErr || !event) return res.status(404).json({ error: 'Event not found' })

    // Validate geofence (skip if event has no coordinates set)
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

    // Check out — calculate hours
    const checkInTime = new Date(assignment.check_in_time)
    const checkOutTime = new Date(now)
    const hoursTracked = ((checkOutTime - checkInTime) / 3600000).toFixed(2)

    const { error } = await supabase
      .from('assignments')
      .update({
        status: 'completed',
        check_out_time: now,
        check_out_lat: latitude,
        check_out_lng: longitude,
        hours_tracked: parseFloat(hoursTracked),
        updated_at: now,
      })
      .eq('id', assignment.id)

    if (error) return res.status(500).json({ error: 'Failed to check out' })
    return res.status(200).json({ success: true, action: 'check_out', time: now, hours_tracked: hoursTracked })
  }

  return res.status(405).json({ error: 'Method not allowed' })
}
