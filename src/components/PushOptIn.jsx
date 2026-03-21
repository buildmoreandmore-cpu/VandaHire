import { useState, useEffect } from 'react'
import { isPushSupported, isPushSubscribed, subscribeToPush } from '../lib/pushNotifications.js'

export default function PushOptIn({ phone }) {
  const [supported, setSupported] = useState(false)
  const [subscribed, setSubscribed] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [dismissed, setDismissed] = useState(false)

  useEffect(() => {
    const check = async () => {
      const sup = await isPushSupported()
      setSupported(sup)
      if (sup) {
        const sub = await isPushSubscribed()
        setSubscribed(sub)
      }
    }
    check()

    // Check if dismissed recently (24h)
    const ts = localStorage.getItem('vanda_push_dismissed')
    if (ts && Date.now() - parseInt(ts, 10) < 86400000) setDismissed(true)
  }, [])

  const handleSubscribe = async () => {
    setLoading(true)
    setError('')
    try {
      await subscribeToPush(phone)
      setSubscribed(true)
    } catch (err) {
      setError(err.message)
    }
    setLoading(false)
  }

  const handleDismiss = () => {
    localStorage.setItem('vanda_push_dismissed', String(Date.now()))
    setDismissed(true)
  }

  if (!supported || subscribed || dismissed) return null

  return (
    <div style={{ background: '#111', border: '1px solid #2a2a2a', borderRadius: 12, padding: 16, marginBottom: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
        <div style={{ flex: 1 }}>
          <p style={{ color: '#fff', fontSize: 14, fontWeight: 600, margin: '0 0 4px' }}>Enable Notifications</p>
          <p style={{ color: '#888', fontSize: 12, margin: '0 0 12px', lineHeight: 1.5 }}>
            Get notified when new shifts are available and important updates about your assignments.
          </p>
          {error && <p style={{ color: '#ef4444', fontSize: 12, marginBottom: 8 }}>{error}</p>}
          <button
            onClick={handleSubscribe}
            disabled={loading}
            style={{
              padding: '10px 20px', borderRadius: 20, border: 'none',
              background: '#fff', color: '#000', fontSize: 13, fontWeight: 600,
              cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.6 : 1,
            }}
          >
            {loading ? 'Enabling...' : 'Turn On Notifications'}
          </button>
        </div>
        <button onClick={handleDismiss} style={{ color: '#555', fontSize: 18, background: 'none', border: 'none', cursor: 'pointer', lineHeight: 1 }}>&times;</button>
      </div>
    </div>
  )
}
