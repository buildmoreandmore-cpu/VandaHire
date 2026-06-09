import { useState, useEffect } from 'react'
import { fetchMessageTemplates, createMessageTemplate, deleteMessageTemplate } from '../../lib/adminApi.js'

// Reusable template control for message composers.
// Props:
//   current: { channel, subject, body } — used when saving a new template
//   onApply: (template) => void — load a template into the composer
export default function MessageTemplates({ current, onApply }) {
  const [open, setOpen] = useState(false)
  const [templates, setTemplates] = useState([])
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)

  const load = async () => {
    setLoading(true)
    try { setTemplates(await fetchMessageTemplates()) } catch (e) { console.error(e) }
    setLoading(false)
  }
  useEffect(() => { if (open && templates.length === 0) load() }, [open])

  const saveCurrent = async () => {
    if (!current?.body?.trim()) { alert('Write a message first, then save it as a template.'); return }
    const name = window.prompt('Template name:')
    if (!name || !name.trim()) return
    setSaving(true)
    try {
      const t = await createMessageTemplate({ name: name.trim(), channel: current.channel || 'both', subject: current.subject || '', body: current.body })
      setTemplates(prev => [t, ...prev])
    } catch (e) { alert('Save failed: ' + e.message) }
    setSaving(false)
  }

  const remove = async (id, e) => {
    e.stopPropagation()
    try { await deleteMessageTemplate(id); setTemplates(prev => prev.filter(t => t.id !== id)) }
    catch (err) { alert('Delete failed: ' + err.message) }
  }

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="inline-flex items-center gap-1 text-[11px] text-p-link hover:text-white transition-colors"
      >
        <svg width="11" height="11" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="2.5" y="2.5" width="11" height="11" rx="1.5" /><path d="M5 6h6M5 9h4" /></svg>
        Templates {open ? '▾' : '▸'}
      </button>
      <button type="button" onClick={saveCurrent} disabled={saving} className="text-[11px] text-p-muted hover:text-white transition-colors disabled:opacity-50">
        {saving ? 'Saving…' : '+ Save current'}
      </button>

      {open && (
        <div className="absolute left-0 right-0 top-full mt-1 z-10 bg-p-bg border border-p-border rounded-lg shadow-lg max-h-52 overflow-y-auto">
          {loading ? (
            <p className="text-p-muted text-[11px] px-3 py-2">Loading…</p>
          ) : templates.length === 0 ? (
            <p className="text-p-muted text-[11px] px-3 py-2">No templates yet. Write a message and tap “+ Save current”.</p>
          ) : (
            templates.map(t => (
              <div key={t.id} className="flex items-center gap-2 px-3 py-1.5 hover:bg-white/[0.04] cursor-pointer" onClick={() => { onApply(t); setOpen(false) }}>
                <div className="flex-1 min-w-0">
                  <div className="text-white text-xs truncate">{t.name}</div>
                  <div className="text-p-muted text-[10px] truncate">{t.channel} · {t.body}</div>
                </div>
                <button onClick={(e) => remove(t.id, e)} className="text-red-400 hover:text-red-300 text-xs flex-shrink-0">×</button>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  )
}
