import { useEffect, useState } from 'react'

const IconCalendar = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="5" width="18" height="16" rx="2" />
    <path d="M3 9h18" />
    <path d="M8 3v4M16 3v4" />
  </svg>
)

const IconPin = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 22s7-7.58 7-13a7 7 0 1 0-14 0c0 5.42 7 13 7 13z" />
    <circle cx="12" cy="9" r="2.5" />
  </svg>
)

const IconArrow = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M5 12h14M13 5l7 7-7 7" />
  </svg>
)

const MONTH_SHORT = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']

function parseLocalDate(yyyyMmDd) {
  if (!yyyyMmDd) return null
  const [y, m, d] = yyyyMmDd.split('-').map(Number)
  return new Date(y, m - 1, d)
}

function formatRange(start, end) {
  const s = parseLocalDate(start)
  if (!s) return ''
  const e = end ? parseLocalDate(end) : null
  if (!e || end === start) {
    return `${MONTH_SHORT[s.getMonth()]} ${s.getDate()}, ${s.getFullYear()}`
  }
  if (s.getMonth() === e.getMonth() && s.getFullYear() === e.getFullYear()) {
    return `${MONTH_SHORT[s.getMonth()]} ${s.getDate()}–${e.getDate()}, ${s.getFullYear()}`
  }
  return `${MONTH_SHORT[s.getMonth()]} ${s.getDate()} – ${MONTH_SHORT[e.getMonth()]} ${e.getDate()}, ${e.getFullYear()}`
}

export default function UpcomingEventsBlock() {
  const [events, setEvents] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let alive = true
    fetch('/api/submit?upcoming=1')
      .then(r => r.ok ? r.json() : [])
      .then(data => { if (alive) setEvents(Array.isArray(data) ? data : []) })
      .catch(() => { if (alive) setEvents([]) })
      .finally(() => { if (alive) setLoading(false) })
    return () => { alive = false }
  }, [])

  if (loading) return null

  return (
    <section className="px-6 pt-6 pb-2 max-w-5xl mx-auto w-full">
      <div className="flex items-center gap-2 mb-3">
        <span className="text-p-green"><IconCalendar /></span>
        <span className="text-[#bbb] text-xs tracking-widest uppercase font-semibold">
          {events.length > 0 ? 'Upcoming events — tap to join the crew' : 'Join the crew'}
        </span>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {events.slice(0, 2).map(ev => (
          <a
            key={ev.id}
            href={`/join/${ev.code}`}
            className="group relative block rounded-2xl border border-[#1e1e1e] bg-[#0e0e0e] p-4 hover:border-p-green/60 hover:bg-[#111] transition-all duration-200 overflow-hidden"
          >
            <div className="absolute top-0 right-0 w-24 h-24 rounded-full bg-p-green/5 blur-2xl pointer-events-none" />
            <div className="relative">
              <div className="flex items-baseline justify-between gap-3 mb-2">
                <span className="text-p-green text-[11px] tracking-widest uppercase font-bold">
                  {ev.evergreen || !ev.event_date ? 'Always hiring' : formatRange(ev.event_date, ev.event_end_date)}
                </span>
              </div>
              <h3 className="font-inter text-white font-bold text-lg leading-tight mb-2 group-hover:text-p-green transition-colors">
                {ev.name}
              </h3>
              {(ev.event_location || ev.event_city) && (
                <div className="flex items-center gap-1.5 text-[#888] text-xs">
                  <IconPin />
                  <span className="truncate">
                    {[ev.event_location, ev.event_city].filter(Boolean).join(' · ')}
                  </span>
                </div>
              )}
              <div className="mt-3 flex items-center gap-1.5 text-white text-xs font-semibold">
                <span>Join this crew</span>
                <span className="transition-transform group-hover:translate-x-0.5"><IconArrow /></span>
              </div>
            </div>
          </a>
        ))}

        {/* Always-present ongoing hiring card */}
        <a
          href="/hiring"
          className="group relative block rounded-2xl border border-p-green/40 bg-[#0e0e0e] p-4 hover:border-p-green hover:bg-[#111] transition-all duration-200 overflow-hidden"
        >
          <div className="absolute top-0 right-0 w-24 h-24 rounded-full bg-p-green/10 blur-2xl pointer-events-none" />
          <div className="relative">
            <div className="flex items-baseline justify-between gap-3 mb-2">
              <span className="text-p-green text-[11px] tracking-widest uppercase font-bold">Always hiring</span>
            </div>
            <h3 className="font-inter text-white font-bold text-lg leading-tight mb-2 group-hover:text-p-green transition-colors">
              We're always hiring
            </h3>
            <div className="text-[#888] text-xs">Ongoing event-staff roles across metro Atlanta — apply once, get matched to shifts.</div>
            <div className="mt-3 flex items-center gap-1.5 text-white text-xs font-semibold">
              <span>View open roles</span>
              <span className="transition-transform group-hover:translate-x-0.5"><IconArrow /></span>
            </div>
          </div>
        </a>
      </div>
    </section>
  )
}
