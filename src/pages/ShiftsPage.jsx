import { useState, useEffect } from 'react'
import { useNavigate } from '../Router.jsx'
import ShiftCard from '../components/ShiftCard.jsx'
import ClaimModal from '../components/ClaimModal.jsx'
import VandaLogo from '../components/VandaLogo.jsx'

export default function ShiftsPage() {
  const navigate = useNavigate()
  const [shifts, setShifts] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [selectedShift, setSelectedShift] = useState(null)
  const [claimed, setClaimed] = useState(null) // { first_name, last_name }

  useEffect(() => {
    fetch('/api/shifts')
      .then(r => r.json())
      .then(data => {
        if (Array.isArray(data)) setShifts(data)
        else setError(data.error || 'Failed to load shifts')
      })
      .catch(() => setError('Network error'))
      .finally(() => setLoading(false))
  }, [])

  const handleClaimSuccess = (worker) => {
    setSelectedShift(null)
    setClaimed(worker)
  }

  if (claimed) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex flex-col items-center justify-center px-6 text-center">
        <div className="mb-6 text-5xl">🎉</div>
        <h2 className="text-3xl font-extrabold text-white tracking-tight mb-3">Shift Claimed!</h2>
        <p className="text-p-muted text-sm mb-8 max-w-xs">
          Thanks, {claimed.first_name}! We've received your request. The Vanda team will confirm your assignment via text.
        </p>
        <button
          onClick={() => { setClaimed(null); setShifts([]); setLoading(true); fetch('/api/shifts').then(r => r.json()).then(d => { setShifts(Array.isArray(d) ? d : []); setLoading(false) }) }}
          className="text-p-muted text-sm hover:text-white transition-colors"
        >
          ← Back to shifts
        </button>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a]">
      {/* Header */}
      <div className="border-b border-p-border px-5 py-4 flex items-center justify-between">
        <VandaLogo onClick={() => navigate('/')} />
        <span className="text-p-muted text-xs">Available Shifts</span>
      </div>

      <div className="max-w-[600px] mx-auto px-5 py-8">
        <h1 className="text-2xl font-extrabold text-white tracking-tight mb-1">Open Shifts</h1>
        <p className="text-p-muted text-sm mb-6">
          Approved Vanda workers can claim shifts below. Not in our pool yet?{' '}
          <button onClick={() => navigate('/')} className="text-p-green hover:opacity-80 transition-opacity">Apply here →</button>
        </p>

        {loading && (
          <div className="text-p-muted text-sm text-center py-12">Loading shifts...</div>
        )}

        {!loading && error && (
          <div className="text-red-400 text-sm text-center py-12">{error}</div>
        )}

        {!loading && !error && shifts.length === 0 && (
          <div className="text-center py-12">
            <p className="text-p-muted text-sm">No open shifts right now.</p>
            <p className="text-p-muted text-xs mt-2">Check back soon — new events are added regularly.</p>
          </div>
        )}

        {!loading && shifts.length > 0 && (
          <div className="space-y-4">
            {shifts.map(shift => (
              <ShiftCard
                key={shift.id}
                event={shift}
                onClaim={(e) => setSelectedShift(e)}
              />
            ))}
          </div>
        )}
      </div>

      {selectedShift && (
        <ClaimModal
          event={selectedShift}
          onClose={() => setSelectedShift(null)}
          onSuccess={handleClaimSuccess}
        />
      )}
    </div>
  )
}
