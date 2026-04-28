import { createClient } from '@supabase/supabase-js'

// GET /api/upcoming-events
// Public endpoint — returns featured, non-archived worker_groups whose
// event_date is today or in the future, ordered by event_date asc.
export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET')
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
    const today = new Date().toISOString().slice(0, 10)

    const { data, error } = await supabase
      .from('worker_groups')
      .select('id, code, name, description, event_date, event_end_date, event_location, event_city')
      .eq('featured', true)
      .eq('archived', false)
      .or(`event_date.gte.${today},event_end_date.gte.${today}`)
      .order('event_date', { ascending: true })
      .limit(6)

    if (error) throw error

    res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=600')
    return res.status(200).json(data || [])
  } catch (err) {
    console.error('[upcoming-events] error:', err)
    return res.status(500).json({ error: 'Failed to load upcoming events' })
  }
}
