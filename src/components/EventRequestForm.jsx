import { useState } from 'react'
import { useNavigate } from '../Router.jsx'
import VandaLogo from './VandaLogo.jsx'

const ROLE_OPTIONS = [
  'Janitorial', 'Cleanup', 'Setup & Breakdown', 'Brand Activation',
  'General Labor', 'Security', 'Registration', 'Catering Support',
]

const SERVICE_TYPES = [
  { value: 'single_event', label: 'One-Time Event', desc: 'I need staff for a one-time event' },
  { value: 'ongoing', label: 'Ongoing Staffing', desc: 'I need ongoing staffing support' },
  { value: 'direct_hire', label: 'Direct Hire', desc: 'I want to hire from your pool directly' },
]

const SERVICE_TIERS = [
  {
    value: 'labor_supply',
    label: 'Labor Supply',
    desc: 'We provide pre-screened workers. You supervise on site.',
    features: ['Vetted workers', 'SMS dispatch', 'GPS check-in'],
  },
  {
    value: 'managed_labor',
    label: 'Managed Labor',
    desc: 'We provide workers + a V&A Hire supervisor. You focus on your event.',
    features: ['On-site V&A Hire supervisor', 'Live crew tracking', 'Incident reporting', 'Post-event report'],
  },
]

const EMPTY_SLOT = { date: '', time: '', label: '' }

export default function EventRequestForm({ onSuccess }) {
  const navigate = useNavigate()
  const [form, setForm] = useState({
    title: '', organizer: '', contact_name: '', contact_email: '',
    contact_phone: '', event_date: '', start_time: '', end_time: '',
    location: '', city: '', workers_needed: '', role_types: [],
    pay_rate: '', dress_code: '', notes: '',
    // new fields
    service_tier: 'labor_supply',
    service_type: 'single_event',
    meeting_point: '', supervisor_name: '', supervisor_phone: '',
    briefing_required: false,
    briefing_mode: 'fixed', // 'fixed' | 'slots'
    briefing_date: '', briefing_time: '', briefing_location: '',
    briefing_slots: [{ ...EMPTY_SLOT }],
  })
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState(null)
  const [touched, setTouched] = useState({})

  const set = (field) => (e) => setForm({ ...form, [field]: e.target.value })
  const markTouched = (field) => () => setTouched(prev => ({ ...prev, [field]: true }))
  const setBool = (field) => (val) => setForm(prev => ({ ...prev, [field]: val }))

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

  const updateSlot = (idx, field, value) => {
    const slots = form.briefing_slots.map((s, i) => i === idx ? { ...s, [field]: value } : s)
    setForm(prev => ({ ...prev, briefing_slots: slots }))
  }

  const addSlot = () => {
    if (form.briefing_slots.length < 3) {
      setForm(prev => ({ ...prev, briefing_slots: [...prev.briefing_slots, { ...EMPTY_SLOT }] }))
    }
  }

  const removeSlot = (idx) => {
    setForm(prev => ({ ...prev, briefing_slots: prev.briefing_slots.filter((_, i) => i !== idx) }))
  }

  const REQUIRED_FIELDS = ['title', 'organizer', 'contact_name', 'contact_email', 'contact_phone', 'event_date', 'start_time', 'end_time', 'location', 'city', 'workers_needed']

  const handleSubmit = async (e) => {
    e.preventDefault()
    setAttempted(true)

    const missing = REQUIRED_FIELDS.filter(f => isEmpty(f))
    if (missing.length > 0) {
      setError('Please fill in all required fields.')
      return
    }

    setSubmitting(true)
    setError(null)

    try {
      const payload = {
        ...form,
        workers_needed: parseInt(form.workers_needed, 10) || 1,
        briefing_slots: form.briefing_mode === 'slots' ? form.briefing_slots : [],
        briefing_date: form.briefing_mode === 'fixed' ? form.briefing_date : null,
        briefing_time: form.briefing_mode === 'fixed' ? form.briefing_time : null,
        briefing_location: form.briefing_required ? form.briefing_location : '',
      }
      const res = await fetch('/api/events/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
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

  const [attempted, setAttempted] = useState(false)

  const isEmpty = (field) => !form[field] || (typeof form[field] === 'string' && !form[field].trim())
  const showError = (field) => (attempted || touched[field]) && isEmpty(field)

  const inputCls = 'w-full bg-p-surface border border-p-border rounded-lg px-4 py-3 text-white text-sm placeholder-p-muted focus:outline-none focus:border-p-green transition-colors'
  const errorCls = 'w-full bg-p-surface border border-red-500 rounded-lg px-4 py-3 text-white text-sm placeholder-p-muted focus:outline-none focus:border-red-400 transition-colors'
  const isCustomService = form.service_type === 'ongoing' || form.service_type === 'direct_hire'

  return (
    <div className="max-w-[600px] mx-auto px-6 py-8">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <VandaLogo onClick={() => navigate('/')} />
          <p className="text-p-muted text-xs mt-1">Event Staffing Platform</p>
        </div>
        <button onClick={() => navigate('/')} className="text-[#555] text-sm hover:text-white transition-colors">← Back</button>
      </div>

      <h1 className="text-3xl font-extrabold text-white tracking-tight mb-2 fade-up">
        Request Staff
      </h1>
      <p className="text-p-muted text-sm mb-8 fade-up-delay-1">
        Tell us about your event and staffing needs. Choose labor supply or fully managed — we'll confirm within 24 hours.
      </p>

      <form onSubmit={handleSubmit} className="space-y-6 fade-up-delay-2">

        {/* Service Tier */}
        <Section title="How much do you need from us?">
          <div className="grid grid-cols-2 gap-3">
            {SERVICE_TIERS.map(tier => (
              <button
                key={tier.value}
                type="button"
                onClick={() => setForm(prev => ({ ...prev, service_tier: tier.value }))}
                className={`p-4 rounded-lg border text-left transition-all duration-150 ${
                  form.service_tier === tier.value
                    ? 'border-p-green bg-p-green/10'
                    : 'border-p-border bg-p-surface hover:border-p-muted'
                }`}
              >
                <div className={`text-sm font-bold mb-1 ${form.service_tier === tier.value ? 'text-p-green' : 'text-white'}`}>
                  {tier.label}
                </div>
                <div className="text-p-muted text-[10px] leading-tight mb-2">{tier.desc}</div>
                <div className="flex flex-wrap gap-1">
                  {tier.features.map(f => (
                    <span key={f} className="text-[9px] text-[#555] bg-white/5 rounded px-1.5 py-0.5">{f}</span>
                  ))}
                </div>
              </button>
            ))}
          </div>
          {form.service_tier === 'managed_labor' && (
            <div className="bg-[#16a34a]/5 border border-[#16a34a]/20 rounded-lg px-4 py-3 text-[#16a34a] text-xs leading-relaxed">
              A V&A Hire supervisor will be assigned to your event. They'll manage the crew on the ground — check-in, task assignments, incident handling, and client communication. You get a single point of contact and a post-event report.
            </div>
          )}
        </Section>

        {/* Service Type */}
        <Section title="Service Type">
          <div className="grid grid-cols-3 gap-2">
            {SERVICE_TYPES.map(st => (
              <button
                key={st.value}
                type="button"
                onClick={() => setForm(prev => ({ ...prev, service_type: st.value }))}
                className={`p-3 rounded-lg border text-left transition-all duration-150 ${
                  form.service_type === st.value
                    ? 'border-p-green bg-p-green/10'
                    : 'border-p-border bg-p-surface hover:border-p-muted'
                }`}
              >
                <div className={`text-xs font-semibold mb-1 ${form.service_type === st.value ? 'text-p-green' : 'text-white'}`}>
                  {st.label}
                </div>
                <div className="text-p-muted text-[10px] leading-tight">{st.desc}</div>
              </button>
            ))}
          </div>
          {isCustomService && (
            <div className="bg-p-surface border border-p-border rounded-lg px-4 py-3 text-p-muted text-xs">
              We'll reach out to discuss a custom arrangement after you submit.
            </div>
          )}
        </Section>

        {/* Event Info */}
        <Section title="Event Details">
          <FieldLabel label="Event Title" required error={showError('title')} />
          <input className={showError('title') ? errorCls : inputCls} placeholder="Event Title" value={form.title} onChange={set('title')} onBlur={markTouched('title')} required />
          <FieldLabel label="Organizer / Company" required error={showError('organizer')} />
          <input className={showError('organizer') ? errorCls : inputCls} placeholder="Organizer / Company" value={form.organizer} onChange={set('organizer')} onBlur={markTouched('organizer')} required />
          <div className="grid grid-cols-2 gap-3">
            <div>
              <FieldLabel label="Event Date" required error={showError('event_date')} />
              <input className={showError('event_date') ? errorCls : inputCls} type="date" value={form.event_date} onChange={set('event_date')} onBlur={markTouched('event_date')} required />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <FieldLabel label="Start" required error={showError('start_time')} />
                <input className={showError('start_time') ? errorCls : inputCls} type="time" value={form.start_time} onChange={set('start_time')} onBlur={markTouched('start_time')} required />
              </div>
              <div>
                <FieldLabel label="End" required error={showError('end_time')} />
                <input className={showError('end_time') ? errorCls : inputCls} type="time" value={form.end_time} onChange={set('end_time')} onBlur={markTouched('end_time')} required />
              </div>
            </div>
          </div>
          <FieldLabel label="Venue / Address" required error={showError('location')} />
          <input className={showError('location') ? errorCls : inputCls} placeholder="Venue / Address" value={form.location} onChange={set('location')} onBlur={markTouched('location')} required />
          <FieldLabel label="City" required error={showError('city')} />
          <input className={showError('city') ? errorCls : inputCls} placeholder="City" value={form.city} onChange={set('city')} onBlur={markTouched('city')} required />
        </Section>

        {/* Contact */}
        <Section title="Contact Info">
          <FieldLabel label="Your Name" required error={showError('contact_name')} />
          <input className={showError('contact_name') ? errorCls : inputCls} placeholder="Your Name" value={form.contact_name} onChange={set('contact_name')} onBlur={markTouched('contact_name')} required />
          <FieldLabel label="Email" required error={showError('contact_email')} />
          <input className={showError('contact_email') ? errorCls : inputCls} type="email" placeholder="Email" value={form.contact_email} onChange={set('contact_email')} onBlur={markTouched('contact_email')} required />
          <FieldLabel label="Phone" required error={showError('contact_phone')} />
          <input
            className={showError('contact_phone') ? errorCls : inputCls}
            type="tel"
            placeholder="Phone"
            value={form.contact_phone}
            onChange={(e) => setForm({ ...form, contact_phone: formatPhone(e.target.value) })}
            onBlur={markTouched('contact_phone')}
            required
          />
        </Section>

        {/* Staffing Needs */}
        <Section title="Staffing Needs">
          <div>
            <FieldLabel label="Workers Needed" required error={showError('workers_needed')} />
            <input
              className={showError('workers_needed') ? errorCls : inputCls}
              type="number"
              min="1"
              placeholder="Number of workers"
              value={form.workers_needed}
              onChange={set('workers_needed')}
              onBlur={markTouched('workers_needed')}
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

        {/* On-Site Info */}
        <Section title="On-Site Info">
          <input
            className={inputCls}
            placeholder="Exact meeting point (e.g. back entrance on Peachtree St)"
            value={form.meeting_point}
            onChange={set('meeting_point')}
          />
          {form.service_tier === 'labor_supply' && (
            <>
              <input
                className={inputCls}
                placeholder="Your on-site supervisor name"
                value={form.supervisor_name}
                onChange={set('supervisor_name')}
              />
              <input
                className={inputCls}
                type="tel"
                placeholder="Supervisor's cell"
                value={form.supervisor_phone}
                onChange={(e) => setForm({ ...form, supervisor_phone: formatPhone(e.target.value) })}
              />
            </>
          )}
          {form.service_tier === 'managed_labor' && (
            <div className="bg-p-surface border border-p-border rounded-lg px-4 py-3 text-p-muted text-xs">
              A V&A Hire supervisor will be assigned after you submit. They'll arrive 30 min before your crew, manage check-in, and be your single point of contact on site.
            </div>
          )}
        </Section>

        {/* Pre-Event Briefing */}
        <Section title="Pre-Event Briefing">
          <div className="flex items-center justify-between bg-p-surface border border-p-border rounded-lg px-4 py-3">
            <span className="text-white text-sm">Schedule a pre-event briefing for your workers?</span>
            <button
              type="button"
              onClick={() => setBool('briefing_required')(!form.briefing_required)}
              className={`w-10 h-5 rounded-full transition-all duration-200 relative ${form.briefing_required ? 'bg-p-green' : 'bg-p-border'}`}
            >
              <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all duration-200 ${form.briefing_required ? 'left-5' : 'left-0.5'}`} />
            </button>
          </div>

          {form.briefing_required && (
            <div className="space-y-3 pl-1">
              <div className="flex gap-4">
                {['fixed', 'slots'].map(mode => (
                  <label key={mode} className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="briefing_mode"
                      value={mode}
                      checked={form.briefing_mode === mode}
                      onChange={() => setForm(prev => ({ ...prev, briefing_mode: mode }))}
                      className="accent-p-green"
                    />
                    <span className="text-white text-xs">
                      {mode === 'fixed' ? 'Fixed time' : 'Offer time slots'}
                    </span>
                  </label>
                ))}
              </div>

              {form.briefing_mode === 'fixed' && (
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <input className={inputCls} type="date" value={form.briefing_date} onChange={set('briefing_date')} />
                    <input className={inputCls} type="time" value={form.briefing_time} onChange={set('briefing_time')} />
                  </div>
                  <input
                    className={inputCls}
                    placeholder="Briefing location"
                    value={form.briefing_location}
                    onChange={set('briefing_location')}
                  />
                </div>
              )}

              {form.briefing_mode === 'slots' && (
                <div className="space-y-2">
                  <input
                    className={inputCls}
                    placeholder="Briefing location"
                    value={form.briefing_location}
                    onChange={set('briefing_location')}
                  />
                  {form.briefing_slots.map((slot, idx) => (
                    <div key={idx} className="flex gap-2 items-center">
                      <input
                        className={`${inputCls} flex-1`}
                        type="date"
                        value={slot.date}
                        onChange={(e) => updateSlot(idx, 'date', e.target.value)}
                      />
                      <input
                        className={`${inputCls} flex-1`}
                        type="time"
                        value={slot.time}
                        onChange={(e) => updateSlot(idx, 'time', e.target.value)}
                      />
                      <input
                        className={`${inputCls} flex-1`}
                        placeholder="Label (e.g. Option A)"
                        value={slot.label}
                        onChange={(e) => updateSlot(idx, 'label', e.target.value)}
                      />
                      {form.briefing_slots.length > 1 && (
                        <button type="button" onClick={() => removeSlot(idx)} className="text-p-muted hover:text-white text-lg leading-none">×</button>
                      )}
                    </div>
                  ))}
                  {form.briefing_slots.length < 3 && (
                    <button
                      type="button"
                      onClick={addSlot}
                      className="text-p-green text-xs hover:opacity-80 transition-opacity"
                    >
                      + Add another slot
                    </button>
                  )}
                </div>
              )}
            </div>
          )}
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

function FieldLabel({ label, required, error }) {
  return (
    <label className={`text-xs mb-1 block ${error ? 'text-red-400' : 'text-p-muted'}`}>
      {label}{required && <span className="text-red-500 ml-0.5">*</span>}
    </label>
  )
}
