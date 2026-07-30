import React from 'react'
import ReactDOM from 'react-dom/client'
import { registerSW } from 'virtual:pwa-register'
import Router from './Router.jsx'
import './index.css'

// Keep the installed app fresh. Check for a new build every minute, and apply it
// the moment the app is focused (reopened, or tabbed back to) — so nobody gets
// stuck on a cached old version. We only reload on a visibility change, never
// mid-task while they're actively using it.
let pendingUpdate = false
const updateSW = registerSW({
  immediate: true,
  onNeedRefresh() { pendingUpdate = true; applyIfSafe() },
  onRegisteredSW(swUrl, registration) {
    if (registration) setInterval(() => { registration.update().catch(() => {}) }, 60 * 1000)
  },
})
function applyIfSafe() {
  // Apply on focus/return, not while the tab is hidden or on first paint.
  if (pendingUpdate && document.visibilityState === 'visible' && document.hasFocus?.() !== false) {
    // slight delay so we don't reload in the middle of the current interaction
    setTimeout(() => { if (pendingUpdate) { pendingUpdate = false; updateSW(true) } }, 400)
  }
}
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') applyIfSafe() })
window.addEventListener('focus', applyIfSafe)

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <Router />
  </React.StrictMode>,
)
