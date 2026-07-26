import { useState, useEffect } from 'react'
import { fetchEventProfit, addExpense, deleteExpense, emailProfit } from '../../lib/adminApi.js'

// Coordinator-only per-event P&L. Actual hours come from the timesheets; the
// reviewed bill rate + pay are entered fresh (nothing relies on a stored rate);
// logged expenses (rentals/purchases) subtract automatically.
export default function ProfitPanel({ event, onClose }) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  // Fresh inputs (not stored). Revenue prefills from an approved quote if present.
  const [hours, setHours] = useState('')
  const [revenue, setRevenue] = useState('')
  const [payRate, setPayRate] = useState('')
  const [laborFlat, setLaborFlat] = useState('') // optional override of pay-rate×hours
  const [expDesc, setExpDesc] = useState('')
  const [expAmt, setExpAmt] = useState('')
  const [busy, setBusy] = useState(false)

  const load = async () => {
    setLoading(true); setError('')
    try {
      const d = await fetchEventProfit(event.id)
      setData(d)
      setHours(String(d.actual_hours || ''))
      if (d.quote_total != null && revenue === '') setRevenue(String(d.quote_total))
    } catch (e) { setError(e.message) }
    setLoading(false)
  }
  useEffect(() => { load() /* eslint-disable-next-line */ }, [])

  const n = (v) => { const x = parseFloat(v); return Number.isFinite(x) ? x : 0 }
  const money = (v) => `$${(Math.round(n(v) * 100) / 100).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

  const labor = laborFlat !== '' ? n(laborFlat) : n(payRate) * n(hours)
  const expenseTotal = data?.expense_total || 0
  const rev = n(revenue)
  const net = Math.round((rev - labor - expenseTotal) * 100) / 100
  const margin = rev > 0 ? Math.round((net / rev) * 1000) / 10 : null

  const add = async () => {
    if (!expAmt) return
    setBusy(true)
    try { await addExpense(event.id, expDesc.trim(), parseFloat(expAmt) || 0); setExpDesc(''); setExpAmt(''); await load() }
    catch (e) { alert(e.message) }
    setBusy(false)
  }
  const del = async (id) => { try { await deleteExpense(id); await load() } catch (e) { alert(e.message) } }

  const [emailing, setEmailing] = useState(false)
  const emailToOffice = async () => {
    setEmailing(true)
    try { const r = await emailProfit(event.id, rev, labor); alert(`P&L emailed to info@vassoc.com — Net ${money(r.net)}${r.margin != null ? ` (${r.margin}%)` : ''}.`) }
    catch (e) { alert('Email failed: ' + e.message) }
    setEmailing(false)
  }

  const inp = { background: '#141414', border: '1px solid #333', borderRadius: 5, color: '#fff', padding: '6px 8px', fontSize: 13, width: '100%', boxSizing: 'border-box' }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.7)', zIndex: 60, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: 16, overflowY: 'auto', fontFamily: 'system-ui, sans-serif' }} onClick={onClose}>
      <div style={{ background: '#0d0d0d', border: '1px solid #222', borderRadius: 14, width: '100%', maxWidth: 560, margin: '20px 0' }} onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 18px', borderBottom: '1px solid #1e1e1e' }}>
          <div style={{ color: '#fff', fontWeight: 700 }}>Profit — {event.title}</div>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: '#888', fontSize: 22, cursor: 'pointer' }}>×</button>
        </div>

        {loading ? (
          <p style={{ color: '#888', textAlign: 'center', padding: 30 }}>Loading…</p>
        ) : error ? (
          <p style={{ color: '#f87171', textAlign: 'center', padding: 30 }}>{error}</p>
        ) : (
          <div style={{ padding: 18 }}>
            <div style={{ color: '#777', fontSize: 12, marginBottom: 14 }}>
              Actual hours pulled from {data.timesheet_days} timesheet day{data.timesheet_days !== 1 ? 's' : ''} · {data.worker_count} worker{data.worker_count !== 1 ? 's' : ''}.
              {data.quote_total != null && <> Reviewed quote: <span style={{ color: '#ccc' }}>{money(data.quote_total)}</span> ({data.quote_status}).</>}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 14 }}>
              <div><label style={{ color: '#888', fontSize: 11 }}>Hours worked</label><input style={inp} value={hours} onChange={e => setHours(e.target.value)} /></div>
              <div><label style={{ color: '#888', fontSize: 11 }}>Revenue (what client pays)</label><input style={inp} value={revenue} onChange={e => setRevenue(e.target.value)} placeholder="from reviewed quote" /></div>
              <div><label style={{ color: '#888', fontSize: 11 }}>Pay rate ($/hr)</label><input style={inp} value={payRate} onChange={e => setPayRate(e.target.value)} placeholder="what workers get" /></div>
              <div><label style={{ color: '#888', fontSize: 11 }}>…or flat labor cost</label><input style={inp} value={laborFlat} onChange={e => setLaborFlat(e.target.value)} placeholder="overrides rate×hours" /></div>
            </div>

            {/* Expenses */}
            <div style={{ border: '1px solid #222', borderRadius: 10, padding: 12, marginBottom: 14 }}>
              <div style={{ color: '#aaa', fontSize: 12, fontWeight: 700, marginBottom: 8 }}>Expenses (rentals, purchases, etc.)</div>
              {(data.expenses || []).length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 5, marginBottom: 8 }}>
                  {data.expenses.map(x => (
                    <div key={x.id} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
                      <span style={{ flex: 1, color: '#ddd' }}>{x.description || '(no description)'}</span>
                      <span style={{ color: '#fff' }}>{money(x.amount)}</span>
                      <button onClick={() => del(x.id)} style={{ background: 'transparent', border: 'none', color: '#666', cursor: 'pointer' }}>×</button>
                    </div>
                  ))}
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#f3b04e', borderTop: '1px solid #222', paddingTop: 5 }}><span>Total expenses</span><span>{money(expenseTotal)}</span></div>
                </div>
              )}
              <div style={{ display: 'flex', gap: 6 }}>
                <input style={{ ...inp, flex: 1 }} value={expDesc} onChange={e => setExpDesc(e.target.value)} placeholder="e.g. tent rental" />
                <input style={{ ...inp, width: 90 }} value={expAmt} onChange={e => setExpAmt(e.target.value)} placeholder="$" />
                <button onClick={add} disabled={busy || !expAmt} style={{ background: '#fff', color: '#000', border: 'none', borderRadius: 6, padding: '6px 12px', fontWeight: 700, fontSize: 12, cursor: 'pointer', opacity: (busy || !expAmt) ? 0.5 : 1 }}>Add</button>
              </div>
            </div>

            {/* Result */}
            <div style={{ background: '#0e1a12', border: '1px solid #1c3a26', borderRadius: 10, padding: 14 }}>
              <Row label="Revenue" value={money(rev)} />
              <Row label="− Labor" value={money(labor)} sub={laborFlat === '' && payRate ? `${money(payRate)}/hr × ${n(hours)} hrs` : null} />
              <Row label="− Expenses" value={money(expenseTotal)} />
              <div style={{ borderTop: '1px solid #1c3a26', margin: '8px 0' }} />
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                <span style={{ color: '#fff', fontWeight: 800, fontSize: 16 }}>Net</span>
                <span style={{ color: net >= 0 ? '#4ade80' : '#f87171', fontWeight: 800, fontSize: 20 }}>{money(net)}</span>
              </div>
              {margin != null && <div style={{ textAlign: 'right', color: '#8fbf9e', fontSize: 12, marginTop: 2 }}>{margin}% margin</div>}
            </div>
            <button onClick={emailToOffice} disabled={emailing || rev <= 0} style={{ width: '100%', marginTop: 12, background: '#fff', color: '#000', border: 'none', borderRadius: 8, padding: 12, fontWeight: 700, fontSize: 14, cursor: 'pointer', opacity: (emailing || rev <= 0) ? 0.5 : 1 }}>
              {emailing ? 'Sending…' : 'Email P&L to office (info@vassoc.com)'}
            </button>
            <p style={{ color: '#666', fontSize: 11, marginTop: 10 }}>Rates are entered fresh here — not pulled from a stored bill rate. Expenses save to this event. The P&L Excel goes to the office so the net travels with the file in Teams.</p>
          </div>
        )}
      </div>
    </div>
  )
}

function Row({ label, value, sub }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', padding: '2px 0' }}>
      <span style={{ color: '#aaa', fontSize: 13 }}>{label}{sub && <span style={{ color: '#666', fontSize: 11 }}> ({sub})</span>}</span>
      <span style={{ color: '#fff', fontSize: 14 }}>{value}</span>
    </div>
  )
}
