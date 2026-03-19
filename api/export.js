import { createClient } from '@supabase/supabase-js'

// Admin CSV export. Supports: applicants (default), events, assignments.
// Auth: set VANDA_ADMIN_TOKEN env var, pass as Bearer token.
// Usage: curl -H "Authorization: Bearer <token>" https://yourapp.vercel.app/api/export?type=applicants

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const adminToken = process.env.VANDA_ADMIN_TOKEN
  if (!adminToken) {
    console.error('[export] VANDA_ADMIN_TOKEN not configured')
    return res.status(500).json({ error: 'Export not configured' })
  }

  const authHeader = req.headers.authorization
  if (!authHeader || authHeader !== `Bearer ${adminToken}`) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
  )

  const exportType = req.query.type || 'applicants'

  try {
    let data, filename

    if (exportType === 'events') {
      const result = await supabase
        .from('events')
        .select('*')
        .order('event_date', { ascending: true })
      if (result.error) throw result.error
      data = result.data || []
      filename = 'vanda-events.csv'

    } else if (exportType === 'assignments') {
      const result = await supabase
        .from('assignments')
        .select(`
          id, created_at, status, notes, event_id, worker_id,
          pay_rate, hours_worked, payout_amount, payout_status,
          events ( title, event_date, city ),
          applicants ( first_name, last_name, email, phone )
        `)
        .order('created_at', { ascending: false })
      if (result.error) throw result.error
      // Flatten joined data
      data = (result.data || []).map(row => ({
        id: row.id,
        created_at: row.created_at,
        status: row.status,
        notes: row.notes,
        event_id: row.event_id,
        event_title: row.events?.title,
        event_date: row.events?.event_date,
        event_city: row.events?.city,
        worker_id: row.worker_id,
        worker_name: `${row.applicants?.first_name || ''} ${row.applicants?.last_name || ''}`.trim(),
        worker_email: row.applicants?.email,
        worker_phone: row.applicants?.phone,
        pay_rate: row.pay_rate,
        hours_worked: row.hours_worked,
        payout_amount: row.payout_amount,
        payout_status: row.payout_status,
      }))
      filename = 'vanda-assignments.csv'

    } else {
      // Default: applicants
      const result = await supabase
        .from('applicants')
        .select('id, created_at, first_name, last_name, email, phone, city, zip, roles, availability, experience_types, availability_windows, has_transportation, short_notice, notes, photo_url, score_breakdown, status, email_sent_at')
        .order('created_at', { ascending: false })
      if (result.error) throw result.error
      data = result.data || []
      filename = 'vanda-applicants.csv'
    }

    const csv = toCsv(data)

    res.setHeader('Content-Type', 'text/csv')
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`)
    return res.status(200).send(csv)
  } catch (err) {
    console.error('[export] Query error:', err)
    return res.status(500).json({ error: 'Failed to export data' })
  }
}

function toCsv(rows) {
  if (rows.length === 0) return ''
  const headers = Object.keys(rows[0])
  const lines = [
    headers.join(','),
    ...rows.map(row =>
      headers.map(h => escapeCell(row[h])).join(',')
    ),
  ]
  return lines.join('\n')
}

function escapeCell(value) {
  if (value === null || value === undefined) return ''
  if (typeof value === 'object' && !Array.isArray(value)) value = JSON.stringify(value)
  if (Array.isArray(value)) value = value.join('; ')
  const str = String(value)
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`
  }
  return str
}
