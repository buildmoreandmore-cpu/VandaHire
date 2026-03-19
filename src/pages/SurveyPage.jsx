import { useState, useEffect } from 'react'
import SurveyForm from '../components/SurveyForm.jsx'
import VandaLogo from '../components/VandaLogo.jsx'

export default function SurveyPage({ token }) {
  const [survey, setSurvey] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [submitted, setSubmitted] = useState(false)

  useEffect(() => {
    if (!token) {
      setError('Invalid survey link')
      setLoading(false)
      return
    }

    fetch(`/api/survey?token=${encodeURIComponent(token)}`)
      .then(r => r.json())
      .then(data => {
        if (data.error === 'already_submitted') {
          setSubmitted(true)
        } else if (data.error) {
          setError(data.message || data.error)
        } else {
          setSurvey(data)
        }
      })
      .catch(() => setError('Failed to load survey'))
      .finally(() => setLoading(false))
  }, [token])

  const formatDate = (d) => d
    ? new Date(d + 'T00:00:00').toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
    : ''

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
        <p className="text-p-muted text-sm">Loading...</p>
      </div>
    )
  }

  if (submitted) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex flex-col items-center justify-center px-6 text-center">
        <div className="text-5xl mb-4">✅</div>
        <h2 className="text-2xl font-extrabold text-white mb-2">Already Submitted</h2>
        <p className="text-p-muted text-sm">Your survey has already been recorded. Thanks!</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex flex-col items-center justify-center px-6 text-center">
        <div className="text-5xl mb-4">🔗</div>
        <h2 className="text-2xl font-extrabold text-white mb-2">Invalid Link</h2>
        <p className="text-p-muted text-sm">{error}</p>
      </div>
    )
  }

  if (survey && !submitted) {
    return (
      <div className="min-h-screen bg-[#0a0a0a]">
        <div className="border-b border-p-border px-5 py-4">
          <VandaLogo size="sm" />
        </div>

        <div className="max-w-[540px] mx-auto px-5 py-8">
          <div className="mb-8">
            <h1 className="text-2xl font-extrabold text-white tracking-tight mb-1">Post-Shift Survey</h1>
            <p className="text-p-muted text-sm">
              {survey.event?.title} · {formatDate(survey.event?.event_date)}
            </p>
            <p className="text-p-muted text-xs mt-0.5">
              Hi {survey.worker?.first_name} — thanks for working with Vanda!
            </p>
          </div>

          <SurveyForm
            token={token}
            event={survey.event}
            worker={survey.worker}
            onSubmitted={() => {
              setSurvey(null)
              setSubmitted(true)
            }}
          />
        </div>
      </div>
    )
  }

  // Submitted success
  return (
    <div className="min-h-screen bg-[#0a0a0a] flex flex-col items-center justify-center px-6 text-center">
      <div className="text-5xl mb-4">🙌</div>
      <h2 className="text-2xl font-extrabold text-white mb-2">Thanks for the feedback!</h2>
      <p className="text-p-muted text-sm">We'll use it to keep improving. Hope to see you on the next one.</p>
    </div>
  )
}
