import { useState, useEffect, useMemo } from 'react'
import { fetchApplicants, updateApplicant, editApplicant, deleteApplicant, fetchEvents, createAssignments, bulkUpdateStatus, sendAdminMessage, resetWorkerPin } from '../../lib/adminApi.js'

const STATUS_OPTIONS = ['all', 'pending', 'qualified', 'needs_review', 'not_a_fit', 'approved', 'rejected', 'removed']

const STATUS_COLORS = {
  pending: 'bg-yellow-500/20 text-yellow-400',
  qualified: 'bg-blue-500/20 text-blue-400',
  needs_review: 'bg-orange-500/20 text-orange-400',
  not_a_fit: 'bg-red-500/20 text-red-400',
  approved: 'bg-green-500/20 text-green-400',
  rejected: 'bg-red-500/20 text-red-400',
  removed: 'bg-gray-500/20 text-gray-400',
}

export default function ApplicantsPanel() {
  const [applicants, setApplicants] = useState([])
  const [filter, setFilter] = useState('all')
  const [cityFilter, setCityFilter] = useState('all')
  const [roleFilter, setRoleFilter] = useState('all')
  const [availFilter, setAvailFilter] = useState('all')
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState(null)
  const [updating, setUpdating] = useState(null)
  const [selected, setSelected] = useState(new Set())
  const [events, setEvents] = useState([])
  const [assignEventId, setAssignEventId] = useState('')
  const [assigning, setAssigning] = useState(false)
  const [assignResult, setAssignResult] = useState(null)
  const [search, setSearch] = useState('')
  const [editing, setEditing] = useState(null)
  const [editForm, setEditForm] = useState({})

  // Feature 2: Bulk status change
  const [bulkStatus, setBulkStatus] = useState('')
  const [bulkUpdating, setBulkUpdating] = useState(false)

  // Feature 10: Messaging
  const [messagingWorker, setMessagingWorker] = useState(null)
  const [msgText, setMsgText] = useState('')
  const [msgChannel, setMsgChannel] = useState('both')
  const [sendingMsg, setSendingMsg] = useState(false)

  // Feature 13: PIN reset
  const [resettingPin, setResettingPin] = useState(null)

  const load = async () => {
    setLoading(true)
    try {
      const data = await fetchApplicants(filter === 'all' ? '' : filter)
      setApplicants(data)
    } catch (err) {
      console.error('Failed to load applicants:', err)
    }
    setLoading(false)
  }

  useEffect(() => { load() }, [filter])

  // Load events for the assign dropdown
  useEffect(() => {
    fetchEvents().then(setEvents).catch(() => {})
  }, [])

  // Derive unique cities, roles, availability from data
  const { cities, roles, availabilities } = useMemo(() => {
    const citySet = new Set()
    const roleSet = new Set()
    const availSet = new Set()
    for (const a of applicants) {
      if (a.city) citySet.add(a.city)
      for (const r of (a.roles || [])) roleSet.add(r)
      for (const av of (a.availability || [])) availSet.add(av)
    }
    return {
      cities: [...citySet].sort(),
      roles: [...roleSet].sort(),
      availabilities: [...availSet].sort(),
    }
  }, [applicants])

  // Apply client-side filters + search
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return applicants.filter(a => {
      if (cityFilter !== 'all' && a.city !== cityFilter) return false
      if (roleFilter !== 'all' && !(a.roles || []).includes(roleFilter)) return false
      if (availFilter !== 'all' && !(a.availability || []).includes(availFilter)) return false
      if (q) {
        const name = `${a.first_name || ''} ${a.last_name || ''}`.toLowerCase()
        const phone = (a.phone || '').replace(/\D/g, '')
        const searchDigits = q.replace(/\D/g, '')
        if (!name.includes(q) && !(searchDigits && phone.includes(searchDigits))) return false
      }
      return true
    })
  }, [applicants, cityFilter, roleFilter, availFilter, search])

  // Group by city
  const grouped = useMemo(() => {
    const groups = {}
    for (const a of filtered) {
      const key = a.city || 'Unknown'
      if (!groups[key]) groups[key] = []
      groups[key].push(a)
    }
    // Sort cities alphabetically
    return Object.entries(groups).sort((a, b) => a[0].localeCompare(b[0]))
  }, [filtered])

  const handleStatusChange = async (id, newStatus) => {
    setUpdating(id)
    try {
      await updateApplicant(id, newStatus)
      setApplicants(prev => prev.map(a => a.id === id ? { ...a, status: newStatus } : a))
    } catch (err) {
      console.error('Failed to update:', err)
    }
    setUpdating(null)
  }

  const toggleSelect = (id) => {
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const toggleSelectAll = () => {
    const allIds = filtered.map(a => a.id)
    if (allIds.every(id => selected.has(id))) {
      setSelected(prev => {
        const next = new Set(prev)
        allIds.forEach(id => next.delete(id))
        return next
      })
    } else {
      setSelected(prev => {
        const next = new Set(prev)
        allIds.forEach(id => next.add(id))
        return next
      })
    }
  }

  const toggleSelectCity = (cityApplicants) => {
    const ids = cityApplicants.map(a => a.id)
    if (ids.every(id => selected.has(id))) {
      setSelected(prev => {
        const next = new Set(prev)
        ids.forEach(id => next.delete(id))
        return next
      })
    } else {
      setSelected(prev => {
        const next = new Set(prev)
        ids.forEach(id => next.add(id))
        return next
      })
    }
  }

  const handleBulkAssign = async () => {
    if (!assignEventId || selected.size === 0) return
    setAssigning(true)
    setAssignResult(null)
    try {
      const result = await createAssignments(assignEventId, [...selected])
      setAssignResult({ success: true, count: result.created })
      setSelected(new Set())
    } catch (err) {
      setAssignResult({ success: false, error: err.message })
    }
    setAssigning(false)
  }

  // Feature 6: Quick stats
  const workerStats = useMemo(() => {
    const total = applicants.length
    const byStatus = {}
    let withRating = 0, totalRating = 0
    for (const a of applicants) {
      byStatus[a.status] = (byStatus[a.status] || 0) + 1
      if (a.avg_rating != null) { withRating++; totalRating += parseFloat(a.avg_rating) }
    }
    const avgRating = withRating > 0 ? (totalRating / withRating).toFixed(1) : null
    return { total, byStatus, avgRating }
  }, [applicants])

  // Feature 2: Bulk status change
  const handleBulkStatusChange = async () => {
    if (!bulkStatus || selected.size === 0) return
    setBulkUpdating(true)
    try {
      await bulkUpdateStatus([...selected], bulkStatus)
      setApplicants(prev => prev.map(a => selected.has(a.id) ? { ...a, status: bulkStatus } : a))
      setSelected(new Set())
      setBulkStatus('')
    } catch (err) {
      console.error('Bulk status failed:', err)
    }
    setBulkUpdating(false)
  }

  // Feature 10: Send message
  const handleSendMessage = async () => {
    if (!messagingWorker || !msgText.trim()) return
    setSendingMsg(true)
    try {
      await sendAdminMessage(messagingWorker.id, msgText, msgChannel)
      alert(`Message sent to ${messagingWorker.first_name}!`)
      setMessagingWorker(null)
      setMsgText('')
    } catch (err) {
      alert('Send failed: ' + err.message)
    }
    setSendingMsg(false)
  }

  // Feature 13: PIN reset
  const handleResetPin = async (worker) => {
    if (!confirm(`Reset PIN for ${worker.first_name} ${worker.last_name}? They will need to set a new PIN on next login.`)) return
    setResettingPin(worker.id)
    try {
      await resetWorkerPin(worker.id)
      alert(`PIN reset for ${worker.first_name}. They'll set a new one on next login.`)
    } catch (err) {
      alert('Reset failed: ' + err.message)
    }
    setResettingPin(null)
  }

  const activeEvents = events.filter(e => ['pending', 'staffing', 'confirmed'].includes(e.status))

  return (
    <div>
      {/* Quick Stats (Feature 6) */}
      {!loading && applicants.length > 0 && (
        <div className="flex gap-4 mb-3 overflow-x-auto pb-1">
          <MiniStat label="Total" value={workerStats.total} />
          {workerStats.byStatus.approved > 0 && <MiniStat label="Approved" value={workerStats.byStatus.approved} color="text-green-400" />}
          {workerStats.byStatus.pending > 0 && <MiniStat label="Pending" value={workerStats.byStatus.pending} color="text-yellow-400" />}
          {workerStats.byStatus.needs_review > 0 && <MiniStat label="Review" value={workerStats.byStatus.needs_review} color="text-orange-400" />}
          {workerStats.avgRating && <MiniStat label="Avg Rating" value={`★ ${workerStats.avgRating}`} color="text-yellow-400" />}
        </div>
      )}

      {/* Status Filters */}
      <div className="flex gap-2 mb-3 overflow-x-auto pb-2">
        {STATUS_OPTIONS.map(s => (
          <button
            key={s}
            onClick={() => setFilter(s)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-all ${
              filter === s
                ? 'bg-p-green text-black'
                : 'bg-p-surface text-p-muted border border-p-border hover:border-p-muted'
            }`}
          >
            {s === 'all' ? 'All' : s.replace(/_/g, ' ')}
          </button>
        ))}
      </div>

      {/* Search */}
      <div className="mb-3">
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search by name or phone..."
          className="w-full bg-p-surface border border-p-border rounded-lg px-4 py-2 text-sm text-white placeholder:text-p-muted focus:outline-none focus:border-p-link"
        />
      </div>

      {/* Secondary Filters */}
      <div className="flex gap-2 mb-4 flex-wrap">
        <select value={cityFilter} onChange={e => setCityFilter(e.target.value)} className="bg-p-surface border border-p-border rounded-lg px-3 py-1.5 text-xs text-white">
          <option value="all">All Cities</option>
          {cities.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        <select value={roleFilter} onChange={e => setRoleFilter(e.target.value)} className="bg-p-surface border border-p-border rounded-lg px-3 py-1.5 text-xs text-white">
          <option value="all">All Roles</option>
          {roles.map(r => <option key={r} value={r}>{r}</option>)}
        </select>
        <select value={availFilter} onChange={e => setAvailFilter(e.target.value)} className="bg-p-surface border border-p-border rounded-lg px-3 py-1.5 text-xs text-white">
          <option value="all">All Availability</option>
          {availabilities.map(av => <option key={av} value={av}>{av}</option>)}
        </select>
      </div>

      {/* Bulk Assign Bar */}
      {selected.size > 0 && (
        <div className="bg-p-surface border border-p-border rounded-lg px-4 py-3 mb-4 flex items-center gap-3 flex-wrap">
          <span className="text-white text-sm font-medium">{selected.size} selected</span>
          <select value={assignEventId} onChange={e => setAssignEventId(e.target.value)} className="bg-black border border-p-border rounded-lg px-3 py-1.5 text-xs text-white flex-1 min-w-[200px]">
            <option value="">Select an event to assign...</option>
            {activeEvents.map(e => (
              <option key={e.id} value={e.id}>{e.title} — {e.city} ({e.event_date})</option>
            ))}
          </select>
          <button
            onClick={handleBulkAssign}
            disabled={!assignEventId || assigning}
            className="px-4 py-1.5 rounded-lg text-xs font-medium text-black bg-p-green hover:opacity-90 transition-all disabled:opacity-40"
          >
            {assigning ? 'Assigning...' : 'Assign to Event'}
          </button>
          <div className="border-l border-p-border pl-3 flex items-center gap-2">
            <select value={bulkStatus} onChange={e => setBulkStatus(e.target.value)} className="bg-black border border-p-border rounded-lg px-3 py-1.5 text-xs text-white">
              <option value="">Bulk status change...</option>
              {['approved', 'pending', 'needs_review', 'not_a_fit', 'rejected', 'removed'].map(s => (
                <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>
              ))}
            </select>
            <button
              onClick={handleBulkStatusChange}
              disabled={!bulkStatus || bulkUpdating}
              className="px-3 py-1.5 rounded-lg text-xs font-medium text-black bg-p-green hover:opacity-90 transition-all disabled:opacity-40"
            >{bulkUpdating ? 'Updating...' : 'Apply'}</button>
          </div>
          <button onClick={() => setSelected(new Set())} className="text-p-muted text-xs hover:text-white">Clear</button>
        </div>
      )}

      {/* Assign Result */}
      {assignResult && (
        <div className={`mb-4 rounded-lg px-3 py-2 text-xs ${assignResult.success ? 'bg-green-500/10 border border-green-500/20 text-green-400' : 'bg-red-500/10 border border-red-500/20 text-red-400'}`}>
          {assignResult.success ? `Assigned ${assignResult.count} worker(s) to event` : assignResult.error}
        </div>
      )}

      {/* Select All */}
      {!loading && filtered.length > 0 && (
        <div className="flex items-center gap-2 mb-3">
          <input
            type="checkbox"
            checked={filtered.every(a => selected.has(a.id))}
            onChange={toggleSelectAll}
            className="accent-white"
          />
          <span className="text-p-muted text-xs">Select all ({filtered.length})</span>
        </div>
      )}

      {loading ? (
        <div className="text-p-muted text-sm py-8 text-center">Loading...</div>
      ) : filtered.length === 0 ? (
        <div className="text-p-muted text-sm py-8 text-center">No applicants found</div>
      ) : (
        <div className="space-y-6">
          {grouped.map(([city, workers]) => (
            <div key={city}>
              {/* City Header */}
              <div className="flex items-center gap-3 mb-2">
                <input
                  type="checkbox"
                  checked={workers.every(a => selected.has(a.id))}
                  onChange={() => toggleSelectCity(workers)}
                  className="accent-white"
                />
                <h3 className="text-white text-sm font-semibold">{city}</h3>
                <span className="text-p-muted text-xs">{workers.length} worker{workers.length !== 1 ? 's' : ''}</span>
              </div>

              <div className="space-y-2 ml-6">
                {workers.map(a => (
                  <div key={a.id} className="bg-p-surface border border-p-border rounded-lg overflow-hidden">
                    {/* Row */}
                    <div className="flex items-center gap-3 px-4 py-3">
                      <input
                        type="checkbox"
                        checked={selected.has(a.id)}
                        onChange={() => toggleSelect(a.id)}
                        onClick={e => e.stopPropagation()}
                        className="accent-white flex-shrink-0"
                      />
                      <button
                        onClick={() => setExpanded(expanded === a.id ? null : a.id)}
                        className="flex-1 flex items-center gap-3 text-left hover:bg-white/[0.02] transition-colors min-w-0"
                      >
                        {a.photo_url ? (
                          <img src={a.photo_url} alt="" className="w-10 h-10 rounded-full object-cover flex-shrink-0" />
                        ) : (
                          <div className="w-10 h-10 rounded-full bg-p-border flex items-center justify-center flex-shrink-0">
                            <span className="text-p-muted text-xs">{a.first_name?.[0]}{a.last_name?.[0]}</span>
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <div className="text-white text-sm font-medium truncate">{a.first_name} {a.last_name}</div>
                          <div className="text-p-muted text-xs truncate">
                            {(a.roles || []).join(', ') || 'No roles'} · {(a.availability || []).join(', ') || ''}
                          </div>
                        </div>
                        {a.avg_rating != null && (
                          <span className="text-yellow-400 text-[10px] flex-shrink-0 hidden sm:inline">★ {a.avg_rating}</span>
                        )}
                        <span className={`px-2 py-0.5 rounded text-xs font-medium ${STATUS_COLORS[a.status] || 'bg-p-border text-p-muted'}`}>
                          {a.status?.replace(/_/g, ' ')}
                        </span>
                        <span className="text-p-muted text-xs hidden sm:inline">{new Date(a.created_at).toLocaleDateString()}</span>
                      </button>
                    </div>

                    {/* Expanded Detail */}
                    {expanded === a.id && (
                      <div className="px-4 pb-4 border-t border-p-border pt-3">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          {a.photo_url && (
                            <div>
                              <img src={a.photo_url} alt="Selfie" className="w-32 h-32 rounded-lg object-cover" />
                            </div>
                          )}
                          <div className="space-y-2 text-sm">
                            <Detail label="Phone" value={a.phone} />
                            <Detail label="Email" value={a.email} />
                            <Detail label="Zip" value={a.zip} />
                            <Detail label="Roles" value={a.roles?.join(', ')} />
                            <Detail label="Availability" value={a.availability?.join(', ')} />
                            <Detail label="Experience" value={a.experience_types?.join(', ')} />
                            <Detail label="Shift Windows" value={a.availability_windows?.join(', ')} />
                            <Detail label="Transportation" value={a.has_transportation} />
                            <Detail label="Short Notice" value={a.short_notice} />
                            {a.notes && <Detail label="Notes" value={a.notes} />}
                          </div>
                        </div>

                        {/* Verification Video */}
                        {a.video_url ? (
                          <div className="mt-3">
                            <div className="flex items-center gap-2 mb-2">
                              <span className="text-p-muted text-xs">Verification Video</span>
                              {a.video_verified ? (
                                <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-green-500/20 text-green-400">Verified</span>
                              ) : (
                                <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-yellow-500/20 text-yellow-400">Pending Review</span>
                              )}
                              {a.video_submitted_at && (
                                <span className="text-p-muted text-[10px]">{new Date(a.video_submitted_at).toLocaleDateString()}</span>
                              )}
                            </div>
                            <video
                              src={a.video_url}
                              controls
                              playsInline
                              className="w-full max-w-sm rounded-lg bg-black"
                              style={{ maxHeight: 300 }}
                            />
                            {!a.video_verified && (
                              <button
                                onClick={async () => {
                                  setUpdating(a.id)
                                  try {
                                    await updateApplicant(a.id, a.status, true)
                                    setApplicants(prev => prev.map(x => x.id === a.id ? { ...x, video_verified: true } : x))
                                  } catch (err) { console.error('Verify failed:', err) }
                                  setUpdating(null)
                                }}
                                disabled={updating === a.id}
                                className="mt-2 px-3 py-1.5 rounded-lg text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 transition-colors disabled:opacity-50"
                              >
                                {updating === a.id ? '...' : 'Mark as Verified'}
                              </button>
                            )}
                          </div>
                        ) : a.status === 'approved' ? (
                          <div className="mt-3 bg-black/30 rounded-lg px-3 py-2">
                            <span className="text-p-muted text-xs">No verification video submitted yet</span>
                          </div>
                        ) : null}

                        {/* Score */}
                        {a.score_breakdown?.reasoning && (
                          <div className="mt-3 bg-black/30 rounded-lg px-3 py-2">
                            <span className="text-p-muted text-xs">Score: </span>
                            <span className="text-white text-xs">{a.score_breakdown.decision} ({a.score_breakdown.score}/10)</span>
                            <p className="text-p-muted text-xs mt-1">{a.score_breakdown.reasoning}</p>
                          </div>
                        )}

                        {/* Worker Rating */}
                        <div className="mt-3 bg-black/30 rounded-lg px-3 py-2">
                          {a.avg_rating != null ? (
                            <div className="flex items-center gap-3 flex-wrap">
                              <div>
                                <span className="text-p-muted text-xs">Rating: </span>
                                <span className="text-white text-xs font-medium">{a.avg_rating}/5</span>
                                <span className="text-p-muted text-xs"> ({a.total_shifts} shift{a.total_shifts !== 1 ? 's' : ''})</span>
                                <span className="ml-1 text-yellow-400 text-xs">
                                  {Array.from({ length: 5 }).map((_, i) => (
                                    i < Math.round(a.avg_rating) ? '★' : '☆'
                                  )).join('')}
                                </span>
                              </div>
                              {a.would_hire_again_pct != null && (
                                <div>
                                  <span className="text-p-muted text-xs">Would hire again: </span>
                                  <span className={`text-xs font-medium ${a.would_hire_again_pct >= 75 ? 'text-green-400' : a.would_hire_again_pct >= 50 ? 'text-yellow-400' : 'text-red-400'}`}>
                                    {a.would_hire_again_pct}%
                                  </span>
                                </div>
                              )}
                            </div>
                          ) : (
                            <span className="text-p-muted text-xs">No ratings yet</span>
                          )}
                        </div>

                        {/* Actions */}
                        <div className="flex gap-2 mt-4 flex-wrap">
                          {a.status === 'removed' ? (
                            <ActionBtn
                              label="Restore to Pool"
                              cls="bg-blue-600 hover:bg-blue-700"
                              loading={updating === a.id}
                              onClick={() => {
                                if (confirm(`Restore ${a.first_name} ${a.last_name} back to the worker pool?`)) {
                                  handleStatusChange(a.id, 'approved')
                                }
                              }}
                            />
                          ) : (
                            <>
                              {a.status !== 'approved' && a.status !== 'rejected' && (
                                <ActionBtn
                                  label="Approve"
                                  cls="bg-green-600 hover:bg-green-700"
                                  loading={updating === a.id}
                                  onClick={() => handleStatusChange(a.id, 'approved')}
                                />
                              )}
                              {a.status !== 'approved' && a.status !== 'rejected' && (
                                <ActionBtn
                                  label="Reject"
                                  cls="bg-red-600 hover:bg-red-700"
                                  loading={updating === a.id}
                                  onClick={() => handleStatusChange(a.id, 'rejected')}
                                />
                              )}
                              {a.status === 'approved' && (
                                <ActionBtn
                                  label="Revoke Approval"
                                  cls="bg-p-border hover:bg-[#333]"
                                  loading={updating === a.id}
                                  onClick={() => handleStatusChange(a.id, 'pending')}
                                />
                              )}
                              {a.status === 'rejected' && (
                                <ActionBtn
                                  label="Undo Rejection"
                                  cls="bg-p-border hover:bg-[#333]"
                                  loading={updating === a.id}
                                  onClick={() => handleStatusChange(a.id, 'pending')}
                                />
                              )}
                              {a.status !== 'rejected' && (
                                <ActionBtn
                                  label="Remove from Pool"
                                  cls="bg-red-900/50 hover:bg-red-900 border border-red-800/50"
                                  loading={updating === a.id}
                                  onClick={() => {
                                    if (confirm(`Remove ${a.first_name} ${a.last_name} from the worker pool? You can restore them later from the "removed" filter.`)) {
                                      handleStatusChange(a.id, 'removed')
                                    }
                                  }}
                                />
                              )}
                              {a.status !== 'needs_review' && a.status !== 'approved' && a.status !== 'rejected' && (
                                <ActionBtn
                                  label="Flag for Review"
                                  cls="bg-orange-600 hover:bg-orange-700"
                                  loading={updating === a.id}
                                  onClick={() => handleStatusChange(a.id, 'needs_review')}
                                />
                              )}
                            </>
                          )}
                          <ActionBtn
                            label="Edit"
                            cls="bg-p-border hover:bg-[#333]"
                            loading={false}
                            onClick={() => {
                              setEditing(a.id)
                              setEditForm({ first_name: a.first_name || '', last_name: a.last_name || '', email: a.email || '', phone: a.phone || '', city: a.city || '', zip: a.zip || '' })
                            }}
                          />
                          <ActionBtn
                            label="Message"
                            cls="bg-indigo-600 hover:bg-indigo-700"
                            loading={false}
                            onClick={() => { setMessagingWorker(a); setMsgText(''); setMsgChannel('both') }}
                          />
                          <ActionBtn
                            label="Reset PIN"
                            cls="bg-p-border hover:bg-[#333]"
                            loading={resettingPin === a.id}
                            onClick={() => handleResetPin(a)}
                          />
                          <ActionBtn
                            label="Delete"
                            cls="bg-red-900/50 hover:bg-red-900 border border-red-800/50"
                            loading={updating === a.id}
                            onClick={async () => {
                              if (confirm(`PERMANENTLY delete ${a.first_name} ${a.last_name}? This cannot be undone.`)) {
                                setUpdating(a.id)
                                try {
                                  await deleteApplicant(a.id)
                                  setApplicants(prev => prev.filter(x => x.id !== a.id))
                                } catch (err) { console.error('Delete failed:', err) }
                                setUpdating(null)
                              }
                            }}
                          />
                        </div>

                        {/* Edit Form */}
                        {editing === a.id && (
                          <div className="mt-3 bg-black/30 rounded-lg p-3">
                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mb-3">
                              {['first_name', 'last_name', 'email', 'phone', 'city', 'zip'].map(field => (
                                <div key={field}>
                                  <label className="text-p-muted text-[10px]">{field.replace(/_/g, ' ')}</label>
                                  <input
                                    type="text"
                                    value={editForm[field] || ''}
                                    onChange={e => setEditForm(f => ({ ...f, [field]: e.target.value }))}
                                    className="w-full bg-p-bg border border-p-border rounded px-2 py-1 text-xs text-white mt-0.5"
                                  />
                                </div>
                              ))}
                            </div>
                            <div className="flex gap-2">
                              <button
                                onClick={async () => {
                                  setUpdating(a.id)
                                  try {
                                    await editApplicant(a.id, editForm)
                                    setApplicants(prev => prev.map(x => x.id === a.id ? { ...x, ...editForm } : x))
                                    setEditing(null)
                                  } catch (err) { console.error('Edit failed:', err) }
                                  setUpdating(null)
                                }}
                                disabled={updating === a.id}
                                className="px-3 py-1.5 rounded-lg text-xs font-medium text-black bg-p-green hover:opacity-90 disabled:opacity-50"
                              >
                                {updating === a.id ? 'Saving...' : 'Save'}
                              </button>
                              <button onClick={() => setEditing(null)} className="text-p-muted text-xs hover:text-white">Cancel</button>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Messaging Modal (Feature 10) */}
      {messagingWorker && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 px-4" onClick={() => setMessagingWorker(null)}>
          <div className="bg-p-surface border border-p-border rounded-xl w-full max-w-md" onClick={e => e.stopPropagation()}>
            <div className="px-4 py-3 border-b border-p-border flex items-center justify-between">
              <h3 className="text-white font-semibold text-sm">Message {messagingWorker.first_name} {messagingWorker.last_name}</h3>
              <button onClick={() => setMessagingWorker(null)} className="text-p-muted hover:text-white text-lg">×</button>
            </div>
            <div className="p-4 space-y-3">
              <div className="text-p-muted text-[10px]">
                {messagingWorker.phone && <span>Phone: {messagingWorker.phone}</span>}
                {messagingWorker.phone && messagingWorker.email && <span> · </span>}
                {messagingWorker.email && <span>Email: {messagingWorker.email}</span>}
              </div>
              <select value={msgChannel} onChange={e => setMsgChannel(e.target.value)} className="w-full bg-p-bg border border-p-border rounded-lg px-3 py-1.5 text-xs text-white">
                <option value="both">SMS + Email</option>
                <option value="sms">SMS Only</option>
                <option value="email">Email Only</option>
              </select>
              <textarea
                value={msgText}
                onChange={e => setMsgText(e.target.value)}
                placeholder="Type your message..."
                rows={4}
                className="w-full bg-p-bg border border-p-border rounded-lg px-3 py-2 text-sm text-white placeholder:text-p-muted focus:outline-none focus:border-p-link resize-none"
              />
              <button
                onClick={handleSendMessage}
                disabled={!msgText.trim() || sendingMsg}
                className="w-full bg-p-green text-black rounded-lg py-2.5 text-sm font-semibold disabled:opacity-50 hover:opacity-90 transition-all"
              >{sendingMsg ? 'Sending...' : 'Send Message'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function MiniStat({ label, value, color = 'text-white' }) {
  return (
    <div className="flex-shrink-0">
      <span className={`text-sm font-bold ${color}`}>{value}</span>
      <span className="text-p-muted text-[10px] ml-1">{label}</span>
    </div>
  )
}

function Detail({ label, value }) {
  if (!value) return null
  return (
    <div>
      <span className="text-p-muted">{label}: </span>
      <span className="text-white">{value}</span>
    </div>
  )
}

function ActionBtn({ label, cls, loading, onClick }) {
  return (
    <button
      onClick={onClick}
      disabled={loading}
      className={`px-3 py-1.5 rounded-lg text-xs font-medium text-white transition-colors disabled:opacity-50 ${cls}`}
    >
      {loading ? '...' : label}
    </button>
  )
}
