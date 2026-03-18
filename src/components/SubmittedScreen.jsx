import ProgressBar from './ProgressBar.jsx'

export default function SubmittedScreen({ firstName }) {
  return (
    <div className="min-h-screen bg-[#0a0a0a] flex flex-col">
      <ProgressBar step={3} />

      <div className="flex-1 flex flex-col items-center justify-center max-w-[480px] mx-auto w-full px-6 text-center">
        {/* Animated checkmark */}
        <div className="mb-8">
          <svg
            className="w-20 h-20"
            viewBox="0 0 100 100"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <circle
              className="check-circle"
              cx="50"
              cy="50"
              r="46"
              stroke="#c8ff00"
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

        <h2 className="text-4xl font-extrabold text-white tracking-tight mb-3 fade-up">
          You're submitted.
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
