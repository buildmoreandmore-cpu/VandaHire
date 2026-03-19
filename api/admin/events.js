import { createClient } from '@supabase/supabase-js'
import { checkAdmin } from './_auth.js'

export default async function handler(req, res) {
  const auth = checkAdmin(req)
  if (!auth.ok) return res.status(auth.status).json({ error: auth.error })

  const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
  )

  // GET — list events with optional status filter
  if (req.method === 'GET') {
    try {
      let query = supabase
        .from('events')
        .select('*')
        .order('event_date', { ascending: true })

      const { status } = req.query
      if (status && status !== 'all') {
        query = query.eq('status', status)
      }

      const { data, error } = await query
      if (error) throw error
      return res.status(200).json(data)
    } catch (err) {
      console.error('[admin/events] Query error:', err)
      return res.status(500).json({ error: 'Failed to fetch events' })
    }
  }

  // PATCH — update event status and/or billing fields
  if (req.method === 'PATCH') {
    const { id, status, bill_rate, total_bill_amount, invoice_status, payment_status } = req.body
    if (!id) {
      return res.status(400).json({ error: 'id required' })
    }

    const validStatuses = ['pending', 'approved', 'awaiting_payment', 'staffing', 'confirmed', 'completed', 'cancelled']
    const validInvoiceStatuses = ['not_sent', 'sent', 'paid', 'overdue']
    const validPaymentStatuses = ['unpaid', 'partial', 'paid']

    const updates = { updated_at: new Date().toISOString() }

    if (status !== undefined) {
      if (!validStatuses.includes(status)) {
        return res.status(400).json({ error: `Invalid status. Must be one of: ${validStatuses.join(', ')}` })
      }
      updates.status = status
    }
    if (bill_rate !== undefined) updates.bill_rate = bill_rate
    if (total_bill_amount !== undefined) updates.total_bill_amount = total_bill_amount
    if (invoice_status !== undefined) {
      if (!validInvoiceStatuses.includes(invoice_status)) {
        return res.status(400).json({ error: `Invalid invoice_status. Must be one of: ${validInvoiceStatuses.join(', ')}` })
      }
      updates.invoice_status = invoice_status
    }
    if (payment_status !== undefined) {
      if (!validPaymentStatuses.includes(payment_status)) {
        return res.status(400).json({ error: `Invalid payment_status. Must be one of: ${validPaymentStatuses.join(', ')}` })
      }
      updates.payment_status = payment_status
    }

    if (Object.keys(updates).length === 1) {
      return res.status(400).json({ error: 'No fields to update' })
    }

    try {
      const { data, error } = await supabase
        .from('events')
        .update(updates)
        .eq('id', id)
        .select()
        .single()

      if (error) throw error
      return res.status(200).json(data)
    } catch (err) {
      console.error('[admin/events] Update error:', err)
      return res.status(500).json({ error: 'Failed to update event' })
    }
  }

  return res.status(405).json({ error: 'Method not allowed' })
}
