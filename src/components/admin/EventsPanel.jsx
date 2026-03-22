import { useState, useEffect } from 'react'
import { fetchEvents, updateEvent, fetchApplicants, fetchAssignments, createAssignments, updateAssignment, deleteAssignment, createCheckoutSession, fetchSuggestedWorkers, fetchBenchPool, addToBench, updateBenchAssignment, removeBenchAssignment, triggerBenchDispatch, fetchQuote, createQuote, updateQuote, fetchPayments, createDepositLink, createBalanceLink, fetchExitRecords, cancelEvent, fetchEventReviews } from '../../lib/adminApi.js'

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

  // Geofence edit state
  const [editingGeo, setEditingGeo] = useState(null)
  const [geoForm, setGeoForm] = useState({})

  // Stripe payment link state
  const [creatingPaymentLink, setCreatingPaymentLink] = useState(null)
  const [paymentLinkError, setPaymentLinkError] = useState(null)

  // Bench pool state
  const [benchPool, setBenchPool] = useState([])
  const [benchLoading, setBenchLoading] = useState(false)
  const [showBenchModal, setShowBenchModal] = useState(false)
  const [benchWorkers, setBenchWorkers] = useState([])
  const [selectedBenchWorker, setSelectedBenchWorker] = useState(null)
  const [benchTier, setBenchTier] = useState(1)
  const [benchFee, setBenchFee] = useState('')
  const [addingBench, setAddingBench] = useState(false)
  const [benchDispatching, setBenchDispatching] = useState(null)

  // Quote & deposit state
  const [quote, setQuote] = useState(null)
  const [quoteLoading, setQuoteLoading] = useState(false)
  const [showQuoteForm, setShowQuoteForm] = useState(false)
  const [quoteForm, setQuoteForm] = useState({ worker_count: '', hours_estimated: '', bill_rate_per_hour: '', supervisor_fee: '', bench_fee: '', platform_fee: '', roster_hold_fee: '' })
  const [creatingQuote, setCreatingQuote] = useState(false)
  const [payments, setPayments] = useState([])
  const [creatingDeposit, setCreatingDeposit] = useState(false)
  const [creatingBalance, setCreatingBalance] = useState(false)
  const [exitRecords, setExitRecords] = useState([])
  const [cancelling, setCancelling] = useState(null)
  const [cancelReason, setCancelReason] = useState('')
  const [reviews, setReviews] = useState(null)
  const [reviewsLoading, setReviewsLoading] = useState(false)
  const [showReviews, setShowReviews] = useState(false)

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
    setBenchLoading(true)
    setQuoteLoading(true)
    try {
      const data = await fetchAssignments({ event_id: id })
      setAssignments(data)
    } catch (err) {
      console.error('Failed to load assignments:', err)
    }
    setAssignLoading(false)
    try {
      const bench = await fetchBenchPool(id)
      setBenchPool(bench)
    } catch (err) {
      console.error('Failed to load bench pool:', err)
      setBenchPool([])
    }
    setBenchLoading(false)
    // Load quote + payments + exit records
    try {
      const [q, p, exits] = await Promise.all([
        fetchQuote(id).catch(() => null),
        fetchPayments(id).catch(() => []),
        fetchExitRecords({ event_id: id }).catch(() => []),
      ])
      setQuote(q)
      setPayments(p || [])
      setExitRecords(exits || [])
    } catch (err) {
      console.error('Failed to load quote/payments/exits:', err)
    }
    setQuoteLoading(false)
    // Load reviews
    setReviewsLoading(true)
    try {
      const r = await fetchEventReviews(id)
      setReviews(r)
    } catch (err) {
      setReviews(null)
    }
    setReviewsLoading(false)
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

  const startEditGeo = (ev) => {
    setEditingGeo(ev.id)
    setGeoForm({
      latitude: ev.latitude || '',
      longitude: ev.longitude || '',
      geofence_radius_meters: ev.geofence_radius_meters || 200,
      bench_coverage_threshold: ev.bench_coverage_threshold ?? 80,
      bench_pool_size: ev.bench_pool_size ?? 3,
    })
  }

  const parseGoogleMapsUrl = (url) => {
    // Try to extract lat,lng from Google Maps URL patterns
    const patterns = [
      /@(-?\d+\.\d+),(-?\d+\.\d+)/,           // @lat,lng
      /place\/.*?\/(-?\d+\.\d+),(-?\d+\.\d+)/, // place/Name/lat,lng
      /q=(-?\d+\.\d+),(-?\d+\.\d+)/,           // q=lat,lng
    ]
    for (const p of patterns) {
      const m = url.match(p)
      if (m) return { latitude: m[1], longitude: m[2] }
    }
    return null
  }

  const handlePasteCoords = () => {
    navigator.clipboard?.readText().then(text => {
      const coords = parseGoogleMapsUrl(text)
      if (coords) setGeoForm(f => ({ ...f, ...coords }))
    })
  }

  const saveGeo = async (id) => {
    setUpdating(id)
    try {
      const updates = {
        latitude: geoForm.latitude ? parseFloat(geoForm.latitude) : null,
        longitude: geoForm.longitude ? parseFloat(geoForm.longitude) : null,
        geofence_radius_meters: parseInt(geoForm.geofence_radius_meters, 10) || 200,
        bench_coverage_threshold: parseInt(geoForm.bench_coverage_threshold, 10) || 80,
        bench_pool_size: parseInt(geoForm.bench_pool_size, 10) || 3,
      }
      await updateEvent(id, updates)
      setEvents(prev => prev.map(e => e.id === id ? { ...e, ...updates } : e))
      setEditingGeo(null)
    } catch (err) {
      console.error('Failed to update geo:', err)
    }
    setUpdating(null)
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
      let workers
      try {
        // Use smart suggestions sorted by match score
        workers = await fetchSuggestedWorkers(expanded)
      } catch (suggestErr) {
        console.warn('Suggest-workers failed, falling back to approved list:', suggestErr.message)
        const all = await fetchApplicants('approved')
        const assignedIds = new Set(assignments.map(a => a.worker_id))
        workers = all.filter(w => !assignedIds.has(w.id))
      }
      setAvailableWorkers(workers)
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

  const openBenchModal = async () => {
    setShowBenchModal(true)
    setSelectedBenchWorker(null)
    setBenchTier(1)
    setBenchFee('')
    try {
      const all = await fetchApplicants('approved')
      const benchIds = new Set(benchPool.map(b => b.worker_id))
      const assignedIds = new Set(assignments.map(a => a.worker_id))
      setBenchWorkers(all.filter(w => !benchIds.has(w.id) && !assignedIds.has(w.id)))
    } catch (err) {
      console.error('Failed to load workers for bench:', err)
    }
  }

  const handleAddToBench = async () => {
    if (!selectedBenchWorker || !expanded) return
    setAddingBench(true)
    try {
      await addToBench(expanded, selectedBenchWorker, benchTier, benchFee ? parseFloat(benchFee) : null)
      const bench = await fetchBenchPool(expanded)
      setBenchPool(bench)
      setShowBenchModal(false)
    } catch (err) {
      console.error('Failed to add to bench:', err)
    }
    setAddingBench(false)
  }

  const handleBenchAction = async (benchId, action) => {
    try {
      if (action === 'remove') {
        await removeBenchAssignment(benchId)
      } else {
        await updateBenchAssignment(benchId, { status: action })
      }
      const bench = await fetchBenchPool(expanded)
      setBenchPool(bench)
    } catch (err) {
      console.error('Failed to update bench assignment:', err)
    }
  }

  const handleBenchDispatch = async (tier) => {
    if (!expanded) return
    setBenchDispatching(tier)
    try {
      await triggerBenchDispatch(expanded, tier)
      const bench = await fetchBenchPool(expanded)
      setBenchPool(bench)
    } catch (err) {
      console.error('Failed to dispatch bench:', err)
    }
    setBenchDispatching(null)
  }

  const handleCreateQuote = async (eventId) => {
    setCreatingQuote(true)
    try {
      const data = await createQuote({
        event_id: eventId,
        worker_count: parseInt(quoteForm.worker_count) || 1,
        hours_estimated: parseFloat(quoteForm.hours_estimated) || 1,
        bill_rate_per_hour: parseFloat(quoteForm.bill_rate_per_hour) || 0,
        supervisor_fee: parseFloat(quoteForm.supervisor_fee) || 0,
        bench_fee: parseFloat(quoteForm.bench_fee) || 0,
        platform_fee: parseFloat(quoteForm.platform_fee) || 0,
        roster_hold_fee: parseFloat(quoteForm.roster_hold_fee) || 0,
      })
      setQuote(data)
      setShowQuoteForm(false)
      // Refresh event to get updated deposit/balance amounts
      const events = await fetchEvents(filter === 'all' ? '' : filter)
      setEvents(events)
    } catch (err) {
      console.error('Failed to create quote:', err)
      alert('Failed to create quote: ' + err.message)
    }
    setCreatingQuote(false)
  }

  const handleCreateDepositLink = async (eventId) => {
    setCreatingDeposit(true)
    try {
      const result = await createDepositLink(eventId)
      if (result.checkout_url) navigator.clipboard?.writeText(result.checkout_url)
      alert('Deposit link created and copied to clipboard!')
      const p = await fetchPayments(eventId).catch(() => [])
      setPayments(p || [])
    } catch (err) {
      alert('Failed: ' + err.message)
    }
    setCreatingDeposit(false)
  }

  const handleCreateBalanceLink = async (eventId) => {
    setCreatingBalance(true)
    try {
      const result = await createBalanceLink(eventId)
      if (result.checkout_url) navigator.clipboard?.writeText(result.checkout_url)
      alert('Balance link created and copied to clipboard!')
      const p = await fetchPayments(eventId).catch(() => [])
      setPayments(p || [])
    } catch (err) {
      alert('Failed: ' + err.message)
    }
    setCreatingBalance(false)
  }

  const handleCancelEvent = async (eventId) => {
    if (!confirm('Cancel this event? This will notify the organizer and process any applicable refund.')) return
    setCancelling(eventId)
    try {
      const result = await cancelEvent(eventId, cancelReason)
      setEvents(prev => prev.map(e => e.id === eventId ? { ...e, status: 'cancelled' } : e))
      setCancelling(null)
      setCancelReason('')
      if (result.refund?.refund_amount > 0) {
        alert(`Event cancelled. Refund: $${result.refund.refund_amount.toFixed(2)} (${result.refund.refund_pct}%)`)
      } else {
        alert('Event cancelled. ' + (result.refund?.reason || ''))
      }
    } catch (err) {
      alert('Cancel failed: ' + err.message)
      setCancelling(null)
    }
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
                    <div>
                      <span className="text-p-muted text-xs">Service Tier: </span>
                      <select
                        value={ev.service_tier || 'labor_supply'}
                        onChange={async (e) => {
                          try {
                            await updateEvent(ev.id, { service_tier: e.target.value })
                            setEvents(prev => prev.map(x => x.id === ev.id ? { ...x, service_tier: e.target.value } : x))
                          } catch (err) { console.error('Failed to update service tier:', err) }
                        }}
                        className="bg-p-bg border border-p-border rounded px-2 py-0.5 text-xs text-white"
                      >
                        <option value="labor_supply">Labor Supply</option>
                        <option value="managed_labor">Managed Labor</option>
                      </select>
                    </div>
                  </div>

                  {/* Geofence Section */}
                  <div className="bg-black/20 rounded-lg p-3 mb-4">
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="text-white text-xs font-semibold uppercase tracking-wider">Geofence</h4>
                      {editingGeo !== ev.id ? (
                        <button onClick={() => startEditGeo(ev)} className="text-p-green text-[10px] font-medium hover:opacity-80">
                          Edit
                        </button>
                      ) : (
                        <div className="flex gap-2">
                          <button onClick={() => saveGeo(ev.id)} className="text-p-green text-[10px] font-medium hover:opacity-80">Save</button>
                          <button onClick={() => setEditingGeo(null)} className="text-p-muted text-[10px] font-medium hover:opacity-80">Cancel</button>
                        </div>
                      )}
                    </div>
                    {editingGeo === ev.id ? (
                      <div className="space-y-2">
                        <div className="grid grid-cols-3 gap-2">
                          <div>
                            <label className="text-p-muted text-[10px]">Latitude</label>
                            <input type="number" step="any" value={geoForm.latitude} onChange={e => setGeoForm(f => ({ ...f, latitude: e.target.value }))}
                              placeholder="33.7490" className="w-full bg-p-bg border border-p-border rounded px-2 py-1 text-xs text-white mt-0.5" />
                          </div>
                          <div>
                            <label className="text-p-muted text-[10px]">Longitude</label>
                            <input type="number" step="any" value={geoForm.longitude} onChange={e => setGeoForm(f => ({ ...f, longitude: e.target.value }))}
                              placeholder="-84.3880" className="w-full bg-p-bg border border-p-border rounded px-2 py-1 text-xs text-white mt-0.5" />
                          </div>
                          <div>
                            <label className="text-p-muted text-[10px]">Radius (m)</label>
                            <input type="number" value={geoForm.geofence_radius_meters} onChange={e => setGeoForm(f => ({ ...f, geofence_radius_meters: e.target.value }))}
                              className="w-full bg-p-bg border border-p-border rounded px-2 py-1 text-xs text-white mt-0.5" />
                          </div>
                        </div>
                        <button onClick={handlePasteCoords} className="text-p-green text-[10px] font-medium hover:opacity-80">
                          Paste from Google Maps URL
                        </button>
                        <div className="grid grid-cols-2 gap-2 mt-2">
                          <div>
                            <label className="text-p-muted text-[10px]">Bench Coverage Threshold (%)</label>
                            <input type="number" min="0" max="100" value={geoForm.bench_coverage_threshold} onChange={e => setGeoForm(f => ({ ...f, bench_coverage_threshold: e.target.value }))}
                              className="w-full bg-p-bg border border-p-border rounded px-2 py-1 text-xs text-white mt-0.5" />
                          </div>
                          <div>
                            <label className="text-p-muted text-[10px]">Bench Pool Size</label>
                            <input type="number" min="0" value={geoForm.bench_pool_size} onChange={e => setGeoForm(f => ({ ...f, bench_pool_size: e.target.value }))}
                              className="w-full bg-p-bg border border-p-border rounded px-2 py-1 text-xs text-white mt-0.5" />
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="text-xs">
                        {ev.latitude && ev.longitude ? (
                          <span className="text-white">{ev.latitude}, {ev.longitude} <span className="text-p-muted">({ev.geofence_radius_meters || 200}m radius)</span></span>
                        ) : (
                          <span className="text-p-muted">No coordinates set — workers can check in from anywhere</span>
                        )}
                      </div>
                    )}
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

                  {/* Quote & Deposit Section */}
                  <div className="bg-black/20 rounded-lg p-3 mb-4">
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="text-white text-xs font-semibold uppercase tracking-wider">Quote & Deposit</h4>
                      {!quote && !showQuoteForm && (
                        <button onClick={() => { setShowQuoteForm(true); setQuoteForm({ worker_count: ev.workers_needed || '', hours_estimated: '', bill_rate_per_hour: ev.bill_rate || '', supervisor_fee: '', bench_fee: '', platform_fee: '', roster_hold_fee: '' }) }}
                          className="text-p-green text-[10px] font-medium hover:opacity-80">
                          Generate Quote
                        </button>
                      )}
                    </div>

                    {quoteLoading ? (
                      <p className="text-p-muted text-xs">Loading...</p>
                    ) : showQuoteForm ? (
                      <div className="space-y-2">
                        <div className="grid grid-cols-3 gap-2">
                          <div>
                            <label className="text-p-muted text-[10px]">Workers</label>
                            <input type="number" min="1" value={quoteForm.worker_count} onChange={e => setQuoteForm(f => ({ ...f, worker_count: e.target.value }))}
                              className="w-full bg-p-bg border border-p-border rounded px-2 py-1 text-xs text-white mt-0.5" />
                          </div>
                          <div>
                            <label className="text-p-muted text-[10px]">Hours</label>
                            <input type="number" step="0.5" value={quoteForm.hours_estimated} onChange={e => setQuoteForm(f => ({ ...f, hours_estimated: e.target.value }))}
                              className="w-full bg-p-bg border border-p-border rounded px-2 py-1 text-xs text-white mt-0.5" />
                          </div>
                          <div>
                            <label className="text-p-muted text-[10px]">Bill Rate ($/hr)</label>
                            <input type="number" step="0.01" value={quoteForm.bill_rate_per_hour} onChange={e => setQuoteForm(f => ({ ...f, bill_rate_per_hour: e.target.value }))}
                              className="w-full bg-p-bg border border-p-border rounded px-2 py-1 text-xs text-white mt-0.5" />
                          </div>
                        </div>
                        <div className="grid grid-cols-4 gap-2">
                          <div>
                            <label className="text-p-muted text-[10px]">Supervisor Fee</label>
                            <input type="number" step="0.01" value={quoteForm.supervisor_fee} onChange={e => setQuoteForm(f => ({ ...f, supervisor_fee: e.target.value }))}
                              placeholder="0" className="w-full bg-p-bg border border-p-border rounded px-2 py-1 text-xs text-white mt-0.5" />
                          </div>
                          <div>
                            <label className="text-p-muted text-[10px]">Bench Fee</label>
                            <input type="number" step="0.01" value={quoteForm.bench_fee} onChange={e => setQuoteForm(f => ({ ...f, bench_fee: e.target.value }))}
                              placeholder="0" className="w-full bg-p-bg border border-p-border rounded px-2 py-1 text-xs text-white mt-0.5" />
                          </div>
                          <div>
                            <label className="text-p-muted text-[10px]">Platform Fee</label>
                            <input type="number" step="0.01" value={quoteForm.platform_fee} onChange={e => setQuoteForm(f => ({ ...f, platform_fee: e.target.value }))}
                              placeholder="0" className="w-full bg-p-bg border border-p-border rounded px-2 py-1 text-xs text-white mt-0.5" />
                          </div>
                          <div>
                            <label className="text-p-muted text-[10px]">Roster Hold</label>
                            <input type="number" step="0.01" value={quoteForm.roster_hold_fee} onChange={e => setQuoteForm(f => ({ ...f, roster_hold_fee: e.target.value }))}
                              placeholder="0" className="w-full bg-p-bg border border-p-border rounded px-2 py-1 text-xs text-white mt-0.5" />
                          </div>
                        </div>
                        <div className="flex gap-2 pt-1">
                          <button onClick={() => handleCreateQuote(ev.id)} disabled={creatingQuote}
                            className="px-3 py-1.5 bg-p-green text-black rounded text-[10px] font-semibold disabled:opacity-50 hover:opacity-90">
                            {creatingQuote ? 'Generating...' : 'Generate Quote'}
                          </button>
                          <button onClick={() => setShowQuoteForm(false)} className="text-p-muted text-[10px] hover:text-white">Cancel</button>
                        </div>
                      </div>
                    ) : quote ? (
                      <div className="space-y-2">
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                          <div><span className="text-p-muted">Workers: </span><span className="text-white">{quote.worker_count}</span></div>
                          <div><span className="text-p-muted">Hours: </span><span className="text-white">{quote.hours_estimated}</span></div>
                          <div><span className="text-p-muted">Rate: </span><span className="text-white">{fmtMoney(quote.bill_rate_per_hour)}/hr</span></div>
                          <div><span className="text-p-muted">Labor: </span><span className="text-white">{fmtMoney(quote.labor_subtotal)}</span></div>
                        </div>
                        {(quote.supervisor_fee > 0 || quote.bench_fee > 0 || quote.platform_fee > 0 || quote.roster_hold_fee > 0) && (
                          <div className="grid grid-cols-4 gap-2 text-xs">
                            {quote.supervisor_fee > 0 && <div><span className="text-p-muted">Supervisor: </span><span className="text-white">{fmtMoney(quote.supervisor_fee)}</span></div>}
                            {quote.bench_fee > 0 && <div><span className="text-p-muted">Bench: </span><span className="text-white">{fmtMoney(quote.bench_fee)}</span></div>}
                            {quote.platform_fee > 0 && <div><span className="text-p-muted">Platform: </span><span className="text-white">{fmtMoney(quote.platform_fee)}</span></div>}
                            {quote.roster_hold_fee > 0 && <div><span className="text-p-muted">Roster Hold: </span><span className="text-white">{fmtMoney(quote.roster_hold_fee)}</span></div>}
                          </div>
                        )}
                        <div className="border-t border-p-border pt-2 grid grid-cols-3 gap-2 text-xs">
                          <div><span className="text-p-muted">Total: </span><span className="text-white font-semibold">{fmtMoney(quote.total)}</span></div>
                          <div><span className="text-p-muted">Deposit: </span><span className="text-green-400 font-semibold">{fmtMoney(quote.deposit_amount)}</span></div>
                          <div><span className="text-p-muted">Balance (Net 15): </span><span className="text-yellow-400 font-semibold">{fmtMoney(quote.balance_amount)}</span></div>
                        </div>
                        <div className="text-[9px] text-p-muted">Deposit = bench fees + labor + roster hold. Balance due 15 days after event.</div>

                        {/* Deposit/Balance status */}
                        <div className="flex items-center gap-3 pt-1">
                          <div className="flex items-center gap-1.5">
                            <span className="text-[10px] text-p-muted">Deposit:</span>
                            <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${
                              ev.deposit_status === 'paid' ? 'bg-green-500/20 text-green-400' :
                              ev.deposit_status === 'pending' ? 'bg-yellow-500/20 text-yellow-400' :
                              'bg-white/10 text-p-muted'
                            }`}>{ev.deposit_status || 'none'}</span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <span className="text-[10px] text-p-muted">Balance:</span>
                            <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${
                              ev.payment_status === 'paid' ? 'bg-green-500/20 text-green-400' :
                              ev.balance_due_date && new Date(ev.balance_due_date) < new Date() ? 'bg-red-500/20 text-red-400' :
                              'bg-white/10 text-p-muted'
                            }`}>{ev.payment_status === 'paid' ? 'paid' : ev.balance_due_date ? `due ${ev.balance_due_date}` : 'not due'}</span>
                          </div>
                        </div>

                        {/* Deposit/Balance action buttons */}
                        <div className="flex gap-2 pt-1">
                          {ev.deposit_status !== 'paid' && (
                            <button onClick={() => handleCreateDepositLink(ev.id)} disabled={creatingDeposit}
                              className="px-2.5 py-1 bg-[#635bff] hover:bg-[#5349e0] rounded text-[10px] text-white font-medium transition-colors disabled:opacity-50">
                              {creatingDeposit ? 'Creating...' : 'Send Deposit Link'}
                            </button>
                          )}
                          {ev.deposit_status === 'paid' && ev.payment_status !== 'paid' && (
                            <button onClick={() => handleCreateBalanceLink(ev.id)} disabled={creatingBalance}
                              className="px-2.5 py-1 bg-[#635bff] hover:bg-[#5349e0] rounded text-[10px] text-white font-medium transition-colors disabled:opacity-50">
                              {creatingBalance ? 'Creating...' : 'Send Balance Invoice'}
                            </button>
                          )}
                          <button onClick={() => { setShowQuoteForm(true); setQuoteForm({ worker_count: quote.worker_count || '', hours_estimated: quote.hours_estimated || '', bill_rate_per_hour: quote.bill_rate_per_hour || '', supervisor_fee: quote.supervisor_fee || '', bench_fee: quote.bench_fee || '', platform_fee: quote.platform_fee || '', roster_hold_fee: quote.roster_hold_fee || '' }) }}
                            className="text-p-muted text-[10px] hover:text-white">Regenerate</button>
                        </div>

                        {/* Payment history */}
                        {payments.length > 0 && (
                          <div className="border-t border-p-border pt-2 mt-1">
                            <span className="text-p-muted text-[10px] font-semibold uppercase">Payment History</span>
                            <div className="space-y-1 mt-1">
                              {payments.map(p => (
                                <div key={p.id} className="flex items-center gap-2 text-[10px]">
                                  <span className={`px-1.5 py-0.5 rounded font-medium ${
                                    p.status === 'succeeded' ? 'bg-green-500/20 text-green-400' :
                                    p.status === 'pending' ? 'bg-yellow-500/20 text-yellow-400' :
                                    'bg-red-500/20 text-red-400'
                                  }`}>{p.status}</span>
                                  <span className="text-white">{p.payment_type}</span>
                                  <span className="text-white font-medium">{fmtMoney(p.amount)}</span>
                                  {p.paid_at && <span className="text-p-muted">{new Date(p.paid_at).toLocaleDateString()}</span>}
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Quote status */}
                        <div className="flex items-center gap-2 pt-1">
                          <span className="text-[10px] text-p-muted">Quote status:</span>
                          <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${
                            quote.status === 'accepted' ? 'bg-green-500/20 text-green-400' :
                            quote.status === 'sent' ? 'bg-yellow-500/20 text-yellow-400' :
                            quote.status === 'expired' ? 'bg-red-500/20 text-red-400' :
                            'bg-white/10 text-p-muted'
                          }`}>{quote.status}</span>
                          {quote.status === 'draft' && (
                            <button onClick={async () => { await updateQuote(quote.id, { status: 'sent' }); setQuote(q => ({ ...q, status: 'sent' })) }}
                              className="text-p-green text-[10px] font-medium hover:opacity-80">Mark Sent</button>
                          )}
                          {quote.status === 'sent' && (
                            <button onClick={async () => { await updateQuote(quote.id, { status: 'accepted' }); setQuote(q => ({ ...q, status: 'accepted' })) }}
                              className="text-p-green text-[10px] font-medium hover:opacity-80">Mark Accepted</button>
                          )}
                        </div>
                      </div>
                    ) : (
                      <p className="text-p-muted text-xs">No quote generated yet</p>
                    )}
                  </div>

                  {/* Pay Summary (exit records) */}
                  {exitRecords.length > 0 && (
                    <div className="bg-black/20 rounded-lg p-3 mb-4">
                      <h4 className="text-white text-xs font-semibold uppercase tracking-wider mb-2">Pay Summary</h4>
                      <div className="text-xs text-p-muted mb-2">
                        Total labor cost: <span className="text-white font-semibold">{fmtMoney(exitRecords.reduce((sum, r) => sum + (parseFloat(r.pay_amount) || 0), 0))}</span>
                      </div>
                      <div className="space-y-1">
                        {exitRecords.map(r => (
                          <div key={r.id} className="flex items-center gap-2 text-[10px] bg-black/30 rounded px-2 py-1.5">
                            <span className="text-white flex-1">{r.applicants?.first_name} {r.applicants?.last_name}</span>
                            <span className="text-p-muted">{r.hours_worked}h</span>
                            <span className="text-p-muted">{fmtMoney(r.pay_rate)}/hr</span>
                            <span className="text-white font-medium">{fmtMoney(r.pay_amount)}</span>
                            <span className={`px-1 py-0.5 rounded text-[9px] font-medium ${
                              r.exit_reason === 'completed' ? 'bg-green-500/20 text-green-400' :
                              r.exit_reason?.startsWith('released') ? 'bg-orange-500/20 text-orange-400' :
                              'bg-yellow-500/20 text-yellow-400'
                            }`}>{r.exit_reason?.replace(/_/g, ' ')}</span>
                            {r.strikes_applied > 0 && (
                              <span className="text-red-400 text-[9px] font-bold">+{r.strikes_applied} strike{r.strikes_applied > 1 ? 's' : ''}</span>
                            )}
                            {r.disputed && <span className="text-red-400 text-[9px] font-bold">DISPUTED</span>}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

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
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          value={cancelReason}
                          onChange={e => setCancelReason(e.target.value)}
                          placeholder="Cancel reason..."
                          className="bg-p-bg border border-p-border rounded px-2 py-1 text-[10px] text-white w-40"
                        />
                        <button
                          onClick={() => handleCancelEvent(ev.id)}
                          disabled={cancelling === ev.id}
                          className="px-3 py-1.5 rounded-lg text-xs font-medium text-white bg-red-600 hover:bg-red-700 transition-colors disabled:opacity-50"
                        >
                          {cancelling === ev.id ? 'Cancelling...' : 'Cancel Event'}
                        </button>
                      </div>
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
                            <span className="text-white text-xs flex-1">
                              {a.applicants?.first_name} {a.applicants?.last_name}
                              {a.is_supervisor && <span className="ml-1.5 text-[#ffffff] text-[9px] font-bold uppercase">Lead</span>}
                            </span>
                            <button
                              onClick={async (e) => {
                                e.stopPropagation()
                                try {
                                  await updateAssignment(a.id, { is_supervisor: !a.is_supervisor })
                                  setAssignments(prev => prev.map(x => x.id === a.id ? { ...x, is_supervisor: !a.is_supervisor } : x))
                                } catch (err) { console.error('Failed to toggle supervisor:', err) }
                              }}
                              className={`px-1.5 py-0.5 rounded text-[9px] font-medium transition-colors ${
                                a.is_supervisor ? 'bg-[#ffffff]/20 text-[#ffffff]' : 'bg-white/5 text-p-muted hover:text-white'
                              }`}
                              title={a.is_supervisor ? 'Remove as supervisor' : 'Mark as supervisor'}
                            >
                              {a.is_supervisor ? 'Supervisor' : 'Set Lead'}
                            </button>
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
                              {availableWorkers.map(w => {
                                const score = w.match_score
                                const scoreBadgeColor = score >= 5 ? 'bg-green-500/20 text-green-400' : score >= 3 ? 'bg-yellow-500/20 text-yellow-400' : 'bg-white/10 text-p-muted'
                                return (
                                  <label key={w.id} className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-white/[0.03] cursor-pointer">
                                    <input
                                      type="checkbox"
                                      checked={selectedWorkers.includes(w.id)}
                                      onChange={() => {
                                        setSelectedWorkers(prev =>
                                          prev.includes(w.id) ? prev.filter(id => id !== w.id) : [...prev, w.id]
                                        )
                                      }}
                                      className="accent-[#ffffff]"
                                    />
                                    {w.photo_url ? (
                                      <img src={w.photo_url} alt="" className="w-8 h-8 rounded-full object-cover" />
                                    ) : (
                                      <div className="w-8 h-8 rounded-full bg-p-border flex items-center justify-center">
                                        <span className="text-p-muted text-xs">{w.first_name?.[0]}{w.last_name?.[0]}</span>
                                      </div>
                                    )}
                                    <div className="flex-1 min-w-0">
                                      <div className="flex items-center gap-1.5 flex-wrap">
                                        <span className="text-white text-xs font-medium">{w.first_name} {w.last_name}</span>
                                        {score != null && (
                                          <span className={`px-1.5 py-0.5 rounded text-[9px] font-semibold ${scoreBadgeColor}`}>
                                            Match: {score}
                                          </span>
                                        )}
                                        {w.avg_rating != null && (
                                          <span className="text-[9px] text-yellow-400">★ {w.avg_rating}</span>
                                        )}
                                      </div>
                                      <div className="text-p-muted text-[10px]">{w.city} · {w.roles?.join(', ')}</div>
                                    </div>
                                  </label>
                                )
                              })}
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

                  {/* Bench Pool */}
                  <div className="border-t border-p-border pt-3 mt-3">
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="text-white text-sm font-medium">
                        Bench Pool ({benchPool.filter(b => b.status === 'standby').length} standby)
                      </h4>
                      <button
                        onClick={openBenchModal}
                        className="text-xs text-p-green font-medium hover:opacity-80 transition-opacity"
                      >
                        + Add to Bench
                      </button>
                    </div>

                    {/* Coverage indicator */}
                    {(() => {
                      const confirmed = assignments.filter(a => ['confirmed', 'checked_in', 'completed'].includes(a.status)).length
                      const needed = ev.workers_needed || 0
                      const pct = needed ? Math.round((confirmed / needed) * 100) : 0
                      const color = pct >= 80 ? 'text-green-400' : pct >= 50 ? 'text-yellow-400' : 'text-red-400'
                      return needed ? (
                        <div className={`text-[10px] font-medium mb-2 ${color}`}>
                          Coverage: {confirmed}/{needed} ({pct}%)
                        </div>
                      ) : null
                    })()}

                    {benchLoading ? (
                      <p className="text-p-muted text-xs">Loading bench...</p>
                    ) : benchPool.length === 0 ? (
                      <p className="text-p-muted text-xs">No bench workers assigned</p>
                    ) : (
                      <div className="space-y-1">
                        {benchPool.map(b => {
                          const w = b.applicants || b.worker
                          const tierColors = { 1: 'bg-green-500/20 text-green-400', 2: 'bg-yellow-500/20 text-yellow-400', 3: 'bg-red-500/20 text-red-400' }
                          const statusColors = { standby: 'bg-white/10 text-p-muted', called_in: 'bg-yellow-500/20 text-yellow-400', confirmed: 'bg-green-500/20 text-green-400', declined: 'bg-red-500/20 text-red-400' }
                          return (
                            <div key={b.id} className="flex items-center gap-2 bg-black/20 rounded-lg px-3 py-2">
                              {w?.photo_url ? (
                                <img src={w.photo_url} alt="" className="w-7 h-7 rounded-full object-cover" />
                              ) : (
                                <div className="w-7 h-7 rounded-full bg-p-border flex items-center justify-center">
                                  <span className="text-p-muted text-[10px]">{w?.first_name?.[0]}{w?.last_name?.[0]}</span>
                                </div>
                              )}
                              <span className="text-white text-xs flex-1 truncate">
                                {w?.first_name} {w?.last_name}
                              </span>
                              <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${tierColors[b.tier] || 'bg-white/10 text-p-muted'}`}>
                                T{b.tier}
                              </span>
                              <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${statusColors[b.status] || 'bg-p-border text-p-muted'}`}>
                                {b.status?.replace(/_/g, ' ')}
                              </span>
                              {b.standby_fee != null && (
                                <span className="text-p-muted text-[10px]">${parseFloat(b.standby_fee).toFixed(2)}</span>
                              )}
                              <div className="flex gap-1">
                                {b.status === 'standby' && (
                                  <SmallBtn label="Call In" onClick={() => handleBenchAction(b.id, 'called_in')} />
                                )}
                                {b.status === 'called_in' && (
                                  <>
                                    <SmallBtn label="Confirm" onClick={() => handleBenchAction(b.id, 'confirmed')} />
                                    <SmallBtn label="Cancel" onClick={() => handleBenchAction(b.id, 'standby')} />
                                  </>
                                )}
                                <SmallBtn label="×" onClick={() => handleBenchAction(b.id, 'remove')} danger />
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    )}

                    {/* Dispatch tier buttons */}
                    <div className="flex gap-2 mt-3 flex-wrap">
                      <button
                        onClick={() => handleBenchDispatch(1)}
                        disabled={benchDispatching === 1}
                        className="px-3 py-1.5 rounded-lg text-xs font-medium text-white bg-green-600 hover:bg-green-700 transition-colors disabled:opacity-50"
                      >
                        {benchDispatching === 1 ? 'Dispatching...' : 'Dispatch Tier 1 (Standby)'}
                      </button>
                      <button
                        onClick={() => handleBenchDispatch(2)}
                        disabled={benchDispatching === 2}
                        className="px-3 py-1.5 rounded-lg text-xs font-medium text-white bg-yellow-600 hover:bg-yellow-700 transition-colors disabled:opacity-50"
                      >
                        {benchDispatching === 2 ? 'Dispatching...' : 'Dispatch Tier 2 (Nearby Pool)'}
                      </button>
                      <div className="flex flex-col">
                        <button
                          onClick={() => handleBenchDispatch(3)}
                          disabled={benchDispatching === 3}
                          className="px-3 py-1.5 rounded-lg text-xs font-medium text-white bg-red-600 hover:bg-red-700 transition-colors disabled:opacity-50"
                        >
                          {benchDispatching === 3 ? 'Dispatching...' : 'Dispatch Tier 3 (Emergency All-Call)'}
                        </button>
                        <span className="text-red-400 text-[9px] mt-0.5">Notifies all available workers</span>
                      </div>
                    </div>
                  </div>

                  {/* Add to Bench Modal */}
                  {showBenchModal && (
                    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 px-4" onClick={() => setShowBenchModal(false)}>
                      <div className="bg-p-surface border border-p-border rounded-xl w-full max-w-md max-h-[80vh] overflow-hidden" onClick={e => e.stopPropagation()}>
                        <div className="px-4 py-3 border-b border-p-border flex items-center justify-between">
                          <h3 className="text-white font-semibold text-sm">Add to Bench — {ev.title}</h3>
                          <button onClick={() => setShowBenchModal(false)} className="text-p-muted hover:text-white text-lg">×</button>
                        </div>
                        <div className="p-4 space-y-3">
                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <label className="text-p-muted text-[10px]">Tier</label>
                              <select value={benchTier} onChange={e => setBenchTier(parseInt(e.target.value, 10))}
                                className="w-full bg-p-bg border border-p-border rounded px-2 py-1.5 text-xs text-white mt-0.5">
                                <option value={1}>Tier 1 — Standby</option>
                                <option value={2}>Tier 2 — Nearby Pool</option>
                                <option value={3}>Tier 3 — Emergency</option>
                              </select>
                            </div>
                            <div>
                              <label className="text-p-muted text-[10px]">Standby Fee ($)</label>
                              <input type="number" step="0.01" value={benchFee} onChange={e => setBenchFee(e.target.value)}
                                placeholder="0.00" className="w-full bg-p-bg border border-p-border rounded px-2 py-1.5 text-xs text-white mt-0.5" />
                            </div>
                          </div>
                          <div className="overflow-y-auto max-h-[45vh]">
                            {benchWorkers.length === 0 ? (
                              <p className="text-p-muted text-xs text-center py-4">No available workers</p>
                            ) : (
                              <div className="space-y-1">
                                {benchWorkers.map(w => (
                                  <label key={w.id} className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-white/[0.03] cursor-pointer">
                                    <input
                                      type="radio"
                                      name="benchWorker"
                                      checked={selectedBenchWorker === w.id}
                                      onChange={() => setSelectedBenchWorker(w.id)}
                                      className="accent-[#ffffff]"
                                    />
                                    {w.photo_url ? (
                                      <img src={w.photo_url} alt="" className="w-8 h-8 rounded-full object-cover" />
                                    ) : (
                                      <div className="w-8 h-8 rounded-full bg-p-border flex items-center justify-center">
                                        <span className="text-p-muted text-xs">{w.first_name?.[0]}{w.last_name?.[0]}</span>
                                      </div>
                                    )}
                                    <div className="flex-1 min-w-0">
                                      <span className="text-white text-xs font-medium">{w.first_name} {w.last_name}</span>
                                      <div className="text-p-muted text-[10px]">{w.city} · {w.roles?.join(', ')}</div>
                                    </div>
                                  </label>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                        {benchWorkers.length > 0 && (
                          <div className="px-4 py-3 border-t border-p-border">
                            <button
                              onClick={handleAddToBench}
                              disabled={!selectedBenchWorker || addingBench}
                              className="w-full bg-p-green text-black rounded-lg py-2.5 text-sm font-semibold disabled:opacity-50 hover:opacity-90 transition-all"
                            >
                              {addingBench ? 'Adding...' : 'Add to Bench'}
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Reviews & Feedback */}
                  <div className="mt-4 border border-p-border rounded-xl overflow-hidden">
                  <button
                    onClick={() => setShowReviews(!showReviews)}
                    className="w-full flex items-center justify-between px-4 py-3 bg-[#111] hover:bg-[#161616] transition-colors"
                  >
                    <span className="text-white text-sm font-semibold">Reviews & Feedback</span>
                    <span className="text-p-muted text-xs">{showReviews ? '▾' : '▸'}</span>
                  </button>
                  {showReviews && (
                    <div className="px-4 py-3 space-y-4">
                      {reviewsLoading ? (
                        <p className="text-p-muted text-xs">Loading reviews...</p>
                      ) : !reviews || (!reviews.worker_surveys?.length && !reviews.client_feedback?.client_rating) ? (
                        <p className="text-p-muted text-xs">No reviews yet for this event.</p>
                      ) : (
                        <>
                          {/* Average Rating */}
                          {(() => {
                            const allRatings = []
                            if (reviews.worker_surveys?.length) reviews.worker_surveys.forEach(s => { if (s.rating) allRatings.push(s.rating) })
                            if (reviews.client_feedback?.client_rating) allRatings.push(reviews.client_feedback.client_rating)
                            if (!allRatings.length) return null
                            const avg = (allRatings.reduce((a, b) => a + b, 0) / allRatings.length).toFixed(1)
                            return (
                              <div className="flex items-center gap-3 pb-3 border-b border-p-border">
                                <div className="text-3xl font-bold text-white">{avg}</div>
                                <div>
                                  <div className="text-yellow-400 text-lg tracking-wider">
                                    {'★'.repeat(Math.round(parseFloat(avg)))}{'☆'.repeat(5 - Math.round(parseFloat(avg)))}
                                  </div>
                                  <div className="text-p-muted text-[10px]">{allRatings.length} review{allRatings.length !== 1 ? 's' : ''}</div>
                                </div>
                              </div>
                            )
                          })()}

                          {/* Client / Organizer Feedback */}
                          {reviews.client_feedback?.client_rating && (
                            <div className="bg-[#0d0d0d] rounded-lg p-3 space-y-2">
                              <div className="flex items-center justify-between">
                                <span className="text-white text-xs font-semibold">Organizer — {reviews.client_feedback.contact_name || 'Client'}</span>
                                <span className="text-yellow-400 text-xs">{'★'.repeat(reviews.client_feedback.client_rating)}{'☆'.repeat(5 - reviews.client_feedback.client_rating)}</span>
                              </div>
                              {reviews.client_feedback.client_would_rebook !== null && (
                                <span className={`text-[10px] px-2 py-0.5 rounded-full ${reviews.client_feedback.client_would_rebook ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
                                  {reviews.client_feedback.client_would_rebook ? 'Would rebook' : 'Would not rebook'}
                                </span>
                              )}
                              {reviews.client_feedback.client_feedback && (
                                <p className="text-p-muted text-xs leading-relaxed">{reviews.client_feedback.client_feedback}</p>
                              )}
                            </div>
                          )}

                          {/* Worker Surveys */}
                          {reviews.worker_surveys?.length > 0 && (
                            <div className="space-y-2">
                              <p className="text-white text-xs font-semibold">Worker Reviews</p>
                              {reviews.worker_surveys.map(s => (
                                <div key={s.id} className="bg-[#0d0d0d] rounded-lg p-3 space-y-2">
                                  <div className="flex items-center justify-between">
                                    <span className="text-white text-xs font-medium">
                                      {s.applicants?.first_name} {s.applicants?.last_name}
                                    </span>
                                    <span className="text-yellow-400 text-xs">{'★'.repeat(s.rating || 0)}{'☆'.repeat(5 - (s.rating || 0))}</span>
                                  </div>
                                  <div className="flex flex-wrap gap-1.5">
                                    <span className={`text-[10px] px-2 py-0.5 rounded-full ${s.showed_up === true ? 'bg-green-500/20 text-green-400' : s.showed_up === false ? 'bg-red-500/20 text-red-400' : 'bg-yellow-500/20 text-yellow-400'}`}>
                                      {s.showed_up === true ? 'Full shift' : s.showed_up === false ? 'No-show' : 'Partial'}
                                    </span>
                                    {s.would_work_again !== null && (
                                      <span className={`text-[10px] px-2 py-0.5 rounded-full ${s.would_work_again ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
                                        {s.would_work_again ? 'Would rehire' : 'Would not rehire'}
                                      </span>
                                    )}
                                  </div>
                                  {s.feedback && (
                                    <div>
                                      <p className="text-[10px] text-p-muted mb-0.5">What went well</p>
                                      <p className="text-xs text-[#ccc] leading-relaxed">{s.feedback}</p>
                                    </div>
                                  )}
                                  {s.issues && (
                                    <div>
                                      <p className="text-[10px] text-p-muted mb-0.5">What to improve</p>
                                      <p className="text-xs text-[#ccc] leading-relaxed">{s.issues}</p>
                                    </div>
                                  )}
                                </div>
                              ))}
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  )}
                </div>

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
