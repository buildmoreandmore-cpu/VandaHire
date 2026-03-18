import { createClient } from '@supabase/supabase-js'
import { checkAdmin } from './_auth.js'

export default async function handler(req, res) {
  const auth = checkAdmin(req)
  if (!auth.ok) return res.status(auth.status).json({ error: auth.error })

  const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
  )

  // GET — list assignments, optionally filtered by event_id or worker_id
  if (req.method === 'GET') {
    try {
      let query = supabase
        .from('assignments')
        .select(`
          id, created_at, updated_at, status, notes,
          event_id, worker_id,
          events ( id, title, event_date, start_time, end_time, city, status ),
          applicants ( id, first_name, last_name, email, phone, city, photo_url, status )
        `)
        .order('created_at', { ascending: false })

      if (req.query.event_id) {
        query = query.eq('event_id', req.query.event_id)
      }
      if (req.query.worker_id) {
        query = query.eq('worker_id', req.query.worker_id)
      }

      const { data, error } = await query
      if (error) throw error
      return res.status(200).json(data)
    } catch (err) {
      console.error('[admin/assignments] Query error:', err)
      return res.status(500).json({ error: 'Failed to fetch assignments' })
    }
  }

  // POST — create assignment(s)
  if (req.method === 'POST') {
    const { event_id, worker_ids } = req.body
    if (!event_id || !worker_ids?.length) {
      return res.status(400).json({ error: 'event_id and worker_ids[] required' })
    }

    const rows = worker_ids.map(worker_id => ({
      event_id,
      worker_id,
      status: 'invited',
    }))

    try {
      const { data, error } = await supabase
        .from('assignments')
        .upsert(rows, { onConflict: 'event_id,worker_id', ignoreDuplicates: true })
        .select()

      if (error) throw error
      return res.status(200).json({ created: data.length, assignments: data })
    } catch (err) {
      console.error('[admin/assignments] Insert error:', err)
      return res.status(500).json({ error: 'Failed to create assignments' })
    }
  }

  // PATCH — update assignment status
  if (req.method === 'PATCH') {
    const { id, status } = req.body
    if (!id || !status) {
      return res.status(400).json({ error: 'id and status required' })
    }

    const validStatuses = ['invited', 'confirmed', 'declined', 'checked_in', 'completed', 'cancelled']
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ error: `Invalid status. Must be one of: ${validStatuses.join(', ')}` })
    }

    try {
      const { data, error } = await supabase
        .from('assignments')
        .update({ status, updated_at: new Date().toISOString() })
        .eq('id', id)
        .select()
        .single()

      if (error) throw error
      return res.status(200).json(data)
    } catch (err) {
      console.error('[admin/assignments] Update error:', err)
      return res.status(500).json({ error: 'Failed to update assignment' })
    }
  }

  // DELETE — remove assignment
  if (req.method === 'DELETE') {
    const { id } = req.body
    if (!id) {
      return res.status(400).json({ error: 'id required' })
    }

    try {
      const { error } = await supabase
        .from('assignments')
        .delete()
        .eq('id', id)

      if (error) throw error
      return res.status(200).json({ success: true })
    } catch (err) {
      console.error('[admin/assignments] Delete error:', err)
      return res.status(500).json({ error: 'Failed to delete assignment' })
    }
  }

  return res.status(405).json({ error: 'Method not allowed' })
}
