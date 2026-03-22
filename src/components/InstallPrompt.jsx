import { useState, useEffect } from 'react'

const DISMISS_KEY = 'vanda_install_dismissed'
const DISMISS_HOURS = 24

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
    if (ts && Date.now() - parseInt(ts, 10) < DISMISS_HOURS * 3600000) return

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
    const isAndroid = /android/i.test(navigator.userAgent)
    if (isIos && isSafari) setShowIosTip('ios')
    else if (isAndroid) setShowIosTip('android')

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
          <p className="text-white text-sm font-semibold mb-2">Install V&A Hire App</p>
          {deferredPrompt ? (
            <>
              <p className="text-[#888] text-xs mb-3">Install the app to get notified when your shifts are confirmed and new shifts are available.</p>
              <button
                onClick={handleInstall}
                className="bg-[#ffffff] text-black rounded-full px-5 py-2 text-xs font-semibold hover:opacity-90 transition-all"
              >
                Install App
              </button>
            </>
          ) : showIosTip === 'android' ? (
            <div className="space-y-2.5">
              <p className="text-[#888] text-xs">Install the app to get shift notifications:</p>
              <div className="flex items-center gap-3 text-xs">
                <span className="flex-shrink-0 w-6 h-6 rounded-full bg-white/10 flex items-center justify-center text-white font-bold text-[10px]">1</span>
                <span className="text-[#ccc]">
                  Tap the <span className="inline-block align-middle mx-0.5">
                    <svg className="w-4 h-4 inline" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><circle cx="12" cy="5" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="12" cy="19" r="1.5"/></svg>
                  </span> <strong className="text-white">menu</strong> (3 dots) in the top right of Chrome
                </span>
              </div>
              <div className="flex items-center gap-3 text-xs">
                <span className="flex-shrink-0 w-6 h-6 rounded-full bg-white/10 flex items-center justify-center text-white font-bold text-[10px]">2</span>
                <span className="text-[#ccc]">Tap <strong className="text-white">Add to Home screen</strong></span>
              </div>
              <div className="flex items-center gap-3 text-xs">
                <span className="flex-shrink-0 w-6 h-6 rounded-full bg-white/10 flex items-center justify-center text-white font-bold text-[10px]">3</span>
                <span className="text-[#ccc]">Tap <strong className="text-white">Add</strong> to confirm</span>
              </div>
            </div>
          ) : (
            <div className="space-y-2.5">
              <p className="text-[#888] text-xs"><strong className="text-[#ccc]">Required on iPhone</strong> to receive shift notifications:</p>
              <div className="flex items-center gap-3 text-xs">
                <span className="flex-shrink-0 w-6 h-6 rounded-full bg-white/10 flex items-center justify-center text-white font-bold text-[10px]">1</span>
                <span className="text-[#ccc]">
                  Tap the <span className="inline-block align-middle mx-0.5">
                    <svg className="w-4 h-4 inline" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2M12 4v12m0 0l-4-4m4 4l4-4" /></svg>
                  </span> <strong className="text-white">Share</strong> button at the bottom of Safari
                </span>
              </div>
              <div className="flex items-center gap-3 text-xs">
                <span className="flex-shrink-0 w-6 h-6 rounded-full bg-white/10 flex items-center justify-center text-white font-bold text-[10px]">2</span>
                <span className="text-[#ccc]">Scroll down and tap <strong className="text-white">Add to Home Screen</strong></span>
              </div>
              <div className="flex items-center gap-3 text-xs">
                <span className="flex-shrink-0 w-6 h-6 rounded-full bg-white/10 flex items-center justify-center text-white font-bold text-[10px]">3</span>
                <span className="text-[#ccc]">Tap <strong className="text-white">Add</strong> in the top right</span>
              </div>
            </div>
          )}
        </div>
        <button onClick={handleDismiss} className="text-[#555] hover:text-white text-lg leading-none mt-0.5">&times;</button>
      </div>
    </div>
  )
}
