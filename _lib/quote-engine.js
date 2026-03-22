// AI-powered Quote Engine
// Determines bill rate, margin, and fees based on event type, size, urgency, and roles
// Varist & Associates of GA LLC margin target: 40-50%

const DEFAULT_PAY_RATES = {
  bartender: 22, mixologist: 24, server: 18, waiter: 18, waitress: 18,
  'brand ambassador': 20, security: 20, bouncer: 20, valet: 18,
  setup: 16, teardown: 16, 'setup/teardown': 16, cleanup: 16, janitorial: 16,
  warehouse: 16, labor: 16, 'general labor': 16, registration: 17,
  usher: 16, runner: 16, 'food runner': 17, busser: 16, host: 18, hostess: 18,
  'event staff': 17, 'catering support': 17, 'crowd control': 18,
}

const PREMIUM_ROLES = new Set(['bartender', 'mixologist', 'brand ambassador', 'host', 'hostess', 'security', 'bouncer'])
const STANDARD_ROLES = new Set(['server', 'waiter', 'waitress', 'registration', 'valet', 'catering support', 'event staff', 'crowd control', 'food runner'])
// Everything else is basic

const PREMIUM_KEYWORDS = ['wedding', 'gala', 'vip', 'corporate', 'executive', 'luxury', 'black tie', 'private dinner']
const STANDARD_KEYWORDS = ['concert', 'festival', 'conference', 'trade show', 'convention', 'activation']
const BASIC_KEYWORDS = ['warehouse', 'cleanup', 'teardown', 'setup', 'load-in', 'breakdown']

/**
 * Assess event complexity and determine margin
 * @returns {{ margin: number, tier: string, rationale: string }}
 */
export function assessEvent({ title = '', role_types = [], workers_needed = 1, event_date, service_type }) {
  const titleLower = (title || '').toLowerCase()
  const roles = (role_types || []).map(r => r.toLowerCase())
  const needed = parseInt(workers_needed) || 1

  // Base margin from roles
  let baseMargin = 0.43 // default standard
  let tier = 'standard'
  const premiumCount = roles.filter(r => PREMIUM_ROLES.has(r)).length
  const standardCount = roles.filter(r => STANDARD_ROLES.has(r)).length
  const totalRoles = roles.length || 1

  if (premiumCount / totalRoles >= 0.5) {
    baseMargin = 0.48
    tier = 'premium'
  } else if (standardCount / totalRoles >= 0.5) {
    baseMargin = 0.45
    tier = 'standard'
  } else {
    baseMargin = 0.42
    tier = 'basic'
  }

  // Title keyword adjustments
  if (PREMIUM_KEYWORDS.some(k => titleLower.includes(k))) {
    baseMargin = Math.max(baseMargin, 0.47)
    if (tier !== 'premium') tier = 'premium'
  } else if (BASIC_KEYWORDS.some(k => titleLower.includes(k))) {
    baseMargin = Math.min(baseMargin, 0.42)
    if (tier === 'premium') tier = 'standard'
  }

  // Urgency adjustment
  let urgencyAdj = 0
  if (event_date) {
    const daysOut = Math.floor((new Date(event_date + 'T00:00:00') - new Date()) / 86400000)
    if (daysOut < 3) { urgencyAdj = 0.03; tier = 'urgent' }
    else if (daysOut < 7) urgencyAdj = 0.01
  }

  // Volume adjustment
  let volumeAdj = 0
  if (needed >= 15) volumeAdj = -0.02
  else if (needed <= 3) volumeAdj = 0.02

  // Clamp to 40-50%
  const margin = Math.min(0.50, Math.max(0.40, baseMargin + urgencyAdj + volumeAdj))

  const reasons = []
  if (tier === 'premium') reasons.push('premium event type')
  if (tier === 'urgent') reasons.push('short notice (<3 days)')
  if (needed >= 15) reasons.push('volume discount')
  if (needed <= 3) reasons.push('small crew premium')
  const rationale = reasons.length ? reasons.join(', ') : 'standard event'

  return { margin: Math.round(margin * 100) / 100, tier, rationale }
}

/**
 * Determine worker pay rate from event data
 */
export function determinePayRate(role_types = [], pay_rate_str = '') {
  // Try parsing the pay_rate string from the event form
  if (pay_rate_str) {
    const match = pay_rate_str.replace(/[^0-9.]/g, '')
    const parsed = parseFloat(match)
    if (parsed > 0) return parsed
  }

  // Fall back to role-based default
  const roles = (role_types || []).map(r => r.toLowerCase())
  for (const role of roles) {
    if (DEFAULT_PAY_RATES[role]) return DEFAULT_PAY_RATES[role]
  }
  return 18 // Default
}

/**
 * Calculate hours from start/end time strings (HH:MM format)
 */
export function calculateHours(start_time, end_time) {
  if (!start_time || !end_time) return 4 // default 4 hours
  const [sh, sm] = start_time.split(':').map(Number)
  const [eh, em] = end_time.split(':').map(Number)
  let hours = (eh + em / 60) - (sh + sm / 60)
  if (hours <= 0) hours += 24 // overnight
  return Math.round(hours * 100) / 100
}

/**
 * Surge pricing multiplier based on date, lead time, and crew size
 * @param {string} event_date - YYYY-MM-DD
 * @param {string} created_at - ISO timestamp of when the request was made (or now)
 * @param {number} workers_needed
 * @returns {{ multiplier: number, reasons: string[] }}
 */
export function getSurgeMultiplier(event_date, created_at, workers_needed) {
  const reasons = []
  let multiplier = 1.0

  if (!event_date) return { multiplier, reasons }

  const eventDay = new Date(event_date + 'T00:00:00')
  const dayOfWeek = eventDay.getDay() // 0=Sun, 5=Fri, 6=Sat

  // Holiday weekends: Memorial Day, July 4th, Labor Day, NYE
  const month = eventDay.getMonth() // 0-indexed
  const date = eventDay.getDate()
  const year = eventDay.getFullYear()

  // Check major holidays
  const isHoliday = (
    (month === 11 && date === 31) || // NYE
    (month === 0 && date === 1) ||   // New Year's Day
    (month === 6 && (date >= 3 && date <= 5)) || // July 4th weekend
    isMemorialDayWeekend(year, month, date) ||
    isLaborDayWeekend(year, month, date)
  )

  if (isHoliday) {
    multiplier *= 1.5
    reasons.push('holiday weekend (1.5x)')
  } else if (dayOfWeek === 5 || dayOfWeek === 6) {
    // Friday or Saturday
    multiplier *= 1.2
    reasons.push('weekend event (1.2x)')
  }

  // Rush fee: <48hr notice
  const now = created_at ? new Date(created_at) : new Date()
  const hoursNotice = (eventDay.getTime() - now.getTime()) / 3600000
  if (hoursNotice < 48 && hoursNotice > 0) {
    multiplier *= 1.3
    reasons.push('rush fee <48hr notice (1.3x)')
  }

  // Large crew premium: >20 workers
  const needed = parseInt(workers_needed) || 1
  if (needed > 20) {
    multiplier *= 1.1
    reasons.push('large crew >20 workers (1.1x)')
  }

  return { multiplier: Math.round(multiplier * 100) / 100, reasons }
}

function isMemorialDayWeekend(year, month, date) {
  if (month !== 4) return false // May
  // Memorial Day = last Monday of May
  const lastDay = new Date(year, 5, 0).getDate() // last day of May
  let lastMonday = lastDay
  while (new Date(year, 4, lastMonday).getDay() !== 1) lastMonday--
  // Weekend is Sat-Mon
  return date >= lastMonday - 2 && date <= lastMonday
}

function isLaborDayWeekend(year, month, date) {
  if (month !== 8) return false // September
  // Labor Day = first Monday of September
  let firstMonday = 1
  while (new Date(year, 8, firstMonday).getDay() !== 1) firstMonday++
  // Weekend is Sat-Mon
  return date >= firstMonday - 2 && date <= firstMonday
}

/**
 * Generate a complete auto-quote from event data
 */
export function generateAutoQuote(event) {
  const {
    title, role_types = [], workers_needed = 1, event_date,
    start_time, end_time, pay_rate, service_type,
  } = event

  const needed = parseInt(workers_needed) || 1
  const hours = calculateHours(start_time, end_time)
  const workerPayRate = determinePayRate(role_types, pay_rate)

  // Assess event to get margin
  const assessment = assessEvent({ title, role_types, workers_needed: needed, event_date, service_type })
  const baseBillRate = round(workerPayRate / (1 - assessment.margin))

  // Apply surge pricing multiplier
  const surge = getSurgeMultiplier(event_date, event.created_at, needed)
  const billRate = round(baseBillRate * surge.multiplier)

  // Supervisor fee based on crew size
  let supervisorFee = 150
  if (needed >= 6 && needed <= 15) supervisorFee = 200
  else if (needed > 15) supervisorFee = 250

  // Bench pool: 20% of workers, minimum 1, × $25 standby fee
  const benchSize = Math.max(1, Math.ceil(needed * 0.2))
  const benchFee = round(benchSize * 25)

  // Platform fee: 5% of labor subtotal
  const laborSubtotal = round(needed * hours * billRate)
  const platformFee = round(laborSubtotal * 0.05)

  // Roster hold: $10 per worker
  const rosterHoldFee = round(needed * 10)

  return {
    worker_count: needed,
    hours_estimated: hours,
    bill_rate_per_hour: billRate,
    pay_rate_per_hour: workerPayRate,
    supervisor_fee: supervisorFee,
    bench_fee: benchFee,
    platform_fee: platformFee,
    roster_hold_fee: rosterHoldFee,
    margin: assessment.margin,
    margin_tier: assessment.tier,
    margin_rationale: assessment.rationale,
    surge_multiplier: surge.multiplier,
    surge_reasons: surge.reasons,
  }
}

function round(n) {
  return Math.round(n * 100) / 100
}
