import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })

  const { phone } = req.query
  if (!phone) return res.status(400).json({ error: 'phone is required' })

  // Normalize: strip non-digits
  const digits = phone.replace(/\D/g, '')

  const { data, error } = await supabase
    .from('applicants')
    .select('id, status')
    .or(`phone.eq.${digits},phone.eq.+1${digits}`)
    .maybeSingle()

  if (error) {
    console.error('worker/status error:', error)
    return res.status(500).json({ error: 'Database error' })
  }

  if (!data) {
    return res.status(200).json({ found: false })
  }

  return res.status(200).json({ found: true, status: data.status })
}
