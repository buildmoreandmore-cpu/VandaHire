import { useNavigate } from '../Router.jsx'
import Footer from '../components/Footer.jsx'

const ORGANIZER_STEPS = [
  { step: '01', title: 'Submit a request', body: 'Fill out your event details — date, location, roles, headcount, pay rate, and any briefing requirements. Takes under 5 minutes.' },
  { step: '02', title: 'Vanda reviews & confirms', body: 'We review your request, select vetted workers who match your needs, and confirm your crew within 24 hours.' },
  { step: '03', title: 'Crew dispatched via SMS', body: 'Each worker receives their full shift details — meeting point, supervisor contact, dress code, and briefing schedule — by text message.' },
  { step: '04', title: 'Post-event report delivered', body: 'After the event, workers submit a quick survey. You get a summary of attendance, ratings, and notes from the crew.' },
]

const WORKER_STEPS = [
  { step: '01', title: 'Apply in minutes', body: 'Submit your application with basic info. No resume needed. Just tell us who you are and what roles you\'re comfortable with.' },
  { step: '02', title: 'Get approved', body: 'Our team reviews your application. If it\'s a fit, you\'ll be added to the approved worker pool within 48 hours.' },
  { step: '03', title: 'Claim shifts from your phone', body: 'When events come up in your area, we SMS you the details. Claim the shift directly — no app download required.' },
  { step: '04', title: 'Show up & get paid', body: 'Arrive at the meeting point, check in with the on-site supervisor, and complete your shift. Payment follows based on the agreed rate.' },
]

export default function HowItWorksPage() {
  const navigate = useNavigate()

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white flex flex-col">
      {/* Nav */}
      <div className="px-6 pt-8 flex items-center justify-between max-w-5xl mx-auto w-full">
        <button onClick={() => navigate('/')} className="text-white font-extrabold text-2xl tracking-tight">Vanda</button>
        <a href="/admin" className="text-[#777] text-sm hover:text-white transition-colors">Coordinator Login</a>
      </div>

      {/* Header */}
      <div className="px-6 py-16 text-center max-w-3xl mx-auto w-full">
        <h1 className="text-4xl md:text-5xl font-extrabold tracking-tighter mb-4 fade-up">How It Works</h1>
        <p className="text-[#888] text-lg fade-up-delay-1">
          Vanda connects event organizers with vetted, ready-to-work crew. Here's how the platform works for both sides.
        </p>
      </div>

      {/* Two columns */}
      <div className="px-6 pb-20 max-w-5xl mx-auto w-full grid md:grid-cols-2 gap-12">
        {/* For Organizers */}
        <div>
          <div className="text-[#c8ff00] font-semibold text-xs tracking-widest uppercase mb-6">For Organizers</div>
          <div className="space-y-8">
            {ORGANIZER_STEPS.map(({ step, title, body }) => (
              <div key={step} className="flex gap-4">
                <div className="text-[#c8ff00] font-extrabold text-sm w-8 shrink-0 pt-1">{step}</div>
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
          <div className="text-[#c8ff00] font-semibold text-xs tracking-widest uppercase mb-6">For Workers</div>
          <div className="space-y-8">
            {WORKER_STEPS.map(({ step, title, body }) => (
              <div key={step} className="flex gap-4">
                <div className="text-[#c8ff00] font-extrabold text-sm w-8 shrink-0 pt-1">{step}</div>
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
            className="bg-[#c8ff00] text-black rounded-full py-4 px-10 font-semibold text-base hover:opacity-90 transition-all duration-200"
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
