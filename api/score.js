/**
 * AI-powered applicant scoring using MiniMax.
 * Evaluates structured screening data + applicant info.
 * Returns: qualified | needs_review | not_a_fit
 */
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { applicant, screening } = req.body

  // If no API key, fall back to needs_review
  if (!process.env.MINIMAX_API_KEY) {
    console.warn('[score] No MINIMAX_API_KEY set, defaulting to needs_review')
    return res.status(200).json({
      decision: 'needs_review',
      reasoning: 'AI scoring unavailable — manual review required.',
    })
  }

  const prompt = `You are an applicant screener for Vanda, an event staffing company. Workers do janitorial, cleanup, setup/breakdown, brand activation, and general labor at events.

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
    const response = await fetch('https://api.minimax.chat/v1/text/chatcompletion_v2', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.MINIMAX_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'MiniMax-Text-01',
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 200,
        temperature: 0.1,
      }),
    })

    if (!response.ok) {
      const errBody = await response.text()
      console.error('[score] MiniMax API error:', response.status, errBody)
      return res.status(200).json({
        decision: 'needs_review',
        reasoning: 'Scoring error — flagged for manual review.',
      })
    }

    const data = await response.json()
    const text = (data.choices?.[0]?.message?.content || '').trim()
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
