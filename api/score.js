import Anthropic from '@anthropic-ai/sdk'

/**
 * AI-powered applicant scoring using Claude.
 * Evaluates structured screening data + applicant info.
 * Returns: qualified | needs_review | not_a_fit
 */
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { applicant, screening } = req.body

  // If no API key, fall back to needs_review
  if (!process.env.ANTHROPIC_API_KEY) {
    console.warn('[score] No ANTHROPIC_API_KEY set, defaulting to needs_review')
    return res.status(200).json({
      decision: 'needs_review',
      reasoning: 'AI scoring unavailable — manual review required.',
    })
  }

  const prompt = `You are an applicant screener for Porter, an event staffing company. Workers do janitorial, cleanup, setup/breakdown, brand activation, and general labor at events.

Evaluate this applicant and decide: qualified, needs_review, or not_a_fit.

APPLICANT INFO:
- Name: ${applicant.first_name} ${applicant.last_name}
- Location: ${applicant.city}, ${applicant.zip}
- Roles interested in: ${(applicant.roles || []).join(', ') || 'none selected'}
- General availability: ${(applicant.availability || []).join(', ') || 'none selected'}

STRUCTURED SCREENING:
- Past experience types: ${(screening.experience_types || []).join(', ') || 'none'}
- Shift windows available: ${(screening.availability_windows || []).join(', ') || 'none'}
- Reliable transportation: ${screening.has_transportation || 'not answered'}
- Available on short notice: ${screening.short_notice || 'not answered'}
- Additional notes: ${screening.notes || 'none'}

DECISION CRITERIA:
- "qualified": Has relevant experience (event staffing, warehouse, cleaning, food service, labor, etc.) OR selected "No Experience Yet" but shows broad availability, has transportation, and is available on short notice. Good alignment between roles, availability, and shift windows.
- "needs_review": Limited availability or transportation gap, but not disqualifying. Mixed signals overall.
- "not_a_fit": No experience AND very limited availability, no transportation, and not available on short notice. Or only selected a single narrow window with no flexibility.

Respond with ONLY valid JSON (no markdown, no code fences):
{"decision": "qualified|needs_review|not_a_fit", "reasoning": "1-2 sentence explanation"}`

  try {
    const client = new Anthropic()
    const message = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 200,
      messages: [{ role: 'user', content: prompt }],
    })

    const text = message.content[0].text.trim()
    const result = JSON.parse(text)

    // Validate decision value
    const validDecisions = ['qualified', 'needs_review', 'not_a_fit']
    if (!validDecisions.includes(result.decision)) {
      result.decision = 'needs_review'
    }

    return res.status(200).json(result)
  } catch (err) {
    console.error('[score] AI scoring error:', err)
    return res.status(200).json({
      decision: 'needs_review',
      reasoning: 'Scoring error — flagged for manual review.',
    })
  }
}
