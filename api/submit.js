import { createClient } from '@supabase/supabase-js'

const MAIN_GROUP_CODE = 'all-workers'

async function resolveGroupId(supabase, code) {
  if (!code) return null
  const { data } = await supabase
    .from('worker_groups')
    .select('id, event_date, event_end_date, evergreen')
    .eq('code', code)
    .eq('archived', false)
    .single()
  if (!data) return null
  // Skip past events so stale links can't enroll new applicants
  if (!data.evergreen) {
    const today = new Date().toISOString().slice(0, 10)
    const expiresAfter = data.event_end_date || data.event_date
    if (expiresAfter && expiresAfter < today) return null
  }
  return data.id
}

async function enrollInGroup(supabase, groupId, workerId) {
  if (!groupId || !workerId) return
  await supabase.from('worker_group_members')
    .upsert({ group_id: groupId, worker_id: workerId }, { onConflict: 'group_id,worker_id', ignoreDuplicates: true })
}

export default async function handler(req, res) {
  // GET /api/submit?upcoming=1 — public list of featured upcoming event groups
  if (req.method === 'GET' && req.query.upcoming) {
    const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
    const today = new Date().toISOString().slice(0, 10)
    const { data, error } = await supabase
      .from('worker_groups')
      .select('id, code, name, description, event_date, event_end_date, event_location, event_city, evergreen')
      .eq('featured', true)
      .eq('archived', false)
      .or(`evergreen.eq.true,event_date.gte.${today},event_end_date.gte.${today}`)
      .order('event_date', { ascending: true, nullsFirst: false })
      .limit(6)
    if (error) {
      console.error('[submit] upcoming events error:', error)
      return res.status(500).json({ error: 'Failed to load upcoming events' })
    }
    res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=600')
    return res.status(200).json(data || [])
  }

  // GET /api/submit?ongoing=1 — public list of ongoing (always-hiring) roles
  if (req.method === 'GET' && req.query.ongoing) {
    const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
    const { data, error } = await supabase
      .from('worker_groups')
      .select('id, code, name, description, event_location, event_city')
      .eq('type', 'recruitment')
      .eq('evergreen', true)
      .eq('archived', false)
      .order('created_at', { ascending: false })
      .limit(50)
    if (error) {
      console.error('[submit] ongoing roles error:', error)
      return res.status(500).json({ error: 'Failed to load ongoing roles' })
    }
    res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=600')
    return res.status(200).json(data || [])
  }

  // GET /api/submit?group_code=X — public group info for join pages
  if (req.method === 'GET') {
    const { group_code } = req.query
    if (!group_code) return res.status(400).json({ error: 'Missing group_code' })
    const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
    const { data, error } = await supabase
      .from('worker_groups')
      .select('name, description, type, bg_check_required, event_date, event_end_date, evergreen')
      .eq('code', group_code)
      .eq('archived', false)
      .single()
    if (error || !data) return res.status(404).json({ error: 'Group not found' })
    // Block past events — evergreen groups never expire; date-bound groups
    // expire the day after event_end_date (or event_date if single-day).
    if (!data.evergreen) {
      const today = new Date().toISOString().slice(0, 10)
      const expiresAfter = data.event_end_date || data.event_date
      if (expiresAfter && expiresAfter < today) {
        return res.status(410).json({ error: 'This event has already ended', ended: true, name: data.name })
      }
    }
    return res.status(200).json(data)
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const {
    first_name, last_name, email, phone, city, zip,
    roles, availability,
    experience_types, availability_windows,
    has_transportation, short_notice, notes,
    photo_base64,
    source_group_code,
    sms_consent,
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

  // 1. Check for duplicate by email or phone
  try {
    const { data: existing } = await supabase
      .from('applicants')
      .select('id, status')
      .or(`email.eq.${email},phone.eq.${phone}`)
      .limit(1)
      .single()

    if (existing) {
      // Always enroll in master roster + source event group (idempotent upserts)
      try {
        const [mainGroupId, sourceGroupId] = await Promise.all([
          resolveGroupId(supabase, MAIN_GROUP_CODE),
          resolveGroupId(supabase, source_group_code),
        ])
        await Promise.all([
          enrollInGroup(supabase, mainGroupId, existing.id),
          enrollInGroup(supabase, sourceGroupId, existing.id),
        ])
        if (sourceGroupId) {
          await supabase.from('applicants')
            .update({ source_group_id: sourceGroupId })
            .eq('id', existing.id)
            .is('source_group_id', null)
        }
      } catch (err) {
        console.error('[submit] Duplicate group enrollment error:', err)
      }
      return res.status(200).json({ success: true, applicantId: existing.id, decision: existing.status, duplicate: true })
    }
  } catch (err) {
    // No duplicate found — continue with insert
  }

  // 2. Resolve master + source groups in parallel
  const [mainGroupId, sourceGroupId] = await Promise.all([
    resolveGroupId(supabase, MAIN_GROUP_CODE),
    resolveGroupId(supabase, source_group_code),
  ])

  // 3. Write applicant to Supabase — data is never lost
  let applicantId
  try {
    const insertData = {
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
      sms_consent_at: sms_consent ? new Date().toISOString() : null,
    }
    if (sourceGroupId) insertData.source_group_id = sourceGroupId

    const { data, error } = await supabase
      .from('applicants')
      .insert(insertData)
      .select('id')
      .single()

    if (error) throw error
    applicantId = data.id
  } catch (err) {
    console.error('[submit] Supabase insert error:', err)
    return res.status(500).json({ error: 'Failed to save application' })
  }

  // 3b. Enroll in master roster + source event group (idempotent)
  try {
    await Promise.all([
      enrollInGroup(supabase, mainGroupId, applicantId),
      enrollInGroup(supabase, sourceGroupId, applicantId),
    ])
  } catch (err) {
    console.error('[submit] Group member enroll error:', err)
  }

  // 3. Upload photo to Supabase Storage if provided
  let photoUrl = null
  if (photo_base64) {
    try {
      const base64Data = photo_base64.replace(/^data:image\/\w+;base64,/, '')
      const buffer = Buffer.from(base64Data, 'base64')
      const filePath = `${applicantId}.jpg`

      const { error: uploadError } = await supabase.storage
        .from('applicant-photos')
        .upload(filePath, buffer, {
          contentType: 'image/jpeg',
          upsert: true,
        })

      if (uploadError) throw uploadError

      const { data: urlData } = supabase.storage
        .from('applicant-photos')
        .getPublicUrl(filePath)

      photoUrl = urlData.publicUrl

      await supabase
        .from('applicants')
        .update({ photo_url: photoUrl })
        .eq('id', applicantId)
    } catch (err) {
      console.error('[submit] Photo upload error:', err)
      // Non-blocking — application still saved
    }
  }

  // 4. Score the applicant via AI
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

  // 5. Store score but keep status as pending — gives admin 12hrs to manually review
  //    If no action taken, the cron auto-decides based on the score
  try {
    await supabase
      .from('applicants')
      .update({
        score_breakdown: scoreBreakdown,
        status: 'pending',
      })
      .eq('id', applicantId)
  } catch (err) {
    console.error('[submit] Supabase score update error:', err)
  }

  // 6. Send confirmation to applicant (non-blocking)
  const siteUrl = process.env.VITE_APP_URL || 'https://vandahire.com'
  const { sendSms } = await import('../_lib/sms.js').catch(() => ({ sendSms: null }))
  const { sendEmail } = await import('../_lib/email.js').catch(() => ({ sendEmail: null }))

  if (sendEmail && email) {
    try {
      await sendEmail({
        to: email,
        subject: 'Application Received — Vanda Hire',
        html: `<h2>Thanks for applying, ${first_name}!</h2><p>We've received your application and our team will review it shortly. You'll hear back within 12 hours.</p><p style="color:#888;font-size:14px;">— The Vanda Hire Team</p>`,
      })
    } catch (e) {
      console.error('[submit] Confirmation email error:', e.message)
    }
  }

  // 7. Waitlist referral SMS — turn every signup into a recruiter (sent regardless of status)
  if (sendSms && phone) {
    try {
      await sendSms(phone, `You're on the Vanda Hire ${city || 'Atlanta'} list, ${first_name}. We'll text you when events match your role.\n\nWant to move up? Send us 2 friends who'd be great workers — just reply with their names and numbers. We'll prioritize you for the next event.`)
    } catch (e) {
      console.error('[submit] Referral SMS error:', e.message)
    }
  }

  return res.status(200).json({ success: true, applicantId, decision })
}
