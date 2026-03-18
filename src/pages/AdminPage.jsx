import { useState, useEffect } from 'react'
import { getToken, clearToken, fetchStats } from '../lib/adminApi.js'
import AdminLogin from '../components/admin/AdminLogin.jsx'
import ApplicantsPanel from '../components/admin/ApplicantsPanel.jsx'
import EventsPanel from '../components/admin/EventsPanel.jsx'
import AssignmentsPanel from '../components/admin/AssignmentsPanel.jsx'

const TABS = [
  { key: 'workers', label: 'Workers' },
  { key: 'events', label: 'Events' },
  { key: 'assignments', label: 'Assignments' },
]

export default function AdminPage() {
  const [authed, setAuthed] = useState(!!getToken())
  const [tab, setTab] = useState('workers')
  const [stats, setStats] = useState(null)

  useEffect(() => {
    if (!authed) return
    fetchStats().then(setStats).catch(() => {
      // Token might be stale
      clearToken()
      setAuthed(false)
    })
  }, [authed])

  if (!authed) {
    return <AdminLogin onLogin={() => setAuthed(true)} />
  }

  const handleLogout = () => {
    clearToken()
    setAuthed(false)
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a] font-inter">
      {/* Header */}
      <div className="border-b border-p-border px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <a href="/" className="text-white font-extrabold text-lg tracking-tight">Porter</a>
          <span className="text-p-muted text-xs">Coordinator</span>
        </div>
        <button onClick={handleLogout} className="text-p-muted text-xs hover:text-white transition-colors">
          Sign Out
        </button>
      </div>

      {/* Stats Bar */}
      {stats && (
        <div className="px-4 py-3 border-b border-p-border flex gap-6 overflow-x-auto">
          <Stat label="Workers" value={stats.applicants?.total || 0} sub={`${stats.applicants?.by_status?.approved || 0} approved`} />
          <Stat label="Events" value={stats.events?.total || 0} sub={`${stats.events?.by_status?.pending || 0} pending`} />
          <Stat label="Assignments" value={stats.assignments?.total || 0} sub={`${stats.assignments?.by_status?.confirmed || 0} confirmed`} />
        </div>
      )}

      {/* Tabs */}
      <div className="px-4 pt-3 flex gap-1 border-b border-p-border">
        {TABS.map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-4 py-2.5 text-sm font-medium transition-colors relative ${
              tab === t.key ? 'text-white' : 'text-p-muted hover:text-white'
            }`}
          >
            {t.label}
            {tab === t.key && (
              <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-p-green" />
            )}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="p-4 max-w-4xl mx-auto">
        {tab === 'workers' && <ApplicantsPanel />}
        {tab === 'events' && <EventsPanel />}
        {tab === 'assignments' && <AssignmentsPanel />}
      </div>
    </div>
  )
}

function Stat({ label, value, sub }) {
  return (
    <div className="flex-shrink-0">
      <div className="text-white text-lg font-bold">{value}</div>
      <div className="text-p-muted text-xs">{label}</div>
      {sub && <div className="text-p-muted text-[10px]">{sub}</div>}
    </div>
  )
}
