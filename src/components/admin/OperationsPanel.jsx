import { useState, useEffect } from 'react'
import { fetchEvents, fetchAssignments, runCron } from '../../lib/adminApi.js'

export default function OperationsPanel({ stats }) {
  const [events, setEvents] = useState([])
  const [assignments, setAssignments] = useState([])
  const [loading, setLoading] = useState(true)
  const [running, setRunning] = useState(false)
  const [ranNote, setRanNote] = useState('')

  const runAutomations = async () => {
    setRunning(true); setRanNote('')
    try {
      const r = await runCron('all')
      const sm = r.result?.scheduled_messages
      const re = r.result?.reengagement
      setRanNote(`Done — ${sm?.processed ?? 0} scheduled sent, ${re?.nudged ?? 0} re-engagement emails.`)
    } catch (e) { setRanNote('Failed: ' + e.message) }
    setRunning(false)
  }

  useEffect(() => {
    Promise.all([fetchEvents(), fetchAssignments()])
      .then(([evs, asns]) => {
        setEvents(evs)
        setAssignments(asns)
      })
      .catch(err => console.error('Failed to load ops data:', err))
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return <div className="text-p-muted text-sm py-8 text-center">Loading...</div>
  }

  const fin = stats?.financials || {}
  const evStats = stats?.events || {}
  const workerStats = stats?.workers || {}
  const fmtMoney = (v) => `$${(v || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

  // Events needing staffing (pending, approved, or staffing status)
  const needsStaffing = events.filter(e => ['pending', 'approved', 'staffing'].includes(e.status))

  // Events with outstanding payment
  const outstandingEvents = events.filter(e => e.total_bill_amount && e.payment_status !== 'paid')

  // Worker payouts pending
  const pendingPayouts = assignments.filter(a => a.payout_amount && a.payout_status !== 'paid')

  // Confirmed workers for upcoming events
  const confirmedAssignments = assignments.filter(a => a.status === 'confirmed')

  const formatDate = (d) => {
    if (!d) return ''
    return new Date(d + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  }

  return (
    <div className="space-y-6">
      {/* Financial Summary */}
      <Section title="Financial Summary">
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
          <FinCard label="Total Billed" value={fmtMoney(fin.total_billed)} />
          <FinCard label="Client Paid" value={fmtMoney(fin.client_paid)} color="text-green-400" />
          <FinCard label="Client Outstanding" value={fmtMoney(fin.client_outstanding)} color="text-yellow-400" />
          <FinCard label="Total Payouts" value={fmtMoney(fin.total_payouts)} />
          <FinCard label="Payouts Paid" value={fmtMoney(fin.payouts_paid)} color="text-green-400" />
          <FinCard label="Payouts Pending" value={fmtMoney(fin.payouts_pending)} color="text-yellow-400" />
        </div>
        {fin.total_billed > 0 && fin.total_payouts > 0 && (
          <div className="mt-3 bg-black/30 rounded-lg px-3 py-2 text-xs">
            <span className="text-p-muted">Gross margin: </span>
            <span className="text-p-green font-medium">
              {fmtMoney(fin.total_billed - fin.total_payouts)} ({((1 - fin.total_payouts / fin.total_billed) * 100).toFixed(1)}%)
            </span>
          </div>
        )}
      </Section>

      {/* Worker Utilization */}
      <Section title="Worker Utilization">
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
          <FinCard label="Approved Workers" value={workerStats.total_approved ?? '—'} />
          <FinCard
            label="Avg Rating"
            value={workerStats.avg_rating != null ? `${workerStats.avg_rating}/5` : 'N/A'}
            color={workerStats.avg_rating >= 4 ? 'text-green-400' : workerStats.avg_rating >= 3 ? 'text-yellow-400' : 'text-white'}
          />
        </div>
      </Section>

      {/* Event Analytics */}
      <Section title="Event Analytics">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <FinCard label="Events This Month" value={evStats.this_month ?? '—'} />
          <FinCard label="Events Last Month" value={evStats.last_month ?? '—'} />
          <FinCard
            label="Completion Rate"
            value={evStats.completion_rate != null ? `${evStats.completion_rate}%` : '—'}
            color={evStats.completion_rate >= 75 ? 'text-green-400' : evStats.completion_rate >= 50 ? 'text-yellow-400' : 'text-white'}
          />
          <FinCard label="Avg Crew Size" value={evStats.avg_crew_size != null ? evStats.avg_crew_size : '—'} />
        </div>
        {evStats.this_month != null && evStats.last_month != null && evStats.last_month > 0 && (
          <div className="mt-3 bg-black/30 rounded-lg px-3 py-2 text-xs">
            <span className="text-p-muted">Month-over-month: </span>
            <span className={evStats.this_month >= evStats.last_month ? 'text-green-400 font-medium' : 'text-yellow-400 font-medium'}>
              {evStats.this_month >= evStats.last_month ? '+' : ''}{evStats.this_month - evStats.last_month} events
            </span>
          </div>
        )}
      </Section>

      {/* Events Needing Staffing */}
      <Section title={`Events Needing Attention (${needsStaffing.length})`}>
        {needsStaffing.length === 0 ? (
          <p className="text-p-muted text-xs">All events are staffed or completed.</p>
        ) : (
          <div className="space-y-1">
            {needsStaffing.map(ev => {
              const evAssignments = assignments.filter(a => a.event_id === ev.id)
              const confirmed = evAssignments.filter(a => a.status === 'confirmed').length
              return (
                <div key={ev.id} className="flex items-center gap-3 bg-black/20 rounded-lg px-3 py-2">
                  <div className="flex-1 min-w-0">
                    <div className="text-white text-xs font-medium truncate">{ev.title}</div>
                    <div className="text-p-muted text-[10px]">{formatDate(ev.event_date)} · {ev.city}</div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <div className="text-white text-xs">{confirmed}/{ev.workers_needed} confirmed</div>
                    <StatusBadge status={ev.status} />
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </Section>

      {/* Confirmed Workers */}
      <Section title={`Confirmed Workers (${confirmedAssignments.length})`}>
        {confirmedAssignments.length === 0 ? (
          <p className="text-p-muted text-xs">No confirmed assignments.</p>
        ) : (
          <div className="space-y-1">
            {confirmedAssignments.map(a => (
              <div key={a.id} className="flex items-center gap-3 bg-black/20 rounded-lg px-3 py-2">
                <div className="flex-1 min-w-0">
                  <div className="text-white text-xs font-medium truncate">{a.applicants?.first_name} {a.applicants?.last_name}</div>
                  <div className="text-p-muted text-[10px]">{a.applicants?.phone}</div>
                </div>
                <div className="text-right flex-shrink-0">
                  <div className="text-white text-xs truncate">{a.events?.title}</div>
                  <div className="text-p-muted text-[10px]">{formatDate(a.events?.event_date)}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </Section>

      {/* Client Outstanding Payments */}
      <Section title={`Outstanding Client Payments (${outstandingEvents.length})`}>
        {outstandingEvents.length === 0 ? (
          <p className="text-p-muted text-xs">No outstanding client payments.</p>
        ) : (
          <div className="space-y-1">
            {outstandingEvents.map(ev => (
              <div key={ev.id} className="flex items-center gap-3 bg-black/20 rounded-lg px-3 py-2">
                <div className="flex-1 min-w-0">
                  <div className="text-white text-xs font-medium truncate">{ev.title}</div>
                  <div className="text-p-muted text-[10px]">{ev.organizer} · {formatDate(ev.event_date)}</div>
                </div>
                <div className="text-right flex-shrink-0">
                  <div className="text-white text-xs font-medium">{fmtMoney(ev.total_bill_amount)}</div>
                  <div className="flex gap-2 text-[10px]">
                    <span className={ev.invoice_status === 'overdue' ? 'text-red-400' : ev.invoice_status === 'sent' ? 'text-yellow-400' : 'text-p-muted'}>
                      {(ev.invoice_status || 'not_sent').replace(/_/g, ' ')}
                    </span>
                    <span className={ev.payment_status === 'partial' ? 'text-yellow-400' : 'text-p-muted'}>
                      {ev.payment_status || 'unpaid'}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </Section>

      {/* Worker Payouts Pending */}
      <Section title={`Pending Worker Payouts (${pendingPayouts.length})`}>
        {pendingPayouts.length === 0 ? (
          <p className="text-p-muted text-xs">No pending worker payouts.</p>
        ) : (
          <div className="space-y-1">
            {pendingPayouts.map(a => (
              <div key={a.id} className="flex items-center gap-3 bg-black/20 rounded-lg px-3 py-2">
                <div className="flex-1 min-w-0">
                  <div className="text-white text-xs font-medium truncate">{a.applicants?.first_name} {a.applicants?.last_name}</div>
                  <div className="text-p-muted text-[10px]">{a.events?.title} · {formatDate(a.events?.event_date)}</div>
                </div>
                <div className="text-right flex-shrink-0">
                  <div className="text-white text-xs font-medium">{fmtMoney(a.payout_amount)}</div>
                  <span className={`text-[10px] font-medium ${a.payout_status === 'approved' ? 'text-blue-400' : 'text-yellow-400'}`}>
                    {a.payout_status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </Section>

      {/* Automations — one control; scheduled sends, reminders, re-engagement */}
      <div className="flex items-center justify-between bg-p-surface border border-p-border rounded-lg px-4 py-3">
        <div className="min-w-0">
          <div className="text-white text-sm font-medium">Automations</div>
          <div className="text-p-muted text-[11px]">{ranNote || 'Runs scheduled messages, shift/briefing reminders, and re-engagement. Auto-runs daily; run on demand here.'}</div>
        </div>
        <button
          onClick={runAutomations}
          disabled={running}
          className="flex-shrink-0 px-4 py-2 rounded-lg bg-p-green text-black text-xs font-semibold disabled:opacity-50 hover:opacity-90 transition-opacity"
        >{running ? 'Running…' : 'Run now'}</button>
      </div>
    </div>
  )
}

function Section({ title, children }) {
  return (
    <div className="bg-p-surface border border-p-border rounded-lg p-4">
      <h3 className="text-white text-sm font-semibold mb-3">{title}</h3>
      {children}
    </div>
  )
}

function FinCard({ label, value, color }) {
  return (
    <div className="bg-black/20 rounded-lg px-3 py-2">
      <div className={`text-sm font-bold ${color || 'text-white'}`}>{value}</div>
      <div className="text-p-muted text-[10px]">{label}</div>
    </div>
  )
}

function StatusBadge({ status }) {
  const colors = {
    pending: 'bg-yellow-500/20 text-yellow-400',
    approved: 'bg-blue-500/20 text-blue-400',
    staffing: 'bg-purple-500/20 text-purple-400',
  }
  return (
    <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${colors[status] || 'bg-p-border text-p-muted'}`}>
      {status}
    </span>
  )
}
