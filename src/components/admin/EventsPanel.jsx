import { useState, useEffect } from 'react'
import { fetchEvents, updateEvent, fetchApplicants, fetchAssignments, createAssignments, updateAssignment, deleteAssignment, createCheckoutSession } from '../../lib/adminApi.js'

const STATUS_OPTIONS = ['all', 'pending', 'approved', 'awaiting_payment', 'staffing', 'confirmed', 'completed', 'cancelled']

const STATUS_COLORS = {
  pending: 'bg-yellow-500/20 text-yellow-400',
  approved: 'bg-blue-500/20 text-blue-400',
  awaiting_payment: 'bg-orange-500/20 text-orange-400',
  staffing: 'bg-purple-500/20 text-purple-400',
  confirmed: 'bg-green-500/20 text-green-400',
  completed: 'bg-green-500/20 text-green-400',
  cancelled: 'bg-red-500/20 text-red-400',
}

const ASSIGNMENT_COLORS = {
  invited: 'bg-yellow-500/20 text-yellow-400',
  confirmed: 'bg-green-500/20 text-green-400',
  declined: 'bg-red-500/20 text-red-400',
  checked_in: 'bg-blue-500/20 text-blue-400',
  completed: 'bg-green-500/20 text-green-400',
  cancelled: 'bg-red-500/20 text-red-400',
}

const INVOICE_COLORS = {
  not_sent: 'text-p-muted',
  sent: 'text-yellow-400',
  paid: 'text-green-400',
  overdue: 'text-red-400',
}

const PAYMENT_COLORS = {
  unpaid: 'text-p-muted',
  partial: 'text-yellow-400',
  paid: 'text-green-400',
}

export default function EventsPanel() {
  const [events, setEvents] = useState([])
  const [filter, setFilter] = useState('all')
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState(null)
  const [updating, setUpdating] = useState(null)

  // Assignment sub-state for expanded event
  const [assignments, setAssignments] = useState([])
  const [assignLoading, setAssignLoading] = useState(false)
  const [showAssignModal, setShowAssignModal] = useState(false)
  const [availableWorkers, setAvailableWorkers] = useState([])
  const [selectedWorkers, setSelectedWorkers] = useState([])
  const [assigning, setAssigning] = useState(false)

  // Billing edit state
  const [editingBilling, setEditingBilling] = useState(null)
  const [billingForm, setBillingForm] = useState({})

  // Stripe payment link state
  const [creatingPaymentLink, setCreatingPaymentLink] = useState(null)
  const [paymentLinkError, setPaymentLinkError] = useState(null)

  const load = async () => {
    setLoading(true)
    try {
      const data = await fetchEvents(filter === 'all' ? '' : filter)
      setEvents(data)
    } catch (err) {
      console.error('Failed to load events:', err)
    }
    setLoading(false)
  }

  useEffect(() => { load() }, [filter])

  const handleExpand = async (id) => {
    if (expanded === id) {
      setExpanded(null)
      return
    }
    setExpanded(id)
    setAssignLoading(true)
    try {
      const data = await fetchAssignments({ event_id: id })
      setAssignments(data)
    } catch (err) {
      console.error('Failed to load assignments:', err)
    }
    setAssignLoading(false)
  }

  const handleStatusChange = async (id, newStatus) => {
    setUpdating(id)
    try {
      await updateEvent(id, { status: newStatus })
      setEvents(prev => prev.map(e => e.id === id ? { ...e, status: newStatus } : e))
    } catch (err) {
      console.error('Failed to update:', err)
    }
    setUpdating(null)
  }

  const startEditBilling = (ev) => {
    setEditingBilling(ev.id)
    setBillingForm({
      bill_rate: ev.bill_rate || '',
      total_bill_amount: ev.total_bill_amount || '',
      invoice_status: ev.invoice_status || 'not_sent',
      payment_status: ev.payment_status || 'unpaid',
    })
  }

  const saveBilling = async (id) => {
    setUpdating(id)
    try {
      const updates = {
        bill_rate: billingForm.bill_rate ? parseFloat(billingForm.bill_rate) : null,
        total_bill_amount: billingForm.total_bill_amount ? parseFloat(billingForm.total_bill_amount) : null,
        invoice_status: billingForm.invoice_status,
        payment_status: billingForm.payment_status,
      }
      await updateEvent(id, updates)
      setEvents(prev => prev.map(e => e.id === id ? { ...e, ...updates } : e))
      setEditingBilling(null)
    } catch (err) {
      console.error('Failed to update billing:', err)
    }
    setUpdating(null)
  }

  const handleCreatePaymentLink = async (ev) => {
    setCreatingPaymentLink(ev.id)
    setPaymentLinkError(null)
    try {
      const result = await createCheckoutSession(ev.id)
      // Update the event in local state with the Stripe fields
      setEvents(prev => prev.map(e => e.id === ev.id ? {
        ...e,
        stripe_checkout_session_id: result.session_id,
        stripe_payment_url: result.checkout_url,
        invoice_status: 'sent',
      } : e))
      // Copy payment link to clipboard
      if (result.checkout_url) {
        navigator.clipboard?.writeText(result.checkout_url)
      }
    } catch (err) {
      setPaymentLinkError(err.message || 'Failed to create payment link')
    }
    setCreatingPaymentLink(null)
  }

  const openAssignModal = async () => {
    setShowAssignModal(true)
    setSelectedWorkers([])
    try {
      const workers = await fetchApplicants('approved')
      const assignedIds = new Set(assignments.map(a => a.worker_id))
      setAvailableWorkers(workers.filter(w => !assignedIds.has(w.id)))
    } catch (err) {
      console.error('Failed to load workers:', err)
    }
  }

  const handleAssign = async () => {
    if (!selectedWorkers.length || !expanded) return
    setAssigning(true)
    try {
      await createAssignments(expanded, selectedWorkers)
      const data = await fetchAssignments({ event_id: expanded })
      setAssignments(data)
      setShowAssignModal(false)
    } catch (err) {
      console.error('Failed to assign:', err)
    }
    setAssigning(false)
  }

  const handleAssignmentStatus = async (assignmentId, status) => {
    try {
      await updateAssignment(assignmentId, status)
      setAssignments(prev => prev.map(a => a.id === assignmentId ? { ...a, status } : a))
    } catch (err) {
      console.error('Failed to update assignment:', err)
    }
  }

  const handleRemoveAssignment = async (assignmentId) => {
    try {
      await deleteAssignment(assignmentId)
      setAssignments(prev => prev.filter(a => a.id !== assignmentId))
    } catch (err) {
      console.error('Failed to remove assignment:', err)
    }
  }

  const getConfirmLink = (a) => {
    if (!a.confirmation_token) return null
    return `${window.location.origin}/confirm?token=${a.confirmation_token}`
  }

  const copyConfirmLink = (a) => {
    const link = getConfirmLink(a)
    if (link) navigator.clipboard?.writeText(link)
  }

  const formatDate = (d) => new Date(d + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
  const formatTime = (t) => {
    if (!t) return ''
    const [h, m] = t.split(':')
    const hr = parseInt(h, 10)
    const ampm = hr >= 12 ? 'PM' : 'AM'
    return `${hr % 12 || 12}:${m} ${ampm}`
  }
  const fmtMoney = (v) => v != null && v !== '' ? `$${parseFloat(v).toFixed(2)}` : '—'

  return (
    <div>
      {/* Filters */}
      <div className="flex gap-2 mb-4 overflow-x-auto pb-2">
        {STATUS_OPTIONS.map(s => (
          <button
            key={s}
            onClick={() => setFilter(s)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-all ${
              filter === s ? 'bg-p-green text-black' : 'bg-p-surface text-p-muted border border-p-border hover:border-p-muted'
            }`}
          >
            {s === 'all' ? 'All' : s}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="text-p-muted text-sm py-8 text-center">Loading...</div>
      ) : events.length === 0 ? (
        <div className="text-p-muted text-sm py-8 text-center">No events found</div>
      ) : (
        <div className="space-y-2">
          {events.map(ev => (
            <div key={ev.id} className="bg-p-surface border border-p-border rounded-lg overflow-hidden">
              {/* Row */}
              <button
                onClick={() => handleExpand(ev.id)}
                className="w-full px-4 py-3 flex items-center gap-3 text-left hover:bg-white/[0.02] transition-colors"
              >
                <div className="flex-1 min-w-0">
                  <div className="text-white text-sm font-medium truncate">{ev.title}</div>
                  <div className="text-p-muted text-xs truncate">{ev.organizer} · {ev.city}</div>
                </div>
                <div className="text-right flex-shrink-0">
                  <div className="text-white text-xs">{formatDate(ev.event_date)}</div>
                  <div className="text-p-muted text-xs">{ev.workers_needed} workers</div>
                </div>
                <span className={`px-2 py-0.5 rounded text-xs font-medium flex-shrink-0 ${STATUS_COLORS[ev.status] || 'bg-p-border text-p-muted'}`}>
                  {ev.status}
                </span>
              </button>

              {/* Expanded */}
              {expanded === ev.id && (
                <div className="px-4 pb-4 border-t border-p-border pt-3">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm mb-4">
                    <Detail label="Contact" value={`${ev.contact_name} · ${ev.contact_email}`} />
                    <Detail label="Phone" value={ev.contact_phone} />
                    <Detail label="Location" value={ev.location} />
                    <Detail label="Time" value={`${formatTime(ev.start_time)} – ${formatTime(ev.end_time)}`} />
                    <Detail label="Roles" value={ev.role_types?.join(', ')} />
                    <Detail label="Pay Rate" value={ev.pay_rate} />
                    {ev.dress_code && <Detail label="Dress Code" value={ev.dress_code} />}
                    {ev.notes && <Detail label="Notes" value={ev.notes} />}
                  </div>

                  {/* Billing Section */}
                  <div className="bg-black/20 rounded-lg p-3 mb-4">
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="text-white text-xs font-semibold uppercase tracking-wider">Billing</h4>
                      {editingBilling !== ev.id ? (
                        <button onClick={() => startEditBilling(ev)} className="text-p-green text-[10px] font-medium hover:opacity-80">
                          Edit
                        </button>
                      ) : (
                        <div className="flex gap-2">
                          <button onClick={() => saveBilling(ev.id)} className="text-p-green text-[10px] font-medium hover:opacity-80">Save</button>
                          <button onClick={() => setEditingBilling(null)} className="text-p-muted text-[10px] font-medium hover:opacity-80">Cancel</button>
                        </div>
                      )}
                    </div>
                    {editingBilling === ev.id ? (
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="text-p-muted text-[10px]">Bill Rate ($/hr)</label>
                          <input type="number" step="0.01" value={billingForm.bill_rate} onChange={e => setBillingForm(f => ({ ...f, bill_rate: e.target.value }))}
                            className="w-full bg-p-bg border border-p-border rounded px-2 py-1 text-xs text-white mt-0.5" />
                        </div>
                        <div>
                          <label className="text-p-muted text-[10px]">Total Bill ($)</label>
                          <input type="number" step="0.01" value={billingForm.total_bill_amount} onChange={e => setBillingForm(f => ({ ...f, total_bill_amount: e.target.value }))}
                            className="w-full bg-p-bg border border-p-border rounded px-2 py-1 text-xs text-white mt-0.5" />
                        </div>
                        <div>
                          <label className="text-p-muted text-[10px]">Invoice</label>
                          <select value={billingForm.invoice_status} onChange={e => setBillingForm(f => ({ ...f, invoice_status: e.target.value }))}
                            className="w-full bg-p-bg border border-p-border rounded px-2 py-1 text-xs text-white mt-0.5">
                            <option value="not_sent">Not Sent</option>
                            <option value="sent">Sent</option>
                            <option value="paid">Paid</option>
                            <option value="overdue">Overdue</option>
                          </select>
                        </div>
                        <div>
                          <label className="text-p-muted text-[10px]">Payment</label>
                          <select value={billingForm.payment_status} onChange={e => setBillingForm(f => ({ ...f, payment_status: e.target.value }))}
                            className="w-full bg-p-bg border border-p-border rounded px-2 py-1 text-xs text-white mt-0.5">
                            <option value="unpaid">Unpaid</option>
                            <option value="partial">Partial</option>
                            <option value="paid">Paid</option>
                          </select>
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                          <div>
                            <span className="text-p-muted">Bill Rate: </span>
                            <span className="text-white">{fmtMoney(ev.bill_rate)}/hr</span>
                          </div>
                          <div>
                            <span className="text-p-muted">Total: </span>
                            <span className="text-white">{fmtMoney(ev.total_bill_amount)}</span>
                          </div>
                          <div>
                            <span className="text-p-muted">Invoice: </span>
                            <span className={INVOICE_COLORS[ev.invoice_status] || 'text-p-muted'}>{(ev.invoice_status || 'not_sent').replace(/_/g, ' ')}</span>
                          </div>
                          <div>
                            <span className="text-p-muted">Payment: </span>
                            <span className={PAYMENT_COLORS[ev.payment_status] || 'text-p-muted'}>{ev.payment_status || 'unpaid'}</span>
                          </div>
                        </div>

                        {/* Stripe Payment Link */}
                        <div className="flex items-center gap-2 pt-1">
                          {ev.payment_status === 'paid' ? (
                            <span className="text-green-400 text-xs font-medium">
                              Paid via Stripe {ev.stripe_paid_at ? `on ${new Date(ev.stripe_paid_at).toLocaleDateString()}` : ''}
                            </span>
                          ) : ev.stripe_payment_url ? (
                            <>
                              <button
                                onClick={() => navigator.clipboard?.writeText(ev.stripe_payment_url)}
                                className="px-2 py-1 bg-white/5 hover:bg-white/10 rounded text-[10px] text-p-muted hover:text-white transition-colors"
                              >
                                Copy Payment Link
                              </button>
                              <a
                                href={ev.stripe_payment_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="px-2 py-1 bg-white/5 hover:bg-white/10 rounded text-[10px] text-p-muted hover:text-white transition-colors"
                              >
                                Open in Stripe
                              </a>
                            </>
                          ) : ev.total_bill_amount ? (
                            <button
                              onClick={() => handleCreatePaymentLink(ev)}
                              disabled={creatingPaymentLink === ev.id}
                              className="px-2.5 py-1 bg-[#635bff] hover:bg-[#5349e0] rounded text-[10px] text-white font-medium transition-colors disabled:opacity-50"
                            >
                              {creatingPaymentLink === ev.id ? 'Creating...' : 'Generate Stripe Payment Link'}
                            </button>
                          ) : (
                            <span className="text-p-muted text-[10px]">Set total bill amount to generate payment link</span>
                          )}
                          {paymentLinkError && creatingPaymentLink === null && (
                            <span className="text-red-400 text-[10px]">{paymentLinkError}</span>
                          )}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Event Actions */}
                  <div className="flex gap-2 flex-wrap mb-4">
                    {ev.status === 'pending' && (
                      <ActionBtn label="Approve" cls="bg-green-600 hover:bg-green-700" loading={updating === ev.id} onClick={() => handleStatusChange(ev.id, 'approved')} />
                    )}
                    {(ev.status === 'approved' || ev.status === 'awaiting_payment') && ev.payment_status !== 'paid' && (
                      <ActionBtn label="Awaiting Payment" cls="bg-orange-600 hover:bg-orange-700" loading={updating === ev.id} onClick={() => handleStatusChange(ev.id, 'awaiting_payment')} />
                    )}
                    {(ev.status === 'approved' || ev.status === 'pending' || ev.status === 'awaiting_payment') && (
                      <ActionBtn label="Start Staffing" cls="bg-purple-600 hover:bg-purple-700" loading={updating === ev.id} onClick={() => handleStatusChange(ev.id, 'staffing')} />
                    )}
                    {ev.status === 'staffing' && (
                      <ActionBtn label="Confirm" cls="bg-green-600 hover:bg-green-700" loading={updating === ev.id} onClick={() => handleStatusChange(ev.id, 'confirmed')} />
                    )}
                    {ev.status === 'confirmed' && (
                      <ActionBtn label="Mark Completed" cls="bg-green-600 hover:bg-green-700" loading={updating === ev.id} onClick={() => handleStatusChange(ev.id, 'completed')} />
                    )}
                    {ev.status !== 'cancelled' && ev.status !== 'completed' && (
                      <ActionBtn label="Cancel" cls="bg-red-600 hover:bg-red-700" loading={updating === ev.id} onClick={() => handleStatusChange(ev.id, 'cancelled')} />
                    )}
                  </div>

                  {/* Assignments */}
                  <div className="border-t border-p-border pt-3">
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="text-white text-sm font-medium">
                        Assigned Workers ({assignments.length}/{ev.workers_needed})
                      </h4>
                      <button
                        onClick={openAssignModal}
                        className="text-xs text-p-green font-medium hover:opacity-80 transition-opacity"
                      >
                        + Assign Workers
                      </button>
                    </div>

                    {assignLoading ? (
                      <p className="text-p-muted text-xs">Loading...</p>
                    ) : assignments.length === 0 ? (
                      <p className="text-p-muted text-xs">No workers assigned yet</p>
                    ) : (
                      <div className="space-y-1">
                        {assignments.map(a => (
                          <div key={a.id} className="flex items-center gap-2 bg-black/20 rounded-lg px-3 py-2">
                            {a.applicants?.photo_url ? (
                              <img src={a.applicants.photo_url} alt="" className="w-7 h-7 rounded-full object-cover" />
                            ) : (
                              <div className="w-7 h-7 rounded-full bg-p-border flex items-center justify-center">
                                <span className="text-p-muted text-[10px]">{a.applicants?.first_name?.[0]}{a.applicants?.last_name?.[0]}</span>
                              </div>
                            )}
                            <span className="text-white text-xs flex-1">{a.applicants?.first_name} {a.applicants?.last_name}</span>
                            <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${ASSIGNMENT_COLORS[a.status] || 'bg-p-border text-p-muted'}`}>
                              {a.status?.replace(/_/g, ' ')}
                            </span>
                            <div className="flex gap-1">
                              {a.status === 'invited' && (
                                <>
                                  <SmallBtn label="Confirm" onClick={() => handleAssignmentStatus(a.id, 'confirmed')} />
                                  <SmallBtn label="Decline" onClick={() => handleAssignmentStatus(a.id, 'declined')} />
                                  {a.confirmation_token && (
                                    <SmallBtn label="Copy Link" onClick={() => copyConfirmLink(a)} />
                                  )}
                                </>
                              )}
                              {a.status === 'confirmed' && (
                                <SmallBtn label="Check In" onClick={() => handleAssignmentStatus(a.id, 'checked_in')} />
                              )}
                              {a.status === 'checked_in' && (
                                <SmallBtn label="Complete" onClick={() => handleAssignmentStatus(a.id, 'completed')} />
                              )}
                              <SmallBtn label="×" onClick={() => handleRemoveAssignment(a.id)} danger />
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Assign Modal */}
                  {showAssignModal && (
                    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 px-4" onClick={() => setShowAssignModal(false)}>
                      <div className="bg-p-surface border border-p-border rounded-xl w-full max-w-md max-h-[80vh] overflow-hidden" onClick={e => e.stopPropagation()}>
                        <div className="px-4 py-3 border-b border-p-border flex items-center justify-between">
                          <h3 className="text-white font-semibold text-sm">Assign Workers to {ev.title}</h3>
                          <button onClick={() => setShowAssignModal(false)} className="text-p-muted hover:text-white text-lg">×</button>
                        </div>
                        <div className="p-4 overflow-y-auto max-h-[60vh]">
                          {availableWorkers.length === 0 ? (
                            <p className="text-p-muted text-xs text-center py-4">No approved workers available</p>
                          ) : (
                            <div className="space-y-1">
                              {availableWorkers.map(w => (
                                <label key={w.id} className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-white/[0.03] cursor-pointer">
                                  <input
                                    type="checkbox"
                                    checked={selectedWorkers.includes(w.id)}
                                    onChange={() => {
                                      setSelectedWorkers(prev =>
                                        prev.includes(w.id) ? prev.filter(id => id !== w.id) : [...prev, w.id]
                                      )
                                    }}
                                    className="accent-[#c8ff00]"
                                  />
                                  {w.photo_url ? (
                                    <img src={w.photo_url} alt="" className="w-8 h-8 rounded-full object-cover" />
                                  ) : (
                                    <div className="w-8 h-8 rounded-full bg-p-border flex items-center justify-center">
                                      <span className="text-p-muted text-xs">{w.first_name?.[0]}{w.last_name?.[0]}</span>
                                    </div>
                                  )}
                                  <div className="flex-1">
                                    <div className="text-white text-xs font-medium">{w.first_name} {w.last_name}</div>
                                    <div className="text-p-muted text-[10px]">{w.city} · {w.roles?.join(', ')}</div>
                                  </div>
                                </label>
                              ))}
                            </div>
                          )}
                        </div>
                        {availableWorkers.length > 0 && (
                          <div className="px-4 py-3 border-t border-p-border">
                            <button
                              onClick={handleAssign}
                              disabled={!selectedWorkers.length || assigning}
                              className="w-full bg-p-green text-black rounded-lg py-2.5 text-sm font-semibold disabled:opacity-50 hover:opacity-90 transition-all"
                            >
                              {assigning ? 'Assigning...' : `Assign ${selectedWorkers.length} Worker${selectedWorkers.length !== 1 ? 's' : ''}`}
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function Detail({ label, value }) {
  if (!value) return null
  return (
    <div>
      <span className="text-p-muted text-xs">{label}: </span>
      <span className="text-white text-xs">{value}</span>
    </div>
  )
}

function ActionBtn({ label, cls, loading, onClick }) {
  return (
    <button onClick={onClick} disabled={loading} className={`px-3 py-1.5 rounded-lg text-xs font-medium text-white transition-colors disabled:opacity-50 ${cls}`}>
      {loading ? '...' : label}
    </button>
  )
}

function SmallBtn({ label, onClick, danger }) {
  return (
    <button
      onClick={onClick}
      className={`px-1.5 py-0.5 rounded text-[10px] font-medium transition-colors ${
        danger ? 'text-red-400 hover:text-red-300' : 'text-p-muted hover:text-white bg-white/5 hover:bg-white/10'
      }`}
    >
      {label}
    </button>
  )
}
