import { createClient } from '@supabase/supabase-js'
import { checkAdmin } from './_auth.js'

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const auth = checkAdmin(req)
  if (!auth.ok) return res.status(auth.status).json({ error: auth.error })

  const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
  )

  try {
    const [applicants, events, assignments] = await Promise.all([
      supabase.from('applicants').select('status'),
      supabase.from('events').select('status, total_bill_amount, invoice_status, payment_status'),
      supabase.from('assignments').select('status, payout_amount, payout_status'),
    ])

    if (applicants.error) throw applicants.error
    if (events.error) throw events.error
    if (assignments.error) throw assignments.error

    const countBy = (rows, field) => {
      const counts = {}
      for (const row of rows) {
        const val = row[field] || 'unknown'
        counts[val] = (counts[val] || 0) + 1
      }
      return counts
    }

    // Financial summaries
    let totalBilled = 0
    let totalPaidByClients = 0
    let totalOutstanding = 0
    for (const ev of events.data) {
      const amt = parseFloat(ev.total_bill_amount) || 0
      totalBilled += amt
      if (ev.payment_status === 'paid') totalPaidByClients += amt
      else totalOutstanding += amt
    }

    let totalPayouts = 0
    let totalPayoutsPaid = 0
    let totalPayoutsPending = 0
    for (const a of assignments.data) {
      const amt = parseFloat(a.payout_amount) || 0
      totalPayouts += amt
      if (a.payout_status === 'paid') totalPayoutsPaid += amt
      else totalPayoutsPending += amt
    }

    return res.status(200).json({
      applicants: {
        total: applicants.data.length,
        by_status: countBy(applicants.data, 'status'),
      },
      events: {
        total: events.data.length,
        by_status: countBy(events.data, 'status'),
        by_invoice_status: countBy(events.data, 'invoice_status'),
        by_payment_status: countBy(events.data, 'payment_status'),
      },
      assignments: {
        total: assignments.data.length,
        by_status: countBy(assignments.data, 'status'),
        by_payout_status: countBy(assignments.data, 'payout_status'),
      },
      financials: {
        total_billed: totalBilled,
        client_paid: totalPaidByClients,
        client_outstanding: totalOutstanding,
        total_payouts: totalPayouts,
        payouts_paid: totalPayoutsPaid,
        payouts_pending: totalPayoutsPending,
      },
    })
  } catch (err) {
    console.error('[admin/stats] Error:', err)
    return res.status(500).json({ error: 'Failed to fetch stats' })
  }
}
