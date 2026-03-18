import { useState, useEffect } from 'react'
import { fetchApplicants, updateApplicant } from '../../lib/adminApi.js'

const STATUS_OPTIONS = ['all', 'pending', 'qualified', 'needs_review', 'not_a_fit', 'approved', 'rejected']

const STATUS_COLORS = {
  pending: 'bg-yellow-500/20 text-yellow-400',
  qualified: 'bg-blue-500/20 text-blue-400',
  needs_review: 'bg-orange-500/20 text-orange-400',
  not_a_fit: 'bg-red-500/20 text-red-400',
  approved: 'bg-green-500/20 text-green-400',
  rejected: 'bg-red-500/20 text-red-400',
}

export default function ApplicantsPanel() {
  const [applicants, setApplicants] = useState([])
  const [filter, setFilter] = useState('all')
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState(null)
  const [updating, setUpdating] = useState(null)

  const load = async () => {
    setLoading(true)
    try {
      const data = await fetchApplicants(filter === 'all' ? '' : filter)
      setApplicants(data)
    } catch (err) {
      console.error('Failed to load applicants:', err)
    }
    setLoading(false)
  }

  useEffect(() => { load() }, [filter])

  const handleStatusChange = async (id, newStatus) => {
    setUpdating(id)
    try {
      await updateApplicant(id, newStatus)
      setApplicants(prev => prev.map(a => a.id === id ? { ...a, status: newStatus } : a))
    } catch (err) {
      console.error('Failed to update:', err)
    }
    setUpdating(null)
  }

  return (
    <div>
      {/* Filters */}
      <div className="flex gap-2 mb-4 overflow-x-auto pb-2">
        {STATUS_OPTIONS.map(s => (
          <button
            key={s}
            onClick={() => setFilter(s)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-all ${
              filter === s
                ? 'bg-p-green text-black'
                : 'bg-p-surface text-p-muted border border-p-border hover:border-p-muted'
            }`}
          >
            {s === 'all' ? 'All' : s.replace(/_/g, ' ')}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="text-p-muted text-sm py-8 text-center">Loading...</div>
      ) : applicants.length === 0 ? (
        <div className="text-p-muted text-sm py-8 text-center">No applicants found</div>
      ) : (
        <div className="space-y-2">
          {applicants.map(a => (
            <div key={a.id} className="bg-p-surface border border-p-border rounded-lg overflow-hidden">
              {/* Row */}
              <button
                onClick={() => setExpanded(expanded === a.id ? null : a.id)}
                className="w-full px-4 py-3 flex items-center gap-3 text-left hover:bg-white/[0.02] transition-colors"
              >
                {a.photo_url ? (
                  <img src={a.photo_url} alt="" className="w-10 h-10 rounded-full object-cover flex-shrink-0" />
                ) : (
                  <div className="w-10 h-10 rounded-full bg-p-border flex items-center justify-center flex-shrink-0">
                    <span className="text-p-muted text-xs">{a.first_name?.[0]}{a.last_name?.[0]}</span>
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <div className="text-white text-sm font-medium truncate">{a.first_name} {a.last_name}</div>
                  <div className="text-p-muted text-xs truncate">{a.city} · {a.email}</div>
                </div>
                <span className={`px-2 py-0.5 rounded text-xs font-medium ${STATUS_COLORS[a.status] || 'bg-p-border text-p-muted'}`}>
                  {a.status?.replace(/_/g, ' ')}
                </span>
                <span className="text-p-muted text-xs">{new Date(a.created_at).toLocaleDateString()}</span>
              </button>

              {/* Expanded Detail */}
              {expanded === a.id && (
                <div className="px-4 pb-4 border-t border-p-border pt-3">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {/* Photo */}
                    {a.photo_url && (
                      <div>
                        <img src={a.photo_url} alt="Selfie" className="w-32 h-32 rounded-lg object-cover" />
                      </div>
                    )}

                    {/* Details */}
                    <div className="space-y-2 text-sm">
                      <Detail label="Phone" value={a.phone} />
                      <Detail label="Zip" value={a.zip} />
                      <Detail label="Roles" value={a.roles?.join(', ')} />
                      <Detail label="Availability" value={a.availability?.join(', ')} />
                      <Detail label="Experience" value={a.experience_types?.join(', ')} />
                      <Detail label="Shift Windows" value={a.availability_windows?.join(', ')} />
                      <Detail label="Transportation" value={a.has_transportation} />
                      <Detail label="Short Notice" value={a.short_notice} />
                      {a.notes && <Detail label="Notes" value={a.notes} />}
                    </div>
                  </div>

                  {/* Score */}
                  {a.score_breakdown?.reasoning && (
                    <div className="mt-3 bg-black/30 rounded-lg px-3 py-2">
                      <span className="text-p-muted text-xs">AI Score: </span>
                      <span className="text-white text-xs">{a.score_breakdown.decision}</span>
                      <p className="text-p-muted text-xs mt-1">{a.score_breakdown.reasoning}</p>
                    </div>
                  )}

                  {/* Actions */}
                  <div className="flex gap-2 mt-4">
                    {a.status !== 'approved' && (
                      <ActionBtn
                        label="Approve"
                        cls="bg-green-600 hover:bg-green-700"
                        loading={updating === a.id}
                        onClick={() => handleStatusChange(a.id, 'approved')}
                      />
                    )}
                    {a.status !== 'rejected' && (
                      <ActionBtn
                        label="Reject"
                        cls="bg-red-600 hover:bg-red-700"
                        loading={updating === a.id}
                        onClick={() => handleStatusChange(a.id, 'rejected')}
                      />
                    )}
                    {a.status !== 'needs_review' && a.status !== 'approved' && a.status !== 'rejected' && (
                      <ActionBtn
                        label="Flag for Review"
                        cls="bg-orange-600 hover:bg-orange-700"
                        loading={updating === a.id}
                        onClick={() => handleStatusChange(a.id, 'needs_review')}
                      />
                    )}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function Detail({ label, value }) {
  if (!value) return null
  return (
    <div>
      <span className="text-p-muted">{label}: </span>
      <span className="text-white">{value}</span>
    </div>
  )
}

function ActionBtn({ label, cls, loading, onClick }) {
  return (
    <button
      onClick={onClick}
      disabled={loading}
      className={`px-3 py-1.5 rounded-lg text-xs font-medium text-white transition-colors disabled:opacity-50 ${cls}`}
    >
      {loading ? '...' : label}
    </button>
  )
}
