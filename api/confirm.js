import { createClient } from '@supabase/supabase-js'

// Public endpoint for workers to view and respond to assignments via confirmation token.
// GET  /api/confirm?token=xxx  → returns assignment details
// POST /api/confirm            → { token, action: 'confirm' | 'decline' }

export default async function handler(req, res) {
  const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
  )

  // GET — look up assignment by token, return event + worker details
  if (req.method === 'GET') {
    const { token } = req.query
    if (!token) {
      return res.status(400).json({ error: 'token required' })
    }

    try {
      const { data, error } = await supabase
        .from('assignments')
        .select(`
          id, status, notes, pay_rate, reconfirm_requested_at, reconfirmed_at,
          events ( title, event_date, start_time, end_time, location, city, dress_code, reconfirm_cutoff ),
          applicants ( first_name, last_name )
        `)
        .eq('confirmation_token', token)
        .single()

      if (error || !data) {
        return res.status(404).json({ error: 'Assignment not found or link expired' })
      }

      // Worker needs to reconfirm when a reconfirm request is pending and unanswered.
      const needs_reconfirm = data.status === 'confirmed' && !!data.reconfirm_requested_at && !data.reconfirmed_at

      return res.status(200).json({
        assignment_id: data.id,
        status: data.status,
        pay_rate: data.pay_rate,
        notes: data.notes,
        needs_reconfirm,
        reconfirmed: !!data.reconfirmed_at,
        reconfirm_cutoff: data.events?.reconfirm_cutoff || null,
        worker_name: `${data.applicants?.first_name || ''} ${data.applicants?.last_name || ''}`.trim(),
        event: {
          title: data.events?.title,
          date: data.events?.event_date,
          start_time: data.events?.start_time,
          end_time: data.events?.end_time,
          location: data.events?.location,
          city: data.events?.city,
          dress_code: data.events?.dress_code,
        },
      })
    } catch (err) {
      console.error('[confirm] Lookup error:', err)
      return res.status(500).json({ error: 'Failed to look up assignment' })
    }
  }

  // POST — worker confirms or declines
  if (req.method === 'POST') {
    const { token, action } = req.body
    if (!token || !action) {
      return res.status(400).json({ error: 'token and action required' })
    }

    if (!['confirm', 'decline', 'reconfirm'].includes(action)) {
      return res.status(400).json({ error: 'action must be "confirm", "decline", or "reconfirm"' })
    }

    try {
      // Look up assignment
      const { data: assignment, error: lookupError } = await supabase
        .from('assignments')
        .select('id, status, reconfirm_requested_at, reconfirmed_at')
        .eq('confirmation_token', token)
        .single()

      if (lookupError || !assignment) {
        return res.status(404).json({ error: 'Assignment not found or link expired' })
      }

      // Reconfirmation: worker taps "I'm still coming" on an already-confirmed shift.
      if (action === 'reconfirm') {
        if (assignment.status !== 'confirmed') {
          return res.status(200).json({ message: `Assignment is ${assignment.status}`, status: assignment.status })
        }
        if (assignment.reconfirmed_at) {
          return res.status(200).json({ message: 'Already reconfirmed', status: 'confirmed', reconfirmed: true })
        }
        const { error: rcErr } = await supabase
          .from('assignments')
          .update({ reconfirmed_at: new Date().toISOString(), updated_at: new Date().toISOString() })
          .eq('id', assignment.id)
        if (rcErr) throw rcErr
        return res.status(200).json({ message: 'Spot confirmed — see you there!', status: 'confirmed', reconfirmed: true })
      }

      // Confirm only applies to a fresh invite. Decline can also release an
      // already-confirmed shift (worker self-releasing beats ghosting).
      if (action === 'confirm' && assignment.status !== 'invited') {
        return res.status(200).json({ message: `Assignment already ${assignment.status}`, status: assignment.status })
      }
      if (action === 'decline' && !['invited', 'confirmed'].includes(assignment.status)) {
        return res.status(200).json({ message: `Assignment already ${assignment.status}`, status: assignment.status })
      }

      const newStatus = action === 'confirm' ? 'confirmed' : 'declined'

      const { error: updateError } = await supabase
        .from('assignments')
        .update({ status: newStatus, updated_at: new Date().toISOString() })
        .eq('id', assignment.id)

      if (updateError) throw updateError

      return res.status(200).json({
        message: `Assignment ${newStatus}`,
        status: newStatus,
      })
    } catch (err) {
      console.error('[confirm] Update error:', err)
      return res.status(500).json({ error: 'Failed to update assignment' })
    }
  }

  return res.status(405).json({ error: 'Method not allowed' })
}
