import { createClient } from '@supabase/supabase-js'
import { checkAdmin } from './_auth.js'

export default async function handler(req, res) {
  const auth = checkAdmin(req)
  if (!auth.ok) return res.status(auth.status).json({ error: auth.error })

  const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
  )

  // GET — list events with optional status filter
  if (req.method === 'GET') {
    try {
      let query = supabase
        .from('events')
        .select('*')
        .order('event_date', { ascending: true })

      const { status } = req.query
      if (status && status !== 'all') {
        query = query.eq('status', status)
      }

      const { data, error } = await query
      if (error) throw error
      return res.status(200).json(data)
    } catch (err) {
      console.error('[admin/events] Query error:', err)
      return res.status(500).json({ error: 'Failed to fetch events' })
    }
  }

  // PATCH — update event status
  if (req.method === 'PATCH') {
    const { id, status } = req.body
    if (!id || !status) {
      return res.status(400).json({ error: 'id and status required' })
    }

    const validStatuses = ['pending', 'approved', 'staffing', 'confirmed', 'completed', 'cancelled']
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ error: `Invalid status. Must be one of: ${validStatuses.join(', ')}` })
    }

    try {
      const { data, error } = await supabase
        .from('events')
        .update({ status, updated_at: new Date().toISOString() })
        .eq('id', id)
        .select()
        .single()

      if (error) throw error
      return res.status(200).json(data)
    } catch (err) {
      console.error('[admin/events] Update error:', err)
      return res.status(500).json({ error: 'Failed to update event' })
    }
  }

  return res.status(405).json({ error: 'Method not allowed' })
}
