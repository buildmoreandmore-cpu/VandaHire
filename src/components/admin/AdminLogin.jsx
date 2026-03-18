import { useState } from 'react'
import { setToken } from '../../lib/adminApi.js'

export default function AdminLogin({ onLogin }) {
  const [token, setTokenVal] = useState('')
  const [error, setError] = useState(null)
  const [checking, setChecking] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!token.trim()) return
    setChecking(true)
    setError(null)

    // Verify token by hitting stats endpoint
    try {
      setToken(token.trim())
      const res = await fetch('/api/admin/stats', {
        headers: { 'Authorization': `Bearer ${token.trim()}` },
      })
      if (res.status === 401) {
        setError('Invalid token')
        setChecking(false)
        return
      }
      if (!res.ok) {
        setError('Server error — check configuration')
        setChecking(false)
        return
      }
      onLogin()
    } catch {
      setError('Connection error')
      setChecking(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center px-6">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <span className="text-white font-extrabold text-2xl tracking-tight">Vanda</span>
          <p className="text-p-muted text-xs mt-1">Coordinator Access</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <input
            type="password"
            placeholder="Admin Token"
            value={token}
            onChange={(e) => setTokenVal(e.target.value)}
            className="w-full bg-p-surface border border-p-border rounded-lg px-4 py-3 text-white text-sm placeholder-p-muted focus:outline-none focus:border-p-green transition-colors"
            autoFocus
          />
          {error && <p className="text-p-error text-sm">{error}</p>}
          <button
            type="submit"
            disabled={checking}
            className="w-full bg-p-green text-black rounded-full py-3 font-semibold text-sm hover:opacity-90 transition-all disabled:opacity-50"
          >
            {checking ? 'Verifying...' : 'Sign In'}
          </button>
        </form>
      </div>
    </div>
  )
}
