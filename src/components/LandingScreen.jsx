export default function LandingScreen({ onStart }) {
  return (
    <div className="min-h-screen bg-[#0a0a0a] flex flex-col px-6 overflow-hidden relative">

      {/* Background glow orbs */}
      <div className="glow-green orb-float" style={{ top: '-60px', left: '-100px' }} />
      <div className="glow-orange orb-float-reverse" style={{ bottom: '80px', right: '-80px' }} />

      {/* Wordmark */}
      <div className="pt-8 pb-0 relative z-10 flex items-center gap-2">
        <span className="text-white font-extrabold text-2xl tracking-tight">Porter</span>
        <span
          className="text-[10px] font-bold uppercase tracking-widest px-2 py-[3px] rounded-full"
          style={{ background: 'rgba(255,92,0,0.15)', color: '#FF5C00', border: '1px solid rgba(255,92,0,0.3)' }}
        >
          Hiring Now
        </span>
      </div>

      {/* Center content */}
      <div className="flex-1 flex flex-col justify-center items-center text-center max-w-[480px] mx-auto w-full py-16 relative z-10">

        {/* Eyebrow badge */}
        <div
          className="fade-up inline-flex items-center gap-2 rounded-full px-4 py-2 mb-6 text-xs font-semibold"
          style={{
            background: 'linear-gradient(90deg, rgba(200,255,0,0.08), rgba(255,92,0,0.08))',
            border: '1px solid rgba(200,255,0,0.15)',
            color: '#aaa',
          }}
        >
          <span className="w-1.5 h-1.5 rounded-full bg-[#c8ff00] inline-block" style={{ boxShadow: '0 0 6px #c8ff00' }} />
          No interview · Apply in 3 min
        </div>

        <h1 className="text-6xl font-extrabold leading-none tracking-tighter mb-5 fade-up-delay-1">
          <span className="text-white">Show up.</span>
          <br />
          <span className="gradient-text">Get paid.</span>
        </h1>

        <p className="text-[#888] text-base leading-relaxed mb-10 fade-up-delay-2 max-w-[340px]">
          Event staffing for janitorial, setup, brand activation, festivals, and facilities.
        </p>

        <button
          onClick={onStart}
          className="fade-up-delay-2 text-black rounded-full py-4 px-10 font-bold text-base transition-all duration-200 w-full max-w-xs relative overflow-hidden group"
          style={{ background: 'linear-gradient(90deg, #c8ff00 0%, #e8ff50 100%)' }}
        >
          <span className="relative z-10">Apply Now →</span>
          <div
            className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-200"
            style={{ background: 'linear-gradient(90deg, #b8ee00 0%, #c8ff00 100%)' }}
          />
        </button>

        {/* Stats row */}
        <div className="fade-up-delay-3 flex items-center gap-6 mt-10">
          <div className="text-center">
            <p className="text-white font-bold text-lg leading-none">48h</p>
            <p className="text-[#555] text-[11px] mt-1">Pay turnaround</p>
          </div>
          <div className="w-px h-8 bg-[#222]" />
          <div className="text-center">
            <p className="text-white font-bold text-lg leading-none">3 min</p>
            <p className="text-[#555] text-[11px] mt-1">To apply</p>
          </div>
          <div className="w-px h-8 bg-[#222]" />
          <div className="text-center">
            <p className="text-white font-bold text-lg leading-none">50</p>
            <p className="text-[#555] text-[11px] mt-1">States</p>
          </div>
        </div>

        <p className="fade-up-delay-3 text-[#444] text-xs mt-6">
          Joining is free. Shifts start as soon as you're approved.
        </p>
      </div>
    </div>
  )
}
