import { useState, useEffect } from 'react'
import { getToken, clearToken, fetchStats } from '../lib/adminApi.js'
import AdminLogin from '../components/admin/AdminLogin.jsx'
import VandaLogo from '../components/VandaLogo.jsx'
import ApplicantsPanel from '../components/admin/ApplicantsPanel.jsx'
import EventsPanel from '../components/admin/EventsPanel.jsx'
import AssignmentsPanel from '../components/admin/AssignmentsPanel.jsx'
import OperationsPanel from '../components/admin/OperationsPanel.jsx'
import SurveysPanel from '../components/admin/SurveysPanel.jsx'
import NotificationBell from '../components/admin/NotificationBell.jsx'
import IncidentsPanel from '../components/admin/IncidentsPanel.jsx'
import WorkerGroupsPanel from '../components/admin/WorkerGroupsPanel.jsx'

const TABS = [
  { key: 'workers', label: 'Workers' },
  { key: 'events', label: 'Events' },
  { key: 'assignments', label: 'Assignments' },
  { key: 'surveys', label: 'Surveys' },
  { key: 'incidents', label: 'Incidents' },
  { key: 'operations', label: 'Operations' },
]

export default function AdminPage() {
  const [authed, setAuthed] = useState(!!getToken())
  const [tab, setTab] = useState('workers')
  const [stats, setStats] = useState(null)

  useEffect(() => {
    if (!authed) return
    fetchStats().then(setStats).catch(() => {
      clearToken()
      setAuthed(false)
    })
  }, [authed, tab])

  if (!authed) {
    return <AdminLogin onLogin={() => setAuthed(true)} />
  }

  const handleLogout = () => {
    clearToken()
    setAuthed(false)
  }

  const fin = stats?.financials

  return (
    <div className="min-h-screen bg-[#0a0a0a] font-inter">
      {/* Header */}
      <div className="border-b border-p-border px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <VandaLogo size="sm" onClick={() => { window.history.pushState({}, '', '/'); window.dispatchEvent(new PopStateEvent('popstate')) }} />
          <span className="text-p-muted text-xs">Coordinator</span>
        </div>
        <div className="flex items-center gap-2">
          <NotificationBell onNavigate={({ tab }) => setTab(tab)} />
          <button onClick={handleLogout} className="text-p-muted text-xs hover:text-white transition-colors">
            Sign Out
          </button>
        </div>
      </div>

      {/* Stats Bar */}
      {stats && (
        <div className="px-4 py-3 border-b border-p-border flex gap-6 overflow-x-auto">
          <Stat label="Workers" value={stats.applicants?.total || 0} sub={`${stats.applicants?.by_status?.approved || 0} approved`} />
          <Stat label="Events" value={stats.events?.total || 0} sub={`${(stats.events?.by_status?.pending || 0) + (stats.events?.by_status?.staffing || 0)} need attention`} />
          <Stat label="Assignments" value={stats.assignments?.total || 0} sub={`${stats.assignments?.by_status?.confirmed || 0} confirmed`} />
          {fin && (
            <>
              <Stat label="Billed" value={`$${(fin.total_billed || 0).toLocaleString()}`} sub={`$${(fin.client_outstanding || 0).toLocaleString()} outstanding`} accent />
              <Stat label="Payouts" value={`$${(fin.total_payouts || 0).toLocaleString()}`} sub={`$${(fin.payouts_pending || 0).toLocaleString()} pending`} accent />
            </>
          )}
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
        {tab === 'workers' && <WorkerGroupsPanel />}
        {tab === 'workers' && <ApplicantsPanel />}
        {tab === 'events' && <EventsPanel />}
        {tab === 'assignments' && <AssignmentsPanel />}
        {tab === 'surveys' && <SurveysPanel />}
        {tab === 'incidents' && <IncidentsPanel />}
        {tab === 'operations' && <OperationsPanel stats={stats} />}
      </div>
    </div>
  )
}

function Stat({ label, value, sub, accent }) {
  return (
    <div className="flex-shrink-0">
      <div className={`text-lg font-bold ${accent ? 'text-p-green' : 'text-white'}`}>{value}</div>
      <div className="text-p-muted text-xs">{label}</div>
      {sub && <div className="text-p-muted text-[10px]">{sub}</div>}
    </div>
  )
}
