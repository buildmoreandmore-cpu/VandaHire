import { useState } from 'react'

const formatPhone = (val) => {
  const digits = val.replace(/\D/g, '').slice(0, 10)
  if (digits.length <= 3) return digits
  if (digits.length <= 6) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`
  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`
}

export default function ClaimModal({ event, onClose, onSuccess }) {
  const [phone, setPhone] = useState('')
  const [briefingSlot, setBriefingSlot] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState(null)

  const hasSlots = event.briefing_slots && event.briefing_slots.length > 0

  const handleClaim = async (e) => {
    e.preventDefault()
    setSubmitting(true)
    setError(null)

    try {
      const res = await fetch('/api/shifts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          event_id: event.id,
          phone,
          briefing_slot: briefingSlot || undefined,
        }),
      })

      const body = await res.json()

      if (!res.ok) {
        if (body.error === 'not_found') {
          setError({ type: 'not_found', message: body.message })
        } else if (body.error === 'not_approved') {
          setError({ type: 'not_approved', message: body.message })
        } else if (body.error === 'already_claimed') {
          setError({ type: 'already_claimed', message: body.message })
        } else if (body.error === 'id_required') {
          setError({ type: 'id_required', message: body.message, id_url: body.id_url })
        } else if (body.error === 'w9_required') {
          setError({ type: 'w9_required', message: body.message, w9_url: body.w9_url })
        } else {
          setError({ type: 'generic', message: body.message || body.error || 'Something went wrong' })
        }
        return
      }

      onSuccess(body.worker)
    } catch {
      setError({ type: 'generic', message: 'Network error. Please try again.' })
    } finally {
      setSubmitting(false)
    }
  }

  const inputCls = 'w-full bg-[#111] border border-p-border rounded-lg px-4 py-3 text-white text-sm placeholder-p-muted focus:outline-none focus:border-p-green transition-colors'

  return (
    <div className="fixed inset-0 bg-black/70 flex items-end sm:items-center justify-center z-50 p-4">
      <div className="bg-[#0a0a0a] border border-p-border rounded-2xl w-full max-w-md p-6">
        <div className="flex items-start justify-between mb-5">
          <div>
            <h2 className="text-white font-bold text-lg">Claim Shift</h2>
            <p className="text-p-muted text-xs mt-0.5">{event.title}</p>
          </div>
          <button onClick={onClose} className="text-p-muted hover:text-white text-2xl leading-none">×</button>
        </div>

        <form onSubmit={handleClaim} className="space-y-4">
          <div>
            <label className="text-p-muted text-xs block mb-1.5">Your phone number</label>
            <input
              className={inputCls}
              type="tel"
              placeholder="(555) 000-0000"
              value={phone}
              onChange={(e) => setPhone(formatPhone(e.target.value))}
              required
            />
            <p className="text-p-muted text-[10px] mt-1">We'll look you up by your phone number.</p>
          </div>

          {hasSlots && (
            <div>
              <label className="text-p-muted text-xs block mb-1.5">Choose a briefing time slot</label>
              <div className="space-y-2">
                {event.briefing_slots.map((slot, idx) => (
                  <label
                    key={idx}
                    className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-all ${
                      briefingSlot === slot.label
                        ? 'border-p-green bg-p-green/10'
                        : 'border-p-border hover:border-p-muted'
                    }`}
                  >
                    <input
                      type="radio"
                      name="briefing_slot"
                      value={slot.label}
                      checked={briefingSlot === slot.label}
                      onChange={() => setBriefingSlot(slot.label)}
                      className="accent-p-green"
                    />
                    <span className="text-white text-xs">
                      {slot.label} — {slot.date} at {slot.time}
                    </span>
                  </label>
                ))}
              </div>
            </div>
          )}

          {error && (
            <div className="text-sm bg-p-error/10 border border-p-error/20 rounded-lg px-4 py-3">
              <p className="text-red-400">{error.message}</p>
              {error.type === 'not_found' && (
                <a href="/" className="text-p-green text-xs mt-1 block hover:opacity-80">
                  Apply to join the V&A crew →
                </a>
              )}
              {error.type === 'id_required' && (
                <a href={error.id_url} className="text-white text-xs mt-1 block hover:opacity-80">
                  Upload your ID to start claiming shifts →
                </a>
              )}
              {error.type === 'already_claimed' && (
                <a href="/my-shifts" className="text-white text-xs mt-1 block hover:opacity-80">
                  View My Shifts →
                </a>
              )}
              {error.type === 'w9_required' && (
                <a href={error.w9_url} className="text-white text-xs mt-1 block hover:opacity-80">
                  Complete your W-9 to start claiming shifts →
                </a>
              )}
            </div>
          )}

          {error ? (
            <button
              type="button"
              onClick={onClose}
              className="w-full bg-[#222] text-white rounded-full py-3 font-semibold text-sm hover:bg-[#333] transition-all duration-200"
            >
              Close
            </button>
          ) : (
            <button
              type="submit"
              disabled={submitting}
              className="w-full bg-p-green text-black rounded-full py-3 font-semibold text-sm hover:opacity-90 transition-all duration-200 disabled:opacity-50"
            >
              {submitting ? 'Claiming...' : 'Confirm Claim →'}
            </button>
          )}
        </form>
      </div>
    </div>
  )
}
