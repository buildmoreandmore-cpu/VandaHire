import { useEffect, useState } from 'react'
import { useNavigate } from '../Router.jsx'
import VandaLogo from '../components/VandaLogo.jsx'

const IconPin = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 22s7-7.58 7-13a7 7 0 1 0-14 0c0 5.42 7 13 7 13z" /><circle cx="12" cy="9" r="2.5" />
  </svg>
)
const IconArrow = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M5 12h14M13 5l7 7-7 7" />
  </svg>
)

export default function HiringPage() {
  const navigate = useNavigate()
  const [roles, setRoles] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let alive = true
    fetch('/api/submit?ongoing=1')
      .then(r => r.ok ? r.json() : [])
      .then(data => { if (alive) setRoles(Array.isArray(data) ? data : []) })
      .catch(() => { if (alive) setRoles([]) })
      .finally(() => { if (alive) setLoading(false) })
    return () => { alive = false }
  }, [])

  return (
    <div className="min-h-screen bg-[#0a0a0a] font-inter">
      <div className="max-w-3xl mx-auto px-6 py-8">
        <div className="mb-8 flex items-center justify-between">
          <VandaLogo onClick={() => navigate('/')} />
          <button onClick={() => navigate('/')} className="text-[#555] text-sm hover:text-white transition-colors">← Back</button>
        </div>

        <div className="text-p-green font-semibold text-xs tracking-widest uppercase mb-3">Always hiring</div>
        <h1 className="text-4xl font-extrabold text-white tracking-tighter mb-3">Ongoing event-staff roles</h1>
        <p className="text-[#888] text-base leading-relaxed mb-8 max-w-xl">
          We staff festivals, concerts, corporate events, and activations across metro Atlanta year-round. Apply once and get matched to shifts that fit your schedule.
        </p>

        {!loading && roles.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-8">
            {roles.map(r => (
              <a
                key={r.id}
                href={`/join/${r.code}`}
                className="group relative block rounded-2xl border border-[#1e1e1e] bg-[#0e0e0e] p-4 hover:border-p-green/60 hover:bg-[#111] transition-all duration-200"
              >
                <div className="text-p-green text-[11px] tracking-widest uppercase font-bold mb-2">Always hiring</div>
                <h3 className="text-white font-bold text-lg leading-tight mb-2 group-hover:text-p-green transition-colors">{r.name}</h3>
                {(r.event_location || r.event_city) && (
                  <div className="flex items-center gap-1.5 text-[#888] text-xs mb-2">
                    <IconPin /><span className="truncate">{[r.event_location, r.event_city].filter(Boolean).join(' · ')}</span>
                  </div>
                )}
                <div className="mt-2 flex items-center gap-1.5 text-white text-xs font-semibold">
                  <span>Join this crew</span><span className="transition-transform group-hover:translate-x-0.5"><IconArrow /></span>
                </div>
              </a>
            ))}
          </div>
        )}

        {/* Always-present general application CTA */}
        <div className="rounded-2xl border border-p-green/40 bg-[#0e0e0e] p-6">
          <h2 className="text-white font-bold text-xl mb-2">Don't see your fit? Join the talent pool.</h2>
          <p className="text-[#888] text-sm leading-relaxed mb-4">
            Apply once and we'll match you to event shifts near you — setup, catering, registration, brand activations, and more. We text you the details, you check in, you get paid.
          </p>
          <button
            onClick={() => navigate('/apply')}
            className="bg-p-green text-black rounded-full py-3.5 px-8 font-semibold text-base hover:opacity-90 transition-all"
          >
            Apply to Work →
          </button>
        </div>
      </div>
    </div>
  )
}
