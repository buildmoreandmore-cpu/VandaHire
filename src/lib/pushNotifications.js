// Push notification helpers

let vapidPublicKey = null

async function getVapidKey() {
  if (vapidPublicKey) return vapidPublicKey
  try {
    const res = await fetch('/api/worker?route=push-vapid-key')
    const data = await res.json()
    vapidPublicKey = data.publicKey
    return vapidPublicKey
  } catch {
    return null
  }
}

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = atob(base64)
  const outputArray = new Uint8Array(rawData.length)
  for (let i = 0; i < rawData.length; ++i) outputArray[i] = rawData.charCodeAt(i)
  return outputArray
}

export async function isPushSupported() {
  return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window
}

export async function isPushSubscribed() {
  if (!await isPushSupported()) return false
  const reg = await navigator.serviceWorker.ready
  const sub = await reg.pushManager.getSubscription()
  return !!sub
}

export async function subscribeToPush(phone) {
  if (!await isPushSupported()) throw new Error('Push notifications not supported on this browser')

  const permission = await Notification.requestPermission()
  if (permission !== 'granted') throw new Error('Notification permission denied')

  const publicKey = await getVapidKey()
  if (!publicKey) throw new Error('Could not get push configuration')

  const reg = await navigator.serviceWorker.ready
  const subscription = await reg.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(publicKey),
  })

  // Send subscription to server
  const res = await fetch('/api/worker?route=push-subscribe', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ phone, subscription: subscription.toJSON() }),
  })

  if (!res.ok) {
    const data = await res.json()
    throw new Error(data.error || 'Failed to register push subscription')
  }

  return true
}
