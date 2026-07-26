import { useState, useEffect } from 'react'
import { fetchPayroll, updatePayrollLine, exportPayroll } from '../../lib/adminApi.js'

// Master payroll: pivots the scanned timesheets into a worker × date grid with
// hours, editable pay rate, auto payout, and a Paid toggle. Export → Excel to office.
export default function PayrollPanel({ event, onClose }) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [exporting, setExporting] = useState(false)

  const load = async () => {
    setLoading(true); setError('')
    try { setData(await fetchPayroll(event.id)) } catch (e) { setError(e.message) }
    setLoading(false)
  }
  useEffect(() => { load() /* eslint-disable-next-line */ }, [])

  const n = (v) => { const x = parseFloat(v); return Number.isFinite(x) ? x : 0 }
  const money = (v) => `$${(Math.round(n(v) * 100) / 100).toLocaleString(undefined, { minimumFractionDigits: 0 })}`

  const setRate = async (w, rate) => {
    setData(d => ({ ...d, workers: d.workers.map(x => x.id === w.id ? { ...x, pay_rate: rate === '' ? null : n(rate), payout: rate === '' ? null : Math.round(w.hours * n(rate) * 100) / 100 } : x) }))
  }
  const commitRate = async (w) => { try { await updatePayrollLine(w.id, { pay_rate: w.pay_rate }) } catch (e) { alert(e.message) } }
  const togglePaid = async (w) => {
    const paid = !w.paid
    setData(d => ({ ...d, workers: d.workers.map(x => x.id === w.id ? { ...x, paid } : x) }))
    try { await updatePayrollLine(w.id, { paid }) } catch (e) { alert(e.message); load() }
  }
  const doExport = async () => {
    setExporting(true)
    try { const r = await exportPayroll(event.id); alert(`Payroll emailed to the office — ${r.workers} workers, ${r.hours} hrs, ${money(r.total)} total.`) }
    catch (e) { alert('Export failed: ' + e.message) }
    setExporting(false)
  }

  const dates = data?.dates || []
  const workers = data?.workers || []
  const totHours = Math.round(workers.reduce((a, w) => a + n(w.hours), 0) * 10) / 10
  const totPayout = Math.round(workers.reduce((a, w) => a + n(w.payout), 0) * 100) / 100
  const unrated = workers.filter(w => w.pay_rate == null).length

  const cell = { padding: '4px 6px', fontSize: 12, borderBottom: '1px solid #1c1c1c', whiteSpace: 'nowrap' }
  const inp = { width: 52, background: '#141414', border: '1px solid #333', borderRadius: 4, color: '#fff', padding: '3px 5px', fontSize: 12 }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.7)', zIndex: 60, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: 12, overflowY: 'auto', fontFamily: 'system-ui, sans-serif' }} onClick={onClose}>
      <div style={{ background: '#0d0d0d', border: '1px solid #222', borderRadius: 14, width: '100%', maxWidth: 1000, margin: '16px 0' }} onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 18px', borderBottom: '1px solid #1e1e1e' }}>
          <div style={{ color: '#fff', fontWeight: 700 }}>Master Payroll — {event.title}</div>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: '#888', fontSize: 22, cursor: 'pointer' }}>×</button>
        </div>

        {loading ? (
          <p style={{ color: '#888', textAlign: 'center', padding: 30 }}>Building from timesheets…</p>
        ) : error ? (
          <p style={{ color: '#f87171', textAlign: 'center', padding: 30 }}>{error}</p>
        ) : workers.length === 0 ? (
          <p style={{ color: '#888', textAlign: 'center', padding: 30 }}>No timesheet data for this event yet. Scan &amp; submit timesheets first.</p>
        ) : (
          <div style={{ padding: 14 }}>
            <div style={{ color: '#888', fontSize: 12, marginBottom: 10 }}>
              {workers.length} workers · {totHours} hrs · <span style={{ color: '#4ade80', fontWeight: 700 }}>{money(totPayout)} payout</span>
              {unrated > 0 && <span style={{ color: '#f3b04e' }}> · {unrated} missing a pay rate</span>}
            </div>
            <div style={{ overflowX: 'auto', border: '1px solid #1c1c1c', borderRadius: 8 }}>
              <table style={{ borderCollapse: 'collapse', width: '100%' }}>
                <thead>
                  <tr style={{ color: '#888', textAlign: 'left', background: '#111' }}>
                    <th style={{ ...cell, position: 'sticky', left: 0, background: '#111' }}>Name</th>
                    {dates.map(d => <th key={d} style={{ ...cell, textAlign: 'right' }}>{d}</th>)}
                    <th style={{ ...cell, textAlign: 'right' }}>Hours</th>
                    <th style={{ ...cell, textAlign: 'right' }}>Rate</th>
                    <th style={{ ...cell, textAlign: 'right' }}>Payout</th>
                    <th style={{ ...cell, textAlign: 'center' }}>Paid</th>
                  </tr>
                </thead>
                <tbody>
                  {workers.map(w => (
                    <tr key={w.id} style={{ color: '#ddd', opacity: w.paid ? 0.6 : 1 }}>
                      <td style={{ ...cell, position: 'sticky', left: 0, background: '#0d0d0d', color: '#fff' }}>{w.name}</td>
                      {dates.map(d => <td key={d} style={{ ...cell, textAlign: 'right' }}>{w.byDate?.[d] || ''}</td>)}
                      <td style={{ ...cell, textAlign: 'right', color: '#fff' }}>{w.hours}</td>
                      <td style={{ ...cell, textAlign: 'right' }}>
                        <input style={inp} value={w.pay_rate ?? ''} onChange={e => setRate(w, e.target.value)} onBlur={() => commitRate(w)} placeholder="—" />
                      </td>
                      <td style={{ ...cell, textAlign: 'right', color: w.payout != null ? '#4ade80' : '#f3b04e' }}>{w.payout != null ? money(w.payout) : 'set rate'}</td>
                      <td style={{ ...cell, textAlign: 'center' }}><input type="checkbox" checked={!!w.paid} onChange={() => togglePaid(w)} /></td>
                    </tr>
                  ))}
                  <tr style={{ color: '#fff', fontWeight: 700, background: '#111' }}>
                    <td style={{ ...cell, position: 'sticky', left: 0, background: '#111' }}>TOTAL</td>
                    {dates.map(d => <td key={d} style={{ ...cell, textAlign: 'right' }}>{Math.round(workers.reduce((a, w) => a + n(w.byDate?.[d]), 0) * 10) / 10 || ''}</td>)}
                    <td style={{ ...cell, textAlign: 'right' }}>{totHours}</td>
                    <td style={cell}></td>
                    <td style={{ ...cell, textAlign: 'right', color: '#4ade80' }}>{money(totPayout)}</td>
                    <td style={cell}></td>
                  </tr>
                </tbody>
              </table>
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 14, alignItems: 'center' }}>
              <button onClick={doExport} disabled={exporting} style={{ background: '#fff', color: '#000', border: 'none', borderRadius: 8, padding: '10px 20px', fontWeight: 700, fontSize: 13, cursor: 'pointer', opacity: exporting ? 0.6 : 1 }}>
                {exporting ? 'Sending…' : 'Export & email to office'}
              </button>
              <span style={{ color: '#666', fontSize: 11 }}>Rates save per worker &amp; pre-fill next time · Paid is tracked here.</span>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
