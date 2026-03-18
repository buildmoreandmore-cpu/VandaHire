import { useState } from 'react'
import ProgressBar from './ProgressBar.jsx'

const ROLES = [
  { value: 'janitorial', label: 'Janitorial' },
  { value: 'cleanup', label: 'Cleanup' },
  { value: 'setup_breakdown', label: 'Setup & Breakdown' },
  { value: 'brand_activation', label: 'Brand Activation' },
  { value: 'general_labor', label: 'General Labor' },
]

const AVAILABILITY = [
  { value: 'weekdays', label: 'Weekdays' },
  { value: 'weekends', label: 'Weekends' },
  { value: 'on_call', label: 'On-Call' },
]

const EXPERIENCE_TYPES = [
  { value: 'event_staffing', label: 'Event Staffing' },
  { value: 'warehouse', label: 'Warehouse' },
  { value: 'food_service', label: 'Food Service' },
  { value: 'retail', label: 'Retail' },
  { value: 'cleaning', label: 'Cleaning' },
  { value: 'moving', label: 'Moving / Labor' },
  { value: 'security', label: 'Security' },
  { value: 'none', label: 'No Experience Yet' },
]

const AVAILABILITY_WINDOWS = [
  { value: 'morning', label: 'Mornings (6a–12p)' },
  { value: 'afternoon', label: 'Afternoons (12–5p)' },
  { value: 'evening', label: 'Evenings (5–10p)' },
  { value: 'overnight', label: 'Overnight (10p–6a)' },
  { value: 'flexible', label: 'Flexible / Any' },
]

const SHORT_NOTICE_OPTIONS = [
  { value: 'yes', label: 'Yes' },
  { value: 'sometimes', label: 'Sometimes' },
  { value: 'no', label: 'No' },
]

function formatPhone(value) {
  const digits = value.replace(/\D/g, '').slice(0, 10)
  if (digits.length <= 3) return digits
  if (digits.length <= 6) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`
  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`
}

function PillToggle({ options, selected, onChange }) {
  const toggle = (val) => {
    if (selected.includes(val)) {
      onChange(selected.filter(v => v !== val))
    } else {
      onChange([...selected, val])
    }
  }
  return (
    <div className="flex flex-wrap gap-2">
      {options.map(opt => {
        const active = selected.includes(opt.value)
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => toggle(opt.value)}
            className={`rounded-full border px-4 py-2 text-sm font-medium transition-all duration-200 cursor-pointer
              ${active
                ? 'border-[#c8ff00] bg-[#c8ff00]/10 text-[#c8ff00]'
                : 'border-[#333] text-[#888] hover:border-[#555]'
              }`}
          >
            {opt.label}
          </button>
        )
      })}
    </div>
  )
}

function SingleSelect({ options, selected, onChange }) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map(opt => {
        const active = selected === opt.value
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange(opt.value)}
            className={`rounded-full border px-4 py-2 text-sm font-medium transition-all duration-200 cursor-pointer
              ${active
                ? 'border-[#c8ff00] bg-[#c8ff00]/10 text-[#c8ff00]'
                : 'border-[#333] text-[#888] hover:border-[#555]'
              }`}
          >
            {opt.label}
          </button>
        )
      })}
    </div>
  )
}

function Field({ label, error, children }) {
  return (
    <div>
      <label className="block text-[11px] font-semibold uppercase tracking-widest text-[#888] mb-2">
        {label}
      </label>
      {children}
      {error && <p className="text-[#ff4444] text-xs mt-1">{error}</p>}
    </div>
  )
}

export default function BasicInfoForm({ formData, onChange, onSubmit, submitting, submitError }) {
  const [errors, setErrors] = useState({})

  const set = (field, value) => {
    onChange(prev => ({ ...prev, [field]: value }))
    if (errors[field]) setErrors(prev => ({ ...prev, [field]: null }))
  }

  const validate = () => {
    const e = {}
    if (!formData.first_name.trim()) e.first_name = 'Required'
    if (!formData.last_name.trim()) e.last_name = 'Required'
    if (!formData.email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      e.email = 'Enter a valid email'
    }
    const phoneDigits = formData.phone.replace(/\D/g, '')
    if (phoneDigits.length < 10) e.phone = 'Enter a 10-digit US phone number'
    if (!formData.city.trim()) e.city = 'Required'
    if (!formData.zip.trim() || !/^\d{5}$/.test(formData.zip)) e.zip = 'Enter a valid 5-digit zip'
    if (formData.roles.length === 0) e.roles = 'Select at least one role'
    if (formData.availability.length === 0) e.availability = 'Select at least one option'
    if (formData.experience_types.length === 0) e.experience_types = 'Select at least one'
    if (formData.availability_windows.length === 0) e.availability_windows = 'Select at least one'
    if (!formData.has_transportation) e.has_transportation = 'Required'
    if (!formData.short_notice) e.short_notice = 'Required'
    return e
  }

  const handleSubmit = () => {
    const e = validate()
    if (Object.keys(e).length > 0) {
      setErrors(e)
      return
    }
    onSubmit()
  }

  const inputClass = (field) =>
    `w-full bg-[#141414] border rounded-xl px-4 py-3 text-white text-base focus:outline-none focus:ring-2 focus:ring-[#c8ff00] placeholder-[#555] transition-all duration-200 ${
      errors[field] ? 'border-[#ff4444]' : 'border-[#222]'
    }`

  return (
    <div className="min-h-screen bg-[#0a0a0a] flex flex-col">
      <ProgressBar step={1} total={2} />

      <div className="flex-1 flex flex-col max-w-[480px] mx-auto w-full px-6 py-10">
        <div className="mb-8">
          <span className="text-white font-extrabold text-xl tracking-tight">Porter</span>
          <p className="text-[#555] text-xs mt-1">Step 1 of 2</p>
        </div>

        <h2 className="text-3xl font-bold text-white mb-2 tracking-tight">Apply now</h2>
        <p className="text-[#888] text-sm mb-8">No resume needed. Just tap through a few quick questions.</p>

        <div className="flex flex-col gap-5">
          <div className="grid grid-cols-2 gap-3">
            <Field label="First Name" error={errors.first_name}>
              <input
                type="text"
                placeholder="Marcus"
                value={formData.first_name}
                onChange={e => set('first_name', e.target.value)}
                className={inputClass('first_name')}
              />
            </Field>
            <Field label="Last Name" error={errors.last_name}>
              <input
                type="text"
                placeholder="Jones"
                value={formData.last_name}
                onChange={e => set('last_name', e.target.value)}
                className={inputClass('last_name')}
              />
            </Field>
          </div>

          <Field label="Email" error={errors.email}>
            <input
              type="email"
              placeholder="marcus@gmail.com"
              value={formData.email}
              onChange={e => set('email', e.target.value)}
              className={inputClass('email')}
            />
          </Field>

          <Field label="Phone" error={errors.phone}>
            <input
              type="tel"
              placeholder="(404) 555-0123"
              value={formData.phone}
              onChange={e => set('phone', formatPhone(e.target.value))}
              className={inputClass('phone')}
            />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="City" error={errors.city}>
              <input
                type="text"
                placeholder="Atlanta"
                value={formData.city}
                onChange={e => set('city', e.target.value)}
                className={inputClass('city')}
              />
            </Field>
            <Field label="Zip Code" error={errors.zip}>
              <input
                type="text"
                placeholder="30303"
                value={formData.zip}
                onChange={e => set('zip', e.target.value.replace(/\D/g, '').slice(0, 5))}
                className={inputClass('zip')}
              />
            </Field>
          </div>

          <Field label="Role Interest" error={errors.roles}>
            <PillToggle
              options={ROLES}
              selected={formData.roles}
              onChange={val => set('roles', val)}
            />
          </Field>

          <Field label="General Availability" error={errors.availability}>
            <PillToggle
              options={AVAILABILITY}
              selected={formData.availability}
              onChange={val => set('availability', val)}
            />
          </Field>

          {/* Structured screening */}
          <div className="border-t border-[#222] pt-5 mt-2">
            <p className="text-[#888] text-sm mb-5">A few quick taps — no writing required.</p>

            <div className="flex flex-col gap-5">
              <Field label="Past Experience" error={errors.experience_types}>
                <PillToggle
                  options={EXPERIENCE_TYPES}
                  selected={formData.experience_types}
                  onChange={val => set('experience_types', val)}
                />
              </Field>

              <Field label="Shift Windows" error={errors.availability_windows}>
                <PillToggle
                  options={AVAILABILITY_WINDOWS}
                  selected={formData.availability_windows}
                  onChange={val => set('availability_windows', val)}
                />
              </Field>

              <Field label="Reliable Transportation?" error={errors.has_transportation}>
                <SingleSelect
                  options={[{ value: 'yes', label: 'Yes' }, { value: 'no', label: 'No' }]}
                  selected={formData.has_transportation}
                  onChange={val => set('has_transportation', val)}
                />
              </Field>

              <Field label="Available on Short Notice?" error={errors.short_notice}>
                <SingleSelect
                  options={SHORT_NOTICE_OPTIONS}
                  selected={formData.short_notice}
                  onChange={val => set('short_notice', val)}
                />
              </Field>

              <Field label="Anything Else? (optional)">
                <textarea
                  placeholder="Anything we should know..."
                  value={formData.notes}
                  onChange={e => set('notes', e.target.value)}
                  rows={2}
                  maxLength={300}
                  className={inputClass('notes') + ' resize-none'}
                />
              </Field>
            </div>
          </div>
        </div>

        {submitError && (
          <div className="mt-4 bg-[#ff4444]/10 border border-[#ff4444]/30 rounded-xl px-4 py-3">
            <p className="text-[#ff4444] text-sm">{submitError}</p>
          </div>
        )}

        <button
          onClick={handleSubmit}
          disabled={submitting}
          className={`mt-8 w-full rounded-full py-4 font-semibold text-base transition-all duration-200 flex items-center justify-center gap-2
            ${submitting
              ? 'bg-[#333] text-[#666] cursor-not-allowed'
              : 'bg-[#c8ff00] text-black hover:opacity-90 cursor-pointer'
            }`}
        >
          {submitting ? (
            <>
              <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              Submitting...
            </>
          ) : (
            'Submit Application'
          )}
        </button>
      </div>
    </div>
  )
}
