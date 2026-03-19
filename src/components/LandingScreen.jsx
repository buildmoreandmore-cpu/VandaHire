import { useNavigate } from '../Router.jsx'
import Footer from './Footer.jsx'

const ROLES = [
  { icon: '🧹', label: 'Janitorial' },
  { icon: '🗑️', label: 'Cleanup' },
  { icon: '📦', label: 'Setup & Breakdown' },
  { icon: '📣', label: 'Brand Activation' },
  { icon: '🏗️', label: 'General Labor' },
  { icon: '🛡️', label: 'Security' },
  { icon: '📋', label: 'Registration' },
  { icon: '🍽️', label: 'Catering Support' },
]

const ORGANIZER_STEPS = [
  { step: '01', title: 'Submit your event', body: 'Tell us your date, location, roles needed, and briefing requirements. Takes under 5 minutes.' },
  { step: '02', title: 'We staff your crew', body: 'Vanda reviews your request and selects vetted, approved workers who match your needs.' },
  { step: '03', title: 'Workers dispatched via SMS', body: 'Each crew member gets full shift details — meeting point, supervisor contact, and briefing schedule — by text.' },
]

const WHY_VANDA = [
  { title: 'Vetted & approved workers only', body: 'Every worker on the platform has been reviewed and approved by our team before being offered shifts.' },
  { title: 'SMS dispatch — no group texts', body: 'Workers get direct, individual SMS briefings with all the info they need. No group chats, no confusion.' },
  { title: 'Briefings + post-shift reports', body: 'Optional pre-event briefings and post-shift worker surveys keep you informed before and after every event.' },
]

export default function LandingScreen({ onStart }) {
  const navigate = useNavigate()

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white flex flex-col">
      {/* Nav */}
      <div className="px-6 pt-8 flex items-center justify-between max-w-5xl mx-auto w-full">
        <span className="text-white font-extrabold text-2xl tracking-tight">Vanda</span>
        <a href="/admin" className="text-[#777] text-sm hover:text-white transition-colors">Coordinator Login</a>
      </div>

      {/* Hero */}
      <div className="px-6 py-20 text-center max-w-3xl mx-auto w-full">
        <h1 className="text-5xl md:text-6xl font-extrabold tracking-tighter leading-none mb-4 fade-up">
          The crew behind<br />the event.
        </h1>
        <p className="text-[#888] text-lg leading-relaxed mb-10 max-w-xl mx-auto fade-up-delay-1">
          Vanda connects event organizers with vetted, ready-to-work crew — and connects workers with paid shifts in their city.
        </p>
        <div className="flex flex-col sm:flex-row gap-4 justify-center fade-up-delay-2">
          <button
            onClick={onStart}
            className="bg-[#c8ff00] text-black rounded-full py-4 px-10 font-semibold text-base hover:opacity-90 transition-all duration-200"
          >
            I'm Looking for Work →
          </button>
          <button
            onClick={() => navigate('/events')}
            className="border border-[#2a2a2a] text-white rounded-full py-4 px-10 font-semibold text-base hover:border-[#444] hover:bg-[#111] transition-all duration-200"
          >
            Request Staff →
          </button>
        </div>
      </div>

      {/* How It Works for Organizers */}
      <section className="px-6 py-16 border-t border-[#1a1a1a] max-w-5xl mx-auto w-full">
        <div className="text-[#c8ff00] font-semibold text-xs tracking-widest uppercase mb-6">For Organizers</div>
        <h2 className="text-3xl font-extrabold tracking-tighter mb-10">How staffing works</h2>
        <div className="grid md:grid-cols-3 gap-8">
          {ORGANIZER_STEPS.map(({ step, title, body }) => (
            <div key={step}>
              <div className="text-[#c8ff00] font-extrabold text-sm mb-2">{step}</div>
              <div className="text-white font-bold text-lg mb-2">{title}</div>
              <div className="text-[#777] text-sm leading-relaxed">{body}</div>
            </div>
          ))}
        </div>
        <div className="mt-10">
          <button
            onClick={() => navigate('/how-it-works')}
            className="text-[#777] text-sm hover:text-white transition-colors underline underline-offset-4"
          >
            See full walkthrough →
          </button>
        </div>
      </section>

      {/* Roles We Staff */}
      <section className="px-6 py-16 border-t border-[#1a1a1a] max-w-5xl mx-auto w-full">
        <div className="text-[#c8ff00] font-semibold text-xs tracking-widest uppercase mb-6">Roles</div>
        <h2 className="text-3xl font-extrabold tracking-tighter mb-10">Roles we staff</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {ROLES.map(({ icon, label }) => (
            <div key={label} className="border border-[#1e1e1e] rounded-2xl p-4 flex flex-col items-center gap-2 hover:border-[#2a2a2a] transition-colors">
              <span className="text-2xl">{icon}</span>
              <span className="text-sm text-[#888] text-center">{label}</span>
            </div>
          ))}
        </div>
      </section>

      {/* Why Vanda */}
      <section className="px-6 py-16 border-t border-[#1a1a1a] bg-[#0d0d0d] max-w-5xl mx-auto w-full">
        <div className="text-[#c8ff00] font-semibold text-xs tracking-widest uppercase mb-6">Why Vanda</div>
        <h2 className="text-3xl font-extrabold tracking-tighter mb-10">Built for the job</h2>
        <div className="grid md:grid-cols-3 gap-8">
          {WHY_VANDA.map(({ title, body }) => (
            <div key={title}>
              <div className="w-2 h-2 rounded-full bg-[#c8ff00] mb-4" />
              <div className="text-white font-bold text-lg mb-2">{title}</div>
              <div className="text-[#777] text-sm leading-relaxed">{body}</div>
            </div>
          ))}
        </div>
      </section>

      <Footer />
    </div>
  )
}
