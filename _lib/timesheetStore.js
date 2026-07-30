import { buildTimesheetXlsxBase64, timesheetTotals, OFFICE_EMAILS } from './timesheet.js'
import { sendEmail } from './email.js'

// Draft timesheet days accumulate per event, then get finalized (Excel + email)
// once the event is over.

export async function listDays(supabase, eventId, status = 'draft') {
  let q = supabase.from('timesheet_days')
    .select('id, event_id, event_label, company, work_date, rows, submitter, status, image_urls, created_at')
    .eq('event_id', eventId)
    .order('created_at', { ascending: true })
  if (status) q = q.eq('status', status)
  const { data } = await q
  return data || []
}

export async function saveDay(supabase, d) {
  const row = {
    event_id: d.event_id,
    event_label: d.event_label || null,
    company: d.company || null,
    work_date: d.work_date || null,
    rows: (d.rows || []).filter(r => r && r.name),
    submitter: d.submitter || null,
    status: 'draft',
    updated_at: new Date().toISOString(),
  }
  if (d.adhoc !== undefined) row.adhoc = !!d.adhoc
  if (d.supervisor_id !== undefined) row.supervisor_id = d.supervisor_id
  if (Array.isArray(d.image_urls)) row.image_urls = d.image_urls
  if (d.id) {
    const { data, error } = await supabase.from('timesheet_days').update(row).eq('id', d.id).select().single()
    if (error) throw error
    return data
  }
  const { data, error } = await supabase.from('timesheet_days').insert(row).select().single()
  if (error) throw error
  return data
}

export async function deleteDay(supabase, id) {
  const { error } = await supabase.from('timesheet_days').delete().eq('id', id)
  if (error) throw error
}

// Gather all draft days for an event, build the combined Excel, email it, mark submitted.
export async function finalizeEvent(supabase, { event_id, signature, submitter }) {
  const days = await listDays(supabase, event_id)
  if (!days.length) throw new Error('No saved timesheet days to submit')
  if (!signature || !String(signature).trim()) throw new Error('Signature required to submit')

  const company = days.find(d => d.company)?.company || ''
  const event = days.find(d => d.event_label)?.event_label || 'Event'
  const payload = {
    company, event, associate_signature: String(signature).trim(),
    days: days.map(d => ({ date: d.work_date || '', rows: d.rows || [] })),
  }
  const totals = timesheetTotals(payload)
  const xlsxBase64 = buildTimesheetXlsxBase64(payload)
  const dateLabel = payload.days.map(d => d.date).filter(Boolean).join(', ') || 'n/a'
  const fname = `Timesheet - ${event} - ${dateLabel}`.replace(/[^\w .-]/g, '').slice(0, 80) + '.xlsx'
  const dayRowsHtml = totals.perDay.map(d => `<tr><td style="padding:4px 10px;border:1px solid #eee">${d.date || '—'}</td><td style="padding:4px 10px;border:1px solid #eee">${d.workers}</td><td style="padding:4px 10px;border:1px solid #eee">${d.total}</td></tr>`).join('')
  const html = `<div style="font-family:Arial,sans-serif;max-width:640px;margin:0 auto;padding:20px"><h2 style="margin:0 0 4px">Timesheet Submitted — ${event}</h2><p style="color:#555;margin:0 0 16px">Signed off by <strong>${payload.associate_signature}</strong>${submitter ? ` (via ${submitter})` : ''} · Company: ${company || '—'} · ${payload.days.length} day(s)</p><table style="border-collapse:collapse;font-size:14px;margin-bottom:12px"><tr><th style="padding:4px 10px;border:1px solid #eee;text-align:left">Date</th><th style="padding:4px 10px;border:1px solid #eee">Workers</th><th style="padding:4px 10px;border:1px solid #eee">Hours</th></tr>${dayRowsHtml}<tr><td style="padding:4px 10px;border:1px solid #eee;font-weight:bold" colspan="2">Grand Total</td><td style="padding:4px 10px;border:1px solid #eee;font-weight:bold">${totals.grand}</td></tr></table><p style="color:#555;font-size:13px">Full timesheet attached as Excel (one sheet per day${payload.days.length > 1 ? ' + Summary' : ''}).</p></div>`

  await sendEmail({ to: OFFICE_EMAILS, subject: `Timesheet: ${event} — ${dateLabel} (${totals.grand} hrs)`, html, attachments: [{ filename: fname, content: xlsxBase64 }] })

  const ids = days.map(d => d.id)
  await supabase.from('timesheet_days').update({ status: 'submitted', updated_at: new Date().toISOString() }).in('id', ids)
  return { totals, filename: fname, days: days.length }
}
