import { useState, useEffect } from 'react'
import { fetchSupervisors, createSupervisor, updateSupervisor, deleteSupervisor } from '../../lib/adminApi.js'
import { SENDER_NUMBERS, formatSenderNumber } from '../../lib/senderNumbers.js'

export default function SupervisorsPanel() {
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [showAdd, setShowAdd] = useState(false)
  const [form, setForm] = useState({ name: '', number: '', email: '' })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [justCreated, setJustCreated] = useState(null)
  const [editing, setEditing] = useState(null)
  const [editForm, setEditForm] = useState({})

  const load = async () => {
    setLoading(true)
    try { setRows(await fetchSupervisors()) } catch (e) { setError(e.message) }
    setLoading(false)
  }
  useEffect(() => { load() }, [])

  const add = async () => {
    if (!form.name.trim() && !form.number.trim()) { setError('Enter a name or a number'); return }
    setSaving(true); setError('')
    try {
      const created = await createSupervisor(form.name.trim(), form.number || null, form.email || null)
      setRows(prev => [...prev, created])
      setJustCreated(created)
      setForm({ name: '', number: '', email: '' })
      setShowAdd(false)
    } catch (e) { setError(e.message) }
    setSaving(false)
  }

  const saveEdit = async (id) => {
    setSaving(true)
    try {
      const updated = await updateSupervisor(id, { name: editForm.name, number: editForm.number || null, email: editForm.email || null })
      setRows(prev => prev.map(r => r.id === id ? updated : r))
      setEditing(null)
    } catch (e) { alert('Save failed: ' + e.message) }
    setSaving(false)
  }

  const toggleActive = async (r) => {
    try {
      const updated = await updateSupervisor(r.id, { active: !r.active })
      setRows(prev => prev.map(x => x.id === r.id ? updated : x))
    } catch (e) { alert('Failed: ' + e.message) }
  }

  const remove = async (r) => {
    if (!confirm(`Remove supervisor ${r.name}? Their login will stop working immediately.`)) return
    try { await deleteSupervisor(r.id); setRows(prev => prev.filter(x => x.id !== r.id)) }
    catch (e) { alert('Delete failed: ' + e.message) }
  }

  const copy = (t) => { try { navigator.clipboard.writeText(t) } catch {} }

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <div>
          <h3 className="text-white text-sm font-semibold">Supervisors</h3>
          <p className="text-p-muted text-[11px]">Each supervisor logs in at /supervisor with their passcode and sees only events on their line.</p>
        </div>
        <button onClick={() => { setShowAdd(true); setError(''); setJustCreated(null) }} className="px-3 py-1.5 rounded-lg bg-p-green text-black text-xs font-semibold hover:opacity-90">+ Add Supervisor</button>
      </div>

      {justCreated && (
        <div className="mb-4 bg-green-500/10 border border-green-500/30 rounded-lg px-4 py-3">
          <div className="text-green-400 text-sm font-medium mb-1">{justCreated.name} added</div>
          <div className="text-p-muted text-xs">Give them this passcode to log in at <span className="text-white">/supervisor</span>:</div>
          <div className="flex items-center gap-2 mt-1">
            <code className="text-white text-sm bg-black/40 px-2 py-1 rounded">{justCreated.passcode}</code>
            <button onClick={() => copy(justCreated.passcode)} className="text-p-link text-xs hover:text-white">Copy</button>
          </div>
        </div>
      )}

      {showAdd && (
        <div className="mb-4 bg-p-surface border border-p-border rounded-lg p-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="text-p-muted text-[10px] block mb-1">Name <span className="text-p-muted/60">(or leave blank & use number)</span></label>
              <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} className="w-full bg-p-bg border border-p-border rounded px-2 py-1.5 text-xs text-white" placeholder="e.g. Marcus" />
            </div>
            <div>
              <label className="text-p-muted text-[10px] block mb-1">Number (their line)</label>
              <input value={form.number} onChange={e => setForm(f => ({ ...f, number: e.target.value }))} className="w-full bg-p-bg border border-p-border rounded px-2 py-1.5 text-xs text-white" placeholder="(470) 555-1234" />
              <div className="flex flex-wrap gap-1 mt-1.5">
                {SENDER_NUMBERS.map(s => {
                  const selected = form.number.replace(/\D/g, '') === s.number.replace(/\D/g, '')
                  return (
                    <button
                      key={s.number}
                      type="button"
                      onClick={() => setForm(f => ({ ...f, number: s.number }))}
                      className={`px-2 py-0.5 rounded text-[10px] border transition-colors ${selected ? 'bg-p-green text-black border-p-green' : 'bg-p-bg text-p-muted border-p-border hover:text-white hover:border-p-muted'}`}
                    >
                      {s.label} · {formatSenderNumber(s.number)}
                    </button>
                  )
                })}
              </div>
            </div>
            <div>
              <label className="text-p-muted text-[10px] block mb-1">Email</label>
              <input value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} className="w-full bg-p-bg border border-p-border rounded px-2 py-1.5 text-xs text-white" placeholder="optional" />
            </div>
          </div>
          {error && <div className="text-red-400 text-xs mt-2">{error}</div>}
          <div className="flex gap-2 mt-3">
            <button onClick={add} disabled={saving} className="px-3 py-1.5 rounded-lg bg-p-green text-black text-xs font-semibold disabled:opacity-50">{saving ? 'Adding…' : 'Add'}</button>
            <button onClick={() => { setShowAdd(false); setError('') }} className="text-p-muted text-xs hover:text-white px-2">Cancel</button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="text-p-muted text-sm py-8 text-center">Loading…</div>
      ) : rows.length === 0 ? (
        <div className="text-p-muted text-sm py-8 text-center">No supervisors yet. Add one to give them a scoped login.</div>
      ) : (
        <div className="space-y-2">
          {rows.map(r => (
            <div key={r.id} className={`bg-p-surface border border-p-border rounded-lg px-4 py-3 ${!r.active ? 'opacity-60' : ''}`}>
              {editing === r.id ? (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <input value={editForm.name} onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))} className="bg-p-bg border border-p-border rounded px-2 py-1 text-xs text-white" placeholder="Name" />
                  <input value={editForm.number || ''} onChange={e => setEditForm(f => ({ ...f, number: e.target.value }))} className="bg-p-bg border border-p-border rounded px-2 py-1 text-xs text-white" placeholder="Number / line" />
                  <input value={editForm.email || ''} onChange={e => setEditForm(f => ({ ...f, email: e.target.value }))} className="bg-p-bg border border-p-border rounded px-2 py-1 text-xs text-white" placeholder="Email" />
                  <div className="sm:col-span-3 flex gap-2">
                    <button onClick={() => saveEdit(r.id)} disabled={saving} className="px-3 py-1 rounded bg-p-green text-black text-xs font-semibold disabled:opacity-50">Save</button>
                    <button onClick={() => setEditing(null)} className="text-p-muted text-xs hover:text-white px-2">Cancel</button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-3 flex-wrap">
                  <div className="flex-1 min-w-0">
                    <div className="text-white text-sm font-medium">
                      {r.name}
                      {!r.active && <span className="ml-2 text-[10px] px-1.5 py-0.5 rounded bg-white/10 text-p-muted">disabled</span>}
                    </div>
                    <div className="text-p-muted text-xs">
                      {r.number ? formatSenderNumber(r.number) : 'no line'}{r.email ? ` · ${r.email}` : ''}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 text-xs">
                    <span className="text-p-muted">Passcode:</span>
                    <code className="text-white bg-black/40 px-2 py-0.5 rounded">{r.passcode}</code>
                    <button onClick={() => copy(r.passcode)} className="text-p-link hover:text-white">Copy</button>
                  </div>
                  <div className="flex items-center gap-3 text-xs">
                    <button onClick={() => { setEditing(r.id); setEditForm({ name: r.name, number: r.number || '', email: r.email || '' }) }} className="text-p-muted hover:text-white">Edit</button>
                    <button onClick={() => toggleActive(r)} className="text-p-muted hover:text-white">{r.active ? 'Disable' : 'Enable'}</button>
                    <button onClick={() => remove(r)} className="text-red-400 hover:text-red-300">Remove</button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
