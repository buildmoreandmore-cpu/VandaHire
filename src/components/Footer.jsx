import { useNavigate } from '../Router.jsx'
import VandaLogo from './VandaLogo.jsx'

export default function Footer() {
  const navigate = useNavigate()
  return (
    <footer className="border-t border-[#1a1a1a] bg-[#0a0a0a] px-6 py-14 mt-20">
      <div className="max-w-4xl mx-auto">
        {/* Top: Logo */}
        <div className="flex justify-center mb-8">
          <VandaLogo size="sm" onClick={() => navigate('/')} />
        </div>

        {/* Nav links */}
        <div className="flex flex-col items-center gap-3 sm:flex-row sm:flex-wrap sm:justify-center sm:gap-x-8 sm:gap-y-3 text-sm text-[#666] mb-8">
          <button onClick={() => navigate('/how-it-works')} className="hover:text-white transition-colors">How It Works</button>
          <button onClick={() => navigate('/events')} className="hover:text-white transition-colors">Request Staff</button>
          <button onClick={() => { navigate('/'); window.scrollTo(0, 0) }} className="hover:text-white transition-colors">Apply for Work</button>
          <button onClick={() => navigate('/organizer')} className="hover:text-white transition-colors">Check Event Status</button>
          <button onClick={() => navigate('/blog')} className="hover:text-white transition-colors">Blog</button>
        </div>

        {/* Divider */}
        <div className="w-full h-px bg-[#1a1a1a] mb-6" />

        {/* Bottom: legal links + copyright */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-[#444]">
          <div className="flex gap-6">
            <button onClick={() => navigate('/privacy')} className="hover:text-[#666] transition-colors">Privacy Policy</button>
            <button onClick={() => navigate('/terms')} className="hover:text-[#666] transition-colors">Terms of Service</button>
          </div>
          <p>© 2026 V&A Hire</p>
        </div>
      </div>
    </footer>
  )
}
