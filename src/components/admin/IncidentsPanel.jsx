import { useState, useEffect } from 'react'
import { fetchIncidents, updateIncident } from '../../lib/adminApi.js'

export default function IncidentsPanel() {
  const [incidents, setIncidents] = useState([])
  const [loading, setLoading] = useState(true)
  const [filterResolved, setFilterResolved] = useState('all')

  useEffect(() => {
    fetchIncidents()
      .then(setIncidents)
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  const filtered = filterResolved === 'all'
    ? incidents
    : filterResolved === 'open'
    ? incidents.filter(i => !i.resolved)
    : incidents.filter(i => i.resolved)

  const handleToggleResolved = async (incident) => {
    try {
      await updateIncident(incident.id, !incident.resolved)
      setIncidents(prev => prev.map(i => i.id === incident.id ? { ...i, resolved: !i.resolved } : i))
    } catch (err) {
      console.error('Failed to update incident:', err)
    }
  }

  const stats = {
    total: incidents.length,
    open: incidents.filter(i => !i.resolved).length,
    resolved: incidents.filter(i => i.resolved).length,
  }

  const TYPE_COLORS = {
    no_show: 'bg-red-500/20 text-red-400',
    late_arrival: 'bg-orange-500/20 text-orange-400',
    early_departure: 'bg-yellow-500/20 text-yellow-400',
    misconduct: 'bg-red-500/20 text-red-400',
    complaint: 'bg-purple-500/20 text-purple-400',
    injury: 'bg-red-500/20 text-red-400',
    other: 'bg-white/10 text-p-muted',
  }

  return (
    <div>
      {/* Stats */}
      {!loading && incidents.length > 0 && (
        <div className="flex gap-4 mb-3 overflow-x-auto pb-1">
          <MiniStat label="Total" value={stats.total} />
          <MiniStat label="Open" value={stats.open} color="text-red-400" />
          <MiniStat label="Resolved" value={stats.resolved} color="text-green-400" />
        </div>
      )}

      {/* Filter */}
      <div className="flex gap-2 mb-4">
        {['all', 'open', 'resolved'].map(f => (
          <button
            key={f}
            onClick={() => setFilterResolved(f)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-all ${
              filterResolved === f ? 'bg-p-green text-black' : 'bg-p-surface text-p-muted border border-p-border hover:border-p-muted'
            }`}
          >{f.charAt(0).toUpperCase() + f.slice(1)}</button>
        ))}
      </div>

      {loading ? (
        <div className="text-p-muted text-sm py-8 text-center">Loading...</div>
      ) : filtered.length === 0 ? (
        <div className="text-p-muted text-sm py-8 text-center">No incidents found</div>
      ) : (
        <div className="space-y-2">
          {filtered.map(inc => (
            <div key={inc.id} className="bg-p-surface border border-p-border rounded-lg px-4 py-3">
              <div className="flex items-center gap-2 mb-2">
                <span className={`px-2 py-0.5 rounded text-[10px] font-medium ${TYPE_COLORS[inc.incident_type] || TYPE_COLORS.other}`}>
                  {(inc.incident_type || 'unknown').replace(/_/g, ' ')}
                </span>
                <span className={`px-2 py-0.5 rounded text-[10px] font-medium ${inc.resolved ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
                  {inc.resolved ? 'Resolved' : 'Open'}
                </span>
                <span className="text-p-muted text-[10px] ml-auto">
                  {inc.created_at ? new Date(inc.created_at).toLocaleDateString() : ''}
                </span>
              </div>

              <div className="text-sm text-white mb-1">
                {inc.applicants ? `${inc.applicants.first_name} ${inc.applicants.last_name}` : 'Unknown worker'}
                {inc.events && <span className="text-p-muted"> — {inc.events.title}</span>}
              </div>

              {inc.description && (
                <p className="text-p-muted text-xs mb-2">{inc.description}</p>
              )}

              <button
                onClick={() => handleToggleResolved(inc)}
                className={`px-3 py-1 rounded-lg text-[10px] font-medium transition-colors ${
                  inc.resolved
                    ? 'text-white bg-p-border hover:bg-[#333]'
                    : 'text-white bg-green-600 hover:bg-green-700'
                }`}
              >
                {inc.resolved ? 'Reopen' : 'Mark Resolved'}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function MiniStat({ label, value, color = 'text-white' }) {
  return (
    <div className="flex-shrink-0">
      <span className={`text-sm font-bold ${color}`}>{value}</span>
      <span className="text-p-muted text-[10px] ml-1">{label}</span>
    </div>
  )
}
