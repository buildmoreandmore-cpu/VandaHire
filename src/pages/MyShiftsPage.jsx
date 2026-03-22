import { useState, useEffect } from 'react'
import { useNavigate } from '../Router.jsx'
import VandaLogo from '../components/VandaLogo.jsx'
import Footer from '../components/Footer.jsx'
import PushOptIn from '../components/PushOptIn.jsx'
import useGeolocation from '../lib/useGeolocation.js'
import { calculateDistance } from '../lib/geo.js'

const PHONE_KEY = 'vanda_worker_phone'

const INCIDENT_TYPES = [
  { value: 'worker_issue', label: 'Worker Issue' },
  { value: 'no_show', label: 'No Show' },
  { value: 'early_departure', label: 'Early Departure' },
  { value: 'client_request', label: 'Client Request' },
  { value: 'venue_issue', label: 'Venue Issue' },
  { value: 'other', label: 'Other' },
]

function formatPhone(val) {
  const digits = val.replace(/\D/g, '').slice(0, 10)
  if (digits.length < 4) return digits
  if (digits.length < 7) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`
  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`
}

function formatDate(d) {
  if (!d) return ''
  return new Date(d + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
}

function formatTime(t) {
  if (!t) return ''
  const [h, m] = t.split(':')
  const hr = parseInt(h, 10)
  return `${hr % 12 || 12}:${m} ${hr >= 12 ? 'PM' : 'AM'}`
}

function ElapsedTimer({ since }) {
  const [elapsed, setElapsed] = useState('')
  useEffect(() => {
    const update = () => {
      const diff = Date.now() - new Date(since).getTime()
      const hrs = Math.floor(diff / 3600000)
      const mins = Math.floor((diff % 3600000) / 60000)
      const secs = Math.floor((diff % 60000) / 1000)
      setElapsed(`${hrs}h ${String(mins).padStart(2, '0')}m ${String(secs).padStart(2, '0')}s`)
    }
    update()
    const id = setInterval(update, 1000)
    return () => clearInterval(id)
  }, [since])
  return <span className="text-[#ffffff] font-mono text-sm">{elapsed}</span>
}

// ─── Supervisor Crew Roster ──────────────────────────────────────────────────

const RELEASE_REASONS = [
  { value: 'performance_issue', label: 'Performance Issue' },
  { value: 'behavior_conduct', label: 'Behavior/Conduct' },
  { value: 'no_show', label: 'No Show' },
  { value: 'early_departure', label: 'Early Departure' },
  { value: 'client_request', label: 'Client Request' },
  { value: 'other', label: 'Other' },
]

function CrewRoster({ crew, geo, eventRadius, eventId, workersNeeded }) {
  const [releaseTarget, setReleaseTarget] = useState(null)
  const [releaseReason, setReleaseReason] = useState('performance_issue')
  const [releasing, setReleasing] = useState(false)
  const [releaseResult, setReleaseResult] = useState(null)

  const getCrewDistance = (member) => {
    if (!member.check_in_lat || !member.check_in_lng || !geo.latitude) return null
    return Math.round(calculateDistance(geo.latitude, geo.longitude, member.check_in_lat, member.check_in_lng))
  }

  const handleRelease = async (crewMemberId) => {
    setReleasing(true)
    setReleaseResult(null)
    try {
      const res = await fetch('/api/worker?route=release', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone: localStorage.getItem(PHONE_KEY),
          event_id: eventId,
          assignment_id: crewMemberId,
          release_reason: releaseReason,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Release failed')
      setReleaseResult(data)
      setReleaseTarget(null)
    } catch (err) {
      setReleaseResult({ error: err.message })
    }
    setReleasing(false)
  }

  const activeCrew = crew.filter(c => !['cancelled', 'declined'].includes(c.status)).length
  const coveragePct = workersNeeded ? Math.round((activeCrew / workersNeeded) * 100) : null
  const coverageColor = coveragePct >= 80 ? 'text-green-400' : coveragePct >= 50 ? 'text-yellow-400' : 'text-red-400'

  return (
    <div className="mt-4 bg-[#0a0a0a] border border-[#2a2a2a] rounded-lg p-3">
      <div className="flex items-center justify-between mb-3">
        <h4 className="text-white text-xs font-semibold uppercase tracking-wider">Crew Roster ({crew.length})</h4>
        {workersNeeded && (
          <span className={`text-[10px] font-medium ${coverageColor}`}>
            Coverage: {activeCrew}/{workersNeeded} ({coveragePct}%)
          </span>
        )}
      </div>

      {releaseResult && (
        <div className={`mb-3 rounded-lg px-3 py-2 text-xs ${releaseResult.error ? 'bg-red-500/10 border border-red-500/20 text-red-400' : releaseResult.replacement ? 'bg-green-500/10 border border-green-500/20 text-green-400' : 'bg-yellow-500/10 border border-yellow-500/20 text-yellow-400'}`}>
          {releaseResult.error
            ? releaseResult.error
            : releaseResult.replacement
              ? `Worker released. Replacement dispatched: ${releaseResult.replacement.first_name} ${releaseResult.replacement.last_name}`
              : releaseResult.warning || 'Worker released. No replacement available — coverage may be below threshold.'}
          <button onClick={() => setReleaseResult(null)} className="ml-2 text-[#888] hover:text-white">dismiss</button>
        </div>
      )}

      <div className="space-y-2">
        {crew.map(c => {
          const w = c.applicants
          if (!w) return null
          const canRelease = !c.is_supervisor && (c.status === 'confirmed' || c.status === 'checked_in')
          return (
            <div key={c.id}>
              <div className="flex items-center gap-3 bg-[#111] rounded-lg px-3 py-2">
                {w.photo_url ? (
                  <img src={w.photo_url} alt="" className="w-8 h-8 rounded-full object-cover flex-shrink-0" />
                ) : (
                  <div className="w-8 h-8 rounded-full bg-[#2a2a2a] flex items-center justify-center flex-shrink-0">
                    <span className="text-[#888] text-xs">{w.first_name?.[0]}{w.last_name?.[0]}</span>
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-white text-xs font-medium truncate">{w.first_name} {w.last_name}</span>
                    {c.is_supervisor && <span className="text-[#ffffff] text-[9px] font-bold uppercase">Lead</span>}
                  </div>
                  <div className="text-[#666] text-[10px]">{w.phone}</div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${
                    c.status === 'checked_in' ? 'bg-blue-500/20 text-blue-400' :
                    c.status === 'completed' ? 'bg-green-500/20 text-green-400' :
                    c.status === 'cancelled' ? 'bg-red-500/20 text-red-400' :
                    'bg-yellow-500/20 text-yellow-400'
                  }`}>
                    {c.status.replace(/_/g, ' ')}
                  </span>
                  {c.exit_status && (
                    <span className={`px-1 py-0.5 rounded text-[9px] font-medium ${
                      c.exit_status === 'waiting' ? 'bg-orange-500/20 text-orange-400' :
                      c.exit_status === 'break' ? 'bg-blue-500/20 text-blue-400' :
                      c.exit_status === 'done' ? 'bg-green-500/20 text-green-400' :
                      c.exit_status === 'emergency' ? 'bg-red-500/20 text-red-400' :
                      'bg-white/10 text-p-muted'
                    }`}>
                      {c.exit_status === 'waiting' ? 'Left geofence' : c.exit_status}
                    </span>
                  )}
                  {c.check_in_time && (
                    <span className="text-[#888] text-[9px]">
                      {new Date(c.check_in_time).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
                    </span>
                  )}
                  {canRelease && (
                    <button
                      onClick={() => { setReleaseTarget(releaseTarget === c.id ? null : c.id); setReleaseReason('performance_issue') }}
                      className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-red-500/20 text-red-400 hover:bg-red-500/30 transition-colors"
                    >
                      Release
                    </button>
                  )}
                </div>
              </div>
              {/* Inline release form */}
              {releaseTarget === c.id && (
                <div className="bg-[#111] border border-red-500/20 rounded-lg px-3 py-2 mt-1 ml-11 space-y-2">
                  <select
                    value={releaseReason}
                    onChange={(e) => setReleaseReason(e.target.value)}
                    className="w-full bg-[#0a0a0a] border border-[#2a2a2a] rounded px-2 py-1.5 text-xs text-white"
                  >
                    {RELEASE_REASONS.map(r => (
                      <option key={r.value} value={r.value}>{r.label}</option>
                    ))}
                  </select>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleRelease(c.id)}
                      disabled={releasing}
                      className="bg-red-600 text-white rounded px-3 py-1.5 text-xs font-semibold disabled:opacity-40 hover:bg-red-700 transition-colors"
                    >
                      {releasing ? 'Releasing...' : 'Release & Replace'}
                    </button>
                    <button
                      onClick={() => setReleaseTarget(null)}
                      className="text-[#888] text-xs hover:text-white transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>
      <div className="mt-2 flex gap-3 text-[10px] text-[#888]">
        <span>Checked in: <span className="text-blue-400 font-medium">{crew.filter(c => c.status === 'checked_in').length}</span></span>
        <span>Confirmed: <span className="text-yellow-400 font-medium">{crew.filter(c => c.status === 'confirmed').length}</span></span>
        <span>Completed: <span className="text-green-400 font-medium">{crew.filter(c => c.status === 'completed').length}</span></span>
      </div>
    </div>
  )
}

// ─── Supervisor Incident Log ─────────────────────────────────────────────────

function IncidentLog({ eventId, phone }) {
  const [incidents, setIncidents] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [formType, setFormType] = useState('worker_issue')
  const [formDesc, setFormDesc] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const loadIncidents = async () => {
    try {
      const res = await fetch(`/api/incidents?event_id=${eventId}`)
      const data = await res.json()
      if (res.ok) setIncidents(data)
    } catch {}
    setLoading(false)
  }

  useEffect(() => { loadIncidents() }, [eventId])

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!formDesc.trim()) return
    setSubmitting(true)
    try {
      const res = await fetch('/api/incidents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone, event_id: eventId, incident_type: formType, description: formDesc.trim() }),
      })
      if (res.ok) {
        setFormDesc('')
        setShowForm(false)
        loadIncidents()
      }
    } catch {}
    setSubmitting(false)
  }

  const INCIDENT_COLORS = {
    worker_issue: 'text-red-400',
    no_show: 'text-red-400',
    early_departure: 'text-orange-400',
    client_request: 'text-blue-400',
    venue_issue: 'text-yellow-400',
    other: 'text-[#888]',
  }

  return (
    <div className="mt-4 bg-[#0a0a0a] border border-[#2a2a2a] rounded-lg p-3">
      <div className="flex items-center justify-between mb-3">
        <h4 className="text-white text-xs font-semibold uppercase tracking-wider">Incident Log ({incidents.length})</h4>
        <button onClick={() => setShowForm(!showForm)} className="text-[#ffffff] text-[10px] font-medium hover:opacity-80">
          {showForm ? 'Cancel' : '+ Log Incident'}
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="mb-3 space-y-2">
          <select
            value={formType}
            onChange={(e) => setFormType(e.target.value)}
            className="w-full bg-[#111] border border-[#2a2a2a] rounded-lg px-3 py-2 text-xs text-white"
          >
            {INCIDENT_TYPES.map(t => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </select>
          <textarea
            value={formDesc}
            onChange={(e) => setFormDesc(e.target.value)}
            placeholder="Describe the incident..."
            rows={3}
            className="w-full bg-[#111] border border-[#2a2a2a] rounded-lg px-3 py-2 text-xs text-white placeholder-[#555] resize-none focus:outline-none focus:border-[#ffffff]"
          />
          <button
            type="submit"
            disabled={submitting || !formDesc.trim()}
            className="bg-red-600 text-white rounded-lg px-4 py-2 text-xs font-semibold disabled:opacity-40 hover:bg-red-700 transition-colors"
          >
            {submitting ? 'Logging...' : 'Log Incident'}
          </button>
        </form>
      )}

      {loading ? (
        <p className="text-[#888] text-xs">Loading...</p>
      ) : incidents.length === 0 ? (
        <p className="text-[#555] text-xs">No incidents logged.</p>
      ) : (
        <div className="space-y-2">
          {incidents.map(inc => (
            <div key={inc.id} className="bg-[#111] rounded-lg px-3 py-2">
              <div className="flex items-center justify-between mb-1">
                <span className={`text-[10px] font-medium uppercase ${INCIDENT_COLORS[inc.incident_type] || 'text-[#888]'}`}>
                  {inc.incident_type.replace(/_/g, ' ')}
                </span>
                <span className="text-[#555] text-[9px]">
                  {new Date(inc.created_at).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
                </span>
              </div>
              <p className="text-white text-xs leading-relaxed">{inc.description}</p>
              {inc.applicants && (
                <p className="text-[#555] text-[9px] mt-1">— {inc.applicants.first_name} {inc.applicants.last_name}</p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Main Page ───────────────────────────────────────────────────────────────

const SESSION_KEY = 'vanda_worker_session'

export default function MyShiftsPage() {
  const navigate = useNavigate()
  const [phone, setPhone] = useState(localStorage.getItem(PHONE_KEY) || '')
  const [pin, setPin] = useState('')
  const [newPin, setNewPin] = useState('')
  const [confirmPin, setConfirmPin] = useState('')
  const [authStep, setAuthStep] = useState('phone') // phone | pin | setup | reset_request | reset
  const [resetCode, setResetCode] = useState('')
  const [verified, setVerified] = useState(false)
  const [worker, setWorker] = useState(null)
  const [assignments, setAssignments] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [actionLoading, setActionLoading] = useState(null)
  const [gpsEnabled, setGpsEnabled] = useState(false)
  const [checkoutMessage, setCheckoutMessage] = useState(null)
  const geo = useGeolocation(gpsEnabled)

  const fetchShifts = async (phoneDigits) => {
    setLoading(true)
    setError('')
    try {
      const res = await fetch(`/api/checkin?phone=${encodeURIComponent(phoneDigits)}`)
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to load shifts')
      setWorker(data.worker)
      setAssignments(data.assignments || [])
    } catch (err) {
      setError(err.message)
    }
    setLoading(false)
  }

  // Check existing session on load
  useEffect(() => {
    const savedPhone = localStorage.getItem(PHONE_KEY)
    const savedSession = localStorage.getItem(SESSION_KEY)
    if (savedPhone && savedSession) {
      fetch('/api/session-check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: savedPhone, session: savedSession }),
      })
        .then(r => r.json())
        .then(data => {
          if (data.valid) {
            setPhone(savedPhone)
            setVerified(true)
            fetchShifts(savedPhone)
          } else {
            localStorage.removeItem(SESSION_KEY)
          }
        })
        .catch(() => {})
    }
  }, [])

  // GPS ping — send location to server every 30s while checked in
  const isCheckedIn = assignments.some(a => a.status === 'checked_in')
  useEffect(() => {
    if (!isCheckedIn || !gpsEnabled || !geo.latitude) return
    const phone = localStorage.getItem(PHONE_KEY)
    if (!phone) return

    const ping = () => {
      if (geo.latitude && geo.longitude) {
        fetch('/api/worker?route=gps-ping', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ phone, latitude: geo.latitude, longitude: geo.longitude }),
        }).catch(() => {})
      }
    }
    ping() // Send immediately
    const id = setInterval(ping, 30000) // Then every 30s
    return () => clearInterval(id)
  }, [isCheckedIn, gpsEnabled, geo.latitude, geo.longitude])

  const handlePhoneSubmit = async (e) => {
    e.preventDefault()
    const digits = phone.replace(/\D/g, '')
    if (digits.length < 10) { setError('Enter a valid 10-digit phone number.'); return }
    setLoading(true)
    setError('')
    try {
      const res = await fetch(`/api/checkin?phone=${encodeURIComponent(digits)}`)
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Worker not found')
      // Worker exists — check if they have a PIN set
      if (data.worker?.has_pin) {
        setAuthStep('pin')
      } else {
        setAuthStep('setup')
      }
    } catch (err) {
      setError(err.message)
    }
    setLoading(false)
  }

  const handlePinSubmit = async (e) => {
    e.preventDefault()
    const digits = phone.replace(/\D/g, '')
    if (pin.length !== 4) { setError('Enter your 4-digit PIN.'); return }
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/pin-verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: digits, pin }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Invalid PIN')
      localStorage.setItem(PHONE_KEY, digits)
      localStorage.setItem(SESSION_KEY, data.session)
      setVerified(true)
      fetchShifts(digits)
    } catch (err) {
      setError(err.message)
      setPin('')
    }
    setLoading(false)
  }

  const handlePinSetup = async (e) => {
    e.preventDefault()
    if (newPin.length !== 4) { setError('PIN must be 4 digits.'); return }
    if (newPin !== confirmPin) { setError('PINs do not match.'); return }
    const digits = phone.replace(/\D/g, '')
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/pin-setup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: digits, pin: newPin }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to set PIN')
      localStorage.setItem(PHONE_KEY, digits)
      localStorage.setItem(SESSION_KEY, data.session)
      setVerified(true)
      fetchShifts(digits)
    } catch (err) {
      setError(err.message)
    }
    setLoading(false)
  }

  const handlePinReset = async (e) => {
    e.preventDefault()
    if (newPin.length !== 4) { setError('PIN must be 4 digits.'); return }
    if (newPin !== confirmPin) { setError('PINs do not match.'); return }
    const digits = phone.replace(/\D/g, '')
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/pin-reset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: digits, code: resetCode, new_pin: newPin }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Reset failed')
      localStorage.setItem(PHONE_KEY, digits)
      localStorage.setItem(SESSION_KEY, data.session)
      setVerified(true)
      fetchShifts(digits)
    } catch (err) {
      setError(err.message)
    }
    setLoading(false)
  }

  const handleResetRequest = async () => {
    const digits = phone.replace(/\D/g, '')
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/pin-reset-request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: digits }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to send reset code')
      setAuthStep('reset')
      setError('')
    } catch (err) {
      setError(err.message)
    }
    setLoading(false)
  }

  const handleAction = async (assignmentId, eventId, action) => {
    setError('')
    setCheckoutMessage(null)

    // If GPS isn't active yet, enable it and wait for coordinates
    if (!geo.latitude || !geo.longitude) {
      if (!gpsEnabled) {
        setGpsEnabled(true)
        setError('Requesting your location... Tap the button again once GPS is ready.')
        return
      }
      setError('Acquiring your GPS location — please wait a moment and try again.')
      return
    }

    setActionLoading(assignmentId)
    try {
      const res = await fetch('/api/checkin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone: localStorage.getItem(PHONE_KEY),
          event_id: eventId,
          action,
          latitude: geo.latitude,
          longitude: geo.longitude,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        if (data.error === 'outside_geofence') {
          setError(data.message)
        } else {
          throw new Error(data.error || 'Action failed')
        }
      } else {
        if (navigator.vibrate) navigator.vibrate([80, 50, 80])

        if (action === 'check_out') {
          // Stop GPS tracking after check-out
          setGpsEnabled(false)
          const hours = data.hours_tracked || null
          setCheckoutMessage({
            title: 'Checked Out!',
            hours,
          })
        }

        fetchShifts(localStorage.getItem(PHONE_KEY))
      }
    } catch (err) {
      setError(err.message)
    }
    setActionLoading(null)
  }

  const handleInviteResponse = async (assignmentId, response) => {
    setActionLoading(assignmentId)
    setError('')
    try {
      const res = await fetch('/api/respond-invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone: localStorage.getItem(PHONE_KEY),
          assignment_id: assignmentId,
          response,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to respond')
      if (navigator.vibrate) navigator.vibrate([80, 50, 80])
      fetchShifts(localStorage.getItem(PHONE_KEY))
    } catch (err) {
      setError(err.message)
    }
    setActionLoading(null)
  }

  const handleLogout = () => {
    localStorage.removeItem(PHONE_KEY)
    localStorage.removeItem(SESSION_KEY)
    setVerified(false)
    setWorker(null)
    setAssignments([])
    setPhone('')
    setPin('')
    setNewPin('')
    setConfirmPin('')
    setResetCode('')
    setAuthStep('phone')
  }

  const getDistanceToEvent = (event) => {
    if (!geo.latitude || !geo.longitude || event.latitude == null || event.longitude == null) return null
    return Math.round(calculateDistance(geo.latitude, geo.longitude, event.latitude, event.longitude))
  }

  // Auth screens
  if (!verified) {
    const authShell = (children) => (
      <div className="min-h-screen bg-[#0a0a0a] text-white flex flex-col">
        <div className="px-6 pt-8 flex items-center justify-between max-w-2xl mx-auto w-full">
          <VandaLogo onClick={() => navigate('/')} />
          <button onClick={() => navigate('/shifts')} className="text-[#777] text-sm hover:text-white transition-colors">Open Shifts</button>
        </div>
        <div className="flex-1 px-6 py-16 max-w-2xl mx-auto w-full">
          <h1 className="font-inter text-4xl font-extrabold tracking-tighter mb-2">My Shifts</h1>
          {children}
        </div>
        <Footer />
      </div>
    )

    // Step 1: Phone number entry
    if (authStep === 'phone') {
      return authShell(
        <>
          <p className="text-[#888] mb-10">Enter your phone number to view your shifts and check in.</p>
          <form onSubmit={handlePhoneSubmit} className="space-y-4 max-w-sm">
            <div>
              <label className="block text-sm text-[#777] mb-2">Phone Number</label>
              <input
                type="tel"
                value={formatPhone(phone)}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="(404) 555-0100"
                className="w-full bg-[#111] border border-[#2a2a2a] rounded-xl px-4 py-3 text-white placeholder-[#555] focus:outline-none focus:border-[#ffffff] transition-colors"
              />
            </div>
            {error && <p className="text-red-400 text-sm">{error}</p>}
            <button type="submit" disabled={loading} className="bg-[#ffffff] text-black rounded-full py-3 px-8 font-semibold hover:opacity-90 transition-all disabled:opacity-50">
              {loading ? 'Checking...' : 'Continue'}
            </button>
          </form>
        </>
      )
    }

    // Step 2: PIN entry (worker has PIN set)
    if (authStep === 'pin') {
      return authShell(
        <>
          <p className="text-[#888] mb-10">Enter your 4-digit PIN to continue.</p>
          <form onSubmit={handlePinSubmit} className="space-y-4 max-w-sm">
            <div>
              <label className="block text-sm text-[#777] mb-2">PIN</label>
              <input
                type="password"
                inputMode="numeric"
                maxLength={4}
                value={pin}
                onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
                placeholder="••••"
                className="w-full bg-[#111] border border-[#2a2a2a] rounded-xl px-4 py-3 text-white text-center text-2xl tracking-[0.5em] placeholder-[#555] focus:outline-none focus:border-[#ffffff] transition-colors"
                autoFocus
              />
            </div>
            {error && <p className="text-red-400 text-sm">{error}</p>}
            <button type="submit" disabled={loading} className="bg-[#ffffff] text-black rounded-full py-3 px-8 font-semibold hover:opacity-90 transition-all disabled:opacity-50">
              {loading ? 'Verifying...' : 'Unlock'}
            </button>
            <div className="flex items-center justify-between pt-2">
              <button type="button" onClick={() => { setAuthStep('phone'); setError(''); setPin('') }} className="text-[#555] text-sm hover:text-white transition-colors">
                ← Different number
              </button>
              <button type="button" onClick={handleResetRequest} disabled={loading} className="text-p-green text-sm hover:opacity-80 transition-colors">
                Forgot PIN?
              </button>
            </div>
          </form>
        </>
      )
    }

    // Step 3: PIN setup (first-time)
    if (authStep === 'setup') {
      return authShell(
        <>
          <p className="text-[#888] mb-2">Create a 4-digit PIN to secure your account.</p>
          <p className="text-[#555] text-sm mb-10">You'll use this PIN each time you log in.</p>
          <form onSubmit={handlePinSetup} className="space-y-4 max-w-sm">
            <div>
              <label className="block text-sm text-[#777] mb-2">New PIN</label>
              <input
                type="password"
                inputMode="numeric"
                maxLength={4}
                value={newPin}
                onChange={(e) => setNewPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
                placeholder="••••"
                className="w-full bg-[#111] border border-[#2a2a2a] rounded-xl px-4 py-3 text-white text-center text-2xl tracking-[0.5em] placeholder-[#555] focus:outline-none focus:border-[#ffffff] transition-colors"
                autoFocus
              />
            </div>
            <div>
              <label className="block text-sm text-[#777] mb-2">Confirm PIN</label>
              <input
                type="password"
                inputMode="numeric"
                maxLength={4}
                value={confirmPin}
                onChange={(e) => setConfirmPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
                placeholder="••••"
                className="w-full bg-[#111] border border-[#2a2a2a] rounded-xl px-4 py-3 text-white text-center text-2xl tracking-[0.5em] placeholder-[#555] focus:outline-none focus:border-[#ffffff] transition-colors"
              />
            </div>
            {error && <p className="text-red-400 text-sm">{error}</p>}
            <button type="submit" disabled={loading} className="bg-[#ffffff] text-black rounded-full py-3 px-8 font-semibold hover:opacity-90 transition-all disabled:opacity-50">
              {loading ? 'Setting up...' : 'Set PIN & Continue'}
            </button>
            <button type="button" onClick={() => { setAuthStep('phone'); setError(''); setNewPin(''); setConfirmPin('') }} className="text-[#555] text-sm hover:text-white transition-colors">
              ← Different number
            </button>
          </form>
        </>
      )
    }

    // Step 4: PIN reset (enter code + new PIN)
    if (authStep === 'reset_request' || authStep === 'reset') {
      return authShell(
        <>
          <p className="text-[#888] mb-2">A reset code has been sent to your email on file.</p>
          <p className="text-[#555] text-sm mb-10">Enter the code and choose a new PIN.</p>
          <form onSubmit={handlePinReset} className="space-y-4 max-w-sm">
            <div>
              <label className="block text-sm text-[#777] mb-2">Reset Code</label>
              <input
                type="text"
                inputMode="numeric"
                maxLength={6}
                value={resetCode}
                onChange={(e) => setResetCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder="123456"
                className="w-full bg-[#111] border border-[#2a2a2a] rounded-xl px-4 py-3 text-white text-center text-lg tracking-[0.3em] placeholder-[#555] focus:outline-none focus:border-[#ffffff] transition-colors"
                autoFocus
              />
            </div>
            <div>
              <label className="block text-sm text-[#777] mb-2">New PIN</label>
              <input
                type="password"
                inputMode="numeric"
                maxLength={4}
                value={newPin}
                onChange={(e) => setNewPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
                placeholder="••••"
                className="w-full bg-[#111] border border-[#2a2a2a] rounded-xl px-4 py-3 text-white text-center text-2xl tracking-[0.5em] placeholder-[#555] focus:outline-none focus:border-[#ffffff] transition-colors"
              />
            </div>
            <div>
              <label className="block text-sm text-[#777] mb-2">Confirm PIN</label>
              <input
                type="password"
                inputMode="numeric"
                maxLength={4}
                value={confirmPin}
                onChange={(e) => setConfirmPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
                placeholder="••••"
                className="w-full bg-[#111] border border-[#2a2a2a] rounded-xl px-4 py-3 text-white text-center text-2xl tracking-[0.5em] placeholder-[#555] focus:outline-none focus:border-[#ffffff] transition-colors"
              />
            </div>
            {error && <p className="text-red-400 text-sm">{error}</p>}
            <button type="submit" disabled={loading} className="bg-[#ffffff] text-black rounded-full py-3 px-8 font-semibold hover:opacity-90 transition-all disabled:opacity-50">
              {loading ? 'Resetting...' : 'Reset PIN & Continue'}
            </button>
            <button type="button" onClick={() => { setAuthStep('phone'); setError(''); setNewPin(''); setConfirmPin(''); setResetCode('') }} className="text-[#555] text-sm hover:text-white transition-colors">
              ← Start over
            </button>
          </form>
        </>
      )
    }
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white flex flex-col">
      {/* Header */}
      <div className="border-b border-[#1a1a1a] px-5 py-4 flex items-center justify-between">
        <VandaLogo onClick={() => navigate('/')} />
        <div className="flex items-center gap-4">
          <button onClick={() => navigate('/shifts')} className="text-[#777] text-xs hover:text-white transition-colors">Open Shifts</button>
          <button onClick={handleLogout} className="text-[#555] text-xs hover:text-red-400 transition-colors">Log Out</button>
        </div>
      </div>

      <div className="max-w-[600px] mx-auto px-5 py-8 w-full flex-1">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="font-inter text-2xl font-extrabold tracking-tight">My Shifts</h1>
            {worker && <p className="text-[#888] text-sm">Hey, {worker.first_name}</p>}
          </div>
          <button onClick={() => fetchShifts(localStorage.getItem(PHONE_KEY))} className="text-[#ffffff] text-xs hover:opacity-80">Refresh</button>
        </div>

        {/* GPS status — only show when GPS is enabled */}
        {gpsEnabled && (
          <div className="flex items-center gap-2 mb-4 text-xs">
            {geo.loading ? (
              <><span className="w-2 h-2 rounded-full bg-yellow-400 animate-pulse" /><span className="text-yellow-400">Acquiring GPS...</span></>
            ) : geo.error ? (
              <><span className="w-2 h-2 rounded-full bg-red-400" /><span className="text-red-400">Location access denied. Please allow location in your browser settings and try again.</span></>
            ) : (
              <><span className="w-2 h-2 rounded-full bg-[#ffffff]" /><span className="text-[#888]">GPS active ({'\u00B1'}{Math.round(geo.accuracy)}m)</span></>
            )}
          </div>
        )}

        <PushOptIn phone={localStorage.getItem(PHONE_KEY) || ''} />

        {/* Checkout confirmation message */}
        {checkoutMessage && (
          <div className="bg-[#141414] border border-[#2a2a2a] rounded-xl p-5 mb-4 text-center">
            <div className="w-12 h-12 rounded-full bg-white flex items-center justify-center mx-auto mb-3 text-black text-xl font-bold">✓</div>
            <h3 className="text-white font-semibold text-lg mb-1">{checkoutMessage.title}</h3>
            {checkoutMessage.hours && (
              <p className="text-[#888] text-sm">Hours tracked: <span className="text-white font-medium">{checkoutMessage.hours}h</span></p>
            )}
            <p className="text-[#666] text-xs mt-2">GPS tracking has been stopped. Great work today!</p>
            <button onClick={() => setCheckoutMessage(null)} className="text-[#888] text-xs mt-3 hover:text-white transition-colors">Dismiss</button>
          </div>
        )}

        {error && (
          <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-3 mb-4">
            <p className="text-red-400 text-sm">{error}</p>
          </div>
        )}

        {loading ? (
          <div className="text-[#888] text-sm text-center py-12">Loading your shifts...</div>
        ) : assignments.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-[#888] text-sm">No shifts yet.</p>
            <button onClick={() => navigate('/shifts')} className="text-p-green text-sm mt-3 hover:opacity-80">Browse open shifts</button>
          </div>
        ) : (
          <div className="space-y-4">
            {assignments.map(a => {
              const ev = a.events
              const distance = getDistanceToEvent(ev)
              const withinGeofence = distance != null && distance <= (ev.geofence_radius_meters || 200)
              // Allow click if GPS not enabled yet (will trigger permission), block only if GPS is active and outside geofence
              const gpsBlocksCheckIn = gpsEnabled && geo.latitude && ev.latitude != null && !withinGeofence
              const canCheckIn = a.status === 'confirmed' && !gpsBlocksCheckIn
              const isSupervisor = a.is_supervisor

              return (
                <div key={a.id} className={`bg-[#111] border rounded-xl p-4 ${isSupervisor ? 'border-[#ffffff]/30' : 'border-[#2a2a2a]'}`}>
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-white font-semibold text-sm">{ev.title}</h3>
                        {isSupervisor && (
                          <span className="bg-[#ffffff]/10 text-[#ffffff] text-[9px] font-bold uppercase px-1.5 py-0.5 rounded">Supervisor</span>
                        )}
                        {ev.service_tier === 'managed_labor' && (
                          <span className="bg-purple-500/10 text-purple-400 text-[9px] font-bold uppercase px-1.5 py-0.5 rounded">Managed</span>
                        )}
                      </div>
                      <p className="text-[#888] text-xs">{formatDate(ev.event_date)} &middot; {formatTime(ev.start_time)} – {formatTime(ev.end_time)}</p>
                      <p className="text-[#666] text-xs mt-0.5">{ev.location}, {ev.city}</p>
                    </div>
                    <span className={`px-2 py-0.5 rounded text-[10px] font-medium ${
                      a.status === 'invited' ? 'bg-orange-500/20 text-orange-400' :
                      a.status === 'checked_in' ? 'bg-blue-500/20 text-blue-400' :
                      a.status === 'completed' ? 'bg-green-500/20 text-green-400' :
                      'bg-yellow-500/20 text-yellow-400'
                    }`}>
                      {a.status === 'invited' ? 'pending approval' : a.status.replace(/_/g, ' ')}
                    </span>
                  </div>

                  {ev.pay_rate && (
                    <p className="text-[#888] text-xs mb-2">Pay: {ev.pay_rate}</p>
                  )}

                  {/* Geofence status — only show when GPS is active */}
                  {gpsEnabled && ev.latitude != null && ev.longitude != null && (
                    <div className="flex items-center gap-2 mb-3 text-xs">
                      {distance == null ? (
                        <span className="text-[#555]">Calculating distance...</span>
                      ) : withinGeofence ? (
                        <><span className="w-2 h-2 rounded-full bg-[#ffffff]" /><span className="text-[#ffffff]">You're at the venue ({distance}m away)</span></>
                      ) : (
                        <><span className="w-2 h-2 rounded-full bg-[#555]" /><span className="text-[#888]">{distance >= 1000 ? `${(distance / 1000).toFixed(1)}km` : `${distance}m`} from venue</span></>
                      )}
                    </div>
                  )}

                  {/* Elapsed timer */}
                  {a.status === 'checked_in' && a.check_in_time && (
                    <div className="mb-3">
                      <span className="text-[#888] text-xs mr-2">Elapsed:</span>
                      <ElapsedTimer since={a.check_in_time} />
                    </div>
                  )}

                  {/* Hours tracked for completed */}
                  {a.status === 'completed' && a.hours_tracked && (
                    <p className="text-[#888] text-xs mb-2">Hours tracked: <span className="text-white font-medium">{a.hours_tracked}h</span></p>
                  )}

                  {/* Invited — accept or decline */}
                  {a.status === 'invited' && (
                    <div className="space-y-2">
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleInviteResponse(a.id, 'accept')}
                          disabled={actionLoading === a.id}
                          className="flex-1 bg-white text-black rounded-lg py-3 text-sm font-semibold disabled:opacity-40 hover:opacity-90 transition-all"
                        >
                          {actionLoading === a.id ? 'Updating...' : 'Accept Shift'}
                        </button>
                        <button
                          onClick={() => handleInviteResponse(a.id, 'decline')}
                          disabled={actionLoading === a.id}
                          className="flex-1 bg-[#1a1a1a] text-[#888] border border-[#2a2a2a] rounded-lg py-3 text-sm font-semibold disabled:opacity-40 hover:text-white hover:border-[#444] transition-all"
                        >
                          Decline
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Action buttons */}
                  {a.status === 'confirmed' && (
                    <button
                      onClick={() => handleAction(a.id, ev.id, 'check_in')}
                      disabled={!canCheckIn || actionLoading === a.id}
                      className="w-full bg-[#ffffff] text-black rounded-lg py-3 text-sm font-semibold disabled:opacity-40 hover:opacity-90 transition-all"
                    >
                      {actionLoading === a.id ? 'Checking in...' : !gpsEnabled ? 'Check In' : geo.loading ? 'Acquiring GPS...' : gpsBlocksCheckIn ? 'Move closer to check in' : 'Check In'}
                    </button>
                  )}
                  {a.status === 'checked_in' && (
                    <button
                      onClick={() => handleAction(a.id, ev.id, 'check_out')}
                      disabled={actionLoading === a.id}
                      className="w-full bg-[#333] text-white border border-[#444] rounded-lg py-3 text-sm font-semibold disabled:opacity-40 hover:bg-[#444] transition-all"
                    >
                      {actionLoading === a.id ? 'Checking out...' : 'Check Out'}
                    </button>
                  )}

                  {/* Supervisor: Crew Roster */}
                  {isSupervisor && a.crew && a.crew.length > 0 && (
                    <CrewRoster crew={a.crew} geo={geo} eventRadius={ev.geofence_radius_meters || 200} eventId={ev.id} workersNeeded={ev.workers_needed} />
                  )}

                  {/* Supervisor: Incident Log */}
                  {isSupervisor && (
                    <IncidentLog eventId={ev.id} phone={localStorage.getItem(PHONE_KEY)} />
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>

      <Footer />
    </div>
  )
}
