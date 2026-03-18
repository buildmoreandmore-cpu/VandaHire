import { createClient } from '@supabase/supabase-js'

// Admin-only CSV export of all applicants.
// Auth: set PORTER_ADMIN_TOKEN env var, pass as Bearer token.
// Usage: curl -H "Authorization: Bearer <token>" https://yourapp.vercel.app/api/export

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  // Verify admin token
  const adminToken = process.env.PORTER_ADMIN_TOKEN
  if (!adminToken) {
    console.error('[export] PORTER_ADMIN_TOKEN not configured')
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

  try {
    const { data, error } = await supabase
      .from('applicants')
      .select('id, created_at, first_name, last_name, email, phone, city, zip, roles, availability, experience_types, availability_windows, has_transportation, short_notice, notes, score_breakdown, status, email_sent_at')
      .order('created_at', { ascending: false })

    if (error) throw error

    const csv = toCsv(data || [])

    res.setHeader('Content-Type', 'text/csv')
    res.setHeader('Content-Disposition', 'attachment; filename="porter-applicants.csv"')
    return res.status(200).send(csv)
  } catch (err) {
    console.error('[export] Query error:', err)
    return res.status(500).json({ error: 'Failed to export applicants' })
  }
}

// Convert array of objects to CSV string
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

// Escape a CSV cell value — handles commas, quotes, newlines, and arrays
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
