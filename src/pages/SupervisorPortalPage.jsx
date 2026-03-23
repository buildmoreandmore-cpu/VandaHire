import { useState, useEffect } from 'react'
import { useNavigate } from '../Router.jsx'
import VandaLogo from '../components/VandaLogo.jsx'
import Footer from '../components/Footer.jsx'
import { calculateDistance } from '../lib/geo.js'

const PHONE_KEY = 'vanda_supervisor_phone'

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

function timeAgo(ts) {
  if (!ts) return 'never'
  const diff = Date.now() - new Date(ts).getTime()
  if (diff < 60000) return 'just now'
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`
  return `${Math.floor(diff / 3600000)}h ago`
}

function formatPhone(val) {
  const digits = val.replace(/\D/g, '').slice(0, 10)
  if (digits.length < 4) return digits
  if (digits.length < 7) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`
  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`
}

function GpsIndicator({ member, eventLat, eventLng, geofenceRadius }) {
  const hasLivePing = member.last_ping_lat && member.last_ping_lng && member.last_ping_at
  const hasCheckIn = member.check_in_lat && member.check_in_lng
  const lat = hasLivePing ? member.last_ping_lat : hasCheckIn ? member.check_in_lat : null
  const lng = hasLivePing ? member.last_ping_lng : hasCheckIn ? member.check_in_lng : null

  if (!lat || !lng || eventLat == null || eventLng == null) {
    return <span style={{ color: '#555', fontSize: 10 }}>No GPS</span>
  }

  const dist = Math.round(calculateDistance(lat, lng, eventLat, eventLng))
  const withinGeofence = dist <= (geofenceRadius || 200)
  const isLive = hasLivePing && (Date.now() - new Date(member.last_ping_at).getTime() < 120000) // within 2 min

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
      <span style={{
        width: 8, height: 8, borderRadius: '50%',
        background: member.status === 'checked_in' && isLive && withinGeofence ? '#22c55e'
          : member.status === 'checked_in' && isLive && !withinGeofence ? '#ef4444'
          : member.status === 'checked_in' ? '#eab308'
          : '#555',
        display: 'inline-block',
        animation: isLive ? 'pulse 2s infinite' : 'none',
      }} />
      <span style={{ fontSize: 10, color: '#888' }}>
        {dist >= 1000 ? `${(dist / 1000).toFixed(1)}km` : `${dist}m`}
        {isLive ? '' : ' (stale)'}
      </span>
    </div>
  )
}

export default function SupervisorPortalPage() {
  const navigate = useNavigate()
  const [phone, setPhone] = useState('')
  const [verified, setVerified] = useState(!!localStorage.getItem(PHONE_KEY))
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [data, setData] = useState(null)
  const [tab, setTab] = useState('crew') // crew | bench | incidents

  const fetchDashboard = async (ph) => {
    setLoading(true)
    setError('')
    try {
      const res = await fetch(`/api/worker?route=supervisor-dashboard&phone=${encodeURIComponent(ph)}`)
      const d = await res.json()
      if (!res.ok) throw new Error(d.error || 'Failed to load dashboard')
      setData(d)
    } catch (err) {
      setError(err.message)
    }
    setLoading(false)
  }

  useEffect(() => {
    const saved = localStorage.getItem(PHONE_KEY)
    if (saved) fetchDashboard(saved)
  }, [])

  // Auto-refresh every 30s
  useEffect(() => {
    if (!verified || !data) return
    const saved = localStorage.getItem(PHONE_KEY)
    if (!saved) return
    const id = setInterval(() => fetchDashboard(saved), 30000)
    return () => clearInterval(id)
  }, [verified, data])

  const handleLogin = (e) => {
    e.preventDefault()
    const digits = phone.replace(/\D/g, '')
    if (digits.length < 10) { setError('Enter a valid 10-digit phone number.'); return }
    localStorage.setItem(PHONE_KEY, digits)
    setVerified(true)
    fetchDashboard(digits)
  }

  const handleLogout = () => {
    localStorage.removeItem(PHONE_KEY)
    setVerified(false)
    setData(null)
    setPhone('')
  }

  // Login screen
  if (!verified) {
    return (
      <div style={{ minHeight: '100vh', background: '#0a0a0a', color: '#fff', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
        <div style={{ borderBottom: '1px solid #1a1a1a', padding: '16px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <VandaLogo onClick={() => navigate('/')} />
        </div>
        <div style={{ maxWidth: 420, margin: '0 auto', padding: '60px 20px' }}>
          <h1 style={{ fontSize: 28, fontWeight: 800, marginBottom: 4 }}>Supervisor Portal</h1>
          <p style={{ color: '#888', fontSize: 14, marginBottom: 32 }}>Enter your phone number to access your event dashboard.</p>

          <form onSubmit={handleLogin}>
            <label style={{ display: 'block', color: '#777', fontSize: 13, marginBottom: 8 }}>Phone Number</label>
            <input
              type="tel"
              value={formatPhone(phone)}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="(404) 555-0100"
              style={{ width: '100%', padding: '14px 16px', borderRadius: 12, border: '1px solid #2a2a2a', background: '#111', color: '#fff', fontSize: 16, boxSizing: 'border-box', marginBottom: 16 }}
            />
            {error && <p style={{ color: '#ef4444', fontSize: 13, marginBottom: 12 }}>{error}</p>}
            <button type="submit" style={{ width: '100%', padding: 14, borderRadius: 24, border: 'none', background: '#fff', color: '#000', fontSize: 16, fontWeight: 600, cursor: 'pointer' }}>
              Access Dashboard
            </button>
          </form>

          <p style={{ color: '#444', fontSize: 12, textAlign: 'center', marginTop: 24 }}>
            Only supervisors assigned to an event can access this portal.
          </p>
        </div>
        <Footer />
      </div>
    )
  }

  const event = data?.event
  const crew = data?.crew || []
  const bench = data?.bench || []
  const incidents = data?.incidents || []

  const checkedIn = crew.filter(c => c.status === 'checked_in').length
  const confirmed = crew.filter(c => c.status === 'confirmed').length
  const total = crew.length

  return (
    <div style={{ minHeight: '100vh', background: '#0a0a0a', color: '#fff', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
      {/* Header */}
      <div style={{ borderBottom: '1px solid #1a1a1a', padding: '12px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <VandaLogo onClick={() => navigate('/')} />
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ color: '#666', fontSize: 12 }}>Supervisor</span>
          <button onClick={handleLogout} style={{ color: '#888', fontSize: 12, background: 'none', border: 'none', cursor: 'pointer' }}>Log Out</button>
        </div>
      </div>

      <div style={{ maxWidth: 600, margin: '0 auto', padding: '20px 16px' }}>
        {loading && !data && (
          <div style={{ textAlign: 'center', padding: 40, color: '#888' }}>Loading dashboard...</div>
        )}

        {error && !data && (
          <div style={{ background: '#331111', border: '1px solid #552222', color: '#ff6666', padding: '12px 16px', borderRadius: 8, marginBottom: 20, fontSize: 14 }}>
            {error}
          </div>
        )}

        {data && event && (
          <>
            {/* Event Card */}
            <div style={{ background: '#111', border: '1px solid #2a2a2a', borderRadius: 12, padding: 20, marginBottom: 16 }}>
              <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 4 }}>{event.title}</h2>
              <p style={{ color: '#888', fontSize: 13 }}>
                {formatDate(event.event_date)} &middot; {formatTime(event.start_time)} – {formatTime(event.end_time)}
              </p>
              <p style={{ color: '#666', fontSize: 13, marginTop: 2 }}>{event.location}, {event.city}</p>
              {event.pay_rate && <p style={{ color: '#888', fontSize: 13, marginTop: 4 }}>Pay rate: ${event.pay_rate}/hr</p>}

              {/* Stats row */}
              <div style={{ display: 'flex', gap: 16, marginTop: 16 }}>
                <div style={{ background: '#0a0a0a', borderRadius: 8, padding: '10px 16px', flex: 1, textAlign: 'center' }}>
                  <div style={{ fontSize: 24, fontWeight: 700, color: '#22c55e' }}>{checkedIn}</div>
                  <div style={{ fontSize: 10, color: '#888', textTransform: 'uppercase', letterSpacing: 1 }}>Checked In</div>
                </div>
                <div style={{ background: '#0a0a0a', borderRadius: 8, padding: '10px 16px', flex: 1, textAlign: 'center' }}>
                  <div style={{ fontSize: 24, fontWeight: 700, color: '#eab308' }}>{confirmed}</div>
                  <div style={{ fontSize: 10, color: '#888', textTransform: 'uppercase', letterSpacing: 1 }}>Waiting</div>
                </div>
                <div style={{ background: '#0a0a0a', borderRadius: 8, padding: '10px 16px', flex: 1, textAlign: 'center' }}>
                  <div style={{ fontSize: 24, fontWeight: 700 }}>{total}</div>
                  <div style={{ fontSize: 10, color: '#888', textTransform: 'uppercase', letterSpacing: 1 }}>Total Crew</div>
                </div>
                <div style={{ background: '#0a0a0a', borderRadius: 8, padding: '10px 16px', flex: 1, textAlign: 'center' }}>
                  <div style={{ fontSize: 24, fontWeight: 700, color: '#3b82f6' }}>{bench.length}</div>
                  <div style={{ fontSize: 10, color: '#888', textTransform: 'uppercase', letterSpacing: 1 }}>On Bench</div>
                </div>
              </div>
            </div>

            {/* Auto-refresh indicator */}
            <p style={{ color: '#444', fontSize: 11, textAlign: 'center', marginBottom: 16 }}>
              Auto-refreshes every 30 seconds
            </p>

            {/* Tabs */}
            <div style={{ display: 'flex', borderBottom: '1px solid #1a1a1a', marginBottom: 16 }}>
              {[
                { key: 'crew', label: `Crew (${total})` },
                { key: 'bench', label: `Bench (${bench.length})` },
                { key: 'incidents', label: `Incidents (${incidents.length})` },
              ].map(t => (
                <button
                  key={t.key}
                  onClick={() => setTab(t.key)}
                  style={{
                    flex: 1, padding: '10px 0', background: 'none', border: 'none', cursor: 'pointer',
                    color: tab === t.key ? '#fff' : '#666', fontSize: 13, fontWeight: tab === t.key ? 600 : 400,
                    borderBottom: tab === t.key ? '2px solid #fff' : '2px solid transparent',
                  }}
                >
                  {t.label}
                </button>
              ))}
            </div>

            {/* Crew Tab */}
            {tab === 'crew' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {crew.length === 0 && <p style={{ color: '#666', fontSize: 13, textAlign: 'center', padding: 20 }}>No crew assigned yet.</p>}
                {crew.map(c => {
                  const w = c.applicants
                  if (!w) return null
                  const statusColors = {
                    checked_in: { bg: 'rgba(59,130,246,0.15)', color: '#60a5fa' },
                    confirmed: { bg: 'rgba(234,179,8,0.15)', color: '#eab308' },
                    completed: { bg: 'rgba(34,197,94,0.15)', color: '#22c55e' },
                  }
                  const sc = statusColors[c.status] || { bg: 'rgba(255,255,255,0.05)', color: '#888' }

                  return (
                    <div key={c.id} style={{ background: '#111', border: '1px solid #2a2a2a', borderRadius: 10, padding: '12px 14px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        {/* Avatar */}
                        {w.photo_url ? (
                          <img src={w.photo_url} alt="" style={{ width: 36, height: 36, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />
                        ) : (
                          <div style={{ width: 36, height: 36, borderRadius: '50%', background: '#2a2a2a', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: 12, color: '#888' }}>
                            {w.first_name?.[0]}{w.last_name?.[0]}
                          </div>
                        )}

                        {/* Info */}
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <span style={{ fontWeight: 600, fontSize: 13 }}>{w.first_name} {w.last_name}</span>
                            {c.is_supervisor && <span style={{ fontSize: 9, fontWeight: 700, color: '#fff', background: 'rgba(255,255,255,0.1)', padding: '1px 5px', borderRadius: 3, textTransform: 'uppercase' }}>Lead</span>}
                          </div>
                          <div style={{ color: '#666', fontSize: 11, marginTop: 1 }}>
                            <a href={`tel:${w.phone}`} style={{ color: '#93b3f3', textDecoration: 'none' }}>{w.phone}</a>
                          </div>
                        </div>

                        {/* Status + GPS */}
                        <div style={{ textAlign: 'right', flexShrink: 0 }}>
                          <span style={{ background: sc.bg, color: sc.color, fontSize: 10, fontWeight: 600, padding: '3px 8px', borderRadius: 4, display: 'inline-block', marginBottom: 4 }}>
                            {c.status.replace(/_/g, ' ')}
                          </span>
                          <GpsIndicator member={c} eventLat={event.latitude} eventLng={event.longitude} geofenceRadius={event.geofence_radius_meters} />
                        </div>
                      </div>

                      {/* Details row */}
                      <div style={{ display: 'flex', gap: 12, marginTop: 8, fontSize: 11, color: '#666' }}>
                        {c.check_in_time && (
                          <span>In: {new Date(c.check_in_time).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}</span>
                        )}
                        {c.check_out_time && (
                          <span>Out: {new Date(c.check_out_time).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}</span>
                        )}
                        {c.hours_tracked && <span>{c.hours_tracked}h logged</span>}
                        {c.last_ping_at && <span>GPS: {timeAgo(c.last_ping_at)}</span>}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}

            {/* Bench Tab */}
            {tab === 'bench' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {bench.length === 0 && <p style={{ color: '#666', fontSize: 13, textAlign: 'center', padding: 20 }}>No workers on the bench.</p>}
                {bench.map(b => {
                  const w = b.applicants
                  if (!w) return null
                  return (
                    <div key={b.id} style={{ background: '#111', border: '1px solid #2a2a2a', borderRadius: 10, padding: '12px 14px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div style={{ width: 36, height: 36, borderRadius: '50%', background: '#2a2a2a', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: 12, color: '#888' }}>
                          {w.first_name?.[0]}{w.last_name?.[0]}
                        </div>
                        <div style={{ flex: 1 }}>
                          <span style={{ fontWeight: 600, fontSize: 13 }}>{w.first_name} {w.last_name}</span>
                          <div style={{ color: '#666', fontSize: 11, marginTop: 1 }}>
                            <a href={`tel:${w.phone}`} style={{ color: '#93b3f3', textDecoration: 'none' }}>{w.phone}</a>
                          </div>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <span style={{
                            fontSize: 10, fontWeight: 600, padding: '3px 8px', borderRadius: 4,
                            background: b.status === 'standby' ? 'rgba(234,179,8,0.15)' : 'rgba(59,130,246,0.15)',
                            color: b.status === 'standby' ? '#eab308' : '#60a5fa',
                          }}>
                            {b.status === 'standby' ? 'Standby' : 'Called In'}
                          </span>
                          <div style={{ fontSize: 10, color: '#555', marginTop: 4 }}>Tier {b.tier}</div>
                        </div>
                      </div>
                      {b.called_in_at && (
                        <p style={{ fontSize: 11, color: '#666', marginTop: 6 }}>Called in: {timeAgo(b.called_in_at)}</p>
                      )}
                    </div>
                  )
                })}
              </div>
            )}

            {/* Incidents Tab */}
            {tab === 'incidents' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {incidents.length === 0 && <p style={{ color: '#666', fontSize: 13, textAlign: 'center', padding: 20 }}>No incidents reported.</p>}
                {incidents.map(inc => (
                  <div key={inc.id} style={{ background: '#111', border: '1px solid #2a2a2a', borderRadius: 10, padding: '12px 14px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                      <span style={{ fontSize: 12, fontWeight: 600, color: '#ef4444' }}>{(inc.type || '').replace(/_/g, ' ')}</span>
                      <span style={{ fontSize: 10, color: '#555' }}>{timeAgo(inc.created_at)}</span>
                    </div>
                    {inc.description && <p style={{ fontSize: 12, color: '#aaa', margin: 0, lineHeight: 1.5 }}>{inc.description}</p>}
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>

      <Footer />

      <style>{`
        @keyframes pulse { 0%, 100% { opacity: 1 } 50% { opacity: 0.4 } }
      `}</style>
    </div>
  )
}
