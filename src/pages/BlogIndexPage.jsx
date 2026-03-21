import { useEffect } from 'react'
import { useNavigate } from '../Router.jsx'
import Footer from '../components/Footer.jsx'
import VandaLogo from '../components/VandaLogo.jsx'
import posts from '../content/posts/index.js'

export default function BlogIndexPage() {
  const navigate = useNavigate()

  useEffect(() => {
    const prevTitle = document.title
    document.title = 'Event Staffing Blog — Atlanta Tips & Guides | V&A Workforce'

    let metaDesc = document.querySelector('meta[name="description"]')
    if (!metaDesc) {
      metaDesc = document.createElement('meta')
      metaDesc.setAttribute('name', 'description')
      document.head.appendChild(metaDesc)
    }
    const prevDesc = metaDesc.getAttribute('content')
    metaDesc.setAttribute('content', 'Practical guides for Atlanta event organizers — staffing ratios, briefing systems, cost breakdowns, and checklists.')

    return () => {
      document.title = prevTitle
      if (metaDesc) metaDesc.setAttribute('content', prevDesc)
    }
  }, [])

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white flex flex-col">
      <div className="px-6 pt-8 flex items-center justify-between max-w-4xl mx-auto w-full">
        <VandaLogo onClick={() => navigate('/')} />
        <a href="/admin" className="text-[#777] text-sm hover:text-white transition-colors">Coordinator Login</a>
      </div>

      <div className="px-6 py-16 max-w-4xl mx-auto w-full">
        <h1 className="text-4xl md:text-5xl font-extrabold leading-tight tracking-tighter mb-4 fade-up">
          Event Staffing Guides
        </h1>
        <p className="text-[#888] text-lg mb-12 max-w-2xl fade-up-delay-1">
          Practical advice for Atlanta event organizers — how to plan, brief, and staff any event.
        </p>

        <div className="space-y-8">
          {posts.map((post) => (
            <div
              key={post.slug}
              className="border border-[#1a1a1a] rounded-xl p-6 hover:border-[#333] transition-colors cursor-pointer"
              onClick={() => navigate(`/blog/${post.slug}`)}
            >
              <div className="text-[#555] text-xs font-mono mb-3">{post.date}</div>
              <h2 className="text-xl font-bold mb-2 hover:text-[#ffffff] transition-colors">
                {post.title}
              </h2>
              <p className="text-[#777] text-sm leading-relaxed">{post.description}</p>
              <div className="mt-4">
                <span className="text-[#ffffff] text-sm font-semibold">Read →</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="px-6 py-16 border-t border-[#1a1a1a] bg-[#111] text-center">
        <h2 className="text-3xl font-extrabold mb-4 tracking-tight">Ready to staff your next event?</h2>
        <p className="text-[#888] mb-8">Submit a request and we'll confirm your crew within 24 hours.</p>
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
