import { useNavigate } from '../Router.jsx'
import VandaLogo from '../components/VandaLogo.jsx'

const IconPhone = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
    <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.91.34 1.85.57 2.81.7A2 2 0 0 1 22 16.92z" />
  </svg>
)
const IconMail = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
    <rect x="2" y="4" width="20" height="16" rx="2" /><path d="M2 6l10 7 10-7" />
  </svg>
)

export default function SupportPage() {
  const navigate = useNavigate()
  return (
    <div className="min-h-screen bg-[#0a0a0a] font-inter">
      <div className="max-w-2xl mx-auto px-6 py-8">
        <div className="mb-8 flex items-center justify-between">
          <VandaLogo onClick={() => navigate('/')} />
          <button onClick={() => navigate('/')} className="text-[#555] text-sm hover:text-white transition-colors">← Back</button>
        </div>

        <div className="text-p-green font-semibold text-xs tracking-widest uppercase mb-3">Support</div>
        <h1 className="text-4xl font-extrabold text-white tracking-tighter mb-3">How can we help?</h1>
        <p className="text-[#888] text-base leading-relaxed mb-8">
          V&A Hire — Varist &amp; Associates of Georgia LLC. Reach us any time and we'll get back to you as soon as possible.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-8">
          <a href="sms:+14049057443" className="flex items-center gap-3 rounded-2xl border border-[#1e1e1e] bg-[#0e0e0e] p-4 hover:border-p-green/60 transition-all">
            <span className="text-p-green"><IconPhone /></span>
            <div>
              <div className="text-white font-semibold text-sm">Text</div>
              <div className="text-[#888] text-xs">(404) 905-7443</div>
              <div className="text-[#555] text-[11px] mt-0.5">Text only — no calls</div>
            </div>
          </a>
          <a href="mailto:info@vassoc.com" className="flex items-center gap-3 rounded-2xl border border-[#1e1e1e] bg-[#0e0e0e] p-4 hover:border-p-green/60 transition-all">
            <span className="text-p-green"><IconMail /></span>
            <div>
              <div className="text-white font-semibold text-sm">Email</div>
              <div className="text-[#888] text-xs">info@vassoc.com</div>
            </div>
          </a>
        </div>

        <div className="rounded-2xl border border-[#1e1e1e] bg-[#0e0e0e] p-5 mb-6">
          <h2 className="text-white font-bold text-lg mb-3">Text messages (SMS)</h2>
          <ul className="text-[#999] text-sm leading-relaxed space-y-2 list-disc list-inside">
            <li>We text customer care, assignment confirmations, scheduling, status updates, and reminders only to workers who applied and opted in.</li>
            <li>Reply <strong className="text-white">STOP</strong> to any message to opt out at any time.</li>
            <li>Reply <strong className="text-white">HELP</strong>, or call/email us above, for assistance.</li>
            <li>Message frequency varies. Message &amp; data rates may apply.</li>
          </ul>
        </div>

        <div className="rounded-2xl border border-[#1e1e1e] bg-[#0e0e0e] p-5">
          <h2 className="text-white font-bold text-lg mb-2">Looking for work?</h2>
          <p className="text-[#888] text-sm leading-relaxed mb-4">Apply once and get matched to event shifts across metro Atlanta.</p>
          <button onClick={() => navigate('/apply')} className="bg-p-green text-black rounded-full py-3 px-7 font-semibold text-sm hover:opacity-90 transition-all">
            Apply to Work →
          </button>
        </div>

        <div className="mt-10 pt-6 border-t border-[#1a1a1a] text-[#555] text-xs">
          Varist &amp; Associates of Georgia LLC · 470 16th Street NW, Unit 2024, Atlanta, GA 30363<br />
          <button onClick={() => navigate('/privacy')} className="hover:text-white transition-colors mt-2 mr-4">Privacy Policy</button>
          <button onClick={() => navigate('/terms')} className="hover:text-white transition-colors">Terms of Service</button>
        </div>
      </div>
    </div>
  )
}
