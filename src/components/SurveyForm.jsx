import { useState } from 'react'

const STARS = [1, 2, 3, 4, 5]

export default function SurveyForm({ token, event, worker, onSubmitted }) {
  const [form, setForm] = useState({
    showed_up: null, // 'yes' | 'partially' | 'no'
    rating: null,
    would_work_again: null, // true | false
    issues: '',
    feedback: '',
  })
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState(null)

  const set = (field, value) => setForm(prev => ({ ...prev, [field]: value }))

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (form.showed_up === null) return setError('Please answer all required questions')
    if (form.rating === null) return setError('Please rate your experience')
    if (form.would_work_again === null) return setError('Please answer all required questions')

    setSubmitting(true)
    setError(null)

    try {
      const res = await fetch('/api/survey', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, ...form }),
      })

      const body = await res.json()
      if (!res.ok) throw new Error(body.error || 'Submission failed')

      onSubmitted()
    } catch (err) {
      setError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  const inputCls = 'w-full bg-[#111] border border-p-border rounded-lg px-4 py-3 text-white text-sm placeholder-p-muted focus:outline-none focus:border-p-green transition-colors'

  return (
    <form onSubmit={handleSubmit} className="space-y-8">
      {/* Q1: Showed up */}
      <div>
        <p className="text-white text-sm font-medium mb-3">Did you complete the full shift? *</p>
        <div className="flex gap-2">
          {[['yes', 'Yes, full shift'], ['partially', 'Partially'], ['no', 'No']].map(([val, label]) => (
            <button
              key={val}
              type="button"
              onClick={() => set('showed_up', val)}
              className={`flex-1 py-2.5 rounded-lg border text-xs font-medium transition-all ${
                form.showed_up === val
                  ? 'border-p-green bg-p-green/10 text-p-green'
                  : 'border-p-border text-p-muted hover:border-p-muted'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Q2: Star rating */}
      <div>
        <p className="text-white text-sm font-medium mb-3">Overall experience (1–5 stars) *</p>
        <div className="flex gap-2">
          {STARS.map(star => (
            <button
              key={star}
              type="button"
              onClick={() => set('rating', star)}
              className={`text-2xl transition-all ${form.rating >= star ? 'text-p-green' : 'text-p-border hover:text-p-muted'}`}
            >
              ★
            </button>
          ))}
        </div>
      </div>

      {/* Q3: Issues */}
      <div>
        <p className="text-white text-sm font-medium mb-3">Were there any issues on site? <span className="text-p-muted font-normal">(optional)</span></p>
        <textarea
          className={`${inputCls} resize-none h-20`}
          placeholder="Describe any problems you encountered..."
          value={form.issues}
          onChange={(e) => set('issues', e.target.value)}
          maxLength={500}
        />
      </div>

      {/* Q4: Work again */}
      <div>
        <p className="text-white text-sm font-medium mb-3">Would you work this type of event again? *</p>
        <div className="flex gap-2">
          {[[true, 'Yes'], [false, 'No']].map(([val, label]) => (
            <button
              key={String(val)}
              type="button"
              onClick={() => set('would_work_again', val)}
              className={`flex-1 py-2.5 rounded-lg border text-xs font-medium transition-all ${
                form.would_work_again === val
                  ? 'border-p-green bg-p-green/10 text-p-green'
                  : 'border-p-border text-p-muted hover:border-p-muted'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Q5: Feedback */}
      <div>
        <p className="text-white text-sm font-medium mb-3">Any feedback for V&A Hire? <span className="text-p-muted font-normal">(optional)</span></p>
        <textarea
          className={`${inputCls} resize-none h-20`}
          placeholder="Suggestions, shoutouts, anything we should know..."
          value={form.feedback}
          onChange={(e) => set('feedback', e.target.value)}
          maxLength={500}
        />
      </div>

      {error && (
        <div className="text-red-400 text-sm bg-red-400/10 border border-red-400/20 rounded-lg px-4 py-3">
          {error}
        </div>
      )}

      <button
        type="submit"
        disabled={submitting}
        className="w-full bg-p-green text-black rounded-full py-4 font-semibold text-base hover:opacity-90 transition-all disabled:opacity-50"
      >
        {submitting ? 'Submitting...' : 'Submit Survey →'}
      </button>
    </form>
  )
}
