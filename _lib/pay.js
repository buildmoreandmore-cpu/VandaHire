// Pay Rules Engine + Refund Calculator
// Pure utility — no DB access

/**
 * Calculate worker pay based on exit reason
 * @param {Object} params
 * @param {string} params.exit_reason - Why the worker left
 * @param {number} params.hours_worked - Actual hours on site
 * @param {number} params.pay_rate - $/hr for worker
 * @param {number} params.scheduled_hours - Original shift length
 * @returns {{ pay_amount: number, strikes: number, flag_organizer: boolean }}
 */
export function calculatePay({ exit_reason, hours_worked, pay_rate, scheduled_hours }) {
  const rate = parseFloat(pay_rate) || 0
  const worked = parseFloat(hours_worked) || 0
  const scheduled = parseFloat(scheduled_hours) || 0

  switch (exit_reason) {
    case 'completed':
      return { pay_amount: round(scheduled * rate), strikes: 0, flag_organizer: false }

    case 'early_with_notice':
    case 'done':
      return { pay_amount: round(worked * rate), strikes: 0, flag_organizer: false }

    case 'break_return':
      // Treated as a break — paid full shift
      return { pay_amount: round(scheduled * rate), strikes: 0, flag_organizer: false }

    case 'no_response':
      return { pay_amount: round(worked * rate), strikes: 2, flag_organizer: false }

    case 'emergency':
      return { pay_amount: round(worked * rate), strikes: 0, flag_organizer: false }

    case 'released_performance':
      return { pay_amount: round(worked * rate), strikes: 1, flag_organizer: false }

    case 'released_downsized':
    case 'released_client_request':
      // 3-hour minimum guarantee for no-fault releases
      return { pay_amount: round(Math.max(worked, 3) * rate), strikes: 0, flag_organizer: false }

    case 'released_unsafe':
      // Full scheduled pay — flag organizer for unsafe conditions
      return { pay_amount: round(scheduled * rate), strikes: 0, flag_organizer: true }

    default:
      // Unknown reason — pay for hours worked, no strikes
      return { pay_amount: round(worked * rate), strikes: 0, flag_organizer: false }
  }
}

/**
 * Calculate cancellation refund based on days before event
 * @param {Object} params
 * @param {number} params.deposit_amount - Amount paid as deposit
 * @param {number} params.days_before_event - Days until event date
 * @returns {{ refund_amount: number, refund_pct: number, reason: string }}
 */
export function calculateRefund({ deposit_amount, days_before_event }) {
  const deposit = parseFloat(deposit_amount) || 0
  const days = parseFloat(days_before_event) || 0

  if (days >= 7) {
    return { refund_amount: round(deposit * 0.95), refund_pct: 95, reason: '95% refund (5% processing fee)' }
  }
  if (days >= 3) {
    return { refund_amount: round(deposit * 0.50), refund_pct: 50, reason: '50% refund (3-6 days notice)' }
  }
  if (days >= 1) {
    return { refund_amount: round(deposit * 0.25), refund_pct: 25, reason: '25% refund (24-72hrs notice)' }
  }
  return { refund_amount: 0, refund_pct: 0, reason: 'No refund (less than 24hrs notice)' }
}

/**
 * Calculate quote breakdown with deposit = bench fees + labor + roster hold
 * Balance = total - deposit, due Net 15 after event
 * @param {Object} params
 * @returns {Object} Quote line items + deposit/balance split
 */
export function calculateQuote({
  worker_count,
  hours_estimated,
  bill_rate_per_hour,
  supervisor_fee = 0,
  bench_fee = 0,
  platform_fee = 0,
  roster_hold_fee = 0,
}) {
  const workers = parseInt(worker_count) || 0
  const hours = parseFloat(hours_estimated) || 0
  const rate = parseFloat(bill_rate_per_hour) || 0
  const supFee = parseFloat(supervisor_fee) || 0
  const benchFee = parseFloat(bench_fee) || 0
  const platFee = parseFloat(platform_fee) || 0
  const rosterFee = parseFloat(roster_hold_fee) || 0

  const labor_subtotal = round(workers * hours * rate)
  const subtotal = labor_subtotal + supFee + benchFee + platFee + rosterFee
  const processing_fee = round(subtotal * 0.029 + 0.30) // Stripe processing
  const total = round(subtotal + processing_fee)

  // Deposit = bench standby fees + labor cost + roster hold fee
  const deposit_amount = round(benchFee + labor_subtotal + rosterFee)
  const balance_amount = round(total - deposit_amount)

  return {
    worker_count: workers,
    hours_estimated: hours,
    bill_rate_per_hour: rate,
    labor_subtotal,
    supervisor_fee: supFee,
    bench_fee: benchFee,
    platform_fee: platFee,
    roster_hold_fee: rosterFee,
    processing_fee,
    total,
    deposit_amount,
    balance_amount,
  }
}

/**
 * Calculate worker reliability score (0.00 - 5.00)
 * Drives pool tiers: Gold (4.5+), Silver (3.5+), Bronze (2.5+), Probation (<2.5)
 * @param {Object} params
 * @returns {{ score: number, tier: string }}
 */
export function calculateReliabilityScore({ shifts_completed = 0, no_shows = 0, late_arrivals = 0, early_exits = 0, avg_rating = 5 }) {
  const completed = parseInt(shifts_completed) || 0
  const noShows = parseInt(no_shows) || 0
  const lateArrivals = parseInt(late_arrivals) || 0
  const earlyExits = parseInt(early_exits) || 0
  const rating = parseFloat(avg_rating) || 5

  // Start at 5.0
  let score = 5.0

  // Deductions
  score -= noShows * 1.0       // no-shows are severe
  score -= lateArrivals * 0.3  // late arrivals moderate
  score -= earlyExits * 0.2    // early exits minor

  // Recovery: each clean shift recovers 0.1 points
  const cleanShifts = Math.max(0, completed - noShows - lateArrivals - earlyExits)
  score += cleanShifts * 0.1

  // Rating factor: blend with supervisor/client ratings
  if (completed > 0) {
    score = score * 0.7 + rating * 0.3
  }

  // Clamp to 0.00 - 5.00
  score = Math.min(5.00, Math.max(0.00, score))
  score = Math.round(score * 100) / 100

  // Determine tier
  let tier = 'probation'
  if (score >= 4.5) tier = 'gold'
  else if (score >= 3.5) tier = 'silver'
  else if (score >= 2.5) tier = 'bronze'

  return { score, tier }
}

function round(n) {
  return Math.round(n * 100) / 100
}
