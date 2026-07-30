import { useState, useEffect } from 'react'
import EventTimesheets from '../EventTimesheets.jsx'
import { fetchEvents, parseTimesheet, timesheetDays, timesheetBatches, renameTimesheetBatch, saveTimesheetDay, deleteTimesheetDay, finalizeTimesheet } from '../../lib/adminApi.js'

const adminTsApi = {
  listDays: (eventId) => timesheetDays(eventId),
  listSubmitted: (eventId) => timesheetDays(eventId, 'submitted'),
  parseImage: (base64) => parseTimesheet(base64),
  saveDay: (day) => saveTimesheetDay(day),
  deleteDay: (id) => deleteTimesheetDay(id),
  finalize: (eventId, signature) => finalizeTimesheet(eventId, signature),
}

export default function TimesheetsPanel() {
  const [events, setEvents] = useState([])
  const [batches, setBatches] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [open, setOpen] = useState(null) // { id, title }

  const load = () => {
    setLoading(true)
    Promise.all([
      fetchEvents().catch(() => []),
      timesheetBatches().then(r => r.batches || []).catch(() => []),
    ]).then(([evs, bs]) => { setEvents(evs); setBatches(bs) }).finally(() => setLoading(false))
  }
  useEffect(() => { load() }, [])

  const rename = async (b, e) => {
    e.stopPropagation()
    const name = window.prompt('Rename this timesheet:', b.title === 'Timesheet' || b.title === 'Untitled timesheet' ? '' : b.title)
    if (name == null || !name.trim()) return
    try {
      await renameTimesheetBatch(b.batch_id, name.trim())
      setBatches(prev => prev.map(x => x.batch_id === b.batch_id ? { ...x, title: name.trim() } : x))
    } catch (err) { alert('Rename failed: ' + err.message) }
  }

  const fmtDate = (d) => d ? new Date(d + 'T00:00:00').toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : 'No date'
  const q = search.trim().toLowerCase()
  const filteredEvents = events.filter(e => !q || (e.title || '').toLowerCase().includes(q) || (e.city || '').toLowerCase().includes(q))
  const filteredBatches = batches.filter(b => !q || (b.title || '').toLowerCase().includes(q) || (b.submitters || []).join(' ').toLowerCase().includes(q))

  return (
    <div>
      <div className="bg-p-surface border border-p-border rounded-lg p-5 mb-4">
        <h3 className="text-white text-sm font-semibold mb-1">Timesheets</h3>
        <p className="text-p-muted text-xs max-w-2xl">
          Everything uploaded — by you or by any supervisor — shows below, whether it was scanned under an event or as a
          standalone timesheet. Open one to review the days, or start a new timesheet from an event further down.
        </p>
      </div>

      <input
        value={search}
        onChange={e => setSearch(e.target.value)}
        placeholder="Search by job or supervisor…"
        className="w-full bg-p-surface border border-p-border rounded-lg px-4 py-2 text-sm text-white placeholder:text-p-muted focus:outline-none focus:border-p-link mb-4"
      />

      {loading ? (
        <div className="text-p-muted text-sm py-8 text-center">Loading…</div>
      ) : (
        <>
          {/* Uploaded timesheets — the thing the office actually looks for */}
          <div className="mb-6">
            <div className="text-p-muted text-[11px] font-semibold uppercase tracking-wider mb-2">Uploaded timesheets ({filteredBatches.length})</div>
            {filteredBatches.length === 0 ? (
              <div className="text-p-muted text-xs py-4">No timesheets uploaded yet.</div>
            ) : (
              <div className="space-y-2">
                {filteredBatches.map(b => (
                  <button
                    key={b.batch_id}
                    onClick={() => setOpen({ id: b.batch_id, title: b.title })}
                    className="w-full flex items-center gap-3 bg-p-surface border border-p-border rounded-lg px-4 py-3 text-left hover:border-p-muted transition-colors"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="text-white text-sm font-medium truncate">
                        {b.title}
                        {!b.linked_event && <span className="ml-2 text-[9px] px-1.5 py-0.5 rounded bg-purple-500/20 text-purple-300 align-middle">STANDALONE</span>}
                      </div>
                      <div className="text-p-muted text-xs truncate">
                        {b.workers} worker{b.workers !== 1 ? 's' : ''} · {b.days} day{b.days !== 1 ? 's' : ''} · {b.hours} hrs
                        {b.submitters?.length ? ` · by ${b.submitters.join(', ')}` : ''}
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      {b.draft > 0 && <span className="text-[10px] px-2 py-0.5 rounded bg-yellow-500/15 text-yellow-400">{b.draft} in progress</span>}
                      {b.submitted > 0 && <span className="text-[10px] px-2 py-0.5 rounded bg-green-500/15 text-green-400">{b.submitted} submitted</span>}
                      <span onClick={(e) => rename(b, e)} className="text-p-muted text-xs hover:text-white ml-1" title="Rename this timesheet">Rename</span>
                      <span className="text-p-link text-xs ml-1">Review →</span>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Start a new timesheet from an event */}
          <div>
            <div className="text-p-muted text-[11px] font-semibold uppercase tracking-wider mb-2">Start a timesheet from an event</div>
            {filteredEvents.length === 0 ? (
              <div className="text-p-muted text-xs py-4">No events found.</div>
            ) : (
              <div className="space-y-2">
                {filteredEvents.slice(0, 40).map(ev => (
                  <div key={ev.id} className="flex items-center gap-3 bg-p-surface border border-p-border rounded-lg px-4 py-3">
                    <div className="flex-1 min-w-0">
                      <div className="text-white text-sm font-medium truncate">{ev.title}</div>
                      <div className="text-p-muted text-xs">{fmtDate(ev.event_date)}{ev.city ? ` · ${ev.city}` : ''}</div>
                    </div>
                    <button onClick={() => setOpen({ id: ev.id, title: ev.title })} className="px-3 py-1.5 rounded-lg bg-p-green text-black text-xs font-semibold hover:opacity-90 flex-shrink-0">Timesheets</button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}

      {open && (
        <EventTimesheets event={open} api={adminTsApi} onClose={() => { setOpen(null); load() }} />
      )}
    </div>
  )
}
