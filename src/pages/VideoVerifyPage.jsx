import { useState, useRef, useEffect } from 'react'

const QUESTIONS = [
  'Please say your full name and tell us why you want to work with V&A Hire.',
  'Describe a recent work experience where you had to solve a problem on the spot.',
]

export default function VideoVerifyPage() {
  const [phone, setPhone] = useState('')
  const [worker, setWorker] = useState(null)
  const [step, setStep] = useState('lookup') // lookup | record | review | uploading | done | error
  const [error, setError] = useState('')
  const [questionIdx, setQuestionIdx] = useState(0)
  const [recording, setRecording] = useState(false)
  const [videoBlob, setVideoBlob] = useState(null)
  const [videoUrl, setVideoUrl] = useState('')
  const videoRef = useRef(null)
  const mediaRecorderRef = useRef(null)
  const chunksRef = useRef([])
  const streamRef = useRef(null)

  // Look up worker by phone
  async function handleLookup(e) {
    e.preventDefault()
    setError('')
    try {
      const res = await fetch(`/api/checkin?phone=${encodeURIComponent(phone)}`)
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || 'Worker not found. Please make sure you have applied first.')
        return
      }
      const w = data.worker || data
      setWorker(w)
      if (w.video_url) {
        setStep('already-done')
        return
      }
      setStep('record')
      await startCamera()
    } catch (err) {
      setError('Connection error. Please try again.')
    }
  }

  async function startCamera() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 720 }, height: { ideal: 720 } },
        audio: true,
      })
      streamRef.current = stream
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        videoRef.current.muted = true
        videoRef.current.play()
      }
    } catch (err) {
      setError('Camera access denied. Please allow camera and microphone access to record your verification video.')
      setStep('error')
    }
  }

  // iOS Safari only supports MP4 containers (no webm). Pick whatever the
  // browser actually supports so iPhones can record at all.
  function pickMimeType() {
    const candidates = [
      'video/webm;codecs=vp9,opus',
      'video/webm;codecs=vp8,opus',
      'video/webm',
      'video/mp4;codecs=h264,aac',
      'video/mp4',
    ]
    for (const t of candidates) {
      if (typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported?.(t)) return t
    }
    return ''
  }

  function startRecording() {
    if (!streamRef.current) return
    chunksRef.current = []
    const mimeType = pickMimeType()
    let recorder
    try {
      recorder = mimeType
        ? new MediaRecorder(streamRef.current, { mimeType, videoBitsPerSecond: 400000 })
        : new MediaRecorder(streamRef.current, { videoBitsPerSecond: 400000 })
    } catch (err) {
      setError(`Your browser couldn't start the recorder (${err.message}). Try Chrome or Safari on a phone.`)
      return
    }
    const containerType = mimeType || 'video/mp4'
    recorder.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data) }
    recorder.onstop = () => {
      const blob = new Blob(chunksRef.current, { type: containerType })
      setVideoBlob(blob)
      setVideoUrl(URL.createObjectURL(blob))
      setStep('review')
      streamRef.current?.getTracks().forEach(t => t.stop())
    }
    recorder.onerror = (e) => {
      setError(`Recording error: ${e.error?.message || 'unknown'}`)
    }
    mediaRecorderRef.current = recorder
    recorder.start()
    setRecording(true)
  }

  function stopRecording() {
    if (mediaRecorderRef.current && recording) {
      mediaRecorderRef.current.stop()
      setRecording(false)
    }
  }

  function retake() {
    setVideoBlob(null)
    setVideoUrl('')
    setStep('record')
    startCamera()
  }

  async function uploadVideo() {
    if (!videoBlob || !worker) return
    setStep('uploading')
    setError('')

    try {
      // Vercel serverless function body limit is 4.5MB. Base64 inflates
      // bytes by ~33%, so cap the raw blob at 3MB to stay safely under.
      const MAX_SIZE = 3 * 1024 * 1024
      if (videoBlob.size > MAX_SIZE) {
        setError(`Video is ${(videoBlob.size / 1024 / 1024).toFixed(1)}MB — too large to upload. Please record a shorter video (around 15–20 seconds works).`)
        setStep('review')
        return
      }

      const reader = new FileReader()
      const base64 = await new Promise((resolve, reject) => {
        reader.onloadend = () => resolve(reader.result.split(',')[1])
        reader.onerror = () => reject(new Error('Could not read the recorded video'))
        reader.readAsDataURL(videoBlob)
      })

      const res = await fetch('/api/verify-video', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone, video_base64: base64, mime_type: videoBlob.type || 'video/webm' }),
      })

      let data = {}
      try { data = await res.json() } catch {}
      if (!res.ok) {
        const code = res.status === 413 ? ' (file too large for the server)' : ''
        setError(`${data.error || 'Upload failed'}${code}. Status ${res.status}.`)
        setStep('review')
        return
      }

      setStep('done')
    } catch (err) {
      setError(`Upload error: ${err.message || 'network problem'}. Please try again.`)
      setStep('review')
    }
  }

  // Cleanup
  useEffect(() => {
    return () => {
      streamRef.current?.getTracks().forEach(t => t.stop())
      if (videoUrl) URL.revokeObjectURL(videoUrl)
    }
  }, [videoUrl])

  return (
    <div style={{ minHeight: '100vh', background: '#0a0a1a', color: '#fff', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
      <div style={{ maxWidth: 500, margin: '0 auto', padding: '40px 20px' }}>
        <h1 style={{ fontSize: 24, marginBottom: 8, textAlign: 'center' }}>V&A Hire Verification</h1>
        <p style={{ color: '#aaa', textAlign: 'center', marginBottom: 8, fontSize: 14 }}>
          Record a short video to complete your profile verification
        </p>
        {/* Progress indicator */}
        <div style={{ display: 'flex', justifyContent: 'center', gap: 8, marginBottom: 8 }}>
          <div style={{ width: 32, height: 4, borderRadius: 2, background: '#333' }} />
          <div style={{ width: 32, height: 4, borderRadius: 2, background: '#333' }} />
          <div style={{ width: 32, height: 4, borderRadius: 2, background: '#333' }} />
        </div>
        <p style={{ color: '#666', fontSize: 12, textAlign: 'center', marginBottom: 24 }}>Step 1 of 3</p>

        {error && (
          <div style={{ background: '#ff4444', color: '#fff', padding: '12px 16px', borderRadius: 8, marginBottom: 20, fontSize: 14 }}>
            {error}
          </div>
        )}

        {/* Step 1: Phone Lookup */}
        {step === 'lookup' && (
          <form onSubmit={handleLookup}>
            <label style={{ display: 'block', marginBottom: 8, fontSize: 14, color: '#ccc' }}>Enter your phone number</label>
            <input
              type="tel"
              value={phone}
              onChange={e => setPhone(e.target.value)}
              placeholder="(404) 555-1234"
              required
              style={{ width: '100%', padding: '14px 16px', borderRadius: 8, border: '1px solid #333', background: '#141414', color: '#fff', fontSize: 16, marginBottom: 16, boxSizing: 'border-box' }}
            />
            <button type="submit" style={{ width: '100%', padding: '14px', borderRadius: 8, border: 'none', background: '#ffffff', color: '#000', fontSize: 16, fontWeight: 600, cursor: 'pointer' }}>
              Look Up My Application
            </button>
          </form>
        )}

        {/* Step 2: Record Video */}
        {step === 'record' && (
          <div>
            <div style={{ background: '#141414', borderRadius: 12, padding: 20, marginBottom: 20 }}>
              <p style={{ color: '#ffffff', fontSize: 12, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>
                Question {questionIdx + 1} of {QUESTIONS.length}
              </p>
              <p style={{ fontSize: 16, lineHeight: 1.5, margin: 0 }}>
                {QUESTIONS[questionIdx]}
              </p>
            </div>

            <div style={{ position: 'relative', borderRadius: 12, overflow: 'hidden', marginBottom: 20, background: '#000', aspectRatio: '1/1' }}>
              <video
                ref={videoRef}
                style={{ width: '100%', height: '100%', objectFit: 'cover', transform: 'scaleX(-1)' }}
                playsInline
              />
              {recording && (
                <div style={{ position: 'absolute', top: 12, right: 12, background: '#ff4444', borderRadius: 20, padding: '4px 12px', fontSize: 12, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#fff', animation: 'pulse 1s infinite' }} />
                  REC
                </div>
              )}
            </div>

            <div style={{ display: 'flex', gap: 12 }}>
              {!recording ? (
                <>
                  <button
                    onClick={startRecording}
                    style={{ flex: 1, padding: '14px', borderRadius: 8, border: 'none', background: '#ffffff', color: '#000', fontSize: 16, fontWeight: 600, cursor: 'pointer' }}
                  >
                    Start Recording
                  </button>
                  {questionIdx > 0 && (
                    <button
                      onClick={() => setQuestionIdx(questionIdx - 1)}
                      style={{ padding: '14px 20px', borderRadius: 8, border: '1px solid #333', background: 'transparent', color: '#ccc', cursor: 'pointer' }}
                    >
                      Prev
                    </button>
                  )}
                  {questionIdx < QUESTIONS.length - 1 && (
                    <button
                      onClick={() => setQuestionIdx(questionIdx + 1)}
                      style={{ padding: '14px 20px', borderRadius: 8, border: '1px solid #333', background: 'transparent', color: '#ccc', cursor: 'pointer' }}
                    >
                      Next Q
                    </button>
                  )}
                </>
              ) : (
                <button
                  onClick={stopRecording}
                  style={{ flex: 1, padding: '14px', borderRadius: 8, border: 'none', background: '#ff4444', color: '#fff', fontSize: 16, fontWeight: 600, cursor: 'pointer' }}
                >
                  Stop Recording
                </button>
              )}
            </div>

            <p style={{ color: '#666', fontSize: 12, textAlign: 'center', marginTop: 12 }}>
              Record yourself answering both questions in one video (30-90 seconds)
            </p>
          </div>
        )}

        {/* Step 3: Review */}
        {step === 'review' && (
          <div>
            <p style={{ textAlign: 'center', marginBottom: 16, color: '#ffffff', fontWeight: 600 }}>Review your video</p>
            <div style={{ borderRadius: 12, overflow: 'hidden', marginBottom: 20, background: '#000', aspectRatio: '1/1' }}>
              <video
                src={videoUrl}
                controls
                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                playsInline
              />
            </div>
            <div style={{ display: 'flex', gap: 12 }}>
              <button onClick={retake} style={{ flex: 1, padding: '14px', borderRadius: 8, border: '1px solid #333', background: 'transparent', color: '#ccc', fontSize: 16, cursor: 'pointer' }}>
                Retake
              </button>
              <button onClick={uploadVideo} style={{ flex: 1, padding: '14px', borderRadius: 8, border: 'none', background: '#ffffff', color: '#000', fontSize: 16, fontWeight: 600, cursor: 'pointer' }}>
                Submit Video
              </button>
            </div>
          </div>
        )}

        {/* Step 4: Uploading */}
        {step === 'uploading' && (
          <div style={{ textAlign: 'center', padding: 40 }}>
            <div style={{ width: 48, height: 48, border: '4px solid #333', borderTopColor: '#ffffff', borderRadius: '50%', animation: 'spin 1s linear infinite', margin: '0 auto 20px' }} />
            <p style={{ color: '#ccc' }}>Uploading your verification video...</p>
          </div>
        )}

        {/* Step 5: Done — navigate to ID upload */}
        {step === 'done' && (
          <div style={{ textAlign: 'center', padding: 40 }}>
            <div style={{ width: 64, height: 64, borderRadius: '50%', background: '#ffffff', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px', fontSize: 32 }}>
              ✓
            </div>
            <h2 style={{ marginBottom: 8 }}>Video Submitted!</h2>
            <p style={{ color: '#aaa', fontSize: 14, lineHeight: 1.6 }}>
              Great job! Next, upload your government-issued ID to continue your onboarding.
            </p>

            {/* Progress indicator */}
            <div style={{ display: 'flex', justifyContent: 'center', gap: 8, margin: '24px 0' }}>
              <div style={{ width: 32, height: 4, borderRadius: 2, background: '#ffffff' }} />
              <div style={{ width: 32, height: 4, borderRadius: 2, background: '#333' }} />
              <div style={{ width: 32, height: 4, borderRadius: 2, background: '#333' }} />
            </div>
            <p style={{ color: '#666', fontSize: 12, marginBottom: 24 }}>Step 1 of 3 complete</p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <a href={`/id-upload/${phone.replace(/\D/g, '')}`} style={{ display: 'inline-block', padding: '14px 28px', background: '#ffffff', color: '#000', borderRadius: 8, textDecoration: 'none', fontWeight: 600 }}>
                Upload ID Photo →
              </a>
              <a href="/" style={{ display: 'inline-block', padding: '14px 28px', background: 'transparent', color: '#666', border: '1px solid #333', borderRadius: 8, textDecoration: 'none', fontSize: 14 }}>
                Skip for now
              </a>
            </div>
          </div>
        )}

        {/* Already completed */}
        {step === 'already-done' && (
          <div style={{ textAlign: 'center', padding: 40 }}>
            <div style={{ width: 64, height: 64, borderRadius: '50%', background: '#ffffff', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px', fontSize: 32 }}>
              ✓
            </div>
            <h2 style={{ marginBottom: 8 }}>Video Already Submitted</h2>
            <p style={{ color: '#aaa', fontSize: 14, lineHeight: 1.6, marginBottom: 24 }}>
              You've already recorded your verification video. No need to do it again!
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <a href={`/id-upload/${phone.replace(/\D/g, '')}`} style={{ display: 'inline-block', padding: '14px 28px', background: '#ffffff', color: '#000', borderRadius: 8, textDecoration: 'none', fontWeight: 600 }}>
                Next: Upload ID →
              </a>
              <a href="/" style={{ display: 'inline-block', padding: '14px 28px', background: 'transparent', color: '#666', border: '1px solid #333', borderRadius: 8, textDecoration: 'none', fontSize: 14 }}>
                Back to Home
              </a>
            </div>
          </div>
        )}

        {/* Error state */}
        {step === 'error' && (
          <div style={{ textAlign: 'center', padding: 40 }}>
            <p style={{ color: '#ff4444', marginBottom: 16 }}>Unable to access camera</p>
            <button onClick={() => { setStep('record'); startCamera() }} style={{ padding: '12px 24px', borderRadius: 8, border: 'none', background: '#ffffff', color: '#000', cursor: 'pointer' }}>
              Try Again
            </button>
          </div>
        )}
      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg) } }
        @keyframes pulse { 0%, 100% { opacity: 1 } 50% { opacity: 0.3 } }
      `}</style>
    </div>
  )
}
