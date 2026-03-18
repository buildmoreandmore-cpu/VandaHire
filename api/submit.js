import { createClient } from '@supabase/supabase-js'

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const {
    first_name, last_name, email, phone, city, zip,
    roles, availability,
    instagram_connected, facebook_connected, tiktok_connected, linkedin_connected,
    instagram_data, facebook_data, tiktok_data, linkedin_data,
  } = req.body

  // Basic validation
  if (!first_name || !last_name || !email || !phone || !city || !zip) {
    return res.status(400).json({ error: 'Missing required fields' })
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
        instagram_connected: !!instagram_connected,
        facebook_connected: !!facebook_connected,
        tiktok_connected: !!tiktok_connected,
        linkedin_connected: !!linkedin_connected,
        instagram_data: instagram_data || null,
        facebook_data: facebook_data || null,
        tiktok_data: tiktok_data || null,
        linkedin_data: linkedin_data || null,
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

  // 2. Score the applicant (server-side, non-blocking from client perspective)
  let score = 60
  let scoreBreakdown = {}
  let status = 'declined'

  try {
    const scoreRes = await fetch(`${process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000'}/api/score`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        applicant: { first_name, last_name, city, zip },
        social: { instagram_data, facebook_data, tiktok_data, linkedin_data },
      }),
    })

    if (scoreRes.ok) {
      const result = await scoreRes.json()
      score = result.final_score ?? 60
      scoreBreakdown = result
      status = result.status ?? 'declined'
    } else {
      console.error('[submit] Scoring failed, defaulting to declined')
    }
  } catch (err) {
    console.error('[submit] Scoring error:', err)
    // Default: score 60, status declined, still send email
  }

  // 3. Update Supabase with score + status
  try {
    await supabase
      .from('applicants')
      .update({
        ai_score: score,
        score_breakdown: scoreBreakdown,
        status,
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
      body: JSON.stringify({ first_name, email, status }),
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
