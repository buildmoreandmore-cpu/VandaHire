import { useNavigate } from '../Router.jsx'
import VandaLogo from './VandaLogo.jsx'

export default function Footer() {
  const navigate = useNavigate()
  return (
    <footer className="border-t border-[#1a1a1a] bg-[#0a0a0a] px-6 py-10 mt-20">
      <div className="max-w-4xl mx-auto flex flex-col md:flex-row items-start md:items-center justify-between gap-8">
        <div className="flex items-center gap-3">
          <VandaLogo size="sm" onClick={() => navigate('/')} />
        </div>

        <nav className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-[#777]">
          <button onClick={() => navigate('/how-it-works')} className="hover:text-white transition-colors">How It Works</button>
          <button onClick={() => navigate('/events')} className="hover:text-white transition-colors">Request Staff</button>
          <button onClick={() => navigate('/')} className="hover:text-white transition-colors">Apply for Work</button>
          <button onClick={() => navigate('/status')} className="hover:text-white transition-colors">Worker Status</button>
          <button onClick={() => navigate('/organizer')} className="hover:text-white transition-colors">Organizer Portal</button>
          <button onClick={() => navigate('/blog')} className="hover:text-white transition-colors">Blog</button>
          <button onClick={() => navigate('/privacy')} className="hover:text-white transition-colors">Privacy</button>
          <button onClick={() => navigate('/terms')} className="hover:text-white transition-colors">Terms</button>
        </nav>

        <div className="text-sm text-[#555]">
          <p>© 2026 Vanda</p>
        </div>
      </div>
    </footer>
  )
}
