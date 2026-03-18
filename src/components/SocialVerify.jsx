import ProgressBar from './ProgressBar.jsx'
import OAuthButton from './OAuthButton.jsx'

export default function SocialVerify({ socialData, onConnect, onSubmit, submitting, submitError }) {
  const requiredConnected = [
    socialData.instagram_connected,
    socialData.facebook_connected,
    socialData.tiktok_connected,
  ].filter(Boolean).length

  const canSubmit = requiredConnected >= 2 && !submitting

  return (
    <div className="min-h-screen bg-[#0a0a0a] flex flex-col">
      <ProgressBar step={2} />

      <div className="flex-1 flex flex-col max-w-[480px] mx-auto w-full px-6 py-10">
        {/* Header */}
        <div className="mb-8">
          <span className="text-white font-extrabold text-xl tracking-tight">Porter</span>
          <p className="text-[#555] text-xs mt-1">Step 2 of 3</p>
        </div>

        <h2 className="text-3xl font-bold text-white mb-2 tracking-tight">
          Last step — verify your identity
        </h2>
        <p className="text-[#888] text-sm mb-8 leading-relaxed">
          Connect your socials to skip the interview entirely. We never post, follow, or message on your behalf.
        </p>

        {/* Required indicator */}
        <div className="flex items-center gap-2 mb-4">
          <span
            className={`text-xs font-semibold tabular-nums ${
              requiredConnected >= 2 ? 'text-[#c8ff00]' : 'text-[#888]'
            }`}
          >
            {requiredConnected}/2 required connected
          </span>
          {requiredConnected >= 2 && (
            <svg className="w-4 h-4 text-[#c8ff00]" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          )}
        </div>

        <div className="flex flex-col gap-3 mb-6">
          <OAuthButton
            platform="instagram"
            connected={socialData.instagram_connected}
            onConnect={onConnect}
          />
          <OAuthButton
            platform="facebook"
            connected={socialData.facebook_connected}
            onConnect={onConnect}
          />
          <OAuthButton
            platform="tiktok"
            connected={socialData.tiktok_connected}
            onConnect={onConnect}
          />
          <OAuthButton
            platform="linkedin"
            connected={socialData.linkedin_connected}
            onConnect={onConnect}
            optional
          />
        </div>

        {/* Privacy note */}
        <p className="text-[#555] text-xs leading-relaxed mb-8">
          We only read public profile data to verify identity. Nothing is stored beyond what's needed for your application. We never post or message on your behalf.
        </p>

        {submitError && (
          <div className="mb-4 bg-[#ff4444]/10 border border-[#ff4444]/30 rounded-xl px-4 py-3">
            <p className="text-[#ff4444] text-sm">{submitError}</p>
          </div>
        )}

        <button
          onClick={onSubmit}
          disabled={!canSubmit}
          className={`
            w-full rounded-full py-4 font-semibold text-base transition-all duration-200 flex items-center justify-center gap-2
            ${canSubmit
              ? 'bg-[#c8ff00] text-black hover:opacity-90 cursor-pointer'
              : 'bg-[#333] text-[#666] cursor-not-allowed'
            }
          `}
        >
          {submitting ? (
            <>
              <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              Submitting...
            </>
          ) : (
            'Submit Application →'
          )}
        </button>

        {!canSubmit && !submitting && (
          <p className="text-[#555] text-xs text-center mt-3">
            Connect at least 2 of Instagram, Facebook, or TikTok to continue
          </p>
        )}
      </div>
    </div>
  )
}
