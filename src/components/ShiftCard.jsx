export default function ShiftCard({ event, onClaim }) {
  const formatDate = (d) => {
    if (!d) return ''
    return new Date(d + 'T00:00:00').toLocaleDateString('en-US', {
      weekday: 'short', month: 'short', day: 'numeric',
    })
  }

  const formatTime = (t) => {
    if (!t) return ''
    const [h, m] = t.split(':')
    const hour = parseInt(h, 10)
    return `${hour % 12 || 12}:${m} ${hour >= 12 ? 'PM' : 'AM'}`
  }

  return (
    <div className="bg-p-surface border border-p-border rounded-xl p-5 flex flex-col gap-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-white font-semibold text-base leading-tight">{event.title}</h3>
          <p className="text-p-muted text-xs mt-1">{event.city}</p>
        </div>
        {event.pay_rate && (
          <span className="text-p-green font-semibold text-sm flex-shrink-0">{event.pay_rate}</span>
        )}
      </div>

      <div className="flex flex-wrap gap-3 text-xs text-p-muted">
        <span>📅 {formatDate(event.event_date)}</span>
        <span>🕐 {formatTime(event.start_time)} – {formatTime(event.end_time)}</span>
        <span>📍 {event.location}</span>
      </div>

      {event.role_types && event.role_types.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {event.role_types.map(role => (
            <span key={role} className="px-2 py-0.5 bg-p-border rounded-full text-[10px] text-p-muted">
              {role}
            </span>
          ))}
        </div>
      )}

      <button
        onClick={() => onClaim(event)}
        className="w-full bg-p-green text-black rounded-full py-2.5 text-sm font-semibold hover:opacity-90 transition-all duration-200"
      >
        Claim this shift →
      </button>
    </div>
  )
}
