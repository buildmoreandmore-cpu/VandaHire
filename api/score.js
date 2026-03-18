import Anthropic from '@anthropic-ai/sdk'

/**
 * AI-powered applicant scoring using Claude.
 * Evaluates screening answers + applicant info.
 * Returns: qualified | needs_review | not_a_fit
 */
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { applicant, answers } = req.body

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
- Availability: ${(applicant.availability || []).join(', ') || 'none selected'}

SCREENING ANSWERS:
1. What work have you done before like this?
${answers.answer_experience}

2. What days/times are you available?
${answers.answer_availability}

3. Why would you be reliable for shift-based work?
${answers.answer_reliability}

DECISION CRITERIA:
- "qualified": Answers show relevant experience or willingness, availability aligns with shift work, and reliability answer is specific/credible.
- "needs_review": Answers are vague but not disqualifying, or there's a mix of positive and unclear signals.
- "not_a_fit": Answers show no relevant experience AND no willingness to learn, availability doesn't fit shift work, or answers are clearly low-effort/spam.

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
