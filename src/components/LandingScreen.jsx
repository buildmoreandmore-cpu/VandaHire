import { useNavigate } from '../Router.jsx'

export default function LandingScreen({ onStart }) {
  const navigate = useNavigate()
  return (
    <div className="min-h-screen bg-[#0a0a0a] flex flex-col px-6">
      {/* Wordmark */}
      <div className="pt-8 pb-0 flex items-center justify-between">
        <span className="text-white font-extrabold text-2xl tracking-tight">Vanda</span>
        <a href="/admin" className="text-[#777] text-sm hover:text-white transition-colors">
          Coordinator Login
        </a>
      </div>

      {/* Center content */}
      <div className="flex-1 flex flex-col justify-center items-center text-center max-w-[520px] mx-auto w-full py-16">
        <h1 className="text-5xl font-extrabold text-white leading-none tracking-tighter mb-3 fade-up">
          Show up.<br />Get paid.
        </h1>

        <p className="text-[#c8ff00] text-sm font-semibold tracking-wide mb-8 fade-up">
          The People Behind What Works.
        </p>

        <p className="text-[#888] text-base leading-relaxed mb-10 fade-up-delay-1">
          Staffing for events, activations, festivals, janitorial, setup, and facilities.
          Apply for work or request staff in a few minutes.
        </p>

        <div className="w-full max-w-sm space-y-3 fade-up-delay-2">
          <button
            onClick={onStart}
            className="bg-[#c8ff00] text-black rounded-full py-4 px-10 font-semibold text-base hover:opacity-90 transition-all duration-200 w-full"
          >
            I’m Looking for Work →
          </button>

          <button
            onClick={() => navigate('/events')}
            className="block w-full rounded-full py-4 px-10 font-semibold text-base border border-[#2a2a2a] text-white hover:border-[#444] hover:bg-[#111] transition-all duration-200 cursor-pointer"
          >
            I Need Staff for an Event →
          </button>
        </div>

        <p className="fade-up-delay-3 text-[#555] text-sm mt-6">
          Workers can apply in minutes. Event organizers can request staff on the same site.
        </p>
      </div>
    </div>
  )
}
