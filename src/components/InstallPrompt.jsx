import { useState, useEffect } from 'react'

const DISMISS_KEY = 'vanda_install_dismissed'
const DISMISS_DAYS = 7

export default function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState(null)
  const [showIosTip, setShowIosTip] = useState(false)
  const [dismissed, setDismissed] = useState(true)

  useEffect(() => {
    // Check if already installed (standalone mode)
    if (window.matchMedia('(display-mode: standalone)').matches) return
    if (navigator.standalone) return

    // Check dismiss timestamp
    const ts = localStorage.getItem(DISMISS_KEY)
    if (ts && Date.now() - parseInt(ts, 10) < DISMISS_DAYS * 86400000) return

    setDismissed(false)

    // Android / Chrome
    const handler = (e) => {
      e.preventDefault()
      setDeferredPrompt(e)
    }
    window.addEventListener('beforeinstallprompt', handler)

    // iOS Safari detection
    const isIos = /iphone|ipad|ipod/i.test(navigator.userAgent)
    const isSafari = /safari/i.test(navigator.userAgent) && !/crios|fxios|chrome/i.test(navigator.userAgent)
    if (isIos && isSafari) setShowIosTip(true)

    return () => window.removeEventListener('beforeinstallprompt', handler)
  }, [])

  const handleInstall = async () => {
    if (!deferredPrompt) return
    deferredPrompt.prompt()
    const { outcome } = await deferredPrompt.userChoice
    if (outcome === 'accepted') setDismissed(true)
    setDeferredPrompt(null)
  }

  const handleDismiss = () => {
    localStorage.setItem(DISMISS_KEY, String(Date.now()))
    setDismissed(true)
  }

  if (dismissed || (!deferredPrompt && !showIosTip)) return null

  return (
    <div className="bg-[#111] border border-[#2a2a2a] rounded-xl p-4 mb-6">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1">
          <p className="text-white text-sm font-semibold mb-1">Install Vanda Hire</p>
          {deferredPrompt ? (
            <>
              <p className="text-[#888] text-xs mb-3">Add to your home screen for quick access to shifts and check-in.</p>
              <button
                onClick={handleInstall}
                className="bg-[#3ecf8e] text-black rounded-full px-5 py-2 text-xs font-semibold hover:opacity-90 transition-all"
              >
                Install App
              </button>
            </>
          ) : (
            <p className="text-[#888] text-xs leading-relaxed">
              Tap <span className="inline-block align-middle">
                <svg className="w-4 h-4 inline" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2M12 4v12m0 0l-4-4m4 4l4-4" /></svg>
              </span> Share, then <strong className="text-white">Add to Home Screen</strong> for quick access.
            </p>
          )}
        </div>
        <button onClick={handleDismiss} className="text-[#555] hover:text-white text-lg leading-none mt-0.5">&times;</button>
      </div>
    </div>
  )
}
