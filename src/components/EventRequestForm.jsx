import { useState } from 'react'

const ROLE_OPTIONS = [
  'Janitorial', 'Cleanup', 'Setup & Breakdown', 'Brand Activation',
  'General Labor', 'Security', 'Registration', 'Catering Support',
]

export default function EventRequestForm({ onSuccess }) {
  const [form, setForm] = useState({
    title: '', organizer: '', contact_name: '', contact_email: '',
    contact_phone: '', event_date: '', start_time: '', end_time: '',
    location: '', city: '', workers_needed: '', role_types: [],
    pay_rate: '', dress_code: '', notes: '',
  })
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState(null)

  const set = (field) => (e) => setForm({ ...form, [field]: e.target.value })

  const toggleRole = (role) => {
    setForm(prev => ({
      ...prev,
      role_types: prev.role_types.includes(role)
        ? prev.role_types.filter(r => r !== role)
        : [...prev.role_types, role],
    }))
  }

  const formatPhone = (val) => {
    const digits = val.replace(/\D/g, '').slice(0, 10)
    if (digits.length <= 3) return digits
    if (digits.length <= 6) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setSubmitting(true)
    setError(null)

    try {
      const res = await fetch('/api/events/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          workers_needed: parseInt(form.workers_needed, 10) || 1,
        }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error || 'Submission failed')
      }
      onSuccess(form.title)
    } catch (err) {
      setError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  const inputCls = 'w-full bg-p-surface border border-p-border rounded-lg px-4 py-3 text-white text-sm placeholder-p-muted focus:outline-none focus:border-p-green transition-colors'

  return (
    <div className="max-w-[600px] mx-auto px-6 py-8">
      <div className="mb-8">
        <a href="/" className="text-white font-extrabold text-2xl tracking-tight">Vanda</a>
        <p className="text-p-muted text-xs mt-1">Event Staffing Platform</p>
      </div>

      <h1 className="text-3xl font-extrabold text-white tracking-tight mb-2 fade-up">
        Request Staff
      </h1>
      <p className="text-p-muted text-sm mb-8 fade-up-delay-1">
        Tell us about your event and staffing needs. We'll get back to you within 24 hours.
      </p>

      <form onSubmit={handleSubmit} className="space-y-6 fade-up-delay-2">
        {/* Event Info */}
        <Section title="Event Details">
          <input className={inputCls} placeholder="Event Title *" value={form.title} onChange={set('title')} required />
          <input className={inputCls} placeholder="Organizer / Company *" value={form.organizer} onChange={set('organizer')} required />
          <div className="grid grid-cols-2 gap-3">
            <input className={inputCls} type="date" value={form.event_date} onChange={set('event_date')} required />
            <div className="grid grid-cols-2 gap-2">
              <input className={inputCls} type="time" value={form.start_time} onChange={set('start_time')} required />
              <input className={inputCls} type="time" value={form.end_time} onChange={set('end_time')} required />
            </div>
          </div>
          <input className={inputCls} placeholder="Venue / Address *" value={form.location} onChange={set('location')} required />
          <input className={inputCls} placeholder="City *" value={form.city} onChange={set('city')} required />
        </Section>

        {/* Contact */}
        <Section title="Contact Info">
          <input className={inputCls} placeholder="Your Name *" value={form.contact_name} onChange={set('contact_name')} required />
          <input className={inputCls} type="email" placeholder="Email *" value={form.contact_email} onChange={set('contact_email')} required />
          <input
            className={inputCls}
            type="tel"
            placeholder="Phone *"
            value={form.contact_phone}
            onChange={(e) => setForm({ ...form, contact_phone: formatPhone(e.target.value) })}
            required
          />
        </Section>

        {/* Staffing Needs */}
        <Section title="Staffing Needs">
          <div>
            <label className="text-p-muted text-xs mb-2 block">Workers Needed *</label>
            <input
              className={inputCls}
              type="number"
              min="1"
              placeholder="Number of workers"
              value={form.workers_needed}
              onChange={set('workers_needed')}
              required
            />
          </div>
          <div>
            <label className="text-p-muted text-xs mb-2 block">Role Types Needed</label>
            <div className="flex flex-wrap gap-2">
              {ROLE_OPTIONS.map(role => (
                <button
                  key={role}
                  type="button"
                  onClick={() => toggleRole(role)}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-all duration-150 ${
                    form.role_types.includes(role)
                      ? 'bg-p-green text-black border-p-green'
                      : 'bg-transparent text-p-muted border-p-border hover:border-p-muted'
                  }`}
                >
                  {role}
                </button>
              ))}
            </div>
          </div>
          <input className={inputCls} placeholder="Pay Rate (e.g. $18/hr)" value={form.pay_rate} onChange={set('pay_rate')} />
          <input className={inputCls} placeholder="Dress Code / Requirements" value={form.dress_code} onChange={set('dress_code')} />
        </Section>

        {/* Notes */}
        <Section title="Additional Info">
          <textarea
            className={`${inputCls} resize-none h-24`}
            placeholder="Special instructions, parking info, check-in details..."
            value={form.notes}
            onChange={set('notes')}
            maxLength={1000}
          />
        </Section>

        {error && (
          <div className="text-p-error text-sm bg-p-error/10 border border-p-error/20 rounded-lg px-4 py-3">
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={submitting}
          className="w-full bg-p-green text-black rounded-full py-4 font-semibold text-base hover:opacity-90 transition-all duration-200 disabled:opacity-50"
        >
          {submitting ? 'Submitting...' : 'Submit Request →'}
        </button>
      </form>
    </div>
  )
}

function Section({ title, children }) {
  return (
    <div className="space-y-3">
      <h3 className="text-white font-semibold text-sm tracking-wide">{title}</h3>
      {children}
    </div>
  )
}
