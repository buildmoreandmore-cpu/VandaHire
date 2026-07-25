import { useState, useEffect } from 'react'
import { formatSenderNumber } from '../lib/senderNumbers.js'
import TimesheetCapture from '../components/TimesheetCapture.jsx'

const PASS_KEY = 'vanda_sup_passcode'

const api = (route) => `/api/worker?route=${route}`

export default function SupervisorDashboardPage() {
  const [passcode, setPasscode] = useState(() => { try { return localStorage.getItem(PASS_KEY) || '' } catch { return '' } })
  const [authed, setAuthed] = useState(false)
  const [me, setMe] = useState(null) // { name, number }
  const [events, setEvents] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const [loginInput, setLoginInput] = useState('')
  const [loggingIn, setLoggingIn] = useState(false)

  const authFetch = (route, opts = {}) => fetch(api(route), {
    ...opts,
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${passcode}`, ...(opts.headers || {}) },
  })

  const loadDashboard = async () => {
    setLoading(true); setError('')
    try {
      const res = await authFetch('sup-dashboard')
      if (res.status === 401) { setAuthed(false); localStorage.removeItem(PASS_KEY); throw new Error('Session expired — sign in again.') }
      const d = await res.json()
      if (!res.ok) throw new Error(d.error || 'Failed to load')
      setMe({ name: d.name, number: d.number })
      setEvents(d.events || [])
      setAuthed(true)
    } catch (e) { setError(e.message) }
    setLoading(false)
  }

  useEffect(() => { if (passcode) loadDashboard() /* eslint-disable-next-line */ }, [])

  const doLogin = async (e) => {
    e?.preventDefault()
    const code = loginInput.trim()
    if (!code) return
    setLoggingIn(true); setError('')
    try {
      const res = await fetch(api('sup-login'), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ passcode: code }) })
      const d = await res.json()
      if (!res.ok) throw new Error(d.error || 'Invalid passcode')
      try { localStorage.setItem(PASS_KEY, code) } catch {}
      setPasscode(code)
      setMe({ name: d.name, number: d.number })
      setAuthed(true)
      // load after state set
      setTimeout(() => loadDashboardWith(code), 0)
    } catch (e) { setError(e.message) }
    setLoggingIn(false)
  }

  const loadDashboardWith = async (code) => {
    setLoading(true)
    try {
      const res = await fetch(api('sup-dashboard'), { headers: { 'Authorization': `Bearer ${code}` } })
      const d = await res.json()
      if (res.ok) { setMe({ name: d.name, number: d.number }); setEvents(d.events || []) }
    } catch {}
    setLoading(false)
  }

  const logout = () => { try { localStorage.removeItem(PASS_KEY) } catch {}; setPasscode(''); setAuthed(false); setMe(null); setEvents([]) }

  if (!authed) {
    return (
      <div style={{ minHeight: '100vh', background: '#0a0a0a', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, fontFamily: 'system-ui, sans-serif' }}>
        <form onSubmit={doLogin} style={{ width: '100%', maxWidth: 360 }}>
          <h1 style={{ fontSize: 26, fontWeight: 800, marginBottom: 4 }}>Supervisor Login</h1>
          <p style={{ color: '#888', fontSize: 14, marginBottom: 24 }}>Enter your passcode to open your crew dashboard.</p>
          {error && <div style={{ background: '#331111', border: '1px solid #552222', color: '#ff6666', padding: '10px 14px', borderRadius: 8, marginBottom: 16, fontSize: 13 }}>{error}</div>}
          <input
            type="password"
            value={loginInput}
            onChange={e => setLoginInput(e.target.value)}
            placeholder="Passcode"
            autoFocus
            style={{ width: '100%', padding: '13px 15px', borderRadius: 8, border: '1px solid #333', background: '#141414', color: '#fff', fontSize: 16, boxSizing: 'border-box', marginBottom: 14 }}
          />
          <button type="submit" disabled={loggingIn} style={{ width: '100%', padding: 14, borderRadius: 8, border: 'none', background: '#fff', color: '#000', fontSize: 16, fontWeight: 700, cursor: 'pointer', opacity: loggingIn ? 0.6 : 1 }}>
            {loggingIn ? 'Signing in…' : 'Sign In'}
          </button>
        </form>
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100vh', background: '#0a0a0a', color: '#fff', fontFamily: 'system-ui, sans-serif' }}>
      <div style={{ maxWidth: 780, margin: '0 auto', padding: '28px 18px 60px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
          <h1 style={{ fontSize: 24, fontWeight: 800 }}>Hi {me?.name || 'there'}</h1>
          <button onClick={logout} style={{ background: 'transparent', border: '1px solid #333', color: '#888', padding: '6px 12px', borderRadius: 6, fontSize: 12, cursor: 'pointer' }}>Sign out</button>
        </div>
        <p style={{ color: '#888', fontSize: 13, marginBottom: 20 }}>
          Your line: <span style={{ color: '#fff', fontWeight: 600 }}>{formatSenderNumber(me?.number)}</span> · texts you send here come from this number, and worker replies go to it in RingCentral.
        </p>

        {error && <div style={{ background: '#331111', border: '1px solid #552222', color: '#ff6666', padding: '10px 14px', borderRadius: 8, marginBottom: 16, fontSize: 13 }}>{error}</div>}

        {loading ? (
          <p style={{ color: '#888', textAlign: 'center', padding: 40 }}>Loading your crews…</p>
        ) : events.length === 0 ? (
          <div style={{ background: '#141414', border: '1px solid #222', borderRadius: 12, padding: 28, textAlign: 'center', color: '#888' }}>
            No events assigned to your line yet. When a coordinator sets an event's "Text from" to your number, it shows up here.
          </div>
        ) : (
          events.map(ev => <EventCrew key={ev.id} event={ev} authFetch={authFetch} onReload={loadDashboard} />)
        )}
      </div>
    </div>
  )
}

function EventCrew({ event, authFetch, onReload }) {
  const crew = event.crew || []
  const [selected, setSelected] = useState(new Set())
  const [showCompose, setShowCompose] = useState(false)
  const [showTimesheet, setShowTimesheet] = useState(false)
  const [text, setText] = useState('')
  const [channel, setChannel] = useState('both')
  const [sending, setSending] = useState(false)
  const [result, setResult] = useState(null)

  const toggle = (id) => setSelected(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n })
  const allIds = crew.map(c => c.applicants?.id).filter(Boolean)
  const allSelected = allIds.length > 0 && allIds.every(id => selected.has(id))
  const toggleAll = () => setSelected(allSelected ? new Set() : new Set(allIds))

  const fmtDate = (d) => d ? new Date(`${d}T00:00:00`).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' }) : 'No date'

  const send = async () => {
    if (!text.trim() || selected.size === 0) return
    setSending(true); setResult(null)
    try {
      const res = await authFetch('sup-message', { method: 'POST', body: JSON.stringify({ worker_ids: [...selected], message: text, channel }) })
      const d = await res.json()
      if (!res.ok) throw new Error(d.error || 'Send failed')
      setResult(`Sent to ${d.recipients} · SMS ${d.sms.sent} ok${d.sms.failed ? `, ${d.sms.failed} failed` : ''} · Email ${d.email.sent} ok`)
      setText(''); setSelected(new Set())
    } catch (e) { setResult('Error: ' + e.message) }
    setSending(false)
  }

  const statusColor = (s) => s === 'confirmed' || s === 'checked_in' || s === 'completed' ? '#4ade80' : s === 'invited' ? '#facc15' : '#888'

  return (
    <div style={{ background: '#111', border: '1px solid #222', borderRadius: 12, padding: 16, marginBottom: 14 }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 }}>
        <div>
          <div style={{ fontSize: 16, fontWeight: 700 }}>{event.title}</div>
          <div style={{ color: '#888', fontSize: 12, marginTop: 2 }}>{fmtDate(event.event_date)}{event.city ? ` · ${event.city}` : ''} · {crew.length} crew</div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6 }}>
          <span style={{ fontSize: 11, padding: '3px 8px', borderRadius: 6, background: '#1e1e1e', color: '#aaa' }}>{(event.status || '').replace(/_/g, ' ')}</span>
          <button onClick={() => setShowTimesheet(true)} style={{ background: '#fff', color: '#000', border: 'none', borderRadius: 20, padding: '6px 12px', fontSize: 12, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>
            Timesheet
          </button>
        </div>
      </div>
      {showTimesheet && (
        <TimesheetCapture
          title={`Timesheet — ${event.title}`}
          initialEvent={event.title || ''}
          parseImage={async (base64) => {
            const r = await authFetch('sup-timesheet-parse', { method: 'POST', body: JSON.stringify({ image_base64: base64 }) })
            const d = await r.json(); if (!r.ok) throw new Error(d.error || 'Could not read the timesheet'); return d
          }}
          submitTimesheet={async (payload) => {
            const r = await authFetch('sup-timesheet-submit', { method: 'POST', body: JSON.stringify(payload) })
            const d = await r.json(); if (!r.ok) throw new Error(d.error || 'Submit failed'); return d
          }}
          onClose={() => setShowTimesheet(false)}
        />
      )}

      {crew.length > 0 && (
        <>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '12px 0 6px' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#aaa', cursor: 'pointer' }}>
              <input type="checkbox" checked={allSelected} onChange={toggleAll} /> Select all
            </label>
            {selected.size > 0 && (
              <button onClick={() => setShowCompose(true)} style={{ marginLeft: 'auto', background: '#fff', color: '#000', border: 'none', borderRadius: 20, padding: '6px 14px', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
                Message {selected.size} →
              </button>
            )}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {crew.map(c => {
              const w = c.applicants || {}
              return (
                <label key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 10, background: '#0d0d0d', border: '1px solid #1e1e1e', borderRadius: 8, padding: '8px 10px', cursor: 'pointer' }}>
                  <input type="checkbox" checked={selected.has(w.id)} onChange={() => toggle(w.id)} />
                  <span style={{ flex: 1, fontSize: 13 }}>{w.first_name} {w.last_name}{c.is_supervisor ? ' · Lead' : ''}</span>
                  <a href={`tel:${w.phone}`} onClick={e => e.stopPropagation()} style={{ color: '#93b3f3', fontSize: 12, textDecoration: 'none' }}>{w.phone}</a>
                  <span style={{ fontSize: 11, color: statusColor(c.status) }}>{(c.status || '').replace(/_/g, ' ')}</span>
                </label>
              )
            })}
          </div>
        </>
      )}

      {showCompose && (
        <div style={{ marginTop: 12, background: '#0d0d0d', border: '1px solid #222', borderRadius: 10, padding: 12 }}>
          <div style={{ fontSize: 12, color: '#aaa', marginBottom: 8 }}>Message {selected.size} worker{selected.size !== 1 ? 's' : ''} — from your line</div>
          <select value={channel} onChange={e => setChannel(e.target.value)} style={{ width: '100%', background: '#141414', border: '1px solid #333', borderRadius: 6, color: '#fff', padding: '8px 10px', fontSize: 13, marginBottom: 8 }}>
            <option value="both">SMS + Email</option>
            <option value="sms">SMS only</option>
            <option value="email">Email only</option>
          </select>
          <textarea value={text} onChange={e => setText(e.target.value)} rows={4} placeholder="Type your message… {first_name} personalizes each one." style={{ width: '100%', background: '#141414', border: '1px solid #333', borderRadius: 6, color: '#fff', padding: '10px', fontSize: 14, boxSizing: 'border-box', resize: 'none' }} />
          {result && <div style={{ fontSize: 12, color: result.startsWith('Error') ? '#ff6666' : '#4ade80', marginTop: 8 }}>{result}</div>}
          <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
            <button onClick={send} disabled={sending || !text.trim()} style={{ background: '#fff', color: '#000', border: 'none', borderRadius: 8, padding: '9px 18px', fontSize: 13, fontWeight: 700, cursor: 'pointer', opacity: (sending || !text.trim()) ? 0.5 : 1 }}>
              {sending ? 'Sending…' : `Send to ${selected.size}`}
            </button>
            <button onClick={() => { setShowCompose(false); setResult(null) }} style={{ background: 'transparent', border: '1px solid #333', color: '#888', borderRadius: 8, padding: '9px 14px', fontSize: 13, cursor: 'pointer' }}>Close</button>
          </div>
        </div>
      )}
    </div>
  )
}
