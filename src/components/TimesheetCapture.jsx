import { useState } from 'react'
import imageCompression from 'browser-image-compression'

// Shared timesheet capture flow used by both the supervisor dashboard and the
// coordinator dashboard. Photo -> parse (Claude Vision) -> editable review ->
// dock-pay warning + sign-off -> submit (generates Excel + emails the office).
//
// Props:
//   title           heading text
//   initialCompany  prefill company
//   initialEvent    prefill event name
//   parseImage      async (base64) => parsed { company, event, date, rows[] }
//   submitTimesheet async (payload) => { ok, totals, filename }
//   onClose         () => void
export default function TimesheetCapture({ title, initialCompany = '', initialEvent = '', parseImage, submitTimesheet, onClose }) {
  const [company, setCompany] = useState(initialCompany)
  const [eventName, setEventName] = useState(initialEvent)
  const [days, setDays] = useState([])
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
      const d = await parseImage(base64)
      if (d.company && !company) setCompany(d.company)
      if (d.event && (!eventName || eventName === initialEvent)) setEventName(d.event)
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
      const d = await submitTimesheet({ company, event: eventName, associate_signature: signature.trim(), days: days.map(dd => ({ date: dd.date, rows: dd.rows })) })
      setResult(d)
    } catch (e) { setError(e.message) }
    setSubmitting(false)
  }

  const inp = { background: '#141414', border: '1px solid #333', borderRadius: 5, color: '#fff', padding: '5px 7px', fontSize: 13, width: '100%', boxSizing: 'border-box' }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.7)', zIndex: 60, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: 16, overflowY: 'auto', fontFamily: 'system-ui, sans-serif' }} onClick={onClose}>
      <div style={{ background: '#0d0d0d', border: '1px solid #222', borderRadius: 14, width: '100%', maxWidth: 720, margin: '20px 0' }} onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 18px', borderBottom: '1px solid #1e1e1e' }}>
          <div style={{ color: '#fff', fontWeight: 700 }}>{title || 'Timesheet'}</div>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: '#888', fontSize: 22, cursor: 'pointer' }}>×</button>
        </div>

        {result ? (
          <div style={{ padding: 30, textAlign: 'center' }}>
            <div style={{ width: 56, height: 56, borderRadius: '50%', background: '#16351f', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#4ade80" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
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
                  Review carefully. By signing, you confirm these hours are accurate. If the timesheet is incorrect, the discrepancy may be docked from pay.
                </div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 10, flexWrap: 'wrap' }}>
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
