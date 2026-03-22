import { useState, useEffect, useRef } from 'react'
import { fetchNotifications } from '../../lib/adminApi.js'

const TYPE_ICONS = {
  worker_application: '👤',
  shift_accepted: '✓',
  shift_declined: '✗',
  needs_staffing: '⚠',
  upcoming_event: '📅',
  payment_outstanding: '$',
}

const TYPE_COLORS = {
  worker_application: 'text-blue-400',
  shift_accepted: 'text-green-400',
  shift_declined: 'text-red-400',
  needs_staffing: 'text-orange-400',
  upcoming_event: 'text-yellow-400',
  payment_outstanding: 'text-purple-400',
}

function timeAgo(dateStr) {
  if (!dateStr) return ''
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  return `${days}d ago`
}

export default function NotificationBell({ onNavigate }) {
  const [open, setOpen] = useState(false)
  const [notifications, setNotifications] = useState([])
  const [count, setCount] = useState(0)
  const [loading, setLoading] = useState(false)
  const [dismissed, setDismissed] = useState(() => {
    try { return JSON.parse(localStorage.getItem('vanda_dismissed_notifs') || '[]') } catch { return [] }
  })
  const ref = useRef(null)

  const load = async () => {
    setLoading(true)
    try {
      const data = await fetchNotifications()
      setNotifications(data.notifications || [])
      const active = (data.notifications || []).filter(n => !dismissed.includes(n.id))
      setCount(active.length)
    } catch {}
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  // Refresh every 60s
  useEffect(() => {
    const id = setInterval(load, 60000)
    return () => clearInterval(id)
  }, [dismissed])

  // Close on outside click
  useEffect(() => {
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false)
    }
    if (open) document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  const handleDismiss = (id) => {
    const updated = [...dismissed, id]
    setDismissed(updated)
    localStorage.setItem('vanda_dismissed_notifs', JSON.stringify(updated))
    setCount(prev => Math.max(0, prev - 1))
  }

  const handleClearAll = () => {
    const allIds = notifications.map(n => n.id)
    setDismissed(allIds)
    localStorage.setItem('vanda_dismissed_notifs', JSON.stringify(allIds))
    setCount(0)
  }

  const handleClick = (notif) => {
    handleDismiss(notif.id)
    setOpen(false)
    if (notif.action && onNavigate) {
      onNavigate(notif.action)
    }
  }

  const activeNotifs = notifications.filter(n => !dismissed.includes(n.id))

  return (
    <div className="relative" ref={ref}>
      {/* Bell button */}
      <button
        onClick={() => { setOpen(!open); if (!open) load() }}
        className="relative p-2 text-[#888] hover:text-white transition-colors"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.73 21a2 2 0 0 1-3.46 0" />
        </svg>
        {count > 0 && (
          <span className="absolute -top-0.5 -right-0.5 bg-red-500 text-white text-[9px] font-bold rounded-full min-w-[16px] h-4 flex items-center justify-center px-1">
            {count > 99 ? '99+' : count}
          </span>
        )}
      </button>

      {/* Dropdown */}
      {open && (
        <div className="absolute right-0 top-full mt-2 w-80 bg-[#111] border border-[#2a2a2a] rounded-xl shadow-2xl z-50 overflow-hidden">
          {/* Header */}
          <div className="px-4 py-3 border-b border-[#2a2a2a] flex items-center justify-between">
            <span className="text-white text-sm font-semibold">Notifications</span>
            {activeNotifs.length > 0 && (
              <button onClick={handleClearAll} className="text-[#666] text-[10px] hover:text-white transition-colors">
                Clear all
              </button>
            )}
          </div>

          {/* List */}
          <div className="max-h-96 overflow-y-auto">
            {loading && notifications.length === 0 ? (
              <div className="px-4 py-8 text-center text-[#666] text-sm">Loading...</div>
            ) : activeNotifs.length === 0 ? (
              <div className="px-4 py-8 text-center text-[#666] text-sm">All caught up</div>
            ) : (
              activeNotifs.map(notif => (
                <div
                  key={notif.id}
                  className="px-4 py-3 border-b border-[#1a1a1a] hover:bg-[#1a1a1a] cursor-pointer transition-colors flex gap-3 items-start"
                  onClick={() => handleClick(notif)}
                >
                  <span className={`text-sm mt-0.5 w-5 text-center flex-shrink-0 ${TYPE_COLORS[notif.type] || 'text-[#888]'}`}>
                    {TYPE_ICONS[notif.type] || '•'}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className={`text-xs font-medium truncate ${notif.priority ? 'text-orange-400' : 'text-white'}`}>
                      {notif.title}
                    </p>
                    <p className="text-[#888] text-[10px] mt-0.5">{notif.subtitle}</p>
                    {notif.time && (
                      <p className="text-[#555] text-[9px] mt-1">{timeAgo(notif.time)}</p>
                    )}
                  </div>
                  <button
                    onClick={(e) => { e.stopPropagation(); handleDismiss(notif.id) }}
                    className="text-[#555] hover:text-white text-xs flex-shrink-0 mt-0.5"
                  >
                    ×
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}
