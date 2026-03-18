import { createClient } from '@supabase/supabase-js'
import { checkAdmin } from './_auth.js'

export default async function handler(req, res) {
  const auth = checkAdmin(req)
  if (!auth.ok) return res.status(auth.status).json({ error: auth.error })

  const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
  )

  // GET — list applicants with optional status filter
  if (req.method === 'GET') {
    try {
      let query = supabase
        .from('applicants')
        .select('id, created_at, first_name, last_name, email, phone, city, zip, roles, availability, experience_types, availability_windows, has_transportation, short_notice, notes, photo_url, score_breakdown, status')
        .order('created_at', { ascending: false })

      const { status } = req.query
      if (status && status !== 'all') {
        query = query.eq('status', status)
      }

      const { data, error } = await query
      if (error) throw error
      return res.status(200).json(data)
    } catch (err) {
      console.error('[admin/applicants] Query error:', err)
      return res.status(500).json({ error: 'Failed to fetch applicants' })
    }
  }

  // PATCH — update applicant status
  if (req.method === 'PATCH') {
    const { id, status } = req.body
    if (!id || !status) {
      return res.status(400).json({ error: 'id and status required' })
    }

    const validStatuses = ['pending', 'qualified', 'needs_review', 'not_a_fit', 'approved', 'rejected']
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ error: `Invalid status. Must be one of: ${validStatuses.join(', ')}` })
    }

    try {
      const { data, error } = await supabase
        .from('applicants')
        .update({ status, updated_at: new Date().toISOString() })
        .eq('id', id)
        .select()
        .single()

      if (error) throw error
      return res.status(200).json(data)
    } catch (err) {
      console.error('[admin/applicants] Update error:', err)
      return res.status(500).json({ error: 'Failed to update applicant' })
    }
  }

  return res.status(405).json({ error: 'Method not allowed' })
}
