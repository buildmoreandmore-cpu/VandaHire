import { useNavigate } from '../Router.jsx'
import VandaLogo from './VandaLogo.jsx'

// SVG icons for roles
const IconBroom = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 21l7-7" /><path d="M12.5 8.5l-3.5 3.5 4 4 3.5-3.5" /><path d="M15 6l3-3 3 3-3 3" />
  </svg>
)

const IconTrash = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14H6L5 6" /><path d="M10 11v6" /><path d="M14 11v6" /><path d="M9 6V4h6v2" />
  </svg>
)

const IconBox = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" /><polyline points="3.27 6.96 12 12.01 20.73 6.96" /><line x1="12" y1="22.08" x2="12" y2="12" />
  </svg>
)

const IconMegaphone = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 11l19-9-9 19-2-8-8-2z" />
  </svg>
)

const IconHardHat = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M2 18a1 1 0 0 0 1 1h18a1 1 0 0 0 1-1v-2a1 1 0 0 0-1-1H3a1 1 0 0 0-1 1v2z" /><path d="M10 10V5a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1v5" /><path d="M4 15V9a8 8 0 0 1 16 0v6" />
  </svg>
)

const IconShield = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
  </svg>
)

const IconClipboard = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" /><rect x="8" y="2" width="8" height="4" rx="1" ry="1" />
  </svg>
)

const IconUtensils = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 2v7c0 1.1.9 2 2 2h4a2 2 0 0 0 2-2V2" /><path d="M7 2v20" /><path d="M21 15V2v0a5 5 0 0 0-5 5v6c0 1.1.9 2 2 2h3zm0 0v7" />
  </svg>
)

const ROLES = [
  { Icon: IconBroom,     label: 'Janitorial' },
  { Icon: IconTrash,     label: 'Cleanup' },
  { Icon: IconBox,       label: 'Setup & Breakdown' },
  { Icon: IconMegaphone, label: 'Brand Activation' },
  { Icon: IconHardHat,   label: 'General Labor' },
  { Icon: IconShield,    label: 'Security' },
  { Icon: IconClipboard, label: 'Registration' },
  { Icon: IconUtensils,  label: 'Catering Support' },
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
        <VandaLogo onClick={() => {}} />
        <a href="/admin" className="text-[#777] text-sm hover:text-white transition-colors">Coordinator Login</a>
      </div>

      {/* Hero */}
      <div className="flex-1 flex flex-col justify-center items-center text-center max-w-[520px] mx-auto w-full py-16 px-6">
        <h1 className="text-5xl font-extrabold text-white leading-none tracking-tighter mb-3 fade-up">
          Show up.<br />Get paid.
        </h1>

        <p className="text-[#3ecf8e] text-sm font-semibold tracking-wide mb-8 fade-up">
          The People Behind What Works.
        </p>

        <p className="text-[#888] text-base leading-relaxed mb-10 fade-up-delay-1">
          Staffing for events, activations, festivals, janitorial, setup, and facilities.
          Apply for work or request staff in a few minutes.
        </p>

        <div className="w-full max-w-sm space-y-3 fade-up-delay-2">
          <button
            onClick={onStart}
            className="bg-[#3ecf8e] text-black rounded-full py-4 px-10 font-semibold text-base hover:opacity-90 transition-all duration-200 w-full"
          >
            I'm Looking for Work →
          </button>
          <button
            onClick={() => navigate('/events')}
            className="block w-full rounded-full py-4 px-10 font-semibold text-base border border-[#2a2a2a] text-white hover:border-[#444] hover:bg-[#111] transition-all duration-200 cursor-pointer"
          >
            I Need Staff for an Event →
          </button>
        </div>

        <p className="fade-up-delay-3 text-[#555] text-sm mt-6">
          Workers can apply in minutes. Event organizers can request staff on the same site.
        </p>
      </div>

      {/* How It Works for Organizers */}
      <section className="px-6 py-16 border-t border-[#1a1a1a] max-w-5xl mx-auto w-full">
        <div className="text-[#3ecf8e] font-semibold text-xs tracking-widest uppercase mb-6">For Organizers</div>
        <h2 className="text-3xl font-extrabold tracking-tighter mb-10">How staffing works</h2>
        <div className="grid md:grid-cols-3 gap-8">
          {ORGANIZER_STEPS.map(({ step, title, body }) => (
            <div key={step}>
              <div className="text-[#3ecf8e] font-extrabold text-sm mb-2">{step}</div>
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
            See full walkthrough
          </button>
        </div>
      </section>

      {/* Roles We Staff */}
      <section className="px-6 py-16 border-t border-[#1a1a1a] max-w-5xl mx-auto w-full">
        <div className="text-[#3ecf8e] font-semibold text-xs tracking-widest uppercase mb-6">Roles</div>
        <h2 className="text-3xl font-extrabold tracking-tighter mb-10">Roles we staff</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {ROLES.map(({ Icon, label }) => (
            <div key={label} className="border border-[#1e1e1e] rounded-2xl p-4 flex flex-col items-center gap-3 hover:border-[#2a2a2a] transition-colors">
              <span className="text-[#3ecf8e]"><Icon /></span>
              <span className="text-sm text-[#888] text-center">{label}</span>
            </div>
          ))}
        </div>
      </section>

      {/* Why Vanda */}
      <section className="px-6 py-16 border-t border-[#1a1a1a] bg-[#0d0d0d] max-w-5xl mx-auto w-full">
        <div className="text-[#3ecf8e] font-semibold text-xs tracking-widest uppercase mb-6">Why Vanda</div>
        <h2 className="text-3xl font-extrabold tracking-tighter mb-10">Built for the job</h2>
        <div className="grid md:grid-cols-3 gap-8">
          {WHY_VANDA.map(({ title, body }) => (
            <div key={title}>
              <div className="w-2 h-2 rounded-full bg-[#3ecf8e] mb-4" />
              <div className="text-white font-bold text-lg mb-2">{title}</div>
              <div className="text-[#777] text-sm leading-relaxed">{body}</div>
            </div>
          ))}
        </div>
      </section>

    </div>
  )
}
