import webPush from 'web-push'

let vapidConfigured = false

function setupVapid() {
  if (vapidConfigured) return
  if (!process.env.VAPID_PUBLIC_KEY || !process.env.VAPID_PRIVATE_KEY) return
  webPush.setVapidDetails(
    'mailto:crew@vandahire.com',
    process.env.VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY
  )
  vapidConfigured = true
}

export async function sendPushToWorker(supabase, workerId, title, body, url, tag) {
  if (!process.env.VAPID_PUBLIC_KEY || !process.env.VAPID_PRIVATE_KEY) return
  setupVapid()
  const { data: sub } = await supabase
    .from('push_subscriptions')
    .select('subscription')
    .eq('worker_id', workerId)
    .single()
  if (!sub) return
  try {
    await webPush.sendNotification(
      JSON.parse(sub.subscription),
      JSON.stringify({ title, body: body || '', url: url || '/', tag: tag || 'general' })
    )
  } catch (err) {
    if (err.statusCode === 410 || err.statusCode === 404) {
      await supabase.from('push_subscriptions').delete().eq('worker_id', workerId)
    }
  }
}
