import ProgressBar from './ProgressBar.jsx'

export default function SubmittedScreen({ firstName }) {
  return (
    <div className="min-h-screen bg-[#0a0a0a] flex flex-col overflow-hidden relative">
      <ProgressBar step={3} />

      {/* Subtle background glow */}
      <div className="glow-green" style={{ top: '-100px', left: '50%', transform: 'translateX(-50%)' }} />

      <div className="flex-1 flex flex-col items-center justify-center max-w-[480px] mx-auto w-full px-6 text-center relative z-10">
        {/* Animated checkmark — circle orange→green gradient */}
        <div className="mb-8 relative">
          {/* Outer glow ring */}
          <div
            className="absolute inset-0 rounded-full"
            style={{
              background: 'radial-gradient(circle, rgba(200,255,0,0.08) 0%, transparent 70%)',
              transform: 'scale(1.4)',
            }}
          />
          <svg
            className="w-24 h-24 relative z-10"
            viewBox="0 0 100 100"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <defs>
              <linearGradient id="circleGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#FF5C00" />
                <stop offset="100%" stopColor="#c8ff00" />
              </linearGradient>
            </defs>
            <circle
              className="check-circle"
              cx="50"
              cy="50"
              r="46"
              stroke="url(#circleGrad)"
              strokeWidth="4"
              strokeLinecap="round"
            />
            <polyline
              className="check-mark"
              points="30,52 44,66 70,38"
              stroke="#c8ff00"
              strokeWidth="5"
              strokeLinecap="round"
              strokeLinejoin="round"
              fill="none"
            />
          </svg>
        </div>

        <h2 className="text-4xl font-extrabold tracking-tight mb-3 fade-up">
          <span className="text-white">You're </span>
          <span className="gradient-text">submitted.</span>
        </h2>

        <p className="text-[#888] text-base leading-relaxed mb-8 fade-up-delay-1">
          Check your email in the next few minutes.
        </p>

        <p className="text-[#555] text-sm fade-up-delay-2">
          Questions? Email us at{' '}
          <a
            href="mailto:crew@joinporter.co"
            className="text-[#888] hover:text-[#c8ff00] transition-colors duration-200"
          >
            crew@joinporter.co
          </a>
        </p>
      </div>
    </div>
  )
}
