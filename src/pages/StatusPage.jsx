import { useState } from 'react'
import { useNavigate } from '../Router.jsx'
import Footer from '../components/Footer.jsx'

const STATUS_MESSAGES = {
  pending: {
    label: 'Under Review',
    color: 'text-yellow-400',
    bg: 'bg-yellow-400/10 border-yellow-400/20',
    message: 'Your application is under review. We\'ll reach out within 48 hours.',
  },
  approved: {
    label: 'Approved',
    color: 'text-[#c8ff00]',
    bg: 'bg-[#c8ff00]/10 border-[#c8ff00]/20',
    message: 'You\'re approved! Check available shifts at /shifts.',
  },
  rejected: {
    label: 'Not Moving Forward',
    color: 'text-red-400',
    bg: 'bg-red-400/10 border-red-400/20',
    message: 'We weren\'t able to move forward at this time. Thank you for applying.',
  },
}

export default function StatusPage() {
  const navigate = useNavigate()
  const [phone, setPhone] = useState('')
  const [result, setResult] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const formatPhone = (val) => {
    const digits = val.replace(/\D/g, '').slice(0, 10)
    if (digits.length < 4) return digits
    if (digits.length < 7) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setResult(null)
    const digits = phone.replace(/\D/g, '')
    if (digits.length < 10) {
      setError('Please enter a valid 10-digit phone number.')
      return
    }
    setLoading(true)
    try {
      const res = await fetch(`/api/status?type=worker&phone=${encodeURIComponent(digits)}`)
      const data = await res.json()
      setResult(data)
    } catch {
      setError('Something went wrong. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white flex flex-col">
      {/* Nav */}
      <div className="px-6 pt-8 flex items-center justify-between max-w-2xl mx-auto w-full">
        <button onClick={() => navigate('/')} className="text-white font-extrabold text-2xl tracking-tight">Vanda</button>
        <a href="/admin" className="text-[#777] text-sm hover:text-white transition-colors">Coordinator Login</a>
      </div>

      {/* Content */}
      <div className="flex-1 px-6 py-16 max-w-2xl mx-auto w-full">
        <h1 className="text-4xl font-extrabold tracking-tighter mb-2">Check Your Status</h1>
        <p className="text-[#888] mb-10">Enter the phone number you used when you applied.</p>

        <form onSubmit={handleSubmit} className="space-y-4 max-w-sm">
          <div>
            <label className="block text-sm text-[#777] mb-2">Phone Number</label>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(formatPhone(e.target.value))}
              placeholder="(404) 555-0100"
              className="w-full bg-[#111] border border-[#2a2a2a] rounded-xl px-4 py-3 text-white placeholder-[#555] focus:outline-none focus:border-[#c8ff00] transition-colors"
            />
          </div>

          {error && <p className="text-red-400 text-sm">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="bg-[#c8ff00] text-black rounded-full py-3 px-8 font-semibold hover:opacity-90 transition-all duration-200 disabled:opacity-50"
          >
            {loading ? 'Looking up…' : 'Check Status →'}
          </button>
        </form>

        {result && (
          <div className="mt-10">
            {result.found ? (
              <div className={`border rounded-2xl p-6 ${STATUS_MESSAGES[result.status]?.bg || 'border-[#2a2a2a]'}`}>
                <div className={`font-bold text-lg mb-2 ${STATUS_MESSAGES[result.status]?.color || 'text-white'}`}>
                  {STATUS_MESSAGES[result.status]?.label || result.status}
                </div>
                <p className="text-[#aaa] leading-relaxed">
                  {STATUS_MESSAGES[result.status]?.message || 'Status unknown — contact crew@joinvanda.co.'}
                </p>
                {result.status === 'approved' && (
                  <button
                    onClick={() => navigate('/shifts')}
                    className="mt-4 bg-[#c8ff00] text-black rounded-full py-2 px-6 font-semibold text-sm hover:opacity-90 transition-all"
                  >
                    View Available Shifts →
                  </button>
                )}
              </div>
            ) : (
              <div className="border border-[#2a2a2a] rounded-2xl p-6">
                <div className="font-bold text-lg mb-2 text-[#888]">No Application Found</div>
                <p className="text-[#666] leading-relaxed mb-4">
                  We couldn't find an application with that phone number.
                </p>
                <button
                  onClick={() => navigate('/')}
                  className="bg-[#c8ff00] text-black rounded-full py-2 px-6 font-semibold text-sm hover:opacity-90 transition-all"
                >
                  Apply at joinvanda.co →
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      <Footer />
    </div>
  )
}
