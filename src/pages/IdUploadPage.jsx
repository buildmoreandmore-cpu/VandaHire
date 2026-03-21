import { useState, useEffect, useRef } from 'react'

export default function IdUploadPage({ phone: phoneParam }) {
  const [phone, setPhone] = useState(phoneParam || '')
  const [step, setStep] = useState(phoneParam ? 'loading' : 'lookup')
  const [worker, setWorker] = useState(null)
  const [error, setError] = useState('')
  const [uploading, setUploading] = useState(false)
  const [preview, setPreview] = useState(null)
  const [done, setDone] = useState(false)
  const fileRef = useRef(null)

  useEffect(() => {
    if (phoneParam) lookupWorker(phoneParam)
  }, [])

  async function lookupWorker(ph) {
    setError('')
    const digits = (ph || phone).replace(/\D/g, '')
    if (digits.length < 10) {
      setError('Please enter a valid 10-digit phone number.')
      setStep('lookup')
      return
    }

    try {
      const res = await fetch(`/api/checkin?phone=${encodeURIComponent(digits)}`)
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || 'Worker not found. Please make sure you have applied first.')
        setStep('lookup')
        return
      }
      const w = data.worker || data
      setWorker(w)

      // Check if ID already uploaded
      if (w.id_photo_url) {
        setDone(true)
        setStep('done')
        return
      }
      setStep('upload')
    } catch {
      setError('Connection error. Please try again.')
      setStep('lookup')
    }
  }

  function handleFileSelect(e) {
    const file = e.target.files?.[0]
    if (!file) return

    if (file.size > 10 * 1024 * 1024) {
      setError('File too large. Maximum 10MB.')
      return
    }

    const reader = new FileReader()
    reader.onload = () => setPreview(reader.result)
    reader.readAsDataURL(file)
    setError('')
  }

  async function handleUpload() {
    if (!preview) {
      setError('Please select or take a photo of your ID.')
      return
    }

    setUploading(true)
    setError('')

    try {
      const res = await fetch('/api/id-upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone: phone.replace(/\D/g, ''),
          photo_base64: preview,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || 'Upload failed. Please try again.')
        return
      }
      setDone(true)
      setStep('done')
    } catch {
      setError('Network error. Please try again.')
    } finally {
      setUploading(false)
    }
  }

  const inputStyle = {
    width: '100%', padding: '14px 16px', borderRadius: 8, border: '1px solid #333',
    background: '#141414', color: '#fff', fontSize: 16, boxSizing: 'border-box',
  }
  const labelStyle = { display: 'block', marginBottom: 6, fontSize: 13, color: '#aaa' }

  return (
    <div style={{ minHeight: '100vh', background: '#0a0a0a', color: '#fff', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
      <div style={{ maxWidth: 500, margin: '0 auto', padding: '40px 20px' }}>
        <h1 style={{ fontSize: 24, marginBottom: 4, textAlign: 'center' }}>ID Verification</h1>
        <p style={{ color: '#888', textAlign: 'center', marginBottom: 32, fontSize: 14 }}>
          Upload a photo of your government-issued ID
        </p>

        {error && (
          <div style={{ background: '#331111', border: '1px solid #552222', color: '#ff6666', padding: '12px 16px', borderRadius: 8, marginBottom: 20, fontSize: 14 }}>
            {error}
          </div>
        )}

        {/* Phone Lookup */}
        {step === 'lookup' && (
          <form onSubmit={(e) => { e.preventDefault(); lookupWorker() }}>
            <label style={labelStyle}>Enter your phone number</label>
            <input
              type="tel"
              value={phone}
              onChange={e => setPhone(e.target.value)}
              placeholder="(404) 555-1234"
              required
              style={{ ...inputStyle, marginBottom: 16 }}
            />
            <button type="submit" style={{ width: '100%', padding: 14, borderRadius: 8, border: 'none', background: '#fff', color: '#000', fontSize: 16, fontWeight: 600, cursor: 'pointer' }}>
              Look Up My Application
            </button>
          </form>
        )}

        {/* Loading */}
        {step === 'loading' && (
          <div style={{ textAlign: 'center', padding: 40 }}>
            <div style={{ width: 48, height: 48, border: '4px solid #333', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin 1s linear infinite', margin: '0 auto 20px' }} />
            <p style={{ color: '#aaa' }}>Loading...</p>
          </div>
        )}

        {/* Upload */}
        {step === 'upload' && (
          <div>
            {worker?.first_name && (
              <p style={{ color: '#ccc', marginBottom: 20 }}>
                Hey {worker.first_name}, please upload a clear photo of your government-issued ID (driver's license, state ID, or passport).
              </p>
            )}

            <div style={{ background: '#141414', border: '1px solid #1e1e1e', borderRadius: 12, padding: 20, marginBottom: 20 }}>
              <p style={{ color: '#fff', fontSize: 12, textTransform: 'uppercase', letterSpacing: 1, margin: '0 0 12px', fontWeight: 600 }}>
                Accepted IDs
              </p>
              <ul style={{ color: '#aaa', fontSize: 13, margin: 0, paddingLeft: 20, lineHeight: 1.8 }}>
                <li>Driver's License</li>
                <li>State ID</li>
                <li>Passport</li>
                <li>Military ID</li>
              </ul>
            </div>

            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              capture="environment"
              onChange={handleFileSelect}
              style={{ display: 'none' }}
            />

            {!preview ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <button
                  onClick={() => fileRef.current?.click()}
                  style={{ width: '100%', padding: 48, borderRadius: 12, border: '2px dashed #333', background: 'transparent', color: '#888', fontSize: 14, cursor: 'pointer', textAlign: 'center' }}
                >
                  Tap to take a photo or choose from gallery
                </button>
              </div>
            ) : (
              <div style={{ marginBottom: 16 }}>
                <img src={preview} alt="ID Preview" style={{ width: '100%', borderRadius: 8, marginBottom: 12 }} />
                <button
                  onClick={() => { setPreview(null); if (fileRef.current) fileRef.current.value = '' }}
                  style={{ background: 'transparent', border: '1px solid #333', color: '#888', padding: '8px 16px', borderRadius: 6, fontSize: 13, cursor: 'pointer' }}
                >
                  Retake Photo
                </button>
              </div>
            )}

            <button
              onClick={handleUpload}
              disabled={uploading || !preview}
              style={{
                width: '100%', padding: 16, borderRadius: 8, border: 'none',
                background: '#fff', color: '#000', fontSize: 16, fontWeight: 600,
                cursor: uploading ? 'not-allowed' : 'pointer', opacity: (uploading || !preview) ? 0.5 : 1,
                marginTop: 16,
              }}
            >
              {uploading ? 'Uploading...' : 'Upload ID'}
            </button>

            <p style={{ color: '#555', fontSize: 11, marginTop: 12, textAlign: 'center' }}>
              Your ID is stored securely and only used for identity verification.
            </p>
          </div>
        )}

        {/* Done */}
        {step === 'done' && (
          <div style={{ textAlign: 'center', padding: 40 }}>
            <div style={{ width: 64, height: 64, borderRadius: '50%', background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px', fontSize: 32, color: '#000' }}>
              ✓
            </div>
            <h2 style={{ marginBottom: 8 }}>ID On File</h2>
            <p style={{ color: '#aaa', fontSize: 14, lineHeight: 1.6, marginBottom: 24 }}>
              Your ID has been uploaded and verified.
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <a href={`/w9/${phone.replace(/\D/g, '')}`} style={{ display: 'inline-block', padding: '14px 28px', background: '#fff', color: '#000', borderRadius: 8, textDecoration: 'none', fontWeight: 600 }}>
                Complete W-9 Form →
              </a>
              <a href="/shifts" style={{ display: 'inline-block', padding: '14px 28px', background: '#141414', color: '#fff', border: '1px solid #333', borderRadius: 8, textDecoration: 'none', fontWeight: 600 }}>
                Browse Shifts →
              </a>
            </div>
          </div>
        )}
      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg) } }
      `}</style>
    </div>
  )
}
