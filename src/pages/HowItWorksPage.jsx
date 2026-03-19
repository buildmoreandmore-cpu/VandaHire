import { useNavigate } from '../Router.jsx'
import Footer from '../components/Footer.jsx'
import VandaLogo from '../components/VandaLogo.jsx'

const ORGANIZER_STEPS = [
  { step: '01', title: 'Submit a request', body: 'Fill out your event details — date, location, roles, and headcount. Choose labor supply (you supervise) or managed labor (we supervise). Takes under 5 minutes.' },
  { step: '02', title: 'We build your crew', body: 'Vanda selects vetted, approved workers. For managed labor, we assign a Vanda site supervisor who leads the crew on the ground.' },
  { step: '03', title: 'GPS-verified check-in', body: 'Every worker checks in via geofence when they arrive at your venue. You know exactly who showed up, when, and where — no disputed hours.' },
  { step: '04', title: 'Real-time crew management', body: 'Your supervisor tracks attendance, handles issues, and logs incidents in real time. After the event, you get a clean report with hours, attendance, and any notes.' },
]

const WORKER_STEPS = [
  { step: '01', title: 'Apply in minutes', body: 'Submit your application with basic info. No resume needed. Just tell us who you are and what roles you\'re comfortable with.' },
  { step: '02', title: 'Get approved', body: 'Our team reviews your application. If it\'s a fit, you\'ll be added to the approved worker pool within 48 hours.' },
  { step: '03', title: 'Claim shifts & check in with GPS', body: 'When events come up in your area, we SMS you the details. Claim shifts from your phone. On the day, check in via GPS when you arrive at the venue.' },
  { step: '04', title: 'Show up & get paid', body: 'Your hours are automatically tracked from check-in to check-out. No manual timesheets — your GPS-verified time goes straight to payroll.' },
]

const SERVICE_TIERS = [
  {
    title: 'Labor Supply',
    desc: 'For operators and organizers who have their own on-site supervision.',
    features: [
      'Pre-screened, vetted workers from our pool',
      'Individual SMS dispatch with shift details',
      'GPS check-in/check-out at the venue',
      'Automated hours tracking',
      'You provide on-site supervision',
    ],
  },
  {
    title: 'Managed Labor',
    desc: 'For organizers who want one call, one invoice, zero labor headaches.',
    features: [
      'Everything in Labor Supply, plus:',
      'Vanda site supervisor assigned to your event',
      'Supervisor arrives 30 min early, manages crew',
      'Live crew roster with check-in status',
      'Real-time incident logging',
      'Post-event attendance report',
      'Single point of contact on the ground',
    ],
  },
]

export default function HowItWorksPage() {
  const navigate = useNavigate()

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white flex flex-col">
      {/* Nav */}
      <div className="px-6 pt-8 flex items-center justify-between max-w-5xl mx-auto w-full">
        <VandaLogo onClick={() => navigate('/')} />
        <a href="/admin" className="text-[#777] text-sm hover:text-white transition-colors">Coordinator Login</a>
      </div>

      {/* Header */}
      <div className="px-6 py-16 text-center max-w-3xl mx-auto w-full">
        <h1 className="text-4xl md:text-5xl font-extrabold tracking-tighter mb-4 fade-up">How It Works</h1>
        <p className="text-[#888] text-lg fade-up-delay-1">
          Vanda provides vetted event crews with GPS-verified check-in. Choose labor supply or fully managed — we handle the rest.
        </p>
      </div>

      {/* Service Tiers */}
      <div className="px-6 pb-16 max-w-5xl mx-auto w-full">
        <div className="text-[#3ecf8e] font-semibold text-xs tracking-widest uppercase mb-6">Two Service Tiers</div>
        <div className="grid md:grid-cols-2 gap-6">
          {SERVICE_TIERS.map(tier => (
            <div key={tier.title} className={`border rounded-2xl p-6 ${tier.title === 'Managed Labor' ? 'border-[#3ecf8e]/30 bg-[#3ecf8e]/[0.02]' : 'border-[#1e1e1e]'}`}>
              <h3 className="text-white text-xl font-bold mb-2">{tier.title}</h3>
              <p className="text-[#888] text-sm mb-4">{tier.desc}</p>
              <ul className="space-y-2">
                {tier.features.map((f, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm">
                    <span className="text-[#3ecf8e] mt-1 text-xs">+</span>
                    <span className="text-[#aaa]">{f}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>

      {/* Two columns */}
      <div className="px-6 pb-20 max-w-5xl mx-auto w-full grid md:grid-cols-2 gap-12">
        {/* For Organizers */}
        <div>
          <div className="text-[#3ecf8e] font-semibold text-xs tracking-widest uppercase mb-6">For Organizers</div>
          <div className="space-y-8">
            {ORGANIZER_STEPS.map(({ step, title, body }) => (
              <div key={step} className="flex gap-4">
                <div className="text-[#3ecf8e] font-extrabold text-sm w-8 shrink-0 pt-1">{step}</div>
                <div>
                  <div className="text-white font-bold text-lg mb-1">{title}</div>
                  <div className="text-[#777] text-sm leading-relaxed">{body}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* For Workers */}
        <div>
          <div className="text-[#3ecf8e] font-semibold text-xs tracking-widest uppercase mb-6">For Workers</div>
          <div className="space-y-8">
            {WORKER_STEPS.map(({ step, title, body }) => (
              <div key={step} className="flex gap-4">
                <div className="text-[#3ecf8e] font-extrabold text-sm w-8 shrink-0 pt-1">{step}</div>
                <div>
                  <div className="text-white font-bold text-lg mb-1">{title}</div>
                  <div className="text-[#777] text-sm leading-relaxed">{body}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Dual CTAs */}
      <div className="px-6 py-16 border-t border-[#1a1a1a] bg-[#111] text-center">
        <h2 className="text-3xl font-extrabold mb-4 tracking-tight">Ready to get started?</h2>
        <p className="text-[#888] mb-8">Whether you're running an event or looking for work, we make it fast.</p>
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <button
            onClick={() => navigate('/events')}
            className="bg-[#3ecf8e] text-black rounded-full py-4 px-10 font-semibold text-base hover:opacity-90 transition-all duration-200"
          >
            Request Staff →
          </button>
          <button
            onClick={() => navigate('/')}
            className="border border-[#2a2a2a] text-white rounded-full py-4 px-10 font-semibold text-base hover:border-[#444] hover:bg-[#111] transition-all duration-200"
          >
            Apply for Work →
          </button>
        </div>
      </div>

      <Footer />
    </div>
  )
}
