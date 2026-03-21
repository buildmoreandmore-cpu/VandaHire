import { useEffect } from 'react'
import { useNavigate } from '../Router.jsx'
import ProgressBar from './ProgressBar.jsx'

export default function SubmittedScreen({ firstName, phone }) {
  const navigate = useNavigate()
  const digits = (phone || '').replace(/\D/g, '')

  // Positive reinforcement: haptic feedback on submission success
  useEffect(() => {
    if (navigator.vibrate) navigator.vibrate([80, 50, 80])
  }, [])

  return (
    <div className="min-h-screen bg-[#0a0a0a] flex flex-col">
      <ProgressBar step={2} total={2} />

      <div className="flex-1 flex flex-col items-center justify-center max-w-[480px] mx-auto w-full px-6 text-center">
        {/* Animated checkmark */}
        <div className="mb-6">
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
              stroke="#ffffff"
              strokeWidth="4"
              strokeLinecap="round"
            />
            <polyline
              className="check-mark"
              points="30,52 44,66 70,38"
              stroke="#ffffff"
              strokeWidth="5"
              strokeLinecap="round"
              strokeLinejoin="round"
              fill="none"
            />
          </svg>
        </div>

        <h2 className="text-3xl font-extrabold text-white tracking-tight mb-3 fade-up">
          {firstName ? `You're in, ${firstName}.` : "You're submitted."}
        </h2>

        <p className="text-[#888] text-sm leading-relaxed mb-2 fade-up-delay-1">
          Your application has been received. We'll review it within 24 hours.
        </p>

        <p className="text-[#555] text-xs leading-relaxed mb-6 fade-up-delay-1 max-w-xs">
          While you wait, get ahead by completing your onboarding steps below. All three must be done before you can be assigned to shifts.
        </p>

        {/* Onboarding Steps */}
        <div className="w-full max-w-sm space-y-3 fade-up-delay-2">
          <button
            onClick={() => navigate('/verify')}
            style={{
              width: '100%', padding: '16px 20px', borderRadius: 10,
              background: '#141414', border: '1px solid #2a2a2a',
              color: '#fff', cursor: 'pointer', textAlign: 'left',
              display: 'flex', alignItems: 'center', gap: 14,
            }}
          >
            <span style={{ width: 32, height: 32, borderRadius: '50%', background: '#fff', color: '#000', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 14, flexShrink: 0 }}>1</span>
            <div>
              <div style={{ fontWeight: 600, fontSize: 14 }}>Record Verification Video</div>
              <div style={{ color: '#666', fontSize: 12, marginTop: 2 }}>Short video answering 2 questions</div>
            </div>
            <span style={{ marginLeft: 'auto', color: '#555', fontSize: 18 }}>→</span>
          </button>

          <button
            onClick={() => navigate(digits ? `/id-upload/${digits}` : '/id-upload')}
            style={{
              width: '100%', padding: '16px 20px', borderRadius: 10,
              background: '#141414', border: '1px solid #2a2a2a',
              color: '#fff', cursor: 'pointer', textAlign: 'left',
              display: 'flex', alignItems: 'center', gap: 14,
            }}
          >
            <span style={{ width: 32, height: 32, borderRadius: '50%', background: '#fff', color: '#000', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 14, flexShrink: 0 }}>2</span>
            <div>
              <div style={{ fontWeight: 600, fontSize: 14 }}>Upload ID Photo</div>
              <div style={{ color: '#666', fontSize: 12, marginTop: 2 }}>Government-issued ID</div>
            </div>
            <span style={{ marginLeft: 'auto', color: '#555', fontSize: 18 }}>→</span>
          </button>

          <button
            onClick={() => navigate(digits ? `/w9/${digits}` : '/w9')}
            style={{
              width: '100%', padding: '16px 20px', borderRadius: 10,
              background: '#141414', border: '1px solid #2a2a2a',
              color: '#fff', cursor: 'pointer', textAlign: 'left',
              display: 'flex', alignItems: 'center', gap: 14,
            }}
          >
            <span style={{ width: 32, height: 32, borderRadius: '50%', background: '#fff', color: '#000', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 14, flexShrink: 0 }}>3</span>
            <div>
              <div style={{ fontWeight: 600, fontSize: 14 }}>Complete W-9 Form</div>
              <div style={{ color: '#666', fontSize: 12, marginTop: 2 }}>Tax information for payroll</div>
            </div>
            <span style={{ marginLeft: 'auto', color: '#555', fontSize: 18 }}>→</span>
          </button>
        </div>

        <p className="text-[#444] text-xs mt-6 fade-up-delay-2">
          You can also complete these later — links are in your confirmation email and at the bottom of our site.
        </p>

        <p className="text-[#555] text-sm mt-6 fade-up-delay-2">
          Questions? Call us at{' '}
          <a
            href="tel:+14048617794"
            className="text-[#888] hover:text-[#ffffff] transition-colors duration-200"
          >
            (404) 861-7794
          </a>
        </p>
      </div>
    </div>
  )
}
