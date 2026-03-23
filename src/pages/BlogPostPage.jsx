import { useEffect } from 'react'
import { useNavigate } from '../Router.jsx'
import Footer from '../components/Footer.jsx'
import VandaLogo from '../components/VandaLogo.jsx'
import posts from '../content/posts/index.js'

function renderBlock(block, i) {
  if (block.type === 'h2') {
    return (
      <h2 key={i} className="text-2xl font-extrabold mt-10 mb-4 tracking-tight text-white">
        {block.text}
      </h2>
    )
  }
  return (
    <p key={i} className="text-[#888] text-base leading-relaxed">
      {block.text}
    </p>
  )
}

export default function BlogPostPage({ slug }) {
  const navigate = useNavigate()
  const post = posts.find((p) => p.slug === slug)

  useEffect(() => {
    if (!post) return

    const prevTitle = document.title
    document.title = `${post.title} | V&A Hire`

    let metaDesc = document.querySelector('meta[name="description"]')
    if (!metaDesc) {
      metaDesc = document.createElement('meta')
      metaDesc.setAttribute('name', 'description')
      document.head.appendChild(metaDesc)
    }
    const prevDesc = metaDesc.getAttribute('content')
    metaDesc.setAttribute('content', post.description)

    return () => {
      document.title = prevTitle
      if (metaDesc) metaDesc.setAttribute('content', prevDesc)
    }
  }, [post])

  if (!post) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] text-white flex flex-col items-center justify-center">
        <p className="text-[#555] text-lg mb-6">Post not found.</p>
        <button
          onClick={() => navigate('/blog')}
          className="text-[#ffffff] font-semibold hover:opacity-80 transition-opacity"
        >
          ← Back to Blog
        </button>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white flex flex-col">
      <div className="px-6 pt-8 flex items-center justify-between max-w-4xl mx-auto w-full">
        <VandaLogo onClick={() => navigate('/')} />
        <a href="/admin" className="text-p-link text-sm hover:text-white transition-colors">Coordinator Login</a>
      </div>

      <div className="px-6 py-16 max-w-4xl mx-auto w-full">
        <button
          onClick={() => navigate('/blog')}
          className="text-p-green text-sm hover:opacity-80 transition-colors mb-8 block"
        >
          ← All guides
        </button>

        <div className="text-[#555] text-xs font-mono mb-4">{post.date}</div>

        <h1 className="text-4xl md:text-5xl font-extrabold leading-tight tracking-tighter mb-6 fade-up">
          {post.title}
        </h1>

        <p className="text-[#888] text-lg mb-12 max-w-2xl border-b border-[#1a1a1a] pb-8">
          {post.description}
        </p>

        <div className="space-y-5 max-w-2xl">
          {post.body.map((block, i) => renderBlock(block, i))}
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
