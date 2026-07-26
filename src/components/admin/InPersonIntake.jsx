import { useState } from 'react'
import imageCompression from 'browser-image-compression'
import { parseApplication, intakeApplicant } from '../../lib/adminApi.js'

// Default API = coordinator (admin). Supervisor dashboard passes its own.
const coordinatorApi = { parse: (b64) => parseApplication(b64), submit: (fields) => intakeApplicant(fields) }

const ROLES = [
  { value: 'janitorial', label: 'Janitorial' },
  { value: 'cleanup', label: 'Cleanup' },
  { value: 'setup_breakdown', label: 'Setup & Breakdown' },
  { value: 'brand_activation', label: 'Brand Activation' },
  { value: 'general_labor', label: 'General Labor' },
]
const AVAILABILITY = [
  { value: 'weekdays', label: 'Weekdays' },
  { value: 'weekends', label: 'Weekends' },
  { value: 'on_call', label: 'On-Call' },
]

export default function InPersonIntake({ onClose, onCreated, api = coordinatorApi }) {
  const [f, setF] = useState({ first_name: '', last_name: '', phone: '', email: '', city: '', zip: '', roles: [], availability: [], notes: '' })
  const [scanning, setScanning] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState(null)

  const set = (k) => (e) => setF(p => ({ ...p, [k]: e.target.value }))
  const toggle = (k, v) => setF(p => ({ ...p, [k]: p[k].includes(v) ? p[k].filter(x => x !== v) : [...p[k], v] }))

  const scan = async (file) => {
    if (!file) return
    setScanning(true); setError('')
    try {
      const c = await imageCompression(file, { maxSizeMB: 1.2, maxWidthOrHeight: 2200, useWebWorker: true, fileType: 'image/jpeg' })
      const base64 = await new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = rej; r.readAsDataURL(c) })
      const d = await api.parse(base64)
      setF(p => ({
        ...p,
        first_name: d.first_name || p.first_name,
        last_name: d.last_name || p.last_name,
        phone: d.phone || p.phone,
        email: d.email || p.email,
        city: d.city || p.city,
        zip: d.zip || p.zip,
        roles: d.roles?.length ? d.roles : p.roles,
        availability: d.availability?.length ? d.availability : p.availability,
        notes: d.notes || p.notes,
      }))
    } catch (e) { setError('Scan failed: ' + e.message) }
    setScanning(false)
  }

  const submit = async () => {
    if (!f.first_name.trim() || f.phone.replace(/\D/g, '').length < 10) { setError('First name and a valid phone are required.'); return }
    setSaving(true); setError('')
    try { const r = await api.submit(f); setResult(r); onCreated?.() }
    catch (e) { setError(e.message) }
    setSaving(false)
  }

  const inp = 'w-full bg-p-bg border border-p-border rounded px-2 py-1.5 text-sm text-white'
  const lbl = 'text-p-muted text-[10px] block mb-1'

  return (
    <div className="fixed inset-0 bg-black/60 flex items-start justify-center z-50 px-4 py-8 overflow-y-auto" onClick={onClose}>
      <div className="bg-p-surface border border-p-border rounded-xl w-full max-w-lg" onClick={e => e.stopPropagation()}>
        <div className="px-4 py-3 border-b border-p-border flex items-center justify-between">
          <h3 className="text-white font-semibold text-sm">Add applicant — in person</h3>
          <button onClick={onClose} className="text-p-muted hover:text-white text-lg">×</button>
        </div>

        {result ? (
          <div className="p-6 text-center">
            <div className="w-14 h-14 rounded-full bg-green-500/15 mx-auto mb-3 flex items-center justify-center">
              <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#4ade80" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
            </div>
            <div className="text-white font-semibold mb-1">{result.existed ? 'Applicant updated' : 'Applicant added'}</div>
            <div className="text-p-muted text-sm">
              ID + W-9 link {result.sms_sent ? 'texted' : ''}{result.sms_sent && result.email_sent ? ' & ' : ''}{result.email_sent ? 'emailed' : ''}
              {!result.sms_sent && !result.email_sent ? 'could not be sent (no phone/email delivery)' : ' to them.'}
            </div>
            <div className="mt-3 text-[11px] text-p-muted break-all">
              <div>ID: <span className="text-p-link">{result.id_url}</span></div>
              <div>W-9: <span className="text-p-link">{result.w9_url}</span></div>
            </div>
            <div className="flex gap-2 justify-center mt-5">
              <button onClick={() => { setResult(null); setF({ first_name: '', last_name: '', phone: '', email: '', city: '', zip: '', roles: [], availability: [], notes: '' }) }} className="px-4 py-2 rounded-lg bg-p-green text-black text-xs font-semibold">Add another</button>
              <button onClick={onClose} className="px-4 py-2 rounded-lg border border-p-border text-white text-xs">Done</button>
            </div>
          </div>
        ) : (
          <div className="p-4 space-y-3">
            {/* Scan a paper application */}
            <label className={`block border-2 border-dashed border-p-border rounded-lg py-3 text-center text-xs cursor-pointer ${scanning ? 'text-p-muted' : 'text-p-link'}`}>
              <input type="file" accept="image/*" capture="environment" className="hidden" disabled={scanning} onChange={e => { const file = e.target.files?.[0]; e.target.value = ''; scan(file) }} />
              {scanning ? 'Reading application…' : 'Scan a paper application (optional) — auto-fills below'}
            </label>

            <div className="grid grid-cols-2 gap-2">
              <div><label className={lbl}>First name *</label><input className={inp} value={f.first_name} onChange={set('first_name')} /></div>
              <div><label className={lbl}>Last name</label><input className={inp} value={f.last_name} onChange={set('last_name')} /></div>
              <div><label className={lbl}>Phone * (for their link)</label><input className={inp} value={f.phone} onChange={set('phone')} placeholder="(404) 555-1234" /></div>
              <div><label className={lbl}>Email</label><input className={inp} value={f.email} onChange={set('email')} /></div>
              <div><label className={lbl}>City</label><input className={inp} value={f.city} onChange={set('city')} /></div>
              <div><label className={lbl}>Zip</label><input className={inp} value={f.zip} onChange={set('zip')} /></div>
            </div>

            <div>
              <label className={lbl}>Roles</label>
              <div className="flex flex-wrap gap-1.5">
                {ROLES.map(r => (
                  <button key={r.value} type="button" onClick={() => toggle('roles', r.value)}
                    className={`px-2 py-1 rounded text-[11px] border ${f.roles.includes(r.value) ? 'bg-p-green text-black border-p-green' : 'bg-p-bg text-p-muted border-p-border'}`}>{r.label}</button>
                ))}
              </div>
            </div>
            <div>
              <label className={lbl}>Availability</label>
              <div className="flex flex-wrap gap-1.5">
                {AVAILABILITY.map(r => (
                  <button key={r.value} type="button" onClick={() => toggle('availability', r.value)}
                    className={`px-2 py-1 rounded text-[11px] border ${f.availability.includes(r.value) ? 'bg-p-green text-black border-p-green' : 'bg-p-bg text-p-muted border-p-border'}`}>{r.label}</button>
                ))}
              </div>
            </div>
            <div><label className={lbl}>Notes</label><input className={inp} value={f.notes} onChange={set('notes')} placeholder="Anything to remember" /></div>

            {error && <div className="text-red-400 text-xs">{error}</div>}
            <p className="text-p-muted text-[10px]">On save, we create the applicant and text{f.email ? ' + email' : ''} them their ID + W-9 upload links.</p>
            <button onClick={submit} disabled={saving} className="w-full bg-p-green text-black rounded-lg py-2.5 text-sm font-semibold disabled:opacity-50">
              {saving ? 'Saving…' : 'Add & send ID/W-9 link'}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
