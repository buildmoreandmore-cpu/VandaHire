import { createClient } from '@supabase/supabase-js'

function supabaseClient() {
  return createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
}

// Worker-facing incidents API (used by supervisors from MyShiftsPage)
export default async function handler(req, res) {
  const supabase = supabaseClient()

  // GET — fetch incidents for an event
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

  // POST — log a new incident (supervisor only)
  if (req.method === 'POST') {
    const { phone, event_id, incident_type, description } = req.body
    if (!phone || !event_id || !incident_type || !description) {
      return res.status(400).json({ error: 'phone, event_id, incident_type, description required' })
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

    // Verify they are the supervisor for this event
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
