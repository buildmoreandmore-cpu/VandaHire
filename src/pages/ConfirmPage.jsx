import { useState, useEffect } from 'react'

export default function ConfirmPage() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [responding, setResponding] = useState(false)
  const [responded, setResponded] = useState(null)

  const token = new URLSearchParams(window.location.search).get('token')

  useEffect(() => {
    if (!token) {
      setError('No confirmation token provided.')
      setLoading(false)
      return
    }
    fetch(`/api/confirm?token=${encodeURIComponent(token)}`)
      .then(r => r.json())
      .then(d => {
        if (d.error) throw new Error(d.error)
        setData(d)
      })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }, [token])

  const handleAction = async (action) => {
    setResponding(true)
    try {
      const res = await fetch('/api/confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, action }),
      })
      const result = await res.json()
      if (result.error) throw new Error(result.error)
      setResponded(result.status)
    } catch (e) {
      setError(e.message)
    }
    setResponding(false)
  }

  const formatDate = (d) => {
    if (!d) return ''
    return new Date(d + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })
  }

  const formatTime = (t) => {
    if (!t) return ''
    const [h, m] = t.split(':')
    const hr = parseInt(h, 10)
    const ampm = hr >= 12 ? 'PM' : 'AM'
    return `${hr % 12 || 12}:${m} ${ampm}`
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center px-4 py-8">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-6">
          <h1 className="text-white font-extrabold text-2xl tracking-tight">Vanda</h1>
          <p className="text-p-muted text-xs mt-1">Assignment Confirmation</p>
        </div>

        <div className="bg-p-surface border border-p-border rounded-xl p-6">
          {loading ? (
            <p className="text-p-muted text-sm text-center py-8">Loading assignment details...</p>
          ) : error ? (
            <div className="text-center py-8">
              <p className="text-red-400 text-sm">{error}</p>
              <p className="text-p-muted text-xs mt-2">This link may have expired or is invalid.</p>
            </div>
          ) : responded ? (
            <div className="text-center py-8">
              <div className="w-16 h-16 mx-auto mb-4 rounded-full flex items-center justify-center
                ${responded === 'confirmed' ? 'bg-green-500/20' : 'bg-red-500/20'}">
                <span className="text-3xl">{responded === 'confirmed' ? '✓' : '✕'}</span>
              </div>
              <h2 className="text-white text-lg font-semibold mb-1">
                {responded === 'confirmed' ? 'You\'re Confirmed!' : 'Assignment Declined'}
              </h2>
              <p className="text-p-muted text-sm">
                {responded === 'confirmed'
                  ? 'We\'ll see you at the event. Details are below for your reference.'
                  : 'Thanks for letting us know. We\'ll assign another worker.'}
              </p>
              {responded === 'confirmed' && data?.event && (
                <div className="mt-4 bg-black/30 rounded-lg p-4 text-left">
                  <p className="text-white text-sm font-medium">{data.event.title}</p>
                  <p className="text-p-muted text-xs mt-1">{formatDate(data.event.date)}</p>
                  <p className="text-p-muted text-xs">{formatTime(data.event.start_time)} – {formatTime(data.event.end_time)}</p>
                  <p className="text-p-muted text-xs">{data.event.location}, {data.event.city}</p>
                  {data.event.dress_code && <p className="text-p-muted text-xs mt-1">Dress code: {data.event.dress_code}</p>}
                </div>
              )}
            </div>
          ) : data?.status !== 'invited' ? (
            <div className="text-center py-8">
              <p className="text-white text-sm font-medium mb-1">
                This assignment is already <span className="text-p-green">{data.status?.replace(/_/g, ' ')}</span>
              </p>
              {data?.event && (
                <div className="mt-4 bg-black/30 rounded-lg p-4 text-left">
                  <p className="text-white text-sm font-medium">{data.event.title}</p>
                  <p className="text-p-muted text-xs mt-1">{formatDate(data.event.date)}</p>
                  <p className="text-p-muted text-xs">{data.event.location}, {data.event.city}</p>
                </div>
              )}
            </div>
          ) : (
            <>
              <h2 className="text-white text-lg font-semibold mb-1">
                Hi {data.worker_name}!
              </h2>
              <p className="text-p-muted text-sm mb-4">
                You've been invited to work the following event:
              </p>

              <div className="bg-black/30 rounded-lg p-4 mb-4">
                <p className="text-white font-medium">{data.event?.title}</p>
                <div className="mt-2 space-y-1">
                  <InfoRow label="Date" value={formatDate(data.event?.date)} />
                  <InfoRow label="Time" value={`${formatTime(data.event?.start_time)} – ${formatTime(data.event?.end_time)}`} />
                  <InfoRow label="Location" value={`${data.event?.location}, ${data.event?.city}`} />
                  {data.event?.dress_code && <InfoRow label="Dress Code" value={data.event.dress_code} />}
                  {data.pay_rate && <InfoRow label="Pay Rate" value={`$${data.pay_rate}/hr`} />}
                  {data.notes && <InfoRow label="Notes" value={data.notes} />}
                </div>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => handleAction('confirm')}
                  disabled={responding}
                  className="flex-1 bg-p-green text-black rounded-lg py-3 text-sm font-semibold disabled:opacity-50 hover:opacity-90 transition-all"
                >
                  {responding ? '...' : 'I\'m In'}
                </button>
                <button
                  onClick={() => handleAction('decline')}
                  disabled={responding}
                  className="flex-1 bg-p-surface border border-p-border text-white rounded-lg py-3 text-sm font-semibold disabled:opacity-50 hover:bg-white/5 transition-all"
                >
                  {responding ? '...' : 'Can\'t Make It'}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

function InfoRow({ label, value }) {
  if (!value) return null
  return (
    <div className="flex gap-2 text-xs">
      <span className="text-p-muted flex-shrink-0">{label}:</span>
      <span className="text-white">{value}</span>
    </div>
  )
}
