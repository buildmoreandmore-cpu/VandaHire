import { createClient } from '@supabase/supabase-js'
import { checkAdmin } from './_auth.js'

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const auth = checkAdmin(req)
  if (!auth.ok) return res.status(auth.status).json({ error: auth.error })

  const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
  )

  try {
    const [applicants, events, assignments] = await Promise.all([
      supabase.from('applicants').select('status'),
      supabase.from('events').select('status'),
      supabase.from('assignments').select('status'),
    ])

    if (applicants.error) throw applicants.error
    if (events.error) throw events.error
    if (assignments.error) throw assignments.error

    const countBy = (rows, field) => {
      const counts = {}
      for (const row of rows) {
        const val = row[field] || 'unknown'
        counts[val] = (counts[val] || 0) + 1
      }
      return counts
    }

    return res.status(200).json({
      applicants: {
        total: applicants.data.length,
        by_status: countBy(applicants.data, 'status'),
      },
      events: {
        total: events.data.length,
        by_status: countBy(events.data, 'status'),
      },
      assignments: {
        total: assignments.data.length,
        by_status: countBy(assignments.data, 'status'),
      },
    })
  } catch (err) {
    console.error('[admin/stats] Error:', err)
    return res.status(500).json({ error: 'Failed to fetch stats' })
  }
}
