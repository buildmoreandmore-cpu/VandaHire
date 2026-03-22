import { createClient } from '@supabase/supabase-js'
import { findByPhone } from '../_lib/phone.js'

// GET → list available shifts
// POST { event_id, phone, briefing_slot? } → claim a shift
export default async function handler(req, res) {
  const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)

  // GET — list events open for claiming
  if (req.method === 'GET') {
    try {
      const { data: events, error } = await supabase
        .from('events')
        .select('id, title, event_date, start_time, end_time, city, location, role_types, pay_rate, workers_needed, status')
        .in('status', ['staffing', 'confirmed'])
        .gte('event_date', new Date().toISOString().slice(0, 10))
        .order('event_date', { ascending: true })

      if (error) throw error

      const eventIds = events.map(e => e.id)
      if (eventIds.length === 0) return res.status(200).json([])

      const { data: assignmentCounts, error: countError } = await supabase
        .from('assignments')
        .select('event_id')
        .in('event_id', eventIds)
        .in('status', ['invited', 'confirmed', 'checked_in'])

      if (countError) throw countError

      const countMap = {}
      for (const a of assignmentCounts) countMap[a.event_id] = (countMap[a.event_id] || 0) + 1

      return res.status(200).json(events.filter(e => (countMap[e.id] || 0) < e.workers_needed))
    } catch (err) {
      console.error('[shifts GET] Error:', err)
      return res.status(500).json({ error: 'Failed to load shifts' })
    }
  }

  // POST — claim a shift
  if (req.method === 'POST') {
    const { event_id, phone, briefing_slot } = req.body
    if (!event_id || !phone) return res.status(400).json({ error: 'event_id and phone are required' })

    try {
      const digits = phone.replace(/\D/g, '').slice(-10)
      const worker = await findByPhone(supabase, phone, 'id, first_name, last_name, status, phone, w9_signed_at, id_photo_url')
      if (!worker) return res.status(404).json({ error: 'not_found', message: 'No worker found with that phone number. Please apply first.' })
      if (worker.status !== 'approved') return res.status(403).json({ error: 'not_approved', message: 'Your application is still under review.' })
      if (!worker.id_photo_url) return res.status(403).json({ error: 'id_required', message: 'Please upload your ID before claiming shifts.', id_url: `/id-upload/${digits}` })
      if (!worker.w9_signed_at) return res.status(403).json({ error: 'w9_required', message: 'Please complete your W-9 form before claiming shifts.', w9_url: `/w9/${digits}` })

      const { data: event, error: eventError } = await supabase.from('events').select('id, workers_needed, status').eq('id', event_id).single()
      if (eventError || !event) return res.status(404).json({ error: 'Event not found' })
      if (!['staffing', 'confirmed'].includes(event.status)) return res.status(400).json({ error: 'This shift is no longer accepting claims' })

      const { count, error: countError } = await supabase.from('assignments').select('id', { count: 'exact', head: true }).eq('event_id', event_id).in('status', ['invited', 'confirmed', 'checked_in'])
      if (countError) throw countError
      if (count >= event.workers_needed) return res.status(400).json({ error: 'This shift is already fully staffed' })

      const { data: existing } = await supabase.from('assignments').select('id').eq('event_id', event_id).eq('worker_id', worker.id).maybeSingle()
      if (existing) return res.status(400).json({ error: 'You have already claimed this shift' })

      const { data: assignment, error: insertError } = await supabase.from('assignments').insert({ event_id, worker_id: worker.id, status: 'invited', briefing_slot: briefing_slot || null, briefing_confirmed: false }).select('id').single()
      if (insertError) throw insertError

      return res.status(200).json({ success: true, assignment_id: assignment.id, worker: { first_name: worker.first_name, last_name: worker.last_name } })
    } catch (err) {
      console.error('[shifts POST] Error:', err)
      return res.status(500).json({ error: 'Failed to claim shift' })
    }
  }

  return res.status(405).json({ error: 'Method not allowed' })
}
