import { useState, useEffect } from 'react'
import { fetchAssignments, updateAssignment } from '../../lib/adminApi.js'

const ASSIGNMENT_COLORS = {
  invited: 'bg-yellow-500/20 text-yellow-400',
  confirmed: 'bg-green-500/20 text-green-400',
  declined: 'bg-red-500/20 text-red-400',
  checked_in: 'bg-blue-500/20 text-blue-400',
  completed: 'bg-green-500/20 text-green-400',
  cancelled: 'bg-red-500/20 text-red-400',
}

export default function AssignmentsPanel() {
  const [assignments, setAssignments] = useState([])
  const [loading, setLoading] = useState(true)

  const load = async () => {
    setLoading(true)
    try {
      const data = await fetchAssignments()
      setAssignments(data)
    } catch (err) {
      console.error('Failed to load assignments:', err)
    }
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const handleStatusChange = async (id, status) => {
    try {
      await updateAssignment(id, status)
      setAssignments(prev => prev.map(a => a.id === id ? { ...a, status } : a))
    } catch (err) {
      console.error('Failed to update:', err)
    }
  }

  const formatDate = (d) => {
    if (!d) return ''
    return new Date(d + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  }

  // Group by event
  const grouped = {}
  for (const a of assignments) {
    const key = a.event_id
    if (!grouped[key]) {
      grouped[key] = { event: a.events, assignments: [] }
    }
    grouped[key].assignments.push(a)
  }

  return (
    <div>
      {loading ? (
        <div className="text-p-muted text-sm py-8 text-center">Loading...</div>
      ) : assignments.length === 0 ? (
        <div className="text-p-muted text-sm py-8 text-center">No assignments yet. Assign workers from the Events tab.</div>
      ) : (
        <div className="space-y-4">
          {Object.entries(grouped).map(([eventId, { event, assignments: eventAssignments }]) => (
            <div key={eventId} className="bg-p-surface border border-p-border rounded-lg overflow-hidden">
              {/* Event Header */}
              <div className="px-4 py-3 border-b border-p-border">
                <div className="text-white text-sm font-medium">{event?.title || 'Unknown Event'}</div>
                <div className="text-p-muted text-xs">
                  {formatDate(event?.event_date)} · {event?.city} · {event?.status}
                </div>
              </div>

              {/* Workers */}
              <div className="divide-y divide-p-border">
                {eventAssignments.map(a => (
                  <div key={a.id} className="px-4 py-2.5 flex items-center gap-3">
                    {a.applicants?.photo_url ? (
                      <img src={a.applicants.photo_url} alt="" className="w-8 h-8 rounded-full object-cover flex-shrink-0" />
                    ) : (
                      <div className="w-8 h-8 rounded-full bg-p-border flex items-center justify-center flex-shrink-0">
                        <span className="text-p-muted text-xs">{a.applicants?.first_name?.[0]}{a.applicants?.last_name?.[0]}</span>
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="text-white text-xs font-medium truncate">
                        {a.applicants?.first_name} {a.applicants?.last_name}
                      </div>
                      <div className="text-p-muted text-[10px] truncate">{a.applicants?.city} · {a.applicants?.phone}</div>
                    </div>
                    <span className={`px-2 py-0.5 rounded text-[10px] font-medium ${ASSIGNMENT_COLORS[a.status] || 'bg-p-border text-p-muted'}`}>
                      {a.status?.replace(/_/g, ' ')}
                    </span>
                    <select
                      value={a.status}
                      onChange={(e) => handleStatusChange(a.id, e.target.value)}
                      className="bg-p-bg border border-p-border rounded px-2 py-1 text-[10px] text-white"
                    >
                      <option value="invited">invited</option>
                      <option value="confirmed">confirmed</option>
                      <option value="declined">declined</option>
                      <option value="checked_in">checked_in</option>
                      <option value="completed">completed</option>
                      <option value="cancelled">cancelled</option>
                    </select>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
