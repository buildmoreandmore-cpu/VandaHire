import { useState } from 'react'
import { useNavigate } from '../Router.jsx'
import Footer from '../components/Footer.jsx'

const STATUS_STYLES = {
  pending:   { label: 'Pending',   color: 'text-yellow-400', bg: 'bg-yellow-400/10 border-yellow-400/30' },
  approved:  { label: 'Approved',  color: 'text-blue-400',   bg: 'bg-blue-400/10 border-blue-400/30' },
  staffing:  { label: 'Staffing',  color: 'text-purple-400', bg: 'bg-purple-400/10 border-purple-400/30' },
  confirmed: { label: 'Confirmed', color: 'text-[#c8ff00]',  bg: 'bg-[#c8ff00]/10 border-[#c8ff00]/30' },
  completed: { label: 'Completed', color: 'text-[#888]',     bg: 'bg-white/5 border-white/10' },
  cancelled: { label: 'Cancelled', color: 'text-red-400',    bg: 'bg-red-400/10 border-red-400/30' },
}

function StatusBadge({ status }) {
  const s = STATUS_STYLES[status] || { label: status, color: 'text-white', bg: 'border-[#2a2a2a]' }
  return (
    <span className={`text-xs font-semibold px-3 py-1 rounded-full border ${s.color} ${s.bg}`}>
      {s.label}
    </span>
  )
}

export default function OrganizerPortalPage() {
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [results, setResults] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setResults(null)
    if (!email.includes('@')) {
      setError('Please enter a valid email address.')
      return
    }
    setLoading(true)
    try {
      const res = await fetch(`/api/organizer/status?email=${encodeURIComponent(email.trim())}`)
      const data = await res.json()
      setResults(data)
    } catch {
      setError('Something went wrong. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const formatDate = (dateStr) => {
    if (!dateStr) return '—'
    const d = new Date(dateStr)
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white flex flex-col">
      {/* Nav */}
      <div className="px-6 pt-8 flex items-center justify-between max-w-3xl mx-auto w-full">
        <button onClick={() => navigate('/')} className="text-white font-extrabold text-2xl tracking-tight">Vanda</button>
        <a href="/admin" className="text-[#777] text-sm hover:text-white transition-colors">Coordinator Login</a>
      </div>

      {/* Content */}
      <div className="flex-1 px-6 py-16 max-w-3xl mx-auto w-full">
        <h1 className="text-4xl font-extrabold tracking-tighter mb-2">Organizer Portal</h1>
        <p className="text-[#888] mb-10">Enter the email you used when requesting staff to see your event status.</p>

        <form onSubmit={handleSubmit} className="space-y-4 max-w-sm">
          <div>
            <label className="block text-sm text-[#777] mb-2">Email Address</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@company.com"
              className="w-full bg-[#111] border border-[#2a2a2a] rounded-xl px-4 py-3 text-white placeholder-[#555] focus:outline-none focus:border-[#c8ff00] transition-colors"
            />
          </div>

          {error && <p className="text-red-400 text-sm">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="bg-[#c8ff00] text-black rounded-full py-3 px-8 font-semibold hover:opacity-90 transition-all duration-200 disabled:opacity-50"
          >
            {loading ? 'Looking up…' : 'View My Requests →'}
          </button>
        </form>

        {results && (
          <div className="mt-10">
            {results.events && results.events.length > 0 ? (
              <div className="space-y-4">
                <p className="text-[#555] text-sm">{results.events.length} request{results.events.length !== 1 ? 's' : ''} found</p>
                {results.events.map((ev) => (
                  <div key={ev.id} className="border border-[#2a2a2a] rounded-2xl p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                      <div className="font-bold text-white text-lg">{ev.event_title || ev.title || 'Untitled Event'}</div>
                      <div className="text-[#666] text-sm mt-1">
                        {formatDate(ev.event_date)} · {ev.city || ''}
                      </div>
                      {ev.workers_needed && (
                        <div className="text-[#555] text-xs mt-1">{ev.workers_needed} worker{ev.workers_needed !== 1 ? 's' : ''} requested</div>
                      )}
                    </div>
                    <StatusBadge status={ev.status} />
                  </div>
                ))}
              </div>
            ) : (
              <div className="border border-[#2a2a2a] rounded-2xl p-6">
                <div className="font-bold text-lg mb-2 text-[#888]">No Requests Found</div>
                <p className="text-[#666] leading-relaxed mb-4">
                  We couldn't find any event requests for that email address.
                </p>
                <button
                  onClick={() => navigate('/events')}
                  className="bg-[#c8ff00] text-black rounded-full py-2 px-6 font-semibold text-sm hover:opacity-90 transition-all"
                >
                  Submit a Staff Request →
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      <Footer />
    </div>
  )
}
