import { useState, useEffect } from 'react'
import imageCompression from 'browser-image-compression'

// Per-event timesheet manager: accumulate one day at a time (scan when it happens),
// then sign & submit the whole event to the office when it's over.
//
// Props:
//   event : { id, title }
//   api   : { listDays(eventId), parseImage(base64), saveDay(day), deleteDay(id), finalize(eventId, signature) }
//   onClose()
export default function EventTimesheets({ event, api, onClose }) {
  const [days, setDays] = useState([])
  const [submitted, setSubmitted] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [mode, setMode] = useState('list') // list | capture | submit | review
  const [editingDay, setEditingDay] = useState(null)
  const [result, setResult] = useState(null)

  const load = async () => {
    setLoading(true); setError('')
    try {
      const r = await api.listDays(event.id); setDays(r.days || r || [])
      if (api.listSubmitted) { try { const s = await api.listSubmitted(event.id); setSubmitted(s.days || s || []) } catch { /* older api */ } }
    } catch (e) { setError(e.message) }
    setLoading(false)
  }
  useEffect(() => { load() /* eslint-disable-next-line */ }, [])

  const total = (rows) => Math.round((rows || []).reduce((a, r) => a + (parseFloat(r.total_hours) || 0), 0) * 10) / 10
  const grand = Math.round(days.reduce((a, d) => a + total(d.rows), 0) * 10) / 10

  const inp = { background: '#141414', border: '1px solid #333', borderRadius: 5, color: '#fff', padding: '5px 7px', fontSize: 13, width: '100%', boxSizing: 'border-box' }
  const shell = (body) => (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.7)', zIndex: 60, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: 16, overflowY: 'auto', fontFamily: 'system-ui, sans-serif' }} onClick={onClose}>
      <div style={{ background: '#0d0d0d', border: '1px solid #222', borderRadius: 14, width: '100%', maxWidth: 720, margin: '20px 0' }} onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 18px', borderBottom: '1px solid #1e1e1e' }}>
          <div style={{ color: '#fff', fontWeight: 700 }}>Timesheets — {event.title}</div>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: '#888', fontSize: 22, cursor: 'pointer' }}>×</button>
        </div>
        {body}
      </div>
    </div>
  )

  if (mode === 'capture') {
    return shell(<DayCapture event={event} api={api} editDay={editingDay} onCancel={() => { setEditingDay(null); setMode('list') }} onSaved={async () => { setEditingDay(null); setMode('list'); await load() }} />)
  }

  if (result) {
    return shell(
      <div style={{ padding: 30, textAlign: 'center' }}>
        <div style={{ width: 56, height: 56, borderRadius: '50%', background: '#16351f', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#4ade80" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
        </div>
        <div style={{ color: '#fff', fontSize: 18, fontWeight: 700, marginBottom: 6 }}>Event timesheet sent</div>
        <div style={{ color: '#888', fontSize: 14 }}>{result.totals?.grand} total hours across {result.days} day{result.days !== 1 ? 's' : ''} — emailed to info@vassoc.com as one Excel file.</div>
        <button onClick={onClose} style={{ marginTop: 20, background: '#fff', color: '#000', border: 'none', borderRadius: 8, padding: '10px 22px', fontWeight: 700, cursor: 'pointer' }}>Done</button>
      </div>
    )
  }

  if (mode === 'submit') {
    return shell(<SubmitView event={event} api={api} grand={grand} dayCount={days.length} inp={inp} onBack={() => setMode('list')} onDone={(r) => setResult(r)} />)
  }

  if (mode === 'review') {
    // Review every uploaded day — in-progress (draft) AND submitted — read-only with detail + photos.
    const all = [...days.map(d => ({ ...d, _draft: true })), ...submitted]
    const revGrand = Math.round(all.reduce((a, d) => a + total(d.rows), 0) * 10) / 10
    return shell(
      <div style={{ padding: 18 }}>
        <button onClick={() => setMode('list')} style={{ background: 'transparent', border: '1px solid #333', color: '#9ecbff', borderRadius: 6, padding: '5px 12px', fontSize: 12, cursor: 'pointer', marginBottom: 12 }}>← Back</button>
        {all.length === 0 ? (
          <p style={{ color: '#888', textAlign: 'center', padding: 20 }}>Nothing uploaded for this event yet.</p>
        ) : (
          <>
            <div style={{ color: '#888', fontSize: 12, marginBottom: 10 }}>{all.length} day{all.length !== 1 ? 's' : ''} · {revGrand} hrs total</div>
            {all.map(d => (
              <div key={d.id} style={{ border: '1px solid #222', borderRadius: 10, padding: 12, marginBottom: 12 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6, gap: 8 }}>
                  <span style={{ color: '#fff', fontSize: 13, fontWeight: 700 }}>
                    {d.work_date || 'Undated day'}
                    {d._draft && <span style={{ marginLeft: 8, fontSize: 9, padding: '1px 6px', borderRadius: 5, background: 'rgba(250,204,21,.15)', color: '#facc15', verticalAlign: 'middle' }}>IN PROGRESS</span>}
                  </span>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 10, whiteSpace: 'nowrap' }}>
                    {api.canSetRate && <button onClick={() => { setEditingDay(d); setMode('capture') }} style={{ background: 'transparent', border: '1px solid #333', color: '#9ecbff', borderRadius: 6, padding: '3px 10px', fontSize: 11, cursor: 'pointer' }}>Edit</button>}
                    <span style={{ color: '#4ade80', fontSize: 12 }}>{total(d.rows)} hrs · {(d.rows || []).length} workers</span>
                  </span>
                </div>
                <DayPhotos urls={d.image_urls} />
                <div style={{ overflowX: 'auto' }}>
                  {(() => { const hasRate = (d.rows || []).some(r => parseFloat(r.pay_rate) > 0); return (
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                    <thead><tr style={{ color: '#777', textAlign: 'left' }}>
                      <th style={{ padding: 3 }}>Name</th><th style={{ padding: 3 }}>Start</th><th style={{ padding: 3 }}>End</th>
                      <th style={{ padding: 3, textAlign: 'right' }}>Break</th><th style={{ padding: 3, textAlign: 'right' }}>Hrs</th>
                      {hasRate && <th style={{ padding: 3, textAlign: 'right' }}>Rate</th>}
                      {hasRate && <th style={{ padding: 3, textAlign: 'right' }}>Pay</th>}
                    </tr></thead>
                    <tbody>
                      {(d.rows || []).map((r, i) => { const pay = (parseFloat(r.total_hours) || 0) * (parseFloat(r.pay_rate) || 0); return (
                        <tr key={i} style={{ color: '#ddd', borderTop: '1px solid #1a1a1a' }}>
                          <td style={{ padding: 3 }}>{r.name}</td><td style={{ padding: 3 }}>{r.start_time}</td><td style={{ padding: 3 }}>{r.end_time}</td>
                          <td style={{ padding: 3, textAlign: 'right' }}>{r.break_minutes ? `${r.break_minutes}m` : ''}</td>
                          <td style={{ padding: 3, textAlign: 'right' }}>{r.total_hours}</td>
                          {hasRate && <td style={{ padding: 3, textAlign: 'right' }}>{r.pay_rate ? `$${r.pay_rate}` : ''}</td>}
                          {hasRate && <td style={{ padding: 3, textAlign: 'right', color: pay ? '#4ade80' : '#555' }}>{pay ? `$${Math.round(pay * 100) / 100}` : ''}</td>}
                        </tr>
                      )})}
                    </tbody>
                  </table>
                  )})()}
                </div>
              </div>
            ))}
          </>
        )}
      </div>
    )
  }

  // list
  return shell(
    <div style={{ padding: 18 }}>
      {loading ? (
        <p style={{ color: '#888', textAlign: 'center', padding: 24 }}>Loading…</p>
      ) : (
        <>
          {(days.length + submitted.length) > 0 && (
            <button onClick={() => setMode('review')} style={{ width: '100%', background: '#12261a', border: '1px solid #1f4a30', color: '#7fe0a3', borderRadius: 8, padding: 10, fontSize: 13, fontWeight: 600, cursor: 'pointer', marginBottom: 12 }}>
              View / review timesheets ({days.length + submitted.length} day{(days.length + submitted.length) !== 1 ? 's' : ''}) →
            </button>
          )}
          {days.length === 0 ? (
            <div style={{ color: '#888', fontSize: 13, textAlign: 'center', padding: '18px 0' }}>No days saved yet. Scan the timesheet for each day as the event runs — they build up here until you submit.</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 14 }}>
              {days.map(d => (
                <div key={d.id} style={{ background: '#111', border: '1px solid #222', borderRadius: 8, padding: '10px 12px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ color: '#fff', fontSize: 13, fontWeight: 600 }}>{d.work_date || 'Undated day'}</div>
                      <div style={{ color: '#888', fontSize: 11 }}>{(d.rows || []).length} worker{(d.rows || []).length !== 1 ? 's' : ''} · {total(d.rows)} hrs</div>
                    </div>
                    <button onClick={() => { setEditingDay(d); setMode('capture') }} style={{ background: 'transparent', border: '1px solid #333', color: '#9ecbff', borderRadius: 6, padding: '4px 10px', fontSize: 12, cursor: 'pointer' }}>Edit</button>
                    <button onClick={async () => { if (confirm('Delete this day?')) { try { await api.deleteDay(d.id); load() } catch (e) { alert(e.message) } } }} style={{ background: 'transparent', border: 'none', color: '#f87171', fontSize: 12, cursor: 'pointer' }}>Delete</button>
                  </div>
                  <DayPhotos urls={d.image_urls} />
                </div>
              ))}
              <div style={{ color: '#4ade80', fontSize: 13, fontWeight: 700, textAlign: 'right' }}>Grand total: {grand} hrs</div>
            </div>
          )}

          {error && <div style={{ color: '#f87171', fontSize: 13, marginBottom: 10 }}>{error}</div>}

          <button onClick={() => setMode('capture')} style={{ width: '100%', border: '2px dashed #333', background: 'transparent', color: '#9ecbff', borderRadius: 10, padding: 14, fontSize: 13, cursor: 'pointer', marginBottom: 10 }}>
            + Scan a day's timesheet
          </button>
          <p style={{ color: '#777', fontSize: 11.5, textAlign: 'center', lineHeight: 1.5, marginBottom: 14 }}>
            Add a day anytime — you don't have to do them all at once. The roster can differ each day. When the event is over, submit below.
          </p>
          <button onClick={() => setMode('submit')} disabled={days.length === 0} style={{ width: '100%', background: days.length ? '#fff' : '#333', color: days.length ? '#000' : '#777', border: 'none', borderRadius: 8, padding: 13, fontWeight: 700, fontSize: 14, cursor: days.length ? 'pointer' : 'default' }}>
            Event over — sign &amp; submit to office
          </button>
        </>
      )}
    </div>
  )
}

// Original scan photos for a day — thumbnails that open full-size in a new tab.
function DayPhotos({ urls }) {
  const list = Array.isArray(urls) ? urls.filter(Boolean) : []
  if (!list.length) return null
  return (
    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', margin: '8px 0' }}>
      {list.map((u, i) => (
        <a key={i} href={u} target="_blank" rel="noopener noreferrer" title="Open original timesheet photo">
          <img src={u} alt="Original timesheet" style={{ width: 60, height: 60, objectFit: 'cover', borderRadius: 6, border: '1px solid #333' }} />
        </a>
      ))}
    </div>
  )
}

// Compute worked hours from times minus break minutes. Returns null if unparseable.
function computeNetHours(start, end, breakMin) {
  const p = (t) => {
    const m = /(\d{1,2}):?(\d{2})?\s*([ap]\.?m\.?)?/i.exec(String(t || ''))
    if (!m) return null
    let h = parseInt(m[1], 10); const min = m[2] ? parseInt(m[2], 10) : 0
    const ap = (m[3] || '').toLowerCase()
    if (ap.startsWith('p') && h < 12) h += 12
    if (ap.startsWith('a') && h === 12) h = 0
    return h + min / 60
  }
  const s = p(start), e = p(end)
  if (s == null || e == null) return null
  let d = e - s; if (d < 0) d += 24
  d -= (parseFloat(breakMin) || 0) / 60
  if (d < 0) d = 0
  return Math.round(d * 10) / 10
}

function DayCapture({ event, api, onCancel, onSaved, editDay }) {
  const canSetRate = !!api.canSetRate // coordinator only
  const [company, setCompany] = useState(editDay?.company || '')
  const [workDate, setWorkDate] = useState(editDay?.work_date || '')
  const [shift, setShift] = useState('') // '', 'Day', 'Night' — for events with different day/night crews
  const [rows, setRows] = useState(editDay?.rows ? editDay.rows.map(r => ({ ...r })) : [])
  const [imageUrls, setImageUrls] = useState(editDay?.image_urls || []) // original scan photos, kept with the day
  const [parsing, setParsing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const inp = { background: '#141414', border: '1px solid #333', borderRadius: 5, color: '#fff', padding: '5px 7px', fontSize: 13, width: '100%', boxSizing: 'border-box' }

  const addPhoto = async (file) => {
    if (!file) return
    setParsing(true); setError('')
    let base64
    try {
      // Compress hard so even a large phone/HEIC photo uploads reliably.
      const compressed = await imageCompression(file, { maxSizeMB: 0.9, maxWidthOrHeight: 2000, useWebWorker: true, fileType: 'image/jpeg', initialQuality: 0.8 })
      base64 = await new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = () => rej(new Error('read')); r.readAsDataURL(compressed) })
    } catch {
      setError("Couldn't read that photo. Try a clearer picture, or pick it from your gallery."); setParsing(false); return
    }
    try {
      const d = await api.parseImage(base64)
      if (d.company && !company) setCompany(d.company)
      if (d.date && !workDate) setWorkDate(d.date)
      setRows(prev => [...prev, ...(d.rows || [])])
      if (d.image_url) setImageUrls(prev => [...prev, d.image_url])
    } catch (e) {
      // Keep everything already entered — the user retries, they don't restart.
      setError('That scan didn\'t go through — tap the box to try the photo again. Your entries are saved.')
    }
    setParsing(false)
  }
  const setRow = (i, patch) => setRows(prev => prev.map((r, ri) => {
    if (ri !== i) return r
    const next = { ...r, ...patch }
    // Recompute worked hours when a time or the break changes (keeps hours honest).
    if ('start_time' in patch || 'end_time' in patch || 'break_minutes' in patch) {
      const net = computeNetHours(next.start_time, next.end_time, next.break_minutes)
      if (net != null) next.total_hours = net
    }
    return next
  }))
  const total = Math.round(rows.reduce((a, r) => a + (parseFloat(r.total_hours) || 0), 0) * 10) / 10

  const save = async () => {
    if (!rows.length) { setError('Add a photo or a row first.'); return }
    setSaving(true); setError('')
    try {
      // Day/Night: tag the entry so a date with different day vs night crews
      // becomes its own column on the master payroll (staff can change per shift).
      const label = editDay ? workDate : (shift ? `${workDate || 'Date'} — ${shift}` : workDate)
      const payload = { event_id: event.id, event_label: event.title, company, work_date: label, rows, image_urls: imageUrls }
      if (editDay?.id) payload.id = editDay.id
      await api.saveDay(payload)
      onSaved()
    } catch (e) { setError(e.message) }
    setSaving(false)
  }

  return (
    <div style={{ padding: 18 }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 }}>
        <div><label style={{ color: '#888', fontSize: 11 }}>Company</label><input style={inp} value={company} onChange={e => setCompany(e.target.value)} placeholder="e.g. Venue Smart" /></div>
        <div><label style={{ color: '#888', fontSize: 11 }}>Date</label><input style={inp} value={workDate} onChange={e => setWorkDate(e.target.value)} placeholder="e.g. July 24, 2026" /></div>
      </div>
      {!editDay && (
        <div style={{ marginBottom: 12 }}>
          <label style={{ color: '#888', fontSize: 11, display: 'block', marginBottom: 4 }}>Shift / crew (only if this date has more than one crew — each becomes its own column)</label>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 6 }}>
            {['', 'Day', 'Night', 'Night 1', 'Night 2', 'Day 1', 'Day 2'].map(s => (
              <button key={s || 'none'} type="button" onClick={() => setShift(s)}
                style={{ padding: '5px 12px', borderRadius: 6, fontSize: 12, cursor: 'pointer', border: '1px solid ' + (shift === s ? '#4ade80' : '#333'), background: shift === s ? '#4ade80' : 'transparent', color: shift === s ? '#000' : '#aaa', fontWeight: shift === s ? 700 : 400 }}>
                {s || 'Whole day'}
              </button>
            ))}
          </div>
          <input style={inp} value={shift} onChange={e => setShift(e.target.value)} placeholder="…or type a crew name (e.g. Night — Breakdown)" />
        </div>
      )}
      <label style={{ display: 'block', border: '2px dashed #333', borderRadius: 10, padding: 16, textAlign: 'center', color: parsing ? '#666' : '#9ecbff', cursor: parsing ? 'default' : 'pointer', fontSize: 13, marginBottom: 12 }}>
        <input type="file" accept="image/*" style={{ display: 'none' }} disabled={parsing} onChange={e => { const f = e.target.files?.[0]; e.target.value = ''; addPhoto(f) }} />
        {parsing ? 'Reading timesheet… (may take up to 30s)' : rows.length ? '+ Add another photo to this day' : "Take a photo or choose from gallery"}
      </label>
      <DayPhotos urls={imageUrls} />
      {rows.length > 0 && (
        <div style={{ overflowX: 'auto', marginBottom: 10 }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead><tr style={{ color: '#888', textAlign: 'left' }}>
              <th style={{ padding: 4 }}>Name</th>
              <th style={{ padding: 4, width: 78 }}>Start</th>
              <th style={{ padding: 4, width: 78 }}>End</th>
              <th style={{ padding: 4, width: 56 }}>Break<span style={{ color: '#555' }}> min</span></th>
              <th style={{ padding: 4, width: 48 }}>Hrs</th>
              {canSetRate && <th style={{ padding: 4, width: 52 }}>Rate</th>}
              {canSetRate && <th style={{ padding: 4, width: 62, textAlign: 'right' }}>Pay</th>}
              <th></th>
            </tr></thead>
            <tbody>
              {rows.map((r, i) => {
                const pay = (parseFloat(r.total_hours) || 0) * (parseFloat(r.pay_rate) || 0)
                return (
                <tr key={i} style={{ background: r.unclear ? 'rgba(250,204,21,.08)' : 'transparent' }}>
                  <td style={{ padding: 2 }}><input style={inp} value={r.name} onChange={e => setRow(i, { name: e.target.value })} /></td>
                  <td style={{ padding: 2 }}><input style={inp} value={r.start_time} onChange={e => setRow(i, { start_time: e.target.value })} /></td>
                  <td style={{ padding: 2 }}><input style={inp} value={r.end_time} onChange={e => setRow(i, { end_time: e.target.value })} /></td>
                  <td style={{ padding: 2 }}><input style={inp} value={r.break_minutes ?? ''} onChange={e => setRow(i, { break_minutes: e.target.value })} placeholder="0" /></td>
                  <td style={{ padding: 2 }}><input style={inp} value={r.total_hours} onChange={e => setRow(i, { total_hours: e.target.value })} /></td>
                  {canSetRate && <td style={{ padding: 2 }}><input style={inp} value={r.pay_rate ?? ''} onChange={e => setRow(i, { pay_rate: e.target.value })} placeholder="—" /></td>}
                  {canSetRate && <td style={{ padding: 2, textAlign: 'right', color: pay ? '#4ade80' : '#555' }}>{pay ? '$' + (Math.round(pay * 100) / 100) : '—'}</td>}
                  <td style={{ padding: 2 }}><button onClick={() => setRows(prev => prev.filter((_, ri) => ri !== i))} style={{ background: 'transparent', border: 'none', color: '#666', cursor: 'pointer' }}>×</button></td>
                </tr>
              )})}
            </tbody>
          </table>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}>
            <button type="button" onClick={() => setRows(prev => [...prev, { name: '', start_time: '', end_time: '', break_minutes: '', total_hours: '' }])} style={{ background: 'transparent', border: '1px dashed #333', color: '#888', borderRadius: 6, padding: '4px 10px', fontSize: 11, cursor: 'pointer' }}>+ Add worker</button>
            <div style={{ color: '#4ade80', fontSize: 12, fontWeight: 700 }}>
              {total} hrs{canSetRate && (() => { const p = rows.reduce((a, r) => a + (parseFloat(r.total_hours) || 0) * (parseFloat(r.pay_rate) || 0), 0); return p ? ` · $${Math.round(p * 100) / 100} pay` : '' })()}
            </div>
          </div>
        </div>
      )}
      {error && <div style={{ color: '#f87171', fontSize: 13, marginBottom: 10 }}>{error}</div>}
      <div style={{ display: 'flex', gap: 8 }}>
        <button onClick={save} disabled={saving || !rows.length} style={{ flex: 1, background: '#fff', color: '#000', border: 'none', borderRadius: 8, padding: 12, fontWeight: 700, fontSize: 14, cursor: 'pointer', opacity: (saving || !rows.length) ? 0.5 : 1 }}>{saving ? 'Saving…' : editDay ? 'Save changes' : 'Save this day'}</button>
        <button onClick={onCancel} style={{ background: 'transparent', border: '1px solid #333', color: '#888', borderRadius: 8, padding: '12px 16px', fontSize: 13, cursor: 'pointer' }}>Cancel</button>
      </div>
    </div>
  )
}

function SubmitView({ event, api, grand, dayCount, inp, onBack, onDone }) {
  const [signature, setSignature] = useState('')
  const [attested, setAttested] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  const submit = async () => {
    if (!signature.trim()) { setError('Type your name to sign off.'); return }
    if (!attested) { setError('Please check the accuracy box.'); return }
    setSubmitting(true); setError('')
    try { const r = await api.finalize(event.id, signature.trim()); onDone(r) } catch (e) { setError(e.message); setSubmitting(false) }
  }

  return (
    <div style={{ padding: 18 }}>
      <div style={{ color: '#fff', fontSize: 14, fontWeight: 700, marginBottom: 8 }}>Submit {dayCount} day{dayCount !== 1 ? 's' : ''} · {grand} total hours</div>
      <div style={{ background: '#2a1a0a', border: '1px solid #5a3a12', borderRadius: 8, padding: '10px 12px', color: '#f3b04e', fontSize: 12.5, marginBottom: 12 }}>
        Review all days before signing. By signing you confirm these hours are accurate. If the timesheet is incorrect, the discrepancy may be docked from pay.
      </div>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 10, flexWrap: 'wrap' }}>
        <label style={{ color: '#888', fontSize: 12 }}>Sign (type your name):</label>
        <input style={{ ...inp, width: 220, fontFamily: 'cursive' }} value={signature} onChange={e => setSignature(e.target.value)} placeholder="Your full name" />
      </div>
      <label style={{ display: 'flex', gap: 8, alignItems: 'flex-start', color: '#ccc', fontSize: 12.5, marginBottom: 14, cursor: 'pointer' }}>
        <input type="checkbox" checked={attested} onChange={e => setAttested(e.target.checked)} style={{ marginTop: 2 }} />
        I confirm I reviewed every day and the hours are accurate.
      </label>
      {error && <div style={{ color: '#f87171', fontSize: 13, marginBottom: 10 }}>{error}</div>}
      <div style={{ display: 'flex', gap: 8 }}>
        <button onClick={submit} disabled={submitting} style={{ flex: 1, background: '#fff', color: '#000', border: 'none', borderRadius: 8, padding: 13, fontWeight: 700, fontSize: 14, cursor: 'pointer', opacity: submitting ? 0.6 : 1 }}>{submitting ? 'Submitting…' : 'Sign & Send to Office'}</button>
        <button onClick={onBack} style={{ background: 'transparent', border: '1px solid #333', color: '#888', borderRadius: 8, padding: '13px 16px', fontSize: 13, cursor: 'pointer' }}>Back</button>
      </div>
    </div>
  )
}
