import { useState, useEffect } from 'react'
import { fetchAssignments, updateAssignment, sendShiftDetails, sendSurvey } from '../../lib/adminApi.js'

const ASSIGNMENT_COLORS = {
  invited: 'bg-yellow-500/20 text-yellow-400',
  confirmed: 'bg-green-500/20 text-green-400',
  declined: 'bg-red-500/20 text-red-400',
  checked_in: 'bg-blue-500/20 text-blue-400',
  completed: 'bg-green-500/20 text-green-400',
  cancelled: 'bg-red-500/20 text-red-400',
}

const PAYOUT_COLORS = {
  pending: 'text-yellow-400',
  approved: 'text-blue-400',
  paid: 'text-green-400',
}

export default function AssignmentsPanel() {
  const [assignments, setAssignments] = useState([])
  const [loading, setLoading] = useState(true)
  const [editingPay, setEditingPay] = useState(null)
  const [payForm, setPayForm] = useState({})
  const [sending, setSending] = useState({}) // { [id]: 'shift' | 'survey' | null }

  const load = async () => {
    setLoading(true)
    try {
      const data = await fetchAssignments()
      setAssignments(data)
    } catch (err) {
      console.error('Failed to load assignments:', err)
    }
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const handleStatusChange = async (id, status) => {
    try {
      await updateAssignment(id, status)
      setAssignments(prev => prev.map(a => a.id === id ? { ...a, status } : a))
    } catch (err) {
      console.error('Failed to update:', err)
    }
  }

  const startEditPay = (a) => {
    setEditingPay(a.id)
    setPayForm({
      pay_rate: a.pay_rate || '',
      hours_worked: a.hours_worked || '',
      payout_amount: a.payout_amount || '',
      payout_status: a.payout_status || 'pending',
    })
  }

  const savePay = async (id) => {
    try {
      const updates = {
        pay_rate: payForm.pay_rate ? parseFloat(payForm.pay_rate) : null,
        hours_worked: payForm.hours_worked ? parseFloat(payForm.hours_worked) : null,
        payout_amount: payForm.payout_amount ? parseFloat(payForm.payout_amount) : null,
        payout_status: payForm.payout_status,
      }
      await updateAssignment(id, updates)
      setAssignments(prev => prev.map(a => a.id === id ? { ...a, ...updates } : a))
      setEditingPay(null)
    } catch (err) {
      console.error('Failed to update pay:', err)
    }
  }

  const autoCalcPayout = () => {
    const rate = parseFloat(payForm.pay_rate)
    const hours = parseFloat(payForm.hours_worked)
    if (rate && hours) {
      setPayForm(f => ({ ...f, payout_amount: (rate * hours).toFixed(2) }))
    }
  }

  const handleSendShift = async (id) => {
    setSending(prev => ({ ...prev, [id]: 'shift' }))
    try {
      await sendShiftDetails(id)
      setAssignments(prev => prev.map(a =>
        a.id === id ? { ...a, shift_sent_at: new Date().toISOString() } : a
      ))
    } catch (err) {
      alert('Failed to send shift details: ' + err.message)
    }
    setSending(prev => ({ ...prev, [id]: null }))
  }

  const handleSendSurvey = async (id) => {
    setSending(prev => ({ ...prev, [id]: 'survey' }))
    try {
      await sendSurvey(id)
      setAssignments(prev => prev.map(a =>
        a.id === id ? { ...a, survey_sent_at: new Date().toISOString() } : a
      ))
    } catch (err) {
      alert('Failed to send survey: ' + err.message)
    }
    setSending(prev => ({ ...prev, [id]: null }))
  }

  const formatDate = (d) => {
    if (!d) return ''
    return new Date(d + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  }

  const formatSentAt = (ts) => {
    if (!ts) return null
    return new Date(ts).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
  }

  const fmtMoney = (v) => v != null && v !== '' ? `$${parseFloat(v).toFixed(2)}` : '—'

  // Group by event
  const grouped = {}
  for (const a of assignments) {
    const key = a.event_id
    if (!grouped[key]) {
      grouped[key] = { event: a.events, assignments: [] }
    }
    grouped[key].assignments.push(a)
  }

  return (
    <div>
      {loading ? (
        <div className="text-p-muted text-sm py-8 text-center">Loading...</div>
      ) : assignments.length === 0 ? (
        <div className="text-p-muted text-sm py-8 text-center">No assignments yet. Assign workers from the Events tab.</div>
      ) : (
        <div className="space-y-4">
          {Object.entries(grouped).map(([eventId, { event, assignments: eventAssignments }]) => (
            <div key={eventId} className="bg-p-surface border border-p-border rounded-lg overflow-hidden">
              {/* Event Header */}
              <div className="px-4 py-3 border-b border-p-border">
                <div className="text-white text-sm font-medium">{event?.title || 'Unknown Event'}</div>
                <div className="text-p-muted text-xs">
                  {formatDate(event?.event_date)} · {event?.city} · {event?.status}
                  {event?.bill_rate && <span> · Bill rate: ${parseFloat(event.bill_rate).toFixed(2)}/hr</span>}
                </div>
              </div>

              {/* Workers */}
              <div className="divide-y divide-p-border">
                {eventAssignments.map(a => (
                  <div key={a.id} className="px-4 py-2.5">
                    <div className="flex items-center gap-3">
                      {a.applicants?.photo_url ? (
                        <img src={a.applicants.photo_url} alt="" className="w-8 h-8 rounded-full object-cover flex-shrink-0" />
                      ) : (
                        <div className="w-8 h-8 rounded-full bg-p-border flex items-center justify-center flex-shrink-0">
                          <span className="text-p-muted text-xs">{a.applicants?.first_name?.[0]}{a.applicants?.last_name?.[0]}</span>
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="text-white text-xs font-medium truncate">
                          {a.applicants?.first_name} {a.applicants?.last_name}
                        </div>
                        <div className="text-p-muted text-[10px] truncate">{a.applicants?.city} · {a.applicants?.phone}</div>
                        {a.briefing_slot && (
                          <div className="text-p-green text-[10px] mt-0.5">Briefing: {a.briefing_slot}</div>
                        )}
                      </div>
                      <span className={`px-2 py-0.5 rounded text-[10px] font-medium ${ASSIGNMENT_COLORS[a.status] || 'bg-p-border text-p-muted'}`}>
                        {a.status?.replace(/_/g, ' ')}
                      </span>
                      <select
                        value={a.status}
                        onChange={(e) => handleStatusChange(a.id, e.target.value)}
                        className="bg-p-bg border border-p-border rounded px-2 py-1 text-[10px] text-white"
                      >
                        <option value="invited">invited</option>
                        <option value="confirmed">confirmed</option>
                        <option value="declined">declined</option>
                        <option value="checked_in">checked_in</option>
                        <option value="completed">completed</option>
                        <option value="cancelled">cancelled</option>
                      </select>
                    </div>

                    {/* Pay info row */}
                    <div className="mt-1.5 ml-11 flex items-center gap-3 text-[10px]">
                      {editingPay === a.id ? (
                        <div className="flex items-center gap-2 flex-wrap">
                          <label className="text-p-muted">
                            Rate: <input type="number" step="0.01" value={payForm.pay_rate} onChange={e => setPayForm(f => ({ ...f, pay_rate: e.target.value }))}
                              className="w-16 bg-p-bg border border-p-border rounded px-1.5 py-0.5 text-[10px] text-white ml-0.5" />
                          </label>
                          <label className="text-p-muted">
                            Hrs: <input type="number" step="0.25" value={payForm.hours_worked}
                              onChange={e => setPayForm(f => ({ ...f, hours_worked: e.target.value }))}
                              onBlur={autoCalcPayout}
                              className="w-14 bg-p-bg border border-p-border rounded px-1.5 py-0.5 text-[10px] text-white ml-0.5" />
                          </label>
                          <label className="text-p-muted">
                            Payout: <input type="number" step="0.01" value={payForm.payout_amount} onChange={e => setPayForm(f => ({ ...f, payout_amount: e.target.value }))}
                              className="w-16 bg-p-bg border border-p-border rounded px-1.5 py-0.5 text-[10px] text-white ml-0.5" />
                          </label>
                          <select value={payForm.payout_status} onChange={e => setPayForm(f => ({ ...f, payout_status: e.target.value }))}
                            className="bg-p-bg border border-p-border rounded px-1.5 py-0.5 text-[10px] text-white">
                            <option value="pending">pending</option>
                            <option value="approved">approved</option>
                            <option value="paid">paid</option>
                          </select>
                          <button onClick={() => savePay(a.id)} className="text-p-green font-medium hover:opacity-80">Save</button>
                          <button onClick={() => setEditingPay(null)} className="text-p-muted font-medium hover:opacity-80">Cancel</button>
                        </div>
                      ) : (
                        <>
                          <span className="text-p-muted">Rate: <span className="text-white">{fmtMoney(a.pay_rate)}/hr</span></span>
                          <span className="text-p-muted">Hrs: <span className="text-white">{a.hours_worked ?? '—'}</span></span>
                          <span className="text-p-muted">Payout: <span className="text-white">{fmtMoney(a.payout_amount)}</span></span>
                          <span className={`font-medium ${PAYOUT_COLORS[a.payout_status] || 'text-p-muted'}`}>{a.payout_status || 'pending'}</span>
                          <button onClick={() => startEditPay(a)} className="text-p-green font-medium hover:opacity-80">Edit Pay</button>
                        </>
                      )}
                    </div>

                    {/* Dispatch action buttons */}
                    <div className="flex items-center gap-2 mt-1.5 pl-11">
                      <button
                        onClick={() => handleSendShift(a.id)}
                        disabled={!!sending[a.id]}
                        className="px-2.5 py-1 rounded text-[10px] border border-p-border text-p-muted hover:border-p-green hover:text-p-green transition-colors disabled:opacity-40"
                      >
                        {sending[a.id] === 'shift' ? 'Sending...' : 'Send Shift Details'}
                      </button>
                      <button
                        onClick={() => handleSendSurvey(a.id)}
                        disabled={!!sending[a.id]}
                        className="px-2.5 py-1 rounded text-[10px] border border-p-border text-p-muted hover:border-p-green hover:text-p-green transition-colors disabled:opacity-40"
                      >
                        {sending[a.id] === 'survey' ? 'Sending...' : 'Send Survey'}
                      </button>
                      <div className="flex gap-3 ml-1">
                        {a.shift_sent_at && (
                          <span className="text-[9px] text-p-muted">Shift sent {formatSentAt(a.shift_sent_at)}</span>
                        )}
                        {a.survey_sent_at && (
                          <span className="text-[9px] text-p-muted">Survey sent {formatSentAt(a.survey_sent_at)}</span>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
