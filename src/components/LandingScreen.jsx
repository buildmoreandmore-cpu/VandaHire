export default function LandingScreen({ onStart }) {
  return (
    <div className="min-h-screen bg-[#0a0a0a] flex flex-col px-6">
      {/* Wordmark */}
      <div className="pt-8 pb-0">
        <span className="text-white font-extrabold text-2xl tracking-tight">Porter</span>
      </div>

      {/* Center content */}
      <div className="flex-1 flex flex-col justify-center items-center text-center max-w-[480px] mx-auto w-full py-16">
        <h1 className="text-5xl font-extrabold text-white leading-none tracking-tighter mb-3 fade-up">
          Show up.<br />Get paid.
        </h1>

        <p className="text-[#c8ff00] text-sm font-semibold tracking-wide mb-8 fade-up">
          The People Behind What Works.
        </p>

        <p className="text-[#888] text-base leading-relaxed mb-10 fade-up-delay-1">
          Event staffing for janitorial, setup, brand activation, festivals, and facilities.
          No interview. Apply in 3 minutes.
        </p>

        <button
          onClick={onStart}
          className="fade-up-delay-2 bg-[#c8ff00] text-black rounded-full py-4 px-10 font-semibold text-base hover:opacity-90 transition-all duration-200 w-full max-w-xs"
        >
          Apply Now →
        </button>

        <p className="fade-up-delay-3 text-[#555] text-sm mt-6">
          Joining is free. Shifts start as soon as you're approved.
        </p>
      </div>
    </div>
  )
}
