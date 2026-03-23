import { createClient } from '@supabase/supabase-js'

// GET ?token= → fetch survey info
// POST { token, ... } → submit survey response
export default async function handler(req, res) {
  const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)

  // GET — validate token, return event + worker info
  if (req.method === 'GET') {
    const { token } = req.query
    if (!token) return res.status(400).json({ error: 'token is required' })

    try {
      const { data: survey, error } = await supabase
        .from('surveys')
        .select('id, token, submitted_at, events ( title, event_date, city ), applicants ( first_name, last_name )')
        .eq('token', token)
        .maybeSingle()

      if (error) throw error
      if (!survey) return res.status(404).json({ error: 'Survey not found' })
      if (survey.submitted_at) return res.status(400).json({ error: 'already_submitted', message: 'This survey has already been submitted.' })
      if (survey.events?.event_date && new Date(survey.events.event_date + 'T23:59:59') > new Date()) {
        return res.status(400).json({ error: 'event_not_completed', message: 'This survey is not available yet — the event has not taken place.' })
      }

      return res.status(200).json({ survey_id: survey.id, event: survey.events, worker: survey.applicants })
    } catch (err) {
      console.error('[survey GET] Error:', err)
      return res.status(500).json({ error: 'Failed to load survey' })
    }
  }

  // POST — submit survey response
  if (req.method === 'POST') {
    const { token, showed_up, rating, would_work_again, issues, feedback } = req.body
    if (!token) return res.status(400).json({ error: 'token is required' })

    try {
      const { data: survey, error: findError } = await supabase
        .from('surveys')
        .select('id, submitted_at, events ( event_date )')
        .eq('token', token)
        .maybeSingle()

      if (findError) throw findError
      if (!survey) return res.status(404).json({ error: 'Survey not found' })
      if (survey.submitted_at) return res.status(400).json({ error: 'already_submitted', message: 'This survey has already been submitted.' })
      if (survey.events?.event_date && new Date(survey.events.event_date + 'T23:59:59') > new Date()) {
        return res.status(400).json({ error: 'event_not_completed', message: 'This survey cannot be submitted yet — the event has not taken place.' })
      }

      const { error: updateError } = await supabase
        .from('surveys')
        .update({
          showed_up: showed_up ?? null,
          rating: rating ? parseInt(rating, 10) : null,
          would_work_again: would_work_again ?? null,
          issues: issues || '',
          feedback: feedback || '',
          submitted_at: new Date().toISOString(),
        })
        .eq('id', survey.id)

      if (updateError) throw updateError
      return res.status(200).json({ success: true })
    } catch (err) {
      console.error('[survey POST] Error:', err)
      return res.status(500).json({ error: 'Failed to submit survey' })
    }
  }

  return res.status(405).json({ error: 'Method not allowed' })
}
