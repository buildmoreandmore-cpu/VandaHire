import { createClient } from '@supabase/supabase-js'

// Public endpoint — event holders submit staffing requests
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const {
    title, organizer, contact_name, contact_email, contact_phone,
    event_date, start_time, end_time, location, city,
    workers_needed, role_types, pay_rate, dress_code, notes,
    // new fields
    service_type, meeting_point, supervisor_name, supervisor_phone,
    briefing_required, briefing_date, briefing_time, briefing_location, briefing_slots,
  } = req.body

  // Validation
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

  if (missing.length > 0) {
    return res.status(400).json({ error: `Missing required fields: ${missing.join(', ')}` })
  }

  const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
  )

  try {
    const { data, error } = await supabase
      .from('events')
      .insert({
        title,
        organizer,
        contact_name,
        contact_email,
        contact_phone,
        event_date,
        start_time,
        end_time,
        location,
        city,
        workers_needed: parseInt(workers_needed, 10) || 1,
        role_types: role_types || [],
        pay_rate: pay_rate || '',
        dress_code: dress_code || '',
        notes: notes || '',
        status: 'pending',
        // new fields
        service_type: service_type || 'single_event',
        meeting_point: meeting_point || '',
        supervisor_name: supervisor_name || '',
        supervisor_phone: supervisor_phone || '',
        briefing_required: !!briefing_required,
        briefing_date: briefing_required && briefing_date ? briefing_date : null,
        briefing_time: briefing_required && briefing_time ? briefing_time : null,
        briefing_location: briefing_required ? (briefing_location || '') : '',
        briefing_slots: briefing_required ? (briefing_slots || []) : [],
      })
      .select('id')
      .single()

    if (error) throw error
    return res.status(200).json({ success: true, eventId: data.id })
  } catch (err) {
    console.error('[events/submit] Insert error:', err)
    return res.status(500).json({ error: 'Failed to save event request' })
  }
}
