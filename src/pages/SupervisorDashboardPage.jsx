import { useState, useEffect } from 'react'
import imageCompression from 'browser-image-compression'
import { formatSenderNumber } from '../lib/senderNumbers.js'

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
      {showTimesheet && <TimesheetFlow event={event} authFetch={authFetch} onClose={() => setShowTimesheet(false)} />}

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

// ─── Timesheet capture flow: photo → Claude Vision → edit → sign → submit ───────
function TimesheetFlow({ event, authFetch, onClose }) {
  const [company, setCompany] = useState('')
  const [eventName, setEventName] = useState(event.title || '')
  const [days, setDays] = useState([]) // [{ id, date, rows:[{name,start_time,end_time,total_hours,unclear}] }]
  const [parsing, setParsing] = useState(false)
  const [error, setError] = useState('')
  const [signature, setSignature] = useState('')
  const [attested, setAttested] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [result, setResult] = useState(null)

  const addPhoto = async (file) => {
    if (!file) return
    setParsing(true); setError('')
    try {
      const compressed = await imageCompression(file, { maxSizeMB: 1.2, maxWidthOrHeight: 2200, useWebWorker: true, fileType: 'image/jpeg' })
      const base64 = await new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = rej; r.readAsDataURL(compressed) })
      const resp = await authFetch('sup-timesheet-parse', { method: 'POST', body: JSON.stringify({ image_base64: base64 }) })
      const d = await resp.json()
      if (!resp.ok) throw new Error(d.error || 'Could not read the timesheet')
      if (d.company && !company) setCompany(d.company)
      if (d.event && (!eventName || eventName === event.title)) setEventName(d.event)
      setDays(prev => [...prev, { id: Math.random().toString(36).slice(2), date: d.date || '', rows: d.rows || [] }])
    } catch (e) { setError(e.message) }
    setParsing(false)
  }

  const setDay = (id, patch) => setDays(prev => prev.map(dd => dd.id === id ? { ...dd, ...patch } : dd))
  const setRow = (dayId, i, patch) => setDays(prev => prev.map(dd => dd.id !== dayId ? dd : { ...dd, rows: dd.rows.map((r, ri) => ri === i ? { ...r, ...patch } : r) }))
  const addRow = (dayId) => setDays(prev => prev.map(dd => dd.id === dayId ? { ...dd, rows: [...dd.rows, { name: '', start_time: '', end_time: '', total_hours: '' }] } : dd))
  const delRow = (dayId, i) => setDays(prev => prev.map(dd => dd.id === dayId ? { ...dd, rows: dd.rows.filter((_, ri) => ri !== i) } : dd))
  const removeDay = (id) => setDays(prev => prev.filter(dd => dd.id !== id))

  const dayTotal = (rows) => Math.round(rows.reduce((a, r) => a + (parseFloat(r.total_hours) || 0), 0) * 10) / 10
  const grand = Math.round(days.reduce((a, d) => a + dayTotal(d.rows), 0) * 10) / 10

  const submit = async () => {
    if (!signature.trim()) { setError('Type your name to sign off.'); return }
    if (!attested) { setError('Please check the accuracy box to submit.'); return }
    if (!days.length) { setError('Add at least one timesheet photo.'); return }
    setSubmitting(true); setError('')
    try {
      const resp = await authFetch('sup-timesheet-submit', { method: 'POST', body: JSON.stringify({ company, event: eventName, associate_signature: signature.trim(), days: days.map(d => ({ date: d.date, rows: d.rows })) }) })
      const d = await resp.json()
      if (!resp.ok) throw new Error(d.error || 'Submit failed')
      setResult(d)
    } catch (e) { setError(e.message) }
    setSubmitting(false)
  }

  const inp = { background: '#141414', border: '1px solid #333', borderRadius: 5, color: '#fff', padding: '5px 7px', fontSize: 13, width: '100%', boxSizing: 'border-box' }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.7)', zIndex: 60, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: 16, overflowY: 'auto' }} onClick={onClose}>
      <div style={{ background: '#0d0d0d', border: '1px solid #222', borderRadius: 14, width: '100%', maxWidth: 720, margin: '20px 0' }} onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 18px', borderBottom: '1px solid #1e1e1e' }}>
          <div style={{ color: '#fff', fontWeight: 700 }}>Timesheet — {event.title}</div>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: '#888', fontSize: 22, cursor: 'pointer' }}>×</button>
        </div>

        {result ? (
          <div style={{ padding: 30, textAlign: 'center' }}>
            <div style={{ width: 56, height: 56, borderRadius: '50%', background: '#16351f', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#4ade80" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
            </div>
            <div style={{ color: '#fff', fontSize: 18, fontWeight: 700, marginBottom: 6 }}>Timesheet sent</div>
            <div style={{ color: '#888', fontSize: 14 }}>{result.totals?.grand} total hours across {days.length} day{days.length !== 1 ? 's' : ''} — emailed to info@vassoc.com as an Excel file.</div>
            <button onClick={onClose} style={{ marginTop: 20, background: '#fff', color: '#000', border: 'none', borderRadius: 8, padding: '10px 22px', fontWeight: 700, cursor: 'pointer' }}>Done</button>
          </div>
        ) : (
          <div style={{ padding: 18 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 14 }}>
              <div><label style={{ color: '#888', fontSize: 11 }}>Company</label><input style={inp} value={company} onChange={e => setCompany(e.target.value)} placeholder="e.g. Venue Smart" /></div>
              <div><label style={{ color: '#888', fontSize: 11 }}>Event</label><input style={inp} value={eventName} onChange={e => setEventName(e.target.value)} /></div>
            </div>

            {days.map((d, di) => (
              <div key={d.id} style={{ border: '1px solid #222', borderRadius: 10, padding: 12, marginBottom: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                  <span style={{ color: '#aaa', fontSize: 12, fontWeight: 700 }}>Day {di + 1}</span>
                  <input style={{ ...inp, width: 180 }} value={d.date} onChange={e => setDay(d.id, { date: e.target.value })} placeholder="Date (e.g. July 24, 2026)" />
                  <span style={{ marginLeft: 'auto', color: '#4ade80', fontSize: 12, fontWeight: 700 }}>{dayTotal(d.rows)} hrs</span>
                  <button onClick={() => removeDay(d.id)} style={{ background: 'transparent', border: 'none', color: '#f87171', fontSize: 12, cursor: 'pointer' }}>Remove day</button>
                </div>
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                    <thead><tr style={{ color: '#888', textAlign: 'left' }}><th style={{ padding: 4 }}>Name</th><th style={{ padding: 4, width: 90 }}>Start</th><th style={{ padding: 4, width: 90 }}>End</th><th style={{ padding: 4, width: 60 }}>Hrs</th><th></th></tr></thead>
                    <tbody>
                      {d.rows.map((r, i) => (
                        <tr key={i} style={{ background: r.unclear ? 'rgba(250,204,21,.08)' : 'transparent' }}>
                          <td style={{ padding: 2 }}><input style={inp} value={r.name} onChange={e => setRow(d.id, i, { name: e.target.value })} /></td>
                          <td style={{ padding: 2 }}><input style={inp} value={r.start_time} onChange={e => setRow(d.id, i, { start_time: e.target.value })} /></td>
                          <td style={{ padding: 2 }}><input style={inp} value={r.end_time} onChange={e => setRow(d.id, i, { end_time: e.target.value })} /></td>
                          <td style={{ padding: 2 }}><input style={inp} value={r.total_hours} onChange={e => setRow(d.id, i, { total_hours: e.target.value })} /></td>
                          <td style={{ padding: 2 }}><button onClick={() => delRow(d.id, i)} style={{ background: 'transparent', border: 'none', color: '#666', cursor: 'pointer' }}>×</button></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <button onClick={() => addRow(d.id)} style={{ marginTop: 6, background: 'transparent', border: '1px dashed #333', color: '#888', borderRadius: 6, padding: '5px 10px', fontSize: 11, cursor: 'pointer' }}>+ Add row</button>
              </div>
            ))}

            <label style={{ display: 'block', border: '2px dashed #333', borderRadius: 10, padding: 18, textAlign: 'center', color: parsing ? '#666' : '#9ecbff', cursor: parsing ? 'default' : 'pointer', fontSize: 13 }}>
              <input type="file" accept="image/*" capture="environment" style={{ display: 'none' }} disabled={parsing} onChange={e => { const f = e.target.files?.[0]; e.target.value = ''; addPhoto(f) }} />
              {parsing ? 'Reading timesheet…' : days.length ? '+ Add another day (photo)' : 'Take or upload a photo of the timesheet'}
            </label>

            {error && <div style={{ color: '#f87171', fontSize: 13, marginTop: 12 }}>{error}</div>}

            {days.length > 0 && (
              <div style={{ marginTop: 16, borderTop: '1px solid #1e1e1e', paddingTop: 14 }}>
                <div style={{ color: '#fff', fontSize: 14, fontWeight: 700, marginBottom: 8 }}>Grand total: {grand} hours</div>
                <div style={{ background: '#2a1a0a', border: '1px solid #5a3a12', borderRadius: 8, padding: '10px 12px', color: '#f3b04e', fontSize: 12.5, marginBottom: 12 }}>
                  ⚠ Review carefully. By signing, you confirm these hours are accurate. If the timesheet is incorrect, the discrepancy may be docked from your pay.
                </div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 10 }}>
                  <label style={{ color: '#888', fontSize: 12 }}>Sign (type your name):</label>
                  <input style={{ ...inp, width: 220, fontFamily: 'cursive' }} value={signature} onChange={e => setSignature(e.target.value)} placeholder="Your full name" />
                </div>
                <label style={{ display: 'flex', gap: 8, alignItems: 'flex-start', color: '#ccc', fontSize: 12.5, marginBottom: 14, cursor: 'pointer' }}>
                  <input type="checkbox" checked={attested} onChange={e => setAttested(e.target.checked)} style={{ marginTop: 2 }} />
                  I confirm I reviewed this timesheet and the hours are accurate.
                </label>
                <button onClick={submit} disabled={submitting} style={{ width: '100%', background: '#fff', color: '#000', border: 'none', borderRadius: 8, padding: 13, fontWeight: 700, fontSize: 14, cursor: 'pointer', opacity: submitting ? 0.6 : 1 }}>
                  {submitting ? 'Submitting…' : 'Sign & Send to Office'}
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
