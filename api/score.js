/**
 * Rules-based applicant scoring.
 * Evaluates structured screening data with a point system.
 * Returns: qualified | needs_review | not_a_fit
 */
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { applicant, screening } = req.body
  let score = 0
  const reasons = []

  // ── Experience (0-3 pts) ──
  const exp = screening.experience_types || []
  const strongExp = ['event_staffing', 'warehouse', 'cleaning', 'food_service', 'labor', 'hospitality', 'construction', 'security']
  const hasStrongExp = exp.some(e => strongExp.includes(e))

  if (hasStrongExp) {
    score += 3
    reasons.push('Relevant experience')
  } else if (exp.length > 0 && !exp.includes('none')) {
    score += 1
    reasons.push('Some experience')
  } else {
    reasons.push('No prior experience')
  }

  // ── Transportation (0-2 pts) ──
  if (screening.has_transportation === 'yes') {
    score += 2
    reasons.push('Has transportation')
  } else {
    reasons.push('No reliable transportation')
  }

  // ── Short notice availability (0-2 pts) ──
  if (screening.short_notice === 'yes') {
    score += 2
    reasons.push('Available on short notice')
  }

  // ── Shift windows (0-2 pts) ──
  const windows = screening.availability_windows || []
  if (windows.length >= 3) {
    score += 2
    reasons.push('Broad shift availability')
  } else if (windows.length >= 1) {
    score += 1
  }

  // ── Roles (0-1 pt) ──
  const roles = applicant.roles || []
  if (roles.length >= 2) {
    score += 1
    reasons.push('Multiple roles')
  }

  // ── Decision ──
  // Max score: 10
  // 6+ = qualified, 3-5 = needs_review, 0-2 = not_a_fit
  let decision
  if (score >= 6) {
    decision = 'qualified'
  } else if (score >= 3) {
    decision = 'needs_review'
  } else {
    decision = 'not_a_fit'
  }

  return res.status(200).json({
    decision,
    score,
    reasoning: reasons.join('. ') + '.',
  })
}
