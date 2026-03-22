import { createClient } from '@supabase/supabase-js'
import { findByPhone } from '../_lib/phone.js'

// GET ?type=worker&phone= → applicant status
// GET ?type=organizer&email= → event request list
export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })

  const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
  const { type, phone, email } = req.query

  if (type === 'worker') {
    if (!phone) return res.status(400).json({ error: 'phone is required' })
    try {
      const data = await findByPhone(supabase, phone, 'id, status')
      if (!data) return res.status(200).json({ found: false })
      return res.status(200).json({ found: true, status: data.status })
    } catch (error) {
      console.error('status/worker error:', error)
      return res.status(500).json({ error: 'Database error' })
    }
  }

  if (type === 'organizer') {
    if (!email) return res.status(400).json({ error: 'email is required' })
    const { data, error } = await supabase
      .from('events')
      .select('id, title, event_date, city, workers_needed, status, total_bill_amount, payment_status, stripe_payment_url, service_tier')
      .ilike('contact_email', email.trim())
      .order('event_date', { ascending: false })

    if (error) { console.error('status/organizer error:', error); return res.status(500).json({ error: 'Database error' }) }
    return res.status(200).json({ events: data || [] })
  }

  return res.status(400).json({ error: 'type must be worker or organizer' })
}
