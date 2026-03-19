import { useState, useEffect } from 'react'
import { fetchSurveys } from '../../lib/adminApi.js'

export default function SurveysPanel() {
  const [surveys, setSurveys] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchSurveys()
      .then(setSurveys)
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  const formatDate = (d) => {
    if (!d) return ''
    return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  }

  // Group by event
  const grouped = {}
  for (const s of surveys) {
    const key = s.events?.id || 'unknown'
    if (!grouped[key]) grouped[key] = { event: s.events, surveys: [] }
    grouped[key].surveys.push(s)
  }

  const StarRating = ({ rating }) => (
    <span className="text-xs">
      {[1,2,3,4,5].map(n => (
        <span key={n} className={n <= rating ? 'text-p-green' : 'text-p-border'}>★</span>
      ))}
    </span>
  )

  return (
    <div>
      {loading ? (
        <div className="text-p-muted text-sm py-8 text-center">Loading...</div>
      ) : surveys.length === 0 ? (
        <div className="text-p-muted text-sm py-8 text-center">No surveys submitted yet.</div>
      ) : (
        <div className="space-y-4">
          {Object.entries(grouped).map(([eventId, { event, surveys: eventSurveys }]) => (
            <div key={eventId} className="bg-p-surface border border-p-border rounded-lg overflow-hidden">
              <div className="px-4 py-3 border-b border-p-border flex items-center justify-between">
                <div>
                  <div className="text-white text-sm font-medium">{event?.title || 'Unknown Event'}</div>
                  <div className="text-p-muted text-xs">{formatDate(event?.event_date)} · {event?.city}</div>
                </div>
                <span className="text-p-muted text-xs">{eventSurveys.length} response{eventSurveys.length !== 1 ? 's' : ''}</span>
              </div>

              <div className="divide-y divide-p-border">
                {eventSurveys.map(s => (
                  <div key={s.id} className="px-4 py-3">
                    <div className="flex items-start justify-between gap-3 mb-2">
                      <div>
                        <div className="text-white text-xs font-medium">
                          {s.applicants?.first_name} {s.applicants?.last_name}
                        </div>
                        <div className="text-p-muted text-[10px]">{formatDate(s.submitted_at)}</div>
                      </div>
                      <div className="flex flex-col items-end gap-1">
                        {s.rating && <StarRating rating={s.rating} />}
                        <div className="flex gap-2">
                          {s.showed_up && (
                            <span className={`text-[10px] px-1.5 py-0.5 rounded ${
                              s.showed_up === 'yes' ? 'bg-green-500/20 text-green-400' :
                              s.showed_up === 'partially' ? 'bg-yellow-500/20 text-yellow-400' :
                              'bg-red-500/20 text-red-400'
                            }`}>
                              {s.showed_up === 'yes' ? 'Full shift' : s.showed_up === 'partially' ? 'Partial' : 'No-show'}
                            </span>
                          )}
                          {s.would_work_again !== null && s.would_work_again !== undefined && (
                            <span className={`text-[10px] px-1.5 py-0.5 rounded ${
                              s.would_work_again ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'
                            }`}>
                              {s.would_work_again ? 'Would repeat' : 'Would not repeat'}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    {s.issues && (
                      <p className="text-p-muted text-xs mt-1"><span className="text-white">Issues:</span> {s.issues}</p>
                    )}
                    {s.feedback && (
                      <p className="text-p-muted text-xs mt-1"><span className="text-white">Feedback:</span> {s.feedback}</p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
