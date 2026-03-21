import { useEffect } from 'react'
import { useNavigate } from '../Router.jsx'
import Footer from './Footer.jsx'
import VandaLogo from './VandaLogo.jsx'

export default function SeoLandingPage({ keyword, headline, subhead, description }) {
  const navigate = useNavigate()

  useEffect(() => {
    const prevTitle = document.title
    document.title = `${headline} | V&A Workforce`

    let metaDesc = document.querySelector('meta[name="description"]')
    if (!metaDesc) {
      metaDesc = document.createElement('meta')
      metaDesc.setAttribute('name', 'description')
      document.head.appendChild(metaDesc)
    }
    const prevDesc = metaDesc.getAttribute('content')
    metaDesc.setAttribute('content', subhead)

    return () => {
      document.title = prevTitle
      if (metaDesc) metaDesc.setAttribute('content', prevDesc)
    }
  }, [headline, subhead])

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white flex flex-col">
      {/* Nav */}
      <div className="px-6 pt-8 flex items-center justify-between max-w-4xl mx-auto w-full">
        <VandaLogo onClick={() => navigate('/')} />
        <a href="/admin" className="text-[#777] text-sm hover:text-white transition-colors">Coordinator Login</a>
      </div>

      {/* Hero */}
      <div className="px-6 py-16 max-w-4xl mx-auto w-full">
        <h1 className="text-4xl md:text-5xl font-extrabold leading-tight tracking-tighter mb-4 fade-up">
          {headline}
        </h1>
        <p className="text-[#888] text-lg mb-10 max-w-2xl fade-up-delay-1">{subhead}</p>

        <button
          onClick={() => navigate('/events')}
          className="bg-[#ffffff] text-black rounded-full py-4 px-10 font-semibold text-base hover:opacity-90 transition-all duration-200 fade-up-delay-2"
        >
          Request Staff →
        </button>

        {/* Social proof — processing fluency */}
        <div className="flex flex-wrap items-center gap-4 mt-8 text-xs text-[#555] fade-up-delay-3">
          <span className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-[#ffffff]" />
            GPS-verified crew check-in
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-[#ffffff]" />
            On-site supervisor available
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-[#ffffff]" />
            24-hour crew confirmation
          </span>
        </div>
      </div>

      {/* Description */}
      <div className="px-6 pb-16 max-w-4xl mx-auto w-full">
        <div className="text-[#888] text-base leading-relaxed space-y-4 max-w-2xl">
          {description.map((para, i) => (
            <p key={i}>{para}</p>
          ))}
        </div>
      </div>

      {/* How It Works */}
      <div className="px-6 py-16 border-t border-[#1a1a1a] max-w-4xl mx-auto w-full">
        <h2 className="text-2xl font-extrabold mb-10 tracking-tight">How It Works</h2>
        <div className="grid md:grid-cols-3 gap-8">
          {[
            { step: '01', title: 'Submit your event', body: 'Tell us your date, location, and roles. Choose labor supply or managed labor — where we provide an on-site supervisor too.' },
            { step: '02', title: 'GPS-verified crew arrives', body: 'Every worker checks in via geofence at your venue. You see who\'s on site in real time — no disputed hours, no ghost check-ins.' },
            { step: '03', title: 'We handle the ground', body: 'For managed events, your V&A Workforce supervisor runs the crew, logs incidents, and gives you a clean post-event report. One call, one invoice.' },
          ].map(({ step, title, body }) => (
            <div key={step}>
              <div className="text-[#ffffff] font-extrabold text-sm mb-2">{step}</div>
              <div className="text-white font-bold text-lg mb-2">{title}</div>
              <div className="text-[#777] text-sm leading-relaxed">{body}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Service Tiers */}
      <div className="px-6 py-16 border-t border-[#1a1a1a] max-w-4xl mx-auto w-full">
        <h2 className="text-2xl font-extrabold mb-6 tracking-tight">Two Ways to Work With V&A Workforce</h2>
        <div className="grid md:grid-cols-2 gap-6">
          <div className="border border-[#1e1e1e] rounded-xl p-5">
            <h3 className="text-white font-bold mb-2">Labor Supply</h3>
            <p className="text-[#777] text-sm leading-relaxed">We provide pre-screened workers with GPS check-in. You provide supervision on site. Best for operators who manage their own crews.</p>
          </div>
          <div className="border border-[#ffffff]/30 bg-[#ffffff]/[0.02] rounded-xl p-5">
            <h3 className="text-white font-bold mb-2">Managed Labor</h3>
            <p className="text-[#777] text-sm leading-relaxed">We provide workers and a V&A Workforce site supervisor. They manage the crew, track attendance, log incidents, and report back to you. One call, zero labor headaches.</p>
          </div>
        </div>
      </div>

      {/* CTA */}
      <div className="px-6 py-16 border-t border-[#1a1a1a] bg-[#111] text-center">
        <h2 className="text-3xl font-extrabold mb-4 tracking-tight">Ready to staff your next event?</h2>
        <p className="text-[#888] mb-8">Submit a request and we'll confirm your crew within 24 hours. Labor supply or fully managed — your choice.</p>
        <button
          onClick={() => navigate('/events')}
          className="bg-[#ffffff] text-black rounded-full py-4 px-12 font-semibold text-base hover:opacity-90 transition-all duration-200"
        >
          Request Staff →
        </button>
      </div>

      <Footer />
    </div>
  )
}
