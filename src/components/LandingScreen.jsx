import { useEffect, useRef, useState } from 'react'
import { useNavigate } from '../Router.jsx'
import VandaLogo from './VandaLogo.jsx'
import Footer from './Footer.jsx'
import InstallPrompt from './InstallPrompt.jsx'
import UpcomingEventsBlock from './UpcomingEventsBlock.jsx'

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
  { step: '01', title: 'Submit your event', body: 'Tell us your date, location, roles needed, and whether you want labor supply or a fully managed crew. Takes under 5 minutes.' },
  { step: '02', title: 'We staff your crew', body: 'V&A Hire selects vetted, approved workers. For managed labor, we assign a V&A Hire site supervisor to lead your crew on the ground.' },
  { step: '03', title: 'GPS-verified arrival', body: 'Every worker checks in via geofence when they arrive at your venue. You know exactly who\'s on site, in real time.' },
]

const WHY_VANDA = [
  { title: 'Two tiers — you choose', body: 'Need workers only? We supply pre-screened crew. Want hands-off? Our managed labor tier includes an on-site V&A Hire supervisor who handles everything.' },
  { title: 'GPS check-in at every event', body: 'Workers verify their location when they arrive. No more disputed hours or ghost check-ins — every arrival is GPS-stamped.' },
  { title: 'On-site supervisor + incident log', body: 'For managed events, your V&A Hire supervisor tracks the crew roster, logs any incidents in real time, and gives you a clean post-event report.' },
]

const STATS = [
  { number: '500+', label: 'Crew Members' },
  { number: '120+', label: 'Events Staffed' },
  { number: '98%', label: 'Show-Up Rate' },
  { number: '50+', label: 'Venue Partners' },
]

const ORGANIZER_TIMELINE = [
  { step: '1', title: 'We review your event details', time: 'Same day' },
  { step: '2', title: 'Receive a custom quote', time: 'Within 24 hours' },
  { step: '3', title: 'Approve & pay deposit', time: 'Secure your crew' },
  { step: '4', title: 'Crew confirmed & briefed', time: 'Before event day' },
]

const WORKER_TIMELINE = [
  { step: '1', title: 'Submit your application', time: '2 min' },
  { step: '2', title: 'Application review', time: '24–48 hrs' },
  { step: '3', title: 'Upload ID & complete W-9', time: 'Once approved' },
  { step: '4', title: 'Receive shifts via text & claim', time: 'Start earning' },
]

export default function LandingScreen({ onStart }) {
  const navigate = useNavigate()
  const containerRef = useRef(null)
  const [menuOpen, setMenuOpen] = useState(false)

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('visible')
            observer.unobserve(entry.target)
          }
        })
      },
      { threshold: 0.15 }
    )
    const sections = containerRef.current?.querySelectorAll('.reveal')
    sections?.forEach((el) => observer.observe(el))
    return () => observer.disconnect()
  }, [])

  return (
    <div ref={containerRef} className="min-h-screen bg-[#0a0a0a] text-white flex flex-col font-body">
      {/* Header */}
      <header className="border-b border-[#1a1a1a] px-6 py-4 relative z-50">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <VandaLogo onClick={() => {}} />

          {/* Desktop nav */}
          <nav className="hidden md:flex items-center gap-6">
            <button onClick={() => navigate('/events')} className="text-p-link text-sm hover:text-white transition-colors font-medium">Request Staff</button>
            <button onClick={() => navigate('/organizer')} className="text-p-link text-sm hover:text-white transition-colors font-medium">Event Status</button>
            <a href="/shifts" className="text-p-link text-sm hover:text-white transition-colors font-medium">Worker Portal</a>
          </nav>

          {/* Mobile hamburger */}
          <button
            onClick={() => setMenuOpen(!menuOpen)}
            className="md:hidden flex flex-col justify-center items-center w-10 h-10 gap-[5px]"
            aria-label="Menu"
          >
            <span className={`block w-5 h-[2px] bg-white transition-all duration-300 ${menuOpen ? 'rotate-45 translate-y-[7px]' : ''}`} />
            <span className={`block w-5 h-[2px] bg-white transition-all duration-300 ${menuOpen ? 'opacity-0' : ''}`} />
            <span className={`block w-5 h-[2px] bg-white transition-all duration-300 ${menuOpen ? '-rotate-45 -translate-y-[7px]' : ''}`} />
          </button>
        </div>

        {/* Mobile menu dropdown */}
        {menuOpen && (
          <div className="md:hidden absolute top-full left-0 right-0 bg-[#0a0a0a] border-b border-[#1a1a1a] px-6 py-4 flex flex-col gap-4 z-50">
            <button onClick={() => { navigate('/events'); setMenuOpen(false) }} className="text-p-link text-sm font-medium text-left py-2 hover:text-white transition-colors">Request Staff</button>
            <button onClick={() => { navigate('/organizer'); setMenuOpen(false) }} className="text-p-link text-sm font-medium text-left py-2 hover:text-white transition-colors">Event Status</button>
            <a href="/shifts" onClick={() => setMenuOpen(false)} className="text-p-link text-sm font-medium py-2 hover:text-white transition-colors">Worker Portal</a>
          </div>
        )}
      </header>

      {/* Install prompt */}
      <div className="max-w-[520px] mx-auto w-full px-6 pt-4">
        <InstallPrompt />
      </div>

      {/* Upcoming events — tap a card to join that event's crew (replaces QR/link flow) */}
      <UpcomingEventsBlock />

      {/* Hero */}
      <div className="flex-1 flex flex-col justify-center items-center text-center max-w-[520px] mx-auto w-full py-16 px-6">
        <h1 className="font-inter text-5xl font-extrabold leading-none tracking-tighter mb-3 text-left">
          <span className="block text-white tagline-line tagline-line-1">On Time.</span>
          <span className="block text-white tagline-line tagline-line-2">On Task.</span>
          <span className="block text-white tagline-line tagline-line-3">
            On <span className="tagline-payroll">Payroll<span className="tagline-period">.</span></span>
          </span>
        </h1>

        <p className="text-[#999] text-sm font-semibold tracking-wide mb-4 fade-up">
          The People Behind What Works.
        </p>

        <p className="font-body text-[#888] text-base leading-relaxed mb-4 fade-up-delay-1">
          Event staffing and managed labor for festivals, corporate events, activations, and venues.
          We show up, we manage the crew, you run your event.
        </p>

        <div className="w-full max-w-sm space-y-3 fade-up-delay-2">
          <button
            onClick={onStart}
            className="bg-white text-black rounded-full py-4 px-10 font-semibold text-base hover:opacity-90 transition-all duration-200 w-full"
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
          Workers apply in minutes. Organizers get vetted crew with GPS-verified check-in.
        </p>
      </div>

      {/* Stats Bar */}
      <section className="reveal bg-[#111] border-y border-[#1a1a1a] py-12 px-6">
        <div className="max-w-5xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
          {STATS.map(({ number, label }) => (
            <div key={label}>
              <div className="text-4xl md:text-5xl font-extrabold text-white font-inter tracking-tight">{number}</div>
              <div className="text-[#666] text-xs tracking-widest uppercase mt-2">{label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* How It Works for Organizers */}
      <section className="reveal px-6 py-16 border-t border-[#1a1a1a] max-w-5xl mx-auto w-full">
        <div className="text-[#999] font-semibold text-xs tracking-widest uppercase mb-6">For Organizers</div>
        <h2 className="font-inter text-3xl font-extrabold tracking-tighter mb-10">How it works</h2>
        <div className="grid md:grid-cols-3 gap-8">
          {ORGANIZER_STEPS.map(({ step, title, body }) => (
            <div key={step}>
              <div className="text-white font-extrabold text-sm mb-2">{step}</div>
              <div className="font-inter text-white font-bold text-lg mb-2">{title}</div>
              <div className="text-[#777] text-sm leading-relaxed">{body}</div>
            </div>
          ))}
        </div>
        <div className="mt-10">
          <button
            onClick={() => navigate('/how-it-works')}
            className="text-p-green text-sm hover:opacity-80 transition-colors underline underline-offset-4"
          >
            See full walkthrough
          </button>
        </div>
      </section>

      {/* Roles We Staff */}
      <section className="reveal px-6 py-16 border-t border-[#1a1a1a] max-w-5xl mx-auto w-full">
        <div className="text-[#999] font-semibold text-xs tracking-widest uppercase mb-6">Roles</div>
        <h2 className="font-inter text-3xl font-extrabold tracking-tighter mb-10">Roles we staff</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {ROLES.map(({ Icon, label }) => (
            <div key={label} className="border border-[#1e1e1e] rounded-2xl p-4 flex flex-col items-center gap-3 hover:border-[#2a2a2a] transition-colors">
              <span className="text-white"><Icon /></span>
              <span className="text-sm text-[#888] text-center">{label}</span>
            </div>
          ))}
        </div>
      </section>

      {/* Why V&A Hire */}
      <section className="reveal px-6 py-16 border-t border-[#1a1a1a] bg-[#0d0d0d] max-w-5xl mx-auto w-full">
        <div className="text-[#999] font-semibold text-xs tracking-widest uppercase mb-6">Why V&A Hire</div>
        <div className="grid md:grid-cols-3 gap-8">
          {WHY_VANDA.map(({ title, body }) => (
            <div key={title}>
              <div className="w-2 h-2 rounded-full bg-white mb-4" />
              <div className="font-inter text-white font-bold text-lg mb-2">{title}</div>
              <div className="text-[#777] text-sm leading-relaxed">{body}</div>
            </div>
          ))}
        </div>
      </section>

      {/* About / Trust Section */}
      <section className="reveal px-6 py-16 border-t border-[#1a1a1a] max-w-5xl mx-auto w-full">
        <div className="text-[#999] font-semibold text-xs tracking-widest uppercase mb-6">About V&A Hire</div>
        <h2 className="font-inter text-3xl font-extrabold tracking-tighter mb-6">Backed by Varist & Associates of GA LLC</h2>
        <div className="text-[#888] text-sm leading-relaxed space-y-4 max-w-2xl">
          <p>
            V&A Hire is powered by Varist & Associates of GA LLC — an Atlanta-based workforce operations company
            that has deployed vetted, supervised crews across some of the Southeast's biggest stages.
          </p>
          <p>
            Our teams have worked <span className="text-white font-medium">State Farm Arena, Georgia World Congress Center,
            Truist Park, and Piedmont Park</span>. We've staffed major festivals including Lollapalooza, Bonnaroo, and EDC —
            handling everything from stadium turnovers and venue setup to film production labor and construction cleanup.
          </p>
          <p>
            With a <span className="text-white font-medium">4.9-star rating across 127+ reviews</span> and crews operating 24/7
            across Fulton, DeKalb, Gwinnett, Cobb, Henry, and Clayton counties, V&A brings the operational depth that
            event organizers and venue managers depend on. Every worker is background-checked, safety-trained, ID-verified,
            and GPS-tracked on arrival.
          </p>
          <p>
            We built V&A Hire to bring that same reliability to on-demand event staffing — no group texts,
            no last-minute scrambles. Just vetted crews, dispatched by SMS, confirmed within 24 hours.
          </p>
          <p className="text-[#555] text-xs">196 Peachtree St SW, #121, Atlanta, GA 30303</p>
        </div>
      </section>

      {/* Pricing Transparency */}
      <section className="reveal px-6 py-16 border-t border-[#1a1a1a] bg-[#0d0d0d] max-w-5xl mx-auto w-full">
        <div className="text-[#999] font-semibold text-xs tracking-widest uppercase mb-6">For Organizers</div>
        <h2 className="font-inter text-3xl font-extrabold tracking-tighter mb-8">Clear, honest pricing</h2>
        <div className="grid md:grid-cols-2 gap-8 mb-8">
          <div className="border border-[#1e1e1e] rounded-2xl p-6">
            <div className="font-inter text-white font-bold text-lg mb-3">Deposit — due upfront</div>
            <div className="text-[#888] text-sm leading-relaxed">
              Covers labor cost + standby/bench fees. This secures your crew and pays for backup workers in case of no-shows.
            </div>
          </div>
          <div className="border border-[#1e1e1e] rounded-2xl p-6">
            <div className="font-inter text-white font-bold text-lg mb-3">Balance — Net 15</div>
            <div className="text-[#888] text-sm leading-relaxed">
              Platform fee, supervisor fee, and processing fee — billed after the event, due within 15 days.
            </div>
          </div>
        </div>
        <div className="space-y-3 text-[#888] text-sm">
          <div className="flex items-start gap-2">
            <span className="text-white mt-0.5">✓</span>
            <span>You only pay for the hours worked</span>
          </div>
          <div className="flex items-start gap-2">
            <span className="text-white mt-0.5">✓</span>
            <span>No hidden fees — full quote provided before you commit</span>
          </div>
        </div>
        <div className="mt-8 border border-[#1e1e1e] rounded-2xl p-6 bg-[#0a0a0a]">
          <div className="text-white font-bold text-sm mb-3">How it works</div>
          <div className="text-[#777] text-sm leading-relaxed">
            Submit your event → Receive an itemized quote → Approve & pay deposit → We handle the rest.
          </div>
        </div>
      </section>

      {/* What Happens Next — Organizers */}
      <section className="reveal px-6 py-16 border-t border-[#1a1a1a] max-w-5xl mx-auto w-full">
        <div className="text-[#999] font-semibold text-xs tracking-widest uppercase mb-6">What Happens Next</div>
        <div className="grid md:grid-cols-2 gap-12">
          <div>
            <h3 className="font-inter text-xl font-bold mb-6">For Organizers</h3>
            <div className="space-y-6">
              {ORGANIZER_TIMELINE.map(({ step, title, time }) => (
                <div key={step} className="flex gap-4">
                  <div className="flex-shrink-0 w-8 h-8 rounded-full border border-[#333] flex items-center justify-center text-sm font-bold text-white">{step}</div>
                  <div>
                    <div className="text-white font-medium text-sm">{title}</div>
                    <div className="text-[#666] text-xs mt-0.5">{time}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div>
            <h3 className="font-inter text-xl font-bold mb-6">For Workers</h3>
            <div className="space-y-6">
              {WORKER_TIMELINE.map(({ step, title, time }) => (
                <div key={step} className="flex gap-4">
                  <div className="flex-shrink-0 w-8 h-8 rounded-full border border-[#333] flex items-center justify-center text-sm font-bold text-white">{step}</div>
                  <div>
                    <div className="text-white font-medium text-sm">{title}</div>
                    <div className="text-[#666] text-xs mt-0.5">{time}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  )
}
