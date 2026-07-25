import { useState, useEffect } from 'react'
import EventTimesheets from '../EventTimesheets.jsx'
import { fetchEvents, parseTimesheet, timesheetDays, saveTimesheetDay, deleteTimesheetDay, finalizeTimesheet } from '../../lib/adminApi.js'

const adminTsApi = {
  listDays: (eventId) => timesheetDays(eventId),
  parseImage: (base64) => parseTimesheet(base64),
  saveDay: (day) => saveTimesheetDay(day),
  deleteDay: (id) => deleteTimesheetDay(id),
  finalize: (eventId, signature) => finalizeTimesheet(eventId, signature),
}

export default function TimesheetsPanel() {
  const [events, setEvents] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [openEvent, setOpenEvent] = useState(null)

  useEffect(() => {
    fetchEvents().then(setEvents).catch(() => {}).finally(() => setLoading(false))
  }, [])

  const fmtDate = (d) => d ? new Date(d + 'T00:00:00').toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : 'No date'
  const q = search.trim().toLowerCase()
  const filtered = events.filter(e => !q || (e.title || '').toLowerCase().includes(q) || (e.city || '').toLowerCase().includes(q))

  return (
    <div>
      <div className="bg-p-surface border border-p-border rounded-lg p-5 mb-4">
        <h3 className="text-white text-sm font-semibold mb-1">Timesheets</h3>
        <p className="text-p-muted text-xs max-w-xl">
          Pick an event, then scan a timesheet for each day as it happens — days save to the event. When the event's over,
          sign &amp; submit and it's emailed to <span className="text-white">info@vassoc.com</span> as one Excel file
          (a sheet per day + summary).
        </p>
      </div>

      <input
        value={search}
        onChange={e => setSearch(e.target.value)}
        placeholder="Search events…"
        className="w-full bg-p-surface border border-p-border rounded-lg px-4 py-2 text-sm text-white placeholder:text-p-muted focus:outline-none focus:border-p-link mb-3"
      />

      {loading ? (
        <div className="text-p-muted text-sm py-8 text-center">Loading events…</div>
      ) : filtered.length === 0 ? (
        <div className="text-p-muted text-sm py-8 text-center">No events found.</div>
      ) : (
        <div className="space-y-2">
          {filtered.map(ev => (
            <div key={ev.id} className="flex items-center gap-3 bg-p-surface border border-p-border rounded-lg px-4 py-3">
              <div className="flex-1 min-w-0">
                <div className="text-white text-sm font-medium truncate">{ev.title}</div>
                <div className="text-p-muted text-xs">{fmtDate(ev.event_date)}{ev.city ? ` · ${ev.city}` : ''}</div>
              </div>
              <button onClick={() => setOpenEvent(ev)} className="px-3 py-1.5 rounded-lg bg-p-green text-black text-xs font-semibold hover:opacity-90 flex-shrink-0">Timesheets</button>
            </div>
          ))}
        </div>
      )}

      {openEvent && (
        <EventTimesheets event={{ id: openEvent.id, title: openEvent.title }} api={adminTsApi} onClose={() => setOpenEvent(null)} />
      )}
    </div>
  )
}
