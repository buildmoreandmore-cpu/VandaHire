import { useEffect } from 'react'
import ProgressBar from './ProgressBar.jsx'

export default function SubmittedScreen({ firstName }) {
  // Positive reinforcement: haptic feedback on submission success
  useEffect(() => {
    if (navigator.vibrate) navigator.vibrate([80, 50, 80])
  }, [])

  return (
    <div className="min-h-screen bg-[#0a0a0a] flex flex-col">
      <ProgressBar step={2} total={2} />

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
              stroke="#3ecf8e"
              strokeWidth="4"
              strokeLinecap="round"
            />
            <polyline
              className="check-mark"
              points="30,52 44,66 70,38"
              stroke="#3ecf8e"
              strokeWidth="5"
              strokeLinecap="round"
              strokeLinejoin="round"
              fill="none"
            />
          </svg>
        </div>

        <h2 className="text-4xl font-extrabold text-white tracking-tight mb-3 fade-up">
          {firstName ? `You're in, ${firstName}.` : "You're submitted."}
        </h2>

        <p className="text-[#888] text-base leading-relaxed mb-4 fade-up-delay-1">
          Check your email in the next few minutes.
        </p>

        <p className="text-[#555] text-xs leading-relaxed mb-8 fade-up-delay-2 max-w-xs">
          Applying does not guarantee placement. Shifts are offered based on location, availability, and fit.
        </p>

        <p className="text-[#555] text-sm fade-up-delay-2">
          Questions? Email us at{' '}
          <a
            href="mailto:crew@joinvanda.co"
            className="text-[#888] hover:text-[#3ecf8e] transition-colors duration-200"
          >
            crew@joinvanda.co
          </a>
        </p>
      </div>
    </div>
  )
}
