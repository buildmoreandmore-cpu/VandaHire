import { createClient } from '@supabase/supabase-js'

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const {
    first_name, last_name, email, phone, city, zip,
    roles, availability,
    experience_types, availability_windows,
    has_transportation, short_notice, notes,
  } = req.body

  // Basic validation
  if (!first_name || !last_name || !email || !phone || !city || !zip) {
    return res.status(400).json({ error: 'Missing required fields' })
  }
  if (!experience_types?.length || !availability_windows?.length || !has_transportation || !short_notice) {
    return res.status(400).json({ error: 'Please complete all screening fields' })
  }

  const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
  )

  // 1. Write applicant to Supabase first — data is never lost
  let applicantId
  try {
    const { data, error } = await supabase
      .from('applicants')
      .insert({
        first_name,
        last_name,
        email,
        phone,
        city,
        zip,
        roles: roles || [],
        availability: availability || [],
        experience_types: experience_types || [],
        availability_windows: availability_windows || [],
        has_transportation: has_transportation || '',
        short_notice: short_notice || '',
        notes: notes || '',
        status: 'pending',
      })
      .select('id')
      .single()

    if (error) throw error
    applicantId = data.id
  } catch (err) {
    console.error('[submit] Supabase insert error:', err)
    return res.status(500).json({ error: 'Failed to save application' })
  }

  // 2. Score the applicant via AI
  let decision = 'needs_review'
  let scoreBreakdown = {}

  try {
    const scoreRes = await fetch(`${process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000'}/api/score`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        applicant: { first_name, last_name, city, zip, roles, availability },
        screening: { experience_types, availability_windows, has_transportation, short_notice, notes },
      }),
    })

    if (scoreRes.ok) {
      const result = await scoreRes.json()
      decision = result.decision ?? 'needs_review'
      scoreBreakdown = result
    } else {
      console.error('[submit] Scoring failed, defaulting to needs_review')
    }
  } catch (err) {
    console.error('[submit] Scoring error:', err)
  }

  // 3. Update Supabase with score + decision
  try {
    await supabase
      .from('applicants')
      .update({
        score_breakdown: scoreBreakdown,
        status: decision,
      })
      .eq('id', applicantId)
  } catch (err) {
    console.error('[submit] Supabase score update error:', err)
  }

  // 4. Send email
  try {
    const emailRes = await fetch(`${process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000'}/api/email`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ first_name, email, status: decision }),
    })

    if (emailRes.ok) {
      await supabase
        .from('applicants')
        .update({ email_sent_at: new Date().toISOString() })
        .eq('id', applicantId)
    } else {
      console.error('[submit] Email send failed')
    }
  } catch (err) {
    console.error('[submit] Email error:', err)
  }

  return res.status(200).json({ success: true, applicantId })
}
