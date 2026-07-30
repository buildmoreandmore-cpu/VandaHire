// Upload a base64 data-URL image to the public bucket and return its URL.
// Reuses the existing 'applicant-photos' bucket with a path prefix.
const BUCKET = 'applicant-photos'

export async function uploadImage(supabase, base64, prefix = 'misc') {
  if (!base64) return null
  const mimeMatch = base64.match(/^data:(image\/\w+);base64,/)
  const contentType = mimeMatch ? mimeMatch[1] : 'image/jpeg'
  const ext = contentType === 'image/png' ? 'png' : contentType === 'image/webp' ? 'webp' : 'jpg'
  const data = base64.replace(/^data:image\/\w+;base64,/, '')
  const buffer = Buffer.from(data, 'base64')
  const rand = (globalThis.crypto?.randomUUID?.() || String(Math.random()).slice(2))
  const filePath = `${prefix}/${rand}.${ext}`

  // Ensure bucket exists (ignore race).
  try {
    const { data: buckets } = await supabase.storage.listBuckets()
    if (!(buckets || []).find(b => b.name === BUCKET)) {
      try { await supabase.storage.createBucket(BUCKET, { public: true }) }
      catch (e) { if (!String(e.message || '').includes('already exists')) throw e }
    }
  } catch { /* best effort */ }

  const { error } = await supabase.storage.from(BUCKET).upload(filePath, buffer, { contentType, upsert: true })
  if (error) throw error
  const { data: urlData } = supabase.storage.from(BUCKET).getPublicUrl(filePath)
  return urlData.publicUrl
}
