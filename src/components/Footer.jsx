import { useNavigate } from '../Router.jsx'
import VandaLogo from './VandaLogo.jsx'

export default function Footer() {
  const navigate = useNavigate()
  const go = (path) => { navigate(path); window.scrollTo(0, 0) }

  return (
    <footer className="border-t border-[#1a1a1a] bg-[#0a0a0a] px-6 py-14 mt-20">
      <div className="max-w-4xl mx-auto">
        {/* Top: Logo */}
        <div className="flex justify-center mb-10">
          <VandaLogo size="sm" onClick={() => go('/')} />
        </div>

        {/* Link columns — 2-col on mobile, 3-col on desktop */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-8 gap-y-8 mb-10 text-sm">
          {/* Column 1: For Event Organizers */}
          <div>
            <h4 className="text-[#888] text-xs font-semibold uppercase tracking-wider mb-3">For Organizers</h4>
            <div className="flex flex-col gap-2.5 text-p-link">
              <button onClick={() => go('/events')} className="text-left hover:text-white transition-colors">Request Staff</button>
              <button onClick={() => go('/organizer')} className="text-left hover:text-white transition-colors">Event Status</button>
              <button onClick={() => go('/how-it-works')} className="text-left hover:text-white transition-colors">How It Works</button>
              <button onClick={() => go('/blog')} className="text-left hover:text-white transition-colors">Blog</button>
            </div>
          </div>

          {/* Column 2: For Workers */}
          <div>
            <h4 className="text-[#888] text-xs font-semibold uppercase tracking-wider mb-3">For Workers</h4>
            <div className="flex flex-col gap-2.5 text-p-link">
              <button onClick={() => go('/')} className="text-left hover:text-white transition-colors">Apply for Work</button>
              <button onClick={() => go('/shifts')} className="text-left hover:text-white transition-colors">Available Shifts</button>
              <button onClick={() => go('/my-shifts')} className="text-left hover:text-white transition-colors">My Shifts</button>
              <button onClick={() => go('/verify')} className="text-left hover:text-white transition-colors">Verification Video</button>
              <button onClick={() => go('/id-upload')} className="text-left hover:text-white transition-colors">Upload ID</button>
              <button onClick={() => go('/w9')} className="text-left hover:text-white transition-colors">W-9 Form</button>
            </div>
          </div>

          {/* Column 3: Portals */}
          <div className="col-span-2 sm:col-span-1">
            <h4 className="text-[#888] text-xs font-semibold uppercase tracking-wider mb-3">Portals</h4>
            <div className="flex flex-col gap-2.5 text-p-link">
              <button onClick={() => go('/supervisor')} className="text-left hover:text-white transition-colors">Supervisor Portal</button>
              <a href="/admin" className="hover:text-white transition-colors">Coordinator Login</a>
            </div>
          </div>
        </div>

        {/* Phone */}
        <div className="text-center mb-4">
          <a href="tel:+14048617794" className="text-p-link text-sm hover:text-white transition-colors font-medium">(404) 861-7794</a>
        </div>

        {/* Address */}
        <p className="text-center text-[#444] text-xs mb-6">196 Peachtree St SW, #121, Atlanta, GA 30303</p>

        {/* Divider */}
        <div className="w-full h-px bg-[#1a1a1a] mb-6" />

        {/* Bottom: legal links + copyright */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-[#444]">
          <div className="flex gap-6">
            <button onClick={() => go('/privacy')} className="hover:text-[#666] transition-colors">Privacy Policy</button>
            <button onClick={() => go('/terms')} className="hover:text-[#666] transition-colors">Terms of Service</button>
          </div>
          <p>© 2026 V&A Hire · Varist & Associates of GA LLC</p>
        </div>
      </div>
    </footer>
  )
}
