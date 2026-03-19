import { useState, useEffect } from 'react'
import { useNavigate } from '../Router.jsx'
import VandaLogo from '../components/VandaLogo.jsx'
import Footer from '../components/Footer.jsx'
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
  return <span className="text-[#3ecf8e] font-mono text-sm">{elapsed}</span>
}

// ─── Supervisor Crew Roster ──────────────────────────────────────────────────

function CrewRoster({ crew, geo, eventRadius }) {
  const getCrewDistance = (member) => {
    if (!member.check_in_lat || !member.check_in_lng || !geo.latitude) return null
    return Math.round(calculateDistance(geo.latitude, geo.longitude, member.check_in_lat, member.check_in_lng))
  }

  return (
    <div className="mt-4 bg-[#0a0a0a] border border-[#2a2a2a] rounded-lg p-3">
      <h4 className="text-white text-xs font-semibold uppercase tracking-wider mb-3">Crew Roster ({crew.length})</h4>
      <div className="space-y-2">
        {crew.map(c => {
          const w = c.applicants
          if (!w) return null
          return (
            <div key={c.id} className="flex items-center gap-3 bg-[#111] rounded-lg px-3 py-2">
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
                  {c.is_supervisor && <span className="text-[#3ecf8e] text-[9px] font-bold uppercase">Lead</span>}
                </div>
                <div className="text-[#666] text-[10px]">{w.phone}</div>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${
                  c.status === 'checked_in' ? 'bg-blue-500/20 text-blue-400' :
                  c.status === 'completed' ? 'bg-green-500/20 text-green-400' :
                  'bg-yellow-500/20 text-yellow-400'
                }`}>
                  {c.status.replace(/_/g, ' ')}
                </span>
                {c.check_in_time && (
                  <span className="text-[#888] text-[9px]">
                    {new Date(c.check_in_time).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
                  </span>
                )}
              </div>
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
        <button onClick={() => setShowForm(!showForm)} className="text-[#3ecf8e] text-[10px] font-medium hover:opacity-80">
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
            className="w-full bg-[#111] border border-[#2a2a2a] rounded-lg px-3 py-2 text-xs text-white placeholder-[#555] resize-none focus:outline-none focus:border-[#3ecf8e]"
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

export default function MyShiftsPage() {
  const navigate = useNavigate()
  const [phone, setPhone] = useState(localStorage.getItem(PHONE_KEY) || '')
  const [verified, setVerified] = useState(!!localStorage.getItem(PHONE_KEY))
  const [worker, setWorker] = useState(null)
  const [assignments, setAssignments] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [actionLoading, setActionLoading] = useState(null)
  const geo = useGeolocation()

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

  useEffect(() => {
    const saved = localStorage.getItem(PHONE_KEY)
    if (saved) fetchShifts(saved)
  }, [])

  const handleVerify = (e) => {
    e.preventDefault()
    const digits = phone.replace(/\D/g, '')
    if (digits.length < 10) { setError('Enter a valid 10-digit phone number.'); return }
    localStorage.setItem(PHONE_KEY, digits)
    setVerified(true)
    fetchShifts(digits)
  }

  const handleAction = async (assignmentId, eventId, action) => {
    if (!geo.latitude || !geo.longitude) {
      setError('Waiting for GPS location...')
      return
    }
    setActionLoading(assignmentId)
    setError('')
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
        fetchShifts(localStorage.getItem(PHONE_KEY))
        if (navigator.vibrate) navigator.vibrate([80, 50, 80])
      }
    } catch (err) {
      setError(err.message)
    }
    setActionLoading(null)
  }

  const handleLogout = () => {
    localStorage.removeItem(PHONE_KEY)
    setVerified(false)
    setWorker(null)
    setAssignments([])
    setPhone('')
  }

  const getDistanceToEvent = (event) => {
    if (!geo.latitude || !geo.longitude || event.latitude == null || event.longitude == null) return null
    return Math.round(calculateDistance(geo.latitude, geo.longitude, event.latitude, event.longitude))
  }

  // Phone entry screen
  if (!verified) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] text-white flex flex-col">
        <div className="px-6 pt-8 flex items-center justify-between max-w-2xl mx-auto w-full">
          <VandaLogo onClick={() => navigate('/')} />
          <button onClick={() => navigate('/shifts')} className="text-[#777] text-sm hover:text-white transition-colors">Open Shifts</button>
        </div>
        <div className="flex-1 px-6 py-16 max-w-2xl mx-auto w-full">
          <h1 className="text-4xl font-extrabold tracking-tighter mb-2">My Shifts</h1>
          <p className="text-[#888] mb-10">Enter your phone number to view your shifts and check in.</p>
          <form onSubmit={handleVerify} className="space-y-4 max-w-sm">
            <div>
              <label className="block text-sm text-[#777] mb-2">Phone Number</label>
              <input
                type="tel"
                value={formatPhone(phone)}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="(404) 555-0100"
                className="w-full bg-[#111] border border-[#2a2a2a] rounded-xl px-4 py-3 text-white placeholder-[#555] focus:outline-none focus:border-[#3ecf8e] transition-colors"
              />
            </div>
            {error && <p className="text-red-400 text-sm">{error}</p>}
            <button type="submit" className="bg-[#3ecf8e] text-black rounded-full py-3 px-8 font-semibold hover:opacity-90 transition-all">
              View My Shifts
            </button>
          </form>
        </div>
        <Footer />
      </div>
    )
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
            <h1 className="text-2xl font-extrabold tracking-tight">My Shifts</h1>
            {worker && <p className="text-[#888] text-sm">Hey, {worker.first_name}</p>}
          </div>
          <button onClick={() => fetchShifts(localStorage.getItem(PHONE_KEY))} className="text-[#3ecf8e] text-xs hover:opacity-80">Refresh</button>
        </div>

        {/* GPS status */}
        <div className="flex items-center gap-2 mb-4 text-xs">
          {geo.loading ? (
            <><span className="w-2 h-2 rounded-full bg-yellow-400 animate-pulse" /><span className="text-yellow-400">Acquiring GPS...</span></>
          ) : geo.error ? (
            <><span className="w-2 h-2 rounded-full bg-red-400" /><span className="text-red-400">GPS: {geo.error}</span></>
          ) : (
            <><span className="w-2 h-2 rounded-full bg-[#3ecf8e]" /><span className="text-[#888]">GPS active ({'\u00B1'}{Math.round(geo.accuracy)}m)</span></>
          )}
        </div>

        {error && (
          <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-3 mb-4">
            <p className="text-red-400 text-sm">{error}</p>
          </div>
        )}

        {loading ? (
          <div className="text-[#888] text-sm text-center py-12">Loading your shifts...</div>
        ) : assignments.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-[#888] text-sm">No confirmed shifts yet.</p>
            <button onClick={() => navigate('/shifts')} className="text-[#3ecf8e] text-sm mt-3 hover:opacity-80">Browse open shifts</button>
          </div>
        ) : (
          <div className="space-y-4">
            {assignments.map(a => {
              const ev = a.events
              const distance = getDistanceToEvent(ev)
              const withinGeofence = distance != null && distance <= (ev.geofence_radius_meters || 200)
              const canCheckIn = a.status === 'confirmed' && withinGeofence
              const isSupervisor = a.is_supervisor

              return (
                <div key={a.id} className={`bg-[#111] border rounded-xl p-4 ${isSupervisor ? 'border-[#3ecf8e]/30' : 'border-[#2a2a2a]'}`}>
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-white font-semibold text-sm">{ev.title}</h3>
                        {isSupervisor && (
                          <span className="bg-[#3ecf8e]/10 text-[#3ecf8e] text-[9px] font-bold uppercase px-1.5 py-0.5 rounded">Supervisor</span>
                        )}
                        {ev.service_tier === 'managed_labor' && (
                          <span className="bg-purple-500/10 text-purple-400 text-[9px] font-bold uppercase px-1.5 py-0.5 rounded">Managed</span>
                        )}
                      </div>
                      <p className="text-[#888] text-xs">{formatDate(ev.event_date)} &middot; {formatTime(ev.start_time)} – {formatTime(ev.end_time)}</p>
                      <p className="text-[#666] text-xs mt-0.5">{ev.location}, {ev.city}</p>
                    </div>
                    <span className={`px-2 py-0.5 rounded text-[10px] font-medium ${
                      a.status === 'checked_in' ? 'bg-blue-500/20 text-blue-400' :
                      a.status === 'completed' ? 'bg-green-500/20 text-green-400' :
                      'bg-yellow-500/20 text-yellow-400'
                    }`}>
                      {a.status.replace(/_/g, ' ')}
                    </span>
                  </div>

                  {ev.pay_rate && (
                    <p className="text-[#888] text-xs mb-2">Pay: {ev.pay_rate}</p>
                  )}

                  {/* Geofence status */}
                  {ev.latitude != null && ev.longitude != null && (
                    <div className="flex items-center gap-2 mb-3 text-xs">
                      {distance == null ? (
                        <span className="text-[#555]">Calculating distance...</span>
                      ) : withinGeofence ? (
                        <><span className="w-2 h-2 rounded-full bg-[#3ecf8e]" /><span className="text-[#3ecf8e]">You're at the venue ({distance}m away)</span></>
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

                  {/* Action buttons */}
                  {a.status === 'confirmed' && (
                    <button
                      onClick={() => handleAction(a.id, ev.id, 'check_in')}
                      disabled={!canCheckIn || actionLoading === a.id}
                      className="w-full bg-[#3ecf8e] text-black rounded-lg py-3 text-sm font-semibold disabled:opacity-40 hover:opacity-90 transition-all"
                    >
                      {actionLoading === a.id ? 'Checking in...' : !withinGeofence && ev.latitude != null ? 'Move closer to check in' : 'Check In'}
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
                    <CrewRoster crew={a.crew} geo={geo} eventRadius={ev.geofence_radius_meters || 200} />
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
