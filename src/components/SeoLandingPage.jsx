import { useEffect } from 'react'
import { useNavigate } from '../Router.jsx'
import Footer from './Footer.jsx'
import VandaLogo from './VandaLogo.jsx'

export default function SeoLandingPage({ keyword, headline, subhead, description }) {
  const navigate = useNavigate()

  useEffect(() => {
    const prevTitle = document.title
    document.title = `${headline} | Vanda`

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
          className="bg-[#3ecf8e] text-black rounded-full py-4 px-10 font-semibold text-base hover:opacity-90 transition-all duration-200 fade-up-delay-2"
        >
          Request Staff →
        </button>

        {/* Social proof — processing fluency */}
        <div className="flex flex-wrap items-center gap-4 mt-8 text-xs text-[#555] fade-up-delay-3">
          <span className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-[#3ecf8e]" />
            Vetted-only worker pool
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-[#3ecf8e]" />
            SMS briefings before every shift
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-[#3ecf8e]" />
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
            { step: '01', title: 'Submit your event', body: 'Tell us your date, location, roles needed, and any briefing requirements. Takes under 5 minutes.' },
            { step: '02', title: 'We staff your crew', body: 'Vanda reviews your request, selects vetted and approved workers, and confirms your roster.' },
            { step: '03', title: 'Workers dispatched via SMS', body: 'Each worker receives their shift details, meeting point, supervisor info, and briefing schedule by text.' },
          ].map(({ step, title, body }) => (
            <div key={step}>
              <div className="text-[#3ecf8e] font-extrabold text-sm mb-2">{step}</div>
              <div className="text-white font-bold text-lg mb-2">{title}</div>
              <div className="text-[#777] text-sm leading-relaxed">{body}</div>
            </div>
          ))}
        </div>
      </div>

      {/* CTA */}
      <div className="px-6 py-16 border-t border-[#1a1a1a] bg-[#111] text-center">
        <h2 className="text-3xl font-extrabold mb-4 tracking-tight">Ready to staff your next event?</h2>
        <p className="text-[#888] mb-8">Submit a request and we'll confirm your crew within 24 hours.</p>
        <button
          onClick={() => navigate('/events')}
          className="bg-[#3ecf8e] text-black rounded-full py-4 px-12 font-semibold text-base hover:opacity-90 transition-all duration-200"
        >
          Request Staff →
        </button>
      </div>

      <Footer />
    </div>
  )
}
